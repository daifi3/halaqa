import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams, usePreventRemove } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInRight, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useExamLockdown } from '@/components/exam/use-exam-lockdown';
import { Button } from '@/components/ui/button';
import { EmptyState, IconButton } from '@/components/ui/misc';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { attemptDeadline, formatPoints, isAnswered, QUESTION_KINDS } from '@/lib/exam';
import { formatClock, formatTime } from '@/lib/format';
import type { Exam, ExamAnswer, ExamAttempt, ExamQuestion } from '@/lib/types';
import { useQuery } from '@/lib/use-query';
import { colors, fonts, radius, shadow } from '@/theme';

const LETTERS = 'ABCDEF';
const WARN_AT = 5 * 60_000;
/** More characters than this arriving in one change is a paste, not typing. */
const PASTE_LIMIT = 40;
const DANGER_AT = 60_000;
/** Written answers are saved this long after the student stops typing. */
const TYPING_SAVE_MS = 700;

/* ---------- Timer ---------- */

function TimerPill({ remaining }: { remaining: number }) {
  const tone = remaining <= DANGER_AT ? colors.danger : remaining <= WARN_AT ? colors.student : colors.ink;
  const bg = remaining <= DANGER_AT ? colors.dangerSoft : remaining <= WARN_AT ? colors.studentSoft : colors.surface;
  return (
    <View style={[styles.timer, { backgroundColor: bg }]} accessibilityLabel={`Time left ${formatClock(Math.ceil(remaining / 1000))}`}>
      <Ionicons name="timer-outline" size={16} color={tone} />
      <Text variant="bodyStrong" color={tone} style={styles.timerText}>{formatClock(Math.ceil(Math.max(remaining, 0) / 1000))}</Text>
    </View>
  );
}

function ProgressBar({ value }: { value: number }) {
  const fill = useAnimatedStyle(() => ({ width: withTiming(`${Math.round(value * 100)}%`, { duration: 250 }) }));
  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, fill]} />
    </View>
  );
}

/* ---------- Answering ---------- */

