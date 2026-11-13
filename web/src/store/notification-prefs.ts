import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type NotificationKey =
  | 'classReminders'
  | 'homeworkAssigned'
  | 'homeworkDue'
  | 'courseInvites'
  | 'documentsShared'
  | 'recordingsReady'
  | 'examSubmissions'
  | 'examGrades';

type Prefs = Record<NotificationKey, boolean>;

interface NotificationPrefsState {
  enabled: boolean;
  prefs: Prefs;
  setEnabled: (v: boolean) => void;
  toggle: (key: NotificationKey) => void;
}

const DEFAULT_PREFS: Prefs = {
  classReminders: true,
  homeworkAssigned: true,
  homeworkDue: true,
  courseInvites: true,
  documentsShared: true,
  recordingsReady: false,
  examSubmissions: true,
  examGrades: true,
};

export const useNotificationPrefs = create<NotificationPrefsState>()(
  persist(
    (set) => ({
      enabled: true,
      prefs: DEFAULT_PREFS,
      setEnabled: (v) => set({ enabled: v }),
      toggle: (key) => set((s) => ({ prefs: { ...s.prefs, [key]: !s.prefs[key] } })),
    }),
    {
      name: 'halaqa-notification-prefs',
      storage: createJSONStorage(() => localStorage),
      // Settings added later (exam alerts) start at their default instead of off.
      merge: (saved, current) => {
        const s = (saved ?? {}) as Partial<NotificationPrefsState>;
        return { ...current, ...s, prefs: { ...DEFAULT_PREFS, ...s.prefs } };
      },
    },
  ),
);
