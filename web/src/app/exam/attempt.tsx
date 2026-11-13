import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { ChoiceRow } from '@/components/ui/choice';
import { Icon } from '@/components/ui/icon';
import { Chip, delay, EmptyState, PersonAvatar, Skeleton } from '@/components/ui/misc';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { alert } from '@/lib/dialog';
import { FINISH_LABEL, formatGrade, formatPoints, gradingStatus, isAnswered, questionScore, scoreAttempt } from '@/lib/exam';
import { formatDay, formatDuration, formatTime } from '@/lib/format';
import type { Exam, ExamAttempt, ExamQuestion } from '@/lib/types';
import { useQuery } from '@/lib/use-query';
import { useMe } from '@/store/session';
import { colors, radius } from '@/theme';

const LETTERS = 'ABCDEF';

function OptionLine({ label, text, tone }: { label: string; text: string; tone: 'correct' | 'wrong' | 'neutral' }) {
  const color = tone === 'correct' ? colors.success : tone === 'wrong' ? colors.danger : colors.inkSoft;
  const bg = tone === 'correct' ? colors.successSoft : tone === 'wrong' ? colors.dangerSoft : colors.bg;
  const icon = tone === 'correct' ? 'checkmark-circle' : tone === 'wrong' ? 'close-circle' : null;
  return (
    <div className="h" style={{ gap: 10, padding: 10, borderRadius: radius.md, backgroundColor: bg }}>
      <Text variant="small" color={color} style={{ fontWeight: 700, width: 18 }}>{label}</Text>
      <Text variant="small" color={color} className="flex1">{text}</Text>
      {icon && <Icon name={icon} size={16} color={color} />}
    </div>
  );
}

function AnswerCard({ question: q, index, attempt, canGrade, teacher, onGrade }: {
  question: ExamQuestion; index: number; attempt: ExamAttempt; canGrade: boolean; teacher: boolean;
  onGrade: (questionId: string, points: number) => void;
}) {
  const answer = attempt.answers[q.id];
  const score = questionScore(q, attempt);
  const answered = isAnswered(answer);

  return (
    <div className="v a-down" style={{ ...delay(60 + index * 40), backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, gap: 12, boxShadow: 'var(--shadow-card)' }}>
      <div className="h" style={{ justifyContent: 'space-between' }}>
        <Text variant="small" color={colors.muted}>Question {index + 1}</Text>
        {score === null ? (
          <Chip label={`? / ${q.points}`} icon="create-outline" color={colors.student} bg={colors.studentSoft} />
        ) : (
          <Chip
            label={`${score} / ${q.points}`}
            color={score === q.points ? colors.success : score === 0 ? colors.danger : colors.inkSoft}
            bg={score === q.points ? colors.successSoft : score === 0 ? colors.dangerSoft : colors.surfaceAlt}
          />
        )}
      </div>
      <Text variant="bodyStrong" className="pre">{q.prompt}</Text>

      {q.kind === 'written' ? (
        <>
          <div style={{ backgroundColor: colors.bg, borderRadius: radius.md, padding: 12 }}>
            <Text color={answered ? colors.inkSoft : colors.muted} className="pre">{answered ? String(answer) : 'No answer given'}</Text>
          </div>
          {canGrade && answered && (
            <div className="v" style={{ gap: 8 }}>
              <Text variant="small" color={colors.muted}>Award points</Text>
              <ChoiceRow
                wrap
                options={Array.from({ length: q.points + 1 }, (_, p) => ({ value: p, label: String(p) }))}
                value={attempt.writtenGrades[q.id] ?? -1}
                accent={colors.success}
                onChange={(p) => onGrade(q.id, p)}
              />
            </div>
          )}
        </>
      ) : (
        <div className="v" style={{ gap: 6 }}>
          {q.options.map((option, i) => {
            const chosen = answer === i;
            const correct = q.correct === i;
            return (
              <OptionLine
                key={i}
                label={q.kind === 'truefalse' ? option[0]! : LETTERS[i]!}
                text={chosen ? `${option}  ·  ${teacher ? 'their answer' : 'your answer'}` : option}
                tone={correct ? 'correct' : chosen ? 'wrong' : 'neutral'}
              />
            );
          })}
          {!answered && <Text variant="small" color={colors.danger}>Not answered</Text>}
        </div>
      )}
    </div>
  );
}

