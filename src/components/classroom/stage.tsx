import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInUp, FadeOut, LinearTransition, ZoomIn, ZoomOut } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { PulseDot } from '@/components/ui/misc';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { chatId, type ChatMessage, type ChatTransport } from '@/lib/chat';
import { formatClock } from '@/lib/format';
import { reactionId, type Reaction, type ReactionEmoji, type ReactionTransport } from '@/lib/reactions';
import type { InkTransport } from '@/lib/screen-ink';
import type { ScreenSignal } from '@/lib/screen-share';
import type { Room } from '@/lib/types';
import type { WbTransport } from '@/lib/whiteboard';
import { useSession } from '@/store/session';
import { colors, radius } from '@/theme';
import { ChatPanel } from './chat-panel';
import { ControlBar } from './control-bar';
import { ParticipantTile, type TileInfo } from './participant-tile';
import { FLOAT_MS, FloatingReactions, ReactionPicker } from './reactions';
import { InkLayer, RequestCard, ScreenView, StudentShareBanner, TeacherSharePanel } from './screen-share';
import { useScreenInk } from './use-screen-ink';
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
  /** Drawings on the shared screen. */
  ink: InkTransport;
  /** Your LiveKit identity — how the teacher addresses you in screen-share answers. */
  myId: string;
  /** Shown on your own messages to everyone else. */
  me: { name: string };
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
}

/** Side of a participant square under the board — four fit across a small phone. */
const SQUARE = 76;

/** Given a tile, the teacher's mute action for it — or nothing. */
type MuteFor = (tile: TileInfo) => (() => void) | undefined;

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
    <Animated.View entering={ZoomIn} exiting={ZoomOut.duration(150)} style={styles.rec}>
      <PulseDot color="#fff" size={7} />
      <Text variant="label" color="#fff">REC</Text>
    </Animated.View>
  );
}

/** Collects chat messages for the whole class, open or not, and counts the unread ones. */
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
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
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

/** Most reactions on screen at once — a burst of taps shouldn't bury the video. */
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

function TopButton({ icon, active, onPress, label, children }: {
  icon: keyof typeof Ionicons.glyphMap; active?: boolean; onPress: () => void; label: string; children?: React.ReactNode;
}) {
  return (
    <PressableScale scaleTo={0.88} onPress={onPress} style={[styles.chatBtn, active && { backgroundColor: colors.primary }]} accessibilityLabel={label}>
      <Ionicons name={icon} size={20} color={colors.stageText} />
      {children}
    </PressableScale>
  );
}

function ChatButton({ unread, onPress }: { unread: number; onPress: () => void }) {
  return (
    <TopButton icon="chatbubble-ellipses" onPress={onPress} label={unread ? `Chat, ${unread} unread` : 'Chat'}>
      {unread > 0 && (
        <Animated.View entering={ZoomIn} style={styles.badge}>
          <Text variant="small" color="#fff" style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
        </Animated.View>
      )}
    </TopButton>
  );
}

/** Lays tiles out in a grid that adapts to how many people are in the room. */
function Grid({ tiles, muteFor }: { tiles: TileInfo[]; muteFor: MuteFor }) {
  const n = tiles.length;
  const cols = n <= 2 ? 1 : 2;
  const rows = Math.ceil(n / cols);
  if (n > 6) {
    return (
      <ScrollView contentContainerStyle={styles.wrapGrid}>
        {tiles.map((t) => (
          <Animated.View key={t.key} layout={LinearTransition.springify()} style={{ width: '48.5%', aspectRatio: 3 / 4 }}>
            <ParticipantTile tile={t} onMute={muteFor(t)} style={{ flex: 1 }} />
          </Animated.View>
        ))}
      </ScrollView>
    );
  }
  return (
    <View style={{ flex: 1, gap: 8 }}>
      {Array.from({ length: rows }, (_, r) => (
        <View key={r} style={{ flex: 1, flexDirection: 'row', gap: 8 }}>
          {tiles.slice(r * cols, r * cols + cols).map((t) => (
            <Animated.View key={t.key} layout={LinearTransition.springify().damping(18)} style={{ flex: 1 }}>
              <ParticipantTile tile={t} onMute={muteFor(t)} style={{ flex: 1 }} />
            </Animated.View>
          ))}
        </View>
      ))}
    </View>
  );
}

/** Small square tiles that wrap under the board; scrolls past two rows. */
function Squares({ tiles, muteFor }: { tiles: TileInfo[]; muteFor: MuteFor }) {
  return (
    <ScrollView style={{ flexGrow: 0, maxHeight: SQUARE * 2 + 8 }} contentContainerStyle={styles.squares}>
      {tiles.map((t) => (
        <Animated.View key={t.key} layout={LinearTransition.springify().damping(18)} style={{ width: SQUARE, height: SQUARE }}>
          <ParticipantTile tile={t} compact onMute={muteFor(t)} style={{ flex: 1 }} />
        </Animated.View>
      ))}
    </ScrollView>
  );
}

