/** Web build of the app: the same choice, kept in localStorage. See scheme.ts. */
export type ThemePref = 'system' | 'light' | 'dark';
export type Scheme = 'light' | 'dark';

const KEY = 'halaqa-theme';

export function readThemePref(): ThemePref {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

export const resolveScheme = (pref: ThemePref): Scheme =>
  pref === 'system' ? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : pref;

export async function setThemePref(pref: ThemePref) {
  try {
    localStorage.setItem(KEY, pref);
  } catch {
    // Private mode: the choice lasts until the page is closed.
  }
  window.location.reload();
}
