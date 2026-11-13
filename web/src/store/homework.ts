// Demo mode only: backs MockApi on this device. With the real backend, homework and
// exams live on the server (see lib/api.ts) and this store isn't used.
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Homework, HomeworkSubmission, PickedFile, User } from '@/lib/types';

const uid = () => Math.random().toString(36).slice(2, 10);
const inHours = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();

interface HomeworkState {
  homework: Homework[];
  submissions: HomeworkSubmission[];
  assign: (input: { courseId: string; courseTitle: string; title: string; instructions: string; dueAt: string }, teacher: Pick<User, 'id' | 'name'>) => Homework;
  submit: (homeworkId: string, student: Pick<User, 'id' | 'name'>, input: { note: string; attachment?: (PickedFile & { size: number }) | null }) => HomeworkSubmission;
  /**
   * byCourse/submissionsFor allocate a new array every call (filter+sort).
   * Call them as plain functions (e.g. inside .map() or a handler) — never as
   * `useHomeworkStore((s) => s.byCourse(id))`. A selector must return a
   * referentially stable result for unchanged state, or useSyncExternalStore
   * sees a "change" on every render and loops forever. Select the raw
   * `homework`/`submissions` array and derive with useMemo in the component
   * instead. mySubmission is exempt: .find() returns an existing element
   * (or undefined), never a new object, so it's safe to select directly.
   */
  byCourse: (courseId: string) => Homework[];
  submissionsFor: (homeworkId: string) => HomeworkSubmission[];
  mySubmission: (homeworkId: string, studentId: string) => HomeworkSubmission | undefined;
}

export const useHomeworkStore = create<HomeworkState>()(
  persist(
    (set, get) => ({
      homework: [
        {
          id: 'hw1', courseId: 'c1', courseTitle: 'Algorithms & Data Structures',
          title: 'Balanced binary trees', instructions: 'Implement an AVL tree with insert and rebalance, then write a short note on the time complexity of each operation.',
          dueAt: inHours(48), createdAt: inHours(-24), teacher: { id: 't-demo', name: 'Dr. Amrani' },
        },
        {
          id: 'hw2', courseId: 'c1', courseTitle: 'Algorithms & Data Structures',
          title: 'Graph traversal exercises', instructions: 'Solve problems 3 to 7 from the handout using BFS/DFS, and submit your working as a single document.',
          dueAt: inHours(-5), createdAt: inHours(-96), teacher: { id: 't-demo', name: 'Dr. Amrani' },
        },
      ],
      submissions: [
        {
          id: 'sub1', homeworkId: 'hw2', student: { id: 's-demo', name: 'Yasmine Bensalem' },
          note: 'Attached my solutions for all five problems — let me know if problem 6 needs a different approach.',
          attachment: null, submittedAt: inHours(-10),
        },
      ],

      assign: (input, teacher) => {
        const hw: Homework = { id: uid(), createdAt: new Date().toISOString(), teacher, ...input };
        set((s) => ({ homework: [hw, ...s.homework] }));
        return hw;
      },

      submit: (homeworkId, student, input) => {
        const existing = get().submissions.find((s) => s.homeworkId === homeworkId && s.student.id === student.id);
        const submission: HomeworkSubmission = {
          id: existing?.id ?? uid(), homeworkId, student,
          note: input.note, attachment: input.attachment ?? null, submittedAt: new Date().toISOString(),
        };
        set((s) => ({ submissions: [submission, ...s.submissions.filter((x) => x.id !== submission.id)] }));
        return submission;
      },

      byCourse: (courseId) => get().homework.filter((h) => h.courseId === courseId).sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt)),
      submissionsFor: (homeworkId) => get().submissions.filter((s) => s.homeworkId === homeworkId).sort((a, b) => +new Date(b.submittedAt) - +new Date(a.submittedAt)),
      mySubmission: (homeworkId, studentId) => get().submissions.find((s) => s.homeworkId === homeworkId && s.student.id === studentId),
    }),
    {
      name: 'halaqa-homework',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
