import { reloadAppAsync } from 'expo';
import { usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Appearance, AppState } from 'react-native';
import { resolveScheme } from './scheme';
import { scheme, themePref } from './index';

/** Screens a restart must never interrupt; the switch waits until you leave them. */
const BUSY = [/^\/classroom\//, /^\/exam\/take\//];

/**
 * "System" mode: when the phone switches between light and dark, restart in the
 * new colours. Checked only while the app is in front — iOS flips the scheme
 * briefly while taking app-switcher snapshots in the background.
 */
export function useFollowSystemTheme() {
  const pathname = usePathname();
  const [stale, setStale] = useState(false);

  useEffect(() => {
    if (themePref !== 'system') return;
    const check = () => {
      if (AppState.currentState === 'active') setStale(resolveScheme('system') !== scheme);
    };
    const a = Appearance.addChangeListener(check);
    const b = AppState.addEventListener('change', check);
    return () => { a.remove(); b.remove(); };
  }, []);

  const busy = BUSY.some((r) => r.test(pathname));
  useEffect(() => {
    if (stale && !busy) reloadAppAsync('System theme changed').catch(() => {});
  }, [stale, busy]);
}
