import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, StyleSheet, TextInput, View,
} from 'react-native';
import Animated, {
  FadeIn, FadeInDown, FadeInUp, FadeOut, LinearTransition, ZoomIn, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, EmptyState, IconButton } from '@/components/ui/misc';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import {
  CHAT_REACTIONS, CHAT_THEMES, chatAccent, clockTime, dayLabel, formatBytes, isImage, sameDay,
} from '@/lib/direct-chat';
import { startCall } from '@/lib/start-call';
import { useConversation, useIsTyping } from '@/lib/use-conversation';
import { openViewer, viewerKind } from '@/lib/viewer';
import type { Person } from '@/lib/types';
import type { ChatItem } from '@/store/chats';
import { colors, fonts, isDark, radius } from '@/theme';

/** Messages closer than this (same sender) share one group: one time label, tighter corners. */
const GROUP_MS = 5 * 60_000;

type Row =
  | { kind: 'day'; key: string; label: string }
  | { kind: 'msg'; key: string; m: ChatItem; first: boolean; last: boolean };

/** Newest first (the list is inverted), with a day label above each day's first message. */
function buildRows(messages: ChatItem[]): Row[] {
  const rows: Row[] = [];
  messages.forEach((m, i) => {
    const prev = messages[i - 1];
    const next = messages[i + 1];
    if (!prev || !sameDay(prev.createdAt, m.createdAt)) rows.push({ kind: 'day', key: `day-${m.createdAt}`, label: dayLabel(m.createdAt) });
    const joinsPrev = !!prev && prev.senderId === m.senderId && sameDay(prev.createdAt, m.createdAt)
      && Date.parse(m.createdAt) - Date.parse(prev.createdAt) < GROUP_MS;
    const joinsNext = !!next && next.senderId === m.senderId && sameDay(next.createdAt, m.createdAt)
      && Date.parse(next.createdAt) - Date.parse(m.createdAt) < GROUP_MS;
    rows.push({ kind: 'msg', key: m.clientId || m.id, m, first: !joinsPrev, last: !joinsNext });
  });
  return rows.reverse();
}

/** One bouncing dot: rises and brightens, then settles, in a wave with its neighbours. */
function Dot({ delay, color, size = 8, lift = 5 }: { delay: number; color: string; size?: number; lift?: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 300 }), withTiming(0, { duration: 300 }), withTiming(0, { duration: 300 })), -1, false)));
  }, [delay, p]);
  const s = useAnimatedStyle(() => ({ opacity: 0.35 + 0.65 * p.get(), transform: [{ translateY: -lift * p.get() }] }));
  return <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, s]} />;
}

/** "Karim is typing": their photo beside a bubble of dots, like a message on its way. */
function TypingIndicator({ other, accent }: { other: Person; accent: string }) {
  return (
    <Animated.View entering={FadeInDown.duration(220)} exiting={FadeOut.duration(150)} style={styles.typingRow}
      accessibilityLabel={`${other.name} is typing`}>
      <Avatar name={other.name} size={28} uri={other.avatarUrl} />
      <View style={[styles.typingBubble, { borderColor: accent + '33' }]}>
        {[0, 1, 2].map((i) => <Dot key={i} delay={i * 150} color={accent} />)}
      </View>
    </Animated.View>
  );
}

/** The header's "typing" with three small dots instead of a static ellipsis. */
function TypingLabel({ accent }: { accent: string }) {
  return (
    <Animated.View entering={FadeIn.duration(150)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: 18 }}>
      <Text variant="small" color={accent} style={{ fontFamily: fonts.semibold }}>typing</Text>
      <View style={{ flexDirection: 'row', gap: 2, paddingTop: 4 }}>
        {[0, 1, 2].map((i) => <Dot key={i} delay={i * 150} color={accent} size={4} lift={2} />)}
      </View>
    </Animated.View>
  );
}

