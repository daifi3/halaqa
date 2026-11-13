import { useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { Chip, delay, EmptyState, PersonAvatar, Skeleton } from '@/components/ui/misc';
import { Pressable } from '@/components/ui/pressable';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { alert } from '@/lib/dialog';
import { ChoiceRow } from '@/components/ui/choice';
import {
  attemptDeadline, examWindow, FINISH_LABEL, formatGrade, formatPoints, gradingStatus, QUESTION_KINDS, scaleOf, scoreAttempt,
  type GradingStatus,
} from '@/lib/exam';
import { enterExamFullscreen } from '@/lib/exam-lockdown';
import { exportGrades } from '@/lib/exports';
import { formatDay, formatTime } from '@/lib/format';
import { useBack } from '@/lib/navigation';
import type { Exam, ExamAttempt } from '@/lib/types';
import { useQuery } from '@/lib/use-query';
import { useMe } from '@/store/session';
import { colors, radius } from '@/theme';

const when = (iso: string) => `${formatDay(iso)} at ${formatTime(iso)}`;

function Tile({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <div className="v flex1" style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, gap: 4, boxShadow: 'var(--shadow-card)' }}>
      <Icon name={icon} size={18} color={colors.primary} />
      <Text variant="heading">{value}</Text>
      <Text variant="small" color={colors.muted}>{label}</Text>
    </div>
  );
}

function ScoreChip({ exam, attempt }: { exam: Exam; attempt: ExamAttempt }) {
  const { grade, scale, ungraded } = scoreAttempt(exam, attempt);
  if (ungraded) return <Chip label={`${ungraded} to grade`} icon="create-outline" color={colors.student} bg={colors.studentSoft} />;
  if (!attempt.finalizedAt) return <Chip label={`${formatGrade(grade)}/${scale} · not final`} icon="hourglass-outline" color={colors.primary} bg={colors.primarySoft} />;
  return <Chip label={`${formatGrade(grade)}/${scale}`} icon="checkmark-circle" color={colors.success} bg={colors.successSoft} />;
}

type Filter = 'all' | GradingStatus;

/* ---------- Teacher ---------- */