/** Teacher: what's left before the grade can be released, and the button that releases it. */
function FinalizeCard({ exam, attempt, next, onChange }: {
  exam: Exam; attempt: ExamAttempt; next: ExamAttempt | undefined; onChange: (a: ExamAttempt) => void;
}) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const status = gradingStatus(exam, attempt);
  const { ungraded, grade, scale } = scoreAttempt(exam, attempt);
  const first = attempt.student.name.split(' ')[0];

  function run(call: Promise<ExamAttempt>, failTitle: string) {
    setBusy(true);
    call.then(onChange)
      .catch((e) => alert(failTitle, e instanceof Error ? e.message : 'Please try again.'))
      .finally(() => setBusy(false));
  }

  function reopen() {
    alert('Reopen this grade?', `You can change the points, then finalize again. ${first} keeps seeing ${formatGrade(grade)}/${scale} until then.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reopen', onPress: () => run(api.reopenExamAttempt(attempt.id), 'Couldn’t reopen') },
    ]);
  }

  const tone = status === 'final' ? colors.success : status === 'ready' ? colors.primary : colors.student;
  const toneSoft = status === 'final' ? colors.successSoft : status === 'ready' ? colors.primarySoft : colors.studentSoft;

  return (
    <div className="h a-down finalize-card" style={{ ...delay(60), gap: 14, padding: 16, borderRadius: radius.lg, backgroundColor: colors.surface, boxShadow: 'var(--shadow-card)', flexWrap: 'wrap' }}>
      <span className="h center" style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: toneSoft, flexShrink: 0 }}>
        <Icon name={status === 'final' ? 'checkmark-done' : status === 'ready' ? 'ribbon-outline' : 'create-outline'} size={22} color={tone} />
      </span>
      <div className="v flex1" style={{ gap: 2, minWidth: 220 }}>
        <Text variant="bodyStrong">
          {status === 'final' ? 'Grade is final' : status === 'ready' ? 'Ready to finalize' : `${ungraded} written ${ungraded === 1 ? 'answer' : 'answers'} to grade`}
        </Text>
        <Text variant="small" color={colors.muted}>
          {status === 'final'
            ? `Released to ${first} ${formatDay(attempt.finalizedAt!)} at ${formatTime(attempt.finalizedAt!)}.`
            : status === 'ready'
              ? `${first} gets ${formatGrade(grade)}/${scale}. Finalizing shows it to them and sends a notification.`
              : 'Award points to each written answer below, then finalize the grade.'}
        </Text>
      </div>
      <div className="h" style={{ gap: 8, flexWrap: 'wrap' }}>
        {status === 'final' ? (
          <Button size="md" variant="secondary" icon="lock-open-outline" title="Reopen" loading={busy} onPress={reopen} />
        ) : (
          <Button size="md" icon="checkmark-done" accent={colors.success} title="Finalize grade" loading={busy} disabled={status !== 'ready'}
            onPress={() => run(api.finalizeExamAttempt(attempt.id), 'Couldn’t finalize')} />
        )}
        {next && (
          <Button size="md" variant={status === 'final' ? 'primary' : 'secondary'} icon="arrow-forward" title={`Next: ${next.student.name.split(' ')[0]}`}
            onPress={() => navigate(`/exam/attempt/${next.id}`, { replace: true })} />
        )}
      </div>
    </div>
  );
}

export default function AttemptDetails() {
  const { id = '' } = useParams();
  const me = useMe();
  const { data, loading, setData } = useQuery(async () => {
    const attempt = await api.getExamAttempt(id);
    const exam = await api.getExam(attempt.examId);
    // The teacher moves on to the next student whose grade isn't final.
    const others = exam.teacher.id === me.id ? await api.listExamAttempts(exam.id).catch(() => []) : [];
    return { attempt, exam, others };
  }, [id]);
  const attempt = data?.attempt;
  const exam = data?.exam;

  const owner = !!exam && exam.teacher.id === me.id;
  const mine = attempt?.student.id === me.id;
  const next = exam && attempt
    ? (data?.others ?? [])
      .filter((a) => a.id !== attempt.id && a.finish && gradingStatus(exam, a) !== 'final')
      .sort((a, b) => +new Date(a.finishedAt!) - +new Date(b.finishedAt!))[0]
    : undefined;
  const visible = !!exam && !!attempt?.finish && (owner || (mine && exam.showResults));

  // Saved on the server, which checks the points are within the question's range.
  function saveGrade(questionId: string, points: number) {
    if (!attempt) return;
    api.gradeExamAnswer(attempt.id, questionId, points)
      .then((updated) => setData((d) => d && { ...d, attempt: updated }))
      .catch((e) => alert('Couldn’t save the grade', e instanceof Error ? e.message : 'Please try again.'));
  }

  if (loading) {
    return <Screen><div className="v" style={{ gap: 14 }}><Skeleton height={120} /><Skeleton height={160} /></div></Screen>;
  }

  if (!exam || !attempt || !visible) {
    return <Screen><EmptyState icon="lock-closed-outline" title="Results unavailable" body="These results aren't available to you." /></Screen>;
  }

  const { earned, total, ungraded, grade, scale } = scoreAttempt(exam, attempt);
  const tookSec = (+new Date(attempt.finishedAt!) - +new Date(attempt.startedAt)) / 1000;

  return (
    <Screen style={{ gap: 16, paddingBottom: 40 }}>
      <div className="v a-up" style={{ gap: 8 }}>
        <Text variant="label" color={colors.primary}>{exam.title}</Text>
        <div className="h" style={{ gap: 12 }}>
          <PersonAvatar person={attempt.student} size={44} />
          <div className="v flex1">
            <Text variant="title">{owner ? attempt.student.name : 'Your answers'}</Text>
            <Text variant="small" color={colors.muted}>
              {FINISH_LABEL[attempt.finish!]} {formatDay(attempt.finishedAt!)} at {formatTime(attempt.finishedAt!)} · took {formatDuration(tookSec)}
            </Text>
          </div>
        </div>
      </div>

      <div className="h a-down" style={{ ...delay(40), backgroundColor: colors.ink, borderRadius: radius.xl, padding: 20, gap: 12 }}>
        <div className="v flex1">
          <Text variant="label" color="rgba(255,255,255,0.6)">{attempt.finalizedAt ? 'Final grade' : 'Grade · not final'}</Text>
          <Text variant="display" color="#fff">{formatGrade(grade)}<Text variant="title" color="rgba(255,255,255,0.6)"> / {scale}</Text></Text>
        </div>
        <div className="v" style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text variant="heading" color="#fff">{earned} / {formatPoints(total)}</Text>
          {ungraded > 0 && (
            <Text variant="small" color="#FFC9A8">
              {ungraded} to grade · up to {formatPoints(exam.questions.filter((q) => questionScore(q, attempt) === null).reduce((s, q) => s + q.points, 0))} more
            </Text>
          )}
        </div>
      </div>

      {owner && (
        <FinalizeCard exam={exam} attempt={attempt} next={next}
          onChange={(updated) => setData((d) => d && { ...d, attempt: updated, others: d.others.map((a) => (a.id === updated.id ? updated : a)) })} />
      )}

      <div className="cards-grid" style={{ gap: 16, alignItems: 'start' }}>
        {exam.questions.map((q, i) => (
          <AnswerCard key={q.id} question={q} index={i} attempt={attempt} canGrade={owner && !attempt.finalizedAt} teacher={owner} onGrade={saveGrade} />
        ))}
      </div>
    </Screen>
  );
}
