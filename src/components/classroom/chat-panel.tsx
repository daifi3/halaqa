import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from '@/components/ui/misc';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { CHAT_MAX_LENGTH, type ChatMessage } from '@/lib/chat';
import { formatTime } from '@/lib/format';
import { colors, fonts, radius } from '@/theme';

const TEACHER_TINT = '#B9B5FF';
/** Messages from the same person within this window are grouped under one name. */
const GROUP_MS = 2 * 60_000;

function Bubble({ msg, first }: { msg: ChatMessage; first: boolean }) {
  return (
    <Animated.View entering={FadeInDown.duration(200)} style={[styles.bubbleRow, msg.mine && { alignItems: 'flex-end' }, first && { marginTop: 10 }]}>
      {first && !msg.mine && (
        <View style={styles.author}>
          {msg.teacher && <Ionicons name="school" size={12} color={TEACHER_TINT} />}
          <Text variant="small" color={msg.teacher ? TEACHER_TINT : colors.stageMuted} style={{ fontFamily: fonts.semibold }}>
            {msg.author}{msg.teacher ? ' · Teacher' : ''}
          </Text>
        </View>
      )}
      <View style={[styles.bubble, msg.mine ? styles.mine : msg.teacher ? styles.fromTeacher : styles.theirs]}>
        <Text color={msg.mine ? '#fff' : colors.stageText}>{msg.text}</Text>
        <Text variant="small" color={msg.mine ? 'rgba(255,255,255,0.65)' : colors.stageMuted} style={styles.time}>{formatTime(new Date(msg.at).toISOString())}</Text>
      </View>
    </Animated.View>
  );
}

export function ChatPanel({ messages, onSend, onClose }: {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState('');
  const list = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const canSend = draft.trim().length > 0;

  function send() {
    if (!canSend) return;
    onSend(draft.trim());
    setDraft('');
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View entering={FadeIn} exiting={FadeOut} style={[StyleSheet.absoluteFill, styles.backdrop]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close chat" />
      </Animated.View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.avoider} pointerEvents="box-none">
        <Animated.View entering={SlideInDown.springify().damping(20)} exiting={SlideOutDown.duration(200)} style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text variant="heading" color={colors.stageText}>Class chat</Text>
              <Text variant="small" color={colors.stageMuted}>Everyone in the session can see these messages</Text>
            </View>
            <IconButton icon="close" size={38} color={colors.stageText} bg={colors.stageCard} onPress={onClose} />
          </View>

          <ScrollView
            ref={list}
            style={{ flex: 1 }}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
          >
            {messages.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="chatbubbles-outline" size={30} color={colors.stageMuted} />
                <Text color={colors.stageMuted} style={{ textAlign: 'center' }}>No messages yet.{'\n'}Ask a question or say hello.</Text>
              </View>
            ) : (
              messages.map((m, i) => {
                const prev = messages[i - 1];
                const first = !prev || prev.authorId !== m.authorId || prev.mine !== m.mine || m.at - prev.at > GROUP_MS;
                return <Bubble key={m.id} msg={m} first={first} />;
              })
            )}
          </ScrollView>

          <View style={styles.composer}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Message the class…"
              placeholderTextColor={colors.stageMuted}
              selectionColor={colors.primary}
              maxLength={CHAT_MAX_LENGTH}
              multiline
              style={styles.input}
              onSubmitEditing={send}
              submitBehavior="submit"
              returnKeyType="send"
            />
            <PressableScale scaleTo={0.88} disabled={!canSend} onPress={send} style={[styles.send, !canSend && { backgroundColor: colors.stageCard }]} accessibilityLabel="Send message">
              <Ionicons name="arrow-up" size={20} color="#fff" />
            </PressableScale>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.55)' },
  avoider: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    height: '72%', backgroundColor: '#15161B', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    borderWidth: 1, borderColor: colors.stageLine, borderBottomWidth: 0,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.stageLine },
  list: { paddingHorizontal: 16, paddingBottom: 12, flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 40 },
  bubbleRow: { alignItems: 'flex-start', marginTop: 4 },
  author: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4, marginLeft: 4 },
  bubble: { maxWidth: '82%', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, gap: 2 },
  mine: { backgroundColor: colors.primary, borderBottomRightRadius: 6 },
  theirs: { backgroundColor: colors.stageCard, borderBottomLeftRadius: 6 },
  fromTeacher: { backgroundColor: '#24234A', borderBottomLeftRadius: 6 },
  time: { fontSize: 10, lineHeight: 13, alignSelf: 'flex-end' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.stageLine },
  input: {
    flex: 1, minHeight: 44, maxHeight: 110, borderRadius: 22, backgroundColor: colors.stageCard, color: colors.stageText,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, fontFamily: fonts.medium, fontSize: 15,
  },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