function TeacherView({ exam, attempts, onAttempts }: { exam: Exam; attempts: ExamAttempt[]; onAttempts: (a: ExamAttempt[]) => void }) {
  const navigate = useNavigate();
  const back = useBack('/exams');
  const finished = attempts.filter((a) => a.finish);
  const graded = finished.map((a) => scoreAttempt(exam, a)).filter((s) => !s.ungraded);
  const average = graded.length ? graded.reduce((s, x) => s + x.grade, 0) / graded.length : null;
  const toGrade = finished.length - graded.length;
  const statusOf = (a: ExamAttempt) => gradingStatus(exam, a);
  const count = (st: GradingStatus) => finished.filter((a) => statusOf(a) === st).length;
  const ready = count('ready');
  const final = count('final');
  // Start on what needs doing.
  const [filter, setFilter] = useState<Filter>(() => (toGrade ? 'to_grade' : ready ? 'ready' : 'all'));
  const [finalizing, setFinalizing] = useState(false);
  const shown = finished
    .filter((a) => filter === 'all' || statusOf(a) === filter)
    // Students who still need something first, then by when they finished.
    .sort((a, b) => ['to_grade', 'ready', 'final'].indexOf(statusOf(a)) - ['to_grade', 'ready', 'final'].indexOf(statusOf(b))
      || +new Date(a.finishedAt!) - +new Date(b.finishedAt!));

  function finalizeAll() {
    alert(
      `Finalize ${ready} ${ready === 1 ? 'grade' : 'grades'}?`,
      `${ready === 1 ? 'The student is' : 'Each student is'} notified and can see their grade. You can reopen a grade later to change it.`
        + (toGrade ? ` ${toGrade} ${toGrade === 1 ? 'student' : 'students'} with written answers still to grade ${toGrade === 1 ? 'is' : 'are'} skipped.` : ''),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Finalize',
          onPress: () => {
            setFinalizing(true);
            api.finalizeAllExamAttempts(exam.id)
              .then((all) => { onAttempts(all); setFilter('final'); })
              .catch((e) => alert('Couldn’t finalize', e instanceof Error ? e.message : 'Please try again.'))
              .finally(() => setFinalizing(false));
          },
        },
      ],
    );
  }

  function runExport() {
    exportGrades(exam, attempts).catch((e) => alert('Couldn’t export', e instanceof Error ? e.message : 'Please try again.'));
  }

  function exportPdf() {
    if (!toGrade) return runExport();
    alert(
      'Some grades aren’t final',
      `${toGrade} ${toGrade === 1 ? 'student has' : 'students have'} written answers still to grade. They’ll show as “To grade” in the PDF.`,
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Export anyway', onPress: runExport }],
    );
  }

  function confirmDelete() {
    alert('Delete this exam?', 'All student attempts and results are deleted too. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          api.deleteExam(exam.id).then(back).catch((e) => alert('Couldn’t delete', e instanceof Error ? e.message : 'Please try again.'));
        },
      },
    ]);
  }

  return (
    <>
      <div className="split-side">
      <div className="h a-down" style={{ ...delay(140), backgroundColor: colors.surface, borderRadius: radius.lg, padding: '16px 0', boxShadow: 'var(--shadow-card)' }}>
        {[
          { v: String(finished.length), l: 'Submitted', c: colors.ink },
          { v: average === null ? '—' : `${formatGrade(average)}/${scaleOf(exam)}`, l: 'Average', c: colors.ink },
          { v: String(toGrade), l: 'To grade', c: toGrade ? colors.student : colors.ink },
          { v: String(final), l: 'Final', c: final ? colors.success : colors.ink },
        ].map((s) => (
          <div key={s.l} className="v flex1" style={{ alignItems: 'center', gap: 2 }}>
            <Text variant="title" color={s.c}>{s.v}</Text>
            <Text variant="small" color={colors.muted}>{s.l}</Text>
          </div>
        ))}
      </div>

      <div className="v a-down" style={{ ...delay(170), gap: 10 }}>
        {ready > 0 && (
          <Button title={`Finalize ${ready} graded`} icon="checkmark-done" accent={colors.success} loading={finalizing} onPress={finalizeAll} />
        )}
        <Button title="Export grades (PDF)" variant="secondary" icon="document-text-outline" disabled={finished.length === 0} onPress={exportPdf} />
        {finished.length > 0 && (
          <Text variant="small" color={colors.muted} style={{ textAlign: 'center' }}>
            {toGrade + ready === 0
              ? 'Every grade is final.'
              : 'Students see their grade once you finalize it. They’re notified then.'}
          </Text>
        )}
      </div>
      </div>

      <div className="split-main">

      <div className="v a-down" style={{ ...delay(200), gap: 12 }}>
        <Text variant="label" color={colors.muted}>Students who submitted</Text>
        {finished.length === 0 ? (
          <Text color={colors.muted}>No one has submitted yet. You’ll get a notification when a student finishes.</Text>
        ) : (
          <>
          <ChoiceRow<Filter>
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'to_grade', label: `To grade · ${toGrade}` },
              { value: 'ready', label: `Ready to finalize · ${ready}` },
              { value: 'final', label: `Final · ${final}` },
              { value: 'all', label: `All · ${finished.length}` },
            ]}
          />
          {shown.length === 0 ? (
            <Text color={colors.muted}>
              {filter === 'to_grade' ? 'Nothing left to grade.' : filter === 'ready' ? 'No grades waiting to be finalized.' : 'No final grades yet.'}
            </Text>
          ) : (
          <div className="cards-grid" style={{ gap: 10 }}>{shown.map((a) => (
            <Pressable key={a.id} scaleTo={0.98} onClick={() => navigate(`/exam/attempt/${a.id}`)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', backgroundColor: colors.surface, borderRadius: radius.lg, padding: 12 }}>
              <PersonAvatar person={a.student} size={36} />
              <div className="v flex1" style={{ gap: 2 }}>
                <Text variant="bodyStrong" lines={1}>{a.student.name}</Text>
                <Text variant="small" color={a.finish === 'submitted' ? colors.muted : colors.student}>
                  {FINISH_LABEL[a.finish!]} · {formatDay(a.finishedAt!)}
                </Text>
              </div>
              <ScoreChip exam={exam} attempt={a} />
              <Icon name="chevron-forward" size={16} color={colors.muted} />
            </Pressable>
          ))}</div>
          )}
          </>
        )}
      </div>

      <div className="v a-down" style={{ ...delay(260), gap: 10 }}>
        <Text variant="label" color={colors.muted}>Questions</Text>
        <div className="cards-grid" style={{ gap: 10 }}>
        {exam.questions.map((q, i) => (
          <div key={q.id} className="v" style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, gap: 6 }}>
            <div className="h" style={{ justifyContent: 'space-between' }}>
              <Text variant="small" color={colors.muted}>Q{i + 1} · {QUESTION_KINDS[q.kind].label}</Text>
              <Text variant="small" color={colors.muted}>{formatPoints(q.points)}</Text>
            </div>
            <Text variant="bodyStrong">{q.prompt}</Text>
            {q.correct !== null && (
              <div className="h" style={{ gap: 6 }}>
                <Icon name="checkmark-circle" size={16} color={colors.success} />
                <Text variant="small" color={colors.success} className="flex1">{q.options[q.correct]}</Text>
              </div>
            )}
          </div>
        ))}
        </div>
      </div>

      <Button title="Delete exam" variant="ghost" icon="trash-outline" onPress={confirmDelete} />
      </div>
    </>
  );
}

