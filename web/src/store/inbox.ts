// The bell: the signed-in user's notifications, polled from the server (or demo store).
import { create } from 'zustand';
import { api } from '@/lib/api';
import type { AppNotification, NotificationKind } from '@/lib/types';
import { useNotificationPrefs, type NotificationKey } from './notification-prefs';

/** Which setting on the Notifications screen controls pop-ups of each kind. */
export const PREF_FOR_KIND: Record<NotificationKind, NotificationKey> = {
  exam_submitted: 'examSubmissions',
  exam_graded: 'examGrades',
};

interface InboxState {
  items: AppNotification[];
  unread: number;
  loaded: boolean;
  /** New since the last check, shown as pop-ups until dismissed. */
  toasts: AppNotification[];
  refresh: () => Promise<void>;
  markRead: (id: string) => void;
  markAllRead: () => void;
  dismiss: (id: string) => void;
  reset: () => void;
}

/** Ids already seen on this page load, so a pop-up shows once. */
let seen = new Set<string>();

function wanted(n: AppNotification) {
  const { enabled, prefs } = useNotificationPrefs.getState();
  return enabled && prefs[PREF_FOR_KIND[n.kind]] !== false;
}

/** A system notification when the tab is in the background and the browser allows it. */
function systemAlert(n: AppNotification) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted' || !document.hidden) return false;
  try {
    const alert = new Notification(n.title, { body: n.body ?? undefined, tag: n.id, icon: '/favicon.png' });
    alert.onclick = () => {
      window.focus();
      if (n.link) window.location.assign(n.link);
      useInbox.getState().markRead(n.id);
    };
    return true;
  } catch {
    return false;
  }
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
    const popups = first ? [] : fresh.filter(wanted).filter((n) => !systemAlert(n));
    set((s) => ({
      items: inbox.items,
      unread: inbox.unread,
      loaded: true,
      toasts: [...popups, ...s.toasts].slice(0, 3),
    }));
  },

  markRead: (id) => {
    const n = get().items.find((x) => x.id === id);
    set((s) => ({
      toasts: s.toasts.filter((t) => t.id !== id),
      ...(n && !n.readAt ? {
        items: s.items.map((x) => (x.id === id ? { ...x, readAt: new Date().toISOString() } : x)),
        unread: Math.max(0, s.unread - 1),
      } : {}),
    }));
    if (n && !n.readAt) api.markNotificationRead(id).catch(() => {});
  },

  markAllRead: () => {
    const now = new Date().toISOString();
    set((s) => ({ items: s.items.map((x) => (x.readAt ? x : { ...x, readAt: now })), unread: 0, toasts: [] }));
    api.markAllNotificationsRead().catch(() => {});
  },

  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  reset: () => {
    seen = new Set();
    set({ items: [], unread: 0, loaded: false, toasts: [] });
  },
}));
