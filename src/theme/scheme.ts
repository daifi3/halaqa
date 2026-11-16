import { reloadAppAsync } from 'expo';
import { File, Paths } from 'expo-file-system';
import { Appearance } from 'react-native';

/**
 * Light / dark mode. The palette is picked once, synchronously, before any screen
 * builds its styles — so the choice is read from a small file (not AsyncStorage,
 * which is async) and changing it restarts the JS app to repaint everything.
 */
export type ThemePref = 'system' | 'light' | 'dark';
export type Scheme = 'light' | 'dark';

const prefFile = () => new File(Paths.document, 'theme-pref.txt');

export function readThemePref(): ThemePref {
  try {
    const file = prefFile();
    if (!file.exists) return 'system';
    const value = file.textSync().trim();
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

export const resolveScheme = (pref: ThemePref): Scheme =>
  pref === 'system' ? (Appearance.getColorScheme() === 'dark' ? 'dark' : 'light') : pref;

/** Saves the choice and restarts the app in the new colours. */
export async function setThemePref(pref: ThemePref) {
  const file = prefFile();
  if (!file.exists) file.create();
  await file.write(pref);
  await reloadAppAsync('Theme changed');
}
