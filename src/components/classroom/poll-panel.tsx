import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from '@/components/ui/misc';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { formatClock } from '@/lib/format';
import {
  cleanDraft, emptyDraft, formatDuration, POLL_DURATIONS, POLL_MAX_OPTIONS, POLL_MIN_OPTIONS, POLL_OPTION_MAX,
  POLL_PRESETS, POLL_QUESTION_MAX, type PollDraft,
} from '@/lib/polls';
import { colors, fonts, radius } from '@/theme';
import type { Polls, PollView } from './use-polls';

const SHEET_BG = '#15161B';

/** Re-renders every half second while a countdown is showing. */
function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

function Pill({ label, active, onPress, icon }: { label: string; active: boolean; onPress: () => void; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <PressableScale scaleTo={0.94} onPress={onPress} style={[styles.pill, active && styles.pillActive]}>
      {icon && <Ionicons name={icon} size={15} color={active ? '#fff' : colors.stageMuted} />}
      <Text variant="small" color={active ? '#fff' : colors.stageText} style={{ fontFamily: fonts.semibold }}>{label}</Text>
    </PressableScale>
  );
}

/* ---------- Teacher: set up a poll or quiz ---------- */

function Composer({ draft, onChange }: { draft: PollDraft; onChange: (d: PollDraft) => void }) {
  const quiz = draft.kind === 'quiz';
  const set = (patch: Partial<PollDraft>) => onChange({ ...draft, ...patch });
  const setOption = (i: number, text: string) => set({ options: draft.options.map((o, j) => (j === i ? text : o)) });
  const removeOption = (i: number) => set({
    options: draft.options.filter((_, j) => j !== i),
    correct: draft.correct === null ? null : draft.correct === i ? null : draft.correct > i ? draft.correct - 1 : draft.correct,
  });

  return (
    <View style={{ gap: 18 }}>
      <View style={styles.row}>
        <Pill label="Poll" icon="stats-chart-outline" active={!quiz} onPress={() => set({ kind: 'poll' })} />
        <Pill label="Quiz" icon="school-outline" active={quiz} onPress={() => set({ kind: 'quiz', durationSec: draft.durationSec ?? 60 })} />
      </View>
      <Text variant="small" color={colors.stageMuted} style={{ marginTop: -8 }}>
        {quiz ? 'A question with one right answer. Students see if they got it right when it ends.' : 'Ask the class’s opinion. There is no right answer.'}
      </Text>

      <View style={{ gap: 8 }}>
        <Text variant="label" color={colors.stageMuted}>Question</Text>
        <TextInput
          value={draft.question}
          onChangeText={(question) => set({ question })}
          placeholder={quiz ? 'e.g. Which keyword creates a new object?' : 'e.g. How are you finding today’s lesson?'}
          placeholderTextColor={colors.stageMuted}
          selectionColor={colors.primary}
          maxLength={POLL_QUESTION_MAX}
          multiline
          style={[styles.input, { minHeight: 64 }]}
        />
      </View>

      <View style={{ gap: 8 }}>
        <Text variant="label" color={colors.stageMuted}>Answers</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">
          {POLL_PRESETS.map((p) => (
            <Pill key={p.label} label={p.label} active={false} onPress={() => set({ options: [...p.options], correct: null })} />
          ))}
        </ScrollView>
        {draft.options.map((o, i) => (
          <Animated.View key={i} layout={LinearTransition} style={styles.optionRow}>
            {quiz && (
              <PressableScale scaleTo={0.85} onPress={() => set({ correct: i })} hitSlop={6}
                accessibilityLabel={`Mark option ${i + 1} as the right answer`}>
                <Ionicons name={draft.correct === i ? 'checkmark-circle' : 'ellipse-outline'} size={24}
                  color={draft.correct === i ? colors.success : colors.stageMuted} />
              </PressableScale>
            )}
            <TextInput
              value={o}
              onChangeText={(t) => setOption(i, t)}
              placeholder={`Option ${i + 1}`}
              placeholderTextColor={colors.stageMuted}
              selectionColor={colors.primary}
              maxLength={POLL_OPTION_MAX}
              style={[styles.input, { flex: 1 }, quiz && draft.correct === i && { borderColor: colors.success }]}
            />
            {draft.options.length > POLL_MIN_OPTIONS && (
              <PressableScale scaleTo={0.85} onPress={() => removeOption(i)} hitSlop={6} accessibilityLabel={`Remove option ${i + 1}`}>
                <Ionicons name="close-circle" size={22} color={colors.stageMuted} />
              </PressableScale>
            )}
          </Animated.View>
        ))}
        {draft.options.length < POLL_MAX_OPTIONS && (
          <PressableScale scaleTo={0.97} onPress={() => set({ options: [...draft.options, ''] })} style={styles.addOption}>
            <Ionicons name="add" size={18} color={colors.stageText} />
            <Text variant="small" color={colors.stageText}>Add an option</Text>
          </PressableScale>
        )}
        {quiz && draft.correct === null && (
          <Text variant="small" color="#F5B85C">Tap the circle next to the right answer.</Text>
        )}
      </View>

      <View style={{ gap: 8 }}>
        <Text variant="label" color={colors.stageMuted}>Timer</Text>
        <View style={[styles.row, { flexWrap: 'wrap' }]}>
          {POLL_DURATIONS.map((d) => (
            <Pill key={String(d)} label={formatDuration(d)} active={draft.durationSec === d} onPress={() => set({ durationSec: d })} />
          ))}
        </View>
      </View>

      {!quiz && (
        <View style={styles.switchRow}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="bodyStrong" color={colors.stageText}>Show results while it’s open</Text>
            <Text variant="small" color={colors.stageMuted}>When off, students see results only when you end it.</Text>
          </View>
          <Switch
            value={draft.showLive}
            onValueChange={(showLive) => set({ showLive })}
            trackColor={{ false: colors.stageLine, true: colors.primary + '88' }}
            thumbColor={draft.showLive ? colors.primary : '#fff'}
          />
        </View>
      )}
    </View>
  );
}

