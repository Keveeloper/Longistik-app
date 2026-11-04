import { create } from 'zustand';

interface AvisosState {
  /** Bumped when a notification arrives with the app open: the bell and the list reload. */
  version: number;
  refrescar: () => void;
}

export const useAvisosStore = create<AvisosState>()((set) => ({
  version: 0,
  refrescar: () => set((s) => ({ version: s.version + 1 })),
}));
