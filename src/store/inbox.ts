// The bell: the signed-in user's notifications, polled from the server (or the demo store).
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { api } from '@/lib/api';
import { getPushToken } from '@/lib/push-token';
import type { AppNotification, NotificationKind } from '@/lib/types';
import { useNotificationPrefs, type NotificationKey } from './notification-prefs';

/** Which setting on the Notifications screen controls each kind. */
export const PREF_FOR_KIND: Record<NotificationKind, NotificationKey> = {
  exam_submitted: 'examSubmissions',
  exam_graded: 'examGrades',
};

export function wantsKind(kind: NotificationKind | undefined) {
  const { enabled, prefs } = useNotificationPrefs.getState();
  return enabled && (!kind || prefs[PREF_FOR_KIND[kind]] !== false);
}

interface InboxState {
  items: AppNotification[];
  unread: number;
  loaded: boolean;
  /** New since the last check, shown as an in-app banner — only when the phone doesn't get pushes (demo mode, Expo Go). */
  toasts: AppNotification[];
  refresh: () => Promise<void>;
  markRead: (id: string) => void;
  markAllRead: () => void;
  dismiss: (id: string) => void;
  reset: () => void;
}

/** Ids already seen since the app started, so a banner shows once. */
let seen = new Set<string>();

/** The number on the app icon. */
function setBadge(unread: number) {
  if (Platform.OS !== 'web') Notifications.setBadgeCountAsync(unread).catch(() => {});
}

export const useInbox = create<InboxState>()((set, get) => ({
  items: [],
  unread: 0,
  loaded: false,
  toasts: [],

  refresh: async () => {
    let inbox;
    try {
      inbox = await api.listNotifications();
    } catch {
      return; // offline, or an older backend without notifications: keep what we have
    }
    const first = !get().loaded;
    const fresh = inbox.items.filter((n) => !n.readAt && !seen.has(n.id));
    inbox.items.forEach((n) => seen.add(n.id));
    // With pushes on, the system already showed it.
    const banners = first || getPushToken() ? [] : fresh.filter((n) => wantsKind(n.kind));
    set((s) => ({ items: inbox.items, unread: inbox.unread, loaded: true, toasts: [...banners, ...s.toasts].slice(0, 2) }));
    setBadge(inbox.unread);
  },

  markRead: (id) => {
    const n = get().items.find((x) => x.id === id);
    const wasUnread = !n || !n.readAt;
    set((s) => ({
      toasts: s.toasts.filter((t) => t.id !== id),
      ...(n && !n.readAt ? {
        items: s.items.map((x) => (x.id === id ? { ...x, readAt: new Date().toISOString() } : x)),
        unread: Math.max(0, s.unread - 1),
      } : {}),
    }));
    setBadge(get().unread);
    // Not in the list yet (opened straight from a push): the server still marks it.
    if (wasUnread) api.markNotificationRead(id).then(() => (n ? undefined : get().refresh())).catch(() => {});
  },

  markAllRead: () => {
    const now = new Date().toISOString();
    set((s) => ({ items: s.items.map((x) => (x.readAt ? x : { ...x, readAt: now })), unread: 0, toasts: [] }));
    setBadge(0);
    api.markAllNotificationsRead().catch(() => {});
  },

  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  reset: () => {
    seen = new Set();
    set({ items: [], unread: 0, loaded: false, toasts: [] });
    setBadge(0);
  },
}));
