/**
 * In-class chat. Messages are delivered live over the same LiveKit data channel
 * as the whiteboard, on their own topic, and also saved through the API
 * (POST /rooms/{id}/messages) so someone who joins late gets the history.
 */

export const CHAT_TOPIC = 'chat';
export const CHAT_MAX_LENGTH = 500;

export interface ChatMessage {
  id: string;
  authorId: string;
  author: string;
  teacher: boolean;
  /** Sent from this device. */
  mine: boolean;
  text: string;
  /** Epoch ms */
  at: number;
}

/** What goes over the wire — the author comes from the sending participant, not the payload. */
export type ChatWire = Pick<ChatMessage, 'id' | 'text' | 'at'>;

export interface ChatTransport {
  send(msg: ChatWire): void;
  /** Returns an unsubscribe function. */
  subscribe(handler: (msg: ChatMessage) => void): () => void;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const encodeChat = (msg: ChatWire) => encoder.encode(JSON.stringify(msg));

export function decodeChat(payload: Uint8Array): ChatWire | null {
  try {
    const msg = JSON.parse(decoder.decode(payload)) as Partial<ChatWire>;
    if (typeof msg.id !== 'string' || typeof msg.text !== 'string' || typeof msg.at !== 'number') return null;
    return { id: msg.id, text: msg.text.slice(0, CHAT_MAX_LENGTH), at: msg.at };
  } catch {
    return null;
  }
}

export const chatId = () => Math.random().toString(36).slice(2, 10);

/* ---------- Mock mode ---------- */

const OPENERS = [
  { author: 'Karim H.', text: 'Good morning everyone 👋' },
  { author: 'Lina M.', text: 'Can you hear me okay?' },
];
const REPLIES = [
  'Makes sense, thanks!',
  'Could you repeat the last part please?',
  'Agreed 👍',
  'I had the same question.',
  'Is this going to be on the exam?',
];

/**
 * A pretend classroom for mock mode: a couple of classmates say hello, then one
 * of them replies a moment after you send something.
 */
export function demoChatTransport(teacherName: string, isTeacher: boolean): ChatTransport {
  const classmates = isTeacher ? ['Karim H.', 'Lina M.', 'Yasmine B.'] : ['Karim H.', 'Lina M.'];
  const handlers = new Set<(m: ChatMessage) => void>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const emit = (author: string, text: string, teacher = false) => {
    const msg: ChatMessage = { id: chatId(), authorId: author, author, teacher, mine: false, text, at: Date.now() };
    handlers.forEach((h) => h(msg));
  };
  const later = (ms: number, fn: () => void) => {
    const t = setTimeout(() => { timers.delete(t); fn(); }, ms);
    timers.add(t);
  };
  let replies = 0;

  return {
    send: () => {
      const author = classmates[replies % classmates.length]!;
      const text = REPLIES[replies % REPLIES.length]!;
      replies++;
      later(1800 + Math.random() * 1500, () => emit(author, text));
    },
    subscribe: (handler) => {
      handlers.add(handler);
      if (handlers.size === 1) {
        OPENERS.forEach((o, i) => later(3500 + i * 4000, () => emit(o.author, o.text)));
        if (!isTeacher) later(12_000, () => emit(teacherName, 'Feel free to ask questions here at any time.', true));
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
