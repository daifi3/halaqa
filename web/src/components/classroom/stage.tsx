import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon, type IconName } from '@/components/ui/icon';
import { PulseDot } from '@/components/ui/misc';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { chatId, type ChatMessage, type ChatTransport } from '@/lib/chat';
import { alert } from '@/lib/dialog';
import { formatClock } from '@/lib/format';
import { reactionId, type Reaction, type ReactionEmoji, type ReactionTransport } from '@/lib/reactions';
import type { ScreenSignal } from '@/lib/screen-share';
import type { Room } from '@/lib/types';
import type { WbTransport } from '@/lib/whiteboard';
import { useSession } from '@/store/session';
import { colors, radius } from '@/theme';
import { ChatPanel } from './chat-panel';
import { ControlBar } from './control-bar';
import { ParticipantTile, type TileInfo } from './participant-tile';
import { FLOAT_MS, FloatingReactions, ReactionPicker } from './reactions';
import { RequestCard, ScreenView, StudentShareBanner, TeacherSharePanel } from './screen-share';
import { useScreenShare, type ScreenCapture } from './use-screen-share';
import { Whiteboard } from './whiteboard';

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export interface StageProps {
  room: Room;
  isTeacher: boolean;
  tiles: TileInfo[];
  connection: ConnectionState;
  mic: boolean;
  cam: boolean;
  recording: boolean;
  recordingBusy?: boolean;
  transport: WbTransport;
  chat: ChatTransport;
  reactions: ReactionTransport;
  screen: ScreenCapture;
  screenSignal: ScreenSignal;
  /** Your LiveKit identity — how the teacher addresses you in screen-share answers. */
  myId: string;
  /** Shown on your own messages to everyone else. */
  me: { name: string };
  /** More than one camera to switch between. */
  canFlip: boolean;
  onMic: () => void;
  onCam: () => void;
  onFlip: () => void;
  onRecord: () => void;
  /** Teacher only: turns off one student's microphone, by tile key. */
  onMute: (key: string) => Promise<void>;
  /** Teacher only: turns off every student's microphone. */
  onMuteAll: () => Promise<void>;
  /** A short message for you, e.g. that the teacher muted you. */
  notice?: string | null;
  /** endForAll is true when the teacher chooses to close the class. */
  onLeave: (endForAll: boolean) => void;
  /** Extra elements the live stage needs on the page (e.g. the audio renderer). */
  children?: ReactNode;
}

/** Side of a participant square under the board. */
const SQUARE = 76;

/** Given a tile, the teacher's mute action for it — or nothing. */
type MuteFor = (tile: TileInfo) => (() => void) | undefined;

function useWide() {
  const query = '(min-width: 900px)';
  const [wide, setWide] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setWide(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return wide;
}

function useElapsed() {
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(start);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return Math.floor((now - start) / 1000);
}

function RecBadge() {
  return (
    <span className="h a-zoom" style={{ gap: 6, backgroundColor: colors.danger, padding: '6px 12px', borderRadius: radius.pill }}>
      <PulseDot color="#fff" size={7} />
      <Text variant="label" color="#fff">REC</Text>
    </span>
  );
}

/** Live chat over LiveKit, plus the saved history so late joiners see what was said. */
function useChat(chat: ChatTransport, me: { name: string }, isTeacher: boolean, roomId: string) {
  const myUserId = useSession((s) => s.user?.id);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [preview, setPreview] = useState<ChatMessage | null>(null);
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    let hide: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = chat.subscribe((msg) => {
      setMessages((list) => (list.some((m) => m.id === msg.id) ? list : [...list, msg]));
      if (openRef.current) return;
      setUnread((n) => n + 1);
      setPreview(msg);
      clearTimeout(hide);
      hide = setTimeout(() => setPreview(null), 4000);
    });
    return () => { clearTimeout(hide); unsubscribe(); };
  }, [chat]);

  // Earlier messages from the server, merged with anything that arrived live meanwhile.
  useEffect(() => {
    let alive = true;
    api.listRoomMessages(roomId).then((history) => {
      if (!alive) return;
      const saved: ChatMessage[] = history.map((m) => ({ ...m, mine: m.authorId === myUserId }));
      setMessages((live) => {
        const known = new Set(live.map((m) => m.id));
        return [...saved.filter((m) => !known.has(m.id)), ...live].sort((a, b) => a.at - b.at);
      });
    }).catch(() => {});
    return () => { alive = false; };
  }, [roomId, myUserId]);

  function send(text: string) {
    const msg: ChatMessage = { id: chatId(), authorId: 'me', author: me.name, teacher: isTeacher, mine: true, text, at: Date.now() };
    setMessages((list) => [...list, msg]);
    chat.send({ id: msg.id, text: msg.text, at: msg.at });
    // Best effort: everyone present already got it live; this is for whoever joins later.
    api.postRoomMessage(roomId, { id: msg.id, text: msg.text }).catch(() => {});
  }

  return {
    messages, open, unread, preview, send,
    show: () => { setOpen(true); setUnread(0); setPreview(null); },
    hide: () => setOpen(false),
  };
}

