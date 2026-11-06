import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams, usePreventRemove, type Href } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { blankQuestion, QuestionEditor, questionProblem } from '@/components/exam/question-editor';
import { Button } from '@/components/ui/button';
import { ChoiceRow } from '@/components/ui/choice';
import { Input } from '@/components/ui/input';
import { IconButton, ToggleRow } from '@/components/ui/misc';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { DEFAULT_SCALE, formatPoints, GRADE_SCALES } from '@/lib/exam';
import { MAX_QUESTIONS, parseExamCsv, type ImportedExam } from '@/lib/exam-csv';
import { pickCsvFile, shareExamTemplate } from '@/lib/exam-csv-file';
import type { ExamQuestion } from '@/lib/types';
import { useQuery } from '@/lib/use-query';
import { useSession } from '@/store/session';
import { colors, radius } from '@/theme';

const uid = () => Math.random().toString(36).slice(2, 10);

const DURATIONS = [10, 15, 20, 30, 45, 60, 90, 120];
const HOURS = [8, 10, 12, 14, 16, 18, 20];
const WINDOWS = [
  { value: 1, label: '1 hour' },
  { value: 3, label: '3 hours' },
  { value: 24, label: '1 day' },
  { value: 72, label: '3 days' },
  { value: 168, label: '1 week' },
];

function nextDays(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function Section({ title, hint, children, delay }: { title: string; hint?: string; children: React.ReactNode; delay: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay)} style={{ gap: 12 }}>
      <View style={{ gap: 2 }}>
        <Text variant="label" color={colors.muted}>{title}</Text>
        {hint && <Text variant="small" color={colors.muted}>{hint}</Text>}
      </View>
      {children}
    </Animated.View>
  );
}

