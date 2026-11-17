import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  FadeIn, FadeInDown, FadeOut, SlideInDown, SlideOutDown, useAnimatedStyle, useSharedValue, withSpring, withTiming, ZoomIn, ZoomOut,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { Avatar } from '@/components/ui/misc';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { chatAccent } from '@/lib/direct-chat';
import { useChatBubbles } from '@/store/chat-bubbles';
import { useChats } from '@/store/chats';
import { useSession } from '@/store/session';
import { colors, fonts } from '@/theme';
import { ChatView } from './chat-view';

const SIZE = 60;
const EDGE = 10;
/** A message older than this (e.g. one fetched after a reconnect) doesn't pop a bubble up. */
const FRESH_MS = 2 * 60_000;
/** Screens bubbles stay out of: a live class, a call, an exam, and the full chat page. */
const HIDDEN_ON = [/^\/classroom\//, /^\/call\//, /^\/exam\/take\//, /^\/chat\//];

/** Where the stack was last left, so it stays put when it hides and comes back. */
const lastSpot = { x: -1, y: -1 };

/** Pops a chat's bubble up when a message from them arrives and that chat isn't on screen. */
function useBubbleTriggers(enabled: boolean, myId: string | undefined) {
  useEffect(() => {
    if (!enabled || !myId) return;
    return useChats.subscribe((s, prev) => {
      if (!prev.listLoaded) return;
      for (const c of Object.values(s.conversations)) {
        const m = c.lastMessage;
        if (!m || m.senderId === myId || prev.conversations[c.id]?.lastMessage?.id === m.id) continue;
        if (s.activeId === c.id || Date.now() - Date.parse(m.createdAt) > FRESH_MS) continue;
        useChatBubbles.getState().add(c.id);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    });
  }, [enabled, myId]);
}

/** The collapsed stack: drag it anywhere (it snaps to the nearest side), drop it on ✕ to dismiss, tap to open. */
function BubbleStack({ ids, onOpen, onDismiss }: { ids: string[]; onOpen: () => void; onDismiss: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const conversations = useChats((s) => s.conversations);
  const unread = ids.reduce((n, id) => n + (conversations[id]?.unread ?? 0), 0);
  const head = conversations[ids[0]!];

  const minY = insets.top + 12;
  const maxY = height - insets.bottom - SIZE - 120;
  const rightX = width - SIZE - EDGE;
  const x = useSharedValue(lastSpot.x >= 0 ? lastSpot.x : rightX);
  // First time: halfway down the right edge.
  const y = useSharedValue(lastSpot.y >= 0 ? lastSpot.y : Math.round(height / 2 - SIZE / 2));
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const dragging = useSharedValue(0);
  /** Moved far enough to be a drag rather than a tap. */
  const moved = useSharedValue(0);
  const overTrash = useSharedValue(0);
  const trashX = width / 2 - 32;
  const trashY = height - insets.bottom - 110;

  const remember = (nx: number, ny: number) => { lastSpot.x = nx; lastSpot.y = ny; };
  const buzz = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); };

  const pan = usePanGesture({
    minDistance: 0,
    maxPointers: 1,
    onBegin: () => {
      'worklet';
      startX.set(x.get());
      startY.set(y.get());
      moved.set(0);
    },
    onUpdate: (e) => {
      'worklet';
      if (!moved.get() && Math.abs(e.translationX) + Math.abs(e.translationY) > 8) {
        moved.set(1);
        dragging.set(withTiming(1, { duration: 150 }));
      }
      if (!moved.get()) return;
      const nx = startX.get() + e.translationX;
      const ny = startY.get() + e.translationY;
      const near = Math.hypot(nx + SIZE / 2 - (trashX + 32), ny + SIZE / 2 - (trashY + 32)) < 80;
      if (near !== !!overTrash.get()) {
        overTrash.set(near ? 1 : 0);
        if (near) scheduleOnRN(buzz);
      }
      // Snap onto the ✕ while over it, so it's clear what letting go will do.
      x.set(near ? trashX + 32 - SIZE / 2 : nx);
      y.set(near ? trashY + 32 - SIZE / 2 : ny);
    },
    onFinalize: () => {
      'worklet';
      const tap = !moved.get();
      dragging.set(withTiming(0, { duration: 150 }));
      if (tap) {
        scheduleOnRN(onOpen);
        return;
      }
      if (overTrash.get()) {
        overTrash.set(0);
        scheduleOnRN(onDismiss);
        return;
      }
      const nx = x.get() + SIZE / 2 < width / 2 ? EDGE : rightX;
      const ny = Math.min(maxY, Math.max(minY, y.get()));
      x.set(withSpring(nx, { damping: 18, stiffness: 180 }));
      y.set(withSpring(ny, { damping: 18, stiffness: 180 }));
      scheduleOnRN(remember, nx, ny);
    },
  });

  const stackStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { translateY: y.get() }, { scale: 1 + dragging.get() * 0.06 }],
  }));
  const trashStyle = useAnimatedStyle(() => ({
    opacity: dragging.get(),
    transform: [{ translateY: (1 - dragging.get()) * 40 }, { scale: overTrash.get() ? 1.25 : 1 }],
    backgroundColor: overTrash.get() ? colors.danger : 'rgba(20,20,26,0.75)',
  }));
  const onLeft = lastSpot.x >= 0 && lastSpot.x < width / 2;

  if (!head) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View pointerEvents="none" style={[styles.trash, { left: trashX, top: trashY }, trashStyle]}>
        <Ionicons name="close" size={30} color="#fff" />
      </Animated.View>

      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.stack, stackStyle]}
          accessibilityRole="button" accessibilityLabel={`Chat bubble: ${head.other.name}${unread ? `, ${unread} unread` : ''}`}>
          {/* Position lives on the outer view; the pop-in on this one, so the two transforms don't fight. */}
          <Animated.View entering={ZoomIn.springify()} exiting={ZoomOut.duration(150)} style={styles.stackInner}>
          {/* The others peek out from behind the newest one. */}
          {ids.slice(1, 3).reverse().map((id, i, arr) => {
            const c = conversations[id];
            if (!c) return null;
            const depth = arr.length - i;
            return (
              <View key={id} style={[styles.behind, { transform: [{ translateX: (onLeft ? -1 : 1) * depth * 7 }, { scale: 1 - depth * 0.08 }] }]}>
                <Avatar name={c.other.name} size={SIZE} uri={c.other.avatarUrl} />
              </View>
            );
          })}
          <View style={[styles.head, { borderColor: chatAccent(head.theme) }]}>
            <Avatar name={head.other.name} size={SIZE - 6} uri={head.other.avatarUrl} />
          </View>
          {unread > 0 && (
            <Animated.View entering={ZoomIn} style={styles.badge}>
              <Text variant="small" color="#fff" style={{ fontSize: 11, lineHeight: 14, fontFamily: fonts.bold }}>{unread > 99 ? '99+' : unread}</Text>
            </Animated.View>
          )}
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

