/**
 * Screen-share permission signalling. Students ask, the teacher answers — over
 * the LiveKit data channel on its own topic.
 *
 * These messages only drive the UI. The real gate is the student's LiveKit
 * permission, which the backend changes when the teacher allows or stops a
 * student (see RoomController#grantScreenShare): a student who ignores the
 * messages still can't publish a screen track.
 */

export const SCREEN_TOPIC = 'screen';

export type ScreenMsg =
  /** A student just connected — the teacher replies with the policy and any grant they hold. */
  | { t: 'hello' }
  | { t: 'request' }
  | { t: 'cancel' }
  | { t: 'policy'; open: boolean }
  | { t: 'grant'; to: string }
  | { t: 'deny'; to: string }
  | { t: 'revoke'; to: string };

export interface Peer {
  id: string;
  name: string;
  teacher: boolean;
}

export interface ScreenSignal {
  send(msg: ScreenMsg): void;
  /** Returns an unsubscribe function. */
  subscribe(handler: (msg: ScreenMsg, from: Peer) => void): () => void;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const KINDS = new Set(['hello', 'request', 'cancel', 'policy', 'grant', 'deny', 'revoke']);

export const encodeScreen = (msg: ScreenMsg) => encoder.encode(JSON.stringify(msg));

export function decodeScreen(payload: Uint8Array): ScreenMsg | null {
  try {
    const msg = JSON.parse(decoder.decode(payload)) as { t?: string; to?: unknown; open?: unknown };
    if (!msg.t || !KINDS.has(msg.t)) return null;
    if ((msg.t === 'grant' || msg.t === 'deny' || msg.t === 'revoke') && typeof msg.to !== 'string') return null;
    if (msg.t === 'policy' && typeof msg.open !== 'boolean') return null;
    return msg as ScreenMsg;
  } catch {
    return null;
  }
}

/** Only the teacher's answers count; anyone can ask. */
export const fromTeacherOnly = (msg: ScreenMsg) => msg.t === 'policy' || msg.t === 'grant' || msg.t === 'deny' || msg.t === 'revoke';

/* ---------- Mock mode ---------- */

export const DEMO_ME = 'me';
const DEMO_STUDENT: Peer = { id: 'karim', name: 'Karim H.', teacher: false };

/**
 * Mock mode: as a student, the teacher accepts your request after a moment.
 * As the teacher, a student asks to share a little while into the class, and
 * `onStudentShare` reports when that pretend student starts or stops sharing.
 */
export function demoScreenSignal(isTeacher: boolean, teacherName: string, onStudentShare: (name: string | null) => void): ScreenSignal {
  const handlers = new Set<(msg: ScreenMsg, from: Peer) => void>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const teacher: Peer = { id: 'teacher', name: teacherName, teacher: true };
  const later = (ms: number, fn: () => void) => {
    const t = setTimeout(() => { timers.delete(t); fn(); }, ms);
    timers.add(t);
  };
  const emit = (msg: ScreenMsg, from: Peer) => handlers.forEach((h) => h(msg, from));

  return {
    send: (msg) => {
      if (!isTeacher && msg.t === 'request') later(2500, () => emit({ t: 'grant', to: DEMO_ME }, teacher));
      if (isTeacher && msg.t === 'grant' && msg.to === DEMO_STUDENT.id) later(1500, () => onStudentShare(DEMO_STUDENT.name));
      if (isTeacher && msg.t === 'revoke' && msg.to === DEMO_STUDENT.id) onStudentShare(null);
      if (isTeacher && msg.t === 'policy' && !msg.open) onStudentShare(null);
    },
    subscribe: (handler) => {
      handlers.add(handler);
      if (isTeacher && handlers.size === 1) later(15_000, () => emit({ t: 'request' }, DEMO_STUDENT));
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
