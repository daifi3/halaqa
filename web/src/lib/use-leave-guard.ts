import { useEffect } from 'react';
import { useBlocker } from 'react-router';

/**
 * usePreventRemove for the web: while `active`, leaving the page — in-app
 * navigation or closing / reloading the tab — has to go through `confirm`.
 * Call `proceed()` from your dialog to leave anyway, or `stay()` to cancel.
 */
export function useLeaveGuard(active: boolean, confirm: (proceed: () => void, stay: () => void) => void) {
  const blocker = useBlocker(({ currentLocation, nextLocation }) => active && currentLocation.pathname !== nextLocation.pathname);

  useEffect(() => {
    if (blocker.state === 'blocked') confirm(() => blocker.proceed(), () => blocker.reset());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react to the blocker only
  }, [blocker.state]);

  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [active]);

  return blocker;
}
