import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { User } from '../services/auth.service';
import { preferencesStorage } from '../storage/preferencesStorage';

interface AuthState {
  token: string | null;
  user: User | null;
  /** False until the persisted session has been read from storage. */
  hasHydrated: boolean;
  setSession: (token: string, user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      hasHydrated: false,
      setSession: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
    }),
    {
      name: 'auth',
      storage: createJSONStorage(() => preferencesStorage),
      // Only the session is persisted, not runtime flags
      partialize: ({ token, user }) => ({ token, user }),
      onRehydrateStorage: () => () => useAuthStore.setState({ hasHydrated: true }),
    }
  )
);