/* ---------- Student ---------- */

function Rule({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <div className="h" style={{ alignItems: 'flex-start', gap: 12 }}>
      <Icon name={icon} size={18} color={colors.primary} />
      <Text color={colors.inkSoft} className="flex1">{children}</Text>
    </div>
  );
}

function StudentView({ exam, attempt }: { exam: Exam; attempt: ExamAttempt | null | undefined }) {
  const navigate = useNavigate();
  const [now] = useState(() => Date.now());
  const window = examWindow(exam, now);
  // Starting late in the window leaves less than the full duration.
  const availableMin = Math.floor((attemptDeadline(exam, { startedAt: new Date(now).toISOString() }) - now) / 60_000);
  const [preparing, setPreparing] = useState(false);

  async function launch() {
    // Full screen first: browsers only allow it straight from the click.
    enterExamFullscreen();
    setPreparing(true);
    try {
      // The server starts the clock and enforces the window and the single attempt.
      await api.startExam(exam.id);
      navigate(`/exam/take/${exam.id}`);
    } catch (e) {
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
      alert('Can’t start', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setPreparing(false);
    }
  }

  function begin() {
    alert(
      'Start the exam?',
      `The ${availableMin}-minute timer starts now and can't be paused. You'll stay in the exam until you submit or time runs out.`,
      [{ text: 'Not yet', style: 'cancel' }, { text: 'Start', onPress: () => void launch() }],
    );
  }

  if (attempt) {
    const { earned, total, ungraded, grade, scale } = scoreAttempt(exam, attempt);
    return (
      <div className="v a-down" style={{ ...delay(140), gap: 14 }}>
        <div className="v" style={{ backgroundColor: colors.ink, borderRadius: radius.xl, padding: 24, alignItems: 'center', gap: 6 }}>
          <span className="h center" style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: colors.success, marginBottom: 6 }}>
            <Icon name={attempt.finish ? 'checkmark-done' : 'hourglass-outline'} size={26} color="#fff" />
          </span>
          {attempt.finish && (exam.showResults || attempt.finalizedAt) ? (
            <>
              <Text variant="display" color="#fff">{formatGrade(grade)}<Text variant="title" color="rgba(255,255,255,0.6)"> / {scale}</Text></Text>
              <Text color="rgba(255,255,255,0.75)" style={{ textAlign: 'center' }}>
                {attempt.finalizedAt
                  ? `Final grade · ${earned} of ${formatPoints(total)}`
                  : ungraded
                    ? `${ungraded} written ${ungraded === 1 ? 'answer is' : 'answers are'} still being graded`
                    : 'Not final yet · your teacher will confirm it'}
              </Text>
            </>
          ) : (
            <Text variant="heading" color="#fff" style={{ textAlign: 'center' }}>
              {attempt.finish ? 'Your answers were submitted' : 'Attempt in progress'}
            </Text>
          )}
          <Text variant="small" color="rgba(255,255,255,0.6)">
            {attempt.finalizedAt
              ? `Graded ${when(attempt.finalizedAt)}`
              : attempt.finish ? `${FINISH_LABEL[attempt.finish]} · ${when(attempt.finishedAt!)}` : 'This attempt can’t be reopened'}
          </Text>
        </div>
        {attempt.finish && exam.showResults ? (
          <Button title="Review my answers" variant="secondary" icon="eye-outline" onPress={() => navigate(`/exam/attempt/${attempt.id}`)} />
        ) : attempt.finish && !attempt.finalizedAt ? (
          <Text color={colors.muted} style={{ textAlign: 'center' }}>You’ll get a notification when your teacher releases your grade.</Text>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <div className="v a-down" style={{ ...delay(140), backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, gap: 14, boxShadow: 'var(--shadow-card)' }}>
        <Text variant="label" color={colors.muted}>Before you start</Text>
        <Rule icon="timer-outline">{`You have ${availableMin} minutes from the moment you start. The timer can’t be paused.`}</Rule>
        <Rule icon="lock-closed-outline">One attempt only. You can’t go back or leave until you submit or time runs out.</Rule>
        <Rule icon="desktop-outline">Halaqa goes full screen. Switching to another tab or window submits your answers. Copy and paste are blocked.</Rule>
        <Rule icon="list-outline">You can move between questions and review all your answers before submitting.</Rule>
        <Rule icon="flash-outline">When time runs out, your answers are submitted automatically.</Rule>
      </div>

      <div className="v" style={{ gap: 8 }}>
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
      </div>
    </>
  );
}

/* ---------- Screen ---------- */

export default function ExamDetails() {
  const { id = '' } = useParams();
  const me = useMe();
  const { data, loading, error, setData } = useQuery(async () => {
    let exam = await api.getExam(id);
    const owner = exam.teacher.id === me.id;
    const attempts = owner ? await api.listExamAttempts(id) : [];
    // Arriving here with an attempt still running means the student left the exam
    // some other way (the tab was closed or reloaded) — end it so it can't be resumed.
    if (!owner && exam.myAttempt && !exam.myAttempt.finish) {
      await api.finishExamAttempt(exam.myAttempt.id, 'left');
      exam = await api.getExam(id);
    }
    return { exam, owner, attempts };
  }, [id]);
  const exam = data?.exam;

  return (
    <Screen style={{ gap: 24, paddingBottom: 40 }}>
      {loading ? (
        <div className="v" style={{ gap: 14 }}><Skeleton height={140} /><Skeleton height={90} /></div>
      ) : !exam ? (
        <EmptyState icon="alert-circle-outline" title="Exam unavailable" body={error ?? 'This exam no longer exists.'} />
      ) : (
        <div className="split">
          <div className="split-main">
          <div className="v a-up" style={{ gap: 8 }}>
            <Text variant="label" color={colors.primary}>{exam.courseTitle}</Text>
            <Text variant="display">{exam.title}</Text>
            {!!exam.instructions && <Text color={colors.inkSoft} className="pre">{exam.instructions}</Text>}
            <div className="h" style={{ gap: 6, marginTop: 4 }}>
              <Icon name="calendar-outline" size={16} color={colors.muted} />
              <Text variant="small" color={colors.muted} className="flex1">{when(exam.opensAt)} → {when(exam.closesAt)}</Text>
            </div>
          </div>

          <div className="h a-down" style={{ ...delay(80), gap: 10, alignItems: 'stretch' }}>
            <Tile icon="help-circle-outline" label="Questions" value={String(exam.questionCount)} />
            <Tile icon="timer-outline" label="Minutes" value={String(exam.durationMin)} />
            <Tile icon="trophy-outline" label="Grade out of" value={`/${scaleOf(exam)}`} />
          </div>
          </div>

          {data?.owner ? (
            <TeacherView exam={exam} attempts={data.attempts} onAttempts={(attempts) => setData((d) => d && { ...d, attempts })} />
          ) : me.role === 'student' ? (
            <div className="split-side"><StudentView exam={exam} attempt={exam.myAttempt} /></div>
          ) : (
            <div className="split-side">
              <Text color={colors.muted} style={{ textAlign: 'center' }}>Only students can take exams. Results are visible to {exam.teacher.name}.</Text>
            </div>
          )}
        </div>
      )}
    </Screen>
  );
}