/** Open: the bubbles in a row on top (tap to switch, ✕ to drop one) and the chat under them. */
function BubblePanel({ ids, open }: { ids: string[]; open: string }) {
  const insets = useSafeAreaInsets();
  const { setOpen, remove, clear } = useChatBubbles();
  const conversations = useChats((s) => s.conversations);
  const collapse = () => setOpen(null);

  // Android back collapses the bubble instead of leaving the screen underneath.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { collapse(); return true; });
    return () => sub.remove();
  });

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)} style={[StyleSheet.absoluteFill, styles.backdrop]}>
        <Pressable style={{ flex: 1 }} onPress={collapse} accessibilityLabel="Collapse chat bubble" />
      </Animated.View>

      <View style={[styles.panelWrap, { paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 8) }]} pointerEvents="box-none">
        <Animated.View entering={FadeInDown.duration(220)} style={styles.row}>
          {/* The bubble itself hides while open; with several chats, a small switcher takes its place. */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}
            contentContainerStyle={{ gap: 10, paddingHorizontal: 4, alignItems: 'center' }}>
            {ids.length > 1 && ids.map((id) => {
              const c = conversations[id];
              if (!c) return null;
              const on = id === open;
              return (
                <View key={id}>
                  <PressableScale scaleTo={0.9} onPress={() => setOpen(id)} accessibilityLabel={`Chat with ${c.other.name}`}
                    accessibilityState={{ selected: on }}
                    style={[styles.rowBubble, { borderColor: on ? chatAccent(c.theme) : 'transparent', opacity: on ? 1 : 0.7 }]}>
                    <Avatar name={c.other.name} size={36} uri={c.other.avatarUrl} />
                  </PressableScale>
                  {c.unread > 0 && !on && <View style={styles.rowDot} />}
                  {on && (
                    <PressableScale scaleTo={0.85} onPress={() => remove(id)} style={styles.rowRemove} accessibilityLabel={`Remove ${c.other.name}'s bubble`} hitSlop={6}>
                      <Ionicons name="close" size={12} color="#fff" />
                    </PressableScale>
                  )}
                </View>
              );
            })}
          </ScrollView>
          <PressableScale scaleTo={0.9} style={styles.rowBtn} accessibilityLabel="Open the full chat"
            onPress={() => { const id = open; remove(id); collapse(); router.push({ pathname: '/chat/[id]', params: { id } }); }}>
            <Ionicons name="expand-outline" size={20} color="#fff" />
          </PressableScale>
          <PressableScale scaleTo={0.9} style={styles.rowBtn} onPress={clear} accessibilityLabel="Close all chat bubbles">
            <Ionicons name="close" size={22} color="#fff" />
          </PressableScale>
        </Animated.View>

        <Animated.View key={open} entering={SlideInDown.duration(240)} exiting={SlideOutDown.duration(180)} style={styles.card}>
          <ChatView id={open} inBubble onClose={collapse} />
        </Animated.View>
      </View>
    </View>
  );
}

