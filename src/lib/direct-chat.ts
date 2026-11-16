/**
 * One-to-one chats between contacts. The API saves everything; live delivery is
 * LiveKit: each open app sits in its user's own "inbox" room (listen-only), and
 * the server sends events into it on the `chat` data topic. Shared by both apps.
 */
import { colors } from '@/theme';
import type { DirectMessage } from './types';

export const CHAT_TOPIC = 'chat';

/** Same list as the server accepts. */
export const CHAT_REACTIONS = ['❤️', '😂', '👍', '😮', '😢', '🙏', '🔥', '👏'] as const;

/** Chat colour themes: the accent paints your bubbles, the header and the send button. */
export const CHAT_THEMES = [
  { id: 'default', name: 'Halaqa', emoji: '💬', accent: '' },
  { id: 'ocean', name: 'Ocean', emoji: '🌊', accent: '#0284C7' },
  { id: 'forest', name: 'Forest', emoji: '🌲', accent: '#15803D' },
  { id: 'sunset', name: 'Sunset', emoji: '🌅', accent: '#EA580C' },
  { id: 'rose', name: 'Rose', emoji: '🌹', accent: '#E11D48' },
  { id: 'grape', name: 'Grape', emoji: '🍇', accent: '#7C3AED' },
  { id: 'midnight', name: 'Midnight', emoji: '🌙', accent: '#334155' },
  { id: 'gold', name: 'Gold', emoji: '✨', accent: '#B45309' },
] as const;

export type ChatThemeId = (typeof CHAT_THEMES)[number]['id'];

/** The accent colour of a chat's theme ("Halaqa" follows the app's own primary, light or dark). */
export function chatAccent(theme: string | undefined) {
  const t = CHAT_THEMES.find((x) => x.id === theme);
  return t?.accent || colors.primary;
}

export type ChatEvent =
  | { type: 'message'; conversationId: string; message: DirectMessage }
  | { type: 'reaction'; conversationId: string; message: DirectMessage }
  | { type: 'typing'; conversationId: string; userId: string }
  | { type: 'read'; conversationId: string; userId: string; at: string }
  | { type: 'theme'; conversationId: string; theme: string; userId: string };

const decoder = new TextDecoder();

/** Only well-formed events get through; anything else is dropped. */
export function decodeChatEvent(payload: Uint8Array): ChatEvent | null {
  try {
    const e = JSON.parse(decoder.decode(payload)) as Partial<ChatEvent> & Record<string, unknown>;
    if (typeof e.conversationId !== 'string') return null;
    switch (e.type) {
      case 'message':
      case 'reaction':
        return e.message && typeof e.message === 'object' && typeof (e.message as DirectMessage).id === 'string' ? (e as ChatEvent) : null;
      case 'typing':
        return typeof e.userId === 'string' ? (e as ChatEvent) : null;
      case 'read':
        return typeof e.userId === 'string' && typeof e.at === 'string' ? (e as ChatEvent) : null;
      case 'theme':
        return typeof e.theme === 'string' ? (e as ChatEvent) : null;
      default:
        return null;
    }
  } catch {
    return null;
  }
}

/* ---------- Demo mode: the mock API plays the server's part ---------- */

const demoListeners = new Set<(e: ChatEvent) => void>();

export function emitDemoChat(e: ChatEvent) {
  // Like the network: arrives a moment later, never inside the caller's own update.
  setTimeout(() => demoListeners.forEach((l) => l(e)), 0);
}

export function onDemoChat(listener: (e: ChatEvent) => void) {
  demoListeners.add(listener);
  return () => { demoListeners.delete(listener); };
}

/* ---------- Small helpers for the chat screens ---------- */

export const newClientId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** How long a "typing…" lasts after the last signal; apps signal every TYPING_EVERY_MS while typing. */
export const TYPING_SHOWN_MS = 6000;
export const TYPING_EVERY_MS = 3000;

export const isImage = (a: { mimeType: string | null; name: string }) =>
  (a.mimeType ?? '').startsWith('image/') || /\.(png|jpe?g|gif|webp|heic|avif)$/i.test(a.name);

export function formatBytes(n: number) {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** The timeline's day separators: "Today", "Yesterday", "Monday", "12 Nov 2026". */
export function dayLabel(iso: string, now = new Date()) {
  const d = new Date(iso);
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}

export const sameDay = (a: string, b: string) => startOfDay(new Date(a)) === startOfDay(new Date(b));

/** "14:05" */
export const clockTime = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

/** The chat list's time: the clock today, else the day. */
export function listTime(iso: string) {
  return sameDay(iso, new Date().toISOString()) ? clockTime(iso) : dayLabel(iso);
}

/** One line for the chat list. */
export function previewOf(m: DirectMessage | null, myId: string | undefined) {
  if (!m) return 'Say hello 👋';
  const who = m.senderId === myId ? 'You: ' : '';
  if (m.text) return who + m.text;
  if (m.attachment) return `${who}${isImage(m.attachment) ? '📷 Photo' : `📎 ${m.attachment.name}`}`;
  return who;
}
