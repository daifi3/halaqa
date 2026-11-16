/**
 * Live polls and quizzes in class. They ride the LiveKit data channel on their own
 * topic, like chat. The teacher's device is the source of truth: it keeps every
 * answer (and a quiz's correct option) and broadcasts one `state` message that
 * students simply show. The correct option only leaves the teacher's device once
 * the quiz has ended. Nothing is stored on the server.
 */

export const POLL_TOPIC = 'poll';

export type PollKind = 'poll' | 'quiz';

export const POLL_MIN_OPTIONS = 2;
export const POLL_MAX_OPTIONS = 6;
export const POLL_QUESTION_MAX = 200;
export const POLL_OPTION_MAX = 80;
/** Timer choices the teacher picks from, in seconds; null = no timer. */
export const POLL_DURATIONS = [null, 30, 60, 120, 300] as const;
export type PollDuration = (typeof POLL_DURATIONS)[number];

/** What the teacher sets up. `correct` never goes out while the quiz is open. */
export interface PollDraft {
  kind: PollKind;
  question: string;
  options: string[];
  /** Quiz only: index of the right option. */
  correct: number | null;
  durationSec: PollDuration;
  /** Students see the bars move while it's open (polls only; quiz results wait for the end). */
  showLive: boolean;
}

/** What everyone sees about the question itself. */
export interface PollQuestion {
  id: string;
  kind: PollKind;
  question: string;
  options: string[];
  durationSec: number | null;
  showLive: boolean;
}

export type PollPhase = 'open' | 'ended';

/** The teacher's broadcast: the whole picture, so a late joiner needs only the latest one. */
export interface PollState {
  t: 'state';
  poll: PollQuestion;
  phase: PollPhase;
  /** Time left when sent, so clocks on different devices don't need to agree. */
  remainingMs: number | null;
  /** Answers per option — only when the poll shows live results, or once it has ended. */
  counts: number[] | null;
  /** How many people have answered (always sent, so students see the room filling in). */
  answered: number;
  /** Quiz only, and only once ended. */
  correct: number | null;
}

export type PollMessage =
  | PollState
  /** A student's answer (or a changed one). */
  | { t: 'vote'; id: string; choice: number }
  /** The teacher closes the card for everyone. */
  | { t: 'clear'; id: string }
  /** Someone joined (or rejoined): the teacher answers with the current state. */
  | { t: 'sync' };

export interface PollSender {
  /** LiveKit identity. */
  id: string;
  name: string;
  teacher: boolean;
}

export interface PollTransport {
  send(msg: PollMessage): void;
  /** Returns an unsubscribe function. */
  subscribe(handler: (msg: PollMessage, from: PollSender) => void): () => void;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const encodePoll = (msg: PollMessage) => encoder.encode(JSON.stringify(msg));

const isStr = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;
const isIndex = (v: unknown, n: number): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) < n;
const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;

function validQuestion(p: unknown): p is PollQuestion {
  if (!p || typeof p !== 'object') return false;
  const q = p as Partial<PollQuestion>;
  return isStr(q.id, 40)
    && (q.kind === 'poll' || q.kind === 'quiz')
    && isStr(q.question, POLL_QUESTION_MAX)
    && Array.isArray(q.options)
    && q.options.length >= POLL_MIN_OPTIONS && q.options.length <= POLL_MAX_OPTIONS
    && q.options.every((o) => isStr(o, POLL_OPTION_MAX))
    && (q.durationSec === null || (typeof q.durationSec === 'number' && q.durationSec > 0 && q.durationSec <= 3600))
    && typeof q.showLive === 'boolean';
}

