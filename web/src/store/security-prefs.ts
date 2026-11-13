import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * What Halaqa remembers about an account's device lock in this browser.
 * Only the id of the unlock key the device created — biometric data never
 * leaves the device, and the browser has no way to read it.
 */
export interface BiometricRecord {
  enabled: boolean;
  credentialId: string | null;
  /** ISO date-time the lock was last turned on. */
  enabledAt: string | null;
  /** ISO date-time this account was offered the lock after signing in — it's only offered once. */
  offeredAt: string | null;
}

const EMPTY: BiometricRecord = { enabled: false, credentialId: null, enabledAt: null, offeredAt: null };

interface SecurityPrefsState {
  /** Per account (user id), so a shared computer keeps each person's choice. */
  biometrics: Record<string, BiometricRecord>;
  enableBiometric: (userId: string, credentialId: string) => void;
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
      enableBiometric: (userId, credentialId) =>
        set((s) => update(s, userId, { enabled: true, credentialId, enabledAt: new Date().toISOString() })),
      disableBiometric: (userId) => set((s) => update(s, userId, { enabled: false, credentialId: null })),
      markOffered: (userId) => set((s) => update(s, userId, { offeredAt: new Date().toISOString() })),
    }),
    {
      name: 'halaqa-security-prefs',
      storage: createJSONStorage(() => localStorage),
      partialize: ({ biometrics }) => ({ biometrics }),
    },
  ),
);

/** The current account's record (stable reference while unchanged, so safe as a selector). */
export const biometricRecordOf = (s: SecurityPrefsState, userId: string | undefined) =>
  (userId ? s.biometrics[userId] : undefined) ?? EMPTY;
