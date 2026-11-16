import Ionicons from '@expo/vector-icons/Ionicons';
import {
  AndroidAudioTypePresets, AudioSession, LiveKitRoom, useLocalParticipant, useRemoteParticipants,
} from '@livekit/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Vibration, View } from 'react-native';
import Animated, { FadeIn, FadeInUp, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '@/components/ui/misc';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { CALL_POLL_MS, callIsOver, callSeconds, endedLabel, formatCallLength, otherParty } from '@/lib/calls';
import { config } from '@/lib/config';
import type { Call, JoinCredentials } from '@/lib/types';
import { colors } from '@/theme';

/** How long the "Call ended" screen stays before closing by itself. */
const CLOSE_AFTER_MS = 1800;

function RoundButton({ icon, label, onPress, bg, active, size = 64 }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; bg?: string; active?: boolean; size?: number;
}) {
  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      <PressableScale scaleTo={0.9} onPress={onPress} accessibilityLabel={label}
        style={[styles.round, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg ?? (active ? colors.stageText : colors.stageCard) }]}>
        <Ionicons name={icon} size={size * 0.42} color={!bg && active ? colors.stage : '#fff'} />
      </PressableScale>
      <Text variant="small" color={colors.stageMuted}>{label}</Text>
    </View>
  );
}

/** Soft rings spreading out behind the avatar while it rings. */
function Pulse({ on }: { on: boolean }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(on ? withRepeat(withTiming(1, { duration: 1600 }), -1, false) : 0);
  }, [on, p]);
  const s = useAnimatedStyle(() => ({ opacity: on ? 0.5 * (1 - p.value) : 0, transform: [{ scale: 1 + p.value * 0.7 }] }));
  return <Animated.View style={[styles.pulse, s]} pointerEvents="none" />;
}

function useTick(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

type Controls = { muted: boolean; toggleMute: () => void; speaker: boolean; toggleSpeaker: () => void };

function ControlRow({ controls, onHangUp }: { controls: Controls | null; onHangUp: () => void }) {
  return (
    <View style={styles.controls}>
      {controls && <RoundButton icon={controls.muted ? 'mic-off' : 'mic'} label={controls.muted ? 'Unmute' : 'Mute'} active={controls.muted} onPress={controls.toggleMute} />}
      <RoundButton icon="call" label={controls ? 'Hang up' : 'Cancel'} bg={colors.danger} size={72} onPress={onHangUp} />
      {controls && <RoundButton icon={controls.speaker ? 'volume-high' : 'volume-medium-outline'} label="Speaker" active={controls.speaker} onPress={controls.toggleSpeaker} />}
    </View>
  );
}

/** Speaker on/off: iOS forces the loudspeaker or goes back to its default route; Android picks the output. */
async function routeAudio(speaker: boolean) {
  const output = Platform.OS === 'ios' ? (speaker ? 'force_speaker' : 'default') : speaker ? 'speaker' : 'earpiece';
  await AudioSession.selectAudioOutput(output).catch(() => {});
}

/** Inside <LiveKitRoom>: the phone-call audio setup, mute, speaker, and noticing the other side leave. */
function LiveCallMedia({ onHangUp, onPeerLeft }: { onHangUp: () => void; onPeerLeft: () => void }) {
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const remotes = useRemoteParticipants();
  const [speaker, setSpeaker] = useState(false);
  const hadPeer = useRef(false);
  const peerLeft = useRef(onPeerLeft);
  useEffect(() => {
    peerLeft.current = onPeerLeft;
  });

  // They closed the app or lost the connection without hanging up: end it here too (once).
  useEffect(() => {
    if (remotes.length > 0) hadPeer.current = true;
    else if (hadPeer.current) {
      hadPeer.current = false;
      peerLeft.current();
    }
  }, [remotes.length]);

  return (
    <ControlRow
      onHangUp={onHangUp}
      controls={{
        muted: !isMicrophoneEnabled,
        toggleMute: () => void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled),
        speaker,
        toggleSpeaker: () => { const next = !speaker; setSpeaker(next); void routeAudio(next); },
      }}
    />
  );
}

/** Mock mode: the same controls, nothing behind them. */
function DemoCallMedia({ onHangUp }: { onHangUp: () => void }) {
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  return (
    <ControlRow onHangUp={onHangUp}
      controls={{ muted, toggleMute: () => setMuted((m) => !m), speaker, toggleSpeaker: () => setSpeaker((s) => !s) }} />
  );
}

/** Phone-call audio while connected: earpiece first (like a phone call), put back for classes afterwards. */
function useCallAudioSession(active: boolean) {
  useEffect(() => {
    if (!active || config.useMock) return;
    let started = false;
    (async () => {
      await AudioSession.configureAudio({
        android: { preferredOutputList: ['bluetooth', 'headset', 'earpiece', 'speaker'], audioTypeOptions: AndroidAudioTypePresets.communication },
        ios: { defaultOutput: 'earpiece' },
      });
      await AudioSession.startAudioSession();
      started = true;
    })().catch(() => {});
    return () => {
      (async () => {
        if (started) await AudioSession.stopAudioSession();
        // Classes want the loudspeaker by default.
        await AudioSession.configureAudio({
          android: { preferredOutputList: ['bluetooth', 'headset', 'speaker', 'earpiece'], audioTypeOptions: AndroidAudioTypePresets.communication },
          ios: { defaultOutput: 'speaker' },
        });
      })().catch(() => {});
    };
  }, [active]);
}

