import {
  AudioSession, isTrackReference, useConnectionState, useLocalParticipant, useRoomContext,
  useSpeakingParticipants, useTracks, VideoTrack,
} from '@livekit/react-native';
import {
  ConnectionState as LkState, RoomEvent, Track, type LocalVideoTrack, type Participant, type TrackPublication,
} from 'livekit-client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, StyleSheet } from 'react-native';
import { api } from '@/lib/api';
import { CHAT_TOPIC, decodeChat, encodeChat, type ChatTransport } from '@/lib/chat';
import { decodeReaction, encodeReaction, REACTION_TOPIC, reactionId, type ReactionTransport } from '@/lib/reactions';
import { decodeScreen, encodeScreen, SCREEN_TOPIC, type ScreenSignal } from '@/lib/screen-share';
import type { Room } from '@/lib/types';
import { decodeWb, encodeWb, WB_TOPIC, type WbMessage, type WbTransport } from '@/lib/whiteboard';
import type { TileInfo } from './participant-tile';
import type { ScreenCapture } from './use-screen-share';
import { Stage, type ConnectionState } from './stage';

/** Set by the backend when it issues the LiveKit token. */
const metadataOf = (p: Participant): { role?: string; avatarUrl?: string } => {
  try {
    return JSON.parse(p.metadata || '{}');
  } catch {
    return {};
  }
};
const roleOf = (p: Participant) => metadataOf(p).role;

const mapState = (s: LkState): ConnectionState =>
  s === LkState.Connected ? 'connected'
    : s === LkState.Reconnecting || s === LkState.SignalReconnecting ? 'reconnecting'
      : s === LkState.Disconnected ? 'disconnected' : 'connecting';

/**
 * The real classroom: must be rendered inside <LiveKitRoom>.
 * Converts LiveKit state into the presentational <Stage>.
 */
