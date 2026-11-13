import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { delay, EmptyState, IconButton } from '@/components/ui/misc';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { alert } from '@/lib/dialog';
import { attemptDeadline, formatPoints, isAnswered, QUESTION_KINDS } from '@/lib/exam';
import { enterExamFullscreen, useExamLockdown } from '@/lib/exam-lockdown';
import { formatClock, formatTime } from '@/lib/format';
import { useBack } from '@/lib/navigation';
import type { Exam, ExamAnswer, ExamAttempt, ExamQuestion } from '@/lib/types';
import { useLeaveGuard } from '@/lib/use-leave-guard';
import { useQuery } from '@/lib/use-query';
import { colors, radius } from '@/theme';

const LETTERS = 'ABCDEF';
const WARN_AT = 5 * 60_000;
const DANGER_AT = 60_000;
/** More characters than this arriving in one change is a paste, not typing. */
const PASTE_LIMIT = 40;
/** Written answers are saved this long after the student stops typing. */
const TYPING_SAVE_MS = 700;

/* ---------- Timer ---------- */

function TimerPill({ remaining }: { remaining: number }) {
  const tone = remaining <= DANGER_AT ? colors.danger : remaining <= WARN_AT ? colors.student : colors.ink;
  const bg = remaining <= DANGER_AT ? colors.dangerSoft : remaining <= WARN_AT ? colors.studentSoft : colors.surface;
  const clock = formatClock(Math.ceil(Math.max(remaining, 0) / 1000));
  return (
    <div className="h center" role="timer" aria-label={`Time left ${clock}`}
      style={{ gap: 6, padding: '0 12px', height: 40, borderRadius: radius.pill, minWidth: 92, backgroundColor: bg, boxShadow: 'var(--shadow-card)' }}>
      <Icon name="timer-outline" size={16} color={tone} />
      <Text variant="bodyStrong" color={tone} style={{ fontVariantNumeric: 'tabular-nums' }}>{clock}</Text>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div style={{ height: 6, borderRadius: 3, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}>
      <div style={{ height: 6, borderRadius: 3, backgroundColor: colors.primary, width: `${Math.round(value * 100)}%`, transition: 'width 250ms' }} />
    </div>
  );
}

/* ---------- Answering ---------- */

function Navigator({ exam, attempt, index, flagged, onJump }: {
  exam: Exam; attempt: ExamAttempt; index: number; flagged: Set<string>; onJump: (i: number) => void;
}) {
  return (
    <div className="hscroll" style={{ margin: 0, padding: '2px 0' }}>
      {exam.questions.map((q, i) => {
        const current = i === index;
        const answered = isAnswered(attempt.answers[q.id]);
        return (
          <Pressable
            key={q.id}
            scaleTo={0.88}
            onClick={() => onJump(i)}
            aria-label={`Question ${i + 1}${answered ? ', answered' : ''}${flagged.has(q.id) ? ', flagged' : ''}`}
            aria-current={current}
            style={{
              position: 'relative', width: 38, height: 38, borderRadius: 19, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: current ? colors.ink : answered ? colors.primarySoft : colors.surface,
              border: `1.5px solid ${current ? colors.ink : answered ? colors.primarySoft : colors.line}`,
            }}
          >
            <Text variant="small" color={current ? '#fff' : answered ? colors.primary : colors.inkSoft} style={{ fontWeight: 700 }}>{i + 1}</Text>
            {flagged.has(q.id) && (
              <span style={{ position: 'absolute', top: -1, right: -1, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.student, border: `2px solid ${colors.bg}` }} />
            )}
          </Pressable>
        );
      })}
    </div>
  );
}

function QuestionView({ question: q, index, total, answer, onAnswer, flagged, onFlag }: {
  question: ExamQuestion; index: number; total: number; answer: ExamAnswer | undefined;
  onAnswer: (value: ExamAnswer | null) => void; flagged: boolean; onFlag: () => void;
}) {
  const [pasteBlocked, setPasteBlocked] = useState(false);
  const written = typeof answer === 'string' ? answer : '';

  function changeWritten(next: string) {
    // Paste is blocked, but some input methods still insert large chunks at once — refuse those.
    if (next.length - written.length > PASTE_LIMIT) {
      setPasteBlocked(true);
      return;
    }
    setPasteBlocked(false);
    onAnswer(next.length ? next : null);
  }

  return (
    <div key={q.id} className="v a-right" style={{ gap: 18 }}>
      <div className="h" style={{ justifyContent: 'space-between', gap: 8 }}>
        <Text variant="label" color={colors.muted}>Question {index + 1} of {total} · {formatPoints(q.points)}</Text>
        <Pressable scaleTo={0.9} onClick={onFlag} aria-pressed={flagged}
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: radius.pill, backgroundColor: flagged ? colors.studentSoft : colors.surface }}>
          <Icon name={flagged ? 'flag' : 'flag-outline'} size={14} color={flagged ? colors.student : colors.muted} />
          <Text variant="small" color={flagged ? colors.student : colors.muted}>{flagged ? 'Flagged' : 'Flag'}</Text>
        </Pressable>
      </div>

      <Text variant="heading" style={{ fontSize: 20, lineHeight: '28px' }} className="pre">{q.prompt}</Text>

      {q.kind === 'written' ? (
        <div className="v" style={{ gap: 8 }}>
          <textarea
            value={written}
            onChange={(e) => changeWritten(e.target.value)}
            onPaste={(e) => { e.preventDefault(); setPasteBlocked(true); }}
            placeholder="Type your answer…"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
            style={{
              minHeight: 180, borderRadius: radius.lg, backgroundColor: colors.surface, border: `1.5px solid ${colors.line}`,
              padding: 16, fontSize: 16, lineHeight: '24px', color: colors.ink, resize: 'vertical', outline: 'none',
            }}
          />
          {pasteBlocked ? (
            <Text variant="small" color={colors.danger}>Pasting is disabled during the exam — type your answer.</Text>
          ) : (
            <Text variant="small" color={colors.muted}>{QUESTION_KINDS.written.label} answer · graded by your teacher</Text>
          )}
        </div>
      ) : (
        <div className="v" role="radiogroup" style={{ gap: 10 }}>
          {q.options.map((option, i) => {
            const selected = answer === i;
            return (
              <Pressable
                key={i}
                scaleTo={0.98}
                role="radio"
                aria-checked={selected}
                onClick={() => onAnswer(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: 14, minHeight: 60, width: '100%', borderRadius: radius.lg,
                  backgroundColor: selected ? colors.primarySoft : colors.surface, border: `1.5px solid ${selected ? colors.primary : colors.line}`,
                }}
              >
                <span className="h center" style={{ width: 32, height: 32, borderRadius: 10, flexShrink: 0, backgroundColor: selected ? colors.primary : colors.surfaceAlt }}>
                  <Text variant="small" color={selected ? '#fff' : colors.inkSoft} style={{ fontWeight: 700 }}>
                    {q.kind === 'truefalse' ? option[0] : LETTERS[i]}
                  </Text>
                </span>
                <Text variant="bodyStrong" className="flex1">{option}</Text>
                {selected && <Icon name="checkmark-circle" size={20} color={colors.primary} />}
              </Pressable>
            );
          })}
          {typeof answer === 'number' && (
            <Pressable scaleTo={0.95} onClick={() => onAnswer(null)} style={{ alignSelf: 'flex-start', padding: '4px 0' }}>
              <Text variant="small" color={colors.muted}>Clear my answer</Text>
            </Pressable>
          )}
        </div>
      )}
    </div>
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
    <div className="v a-fade" style={{ gap: 14 }}>
      <div className="v" style={{ gap: 4 }}>
        <Text variant="title">Review your answers</Text>
        <Text color={colors.muted}>Click a question to change your answer. Nothing is final until you submit.</Text>
      </div>

      <div className="h" style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: '14px 0', boxShadow: 'var(--shadow-card)' }}>
        {[
          { v: exam.questions.length - unanswered, l: 'Answered', c: colors.ink },
          { v: unanswered, l: 'Unanswered', c: unanswered ? colors.danger : colors.ink },
          { v: flagged.size, l: 'Flagged', c: flagged.size ? colors.student : colors.ink },
        ].map((s) => (
          <div key={s.l} className="v flex1" style={{ alignItems: 'center', gap: 2 }}>
            <Text variant="heading" color={s.c}>{s.v}</Text>
            <Text variant="small" color={colors.muted}>{s.l}</Text>
          </div>
        ))}
      </div>

      {exam.questions.map((q, i) => {
        const summary = answerSummary(q, attempt.answers[q.id]);
        return (
          <div key={q.id} className="a-down" style={delay(i * 30)}>
            <Pressable scaleTo={0.98} onClick={() => onOpen(i)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, border: `1.5px solid ${summary ? 'transparent' : colors.dangerSoft}` }}>
              <span className="h center" style={{ width: 32, height: 32, borderRadius: 16, flexShrink: 0, backgroundColor: summary ? colors.primarySoft : colors.dangerSoft }}>
                <Text variant="small" color={summary ? colors.primary : colors.danger} style={{ fontWeight: 700 }}>{i + 1}</Text>
              </span>
              <div className="v flex1" style={{ gap: 4 }}>
                <Text variant="bodyStrong" lines={2}>{q.prompt}</Text>
                {summary ? <Text variant="small" color={colors.inkSoft} lines={2}>{summary}</Text> : <Text variant="small" color={colors.danger}>Not answered</Text>}
              </div>
              {flagged.has(q.id) && <Icon name="flag" size={16} color={colors.student} />}
              <Icon name="chevron-forward" size={16} color={colors.muted} />
            </Pressable>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Finished ---------- */

function FinishedView({ exam, attempt }: { exam: Exam; attempt: ExamAttempt }) {
  const back = useBack(`/exam/${exam.id}`);
  const answered = exam.questions.filter((q) => isAnswered(attempt.answers[q.id])).length;
  const timeUp = attempt.finish === 'time_up';
  const left = attempt.finish === 'left';
  const tone = left ? colors.danger : timeUp ? colors.student : colors.success;
  return (
    <div className="content narrow v" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, padding: 28, minHeight: '100vh' }}>
      <span className="h center a-down" style={{ width: 76, height: 76, borderRadius: 26, backgroundColor: tone }}>
        <Icon name={left ? 'exit-outline' : timeUp ? 'alarm-outline' : 'checkmark-done'} size={34} color="#fff" />
      </span>
      <div className="v a-down" style={{ ...delay(80), gap: 8, alignItems: 'center' }}>
        <Text variant="title" style={{ textAlign: 'center' }}>{left ? 'You left the exam' : timeUp ? 'Time’s up' : 'Exam submitted'}</Text>
        <Text color={colors.muted} style={{ textAlign: 'center', maxWidth: 320 }}>
          {left
            ? 'You switched away from Halaqa, so your answers were submitted automatically'
            : timeUp ? 'Your answers were submitted automatically' : 'Your answers were submitted'} at {formatTime(attempt.finishedAt!)}.
          {' '}You answered {answered} of {exam.questions.length} questions.
        </Text>
      </div>
      <div className="v a-down" style={{ ...delay(160), alignSelf: 'stretch' }}>
        <Button title="Done" onPress={back} />
      </div>
    </div>
  );
}

/* ---------- Screen ---------- */

export default function TakeExam() {
  const { id = '' } = useParams();
  const back = useBack(`/exam/${id}`);
  // The exam as the server shows a student who has started: questions, no answer key.
  const { data: exam, loading } = useQuery(() => api.getExam(id), [id]);
  // Answers update here instantly; the server copy follows (see `answer`).
  const [local, setLocal] = useState<ExamAttempt | null>(null);
  const attempt = local ?? exam?.myAttempt ?? null;
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
  const typing = useRef(new Map<string, { timer: ReturnType<typeof setTimeout>; value: ExamAnswer | null }>());
  const finishing = useRef(false);

  const [index, setIndex] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const [flagged, setFlagged] = useState<Set<string>>(() => new Set());
  const [now, setNow] = useState(() => Date.now());

  const live = !!exam && !!attempt && !attempt.finish;
  // The server's deadline — the computer's clock can't extend it.
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
    } catch (e) {
      alert('Couldn’t submit', e instanceof Error ? e.message : 'Check your connection and try again.');
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
      // Time's up: hand in what's there. The server records it as time_up.
      if (tick >= latest.current.deadline) void latest.current.finish('submitted');
    }, 1000);
    return () => clearInterval(t);
  }, [live]);

  // Leaving the tab or window submits the exam; copy/paste blocked; full screen.
  const { fullscreen } = useExamLockdown(live, () => void finish('left'));

  // No way back out while the exam runs: the only exits are submitting or the timer.
  useLeaveGuard(live, (_proceed, stay) => {
    stay();
    alert('You can’t leave during the exam', 'Submit your answers to finish, or keep going until the timer runs out.');
  });

  function go(i: number) {
    setReviewing(false);
    setIndex(i);
    window.scrollTo({ top: 0 });
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
    alert(
      'Submit your exam?',
      unanswered
        ? `You left ${unanswered} ${unanswered === 1 ? 'question' : 'questions'} unanswered. You can’t change anything after submitting.`
        : 'You can’t change your answers after submitting.',
      [{ text: 'Keep reviewing', style: 'cancel' }, { text: 'Submit', onPress: () => void finish('submitted') }],
    );
  }

  if (loading) {
    return <div className="v center" style={{ minHeight: '100vh' }}><Text color={colors.muted}>Loading your exam…</Text></div>;
  }

  if (!exam || !attempt) {
    return (
      <div className="content narrow">
        <IconButton icon="close" onPress={back} label="Close" />
        <EmptyState icon="alert-circle-outline" title="No exam in progress" body="Start the exam from its page to take it." />
      </div>
    );
  }

  if (attempt.finish) return <FinishedView exam={exam} attempt={attempt} />;

  const question = exam.questions[index]!;
  const answeredCount = exam.questions.filter((q) => isAnswered(attempt.answers[q.id])).length;
  const last = index === exam.questions.length - 1;

  return (
    <div className="page" style={{ userSelect: 'none' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 5, backgroundColor: colors.bg }}>
        <div className="content narrow" style={{ gap: 12, paddingBottom: 12 }}>
          <div className="h" style={{ gap: 12 }}>
            <span className="h center" aria-label="Exam mode is on" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface }}>
              <Icon name="lock-closed" size={18} color={colors.ink} />
            </span>
            <div className="v flex1" style={{ alignItems: 'center' }}>
              <Text variant="bodyStrong" lines={1}>{exam.title}</Text>
              <Text variant="small" color={saveState === 'error' ? colors.danger : colors.muted}>
                {saveState === 'error' ? 'Not saved — check your connection'
                  : saveState === 'saving' ? 'Saving…'
                    : `${answeredCount} of ${exam.questions.length} answered`}
              </Text>
            </div>
            <TimerPill remaining={remaining} />
          </div>
          <ProgressBar value={answeredCount / exam.questions.length} />
          {!reviewing && <Navigator exam={exam} attempt={attempt} index={index} flagged={flagged} onJump={go} />}
          {!fullscreen && (
            <div className="h" style={{ gap: 8, padding: 10, borderRadius: radius.md, backgroundColor: colors.dangerSoft }}>
              <Icon name="warning-outline" size={16} color={colors.danger} />
              <Text variant="small" color={colors.danger} className="flex1">Full screen is off. Leaving this tab now submits your exam.</Text>
              <Pressable onClick={enterExamFullscreen}><Text variant="small" color={colors.danger} style={{ fontWeight: 700 }}>Go full screen</Text></Pressable>
            </div>
          )}
        </div>
      </div>

      <div className="content narrow" style={{ flex: 1, paddingBottom: 32 }}>
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
      </div>

      <div style={{ position: 'sticky', bottom: 0, backgroundColor: colors.bg, borderTop: `1px solid ${colors.line}` }}>
        <div className="content narrow exam-nav" style={{ paddingTop: 10, paddingBottom: 8, gap: 0 }}>
          <div className="h" style={{ gap: 10 }}>
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
          </div>
          {!reviewing && !last && (
            <Pressable scaleTo={0.96} onClick={() => setReviewing(true)} style={{ alignSelf: 'center', padding: '10px 0' }}>
              <Text variant="small" color={colors.primary}>Review all answers</Text>
            </Pressable>
          )}
        </div>
      </div>
    </div>
  );
}
