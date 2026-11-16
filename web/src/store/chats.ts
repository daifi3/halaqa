import { create } from 'zustand';
import { api } from '@/lib/api';
import { TYPING_SHOWN_MS, type ChatEvent } from '@/lib/direct-chat';
import type { Conversation, DirectMessage } from '@/lib/types';

/** A message as the screen holds it: saved, or still on its way. */
export type ChatItem = DirectMessage & { status?: 'sending' | 'failed' };

interface ChatsState {
  conversations: Record<string, Conversation>;
  /** Oldest first. */
  messages: Record<string, ChatItem[]>;
  hasMore: Record<string, boolean>;
  /** Until when the other person counts as typing, per chat. */
  typing: Record<string, number>;
  /** The chat on screen right now: its messages count as read. */
  activeId: string | null;
  listLoaded: boolean;

  setConversations: (list: Conversation[]) => void;
  upsertConversation: (c: Conversation) => void;
  patchConversation: (id: string, patch: Partial<Conversation>) => void;
  setMessages: (id: string, newestFirst: DirectMessage[], hasMore: boolean) => void;
  prependOlder: (id: string, newestFirst: DirectMessage[], hasMore: boolean) => void;
  /** Adds or replaces (by id, or a pending copy's clientId). */
  putMessage: (m: ChatItem) => void;
  setStatus: (conversationId: string, clientId: string, status: ChatItem['status']) => void;
  setActive: (id: string | null) => void;
  applyEvent: (e: ChatEvent, myId: string) => void;
  reset: () => void;
}

const sortConv = (c: Conversation) => c.lastMessageAt ?? c.createdAt;

export const useChats = create<ChatsState>()((set, get) => ({
  conversations: {},
  messages: {},
  hasMore: {},
  typing: {},
  activeId: null,
  listLoaded: false,

  setConversations: (list) => set({ conversations: Object.fromEntries(list.map((c) => [c.id, c])), listLoaded: true }),
  upsertConversation: (c) => set((s) => ({ conversations: { ...s.conversations, [c.id]: c } })),
  patchConversation: (id, patch) => set((s) => {
    const c = s.conversations[id];
    return c ? { conversations: { ...s.conversations, [id]: { ...c, ...patch } } } : {};
  }),

  setMessages: (id, newestFirst, hasMore) => set((s) => {
    // Keep messages still sending; they're not on the server yet.
    const pending = (s.messages[id] ?? []).filter((m) => m.status);
    const saved = [...newestFirst].reverse();
    const ids = new Set(saved.map((m) => m.clientId));
    return {
      messages: { ...s.messages, [id]: [...saved, ...pending.filter((p) => !ids.has(p.clientId))] },
      hasMore: { ...s.hasMore, [id]: hasMore },
    };
  }),

  prependOlder: (id, newestFirst, hasMore) => set((s) => {
    const have = new Set((s.messages[id] ?? []).map((m) => m.id));
    const older = [...newestFirst].reverse().filter((m) => !have.has(m.id));
    return { messages: { ...s.messages, [id]: [...older, ...(s.messages[id] ?? [])] }, hasMore: { ...s.hasMore, [id]: hasMore } };
  }),

  putMessage: (m) => set((s) => {
    const list = s.messages[m.conversationId] ?? [];
    const i = list.findIndex((x) => x.id === m.id || x.clientId === m.clientId);
    const next = i >= 0 ? list.map((x, j) => (j === i ? m : x)) : [...list, m];
    next.sort((a, b) => (a.status && !b.status ? 1 : !a.status && b.status ? -1 : a.createdAt.localeCompare(b.createdAt)));
    return { messages: { ...s.messages, [m.conversationId]: next } };
  }),

  setStatus: (conversationId, clientId, status) => set((s) => ({
    messages: {
      ...s.messages,
      [conversationId]: (s.messages[conversationId] ?? []).map((m) => (m.clientId === clientId ? { ...m, status } : m)),
    },
  })),

  setActive: (id) => set({ activeId: id }),

  applyEvent: (e, myId) => {
    const s = get();
    const c = s.conversations[e.conversationId];
    switch (e.type) {
      case 'message': {
        s.putMessage(e.message);
        const fromThem = e.message.senderId !== myId;
        const typing = { ...get().typing };
        if (fromThem) delete typing[e.conversationId];
        set({ typing });
        if (!c) {
          // A chat this app hasn't seen yet (someone wrote first): fetch it.
          api.getChat(e.conversationId).then(get().upsertConversation).catch(() => {});
          return;
        }
        s.patchConversation(e.conversationId, {
          lastMessage: e.message,
          lastMessageAt: e.message.createdAt,
          unread: fromThem && s.activeId !== e.conversationId ? c.unread + 1 : fromThem ? c.unread : 0,
        });
        return;
      }
      case 'reaction':
        s.putMessage(e.message);
        return;
      case 'typing':
        if (e.userId !== myId) set((st) => ({ typing: { ...st.typing, [e.conversationId]: Date.now() + TYPING_SHOWN_MS } }));
        return;
      case 'read':
        if (!c) return;
        if (e.userId === myId) s.patchConversation(e.conversationId, { unread: 0 });
        else s.patchConversation(e.conversationId, { otherReadAt: e.at });
        return;
      case 'theme':
        s.patchConversation(e.conversationId, { theme: e.theme });
        return;
    }
  },

  reset: () => set({ conversations: {}, messages: {}, hasMore: {}, typing: {}, activeId: null, listLoaded: false }),
}));

/** Chats, most recent first. */
export const sortedChats = (conversations: Record<string, Conversation>) =>
  Object.values(conversations).sort((a, b) => sortConv(b).localeCompare(sortConv(a)));

export const totalUnread = (conversations: Record<string, Conversation>) =>
  Object.values(conversations).reduce((n, c) => n + c.unread, 0);

/** Reloads the chat list (on connect, reconnect, and when a screen comes back into view). */
export async function refreshChats() {
  try {
    useChats.getState().setConversations(await api.listChats());
  } catch {
    // Offline: keep what we have.
  }
}