function Navigator({ exam, attempt, index, flagged, onJump }: {
  exam: Exam; attempt: ExamAttempt; index: number; flagged: Set<string>; onJump: (i: number) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nav}>
      {exam.questions.map((q, i) => {
        const current = i === index;
        const answered = isAnswered(attempt.answers[q.id]);
        return (
          <PressableScale
            key={q.id}
            scaleTo={0.88}
            onPress={() => onJump(i)}
            style={[styles.navDot, answered && styles.navDotAnswered, current && styles.navDotCurrent]}
            accessibilityLabel={`Question ${i + 1}${answered ? ', answered' : ''}${flagged.has(q.id) ? ', flagged' : ''}`}
          >
            <Text variant="small" color={current ? '#fff' : answered ? colors.primary : colors.inkSoft} style={{ fontFamily: fonts.bold }}>
              {i + 1}
            </Text>
            {flagged.has(q.id) && <View style={styles.navFlag} />}
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

function QuestionView({ question: q, index, total, answer, onAnswer, flagged, onFlag }: {
  question: ExamQuestion; index: number; total: number; answer: ExamAnswer | undefined;
  onAnswer: (value: ExamAnswer | null) => void; flagged: boolean; onFlag: () => void;
}) {
  const [pasteBlocked, setPasteBlocked] = useState(false);
  const written = typeof answer === 'string' ? answer : '';

  function changeWritten(next: string) {
    // The copy/paste menu is hidden, but keyboards can still paste from their own
    // clipboard strip — refuse any large chunk that arrives at once.
    if (next.length - written.length > PASTE_LIMIT) {
      setPasteBlocked(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return;
    }
    setPasteBlocked(false);
    onAnswer(next.length ? next : null);
  }

  return (
    <Animated.View key={q.id} entering={FadeInRight.duration(220)} style={{ gap: 18 }}>
      <View style={styles.qMeta}>
        <Text variant="label" color={colors.muted}>Question {index + 1} of {total} · {formatPoints(q.points)}</Text>
        <PressableScale scaleTo={0.9} onPress={onFlag} style={[styles.flag, flagged && styles.flagOn]} hitSlop={6}>
          <Ionicons name={flagged ? 'flag' : 'flag-outline'} size={14} color={flagged ? colors.student : colors.muted} />
          <Text variant="small" color={flagged ? colors.student : colors.muted}>{flagged ? 'Flagged' : 'Flag'}</Text>
        </PressableScale>
      </View>

      <Text variant="heading" style={{ fontSize: 20, lineHeight: 28 }}>{q.prompt}</Text>

      {q.kind === 'written' ? (
        <View style={{ gap: 8 }}>
          <TextInput
            value={written}
            onChangeText={changeWritten}
            placeholder="Type your answer…"
            placeholderTextColor={colors.muted}
            selectionColor={colors.primary}
            contextMenuHidden
            autoCorrect={false}
            multiline
            style={styles.written}
          />
          {pasteBlocked ? (
            <Text variant="small" color={colors.danger}>Pasting is disabled during the exam — type your answer.</Text>
          ) : (
            <Text variant="small" color={colors.muted}>{QUESTION_KINDS.written.label} answer · graded by your teacher</Text>
          )}
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {q.options.map((option, i) => {
            const selected = answer === i;
            return (
              <PressableScale
                key={i}
                scaleTo={0.98}
                onPress={() => onAnswer(i)}
                style={[styles.option, selected && styles.optionOn]}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <View style={[styles.letter, selected && styles.letterOn]}>
                  <Text variant="small" color={selected ? '#fff' : colors.inkSoft} style={{ fontFamily: fonts.bold }}>
                    {q.kind === 'truefalse' ? option[0] : LETTERS[i]}
                  </Text>
                </View>
                <Text variant="bodyStrong" style={{ flex: 1 }}>{option}</Text>
                {selected && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
              </PressableScale>
            );
          })}
          {typeof answer === 'number' && (
            <PressableScale scaleTo={0.95} onPress={() => onAnswer(null)} style={{ alignSelf: 'flex-start', paddingVertical: 4 }}>
              <Text variant="small" color={colors.muted}>Clear my answer</Text>
            </PressableScale>
          )}
        </View>
      )}
    </Animated.View>
  );
}

/* ---------- Review ---------- */

function answerSummary(q: ExamQuestion, answer: ExamAnswer | undefined) {
  if (!isAnswered(answer)) return null;
  if (typeof answer === 'number') return `${q.kind === 'truefalse' ? '' : `${LETTERS[answer]}. `}${q.options[answer]}`;
  return String(answer).trim();
}

function ReviewView({ exam, attempt, flagged, onOpen }: {
  exam: Exam; attempt: ExamAttempt; flagged: Set<string>; onOpen: (i: number) => void;
}) {
  const unanswered = exam.questions.filter((q) => !isAnswered(attempt.answers[q.id])).length;
  return (
    <Animated.View entering={FadeIn.duration(200)} style={{ gap: 14 }}>
      <View style={{ gap: 4 }}>
        <Text variant="title">Review your answers</Text>
        <Text color={colors.muted}>Tap a question to change your answer. Nothing is final until you submit.</Text>
      </View>

      <View style={styles.reviewStats}>
        <View style={styles.reviewStat}>
          <Text variant="heading">{exam.questions.length - unanswered}</Text>
          <Text variant="small" color={colors.muted}>Answered</Text>
        </View>
        <View style={styles.reviewStat}>
          <Text variant="heading" color={unanswered ? colors.danger : colors.ink}>{unanswered}</Text>
          <Text variant="small" color={colors.muted}>Unanswered</Text>
        </View>
        <View style={styles.reviewStat}>
          <Text variant="heading" color={flagged.size ? colors.student : colors.ink}>{flagged.size}</Text>
          <Text variant="small" color={colors.muted}>Flagged</Text>
        </View>
      </View>

      {exam.questions.map((q, i) => {
        const summary = answerSummary(q, attempt.answers[q.id]);
        return (
          <Animated.View key={q.id} entering={FadeInDown.delay(i * 30)}>
            <PressableScale scaleTo={0.98} onPress={() => onOpen(i)} style={[styles.reviewRow, !summary && styles.reviewRowMissing]}>
              <View style={[styles.reviewNum, summary ? styles.reviewNumDone : null]}>
                <Text variant="small" color={summary ? colors.primary : colors.danger} style={{ fontFamily: fonts.bold }}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text variant="bodyStrong" numberOfLines={2}>{q.prompt}</Text>
                {summary ? (
                  <Text variant="small" color={colors.inkSoft} numberOfLines={2}>{summary}</Text>
                ) : (
                  <Text variant="small" color={colors.danger}>Not answered</Text>
                )}
              </View>
              {flagged.has(q.id) && <Ionicons name="flag" size={16} color={colors.student} />}
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </PressableScale>
          </Animated.View>
        );
      })}
    </Animated.View>
  );
}

/* ---------- Finished ---------- */

function FinishedView({ exam, attempt }: { exam: Exam; attempt: ExamAttempt }) {
  const answered = exam.questions.filter((q) => isAnswered(attempt.answers[q.id])).length;
  const timeUp = attempt.finish === 'time_up';
  const left = attempt.finish === 'left';
  const tone = left ? colors.danger : timeUp ? colors.student : colors.success;
  return (
    <View style={styles.finished}>
      <Animated.View entering={FadeInDown} style={[styles.finishedIcon, { backgroundColor: tone }]}>
        <Ionicons name={left ? 'exit-outline' : timeUp ? 'alarm-outline' : 'checkmark-done'} size={34} color="#fff" />
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(80)} style={{ gap: 8, alignItems: 'center' }}>
        <Text variant="title" style={{ textAlign: 'center' }}>{left ? 'You left the exam' : timeUp ? 'Time’s up' : 'Exam submitted'}</Text>
        <Text color={colors.muted} style={{ textAlign: 'center', maxWidth: 300 }}>
          {left
            ? 'You switched away from Halaqa, so your answers were submitted automatically'
            : timeUp ? 'Your answers were submitted automatically' : 'Your answers were submitted'} at {formatTime(attempt.finishedAt!)}.
          {' '}You answered {answered} of {exam.questions.length} questions.
        </Text>
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(160)} style={{ alignSelf: 'stretch' }}>
        <Button title="Done" onPress={() => router.back()} />
      </Animated.View>
    </View>
  );
}

/* ---------- Screen ---------- */

export default function TakeExam() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // The exam as the server shows a student who has started: questions, no answer key.
  const { data, loading } = useQuery(() => api.getExam(id));
  const exam = data;
  // Answers update here instantly; the server copy follows (see `answer`).
  const [local, setLocal] = useState<ExamAttempt | null>(null);
  const attempt = local ?? data?.myAttempt ?? null;
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
  const typing = useRef(new Map<string, { timer: ReturnType<typeof setTimeout>; value: ExamAnswer | null }>());
  const finishing = useRef(false);

  const [index, setIndex] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const [flagged, setFlagged] = useState<Set<string>>(() => new Set());
  const [now, setNow] = useState(() => Date.now());
  const warned = useRef({ warn: false, danger: false });
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const live = !!exam && !!attempt && !attempt.finish;
  // The server's deadline — the phone's clock can't extend it.
  const deadline = attempt?.deadline ? +new Date(attempt.deadline) : exam && attempt ? attemptDeadline(exam, attempt) : 0;
  const remaining = deadline - now;

  /** Sends one answer. If the server has already closed the attempt, show how it ended. */
  async function persist(attemptId: string, questionId: string, value: ExamAnswer | null) {
    setSaveState('saving');
    try {
      const saved = await api.saveExamAnswer(attemptId, questionId, value);
      if (saved.finish) setLocal(saved);
      setSaveState('saved');
    } catch {
      setSaveState('error');
      const fresh = await api.getExamAttempt(attemptId).catch(() => null);
      if (fresh?.finish) setLocal(fresh);
    }
  }

  function answer(question: ExamQuestion, value: ExamAnswer | null) {
    if (!attempt || attempt.finish) return;
    const answers = { ...attempt.answers };
    if (value === null) delete answers[question.id];
    else answers[question.id] = value;
    setLocal({ ...attempt, answers });

    const pending = typing.current.get(question.id);
    if (pending) clearTimeout(pending.timer);
    if (question.kind !== 'written') {
      typing.current.delete(question.id);
      void persist(attempt.id, question.id, value);
      return;
    }
    const timer = setTimeout(() => {
      typing.current.delete(question.id);
      void persist(attempt.id, question.id, value);
    }, TYPING_SAVE_MS);
    typing.current.set(question.id, { timer, value });
  }

  /** Saves any written answer still waiting for the typing pause. */
  async function flushTyping(attemptId: string) {
    const pending = [...typing.current.entries()];
    typing.current.clear();
    pending.forEach(([, p]) => clearTimeout(p.timer));
    await Promise.all(pending.map(([qid, p]) => persist(attemptId, qid, p.value)));
  }

  /** Ends the attempt on the server — after the last answers are in. */
  async function finish(reason: 'submitted' | 'left') {
    if (!attempt || attempt.finish || finishing.current) return;
    finishing.current = true;
    try {
      await flushTyping(attempt.id);
      setLocal(await api.finishExamAttempt(attempt.id, reason));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) {
      Alert.alert('Couldn’t submit', e instanceof Error ? e.message : 'Check your connection and try again.');
    } finally {
      finishing.current = false;
    }
  }

  // The ticking timer reads the latest deadline and finish() through a ref.
  const latest = useRef({ deadline, finish });
  useEffect(() => {
    latest.current = { deadline, finish };
  });

  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => {
      const tick = Date.now();
      setNow(tick);
      // Time's up: hand in what's there. The server records it as time_up, and its
      // 15 s grace lets the last answers land.
      if (tick >= latest.current.deadline) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        void latest.current.finish('submitted');
      }
    }, 1000);
    return () => clearInterval(t);
  }, [live]);

  // Warn at 5 minutes and at 1 minute left.
  useEffect(() => {
    if (!live) return;
    if (remaining <= DANGER_AT && !warned.current.danger) {
      warned.current.danger = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    } else if (remaining <= WARN_AT && !warned.current.warn) {
      warned.current.warn = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }
  }, [live, remaining]);

  // Screenshots blocked, app pinned, and switching away submits the exam.
  const { pinned } = useExamLockdown(live, () => void finish('left'));

  // No way back out while the exam runs: the only exits are submitting or the timer.
  usePreventRemove(live, () => {
    Alert.alert('You can’t leave during the exam', 'Submit your answers to finish, or keep going until the timer runs out.');
  });

  function go(i: number) {
    setReviewing(false);
    setIndex(i);
    scroll.current?.scrollTo({ y: 0, animated: false });
  }

  function toggleFlag(questionId: string) {
    setFlagged((f) => {
      const next = new Set(f);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  }

  function confirmSubmit() {
    if (!exam || !attempt) return;
    const unanswered = exam.questions.filter((q) => !isAnswered(attempt.answers[q.id])).length;
    Alert.alert(
      'Submit your exam?',
      unanswered
        ? `You left ${unanswered} ${unanswered === 1 ? 'question' : 'questions'} unanswered. You can’t change anything after submitting.`
        : 'You can’t change your answers after submitting.',
      [
        { text: 'Keep reviewing', style: 'cancel' },
        {
          text: 'Submit',
          onPress: () => void finish('submitted'),
        },
      ],
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} edges={['top', 'bottom']}>
        <Text color={colors.muted}>Loading your exam…</Text>
      </SafeAreaView>
    );
  }

  if (!exam || !attempt) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={styles.header}><IconButton icon="close" onPress={() => router.back()} /></View>
        <EmptyState icon="alert-circle-outline" title="No exam in progress" body="Start the exam from its page to take it." />
      </SafeAreaView>
    );
  }

  if (attempt.finish) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <FinishedView exam={exam} attempt={attempt} />
      </SafeAreaView>
    );
  }

  const question = exam.questions[index]!;
  const answeredCount = exam.questions.filter((q) => isAnswered(attempt.answers[q.id])).length;
  const last = index === exam.questions.length - 1;

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.lockBadge} accessibilityLabel="Exam mode is on">
          <Ionicons name="lock-closed" size={18} color={colors.ink} />
        </View>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text variant="bodyStrong" numberOfLines={1}>{exam.title}</Text>
          <Text variant="small" color={saveState === 'error' ? colors.danger : colors.muted}>
            {saveState === 'error' ? 'Not saved — check your connection'
              : saveState === 'saving' ? 'Saving…'
                : `${answeredCount} of ${exam.questions.length} answered`}
          </Text>
        </View>
        <TimerPill remaining={remaining} />
      </View>

      <View style={{ paddingHorizontal: 20, gap: 12 }}>
        <ProgressBar value={answeredCount / exam.questions.length} />
        {!reviewing && <Navigator exam={exam} attempt={attempt} index={index} flagged={flagged} onJump={go} />}
      </View>

      {pinned === false && (
        <View style={styles.pinWarning}>
          <Ionicons name="warning-outline" size={16} color={colors.danger} />
          <Text variant="small" color={colors.danger} style={{ flex: 1 }}>
            App pinning is off. Leaving Halaqa now submits your exam.
          </Text>
        </View>
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {reviewing ? (
            <ReviewView exam={exam} attempt={attempt} flagged={flagged} onOpen={go} />
          ) : (
            <QuestionView
              question={question}
              index={index}
              total={exam.questions.length}
              answer={attempt.answers[question.id]}
              onAnswer={(value) => answer(question, value)}
              flagged={flagged.has(question.id)}
              onFlag={() => toggleFlag(question.id)}
            />
          )}
        </ScrollView>

        <View style={styles.footer}>
          {reviewing ? (
            <>
              <Button title="Questions" variant="secondary" icon="arrow-back" onPress={() => go(index)} style={{ flex: 1 }} />
              <Button title="Submit exam" icon="checkmark-done" accent={colors.success} onPress={confirmSubmit} style={{ flex: 1.4 }} />
            </>
          ) : (
            <>
              <Button title="Previous" variant="secondary" icon="chevron-back" disabled={index === 0} onPress={() => go(index - 1)} style={{ flex: 1 }} />
              {last ? (
                <Button title="Review answers" icon="list" onPress={() => setReviewing(true)} style={{ flex: 1.4 }} />
              ) : (
                <Button title="Next" onPress={() => go(index + 1)} style={{ flex: 1.4 }} />
              )}
            </>
          )}
        </View>
        {!reviewing && !last && (
          <PressableScale scaleTo={0.96} onPress={() => setReviewing(true)} style={styles.reviewLink}>
            <Text variant="small" color={colors.primary}>Review all answers</Text>
          </PressableScale>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  lockBadge: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  pinWarning: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginTop: 10,
    padding: 10, borderRadius: radius.md, backgroundColor: colors.dangerSoft,
  },
  timer: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 40,
    borderRadius: radius.pill, minWidth: 92, justifyContent: 'center', ...shadow.card,
  },
  timerText: { fontVariant: ['tabular-nums'] },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
  nav: { gap: 8, paddingRight: 20 },
  navDot: {
    width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.line,
  },
  navDotAnswered: { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft },
  navDotCurrent: { backgroundColor: colors.ink, borderColor: colors.ink },
  navFlag: { position: 'absolute', top: -1, right: -1, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.student, borderWidth: 2, borderColor: colors.bg },
  content: { padding: 20, paddingBottom: 32 },
  qMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  flag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.surface },
  flagOn: { backgroundColor: colors.studentSoft },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, minHeight: 60,
    borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.line,
  },
  optionOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  letter: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  letterOn: { backgroundColor: colors.primary },
  written: {
    minHeight: 180, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.line,
    padding: 16, fontFamily: fonts.medium, fontSize: 16, lineHeight: 24, color: colors.ink, textAlignVertical: 'top',
  },
  reviewStats: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.lg, paddingVertical: 14, ...shadow.card },
  reviewStat: { flex: 1, alignItems: 'center', gap: 2 },
  reviewRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: 14, borderWidth: 1.5, borderColor: 'transparent',
  },
  reviewRowMissing: { borderColor: colors.dangerSoft },
  reviewNum: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.dangerSoft, alignItems: 'center', justifyContent: 'center' },
  reviewNumDone: { backgroundColor: colors.primarySoft },
  footer: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8, borderTopWidth: 1, borderTopColor: colors.line },
  reviewLink: { alignSelf: 'center', paddingVertical: 10 },
  finished: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, padding: 28 },
  finishedIcon: { width: 76, height: 76, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
});