/* ---------- The live card: answering, and the results ---------- */

function OptionRow({ text, index, view, mine, onPress, showCount }: {
  text: string;
  index: number;
  view: PollView;
  mine: boolean;
  onPress?: () => void;
  showCount: boolean;
}) {
  const total = view.counts?.reduce((a, b) => a + b, 0) ?? 0;
  const count = view.counts?.[index] ?? 0;
  const pct = total ? Math.round((count / total) * 100) : 0;
  const right = view.correct === index;
  const revealed = view.correct !== null;
  const wrongPick = revealed && mine && !right && view.phase === 'ended';
  const tint = right && revealed ? colors.success : wrongPick ? colors.danger : mine ? colors.primary : colors.stageLine;
  const names = view.voters?.[index] ?? [];

  const body = (
    <View style={[styles.option, { borderColor: tint }, mine && !revealed && { backgroundColor: colors.primary + '22' }]}>
      {view.counts && (
        <View style={[StyleSheet.absoluteFill, { right: undefined, width: `${pct}%`, backgroundColor: (right && revealed ? colors.success : colors.primary) + '33' }]} />
      )}
      <View style={styles.optionTop}>
        <Ionicons
          name={right && revealed ? 'checkmark-circle' : wrongPick ? 'close-circle' : mine ? 'radio-button-on' : 'radio-button-off'}
          size={20}
          color={right && revealed ? colors.success : wrongPick ? colors.danger : mine ? colors.primary : colors.stageMuted}
        />
        <Text color={colors.stageText} style={{ flex: 1 }}>{text}</Text>
        {view.counts && showCount && (
          <Text variant="small" color={colors.stageText} style={{ fontFamily: fonts.semibold }}>{pct}% · {count}</Text>
        )}
      </View>
      {names.length > 0 && (
        <Text variant="small" color={colors.stageMuted} numberOfLines={2} style={{ marginLeft: 30 }}>{names.join(', ')}</Text>
      )}
    </View>
  );
  return onPress ? <PressableScale scaleTo={0.98} onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: mine }}>{body}</PressableScale> : body;
}

