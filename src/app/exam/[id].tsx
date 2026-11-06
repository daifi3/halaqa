import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { prepareExamLockdown } from '@/components/exam/use-exam-lockdown';
import { Button } from '@/components/ui/button';
import { Avatar, Chip, EmptyState, IconButton, Skeleton } from '@/components/ui/misc';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { attemptDeadline, examWindow, FINISH_LABEL, formatGrade, formatPoints, QUESTION_KINDS, scaleOf, scoreAttempt } from '@/lib/exam';
import { exportGrades } from '@/lib/export-grades';
import { formatDay, formatTime } from '@/lib/format';
import type { Exam, ExamAttempt } from '@/lib/types';
import { useQuery } from '@/lib/use-query';
import { useSession } from '@/store/session';
import { colors, radius, shadow } from '@/theme';

const when = (iso: string) => `${formatDay(iso)} at ${formatTime(iso)}`;

function Tile({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.tile}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text variant="heading">{value}</Text>
      <Text variant="small" color={colors.muted}>{label}</Text>
    </View>
  );
}

function ScoreChip({ exam, attempt }: { exam: Exam; attempt: ExamAttempt }) {
  const { grade, scale, ungraded } = scoreAttempt(exam, attempt);
  if (ungraded) return <Chip label="To grade" icon="create-outline" color={colors.student} bg={colors.studentSoft} />;
  return <Chip label={`${formatGrade(grade)}/${scale}`} color={colors.success} bg={colors.successSoft} />;
}

/* ---------- Teacher ---------- */