export default function CallScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [call, setCall] = useState<Call | null>(null);
  const [creds, setCreds] = useState<JoinCredentials | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const over = !!call && callIsOver(call);
  const connected = call?.status === 'accepted';
  const ringingForMe = call?.status === 'ringing' && !call.outgoing;
  const now = useTick(connected);
  useCallAudioSession(connected);

  // Follow the call: answered, declined, hung up on the other side.
  useEffect(() => {
    let alive = true;
    const load = () => api.getCall(id).then((c) => alive && setCall(c)).catch((e) => alive && setError(e instanceof Error ? e.message : 'Call not found'));
    void load();
    const t = setInterval(load, CALL_POLL_MS);
    return () => { alive = false; clearInterval(t); };
  }, [id]);

  // Join the call's room once it's answered.
  useEffect(() => {
    if (!connected || creds || config.useMock) return;
    api.getCallCredentials(id).then(setCreds).catch((e) => setError(e instanceof Error ? e.message : 'Could not connect the call'));
  }, [connected, creds, id]);

  // Buzz while it rings for you.
  useEffect(() => {
    if (!ringingForMe) return;
    Vibration.vibrate([0, 900, 1100], true);
    return () => Vibration.cancel();
  }, [ringingForMe]);

  // The ended screen closes by itself.
  useEffect(() => {
    if (!over && !error) return;
    const t = setTimeout(() => { if (router.canGoBack()) router.back(); else router.replace('/contacts'); }, error ? 3000 : CLOSE_AFTER_MS);
    return () => clearTimeout(t);
  }, [over, error]);

  async function act(run: () => Promise<Call>) {
    if (busy) return;
    setBusy(true);
    try {
      setCall(await run());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }
  const hangUp = () => act(() => api.endCall(id));

  const other = call ? otherParty(call) : null;
  const status = error
    ? error
    : !call
      ? 'Connecting…'
      : over
        ? endedLabel(call)
        : connected
          ? (config.useMock || creds ? formatCallLength(callSeconds(call, now)) : 'Connecting…')
          : call.outgoing ? 'Calling…' : 'Incoming audio call';

  const body = (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <Animated.View entering={FadeInUp.duration(400)} style={styles.top}>
        <View style={styles.badge}>
          <Ionicons name="lock-closed" size={11} color={colors.stageMuted} />
          <Text variant="small" color={colors.stageMuted}>Halaqa audio call</Text>
        </View>
      </Animated.View>

      <View style={styles.center}>
        <View style={styles.avatarWrap}>
          <Pulse on={call?.status === 'ringing'} />
          {other && <Avatar name={other.name} size={128} uri={other.avatarUrl} />}
        </View>
        <Text variant="title" color={colors.stageText} style={{ textAlign: 'center' }}>{other?.name ?? ' '}</Text>
        <Animated.View key={status} entering={FadeIn}>
          <Text color={over || error ? colors.stageMuted : connected ? colors.success : colors.stageMuted} style={{ textAlign: 'center' }}>{status}</Text>
        </Animated.View>
      </View>

      <View style={styles.bottom}>
        {over || error || !call ? null : ringingForMe ? (
          <View style={styles.controls}>
            <RoundButton icon="close" label="Decline" bg={colors.danger} size={72} onPress={() => act(() => api.declineCall(id))} />
            <RoundButton icon="call" label="Accept" bg={colors.success} size={72} onPress={() => act(() => api.acceptCall(id))} />
          </View>
        ) : connected && config.useMock ? (
          <DemoCallMedia onHangUp={hangUp} />
        ) : connected && creds ? (
          <LiveCallMedia onHangUp={hangUp} onPeerLeft={hangUp} />
        ) : (
          <ControlRow controls={null} onHangUp={hangUp} />
        )}
      </View>
    </SafeAreaView>
  );

  if (connected && creds && !over && !config.useMock) {
    return (
      <LiveKitRoom serverUrl={creds.serverUrl} token={creds.token} connect audio video={false}
        onError={(e) => setError(e.message)}>
        {body}
      </LiveKitRoom>
    );
  }
  return body;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.stage, paddingHorizontal: 24 },
  top: { alignItems: 'center', paddingTop: 16 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.stageCard, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  avatarWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  pulse: { position: 'absolute', width: 128, height: 128, borderRadius: 64, backgroundColor: colors.success },
  bottom: { minHeight: 150, justifyContent: 'center', paddingBottom: 24 },
  controls: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-evenly' },
  round: { alignItems: 'center', justifyContent: 'center' },
});
