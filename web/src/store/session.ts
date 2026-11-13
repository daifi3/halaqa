import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AuthSession, User } from '@/lib/types';

interface SessionState {
  user: User | null;
  /** Short-lived access token sent as "Authorization: Bearer". */
  token: string | null;
  /** Single-use token that buys a new access + refresh pair when the access token expires. */
  refreshToken: string | null;
  setSession: (session: AuthSession) => void;
  setTokens: (token: string, refreshToken: string) => void;
  updateUser: (user: User) => void;
  /** Clears the session locally. Prefer `api.signOut()`, which also revokes the tokens on the server. */
  signOut: () => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      setSession: ({ user, token, refreshToken }) => set({ user, token, refreshToken }),
      setTokens: (token, refreshToken) => set({ token, refreshToken }),
      updateUser: (user) => set({ user }),
      signOut: () => set({ user: null, token: null, refreshToken: null }),
    }),
    {
      name: 'halaqa-session',
      storage: createJSONStorage(() => localStorage),
      partialize: ({ user, token, refreshToken }) => ({ user, token, refreshToken }),
    },
  ),
);

export const useIsTeacher = () => useSession((s) => s.user?.role === 'teacher');

/** The signed-in user. Only call it on screens behind the sign-in guard. */
export const useMe = () => useSession((s) => s.user)!;
