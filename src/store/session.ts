import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { User } from '@/lib/types';

interface SessionState {
  user: User | null;
  token: string | null;
  hydrated: boolean;
  setSession: (user: User, token: string) => void;
  updateUser: (user: User) => void;
  signOut: () => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      hydrated: false,
      setSession: (user, token) => set({ user, token }),
      updateUser: (user) => set({ user }),
      signOut: () => set({ user: null, token: null }),
    }),
    {
      name: 'halaqa-session',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ user, token }) => ({ user, token }),
      onRehydrateStorage: () => () => useSession.setState({ hydrated: true }),
    },
  ),
);

export const useIsTeacher = () => useSession((s) => s.user?.role === 'teacher');
