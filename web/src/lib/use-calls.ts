import { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { api } from './api';
import { INCOMING_POLL_MS } from './calls';
import { alert } from './dialog';
import type { Person } from './types';

/** Rings someone and opens the call page. */
export function useStartCall() {
  const navigate = useNavigate();
  return useCallback(async (person: Person) => {
    try {
      const call = await api.startCall(person.id);
      navigate(`/call/${call.id}`);
    } catch (e) {
      alert('Couldn’t call', e instanceof Error ? e.message : 'Please try again.');
    }
  }, [navigate]);
}

/** Pages an incoming call must not cover: a live class, an exam, or another call. */
const BUSY = /^\/(classroom|exam\/take|call)\//;

/** While signed in and the tab is visible: opens the call page when someone calls you. */
export function useIncomingCalls() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const busy = useRef(false);
  useEffect(() => {
    busy.current = BUSY.test(pathname);
  }, [pathname]);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    let alive = true;
    const check = async () => {
      if (document.visibilityState !== 'visible' || busy.current) return;
      const ringing = await api.listIncomingCalls().catch(() => []);
      const call = ringing.find((c) => !seen.current.has(c.id));
      if (!alive || !call) return;
      seen.current.add(call.id);
      navigate(`/call/${call.id}`);
    };
    void check();
    const t = setInterval(check, INCOMING_POLL_MS);
    document.addEventListener('visibilitychange', check);
    return () => { alive = false; clearInterval(t); document.removeEventListener('visibilitychange', check); };
  }, [navigate]);
}
