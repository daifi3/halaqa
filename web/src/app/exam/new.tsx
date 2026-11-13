import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { blankQuestion, QuestionEditor, questionProblem } from '@/components/exam/question-editor';
import { Button } from '@/components/ui/button';
import { ChoiceRow } from '@/components/ui/choice';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { delay, IconButton, ToggleRow } from '@/components/ui/misc';
import { Pressable } from '@/components/ui/pressable';
import { ModalScreen, Section } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { alert } from '@/lib/dialog';
import { DEFAULT_SCALE, formatPoints, GRADE_SCALES } from '@/lib/exam';
import { MAX_QUESTIONS, parseExamCsv, type ImportedExam } from '@/lib/exam-csv';
import { downloadExamTemplate, readCsvFile } from '@/lib/exports';
import { pickFile } from '@/lib/files';
import { useBack } from '@/lib/navigation';
import type { ExamQuestion } from '@/lib/types';
import { useLeaveGuard } from '@/lib/use-leave-guard';
import { useQuery } from '@/lib/use-query';
import { useMe } from '@/store/session';
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

export default function NewExam() {
  const [params] = useSearchParams();
  const paramCourse = params.get('courseId');
  const me = useMe();
  const navigate = useNavigate();
  const back = useBack('/exams');
  const days = useMemo(() => nextDays(14), []);
  const { data: allCourses } = useQuery(() => api.listCourses());
  const courses = useMemo(() => allCourses?.filter((c) => c.teacher.id === me.id) ?? [], [allCourses, me.id]);

  const [pickedCourse, setPickedCourse] = useState<string | null>(paramCourse);
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

  const points = questions.reduce((s, q) => s + q.points, 0);
  const gradeScale = scaleChoice || Number(customScale);
  const scaleValid = Number.isInteger(gradeScale) && gradeScale >= 1 && gradeScale <= 1000;
  const problems = questions.filter((q) => questionProblem(q)).length;
  const dirty = title.trim().length > 0 || questions.some((q) => q.prompt.trim().length > 0);
  const lockedCourse = !!paramCourse;
  const course = courses.find((c) => c.id === courseId) ?? allCourses?.find((c) => c.id === courseId);

  useLeaveGuard(dirty && !publishedId, (proceed, stay) => {
    alert('Discard this exam?', 'Your questions will be lost.', [
      { text: 'Keep editing', style: 'cancel', onPress: stay },
      { text: 'Discard', style: 'destructive', onPress: proceed },
    ]);
  });

  // Navigate once the publish has committed, so the discard guard is already off.
  useEffect(() => {
    if (publishedId) navigate(`/exam/${publishedId}`, { replace: true });
  }, [publishedId, navigate]);

  // A window shorter than the exam would cut every attempt short.
  const windowOptions = WINDOWS.filter((w) => w.value * 60 >= durationMin);
  const effectiveWindow = windowOptions.some((w) => w.value === windowHours) ? windowHours : windowOptions[0]!.value;

  function updateQuestion(i: number, q: ExamQuestion) {
    setQuestions((qs) => qs.map((x, j) => (j === i ? q : x)));
  }

  function addQuestion() {
    setQuestions((qs) => [...qs, blankQuestion(uid(), qs.at(-1)?.kind)]);
    setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 150);
  }

  function applyImport(imported: ImportedExam, mode: 'replace' | 'add') {
    const kept = mode === 'add' ? questions.filter((q) => q.prompt.trim()) : [];
    if (kept.length + imported.questions.length > MAX_QUESTIONS) {
      alert('Too many questions', `An exam can have at most ${MAX_QUESTIONS} questions.`);
      return;
    }
    if (imported.title && (mode === 'replace' || !title.trim())) setTitle(imported.title);
    if (imported.instructions && (mode === 'replace' || !instructions.trim())) setInstructions(imported.instructions);
    setQuestions([...kept, ...imported.questions]);
    const n = imported.questions.length;
    alert('Exam imported', `${n} ${n === 1 ? 'question' : 'questions'} added. Review them, set the timing, then publish.`);
  }

  async function importCsv() {
    const file = await pickFile('.csv,text/csv,text/plain');
    if (!file) return;
    setImporting(true);
    try {
      const result = parseExamCsv(await readCsvFile(file), uid);
      if (!result.ok) {
        const more = result.errors.length > 6 ? `\n…and ${result.errors.length - 6} more` : '';
        alert('Couldn’t import this file', result.errors.slice(0, 6).join('\n') + more);
        return;
      }
      if (!questions.some((q) => q.prompt.trim())) return applyImport(result.exam, 'replace');
      alert('You already have questions', 'Replace them with the file’s questions, or add the file’s after yours?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Add', onPress: () => applyImport(result.exam, 'add') },
        { text: 'Replace', style: 'destructive', onPress: () => applyImport(result.exam, 'replace') },
      ]);
    } catch (e) {
      alert('Couldn’t import', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setImporting(false);
    }
  }

  function templateHelp() {
    alert(
      'Import from a spreadsheet',
      'Fill in the template in Excel or Google Sheets and save it as CSV.\n\n'
        + '• One row per question: type (choice, truefalse or written), the question, options A–F, the correct answer and points.\n'
        + '• Correct answer: a letter (A–F) for choice, True or False for truefalse, empty for written.\n'
        + '• Optional rows of type title and instructions fill in the exam details.',
      [
        { text: 'Close', style: 'cancel' },
        { text: 'Download template', onPress: () => void downloadExamTemplate() },
      ],
    );
  }

  async function publish() {
    setTriedPublish(true);
    if (!course || title.trim().length < 3 || problems > 0 || !scaleValid) return;
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
      setPublishedId(exam.id);
    } catch (e) {
      alert('Couldn’t publish', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setPublishing(false);
    }
  }

  return (
    <ModalScreen
      title="New exam"
      onClose={back}
      footer={
        <>
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
        </>
      }
    >
      <div className="h a-down" style={{ gap: 10 }}>
        <Button title="Import exam" variant="secondary" icon="cloud-upload-outline" loading={importing} onPress={importCsv} style={{ flex: 1 }} />
        <IconButton icon="help-circle-outline" color={colors.primary} size={54} onPress={templateHelp} label="How to import" />
      </div>

      <Section title="Course">
        {lockedCourse || courses.length <= 1 ? (
          <div className="h" style={{ gap: 8, backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: 14 }}>
            <Icon name="library-outline" size={16} color={colors.primary} />
            <Text variant="bodyStrong" color={colors.primary} className="flex1">
              {course?.title ?? (allCourses ? 'Create a course first' : 'Loading…')}
            </Text>
          </div>
        ) : (
          <ChoiceRow wrap options={courses.map((c) => ({ value: c.id, label: c.title }))} value={courseId ?? ''} onChange={setPickedCourse} />
        )}
      </Section>

      <Section title="Details" delayMs={40}>
        <Input
          value={title}
          onChangeText={setTitle}
          placeholder="Exam title, e.g. Midterm: trees & graphs"
          icon="ribbon-outline"
          error={triedPublish && title.trim().length < 3 ? 'Give the exam a title' : null}
        />
        <Input value={instructions} onChangeText={setInstructions} placeholder="Instructions for students (optional)" icon="document-text-outline" multiline />
      </Section>

      <Section title="Time limit" hint="The countdown starts when a student begins." delayMs={80}>
        <ChoiceRow options={DURATIONS.map((d) => ({ value: d, label: `${d}`, sub: 'min' }))} value={durationMin} onChange={setDurationMin} />
      </Section>

      <Section title="Opens" delayMs={120}>
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

      <Section title="Stays open for" hint="Students must start before it closes." delayMs={160}>
        <ChoiceRow wrap options={windowOptions} value={effectiveWindow} onChange={setWindowHours} />
      </Section>

      <Section
        title="Grading"
        hint={scaleValid ? `Questions add up to ${formatPoints(points)}; the final grade is converted to /${gradeScale}.` : 'Choose what the final grade is out of.'}
        delayMs={180}
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
            inputMode="numeric"
            maxLength={4}
            error={triedPublish && !scaleValid ? 'Enter a whole number between 1 and 1000' : null}
          />
        )}
      </Section>

      <div className="a-down" style={{ ...delay(200), backgroundColor: colors.surface, borderRadius: radius.lg, padding: '0 16px' }}>
        <ToggleRow
          icon="stats-chart-outline"
          title="Show score after submitting"
          body="Students see their result and the correct answers."
          value={showResults}
          onChange={setShowResults}
        />
      </div>

      <Section wide title={`Questions · ${questions.length}`} hint={formatPoints(points) + ' in total'} delayMs={240}>
        <div className="v" style={{ gap: 14 }}>
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
        </div>
        <Pressable scaleTo={0.97} onClick={addQuestion}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 54, width: '100%', borderRadius: radius.lg, border: `1.5px dashed ${colors.primary}` }}>
          <Icon name="add-circle-outline" size={20} color={colors.primary} />
          <Text variant="bodyStrong" color={colors.primary}>Add question</Text>
        </Pressable>
      </Section>
    </ModalScreen>
  );
}