function PollCard({ polls, isTeacher, studentCount }: { polls: Polls; isTeacher: boolean; studentCount: number }) {
  const view = polls.view!;
  const open = view.phase === 'open';
  const now = useNow(open && view.deadline !== null);
  const left = view.deadline === null ? null : Math.max(0, Math.ceil((view.deadline - now) / 1000));
  const closing = open && left === 0;
  const canVote = !isTeacher && open && !closing;
  const quiz = view.poll.kind === 'quiz';
  const mine = polls.myChoice;

  let feedback: { icon: keyof typeof Ionicons.glyphMap; text: string; tint: string } | null = null;
  if (!isTeacher && !open && quiz && view.correct !== null) {
    feedback = mine === null
      ? { icon: 'remove-circle', text: `You didn’t answer. The right answer was “${view.poll.options[view.correct]}”.`, tint: colors.stageMuted }
      : mine === view.correct
        ? { icon: 'trophy', text: 'Correct! Well done.', tint: colors.success }
        : { icon: 'close-circle', text: `Not quite. The right answer was “${view.poll.options[view.correct]}”.`, tint: colors.danger };
  }

  return (
    <View style={{ gap: 14 }}>
      <View style={styles.row}>
        <View style={[styles.kind, { backgroundColor: quiz ? '#3A2E14' : '#24234A' }]}>
          <Ionicons name={quiz ? 'school' : 'stats-chart'} size={12} color={quiz ? '#F5B85C' : '#B9B5FF'} />
          <Text variant="small" color={quiz ? '#F5B85C' : '#B9B5FF'} style={{ fontFamily: fonts.semibold }}>{quiz ? 'Quiz' : 'Poll'}</Text>
        </View>
        <View style={{ flex: 1 }} />
        {open ? (
          left !== null ? (
            <View style={[styles.kind, { backgroundColor: left <= 10 ? colors.danger + '33' : colors.stageLine }]}>
              <Ionicons name="timer-outline" size={13} color={left <= 10 ? colors.danger : colors.stageText} />
              <Text variant="small" color={left <= 10 ? colors.danger : colors.stageText} style={{ fontFamily: fonts.semibold }}>{formatClock(left)}</Text>
            </View>
          ) : (
            <Text variant="small" color={colors.success} style={{ fontFamily: fonts.semibold }}>Open</Text>
          )
        ) : (
          <Text variant="small" color={colors.stageMuted} style={{ fontFamily: fonts.semibold }}>Ended</Text>
        )}
      </View>

      <Text variant="heading" color={colors.stageText}>{view.poll.question}</Text>

      <View style={{ gap: 8 }} accessibilityRole="radiogroup">
        {view.poll.options.map((o, i) => (
          <OptionRow
            key={i}
            text={o}
            index={i}
            view={view}
            mine={!isTeacher && mine === i}
            onPress={canVote ? () => polls.vote(i) : undefined}
            showCount={isTeacher || !open || view.poll.showLive}
          />
        ))}
      </View>

      {feedback ? (
        <Animated.View entering={FadeIn} style={[styles.feedback, { borderColor: feedback.tint }]}>
          <Ionicons name={feedback.icon} size={20} color={feedback.tint} />
          <Text variant="bodyStrong" color={colors.stageText} style={{ flex: 1 }}>{feedback.text}</Text>
        </Animated.View>
      ) : (
        <Text variant="small" color={colors.stageMuted}>
          {isTeacher
            ? `${view.answered} of ${studentCount} ${studentCount === 1 ? 'student' : 'students'} answered`
            : open
              ? mine === null
                ? closing ? 'Time’s up.' : 'Tap an answer. You can change it until the poll closes.'
                : 'Answer sent. You can change it until the poll closes.'
              : `${view.answered} ${view.answered === 1 ? 'person' : 'people'} answered`}
          {isTeacher && quiz && open ? ' · only you can see the right answer' : ''}
        </Text>
      )}
    </View>
  );
}

/* ---------- The sheet ---------- */