/** Most reactions on screen at once — a burst of clicks shouldn't bury the video. */
const MAX_FLOATING = 14;
/** Minimum gap between your own reactions. */
const REACT_COOLDOWN_MS = 350;

function useReactions(transport: ReactionTransport) {
  const [floating, setFloating] = useState<Reaction[]>([]);
  const lastSent = useRef(0);

  const add = (r: Reaction) => {
    setFloating((list) => [...list.slice(-(MAX_FLOATING - 1)), r]);
    setTimeout(() => setFloating((list) => list.filter((x) => x.id !== r.id)), FLOAT_MS + 100);
  };

  useEffect(() => transport.subscribe(add), [transport]);

  function react(emoji: ReactionEmoji) {
    const now = Date.now();
    if (now - lastSent.current < REACT_COOLDOWN_MS) return;
    lastSent.current = now;
    add({ id: reactionId(), emoji, author: 'You', mine: true });
    transport.send(emoji);
  }

  return { floating, react };
}

function TopButton({ icon, active, onPress, label, children, size = 42 }: {
  icon: IconName; active?: boolean; onPress: () => void; label: string; children?: ReactNode; size?: number;
}) {
  return (
    <Pressable scaleTo={0.88} onClick={onPress} aria-label={label} title={label}
      style={{ position: 'relative', width: size, height: size, borderRadius: size / 2, flexShrink: 0, backgroundColor: active ? colors.primary : colors.stageCard, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={20} color={colors.stageText} />
      {children}
    </Pressable>
  );
}

/** Lays tiles out in a grid that adapts to how many people are in the room (and the screen's shape). */
function Grid({ tiles, muteFor, wide }: { tiles: TileInfo[]; muteFor: MuteFor; wide: boolean }) {
  const n = tiles.length;
  const cols = wide ? (n <= 1 ? 1 : n <= 4 ? 2 : n <= 9 ? 3 : 4) : n <= 2 ? 1 : 2;
  const rows = Math.ceil(n / cols);
  const scroll = wide ? n > 12 : n > 6;
  return (
    <div className="stage-scroll" style={{
      flex: 1, minHeight: 0, display: 'grid', gap: 8, gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
      gridAutoRows: scroll ? (wide ? 'minmax(180px, 1fr)' : 'minmax(0, auto)') : `minmax(0, 1fr)`,
      gridTemplateRows: scroll ? undefined : `repeat(${rows}, minmax(0, 1fr))`, overflowY: scroll ? 'auto' : 'hidden',
    }}>
      {tiles.map((t) => (
        <ParticipantTile key={t.key} tile={t} onMute={muteFor(t)} style={scroll && !wide ? { aspectRatio: '3 / 4' } : undefined} />
      ))}
    </div>
  );
}

/** Small square tiles that wrap under the board; scrolls past two rows. */
function Squares({ tiles, muteFor }: { tiles: TileInfo[]; muteFor: MuteFor }) {
  return (
    <div className="h wrap stage-scroll a-fade" style={{ gap: 8, justifyContent: 'center', maxHeight: SQUARE * 2 + 8, overflowY: 'auto', flexShrink: 0 }}>
      {tiles.map((t) => (
        <ParticipantTile key={t.key} tile={t} compact onMute={muteFor(t)} style={{ width: SQUARE, height: SQUARE }} />
      ))}
    </div>
  );
}

function Strip({ tiles, muteFor }: { tiles: TileInfo[]; muteFor: MuteFor }) {
  return (
    <div className="h stage-scroll" style={{ gap: 8, overflowX: 'auto', flexShrink: 0 }}>
      {tiles.map((t) => (
        <ParticipantTile key={t.key} tile={t} compact onMute={muteFor(t)} style={{ width: 92, height: 112, flexShrink: 0 }} />
      ))}
    </div>
  );
}

/** Desktop: participants in a column beside the board. */
function Column({ tiles, muteFor }: { tiles: TileInfo[]; muteFor: MuteFor }) {
  return (
    <div className="v stage-scroll a-fade" style={{ gap: 8, width: 184, flexShrink: 0, overflowY: 'auto', justifyContent: tiles.length < 5 ? 'center' : undefined }}>
      {tiles.map((t) => (
        <ParticipantTile key={t.key} tile={t} compact onMute={muteFor(t)} style={{ width: '100%', aspectRatio: '4 / 3', flexShrink: 0 }} />
      ))}
    </div>
  );
}

/**
 * The board is open for everyone once the teacher opens it. Each person picks how
 * they see it: as the big tile with the participants under it, or on its own.
 */
function useSharedBoard(transport: WbTransport, isTeacher: boolean, connected: boolean) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'grid' | 'full'>('grid');
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => transport.subscribe((m) => {
    if (m.t === 'r' && isTeacher) transport.send({ t: 'o', open: openRef.current });
    if (m.t === 'o' && !isTeacher) {
      setOpen(m.open);
      if (m.open) setView('grid');
    }
  }), [transport, isTeacher]);

  // Joining (or rejoining) a class that's already going: ask whether the board is open.
  useEffect(() => {
    if (connected && !isTeacher) transport.send({ t: 'r' });
  }, [connected, isTeacher, transport]);

  function toggle() {
    const next = !openRef.current;
    setOpen(next);
    if (next) setView('grid');
    transport.send({ t: 'o', open: next });
  }

  return { open, view, toggle, toggleView: () => setView((v) => (v === 'grid' ? 'full' : 'grid')) };
}

