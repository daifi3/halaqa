// Demo mode only: backs MockApi on this device. With the real backend, homework and
// exams live on the server (see lib/api.ts) and this store isn't used.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { TRUE_FALSE } from '@/lib/exam';
import type { ExamAnswer, ExamAttempt, ExamFinish, NewExamInput, StoredExam, User } from '@/lib/types';

const uid = () => Math.random().toString(36).slice(2, 10);
const inHours = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();

const TEACHER = { id: 't-demo', name: 'Dr. Amrani' };
const ALGO = { courseId: 'c1', courseTitle: 'Algorithms & Data Structures' };

const SEED_ATTEMPTS: ExamAttempt[] = [
  {
    id: 'at1', examId: 'ex3', student: { id: 's-demo', name: 'Yasmine Bensalem' },
    startedAt: inHours(-180), finishedAt: inHours(-179.9), finish: 'submitted',
    answers: { q1: 1, q2: 0, q3: 'Bubble sort compares every pair of neighbours on each pass.' }, writtenGrades: { q3: 2 },
  },
  {
    id: 'at2', examId: 'ex3', student: { id: 's-karim', name: 'Karim Haddad' },
    startedAt: inHours(-170), finishedAt: inHours(-169.85), finish: 'time_up',
    answers: { q1: 0, q2: 0, q3: 'Insertion sort.' }, writtenGrades: {},
  },
  {
    id: 'at3', examId: 'ex1', student: { id: 's-lina', name: 'Lina Mansouri' },
    startedAt: inHours(-1.5), finishedAt: inHours(-1.2), finish: 'submitted',
    answers: { q1: 1, q2: 0, q3: 2, q4: 0, q5: 'Hashing spreads keys evenly so a bucket holds O(1) items on average; if every key collides, one bucket holds all n.' },
    writtenGrades: {},
  },
];

interface ExamsState {
  exams: StoredExam[];
  attempts: ExamAttempt[];
  create: (input: NewExamInput & Pick<StoredExam, 'courseId' | 'courseTitle'>, teacher: Pick<User, 'id' | 'name'>) => StoredExam;
  remove: (examId: string) => void;
  /** Starts the student's single attempt. Throws if they already have one. */
  start: (examId: string, student: Pick<User, 'id' | 'name'>) => ExamAttempt;
  answer: (attemptId: string, questionId: string, value: ExamAnswer | null) => void;
  /** Locks the attempt for good — there is no way back in afterwards. */
  finish: (attemptId: string, how: ExamFinish) => void;
  grade: (attemptId: string, questionId: string, points: number) => void;
  // Like the homework store: select the raw arrays and derive lists with useMemo —
  // a selector that filters returns a fresh array every read and loops forever.
  // attemptOf is safe to select: .find() returns an existing element.
  attemptOf: (examId: string, studentId: string) => ExamAttempt | undefined;
}