export function LiveStage({ room, isTeacher, onLeave }: { room: Room; isTeacher: boolean; onLeave: (endForAll: boolean) => void }) {
  const lk = useRoomContext();
  const connection = useConnectionState();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } = useLocalParticipant();
  const speakers = useSpeakingParticipants();
  const cameraTracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }], { onlySubscribed: false });
  const screenTracks = useTracks([{ source: Track.Source.ScreenShare, withPlaceholder: false }], { onlySubscribed: false });

  const [recording, setRecording] = useState(lk.isRecording);
  const [recordingBusy, setRecordingBusy] = useState(false);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');

  // Keep the audio session alive for the whole class (speakerphone, Bluetooth, etc.).
  useEffect(() => {
    AudioSession.startAudioSession();
    return () => { AudioSession.stopAudioSession(); };
  }, []);

  // LiveKit tells every participant when server-side recording (Egress) starts/stops.
  useEffect(() => {
    const onRec = (r: boolean) => setRecording(r);
    lk.on(RoomEvent.RecordingStatusChanged, onRec);
    return () => { lk.off(RoomEvent.RecordingStatusChanged, onRec); };
  }, [lk]);

  // When the teacher mutes you, LiveKit turns your mic off; say so, since you didn't.
  const [notice, setNotice] = useState<string | null>(null);
  const ownMicPressAt = useRef(0);
  useEffect(() => {
    let hide: ReturnType<typeof setTimeout> | undefined;
    const onMuted = (pub: TrackPublication, p: Participant) => {
      if (!p.isLocal || pub.source !== Track.Source.Microphone) return;
      // Your own mic button fires this too.
      if (Date.now() - ownMicPressAt.current < 2000) return;
      setNotice('The teacher muted your microphone');
      clearTimeout(hide);
      hide = setTimeout(() => setNotice(null), 5000);
    };
    lk.on(RoomEvent.TrackMuted, onMuted);
    return () => { clearTimeout(hide); lk.off(RoomEvent.TrackMuted, onMuted); };
  }, [lk]);

  // Whiteboard rides on the reliable data channel.
  const transport = useMemo<WbTransport>(() => ({
    send: (msg: WbMessage) => {
      localParticipant.publishData(encodeWb(msg), { reliable: true, topic: WB_TOPIC }).catch(() => {});
    },
    subscribe: (handler) => {
      const onData = (payload: Uint8Array, _p?: unknown, _k?: unknown, topic?: string) => {
        if (topic !== WB_TOPIC) return;
        const msg = decodeWb(payload);
        if (msg) handler(msg);
      };
      lk.on(RoomEvent.DataReceived, onData);
      return () => { lk.off(RoomEvent.DataReceived, onData); };
    },
  }), [lk, localParticipant]);

  // Chat uses the same channel on its own topic. The author is taken from the
  // participant LiveKit says sent it, so nobody can post under someone else's name.
  const chat = useMemo<ChatTransport>(() => ({
    send: (msg) => {
      localParticipant.publishData(encodeChat(msg), { reliable: true, topic: CHAT_TOPIC }).catch(() => {});
    },
    subscribe: (handler) => {
      const onData = (payload: Uint8Array, p?: Participant, _k?: unknown, topic?: string) => {
        if (topic !== CHAT_TOPIC || !p) return;
        const msg = decodeChat(payload);
        if (msg) handler({ ...msg, authorId: p.identity, author: p.name || p.identity, teacher: roleOf(p) === 'teacher', mine: false });
      };
      lk.on(RoomEvent.DataReceived, onData);
      return () => { lk.off(RoomEvent.DataReceived, onData); };
    },
  }), [lk, localParticipant]);

  const reactions = useMemo<ReactionTransport>(() => ({
    send: (emoji) => {
      localParticipant.publishData(encodeReaction(emoji), { reliable: false, topic: REACTION_TOPIC }).catch(() => {});
    },
    subscribe: (handler) => {
      const onData = (payload: Uint8Array, p?: Participant, _k?: unknown, topic?: string) => {
        if (topic !== REACTION_TOPIC || !p) return;
        const emoji = decodeReaction(payload);
        if (emoji) handler({ id: reactionId(), emoji, author: p.name || p.identity, mine: false });
      };
      lk.on(RoomEvent.DataReceived, onData);
      return () => { lk.off(RoomEvent.DataReceived, onData); };
    },
  }), [lk, localParticipant]);

  const screenSignal = useMemo<ScreenSignal>(() => ({
    send: (msg) => {
      localParticipant.publishData(encodeScreen(msg), { reliable: true, topic: SCREEN_TOPIC }).catch(() => {});
    },
    subscribe: (handler) => {
      const onData = (payload: Uint8Array, p?: Participant, _k?: unknown, topic?: string) => {
        if (topic !== SCREEN_TOPIC || !p) return;
        const msg = decodeScreen(payload);
        if (msg) handler(msg, { id: p.identity, name: p.name || p.identity, teacher: roleOf(p) === 'teacher' });
      };
      lk.on(RoomEvent.DataReceived, onData);
      return () => { lk.off(RoomEvent.DataReceived, onData); };
    },
  }), [lk, localParticipant]);

  // Show the teacher's screen when several people share, otherwise whoever is sharing.
  const shown = screenTracks.find((t) => isTrackReference(t) && roleOf(t.participant) === 'teacher')
    ?? screenTracks.find((t) => isTrackReference(t));
  const screen: ScreenCapture = {
    // iOS needs a Broadcast Upload Extension, which this app doesn't ship yet.
    supported: Platform.OS === 'android',
    sharing: isScreenShareEnabled,
    start: async () => { await localParticipant.setScreenShareEnabled(true); },
    stop: async () => { await localParticipant.setScreenShareEnabled(false); },
    active: shown && isTrackReference(shown) ? {
      ownerId: shown.participant.identity,
      name: shown.participant.name || shown.participant.identity,
      isLocal: shown.participant.isLocal,
      video: shown.participant.isLocal ? undefined : <VideoTrack trackRef={shown} style={StyleSheet.absoluteFill} objectFit="contain" />,
    } : null,
  };

  const speakingIds = new Set(speakers.map((p) => p.identity));
  const tiles: TileInfo[] = cameraTracks.map((t) => {
    const p = t.participant;
    const hasVideo = isTrackReference(t) && !t.publication.isMuted;
    return {
      key: p.identity,
      name: p.name || p.identity,
      avatarUrl: metadataOf(p).avatarUrl ?? null,
      isLocal: p.isLocal,
      isTeacher: p.isLocal ? isTeacher : roleOf(p) === 'teacher',
      speaking: speakingIds.has(p.identity),
      micOn: p.isMicrophoneEnabled,
      video: hasVideo ? <VideoTrack trackRef={t} style={StyleSheet.absoluteFill} objectFit="cover" mirror={p.isLocal && facing === 'user'} /> : undefined,
    };
  });
  // Teacher first, then you, then everyone else.
  tiles.sort((a, b) => Number(b.isTeacher) - Number(a.isTeacher) || Number(b.isLocal) - Number(a.isLocal));

  async function toggleRecording() {
    setRecordingBusy(true);
    try {
      if (recording) await api.stopRecording(room.id);
      else await api.startRecording(room.id);
      // The RecordingStatusChanged event confirms the change for everyone.
    } catch (e) {
      Alert.alert(recording ? 'Couldn’t stop recording' : 'Couldn’t start recording', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setRecordingBusy(false);
    }
  }

  async function flip() {
    const pub = localParticipant.getTrackPublication(Track.Source.Camera);
    const track = pub?.videoTrack as LocalVideoTrack | undefined;
    if (!track) return;
    const next = facing === 'user' ? 'environment' : 'user';
    await track.restartTrack({ facingMode: next });
    setFacing(next);
  }

  return (
    <Stage
      room={room}
      isTeacher={isTeacher}
      tiles={tiles}
      connection={mapState(connection)}
      mic={isMicrophoneEnabled}
      cam={isCameraEnabled}
      recording={recording}
      recordingBusy={recordingBusy}
      transport={transport}
      chat={chat}
      reactions={reactions}
      screen={screen}
      screenSignal={screenSignal}
      myId={localParticipant.identity}
      me={{ name: localParticipant.name || 'You' }}
      onMic={() => {
        ownMicPressAt.current = Date.now();
        if (!isMicrophoneEnabled) setNotice(null);
        return localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
      }}
      onCam={() => localParticipant.setCameraEnabled(!isCameraEnabled)}
      onFlip={flip}
      onRecord={toggleRecording}
      onMute={(identity) => api.muteStudent(room.id, identity)}
      onMuteAll={() => api.muteAllStudents(room.id)}
      notice={notice}
      onLeave={onLeave}
    />
  );
}
