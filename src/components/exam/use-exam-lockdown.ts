import { ExamLock } from '@/modules/exam-lock';
import { requireOptionalNativeModule } from 'expo';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

// expo-screen-capture throws on import when its native code is missing (an older
// dev build), and every route loads at startup — so only load it when present.
const ScreenCapture: typeof import('expo-screen-capture') | null = requireOptionalNativeModule('ExpoScreenCapture')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ? require('expo-screen-capture')
  : null;

const CAPTURE_KEY = 'exam';
/** Time outside the app that still counts as an accident (a system dialog, a stray swipe). */
const AWAY_GRACE_MS = 2000;
const PIN_POLL_MS = 250;
const PIN_TIMEOUT_MS = 10_000;

/**
 * Pins the app before an exam starts and waits for the student's answer to
 * Android's "Pin this app?" prompt. Resolves true when pinned. Also clears the
 * clipboard so nothing copied earlier can be pasted in.
 *
 * Must run before the attempt exists: the prompt briefly takes focus from the
 * app, which would otherwise count as leaving the exam.
 */
export async function prepareExamLockdown(): Promise<boolean> {
  await Clipboard.setStringAsync('').catch(() => {});
  if (!ExamLock.supported) return false;
  if (ExamLock.isPinned()) return true;
  await ExamLock.pin().catch(() => {});

  return new Promise((resolve) => {
    let left = false;
    let declinedTimer: ReturnType<typeof setTimeout> | undefined;
    const started = Date.now();
    const done = (pinned: boolean) => {
      clearInterval(poll);
      clearTimeout(declinedTimer);
      sub.remove();
      resolve(pinned);
    };
    const poll = setInterval(() => {
      if (ExamLock.isPinned()) done(true);
      else if (Date.now() - started > PIN_TIMEOUT_MS) done(false);
    }, PIN_POLL_MS);
    // Back from the prompt without being pinned means the student declined.
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') left = true;
      else if (left) declinedTimer = setTimeout(() => done(ExamLock.isPinned()), 800);
    });
  });
}

/**
 * Keeps a running exam locked down until it ends:
 * - screenshots and screen recording are blocked (blank on Android, prevented on iOS 13+),
 *   and the app-switcher preview is hidden;
 * - leaving the app for longer than a moment calls `onLeft`, which submits the exam;
 * - the app stays pinned (Android), and `pinned` turns false if the student unpins it.
 * Everything is released once `live` turns false.
 */
export function useExamLockdown(live: boolean, onLeft: () => void) {
  const [pinned, setPinned] = useState(ExamLock.isPinned);
  const onLeftRef = useRef(onLeft);
  useEffect(() => {
    onLeftRef.current = onLeft;
  });

  useEffect(() => {
    if (!live) return;
    ScreenCapture?.preventScreenCaptureAsync(CAPTURE_KEY).catch(() => {});
    if (Platform.OS === 'ios') ScreenCapture?.enableAppSwitcherProtectionAsync(0.9).catch(() => {});

    let awayAt: number | null = null;
    const sub = AppState.addEventListener('change', (state) => {
      // iOS reports 'inactive' for Control Centre and the notification banner — only 'background' is leaving.
      if (state === 'background') awayAt ??= Date.now();
      else if (state === 'active' && awayAt !== null) {
        if (Date.now() - awayAt > AWAY_GRACE_MS) onLeftRef.current();
        awayAt = null;
      }
    });
    const poll = ExamLock.supported ? setInterval(() => setPinned(ExamLock.isPinned()), 1000) : undefined;

    return () => {
      sub.remove();
      clearInterval(poll);
      ScreenCapture?.allowScreenCaptureAsync(CAPTURE_KEY).catch(() => {});
      if (Platform.OS === 'ios') ScreenCapture?.disableAppSwitcherProtectionAsync().catch(() => {});
      ExamLock.unpin().catch(() => {});
    };
  }, [live]);

  return { pinned: ExamLock.supported ? pinned : null };
}
