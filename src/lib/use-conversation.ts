import { useCallback, useEffect, useRef, useState } from 'react';
import { useChats, type ChatItem } from '@/store/chats';
import { useSession } from '@/store/session';
import { api } from './api';
import { newClientId, TYPING_EVERY_MS } from './direct-chat';
import type { PickedFile } from './types';

const PAGE = 40;

/**
 * One open chat: its history (paged back in time), sending text and files with an
 * optimistic copy, reactions, typing, read receipts and the theme. `visible` says
 * whether the user can see it right now — only then do new messages count as read.
 */
export function useConversation(id: string, visible = true) {
  const myId = useSession((s) => s.user?.id) ?? '';
  const conversation = useChats((s) => s.conversations[id]);
  const messages = useChats((s) => s.messages[id]) ?? EMPTY;
  const hasMore = useChats((s) => s.hasMore[id] ?? false);
  const typingUntil = useChats((s) => s.typing[id] ?? 0);
  const [loading, setLoading] = useState(!useChats.getState().messages[id]);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resend = useRef(new Map<string, () => Promise<unknown>>());
  const lastTyping = useRef(0);

  // Load the chat and its latest messages.
  useEffect(() => {
    let alive = true;
    const store = useChats.getState();
    Promise.all([api.getChat(id), api.listChatMessages(id)])
      .then(([c, page]) => {
        if (!alive) return;
        store.upsertConversation(c);
        store.setMessages(id, page, page.length >= PAGE);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Could not open the chat'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [id]);

  // While on screen, this is the active chat: incoming messages don't add to its unread count.
  useEffect(() => {
    if (!visible) return;
    useChats.getState().setActive(id);
    return () => { if (useChats.getState().activeId === id) useChats.getState().setActive(null); };
  }, [id, visible]);

  // Mark read when a message from them is on screen that's newer than our last read.
  const last = messages.at(-1);
  const lastId = last && !last.status ? last.id : null;
  const lastFromThem = !!last && last.senderId !== myId;
  const unread = conversation?.unread ?? 0;
  const markedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!visible || !lastId || markedFor.current === lastId) return;
    if (!lastFromThem && unread === 0) return;
    markedFor.current = lastId;
    useChats.getState().patchConversation(id, { unread: 0 });
    api.markChatRead(id).catch(() => { markedFor.current = null; });
  }, [visible, lastId, lastFromThem, unread, id]);

  const loadOlder = useCallback(async () => {
    const oldest = useChats.getState().messages[id]?.find((m) => !m.status);
    if (!oldest || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const page = await api.listChatMessages(id, oldest.createdAt);
      useChats.getState().prependOlder(id, page, page.length >= PAGE);
    } catch {
      // Try again on the next scroll.
    } finally {
      setLoadingOlder(false);
    }
  }, [id, loadingOlder]);

  /** Shows the message straight away, then swaps in the saved one (or marks it failed). */
  async function deliver(local: ChatItem, run: () => Promise<ChatItem>) {
    const store = useChats.getState();
    store.putMessage(local);
    const attempt = async () => {
      store.setStatus(id, local.clientId, 'sending');
      try {
        const saved = await run();
        useChats.getState().putMessage(saved);
        resend.current.delete(local.clientId);
      } catch {
        useChats.getState().setStatus(id, local.clientId, 'failed');
      }
    };
    resend.current.set(local.clientId, attempt);
    await attempt();
  }

  function draft(clientId: string, patch: Partial<ChatItem>): ChatItem {
    return {
      id: `local-${clientId}`, conversationId: id, clientId, senderId: myId, text: null, attachment: null,
      createdAt: new Date().toISOString(), reactions: [], status: 'sending', ...patch,
    };
  }

  function send(text: string) {
    const clean = text.trim();
    if (!clean) return;
    const clientId = newClientId();
    lastTyping.current = 0;
    void deliver(draft(clientId, { text: clean }), () => api.sendChatMessage(id, { id: clientId, text: clean }));
  }

  function sendFile(file: PickedFile, caption?: string) {
    const clientId = newClientId();
    const text = caption?.trim() || undefined;
    void deliver(
      draft(clientId, { text: text ?? null, attachment: { url: file.uri, name: file.name, mimeType: file.mimeType, size: 0 } }),
      () => api.sendChatFile(id, { id: clientId, file, text }),
    );
  }

  function retry(clientId: string) {
    void resend.current.get(clientId)?.();
  }

  /** Toggle: picking your current emoji again removes it. */
  async function react(message: ChatItem, emoji: string) {
    if (message.status) return;
    const mine = message.reactions.find((r) => r.userId === myId)?.emoji;
    const next = mine === emoji ? null : emoji;
    const reactions = message.reactions.filter((r) => r.userId !== myId);
    if (next) reactions.push({ userId: myId, emoji: next });
    useChats.getState().putMessage({ ...message, reactions });
    try {
      useChats.getState().putMessage(await api.reactToMessage(id, message.id, next));
    } catch {
      useChats.getState().putMessage(message);
    }
  }

  /** Call on every keystroke; tells the other person at most every few seconds. */
  function typing() {
    const now = Date.now();
    if (now - lastTyping.current < TYPING_EVERY_MS) return;
    lastTyping.current = now;
    api.sendTyping(id).catch(() => {});
  }

  async function setTheme(theme: string) {
    const before = conversation?.theme;
    useChats.getState().patchConversation(id, { theme });
    try {
      useChats.getState().upsertConversation(await api.setChatTheme(id, theme));
    } catch {
      if (before) useChats.getState().patchConversation(id, { theme: before });
    }
  }

  return {
    myId, conversation, messages, hasMore, loading, loadingOlder, error, typingUntil,
    loadOlder, send, sendFile, retry, react, typing, setTheme,
  };
}

const EMPTY: ChatItem[] = [];

/** True while the other person is typing; turns itself off when the signal runs out. */
export function useIsTyping(until: number) {
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const left = until - Date.now();
    const on = setTimeout(() => setTyping(left > 0), 0);
    const off = left > 0 ? setTimeout(() => setTyping(false), left + 50) : undefined;
    return () => { clearTimeout(on); clearTimeout(off); };
  }, [until]);
  return typing;
}
