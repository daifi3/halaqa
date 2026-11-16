import { useEffect, useRef, useState } from 'react';
import {
  cleanDraft, emptyDraft, pollId, type PollDraft, type PollPhase, type PollQuestion, type PollState, type PollTransport,
} from '@/lib/polls';

/** How often the teacher re-broadcasts live counts while answers pour in. */
const TALLY_MS = 800;

/** What the card shows, for the teacher and students alike. */
export interface PollView {
  poll: PollQuestion;
  phase: PollPhase;
  /** Local clock time the poll closes, or null with no timer. */
  deadline: number | null;
  /** Answers per option: always for the teacher; for students only when shared. */
  counts: number[] | null;
  answered: number;
  /** Shown once a quiz ends — and to the teacher from the start. */
  correct: number | null;
  /** Teacher only: who picked each option. */
  voters: string[][] | null;
}

interface Running {
  poll: PollQuestion;
  correct: number | null;
  phase: PollPhase;
  deadline: number | null;
  /** By LiveKit identity, so a changed answer replaces the old one. */
  votes: ReadonlyMap<string, { name: string; choice: number }>;
}

function tally(run: Running) {
  const counts = run.poll.options.map(() => 0);
  const voters: string[][] = run.poll.options.map(() => []);
  for (const v of run.votes.values()) {
    counts[v.choice]! += 1;
    voters[v.choice]!.push(v.name);
  }
  return { counts, voters };
}

function stateOf(run: Running): PollState {
  const ended = run.phase === 'ended';
  return {
    t: 'state',
    poll: run.poll,
    phase: run.phase,
    remainingMs: run.deadline === null ? null : Math.max(0, run.deadline - Date.now()),
    counts: ended || run.poll.showLive ? tally(run).counts : null,
    answered: run.votes.size,
    correct: ended ? run.correct : null,
  };
}

/**
 * Live polls and quizzes. The teacher's device keeps the answers and broadcasts the
 * state; students show it and send their answer back.
 */
