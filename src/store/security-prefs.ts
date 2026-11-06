import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { BiometricMethod } from '@/lib/biometrics';

/**
 * What Halaqa remembers about an account's biometric lock on this device.
 * Metadata only — fingerprints and face data never leave the phone's secure
 * hardware, and the app has no way to read them.
 */
export interface BiometricRecord {
  enabled: boolean;
  /** Which sensor the phone offered when the lock was turned on. */
  method: BiometricMethod | null;
  /** ISO date-time the lock was last turned on. */
  enabledAt: string | null;
  /** ISO date-time this account was offered the lock after signing in — it's only offered once. */
  offeredAt: string | null;
}

const EMPTY: BiometricRecord = { enabled: false, method: null, enabledAt: null, offeredAt: null };

interface SecurityPrefsState {
  /** Per account (user id), so a shared phone keeps each person's choice. */
  biometrics: Record<string, BiometricRecord>;
  hydrated: boolean;
  enableBiometric: (userId: string, method: BiometricMethod | null) => void;
  disableBiometric: (userId: string) => void;
  markOffered: (userId: string) => void;
}

const update = (s: SecurityPrefsState, userId: string, patch: Partial<BiometricRecord>) => ({
  biometrics: { ...s.biometrics, [userId]: { ...EMPTY, ...s.biometrics[userId], ...patch } },
});

export const useSecurityPrefs = create<SecurityPrefsState>()(
  persist(
    (set) => ({
      biometrics: {},
      hydrated: false,
      enableBiometric: (userId, method) =>
        set((s) => update(s, userId, { enabled: true, method, enabledAt: new Date().toISOString() })),
      disableBiometric: (userId) => set((s) => update(s, userId, { enabled: false })),
      markOffered: (userId) => set((s) => update(s, userId, { offeredAt: new Date().toISOString() })),
    }),
    {
      name: 'halaqa-security-prefs',
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ biometrics }) => ({ biometrics }),
      // v1 only had an unused UI toggle (`biometricEnabled`) that was never enforced — start fresh.
      migrate: () => ({ biometrics: {} }),
      onRehydrateStorage: () => () => useSecurityPrefs.setState({ hydrated: true }),
    },
  ),
);

/** The current account's record (stable reference while unchanged, so safe as a selector). */
export const biometricRecordOf = (s: SecurityPrefsState, userId: string | undefined) =>
  (userId ? s.biometrics[userId] : undefined) ?? EMPTY;
