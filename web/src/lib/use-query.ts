import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Tiny data-fetching hook: loads when the screen opens and again when the tab
 * regains focus (the web's "screen focus"), and supports a manual refresh.
 */
export function useQuery<T>(fetcher: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const load = useCallback(async (mode: 'refresh' | 'silent' = 'silent') => {
    if (mode === 'refresh') setRefreshing(true);
    try {
      setError(null);
      setData(await fetcherRef.current());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void load('silent');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when the caller's keys change
  }, [load, ...deps]);

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') void load('silent'); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  return { data, setData, error, loading, refreshing, refresh: () => load('refresh'), reload: () => load('silent') };
}