export function usePolls(transport: PollTransport, isTeacher: boolean, connected: boolean) {
  const [open, setOpen] = useState(false);
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState<PollDraft>(() => emptyDraft());

  // Teacher side: the poll in progress. The ref mirrors it for the data-channel handler.
  const [run, setRun] = useState<Running | null>(null);
  const runRef = useRef<Running | null>(null);
  const lastSent = useRef(0);
  const pending = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Student side.
  const [received, setReceived] = useState<PollView | null>(null);
  const receivedRef = useRef<PollView | null>(null);
  const [myChoice, setMyChoice] = useState<number | null>(null);
  /** A poll changed while the card was closed. */
  const [unseen, setUnseen] = useState(false);
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  function commit(next: Running | null) {
    runRef.current = next;
    setRun(next);
  }

  function broadcast() {
    clearTimeout(pending.current);
    pending.current = undefined;
    lastSent.current = Date.now();
    if (runRef.current) transport.send(stateOf(runRef.current));
  }

  /** Live counts go out at most every TALLY_MS, and the last change is always sent. */
  function broadcastSoon() {
    if (pending.current) return;
    const wait = Math.max(0, TALLY_MS - (Date.now() - lastSent.current));
    pending.current = setTimeout(broadcast, wait);
  }

  useEffect(() => transport.subscribe((msg, from) => {
    if (isTeacher) {
      const cur = runRef.current;
      if (msg.t === 'sync' && cur) transport.send(stateOf(cur));
      if (msg.t === 'vote' && cur && !from.teacher && msg.id === cur.poll.id && cur.phase === 'open' && msg.choice < cur.poll.options.length) {
        const votes = new Map(cur.votes);
        votes.set(from.id, { name: from.name, choice: msg.choice });
        commit({ ...cur, votes });
        broadcastSoon();
      }
      return;
    }
    // Only the teacher runs polls.
    if (!from.teacher) return;
    if (msg.t === 'clear') {
      if (receivedRef.current?.poll.id !== msg.id) return;
      receivedRef.current = null;
      setReceived(null);
      setUnseen(false);
      return;
    }
    if (msg.t !== 'state') return;
    const cur = receivedRef.current;
    const isNew = cur?.poll.id !== msg.poll.id;
    const justEnded = msg.phase === 'ended' && (isNew || cur?.phase !== 'ended');
    if (isNew) setMyChoice(null);
    // Pop the card up for a new question, and again for the results.
    if (isNew || justEnded) {
      setOpen(true);
      setUnseen(false);
    } else if (!openRef.current) {
      setUnseen(true);
    }
    const next: PollView = {
      poll: msg.poll,
      phase: msg.phase,
      deadline: msg.remainingMs === null ? null : Date.now() + msg.remainingMs,
      counts: msg.counts,
      answered: msg.answered,
      correct: msg.correct,
      voters: null,
    };
    receivedRef.current = next;
    setReceived(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the helpers only touch refs and setters
  }), [transport, isTeacher]);

  // Joining (or rejoining) a class that's already going: ask for any poll in progress.
  useEffect(() => {
    if (connected && !isTeacher) transport.send({ t: 'sync' });
  }, [connected, isTeacher, transport]);

  useEffect(() => () => clearTimeout(pending.current), []);

  /** Teacher: closes answers and shows everyone the results (and a quiz's right answer). */
  function end() {
    const cur = runRef.current;
    if (!cur || cur.phase === 'ended') return;
    commit({ ...cur, phase: 'ended', deadline: null });
    broadcast();
  }

  // The teacher's device closes a timed poll when the time is up.
  const deadline = run?.phase === 'open' ? run.deadline : null;
  useEffect(() => {
    if (!isTeacher || deadline === null) return;
    const t = setTimeout(end, Math.max(0, deadline - Date.now()));
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- end reads the ref
  }, [isTeacher, deadline]);

  /** Teacher: sends the drafted question out. Returns false while the draft is incomplete. */
  function start(): boolean {
    const clean = cleanDraft(draft);
    if (!clean) return false;
    commit({
      poll: {
        id: pollId(), kind: clean.kind, question: clean.question, options: clean.options,
        durationSec: clean.durationSec, showLive: clean.showLive,
      },
      correct: clean.correct,
      phase: 'open',
      deadline: clean.durationSec === null ? null : Date.now() + clean.durationSec * 1000,
      votes: new Map(),
    });
    setComposing(false);
    setDraft(emptyDraft(clean.kind));
    broadcast();
    return true;
  }

  /** Teacher: takes the card away for everyone. */
  function clear() {
    const cur = runRef.current;
    if (!cur) return;
    clearTimeout(pending.current);
    pending.current = undefined;
    transport.send({ t: 'clear', id: cur.poll.id });
    commit(null);
  }

  /** Student: picks (or changes) an answer while the poll is open. */
  function vote(choice: number) {
    if (!received || received.phase !== 'open') return;
    if (received.deadline !== null && Date.now() >= received.deadline) return;
    setMyChoice(choice);
    transport.send({ t: 'vote', id: received.poll.id, choice });
  }

  const view: PollView | null = isTeacher
    ? run && { poll: run.poll, phase: run.phase, deadline: run.deadline, answered: run.votes.size, correct: run.correct, ...tally(run) }
    : received;

  return {
    view,
    open,
    /** Teacher: the setup form is showing instead of the running poll. */
    composing: isTeacher && (composing || !run),
    draft,
    setDraft,
    myChoice,
    unseen,
    /** A poll is waiting for answers. */
    live: view?.phase === 'open',
    show: () => { setOpen(true); setUnseen(false); },
    hide: () => setOpen(false),
    compose: () => setComposing(true),
    cancelCompose: () => setComposing(false),
    start,
    end,
    clear,
    vote,
  };
}

export type Polls = ReturnType<typeof usePolls>;
