import { router, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { api } from './api';
import { INCOMING_POLL_MS } from './calls';

/** Screens an incoming call must not cover: a live class, an exam, or another call. */
const BUSY = [/^\/classroom\//, /^\/exam\/take\//, /^\/call\//];

/**
 * While signed in and the app is in front: checks for calls ringing for you and opens
 * the call screen. (A closed app learns about calls from the push notification instead.)
 */
export function useIncomingCalls() {
  const pathname = usePathname();
  const busy = useRef(false);
  useEffect(() => {
    busy.current = BUSY.some((r) => r.test(pathname));
  }, [pathname]);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    let alive = true;
    const check = async () => {
      if (AppState.currentState !== 'active' || busy.current) return;
      const ringing = await api.listIncomingCalls().catch(() => []);
      const call = ringing.find((c) => !seen.current.has(c.id));
      if (!alive || !call) return;
      seen.current.add(call.id);
      router.push(`/call/${call.id}`);
    };
    void check();
    const t = setInterval(check, INCOMING_POLL_MS);
    return () => { alive = false; clearInterval(t); };
  }, []);
}
