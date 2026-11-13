import { useEffect, useRef, useState } from 'react';

/** Time away that still counts as an accident (a notification, a stray click outside). */
const AWAY_GRACE_MS = 2000;

/** Asks for full screen. Must run inside the click that starts the exam — browsers refuse it otherwise. */
export function enterExamFullscreen() {
  const el = document.documentElement;
  if (!document.fullscreenElement && el.requestFullscreen) void el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
}

/**
 * The web's exam lockdown, the counterpart of app pinning and screenshot blocking:
 * - leaving the tab or window for more than a moment calls `onLeft`, which submits the exam;
 * - copy, cut, paste and the context menu are blocked;
 * - closing or reloading the tab asks for confirmation;
 * - `fullscreen` reports whether the exam is still full screen, so the page can warn.
 * Everything is released once `live` turns false.
 */
export function useExamLockdown(live: boolean, onLeft: () => void) {
  const [fullscreen, setFullscreen] = useState(() => !!document.fullscreenElement);
  const onLeftRef = useRef(onLeft);
  useEffect(() => {
    onLeftRef.current = onLeft;
  });

  useEffect(() => {
    if (!live) return;
    let awayAt: number | null = null;
    const away = () => { awayAt ??= Date.now(); };
    const back = () => {
      if (awayAt !== null && Date.now() - awayAt > AWAY_GRACE_MS) onLeftRef.current();
      awayAt = null;
    };
    const onVisibility = () => (document.visibilityState === 'hidden' ? away() : back());
    const block = (e: Event) => e.preventDefault();
    const onFullscreen = () => setFullscreen(!!document.fullscreenElement);
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', away);
    window.addEventListener('focus', back);
    for (const ev of ['copy', 'cut', 'paste', 'contextmenu', 'drop']) document.addEventListener(ev, block);
    document.addEventListener('fullscreenchange', onFullscreen);
    window.addEventListener('beforeunload', onBeforeUnload);
    onFullscreen();

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', away);
      window.removeEventListener('focus', back);
      for (const ev of ['copy', 'cut', 'paste', 'contextmenu', 'drop']) document.removeEventListener(ev, block);
      document.removeEventListener('fullscreenchange', onFullscreen);
      window.removeEventListener('beforeunload', onBeforeUnload);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    };
  }, [live]);

  return { fullscreen };
}