export default function NewExam() {
  const params = useLocalSearchParams<{ courseId?: string }>();
  const me = useSession((s) => s.user)!;
  const days = useMemo(() => nextDays(14), []);
  const { data: allCourses } = useQuery(() => api.listCourses());
  const courses = useMemo(() => allCourses?.filter((c) => c.teacher.id === me.id) ?? [], [allCourses, me.id]);

  const [pickedCourse, setPickedCourse] = useState<string | null>(params.courseId ?? null);
  const courseId = pickedCourse ?? courses[0]?.id ?? null;
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [durationMin, setDurationMin] = useState(30);
  const [openDay, setOpenDay] = useState<number>(-1); // -1 = right away, else index into `days`
  const [openHour, setOpenHour] = useState(10);
  const [windowHours, setWindowHours] = useState(24);
  const [showResults, setShowResults] = useState(true);
  const [scaleChoice, setScaleChoice] = useState<number>(DEFAULT_SCALE); // 0 = custom
  const [customScale, setCustomScale] = useState('');
  const [questions, setQuestions] = useState<ExamQuestion[]>(() => [blankQuestion(uid())]);
  const [triedPublish, setTriedPublish] = useState(false);
  const [publishedId, setPublishedId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [importing, setImporting] = useState(false);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const points = questions.reduce((s, q) => s + q.points, 0);
  const gradeScale = scaleChoice || Number(customScale);
  const scaleValid = Number.isInteger(gradeScale) && gradeScale >= 1 && gradeScale <= 1000;
  const problems = questions.filter((q) => questionProblem(q)).length;
  const dirty = title.trim().length > 0 || questions.some((q) => q.prompt.trim().length > 0);
  const lockedCourse = !!params.courseId;
  const course = courses.find((c) => c.id === courseId) ?? allCourses?.find((c) => c.id === courseId);

  usePreventRemove(dirty && !publishedId, ({ repeat }) => {
    Alert.alert('Discard this exam?', 'Your questions will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: repeat },
    ]);
  });

  // Navigate once the publish has committed, so the discard guard is already off.
  useEffect(() => {
    if (publishedId) router.replace(`/exam/${publishedId}` as Href);
  }, [publishedId]);

  // A window shorter than the exam would cut every attempt short.
  const windowOptions = WINDOWS.filter((w) => w.value * 60 >= durationMin);
  const effectiveWindow = windowOptions.some((w) => w.value === windowHours) ? windowHours : windowOptions[0]!.value;

  function updateQuestion(i: number, q: ExamQuestion) {
    setQuestions((qs) => qs.map((x, j) => (j === i ? q : x)));
  }

  function addQuestion() {
    setQuestions((qs) => [...qs, blankQuestion(uid(), qs.at(-1)?.kind)]);
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 150);
  }

  function applyImport(imported: ImportedExam, mode: 'replace' | 'add') {
    const kept = mode === 'add' ? questions.filter((q) => q.prompt.trim()) : [];
    if (kept.length + imported.questions.length > MAX_QUESTIONS) {
      Alert.alert('Too many questions', `An exam can have at most ${MAX_QUESTIONS} questions.`);
      return;
    }
    if (imported.title && (mode === 'replace' || !title.trim())) setTitle(imported.title);
    if (imported.instructions && (mode === 'replace' || !instructions.trim())) setInstructions(imported.instructions);
    setQuestions([...kept, ...imported.questions]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const n = imported.questions.length;
    Alert.alert('Exam imported', `${n} ${n === 1 ? 'question' : 'questions'} added. Review them, set the timing, then publish.`);
  }

  async function importCsv() {
    setImporting(true);
    try {
      const bytes = await pickCsvFile();
      if (!bytes) return;
      const result = parseExamCsv(bytes, uid);
      if (!result.ok) {
        const more = result.errors.length > 6 ? `\n…and ${result.errors.length - 6} more` : '';
        Alert.alert('Couldn’t import this file', result.errors.slice(0, 6).join('\n') + more);
        return;
      }
      if (!questions.some((q) => q.prompt.trim())) return applyImport(result.exam, 'replace');
      Alert.alert('You already have questions', 'Replace them with the file’s questions, or add the file’s after yours?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Add', onPress: () => applyImport(result.exam, 'add') },
        { text: 'Replace', style: 'destructive', onPress: () => applyImport(result.exam, 'replace') },
      ]);
    } catch (e) {
      Alert.alert('Couldn’t import', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setImporting(false);
    }
  }

  function templateHelp() {
    Alert.alert(
      'Import from a spreadsheet',
      'Fill in the template in Excel or Google Sheets and save it as CSV.\n\n'
        + '• One row per question: type (choice, truefalse or written), the question, options A–F, the correct answer and points.\n'
        + '• Correct answer: a letter (A–F) for choice, True or False for truefalse, empty for written.\n'
        + '• Optional rows of type title and instructions fill in the exam details.',
      [
        { text: 'Close', style: 'cancel' },
        {
          text: 'Download template',
          onPress: () => {
            shareExamTemplate().catch((e) => Alert.alert('Couldn’t save the template', e instanceof Error ? e.message : 'Please try again.'));
          },
        },
      ],
    );
  }

  async function publish() {
    setTriedPublish(true);
    if (!course || title.trim().length < 3 || problems > 0 || !scaleValid) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return;
    }
    const opens = openDay < 0 ? new Date() : new Date(days[openDay]!);
    if (openDay >= 0) opens.setHours(openHour, 0, 0, 0);
    const closes = new Date(opens.getTime() + effectiveWindow * 3600_000);

    setPublishing(true);
    try {
      const exam = await api.createExam(course.id, {
        title: title.trim(), instructions: instructions.trim(),
        durationMin, opensAt: opens.toISOString(), closesAt: closes.toISOString(), showResults, gradeScale,
        questions: questions.map((q) => ({ ...q, prompt: q.prompt.trim(), options: q.options.map((o) => o.trim()) })),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setPublishedId(exam.id);
    } catch (e) {
      Alert.alert('Couldn’t publish', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setPublishing(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text variant="title">New exam</Text>
        <IconButton icon="close" onPress={() => router.back()} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Animated.View entering={FadeInDown} style={styles.importRow}>
            <Button
              title="Import exam"
              variant="secondary"
              icon="cloud-upload-outline"
              loading={importing}
              onPress={importCsv}
              style={{ flex: 1 }}
            />
            <IconButton icon="help-circle-outline" color={colors.primary} size={54} onPress={templateHelp} />
          </Animated.View>

          <Section title="Course" delay={0}>
            {lockedCourse || courses.length <= 1 ? (
              <View style={styles.courseBanner}>
                <Ionicons name="library-outline" size={16} color={colors.primary} />
                <Text variant="bodyStrong" color={colors.primary} style={{ flex: 1 }}>
                  {course?.title ?? (allCourses ? 'Create a course first' : 'Loading…')}
                </Text>
              </View>
            ) : (
              <ChoiceRow wrap options={courses.map((c) => ({ value: c.id, label: c.title }))} value={courseId ?? ''} onChange={setPickedCourse} />
            )}
          </Section>

          <Section title="Details" delay={40}>
            <Input
              value={title}
              onChangeText={setTitle}
              placeholder="Exam title, e.g. Midterm: trees & graphs"
              icon="ribbon-outline"
              error={triedPublish && title.trim().length < 3 ? 'Give the exam a title' : null}
            />
            <Input
              value={instructions}
              onChangeText={setInstructions}
              placeholder="Instructions for students (optional)"
              icon="document-text-outline"
              multiline
              style={{ minHeight: 80, textAlignVertical: 'top', paddingTop: 14 }}
            />
          </Section>

          <Section title="Time limit" hint="The countdown starts when a student begins." delay={80}>
            <ChoiceRow options={DURATIONS.map((d) => ({ value: d, label: `${d}`, sub: 'min' }))} value={durationMin} onChange={setDurationMin} />
          </Section>

          <Section title="Opens" delay={120}>
            <ChoiceRow
              options={[
                { value: -1, label: 'Now', sub: 'Start' },
                ...days.map((d, i) => ({ value: i, label: String(d.getDate()), sub: d.toLocaleDateString(undefined, { weekday: 'short' }) })),
              ]}
              value={openDay}
              onChange={setOpenDay}
            />
            {openDay >= 0 && (
              <ChoiceRow options={HOURS.map((h) => ({ value: h, label: `${String(h).padStart(2, '0')}:00` }))} value={openHour} onChange={setOpenHour} />
            )}
          </Section>

          <Section title="Stays open for" hint="Students must start before it closes." delay={160}>
            <ChoiceRow wrap options={windowOptions} value={effectiveWindow} onChange={setWindowHours} />
          </Section>

          <Section
            title="Grading"
            hint={scaleValid
              ? `Questions add up to ${formatPoints(points)}; the final grade is converted to /${gradeScale}.`
              : 'Choose what the final grade is out of.'}
            delay={180}
          >
            <ChoiceRow
              wrap
              options={[...GRADE_SCALES.map((s) => ({ value: s, label: `/ ${s}` })), { value: 0, label: 'Custom' }]}
              value={scaleChoice}
              onChange={setScaleChoice}
            />
            {scaleChoice === 0 && (
              <Input
                value={customScale}
                onChangeText={(t) => setCustomScale(t.replace(/[^0-9]/g, ''))}
                placeholder="Grade out of, e.g. 40"
                icon="calculator-outline"
                keyboardType="number-pad"
                maxLength={4}
                error={triedPublish && !scaleValid ? 'Enter a whole number between 1 and 1000' : null}
              />
            )}
          </Section>

          <Animated.View entering={FadeInDown.delay(200)} style={styles.toggleCard}>
            <ToggleRow
              icon="stats-chart-outline"
              title="Show score after submitting"
              body="Students see their result and the correct answers."
              value={showResults}
              onChange={setShowResults}
            />
          </Animated.View>

          <Section title={`Questions · ${questions.length}`} hint={formatPoints(points) + ' in total'} delay={240}>
            {questions.map((q, i) => (
              <QuestionEditor
                key={q.id}
                index={i}
                question={q}
                onChange={(next) => updateQuestion(i, next)}
                onRemove={() => setQuestions((qs) => qs.filter((x) => x.id !== q.id))}
                canRemove={questions.length > 1}
                showError={triedPublish}
              />
            ))}
            <PressableScale scaleTo={0.97} onPress={addQuestion} style={styles.addQuestion}>
              <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
              <Text variant="bodyStrong" color={colors.primary}>Add question</Text>
            </PressableScale>
          </Section>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        {triedPublish && problems > 0 && (
          <Text variant="small" color={colors.danger} style={{ textAlign: 'center' }}>
            {problems === 1 ? '1 question needs attention' : `${problems} questions need attention`}
          </Text>
        )}
        <Button
          title={`Publish exam · ${questions.length} ${questions.length === 1 ? 'question' : 'questions'}`}
          icon="paper-plane-outline"
          disabled={!course}
          loading={publishing}
          onPress={publish}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  content: { padding: 20, gap: 28, paddingBottom: 40 },
  importRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  courseBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: 14 },
  toggleCard: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: 16 },
  addQuestion: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 54,
    borderRadius: radius.lg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.primary,
  },
  footer: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8, gap: 8, borderTopWidth: 1, borderTopColor: colors.line },
});
