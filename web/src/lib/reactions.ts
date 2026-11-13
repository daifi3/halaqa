/**
 * Emoji reactions in class. Like chat, they ride the LiveKit data channel on their
 * own topic and are never stored — they float up for a few seconds and are gone.
 */

export const REACTION_TOPIC = 'reaction';
export const REACTIONS = ['👍', '👏', '❤️', '😂', '🎉', '🤔', '✋'] as const;
export type ReactionEmoji = (typeof REACTIONS)[number];

export interface Reaction {
  id: string;
  emoji: ReactionEmoji;
  author: string;
  mine: boolean;
}

export interface ReactionTransport {
  send(emoji: ReactionEmoji): void;
  /** Returns an unsubscribe function. */
  subscribe(handler: (r: Reaction) => void): () => void;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const encodeReaction = (emoji: ReactionEmoji) => encoder.encode(JSON.stringify({ e: emoji }));

/** Only emojis from the fixed set are accepted, so nobody can float arbitrary text. */
export function decodeReaction(payload: Uint8Array): ReactionEmoji | null {
  try {
    const { e } = JSON.parse(decoder.decode(payload)) as { e?: string };
    return (REACTIONS as readonly string[]).includes(e ?? '') ? (e as ReactionEmoji) : null;
  } catch {
    return null;
  }
}

export const reactionId = () => Math.random().toString(36).slice(2, 10);

/** Mock mode: classmates react now and then, and someone joins in when you react. */
export function demoReactionTransport(isTeacher: boolean): ReactionTransport {
  const classmates = isTeacher ? ['Karim H.', 'Lina M.', 'Yasmine B.'] : ['Karim H.', 'Lina M.'];
  const handlers = new Set<(r: Reaction) => void>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let ambient: ReturnType<typeof setInterval> | undefined;
  const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)]!;
  const emit = (emoji: ReactionEmoji) => {
    const r: Reaction = { id: reactionId(), emoji, author: pick(classmates), mine: false };
    handlers.forEach((h) => h(r));
  };

  return {
    send: (emoji) => {
      if (Math.random() < 0.6) {
        const t = setTimeout(() => { timers.delete(t); emit(emoji); }, 700 + Math.random() * 900);
        timers.add(t);
      }
    },
    subscribe: (handler) => {
      handlers.add(handler);
      ambient ??= setInterval(() => emit(pick(['👍', '👏', '❤️', '🤔'] as const)), 9000);
      return () => {
        handlers.delete(handler);
        if (!handlers.size) {
          clearInterval(ambient);
          ambient = undefined;
          timers.forEach(clearTimeout);
          timers.clear();
        }
      };
    },
  };
}