function Strip({ tiles, muteFor }: { tiles: TileInfo[]; muteFor: MuteFor }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ flexGrow: 0 }}>
      {tiles.map((t) => (
        <View key={t.key} style={{ width: 92, height: 112 }}>
          <ParticipantTile tile={t} compact onMute={muteFor(t)} style={{ flex: 1 }} />
        </View>
      ))}
    </ScrollView>
  );
}

/**
 * The board is open for everyone once the teacher opens it. Each person picks how
 * they see it: as the big tile in the participants grid, or on its own.
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
  const board = useSharedBoard(props.transport, isTeacher, connection === 'connected');
  const elapsed = useElapsed();
  const chat = useChat(props.chat, props.me, isTeacher, room.id);
  const insets = useSafeAreaInsets();
  const reactions = useReactions(props.reactions);
  const [panel, setPanel] = useState<'react' | 'share' | null>(null);
  const togglePanel = (p: 'react' | 'share') => setPanel((cur) => (cur === p ? null : p));
  const capture = props.screen;
  const share = useScreenShare({
    signal: props.screenSignal, capture, isTeacher, myId: props.myId, roomId: room.id, connected: connection === 'connected',
  });
  const studentShare = capture.active && !capture.active.isLocal ? capture.active : null;
  const shareId = capture.active?.ownerId ?? null;
  const ink = useScreenInk(props.ink, shareId, useMemo(() => ({ id: props.myId, name: props.me.name }), [props.myId, props.me.name]));
  // The share your pen is on for: it goes back off by itself when the share changes or ends.
  const [drawingOn, setDrawingOn] = useState<string | null>(null);
  const drawing = !!shareId && drawingOn === shareId;

  // The tile's mic icon updates by itself once LiveKit applies the mute.
  async function mute(run: () => Promise<void>) {
    try {
      await run();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch (e) {
      Alert.alert('Couldn’t mute', e instanceof Error ? e.message : 'Please try again.');
    }
  }
  const muteFor: MuteFor = (t) =>
    isTeacher && !t.isLocal && !t.isTeacher ? () => void mute(() => props.onMute(t.key)) : undefined;
  const anyStudentTalking = tiles.some((t) => !t.isLocal && !t.isTeacher && t.micOn);

  const muteAll = () => {
    Alert.alert('Mute all students?', 'Every student’s microphone is turned off. They can turn it back on to speak.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Mute all', onPress: () => void mute(props.onMuteAll) },
    ]);
  };

  const leave = () => {
    if (!isTeacher) {
      Alert.alert('Leave class?', undefined, [
        { text: 'Stay', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => props.onLeave(false) },
      ]);
      return;
    }
    Alert.alert('Leave the class', 'Students stay connected if you only leave.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Just leave', onPress: () => props.onLeave(false) },
      { text: 'End for everyone', style: 'destructive', onPress: () => props.onLeave(true) },
    ]);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <Animated.View entering={FadeInUp.duration(400)} style={styles.top}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="heading" color={colors.stageText} numberOfLines={1}>{room.title}</Text>
          <View style={styles.meta}>
            <Text variant="small" color={colors.stageMuted}>{formatClock(elapsed)}</Text>
            <Text variant="small" color={colors.stageLine}>•</Text>
            <Ionicons name="people" size={12} color={colors.stageMuted} />
            <Text variant="small" color={colors.stageMuted}>{tiles.length}</Text>
          </View>
        </View>
        {recording && <RecBadge />}
        {isTeacher && anyStudentTalking && <TopButton icon="mic-off-outline" onPress={muteAll} label="Mute all students" />}
        <TopButton icon={panel === 'react' ? 'close' : 'happy-outline'} active={panel === 'react'} onPress={() => togglePanel('react')} label="Reactions" />
        <TopButton
          icon={share.pending ? 'hourglass-outline' : capture.sharing ? 'desktop' : 'desktop-outline'}
          active={capture.sharing || panel === 'share'}
          onPress={() => (isTeacher ? togglePanel('share') : share.studentPress())}
          label={capture.sharing ? 'Stop sharing your screen' : 'Share your screen'}
        />
        <ChatButton unread={chat.unread} onPress={chat.show} />
      </Animated.View>

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
      {!isTeacher && (
        <StudentShareBanner pending={share.pending} notice={share.notice} onShare={share.startMine} onDismiss={share.dismissNotice} />
      )}

      {chat.preview && (
        <Animated.View key={chat.preview.id} entering={FadeInUp.duration(220)} exiting={FadeOut.duration(150)} style={[styles.previewWrap, { top: insets.top + 64 }]}>
          <PressableScale scaleTo={0.97} onPress={chat.show} style={styles.preview}>
            <Ionicons name={chat.preview.teacher ? 'school' : 'chatbubble'} size={14} color={chat.preview.teacher ? '#B9B5FF' : colors.stageMuted} />
            <Text variant="small" color={colors.stageText} numberOfLines={1} style={{ flex: 1 }}>
              <Text variant="small" color={colors.stageMuted}>{chat.preview.author}: </Text>{chat.preview.text}
            </Text>
          </PressableScale>
        </Animated.View>
      )}

      {connection !== 'connected' && (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.banner}>
          <Text variant="small" color={colors.stageText}>
            {connection === 'connecting' ? 'Connecting to class…' : connection === 'reconnecting' ? 'Reconnecting…' : 'Disconnected'}
          </Text>
        </Animated.View>
      )}

      {!!props.notice && (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={[styles.banner, styles.notice]}>
          <Ionicons name="mic-off" size={14} color={colors.danger} />
          <Text variant="small" color={colors.stageText}>{props.notice}</Text>
        </Animated.View>
      )}

      <View style={styles.main}>
        {board.open ? (
          <Animated.View key="board" entering={FadeIn.duration(250)} exiting={FadeOut.duration(150)} style={{ flex: 1, gap: 8 }}>
            {/* Always the first child, so switching views never remounts the board (and loses the drawing). */}
            <View style={{ flex: 1 }}>
              <Whiteboard transport={props.transport} isHost={isTeacher} title={room.title} />
              <PressableScale
                scaleTo={0.88}
                onPress={board.toggleView}
                style={styles.viewToggle}
                accessibilityLabel={board.view === 'full' ? 'Show participants' : 'Board only'}
              >
                <Ionicons name={board.view === 'full' ? 'contract-outline' : 'expand-outline'} size={16} color={colors.stageText} />
                <Text variant="small" color={colors.stageText}>{board.view === 'full' ? 'Grid' : 'Board only'}</Text>
              </PressableScale>
            </View>
            {board.view === 'grid' && (
              <Animated.View entering={FadeIn.duration(200)}>
                <Squares tiles={tiles} muteFor={muteFor} />
              </Animated.View>
            )}
          </Animated.View>
        ) : capture.active ? (
          <Animated.View key={`screen-${capture.active.ownerId}`} entering={FadeIn.duration(250)} exiting={FadeOut.duration(150)} style={{ flex: 1, gap: 10 }}>
            <ScreenView
              share={capture.active}
              ink={ink}
              drawing={drawing}
              onToggleDraw={() => setDrawingOn(drawing ? null : shareId)}
              onStop={capture.active.isLocal ? share.stopMine : isTeacher ? () => share.stopStudent(capture.active!.ownerId) : undefined}
            />
            <Strip tiles={tiles} muteFor={muteFor} />
          </Animated.View>
        ) : (
          <Animated.View key="grid" entering={FadeIn.duration(250)} exiting={FadeOut.duration(150)} style={{ flex: 1 }}>
            <Grid tiles={tiles} muteFor={muteFor} />
          </Animated.View>
        )}
      </View>

      <View style={styles.bottom}>
        <ControlBar
          mic={props.mic}
          cam={props.cam}
          board={board.open}
          recording={recording}
          recordingBusy={props.recordingBusy}
          isTeacher={isTeacher}
          onMic={props.onMic}
          onCam={props.onCam}
          onFlip={props.onFlip}
          onBoard={board.toggle}
          onRecord={props.onRecord}
          onLeave={leave}
        />
      </View>

      {/* Starts just above the control bar. */}
      <FloatingReactions reactions={reactions.floating} bottom={insets.bottom + 110} />

      {chat.open && <ChatPanel messages={chat.messages} onSend={chat.send} onClose={chat.hide} />}

      {/* Sharing from this phone shares the phone's screen, so classmates' drawings go over the whole app: right where they drew them. */}
      {capture.active?.isLocal && <InkLayer ink={ink} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.stage },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 8 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rec: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.danger,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill,
  },
  banner: { alignSelf: 'center', backgroundColor: colors.stageCard, paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.pill, marginBottom: 8 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  viewToggle: {
    position: 'absolute', top: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill,
  },
  main: { flex: 1, paddingHorizontal: 12 },
  wrapGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  squares: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  bottom: { paddingHorizontal: 12, paddingTop: 12 },
  chatBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.stageCard, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
    backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.stage,
  },
  badgeText: { fontSize: 10, lineHeight: 12 },
  previewWrap: { position: 'absolute', left: 16, right: 16, zIndex: 5 },
  preview: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.stageCard, borderRadius: radius.pill,
    paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: colors.stageLine,
  },
});