export function PollPanel({ polls, isTeacher, studentCount }: { polls: Polls; isTeacher: boolean; studentCount: number }) {
  const insets = useSafeAreaInsets();
  const composing = polls.composing;
  const view = polls.view;
  const ready = !!cleanDraft(polls.draft);

  const title = composing ? 'New poll or quiz' : view?.phase === 'ended' ? 'Results' : view?.poll.kind === 'quiz' ? 'Quiz' : 'Poll';
  const subtitle = composing ? 'Students answer from their screen' : isTeacher ? 'Only you see who picked what' : `From your teacher`;

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View entering={FadeIn} exiting={FadeOut} style={[StyleSheet.absoluteFill, styles.backdrop]}>
        <Pressable style={{ flex: 1 }} onPress={polls.hide} accessibilityLabel="Close polls" />
      </Animated.View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.avoider} pointerEvents="box-none">
        <Animated.View entering={SlideInDown.duration(250)} exiting={SlideOutDown.duration(200)} style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text variant="heading" color={colors.stageText}>{title}</Text>
              <Text variant="small" color={colors.stageMuted}>{subtitle}</Text>
            </View>
            <IconButton icon="close" size={38} color={colors.stageText} bg={colors.stageCard} onPress={polls.hide} />
          </View>

          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {composing ? (
              <Composer draft={polls.draft} onChange={polls.setDraft} />
            ) : view ? (
              <PollCard polls={polls} isTeacher={isTeacher} studentCount={studentCount} />
            ) : (
              <View style={styles.empty}>
                <Ionicons name="stats-chart-outline" size={30} color={colors.stageMuted} />
                <Text color={colors.stageMuted} style={{ textAlign: 'center' }}>No poll right now.</Text>
              </View>
            )}
          </ScrollView>

          {isTeacher && (
            <View style={styles.footer}>
              {composing ? (
                <>
                  {view && (
                    <PressableScale scaleTo={0.97} onPress={polls.cancelCompose} style={[styles.action, styles.secondary]}>
                      <Text variant="bodyStrong" color={colors.stageText}>Back</Text>
                    </PressableScale>
                  )}
                  {!view && polls.draft.question.length > 0 && (
                    <PressableScale scaleTo={0.97} onPress={() => polls.setDraft(emptyDraft(polls.draft.kind))} style={[styles.action, styles.secondary]}>
                      <Text variant="bodyStrong" color={colors.stageText}>Clear</Text>
                    </PressableScale>
                  )}
                  <PressableScale scaleTo={0.97} disabled={!ready} onPress={polls.start} style={[styles.action, { flex: 1 }, !ready && { opacity: 0.45 }]}>
                    <Ionicons name="send" size={16} color="#fff" />
                    <Text variant="bodyStrong" color="#fff">{polls.draft.kind === 'quiz' ? 'Start quiz' : 'Start poll'}</Text>
                  </PressableScale>
                </>
              ) : view?.phase === 'open' ? (
                <PressableScale scaleTo={0.97} onPress={polls.end} style={[styles.action, { flex: 1 }]}>
                  <Ionicons name="flag" size={16} color="#fff" />
                  <Text variant="bodyStrong" color="#fff">{view.poll.kind === 'quiz' ? 'End and reveal the answer' : 'End and show results'}</Text>
                </PressableScale>
              ) : (
                <>
                  <PressableScale scaleTo={0.97} onPress={polls.clear} style={[styles.action, styles.secondary]}>
                    <Text variant="bodyStrong" color={colors.stageText}>Close for all</Text>
                  </PressableScale>
                  <PressableScale scaleTo={0.97} onPress={polls.compose} style={[styles.action, { flex: 1 }]}>
                    <Ionicons name="add" size={18} color="#fff" />
                    <Text variant="bodyStrong" color="#fff">New poll</Text>
                  </PressableScale>
                </>
              )}
            </View>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.55)' },
  avoider: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '88%', backgroundColor: SHEET_BG, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    borderWidth: 1, borderColor: colors.stageLine, borderBottomWidth: 0,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.stageLine },
  body: { padding: 20, paddingBottom: 16 },
  empty: { alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 32 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill,
    backgroundColor: colors.stageCard, borderWidth: 1, borderColor: colors.stageLine,
  },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  input: {
    minHeight: 46, borderRadius: radius.md, backgroundColor: colors.stageCard, color: colors.stageText, borderWidth: 1, borderColor: colors.stageLine,
    paddingHorizontal: 14, paddingVertical: 12, fontFamily: fonts.medium, fontSize: 15, textAlignVertical: 'top',
  },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  addOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: radius.md,
    borderWidth: 1, borderStyle: 'dashed', borderColor: colors.stageLine,
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  kind: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  option: { borderRadius: radius.md, borderWidth: 1.5, backgroundColor: colors.stageCard, paddingHorizontal: 14, paddingVertical: 12, gap: 4, overflow: 'hidden' },
  optionTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  feedback: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.md, borderWidth: 1, backgroundColor: colors.stageCard },
  footer: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.stageLine },
  action: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: radius.md, backgroundColor: colors.primary, paddingHorizontal: 18 },
  secondary: { backgroundColor: colors.stageLine },
});
