import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Company } from '../services/companies.service';
import { preferencesStorage } from '../storage/preferencesStorage';
import { useAuthStore } from './auth.store';

interface CompanyState {
  /** Company chosen on the first screen; its `apiUrl` is the backend for login and everything else. */
  company: Company | null;
  /** False until the persisted choice has been read from storage. */
  hasHydrated: boolean;
  setCompany: (company: Company) => void;
  /** Back to the selector. A session belongs to one company, so it is closed too. */
  clearCompany: () => void;
}

export const useCompanyStore = create<CompanyState>()(
  persist(
    (set) => ({
      company: null,
      hasHydrated: false,
      setCompany: (company) => set({ company }),
      clearCompany: () => {
        useAuthStore.getState().logout();
        set({ company: null });
      },
    }),
    {
      name: 'company',
      storage: createJSONStorage(() => preferencesStorage),
      partialize: ({ company }) => ({ company }),
      onRehydrateStorage: () => () => useCompanyStore.setState({ hasHydrated: true }),
    }
  )
);