function TeacherView({ exam, attempts }: { exam: Exam; attempts: ExamAttempt[] }) {
  const finished = attempts.filter((a) => a.finish);
  const graded = finished.map((a) => scoreAttempt(exam, a)).filter((s) => !s.ungraded);
  const average = graded.length ? graded.reduce((s, x) => s + x.grade, 0) / graded.length : null;
  const toGrade = finished.length - graded.length;
  const [exporting, setExporting] = useState(false);

  async function runExport() {
    setExporting(true);
    try {
      await exportGrades(exam, attempts);
    } catch (e) {
      Alert.alert('Couldn’t export', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setExporting(false);
    }
  }

  function exportPdf() {
    if (!toGrade) return void runExport();
    Alert.alert(
      'Some grades aren’t final',
      `${toGrade} ${toGrade === 1 ? 'student has' : 'students have'} written answers still to grade. They’ll show as “To grade” in the PDF.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Export anyway', onPress: () => void runExport() },
      ],
    );
  }

  function confirmDelete() {
    Alert.alert('Delete this exam?', 'All student attempts and results are deleted too. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          api.deleteExam(exam.id)
            .then(() => router.back())
            .catch((e) => Alert.alert('Couldn’t delete', e instanceof Error ? e.message : 'Please try again.'));
        },
      },
    ]);
  }

  return (
    <>
      <Animated.View entering={FadeInDown.delay(140)} style={styles.summary}>
        <View style={styles.summaryStat}>
          <Text variant="title">{finished.length}</Text>
          <Text variant="small" color={colors.muted}>Submitted</Text>
        </View>
        <View style={styles.summaryStat}>
          <Text variant="title">{average === null ? '—' : `${formatGrade(average)}/${scaleOf(exam)}`}</Text>
          <Text variant="small" color={colors.muted}>Average</Text>
        </View>
        <View style={styles.summaryStat}>
          <Text variant="title" color={toGrade ? colors.student : colors.ink}>{toGrade}</Text>
          <Text variant="small" color={colors.muted}>To grade</Text>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(170)}>
        <Button
          title="Export grades (PDF)"
          variant="secondary"
          icon="document-text-outline"
          loading={exporting}
          disabled={finished.length === 0}
          onPress={exportPdf}
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(200)} style={{ gap: 10 }}>
        <Text variant="label" color={colors.muted}>Results</Text>
        {finished.length === 0 ? (
          <Text color={colors.muted}>No one has submitted yet.</Text>
        ) : (
          finished.map((a) => (
            <PressableScale key={a.id} scaleTo={0.98} onPress={() => router.push(`/exam/attempt/${a.id}` as Href)} style={styles.row}>
              <Avatar name={a.student.name} size={36} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodyStrong" numberOfLines={1}>{a.student.name}</Text>
                <Text variant="small" color={a.finish === 'submitted' ? colors.muted : colors.student}>
                  {FINISH_LABEL[a.finish!]} · {formatDay(a.finishedAt!)}
                </Text>
              </View>
              <ScoreChip exam={exam} attempt={a} />
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </PressableScale>
          ))
        )}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(260)} style={{ gap: 10 }}>
        <Text variant="label" color={colors.muted}>Questions</Text>
        {exam.questions.map((q, i) => (
          <View key={q.id} style={styles.question}>
            <View style={styles.questionHead}>
              <Text variant="small" color={colors.muted}>Q{i + 1} · {QUESTION_KINDS[q.kind].label}</Text>
              <Text variant="small" color={colors.muted}>{formatPoints(q.points)}</Text>
            </View>
            <Text variant="bodyStrong">{q.prompt}</Text>
            {q.correct !== null && (
              <View style={styles.answerLine}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Text variant="small" color={colors.success} style={{ flex: 1 }}>{q.options[q.correct]}</Text>
              </View>
            )}
          </View>
        ))}
      </Animated.View>

      <Button title="Delete exam" variant="ghost" icon="trash-outline" onPress={confirmDelete} />
    </>
  );
}

/* ---------- Student ---------- */

function Rule({ icon, children }: { icon: keyof typeof Ionicons.glyphMap; children: string }) {
  return (
    <View style={styles.rule}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text color={colors.inkSoft} style={{ flex: 1 }}>{children}</Text>
    </View>
  );
}

function StudentView({ exam, attempt }: { exam: Exam; attempt: ExamAttempt | null | undefined }) {
  const [now] = useState(() => Date.now());
  const window = examWindow(exam, now);
  // Starting late in the window leaves less than the full duration.
  const availableMin = Math.floor((attemptDeadline(exam, { startedAt: new Date(now).toISOString() }) - now) / 60_000);
  const [preparing, setPreparing] = useState(false);

  async function launch() {
    setPreparing(true);
    try {
      // The server starts the clock and enforces the window and the single attempt.
      await api.startExam(exam.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.push(`/exam/take/${exam.id}` as Href);
    } catch (e) {
      Alert.alert('Can’t start', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setPreparing(false);
    }
  }

  // Lock down before the timer starts: Android's pinning prompt briefly takes focus
  // from the app, which during the exam would count as leaving it.
  async function secureAndLaunch() {
    setPreparing(true);
    const pinned = await prepareExamLockdown();
    setPreparing(false);
    if (pinned || Platform.OS !== 'android') return launch();
    Alert.alert(
      'App pinning is off',
      'Pinning keeps you inside Halaqa during the exam. Without it you can still take the exam, but switching to another app submits your answers immediately.',
      [
        { text: 'Try again', onPress: () => void secureAndLaunch() },
        { text: 'Start anyway', style: 'destructive', onPress: () => void launch() },
      ],
    );
  }

  function begin() {
    Alert.alert(
      'Start the exam?',
      `The ${availableMin}-minute timer starts now and can't be paused. You'll stay locked in the exam until you submit or time runs out.`,
      [
        { text: 'Not yet', style: 'cancel' },
        { text: 'Start', onPress: () => void secureAndLaunch() },
      ],
    );
  }

  if (attempt) {
    const { earned, total, ungraded, grade, scale } = scoreAttempt(exam, attempt);
    return (
      <Animated.View entering={FadeInDown.delay(140)} style={{ gap: 14 }}>
        <View style={styles.resultCard}>
          <View style={styles.resultIcon}>
            <Ionicons name={attempt.finish ? 'checkmark-done' : 'hourglass-outline'} size={26} color="#fff" />
          </View>
          {attempt.finish && exam.showResults ? (
            <>
              <Text variant="display" color="#fff">{formatGrade(grade)}<Text variant="title" color="rgba(255,255,255,0.6)"> / {scale}</Text></Text>
              <Text color="rgba(255,255,255,0.75)">
                {ungraded
                  ? `${ungraded} written ${ungraded === 1 ? 'answer is' : 'answers are'} still being graded`
                  : `Final grade · ${earned} of ${formatPoints(total)}`}
              </Text>
            </>
          ) : (
            <Text variant="heading" color="#fff" style={{ textAlign: 'center' }}>
              {attempt.finish ? 'Your answers were submitted' : 'Attempt in progress'}
            </Text>
          )}
          <Text variant="small" color="rgba(255,255,255,0.6)">
            {attempt.finish ? `${FINISH_LABEL[attempt.finish]} · ${when(attempt.finishedAt!)}` : 'This attempt can’t be reopened'}
          </Text>
        </View>
        {attempt.finish && exam.showResults ? (
          <Button title="Review my answers" variant="secondary" icon="eye-outline" onPress={() => router.push(`/exam/attempt/${attempt.id}` as Href)} />
        ) : attempt.finish ? (
          <Text color={colors.muted} style={{ textAlign: 'center' }}>Your teacher will share the results.</Text>
        ) : null}
      </Animated.View>
    );
  }

  return (
    <>
      <Animated.View entering={FadeInDown.delay(140)} style={styles.rules}>
        <Text variant="label" color={colors.muted}>Before you start</Text>
        <Rule icon="timer-outline">{`You have ${availableMin} minutes from the moment you start. The timer can’t be paused.`}</Rule>
        <Rule icon="lock-closed-outline">One attempt only. You can’t go back or leave until you submit or time runs out.</Rule>
        <Rule icon="phone-portrait-outline">Halaqa pins itself to the screen. Switching apps submits your answers. Screenshots and copy/paste are blocked.</Rule>
        <Rule icon="list-outline">You can move between questions and review all your answers before submitting.</Rule>
        <Rule icon="flash-outline">When time runs out, your answers are submitted automatically.</Rule>
      </Animated.View>

      <View style={{ gap: 8 }}>
        {window === 'open' ? (
          <>
            <Button title="Start exam" icon="play" accent={colors.student} loading={preparing} onPress={begin} />
            {availableMin < exam.durationMin && (
              <Text variant="small" color={colors.student} style={{ textAlign: 'center' }}>
                The exam closes {when(exam.closesAt)}, so you’ll have {availableMin} of {exam.durationMin} minutes.
              </Text>
            )}
          </>
        ) : window === 'upcoming' ? (
          <Button title={`Opens ${when(exam.opensAt)}`} variant="secondary" icon="calendar-outline" disabled />
        ) : (
          <Button title="This exam has closed" variant="secondary" icon="lock-closed-outline" disabled />
        )}
      </View>
    </>
  );
}

/* ---------- Screen ---------- */

export default function ExamDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useSession((s) => s.user)!;
  // Reloads every time the screen gains focus (see useQuery).
  const { data, loading, error } = useQuery(async () => {
    let exam = await api.getExam(id);
    const owner = exam.teacher.id === me.id;
    const attempts = owner ? await api.listExamAttempts(id) : [];
    // Arriving here with an attempt still running means the student left the exam
    // some other way (the app was closed or killed) — end it so it can't be resumed.
    if (!owner && exam.myAttempt && !exam.myAttempt.finish) {
      await api.finishExamAttempt(exam.myAttempt.id, 'left');
      exam = await api.getExam(id);
    }
    return { exam, owner, attempts };
  });
  const exam = data?.exam;
  const owner = !!data?.owner;

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={{ padding: 20, gap: 14 }}><Skeleton height={140} /><Skeleton height={90} /></View>
      </SafeAreaView>
    );
  }

  if (!exam) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={styles.header}><IconButton icon="chevron-back" onPress={() => router.back()} /></View>
        <EmptyState icon="alert-circle-outline" title="Exam unavailable" body={error ?? 'This exam no longer exists.'} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <IconButton icon="chevron-back" onPress={() => router.back()} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Animated.View entering={FadeInUp} style={{ gap: 8 }}>
          <Text variant="label" color={colors.primary}>{exam.courseTitle}</Text>
          <Text variant="display">{exam.title}</Text>
          {!!exam.instructions && <Text color={colors.inkSoft}>{exam.instructions}</Text>}
          <View style={styles.windowRow}>
            <Ionicons name="calendar-outline" size={16} color={colors.muted} />
            <Text variant="small" color={colors.muted} style={{ flex: 1 }}>
              {when(exam.opensAt)} → {when(exam.closesAt)}
            </Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80)} style={styles.tiles}>
          <Tile icon="help-circle-outline" label="Questions" value={String(exam.questionCount)} />
          <Tile icon="timer-outline" label="Minutes" value={String(exam.durationMin)} />
          <Tile icon="trophy-outline" label="Grade out of" value={`/${scaleOf(exam)}`} />
        </Animated.View>

        {owner ? (
          <TeacherView exam={exam} attempts={data?.attempts ?? []} />
        ) : me.role === 'student' ? (
          <StudentView exam={exam} attempt={exam.myAttempt} />
        ) : (
          <Text color={colors.muted} style={{ textAlign: 'center' }}>Only students can take exams. Results are visible to {exam.teacher.name}.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 8 },
  content: { padding: 20, gap: 24, paddingBottom: 40 },
  windowRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  tiles: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, gap: 4, ...shadow.card },
  summary: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.lg, paddingVertical: 16, ...shadow.card },
  summaryStat: { flex: 1, alignItems: 'center', gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 12 },
  question: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, gap: 6 },
  questionHead: { flexDirection: 'row', justifyContent: 'space-between' },
  answerLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rules: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, gap: 14, ...shadow.card },
  rule: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  resultCard: { backgroundColor: colors.ink, borderRadius: radius.xl, padding: 24, alignItems: 'center', gap: 6 },
  resultIcon: {
    width: 52, height: 52, borderRadius: 18, backgroundColor: colors.success,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
});
