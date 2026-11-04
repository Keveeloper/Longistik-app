import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { User } from '../services/auth.service';
import { preferencesStorage } from '../storage/preferencesStorage';

interface AuthState {
  token: string | null;
  user: User | null;
  /** Why the session was closed without the user asking (expired, deactivated); shown on the login. */
  notice: string | null;
  /** False until the persisted session has been read from storage. */
  hasHydrated: boolean;
  setSession: (token: string, user: User) => void;
  /** Fresh profile from `GET /mobile/me`. */
  setUser: (user: User) => void;
  logout: (notice?: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      notice: null,
      hasHydrated: false,
      setSession: (token, user) => set({ token, user, notice: null }),
      setUser: (user) => set({ user }),
      logout: (notice) => set({ token: null, user: null, notice: notice ?? null }),
    }),
    {
      name: 'auth',
      // v1: sessions from the real /mobile/auth/login. Older (mock) sessions are dropped.
      version: 1,
      migrate: () => ({ token: null, user: null }),
      storage: createJSONStorage(() => preferencesStorage),
      // Only the session is persisted, not runtime flags
      partialize: ({ token, user }) => ({ token, user }),
      onRehydrateStorage: () => () => useAuthStore.setState({ hasHydrated: true }),
    }
  )
);
