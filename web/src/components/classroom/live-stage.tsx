import {
  isTrackReference, RoomAudioRenderer, StartAudio, useConnectionState, useLocalParticipant, useRoomContext,
  useSpeakingParticipants, useTracks, VideoTrack,
} from '@livekit/components-react';
import { ConnectionState as LkState, Room as LkRoom, RoomEvent, Track, type Participant, type TrackPublication } from 'livekit-client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { CHAT_TOPIC, decodeChat, encodeChat, type ChatTransport } from '@/lib/chat';
import { alert } from '@/lib/dialog';
import { decodeReaction, encodeReaction, REACTION_TOPIC, reactionId, type ReactionTransport } from '@/lib/reactions';
import { decodeScreen, encodeScreen, SCREEN_TOPIC, type ScreenSignal } from '@/lib/screen-share';
import type { Room } from '@/lib/types';
import { decodeWb, encodeWb, WB_TOPIC, type WbMessage, type WbTransport } from '@/lib/whiteboard';
import { colors, radius } from '@/theme';
import type { TileInfo } from './participant-tile';
import { Stage, type ConnectionState } from './stage';
import type { ScreenCapture } from './use-screen-share';

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

const fill: React.CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%' };

/** Whether this computer has more than one camera to switch between. */
function useCameraCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const read = () => LkRoom.getLocalDevices('videoinput', false).then((d) => setCount(d.length)).catch(() => {});
    void read();
    navigator.mediaDevices?.addEventListener('devicechange', read);
    return () => navigator.mediaDevices?.removeEventListener('devicechange', read);
  }, []);
  return count;
}

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
  const cameras = useCameraCount();

  const [recording, setRecording] = useState(lk.isRecording);
  const [recordingBusy, setRecordingBusy] = useState(false);

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

  /** One transport per topic on the reliable data channel (reactions use the lossy one). */
  function topic<T>(name: string, encode: (m: T) => Uint8Array<ArrayBuffer>, reliable = true) {
    return (m: T) => { localParticipant.publishData(encode(m), { reliable, topic: name }).catch(() => {}); };
  }
  function listen(name: string, handler: (payload: Uint8Array, p?: Participant) => void) {
    const onData = (payload: Uint8Array, p?: Participant, _k?: unknown, t?: string) => { if (t === name) handler(payload, p); };
    lk.on(RoomEvent.DataReceived, onData);
    return () => { lk.off(RoomEvent.DataReceived, onData); };
  }

  // Whiteboard rides on the reliable data channel.
  const transport = useMemo<WbTransport>(() => ({
    send: topic<WbMessage>(WB_TOPIC, encodeWb),
    subscribe: (handler) => listen(WB_TOPIC, (payload) => { const m = decodeWb(payload); if (m) handler(m); }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [lk, localParticipant]);

  // The author is taken from the participant LiveKit says sent it, so nobody can post under someone else's name.
  const chat = useMemo<ChatTransport>(() => ({
    send: topic(CHAT_TOPIC, encodeChat),
    subscribe: (handler) => listen(CHAT_TOPIC, (payload, p) => {
      const msg = p && decodeChat(payload);
      if (msg) handler({ ...msg, authorId: p.identity, author: p.name || p.identity, teacher: roleOf(p) === 'teacher', mine: false });
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [lk, localParticipant]);

  const reactions = useMemo<ReactionTransport>(() => ({
    send: topic(REACTION_TOPIC, encodeReaction, false),
    subscribe: (handler) => listen(REACTION_TOPIC, (payload, p) => {
      const emoji = p && decodeReaction(payload);
      if (emoji) handler({ id: reactionId(), emoji, author: p.name || p.identity, mine: false });
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [lk, localParticipant]);

  const screenSignal = useMemo<ScreenSignal>(() => ({
    send: topic(SCREEN_TOPIC, encodeScreen),
    subscribe: (handler) => listen(SCREEN_TOPIC, (payload, p) => {
      const msg = p && decodeScreen(payload);
      if (msg) handler(msg, { id: p.identity, name: p.name || p.identity, teacher: roleOf(p) === 'teacher' });
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [lk, localParticipant]);

  // Show the teacher's screen when several people share, otherwise whoever is sharing.
  const shown = screenTracks.find((t) => isTrackReference(t) && roleOf(t.participant) === 'teacher')
    ?? screenTracks.find((t) => isTrackReference(t));
  const screen: ScreenCapture = {
    supported: !!navigator.mediaDevices?.getDisplayMedia,
    sharing: isScreenShareEnabled,
    start: async () => { await localParticipant.setScreenShareEnabled(true, { audio: true, selfBrowserSurface: 'exclude' }); },
    stop: async () => { await localParticipant.setScreenShareEnabled(false); },
    active: shown && isTrackReference(shown) ? {
      ownerId: shown.participant.identity,
      name: shown.participant.name || shown.participant.identity,
      isLocal: shown.participant.isLocal,
      video: shown.participant.isLocal ? undefined : <VideoTrack trackRef={shown} style={{ ...fill, objectFit: 'contain' }} />,
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
      video: hasVideo
        ? <VideoTrack trackRef={t} style={{ ...fill, objectFit: 'cover', transform: p.isLocal ? 'scaleX(-1)' : undefined }} />
        : undefined,
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
      alert(recording ? 'Couldn’t stop recording' : 'Couldn’t start recording', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setRecordingBusy(false);
    }
  }

  /** Switches to the next camera. */
  async function flip() {
    const devices = await LkRoom.getLocalDevices('videoinput');
    if (devices.length < 2) return;
    const active = lk.getActiveDevice('videoinput');
    const i = devices.findIndex((d) => d.deviceId === active);
    await lk.switchActiveDevice('videoinput', devices[(i + 1) % devices.length]!.deviceId).catch(() => {});
  }

  async function toggleDevice(kind: 'mic' | 'cam') {
    try {
      if (kind === 'mic') {
        ownMicPressAt.current = Date.now();
        if (!isMicrophoneEnabled) setNotice(null);
        await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
      } else {
        await localParticipant.setCameraEnabled(!isCameraEnabled);
      }
    } catch (e) {
      alert(kind === 'mic' ? 'Couldn’t turn on the microphone' : 'Couldn’t turn on the camera',
        e instanceof Error && e.name === 'NotAllowedError'
          ? 'Allow access in your browser’s site settings, then try again.'
          : e instanceof Error ? e.message : 'Please try again.');
    }
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
      canFlip={cameras > 1}
      onMic={() => void toggleDevice('mic')}
      onCam={() => void toggleDevice('cam')}
      onFlip={() => void flip()}
      onRecord={toggleRecording}
      onMute={(identity) => api.muteStudent(room.id, identity)}
      onMuteAll={() => api.muteAllStudents(room.id)}
      notice={notice}
      onLeave={onLeave}
    >
      {/* Plays everyone's audio; browsers need one click before sound can start. */}
      <RoomAudioRenderer />
      <StartAudio
        label="Click to turn on class audio"
        style={{
          position: 'absolute', top: 72, left: '50%', transform: 'translateX(-50%)', zIndex: 10, border: 0, cursor: 'pointer',
          backgroundColor: colors.primary, color: '#fff', padding: '10px 18px', borderRadius: radius.pill, fontWeight: 600,
        }}
      />
    </Stage>
  );
}