export function Stage(props: StageProps) {
  const { room, isTeacher, tiles, connection, recording } = props;
  const wide = useWide();
  const board = useSharedBoard(props.transport, isTeacher, connection === 'connected');
  const elapsed = useElapsed();
  const chat = useChat(props.chat, props.me, isTeacher, room.id);
  const reactions = useReactions(props.reactions);
  const [panel, setPanel] = useState<'react' | 'share' | null>(null);
  const togglePanel = (p: 'react' | 'share') => setPanel((cur) => (cur === p ? null : p));
  const capture = props.screen;
  const share = useScreenShare({
    signal: props.screenSignal, capture, isTeacher, myId: props.myId, roomId: room.id, connected: connection === 'connected',
  });
  const studentShare = capture.active && !capture.active.isLocal ? capture.active : null;

  // The tile's mic icon updates by itself once LiveKit applies the mute.
  async function mute(run: () => Promise<void>) {
    try {
      await run();
    } catch (e) {
      alert('Couldn’t mute', e instanceof Error ? e.message : 'Please try again.');
    }
  }
  const muteFor: MuteFor = (t) =>
    isTeacher && !t.isLocal && !t.isTeacher ? () => void mute(() => props.onMute(t.key)) : undefined;
  const anyStudentTalking = tiles.some((t) => !t.isLocal && !t.isTeacher && t.micOn);

  const muteAll = () => {
    alert('Mute all students?', 'Every student’s microphone is turned off. They can turn it back on to speak.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Mute all', onPress: () => void mute(props.onMuteAll) },
    ]);
  };

  const leave = () => {
    if (!isTeacher) {
      alert('Leave class?', undefined, [
        { text: 'Stay', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => props.onLeave(false) },
      ]);
      return;
    }
    alert('Leave the class', 'Students stay connected if you only leave.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Just leave', onPress: () => props.onLeave(false) },
      { text: 'End for everyone', style: 'destructive', onPress: () => props.onLeave(true) },
    ]);
  };

  const panels = (
    <>
      {panel === 'react' && <ReactionPicker onPick={reactions.react} />}
      {panel === 'share' && (
        <TeacherSharePanel
          sharing={capture.sharing}
          policyOpen={share.policyOpen}
          studentShare={studentShare}
          onToggleMine={() => { setPanel(null); return capture.sharing ? share.stopMine() : share.startMine(); }}
          onPolicy={share.setPolicy}
          onStopStudent={() => { if (studentShare) share.stopStudent(studentShare.ownerId); }}
        />
      )}
      {isTeacher && share.requests.map((peer) => (
        <RequestCard key={peer.id} peer={peer} onAnswer={(allow) => share.respond(peer, allow)} />
      ))}
      {!isTeacher && <StudentShareBanner pending={share.pending} notice={share.notice} onShare={share.startMine} onDismiss={share.dismissNotice} />}
    </>
  );

  const preview = chat.preview && (
    <Pressable scaleTo={0.97} onClick={chat.show} style={{
      display: 'flex', alignItems: 'center', gap: 8, width: '100%', backgroundColor: colors.stageCard, borderRadius: radius.pill,
      padding: '10px 14px', border: `1px solid ${colors.stageLine}`,
    }}>
      <Icon name={chat.preview.teacher ? 'school' : 'chatbubble'} size={14} color={chat.preview.teacher ? '#B9B5FF' : colors.stageMuted} />
      <Text variant="small" color={colors.stageText} lines={1} className="flex1">
        <Text variant="small" color={colors.stageMuted}>{chat.preview.author}: </Text>{chat.preview.text}
      </Text>
    </Pressable>
  );

  const status = (
    <>
      {connection !== 'connected' && (
        <span className="a-fade" style={{ alignSelf: 'center', backgroundColor: colors.stageCard, padding: '6px 14px', borderRadius: radius.pill, marginBottom: 8 }}>
          <Text variant="small" color={colors.stageText}>
            {connection === 'connecting' ? 'Connecting to class…' : connection === 'reconnecting' ? 'Reconnecting…' : 'Disconnected'}
          </Text>
        </span>
      )}
      {!!props.notice && (
        <span className="h a-fade" style={{ gap: 6, alignSelf: 'center', backgroundColor: colors.stageCard, padding: '6px 14px', borderRadius: radius.pill, marginBottom: 8 }}>
          <Icon name="mic-off" size={14} color={colors.danger} />
          <Text variant="small" color={colors.stageText}>{props.notice}</Text>
        </span>
      )}
    </>
  );

  const info = (
    <div className="v" style={{ gap: 2, minWidth: 0 }}>
      <Text variant="heading" color={colors.stageText} lines={1}>{room.title}</Text>
      <div className="h" style={{ gap: 6 }}>
        <Text variant="small" color={colors.stageMuted}>{formatClock(elapsed)}</Text>
        <Text variant="small" color={colors.stageLine}>•</Text>
        <Icon name="people" size={12} color={colors.stageMuted} />
        <Text variant="small" color={colors.stageMuted}>{tiles.length}</Text>
      </div>
    </div>
  );

  const unreadBadge = chat.unread > 0 && (
    <span className="h center a-zoom" style={{
      position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18, borderRadius: 9, padding: '0 4px',
      backgroundColor: colors.danger, border: `2px solid ${colors.stage}`,
    }}>
      <Text variant="small" color="#fff" style={{ fontSize: 10, lineHeight: '12px' }}>{chat.unread > 9 ? '9+' : chat.unread}</Text>
    </span>
  );

  /** Mute all, reactions and screen share: in the header on phones, at the bottom right on desktop. */
  const actions = (size: number) => (
    <>
      {isTeacher && anyStudentTalking && <TopButton size={size} icon="mic-off-outline" onPress={muteAll} label="Mute all students" />}
      <TopButton size={size} icon={panel === 'react' ? 'close' : 'happy-outline'} active={panel === 'react'} onPress={() => togglePanel('react')} label="Reactions" />
      <TopButton
        size={size}
        icon={share.pending ? 'hourglass-outline' : capture.sharing ? 'desktop' : 'desktop-outline'}
        active={capture.sharing || panel === 'share'}
        onPress={() => (isTeacher ? togglePanel('share') : share.studentPress())}
        label={capture.sharing ? 'Stop sharing your screen' : 'Share your screen'}
      />
    </>
  );

  const controls = (inline: boolean) => (
    <ControlBar
      inline={inline}
      mic={props.mic}
      cam={props.cam}
      board={board.open}
      recording={recording}
      recordingBusy={props.recordingBusy}
      isTeacher={isTeacher}
      canFlip={props.canFlip}
      onMic={props.onMic}
      onCam={props.onCam}
      onFlip={props.onFlip}
      onBoard={board.toggle}
      onRecord={props.onRecord}
      onLeave={leave}
    />
  );

  const screenView = capture.active && (
    <div key={`screen-${capture.active.ownerId}`} className="v a-fade" style={{ flex: 1, minHeight: 0, gap: 10 }}>
      <ScreenView
        share={capture.active}
        onStop={capture.active.isLocal ? share.stopMine : isTeacher ? () => share.stopStudent(capture.active!.ownerId) : undefined}
      />
      <Strip tiles={tiles} muteFor={muteFor} />
    </div>
  );

  const grid = (
    <div key="grid" className="v a-fade" style={{ flex: 1, minHeight: 0 }}>
      <Grid tiles={tiles} muteFor={muteFor} wide={wide} />
    </div>
  );

  if (wide) {
    return (
      <div className="stage-root" style={{ position: 'fixed', inset: 0, backgroundColor: colors.stage, display: 'flex', overflow: 'hidden' }}>
        {props.children}
        <div className="v flex1" style={{ position: 'relative', minWidth: 0 }}>
          <div className="v" style={{ position: 'absolute', top: 12, left: 0, right: 0, zIndex: 5, pointerEvents: 'none' }}>{status}</div>

          <div className="v" style={{ flex: 1, minHeight: 0, padding: '16px 16px 0' }}>
            {board.open ? (
              <div key="board" className="h a-fade" style={{ flex: 1, minHeight: 0, gap: 12, alignItems: 'stretch' }}>
                <Whiteboard rail transport={props.transport} isHost={isTeacher} title={room.title} />
                {board.view === 'grid' && <Column tiles={tiles} muteFor={muteFor} />}
              </div>
            ) : capture.active ? screenView : grid}
          </div>

          {/* Panels open from the buttons at the bottom right, so they sit just above them. */}
          <div className="v panel-stack" style={{ position: 'absolute', right: 16, bottom: 92, width: 400, maxWidth: 'calc(100% - 32px)', gap: 8, zIndex: 6 }}>
            {preview && <div key={chat.preview!.id} className="a-up">{preview}</div>}
            {panels}
          </div>

          <div className="h" style={{ padding: '14px 20px', gap: 16, minHeight: 82 }}>
            <div className="h flex1" style={{ gap: 12, minWidth: 0 }}>
              {info}
              {recording && <RecBadge />}
            </div>
            {controls(true)}
            <div className="h flex1" style={{ gap: 10, justifyContent: 'flex-end' }}>
              {board.open && (
                <TopButton size={48} icon={board.view === 'full' ? 'contract-outline' : 'expand-outline'} onPress={board.toggleView}
                  label={board.view === 'full' ? 'Show participants' : 'Board only'} />
              )}
              {actions(48)}
              <TopButton size={48} icon="chatbubble-ellipses" active={chat.open} onPress={chat.open ? chat.hide : chat.show}
                label={chat.unread ? `Chat, ${chat.unread} unread` : 'Chat'}>
                {unreadBadge}
              </TopButton>
            </div>
          </div>

          <FloatingReactions reactions={reactions.floating} bottom={100} />
        </div>

        {chat.open && <ChatPanel docked messages={chat.messages} onSend={chat.send} onClose={chat.hide} />}
      </div>
    );
  }

  return (
    <div className="stage-root" style={{ position: 'fixed', inset: 0, backgroundColor: colors.stage, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {props.children}
      <div className="h a-up" style={{ padding: '12px 20px', gap: 8 }}>
        <div className="flex1" style={{ minWidth: 0 }}>{info}</div>
        {recording && <RecBadge />}
        {actions(42)}
        <TopButton icon="chatbubble-ellipses" onPress={chat.show} label={chat.unread ? `Chat, ${chat.unread} unread` : 'Chat'}>
          {unreadBadge}
        </TopButton>
      </div>

      {panels}

      {preview && (
        <div key={chat.preview!.id} className="a-up" style={{ position: 'absolute', left: 16, right: 16, top: 72, zIndex: 5, maxWidth: 520, margin: '0 auto' }}>
          {preview}
        </div>
      )}

      {status}

      <div className="v" style={{ flex: 1, minHeight: 0, padding: '0 12px' }}>
        {board.open ? (
          <div key="board" className="v a-fade" style={{ flex: 1, minHeight: 0, gap: 8 }}>
            {/* Always the first child, so switching views never remounts the board (and loses the drawing). */}
            <div className="v" style={{ flex: 1, minHeight: 0, position: 'relative' }}>
              <Whiteboard transport={props.transport} isHost={isTeacher} title={room.title} />
              <Pressable scaleTo={0.88} onClick={board.toggleView} aria-label={board.view === 'full' ? 'Show participants' : 'Board only'}
                style={{ position: 'absolute', top: 8, left: 8, display: 'flex', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.6)', padding: '6px 10px', borderRadius: radius.pill }}>
                <Icon name={board.view === 'full' ? 'contract-outline' : 'expand-outline'} size={16} color={colors.stageText} />
                <Text variant="small" color={colors.stageText}>{board.view === 'full' ? 'Grid' : 'Board only'}</Text>
              </Pressable>
            </div>
            {board.view === 'grid' && <Squares tiles={tiles} muteFor={muteFor} />}
          </div>
        ) : capture.active ? screenView : grid}
      </div>

      <div style={{ padding: '12px 12px max(env(safe-area-inset-bottom), 12px)' }}>
        {controls(false)}
      </div>

      {/* Starts just above the control bar. */}
      <FloatingReactions reactions={reactions.floating} bottom={110} />

      {chat.open && <ChatPanel messages={chat.messages} onSend={chat.send} onClose={chat.hide} />}
    </div>
  );
}
