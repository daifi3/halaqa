// Phone notifications: registers this phone with the backend (Expo push token), keeps the bell
// fresh, and opens the right screen when a notification is tapped.
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { useInbox, wantsKind } from '@/store/inbox';
import { useNotificationPrefs } from '@/store/notification-prefs';
import { useSession } from '@/store/session';
import { api } from './api';
import { getPushToken, setPushToken } from './push-token';
import type { NotificationKind } from './types';

const POLL_MS = 30_000;
const native = Platform.OS === 'ios' || Platform.OS === 'android';

type PushData = { notificationId?: string; kind?: NotificationKind; link?: string };

if (native) {
  // While the app is open: show the banner (unless that kind is turned off) and refresh the bell.
  Notifications.setNotificationHandler({
    handleNotification: async (n) => {
      const data = n.request.content.data as PushData;
      void useInbox.getState().refresh();
      const show = wantsKind(data?.kind);
      return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: show, shouldSetBadge: true };
    },
  });
}

/** The kinds turned off in settings, which the server then doesn't push to this phone. */
function mutedKinds(): NotificationKind[] {
  return (['exam_submitted', 'exam_graded'] as const).filter((k) => !wantsKind(k));
}

/**
 * Asks for permission (once) and registers this phone. Returns the token, or null when pushes
 * aren't possible here: permission refused, Expo Go on Android, an emulator without Google
 * Play, no FCM credentials in the build, or offline. The bell works either way.
 */
async function register(): Promise<string | null> {
  if (!native) return null;
  try {
    if (Platform.OS === 'android') {
      // Android 13+ only shows the permission prompt once a channel exists.
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Halaqa',
        importance: AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#4B44E0',
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return null;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await api.registerPushToken({ token, platform: Platform.OS, muted: mutedKinds() });
    return token;
  } catch (e) {
    console.warn('Push notifications unavailable:', e instanceof Error ? e.message : e);
    return null;
  }
}

/** Opens what a tapped notification is about. */
function open(data: PushData | undefined) {
  if (data?.notificationId) useInbox.getState().markRead(data.notificationId);
  if (data?.link) router.push(data.link as Href);
}

/** Mounted once while signed in (the tabs layout). */
export function useNotifications() {
  const userId = useSession((s) => s.user?.id);
  const enabled = useNotificationPrefs((s) => s.enabled);
  const prefs = useNotificationPrefs((s) => s.prefs);

  // The bell: now, every 30 s while the app is open, and whenever it comes back.
  useEffect(() => {
    const inbox = useInbox.getState();
    inbox.reset();
    if (!userId) return;
    void inbox.refresh();
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void useInbox.getState().refresh();
    }, POLL_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void useInbox.getState().refresh();
    });
    return () => { clearInterval(timer); sub.remove(); };
  }, [userId]);

  // Pushes: registered while on, re-sent when a setting changes, removed when turned off.
  useEffect(() => {
    if (!userId || !native) return;
    let cancelled = false;
    if (enabled) {
      void register().then((token) => { if (!cancelled) setPushToken(token); });
    } else {
      const token = getPushToken();
      setPushToken(null);
      if (token) api.removePushToken(token).catch(() => {});
    }
    return () => { cancelled = true; };
  }, [userId, enabled, prefs]);

  // Taps: the one that launched the app, then each one while it runs (the hook updates on every tap).
  const handled = useRef<string | null>(null);
  const last = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!native || !userId || !last) return;
    const id = last.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;
    if (last.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
      open(last.notification.request.content.data as PushData);
      Notifications.clearLastNotificationResponseAsync().catch(() => {});
    }
  }, [last, userId]);
}