function Attachment({ m, mine }: { m: ChatItem; mine: boolean }) {
  const a = m.attachment!;
  const open = () => {
    if (m.status) return;
    const kind = viewerKind(a.mimeType, a.url);
    if (kind) openViewer({ url: a.url, title: a.name, kind });
    else void Linking.openURL(a.url);
  };
  if (isImage(a)) {
    return (
      <Pressable onPress={open} accessibilityLabel={`Photo ${a.name}`}>
        <Image source={{ uri: a.url }} style={styles.photo} contentFit="cover" transition={150} />
      </Pressable>
    );
  }
  return (
    <Pressable onPress={open} style={[styles.file, { backgroundColor: mine ? 'rgba(255,255,255,0.16)' : colors.surfaceAlt }]}>
      <Ionicons name="document-text" size={22} color={mine ? '#fff' : colors.primary} />
      <View style={{ flexShrink: 1 }}>
        <Text variant="bodyStrong" color={mine ? '#fff' : colors.ink} numberOfLines={1}>{a.name}</Text>
        {!!a.size && <Text variant="small" color={mine ? 'rgba(255,255,255,0.75)' : colors.muted}>{formatBytes(a.size)}</Text>}
      </View>
    </Pressable>
  );
}

function Bubble({ row, accent, myId, seen, other, animate, onLongPress, onRetry, onReact }: {
  row: Extract<Row, { kind: 'msg' }>;
  accent: string;
  myId: string;
  seen: boolean;
  other?: Person;
  /** The newest few slide in; older ones just appear while scrolling. */
  animate: boolean;
  onLongPress: () => void;
  onRetry: () => void;
  onReact: (emoji: string) => void;
}) {
  const { m, first, last } = row;
  const mine = m.senderId === myId;
  const photoOnly = !!m.attachment && isImage(m.attachment) && !m.text;
  const counts = new Map<string, number>();
  m.reactions.forEach((r) => counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1));
  const myReaction = m.reactions.find((r) => r.userId === myId)?.emoji;

  const body = (
    <View style={[styles.msgRow, mine ? { alignItems: 'flex-end' } : { alignItems: 'flex-start', flex: 1 }]}>
      <Pressable
        onLongPress={onLongPress}
        onPress={m.status === 'failed' ? onRetry : undefined}
        delayLongPress={300}
        style={[
          styles.bubble,
          mine ? [{ backgroundColor: accent }, styles.mineShadow, { shadowColor: accent }] : styles.theirs,
          photoOnly && styles.photoBubble,
          mine ? { borderBottomRightRadius: last ? 6 : 20, borderTopRightRadius: first ? 20 : 6 }
            : { borderBottomLeftRadius: last ? 6 : 20, borderTopLeftRadius: first ? 20 : 6 },
          m.status === 'sending' && { opacity: 0.7 },
        ]}
      >
        {m.attachment && <Attachment m={m} mine={mine} />}
        {!!m.text && <Text color={mine ? '#fff' : colors.ink} selectable style={m.attachment ? { marginTop: 6 } : undefined}>{m.text}</Text>}
      </Pressable>

      {counts.size > 0 && (
        <View style={[styles.reactions, mine ? { marginRight: 6 } : { marginLeft: 6 }]}>
          {[...counts].map(([emoji, n]) => (
            <PressableScale key={emoji} scaleTo={0.9} onPress={() => onReact(emoji)}
              style={[styles.reactionChip, myReaction === emoji && { borderColor: accent }]}>
              <Text style={{ fontSize: 13 }}>{emoji}{n > 1 ? ` ${n}` : ''}</Text>
            </PressableScale>
          ))}
        </View>
      )}

      {m.status === 'failed' ? (
        <Pressable onPress={onRetry} style={styles.meta}>
          <Ionicons name="alert-circle" size={13} color={colors.danger} />
          <Text variant="small" color={colors.danger}>Not sent · tap to retry</Text>
        </Pressable>
      ) : last ? (
        <View style={styles.meta}>
          <Text variant="small" color={colors.muted} style={styles.metaText}>{clockTime(m.createdAt)}</Text>
          {mine && (m.status === 'sending'
            ? <Ionicons name="time-outline" size={12} color={colors.muted} />
            : <Ionicons name={seen ? 'checkmark-done' : 'checkmark'} size={14} color={seen ? accent : colors.muted} />)}
          {mine && seen && !m.status && <Text variant="small" color={accent} style={styles.metaText}>Seen</Text>}
        </View>
      ) : undefined}
    </View>
  );

  return (
    <Animated.View
      entering={animate ? (mine ? FadeInDown.duration(220) : FadeInDown.duration(260)) : undefined}
      layout={LinearTransition.duration(180)}
      style={[mine ? null : styles.theirRow, first && { marginTop: 10 }]}
    >
      {mine ? body : (
        <>
          {/* Their photo sits beside the last bubble of each group (level with it, above the time). */}
          <View style={styles.avatarSlot}>
            {last && other && <Avatar name={other.name} size={28} uri={other.avatarUrl} />}
          </View>
          {body}
        </>
      )}
    </Animated.View>
  );
}

