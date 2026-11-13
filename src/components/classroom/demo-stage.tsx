import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { demoChatTransport } from '@/lib/chat';
import { demoReactionTransport } from '@/lib/reactions';
import { noopInkTransport } from '@/lib/screen-ink';
import { DEMO_ME, demoScreenSignal } from '@/lib/screen-share';
import type { Room } from '@/lib/types';
import { noopTransport } from '@/lib/whiteboard';
import { useSession } from '@/store/session';
import type { TileInfo } from './participant-tile';
import type { ScreenCapture } from './use-screen-share';
import { Stage } from './stage';

const CLASSMATES = ['Yasmine B.', 'Karim H.', 'Lina M.'];

/**
 * Mock-mode classroom: no media server, fake classmates who "talk" now and then.
 * Lets you try the full classroom UI (board, recording, controls) in seconds.
 */
export function DemoStage({ room, isTeacher, onLeave }: { room: Room; isTeacher: boolean; onLeave: (endForAll: boolean) => void }) {
  const user = useSession((s) => s.user)!;
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(false);
  const [recording, setRecording] = useState(room.isRecording);
  const [busy, setBusy] = useState(false);
  const [speaker, setSpeaker] = useState<number>(-1);
  const chat = useMemo(() => demoChatTransport(room.teacher.name, isTeacher), [room.teacher.name, isTeacher]);
  const reactions = useMemo(() => demoReactionTransport(isTeacher), [isTeacher]);
  const [sharing, setSharing] = useState(false);
  const [studentShare, setStudentShare] = useState<string | null>(null);
  const screenSignal = useMemo(() => demoScreenSignal(isTeacher, room.teacher.name, setStudentShare), [isTeacher, room.teacher.name]);
  const screen: ScreenCapture = {
    supported: true,
    sharing,
    start: async () => setSharing(true),
    stop: async () => setSharing(false),
    active: sharing
      ? { ownerId: DEMO_ME, name: user.name, isLocal: true }
      : studentShare ? { ownerId: 'karim', name: studentShare, isLocal: false } : null,
  };
  const [connection, setConnection] = useState<'connecting' | 'connected'>('connecting');
  const [muted, setMuted] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const c = setTimeout(() => setConnection('connected'), 900);
    const t = setInterval(() => setSpeaker(Math.floor(Math.random() * (CLASSMATES.length + 2)) - 1), 2200);
    return () => { clearTimeout(c); clearInterval(t); };
  }, []);

  const others = isTeacher ? CLASSMATES : [room.teacher.name, ...CLASSMATES.slice(0, 2)];
  const tiles: TileInfo[] = [
    { key: 'me', name: user.name, avatarUrl: user.avatarUrl, isLocal: true, isTeacher, speaking: mic && speaker === -1, micOn: mic },
    ...others.map((name, i) => ({
      key: name, name, isLocal: false, isTeacher: !isTeacher && i === 0,
      speaking: speaker === i && !muted.has(name), micOn: i !== 2 && !muted.has(name),
    })),
  ];
  tiles.sort((a, b) => Number(b.isTeacher) - Number(a.isTeacher));

  return (
    <Stage
      room={room}
      isTeacher={isTeacher}
      tiles={tiles}
      connection={connection}
      mic={mic}
      cam={cam}
      recording={recording}
      recordingBusy={busy}
      transport={noopTransport}
      chat={chat}
      reactions={reactions}
      screen={screen}
      screenSignal={screenSignal}
      ink={noopInkTransport}
      myId={DEMO_ME}
      me={{ name: user.name }}
      onMic={() => setMic((m) => !m)}
      onCam={() => setCam((c) => !c)}
      onFlip={() => {}}
      onRecord={async () => {
        setBusy(true);
        const r = recording ? await api.stopRecording(room.id) : await api.startRecording(room.id);
        setRecording(r.isRecording);
        setBusy(false);
      }}
      onMute={async (key) => {
        await api.muteStudent(room.id, key);
        setMuted((s) => new Set(s).add(key));
      }}
      onMuteAll={async () => {
        await api.muteAllStudents(room.id);
        setMuted(new Set(others));
      }}
      onLeave={onLeave}
    />
  );
}
