import { LiveKitRoom, RoomAudioRenderer, useLocalParticipant, useRemoteParticipants } from '@livekit/components-react';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { Icon, type IconName } from '@/components/ui/icon';
import { Avatar } from '@/components/ui/misc';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { CALL_POLL_MS, callIsOver, callSeconds, endedLabel, formatCallLength, otherParty } from '@/lib/calls';
import { config } from '@/lib/config';
import { useBack } from '@/lib/navigation';
import type { Call, JoinCredentials } from '@/lib/types';
import { colors } from '@/theme';

/** How long the "Call ended" page stays before closing by itself. */
const CLOSE_AFTER_MS = 1800;

function RoundButton({ icon, label, onPress, bg, active, size = 64 }: {
  icon: IconName; label: string; onPress: () => void; bg?: string; active?: boolean; size?: number;
}) {
  return (
    <div className="v" style={{ alignItems: 'center', gap: 8 }}>
      <Pressable hover={false} scaleTo={0.9} onClick={onPress} aria-label={label} aria-pressed={active} style={{
        width: size, height: size, borderRadius: size / 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: bg ?? (active ? colors.stageText : colors.stageCard),
      }}>
        <Icon name={icon} size={size * 0.42} color={!bg && active ? colors.stage : '#fff'} />
      </Pressable>
      <Text variant="small" color={colors.stageMuted}>{label}</Text>
    </div>
  );
}

function HangUp({ onPress, label = 'Hang up' }: { onPress: () => void; label?: string }) {
  return <RoundButton icon="call" label={label} bg={colors.danger} size={72} onPress={onPress} />;
}

const row = { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-evenly', width: '100%', maxWidth: 360 } as const;

/** Inside <LiveKitRoom>: mute, and noticing the other side leave. */
function LiveCallMedia({ onHangUp, onPeerLeft }: { onHangUp: () => void; onPeerLeft: () => void }) {
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const remotes = useRemoteParticipants();
  const hadPeer = useRef(false);
  const peerLeft = useRef(onPeerLeft);
  useEffect(() => {
    peerLeft.current = onPeerLeft;
  });

  // They closed the page or lost the connection without hanging up: end it here too (once).
  useEffect(() => {
    if (remotes.length > 0) hadPeer.current = true;
    else if (hadPeer.current) {
      hadPeer.current = false;
      peerLeft.current();
    }
  }, [remotes.length]);

  return (
    <div style={row}>
      <RoundButton icon={isMicrophoneEnabled ? 'mic' : 'mic-off'} label={isMicrophoneEnabled ? 'Mute' : 'Unmute'} active={!isMicrophoneEnabled}
        onPress={() => void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)} />
      <HangUp onPress={onHangUp} />
    </div>
  );
}

/** Mock mode: the same controls, nothing behind them. */
function DemoCallMedia({ onHangUp }: { onHangUp: () => void }) {
  const [muted, setMuted] = useState(false);
  return (
    <div style={row}>
      <RoundButton icon={muted ? 'mic-off' : 'mic'} label={muted ? 'Unmute' : 'Mute'} active={muted} onPress={() => setMuted((m) => !m)} />
      <HangUp onPress={onHangUp} />
    </div>
  );
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

export default function CallPage() {
  const { id = '' } = useParams();
  const back = useBack('/contacts');
  const [call, setCall] = useState<Call | null>(null);
  const [creds, setCreds] = useState<JoinCredentials | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const over = !!call && callIsOver(call);
  const connected = call?.status === 'accepted';
  const ringingForMe = call?.status === 'ringing' && !call.outgoing;
  const now = useTick(connected);

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

  // While it rings for you: buzz (phones) and flag the browser tab.
  useEffect(() => {
    if (!ringingForMe) return;
    const title = document.title;
    let flip = false;
    const t = setInterval(() => {
      flip = !flip;
      document.title = flip ? `Incoming call · ${call?.caller.name}` : title;
      navigator.vibrate?.([700, 500]);
    }, 1200);
    return () => { clearInterval(t); document.title = title; navigator.vibrate?.(0); };
  }, [ringingForMe, call?.caller.name]);

  // The ended page closes by itself.
  useEffect(() => {
    if (!over && !error) return;
    const t = setTimeout(back, error ? 3000 : CLOSE_AFTER_MS);
    return () => clearTimeout(t);
  }, [over, error, back]);

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
  const live = connected && !!creds && !over && !config.useMock;

  const page = (
    <div className="v" style={{ position: 'fixed', inset: 0, backgroundColor: colors.stage, padding: '24px 24px max(env(safe-area-inset-bottom), 32px)', alignItems: 'center' }}>
      <span className="h a-up" style={{ gap: 6, backgroundColor: colors.stageCard, padding: '6px 12px', borderRadius: 999 }}>
        <Icon name="lock-closed" size={11} color={colors.stageMuted} />
        <Text variant="small" color={colors.stageMuted}>Halaqa audio call</Text>
      </span>

      <div className="v flex1 center" style={{ gap: 14 }}>
        <span className={`call-avatar${call?.status === 'ringing' ? ' ringing' : ''}`}>
          {other && <Avatar name={other.name} size={128} uri={other.avatarUrl} />}
        </span>
        <Text variant="title" color={colors.stageText} style={{ textAlign: 'center' }}>{other?.name ?? ' '}</Text>
        <span key={status} className="a-fade" role="status">
          <Text color={connected && !over && !error ? colors.success : colors.stageMuted} style={{ textAlign: 'center' }}>{status}</Text>
        </span>
      </div>

      <div className="v center" style={{ minHeight: 150, width: '100%' }}>
        {over || error || !call ? null : ringingForMe ? (
          <div style={row}>
            <RoundButton icon="close" label="Decline" bg={colors.danger} size={72} onPress={() => act(() => api.declineCall(id))} />
            <RoundButton icon="call" label="Accept" bg={colors.success} size={72} onPress={() => act(() => api.acceptCall(id))} />
          </div>
        ) : connected && config.useMock ? (
          <DemoCallMedia onHangUp={hangUp} />
        ) : live ? (
          <LiveCallMedia onHangUp={hangUp} onPeerLeft={hangUp} />
        ) : (
          <div style={row}><HangUp onPress={hangUp} label="Cancel" /></div>
        )}
      </div>
    </div>
  );

  if (live) {
    return (
      <LiveKitRoom serverUrl={creds!.serverUrl} token={creds!.token} connect audio video={false} onError={(e) => setError(e.message)}>
        <RoomAudioRenderer />
        {page}
      </LiveKitRoom>
    );
  }
  return page;
}