/**
 * In-app chat bubbles, over every screen of the signed-in app. Mounted once in the root
 * layout; turned on from a chat's settings.
 */
export function ChatBubbles() {
  const myId = useSession((s) => s.user?.id);
  const enabled = useChatBubbles((s) => s.enabled);
  const bubbles = useChatBubbles((s) => s.bubbles);
  const open = useChatBubbles((s) => s.open);
  const conversations = useChats((s) => s.conversations);
  const pathname = usePathname();
  useBubbleTriggers(enabled, myId);

  const ids = bubbles.filter((id) => conversations[id]);
  const hidden = !myId || !enabled || ids.length === 0 || HIDDEN_ON.some((r) => r.test(pathname));
  if (hidden) return null;
  if (open && ids.includes(open)) return <BubblePanel ids={ids} open={open} />;
  return (
    <BubbleStack
      ids={ids}
      onOpen={() => useChatBubbles.getState().setOpen(ids[0]!)}
      onDismiss={() => useChatBubbles.getState().clear()}
    />
  );
}

const styles = StyleSheet.create({
  stack: { position: 'absolute', left: 0, top: 0, width: SIZE, height: SIZE },
  head: {
    width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderWidth: 3, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 8,
  },
  stackInner: { width: SIZE, height: SIZE },
  behind: { position: 'absolute', opacity: 0.9 },
  badge: {
    position: 'absolute', top: -4, right: -4, minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 5,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.danger, borderWidth: 2, borderColor: colors.surface,
  },
  trash: { position: 'absolute', width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.5)' },
  panelWrap: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, paddingHorizontal: 8, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  rowBubble: { borderRadius: 22, borderWidth: 2.5, padding: 1 },
  rowDot: { position: 'absolute', top: 2, right: 2, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.danger, borderWidth: 2, borderColor: '#000' },
  rowRemove: {
    position: 'absolute', top: -2, right: -2, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(20,20,26,0.9)', borderWidth: 1.5, borderColor: '#fff',
  },
  rowBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' },
  card: { flex: 1, borderRadius: 24, overflow: 'hidden', backgroundColor: colors.bg },
});
