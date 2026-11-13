import { useCallback } from 'react';
import { useNavigate } from 'react-router';

/**
 * router.back() for the web: goes back in history when there is somewhere to go
 * back to inside the app, and to `fallback` when the page was opened directly.
 */
export function useBack(fallback = '/') {
  const navigate = useNavigate();
  return useCallback(() => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(fallback, { replace: true });
  }, [navigate, fallback]);
}