/** Anything malformed is dropped, so a bad message can't break the card. */
export function decodePoll(payload: Uint8Array): PollMessage | null {
  try {
    const m = JSON.parse(decoder.decode(payload)) as Partial<PollMessage> & Record<string, unknown>;
    switch (m.t) {
      case 'sync':
        return { t: 'sync' };
      case 'clear':
        return isStr(m.id, 40) ? { t: 'clear', id: m.id } : null;
      case 'vote':
        return isStr(m.id, 40) && isIndex(m.choice, POLL_MAX_OPTIONS) ? { t: 'vote', id: m.id, choice: m.choice } : null;
      case 'state': {
        const s = m as Partial<PollState>;
        if (!validQuestion(s.poll) || (s.phase !== 'open' && s.phase !== 'ended')) return null;
        const n = s.poll.options.length;
        const counts = Array.isArray(s.counts) && s.counts.length === n && s.counts.every(isCount) ? s.counts : null;
        return {
          t: 'state',
          poll: s.poll,
          phase: s.phase,
          remainingMs: typeof s.remainingMs === 'number' && s.remainingMs >= 0 ? s.remainingMs : null,
          counts,
          answered: isCount(s.answered) ? s.answered : 0,
          correct: s.phase === 'ended' && isIndex(s.correct, n) ? s.correct : null,
        };
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

export const pollId = () => Math.random().toString(36).slice(2, 10);

/** Blank options are dropped; a draft can go out once it has a question and two options (and a right answer, for a quiz). */
export function cleanDraft(draft: PollDraft): PollDraft | null {
  const question = draft.question.trim().slice(0, POLL_QUESTION_MAX);
  const kept = draft.options.map((o, i) => ({ text: o.trim().slice(0, POLL_OPTION_MAX), i })).filter((o) => o.text);
  if (!question || kept.length < POLL_MIN_OPTIONS) return null;
  const correct = draft.kind === 'quiz' ? kept.findIndex((o) => o.i === draft.correct) : -1;
  if (draft.kind === 'quiz' && correct < 0) return null;
  return {
    ...draft,
    question,
    options: kept.map((o) => o.text),
    correct: draft.kind === 'quiz' ? correct : null,
    showLive: draft.kind === 'poll' && draft.showLive,
  };
}

/** Ready-made answer sets for the most common questions. */
export const POLL_PRESETS: { label: string; options: string[] }[] = [
  { label: 'Yes / No', options: ['Yes', 'No'] },
  { label: 'True / False', options: ['True', 'False'] },
  { label: 'A B C D', options: ['A', 'B', 'C', 'D'] },
  { label: 'Got it?', options: ['Got it', 'Partly', 'Lost me'] },
];

export const emptyDraft = (kind: PollKind = 'poll'): PollDraft => ({
  kind, question: '', options: ['', ''], correct: null, durationSec: kind === 'quiz' ? 60 : null, showLive: true,
});

export function formatDuration(sec: number | null) {
  if (sec === null) return 'No timer';
  return sec < 60 ? `${sec}s` : `${sec / 60} min`;
}

/* ---------- Mock mode ---------- */

const DEMO_TEACHER: PollSender = { id: 'demo-teacher', name: 'Teacher', teacher: true };
const DEMO_CLASSMATES: PollSender[] = [
  { id: 'karim', name: 'Karim H.', teacher: false },
  { id: 'lina', name: 'Lina M.', teacher: false },
  { id: 'yasmine', name: 'Yasmine B.', teacher: false },
];

/**
 * Mock mode. As the teacher: classmates answer a few seconds after each new poll.
 * As a student: the teacher runs a short quiz soon after you join.
 */
export function demoPollTransport(isTeacher: boolean, teacherName: string): PollTransport {
  const handlers = new Set<(msg: PollMessage, from: PollSender) => void>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const later = (ms: number, run: () => void) => {
    const t = setTimeout(() => { timers.delete(t); run(); }, ms);
    timers.add(t);
  };
  const emit = (msg: PollMessage, from: PollSender) => handlers.forEach((h) => h(msg, from));
  const seen = new Set<string>();

  // Student side: the demo teacher's quiz.
  const teacher = { ...DEMO_TEACHER, name: teacherName };
  const quiz: PollQuestion = {
    id: 'demo-quiz', kind: 'quiz', question: 'Which keyword creates a new object in Java?',
    options: ['this', 'new', 'class', 'static'], durationSec: 30, showLive: false,
  };
  const others = [1, 1, 0];
  let mine: number | null = null;
  const answeredNow = () => others.length + (mine === null ? 0 : 1);
  const counts = () => quiz.options.map((_, i) => others.filter((c) => c === i).length + (mine === i ? 1 : 0));

  return {
    send: (msg) => {
      if (isTeacher && msg.t === 'state' && msg.phase === 'open' && !seen.has(msg.poll.id)) {
        seen.add(msg.poll.id);
        const n = msg.poll.options.length;
        DEMO_CLASSMATES.forEach((c, i) => later(1500 + i * 1700 + Math.random() * 1500, () => {
          emit({ t: 'vote', id: msg.poll.id, choice: Math.floor(Math.random() * n) }, c);
        }));
      }
      if (!isTeacher && msg.t === 'vote' && msg.id === quiz.id) mine = msg.choice;
    },
    subscribe: (handler) => {
      handlers.add(handler);
      if (!isTeacher && handlers.size === 1) {
        later(8000, () => emit({ t: 'state', poll: quiz, phase: 'open', remainingMs: 30_000, counts: null, answered: 0, correct: null }, teacher));
        later(14_000, () => emit({ t: 'state', poll: quiz, phase: 'open', remainingMs: 24_000, counts: null, answered: answeredNow(), correct: null }, teacher));
        later(38_000, () => emit({ t: 'state', poll: quiz, phase: 'ended', remainingMs: 0, counts: counts(), answered: answeredNow(), correct: 1 }, teacher));
      }
      return () => {
        handlers.delete(handler);
        if (!handlers.size) {
          timers.forEach(clearTimeout);
          timers.clear();
        }
      };
    },
  };
}