export const useExamsStore = create<ExamsState>()(
  persist(
    (set, get) => ({
      exams: [
        {
          id: 'ex1', ...ALGO, title: 'Midterm: trees & graphs',
          instructions: 'Answer every question. Multiple-choice questions have exactly one correct answer. Written answers should be short and precise.',
          durationMin: 30, opensAt: inHours(-2), closesAt: inHours(70), showResults: true, gradeScale: 20,
          teacher: TEACHER, createdAt: inHours(-30),
          questions: [
            { id: 'q1', kind: 'choice', prompt: 'What is the worst-case height of an AVL tree with n nodes?', options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'], correct: 1, points: 2 },
            { id: 'q2', kind: 'truefalse', prompt: 'Breadth-first search finds shortest paths in an unweighted graph.', options: TRUE_FALSE, correct: 0, points: 1 },
            { id: 'q3', kind: 'choice', prompt: 'Which data structure does Dijkstra’s algorithm use to pick the next vertex efficiently?', options: ['Stack', 'Queue', 'Priority queue', 'Hash set'], correct: 2, points: 2 },
            { id: 'q4', kind: 'truefalse', prompt: 'Every binary search tree is balanced.', options: TRUE_FALSE, correct: 1, points: 1 },
            { id: 'q5', kind: 'written', prompt: 'Explain in two or three sentences why a hash table lookup is O(1) on average but O(n) in the worst case.', options: [], correct: null, points: 4 },
          ],
        },
        {
          id: 'ex2', ...ALGO, title: 'Quiz: sorting algorithms',
          instructions: 'A short quiz on comparison sorts. You have 15 minutes once you start.',
          durationMin: 15, opensAt: inHours(46), closesAt: inHours(72), showResults: true, gradeScale: 20,
          teacher: TEACHER, createdAt: inHours(-4),
          questions: [
            { id: 'q1', kind: 'choice', prompt: 'Which sort is stable?', options: ['Quick sort', 'Heap sort', 'Merge sort', 'Selection sort'], correct: 2, points: 1 },
            { id: 'q2', kind: 'truefalse', prompt: 'Comparison sorts can run faster than O(n log n) in the worst case.', options: TRUE_FALSE, correct: 1, points: 1 },
          ],
        },
        {
          id: 'ex3', ...ALGO, title: 'Diagnostic: complexity basics',
          instructions: 'A warm-up to see where everyone stands.',
          durationMin: 10, opensAt: inHours(-200), closesAt: inHours(-150), showResults: true, gradeScale: 20,
          teacher: TEACHER, createdAt: inHours(-220),
          questions: [
            { id: 'q1', kind: 'choice', prompt: 'What is the complexity of binary search?', options: ['O(n)', 'O(log n)', 'O(1)', 'O(n²)'], correct: 1, points: 2 },
            { id: 'q2', kind: 'truefalse', prompt: 'O(2n) and O(n) describe the same growth rate.', options: TRUE_FALSE, correct: 0, points: 1 },
            { id: 'q3', kind: 'written', prompt: 'Give one example of an O(n²) algorithm.', options: [], correct: null, points: 2 },
          ],
        },
      ],
      attempts: SEED_ATTEMPTS,

      create: (input, teacher) => {
        const exam: StoredExam = { id: uid(), createdAt: new Date().toISOString(), teacher, ...input };
        set((s) => ({ exams: [exam, ...s.exams] }));
        return exam;
      },

      remove: (examId) => set((s) => ({
        exams: s.exams.filter((e) => e.id !== examId),
        attempts: s.attempts.filter((a) => a.examId !== examId),
      })),

      start: (examId, student) => {
        if (get().attemptOf(examId, student.id)) throw new Error('You have already taken this exam');
        const attempt: ExamAttempt = {
          id: uid(), examId, student, startedAt: new Date().toISOString(),
          finishedAt: null, finish: null, answers: {}, writtenGrades: {},
        };
        set((s) => ({ attempts: [attempt, ...s.attempts] }));
        return attempt;
      },

      answer: (attemptId, questionId, value) => set((s) => ({
        attempts: s.attempts.map((a) => {
          if (a.id !== attemptId || a.finish) return a;
          const answers = { ...a.answers };
          if (value === null) delete answers[questionId];
          else answers[questionId] = value;
          return { ...a, answers };
        }),
      })),

      finish: (attemptId, how) => set((s) => ({
        attempts: s.attempts.map((a) =>
          a.id === attemptId && !a.finish ? { ...a, finish: how, finishedAt: new Date().toISOString() } : a),
      })),

      grade: (attemptId, questionId, points) => set((s) => ({
        attempts: s.attempts.map((a) =>
          a.id === attemptId ? { ...a, writtenGrades: { ...a.writtenGrades, [questionId]: points } } : a),
      })),

      attemptOf: (examId, studentId) => get().attempts.find((a) => a.examId === examId && a.student.id === studentId),
    }),
    {
      name: 'halaqa-exams',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