/** Long-press menu: react, copy, retry. */
function MessageMenu({ m, mine, accent, myReaction, onReact, onRetry, onClose }: {
  m: ChatItem; mine: boolean; accent: string; myReaction?: string;
  onReact: (emoji: string) => void; onRetry: () => void; onClose: () => void;
}) {
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.menuBackdrop} onPress={onClose}>
        <Animated.View entering={FadeInUp.duration(180)} style={[styles.menu, mine ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }]}>
          {!m.status && (
            <View style={styles.emojiRow}>
              {CHAT_REACTIONS.map((e) => (
                <PressableScale key={e} scaleTo={0.8} onPress={() => { onReact(e); onClose(); }}
                  style={[styles.emojiBtn, myReaction === e && { backgroundColor: accent + '33' }]} accessibilityLabel={`React ${e}`}>
                  <Text style={{ fontSize: 26 }}>{e}</Text>
                </PressableScale>
              ))}
            </View>
          )}
          <View style={styles.menuActions}>
            {!!m.text && (
              <PressableScale scaleTo={0.97} style={styles.menuAction}
                onPress={async () => { await Clipboard.setStringAsync(m.text!); onClose(); }}>
                <Ionicons name="copy-outline" size={18} color={colors.ink} />
                <Text>Copy text</Text>
              </PressableScale>
            )}
            {m.status === 'failed' && (
              <PressableScale scaleTo={0.97} style={styles.menuAction} onPress={() => { onRetry(); onClose(); }}>
                <Ionicons name="refresh" size={18} color={colors.ink} />
                <Text>Send again</Text>
              </PressableScale>
            )}
            <Text variant="small" color={colors.muted} style={{ paddingHorizontal: 14, paddingBottom: 10 }}>
              {new Date(m.createdAt).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

function ThemeSheet({ current, onPick, onClose }: { current: string; onPick: (id: string) => void; onClose: () => void }) {
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <Text variant="heading">Chat theme</Text>
        <Text variant="small" color={colors.muted}>You both see the theme you pick.</Text>
        <View style={styles.themes}>
          {CHAT_THEMES.map((t) => {
            const accent = chatAccent(t.id);
            const on = t.id === current;
            return (
              <PressableScale key={t.id} scaleTo={0.92} onPress={() => { onPick(t.id); onClose(); }} style={styles.theme}
                accessibilityLabel={`${t.name} theme`} accessibilityState={{ selected: on }}>
                <View style={[styles.swatch, { backgroundColor: accent }, on && { borderColor: colors.ink }]}>
                  <Text style={{ fontSize: 20 }}>{t.emoji}</Text>
                </View>
                <Text variant="small" color={on ? colors.ink : colors.muted}>{t.name}</Text>
              </PressableScale>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const chat = useConversation(id);
  const typing = useIsTyping(chat.typingUntil);
  const [draft, setDraft] = useState('');
  const [menuFor, setMenuFor] = useState<ChatItem | null>(null);
  const [themes, setThemes] = useState(false);
  const accent = chatAccent(chat.conversation?.theme);
  const other = chat.conversation?.other;
  const rows = useMemo(() => buildRows(chat.messages), [chat.messages]);
  const otherReadAt = chat.conversation?.otherReadAt ?? null;
  // "Seen" goes under your latest message they've read.
  const seenId = useMemo(() => {
    if (!otherReadAt) return null;
    const mine = chat.messages.filter((m) => m.senderId === chat.myId && !m.status && m.createdAt <= otherReadAt);
    return mine.at(-1)?.id ?? null;
  }, [chat.messages, chat.myId, otherReadAt]);

  function send() {
    if (!draft.trim()) return;
    chat.send(draft);
    setDraft('');
  }

  async function pickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert('Photo access needed', 'Allow photo library access to send pictures.');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    const a = result.canceled ? null : result.assets[0];
    if (a) chat.sendFile({ uri: a.uri, name: a.fileName ?? `photo-${Date.now()}.jpg`, mimeType: a.mimeType ?? 'image/jpeg' }, draft || undefined);
    if (a && draft) setDraft('');
  }

  async function pickFile() {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    const a = result.canceled ? null : result.assets[0];
    if (a) chat.sendFile({ uri: a.uri, name: a.name, mimeType: a.mimeType ?? 'application/octet-stream' }, draft || undefined);
    if (a && draft) setDraft('');
  }

  function attach() {
    Alert.alert('Send a file', undefined, [
      { text: 'Photo', onPress: () => void pickPhoto() },
      { text: 'Document or file', onPress: () => void pickFile() },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: colors.line }]}>
        <IconButton icon="chevron-back" onPress={() => router.back()} />
        {other && <Avatar name={other.name} size={42} uri={other.avatarUrl} ring={accent} />}
        <View style={{ flex: 1, gap: 1 }}>
          <Text variant="bodyStrong" numberOfLines={1}>{other?.name ?? ' '}</Text>
          {typing ? <TypingLabel accent={accent} /> : <Text variant="small" color={colors.muted}>Halaqa chat</Text>}
        </View>
        <IconButton icon="color-palette-outline" color={accent} onPress={() => setThemes(true)} />
        {other && <IconButton icon="call" color="#fff" bg={colors.success} onPress={() => startCall(other)} />}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[{ flex: 1 }, { backgroundColor: accent + (isDark ? '14' : '0D') }]}>
          {chat.loading ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={accent} />
          ) : chat.error ? (
            <EmptyState icon="chatbubbles-outline" title="Can't open this chat" body={chat.error} />
          ) : (
            <FlatList
              inverted
              data={rows}
              keyExtractor={(r) => r.key}
              contentContainerStyle={styles.list}
              keyboardShouldPersistTaps="handled"
              onEndReached={() => { if (chat.hasMore) void chat.loadOlder(); }}
              onEndReachedThreshold={0.3}
              ListHeaderComponent={typing && other ? <TypingIndicator other={other} accent={accent} /> : undefined}
              ListFooterComponent={chat.loadingOlder ? <ActivityIndicator style={{ margin: 12 }} color={accent} /> : rows.length === 0 && other ? (
                <View style={styles.hello}>
                  <Avatar name={other.name} size={72} uri={other.avatarUrl} />
                  <Text variant="heading">{other.name}</Text>
                  <Text color={colors.muted} style={{ textAlign: 'center' }}>Say hello 👋 Messages and files you send here are only between you two.</Text>
                </View>
              ) : undefined}
              renderItem={({ item, index }) => item.kind === 'day' ? (
                <View style={styles.dayRow}>
                  <View style={styles.dayLine} />
                  <Text variant="small" color={colors.muted} style={styles.dayText}>{item.label}</Text>
                  <View style={styles.dayLine} />
                </View>
              ) : (
                <Bubble
                  row={item}
                  other={other}
                  animate={index < 3}
                  accent={accent}
                  myId={chat.myId}
                  seen={item.m.id === seenId}
                  onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); setMenuFor(item.m); }}
                  onRetry={() => chat.retry(item.m.clientId)}
                  onReact={(e) => void chat.react(item.m, e)}
                />
              )}
            />
          )}
        </View>

        <Animated.View entering={FadeInDown.duration(250)} style={styles.composer}>
          <View style={[styles.composerBar, draft ? { borderColor: accent + '66' } : null]}>
          <IconButton icon="add-circle" color={accent} bg="transparent" size={40} onPress={attach} />
          <TextInput
            value={draft}
            onChangeText={(t) => { setDraft(t); if (t.trim()) chat.typing(); }}
            placeholder="Message…"
            placeholderTextColor={colors.muted}
            selectionColor={accent}
            keyboardAppearance={isDark ? 'dark' : 'light'}
            multiline
            maxLength={4000}
            style={styles.input}
          />
          </View>
          {draft.trim() ? (
            <Animated.View key="send" entering={ZoomIn.duration(160)}>
              <PressableScale scaleTo={0.86} onPress={send} accessibilityLabel="Send message"
                style={[styles.send, styles.mineShadow, { backgroundColor: accent, shadowColor: accent }]}>
                <Ionicons name="send" size={18} color="#fff" style={{ marginLeft: 2 }} />
              </PressableScale>
            </Animated.View>
          ) : (
            <Animated.View key="photo" entering={ZoomIn.duration(160)}>
              <IconButton icon="image-outline" color={accent} bg={accent + '1A'} size={44} onPress={() => void pickPhoto()} />
            </Animated.View>
          )}
        </Animated.View>
      </KeyboardAvoidingView>

      {menuFor && (
        <MessageMenu
          m={menuFor}
          mine={menuFor.senderId === chat.myId}
          accent={accent}
          myReaction={menuFor.reactions.find((r) => r.userId === chat.myId)?.emoji}
          onReact={(e) => void chat.react(menuFor, e)}
          onRetry={() => chat.retry(menuFor.clientId)}
          onClose={() => setMenuFor(null)}
        />
      )}
      {themes && <ThemeSheet current={chat.conversation?.theme ?? 'default'} onPick={(t) => void chat.setTheme(t)} onClose={() => setThemes(false)} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, backgroundColor: colors.surface },
  list: { paddingHorizontal: 12, paddingVertical: 12 },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 14, paddingHorizontal: 24 },
  dayLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  dayText: { fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 0.3 },
  theirRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  avatarSlot: { width: 28, marginBottom: 21 },
  mineShadow: { shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  typingRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 10, marginBottom: 4 },
  typingBubble: {
    flexDirection: 'row', alignItems: 'center', gap: 5, height: 38, paddingHorizontal: 16, borderRadius: 20, borderBottomLeftRadius: 6,
    backgroundColor: colors.surface, borderWidth: 1,
  },
  msgRow: { marginTop: 2 },
  bubble: { maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20 },
  theirs: {
    backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line,
    shadowColor: '#000', shadowOpacity: isDark ? 0 : 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  photoBubble: { padding: 4 },
  photo: { width: 220, height: 220, borderRadius: 16, backgroundColor: colors.surfaceAlt },
  file: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 14, minWidth: 180 },
  reactions: { flexDirection: 'row', gap: 4, marginTop: -6 },
  reactionChip: {
    backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2,
    borderWidth: 1.5, borderColor: colors.line,
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3, marginHorizontal: 6 },
  metaText: { fontSize: 11, lineHeight: 14 },
  hello: { alignItems: 'center', gap: 8, paddingVertical: 40, paddingHorizontal: 24 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 6, backgroundColor: colors.bg },
  composerBar: {
    flex: 1, flexDirection: 'row', alignItems: 'flex-end', minHeight: 44, borderRadius: 22, backgroundColor: colors.surface,
    borderWidth: 1.5, borderColor: colors.line, paddingLeft: 2, paddingRight: 6,
  },
  input: {
    flex: 1, minHeight: 40, maxHeight: 120, color: colors.ink, paddingHorizontal: 4, paddingTop: 10, paddingBottom: 10,
    fontFamily: fonts.medium, fontSize: 15,
  },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  menuBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 20 },
  menu: { gap: 10, maxWidth: 360, width: '100%' },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', backgroundColor: colors.surface, borderRadius: 28, padding: 6, gap: 2 },
  emojiBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  menuActions: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden', paddingTop: 4 },
  menuAction: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: 20, paddingBottom: 36, gap: 4 },
  themes: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 14, justifyContent: 'space-between' },
  theme: { alignItems: 'center', gap: 6, width: '21%' },
  swatch: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'transparent' },
});
