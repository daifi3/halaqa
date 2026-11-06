import type Ionicons from '@expo/vector-icons/Ionicons';
import type { Exam, ExamAnswer, ExamAttempt, ExamFinish, ExamQuestion, ExamQuestionKind } from './types';

export const TRUE_FALSE = ['True', 'False'];

export const QUESTION_KINDS: Record<ExamQuestionKind, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  choice: { label: 'Multiple choice', icon: 'list-outline' },
  truefalse: { label: 'True / False', icon: 'git-compare-outline' },
  written: { label: 'Written', icon: 'create-outline' },
};

export const FINISH_LABEL: Record<ExamFinish, string> = {
  submitted: 'Submitted',
  time_up: 'Time ran out',
  left: 'Left the exam',
};

export type ExamWindow = 'upcoming' | 'open' | 'closed';

export function examWindow(exam: Pick<Exam, 'opensAt' | 'closesAt'>, now = Date.now()): ExamWindow {
  if (now < +new Date(exam.opensAt)) return 'upcoming';
  if (now >= +new Date(exam.closesAt)) return 'closed';
  return 'open';
}

/** When an attempt must end: its full duration, cut short by the exam closing. */
export function attemptDeadline(exam: Pick<Exam, 'durationMin' | 'closesAt'>, attempt: Pick<ExamAttempt, 'startedAt'>) {
  return Math.min(+new Date(attempt.startedAt) + exam.durationMin * 60_000, +new Date(exam.closesAt));
}

export function isAnswered(answer: ExamAnswer | undefined) {
  return typeof answer === 'number' || (typeof answer === 'string' && answer.trim().length > 0);
}

/** The server's total when it sent one (a student may not have the questions yet), else summed from the questions. */
export const totalPoints = (exam: Pick<Exam, 'questions'> & { totalPoints?: number }) =>
  exam.totalPoints ?? exam.questions.reduce((sum, q) => sum + q.points, 0);

/** Points for one question, or null when it's a written answer still waiting for the teacher. */
export function questionScore(q: ExamQuestion, attempt: ExamAttempt): number | null {
  const answer = attempt.answers[q.id];
  if (q.kind === 'written') {
    if (!isAnswered(answer)) return 0;
    return attempt.writtenGrades[q.id] ?? null;
  }
  return answer === q.correct ? q.points : 0;
}

export const DEFAULT_SCALE = 20;
export const GRADE_SCALES = [10, 20, 100];

/** Exams saved before grading scales existed are treated as out of 20. */
export const scaleOf = (exam: Pick<Exam, 'gradeScale'>) => exam.gradeScale ?? DEFAULT_SCALE;

/** Raw points converted onto the exam's grading scale, to two decimals. */
/** Anything with questions and a scale — a full Exam, or one as demo mode stores it. */
type Gradable = Pick<Exam, 'questions' | 'gradeScale'> & { totalPoints?: number };

export function toGrade(exam: Gradable, points: number) {
  const total = totalPoints(exam);
  return total ? Math.round((points / total) * scaleOf(exam) * 100) / 100 : 0;
}

export function scoreAttempt(exam: Gradable, attempt: ExamAttempt) {
  // The server's score is authoritative (and the only one possible when the answer key is withheld).
  if (attempt.score) return { ...attempt.score };
  let earned = 0;
  let ungraded = 0;
  for (const q of exam.questions) {
    const s = questionScore(q, attempt);
    if (s === null) ungraded++;
    else earned += s;
  }
  const total = totalPoints(exam);
  return { earned, total, ungraded, grade: toGrade(exam, earned), scale: scaleOf(exam) };
}

export const formatPoints = (n: number) => `${n} ${n === 1 ? 'pt' : 'pts'}`;

/** 15 → "15", 14.5 → "14.5", 13.333 → "13.33". */
export const formatGrade = (n: number) => String(Math.round(n * 100) / 100);
