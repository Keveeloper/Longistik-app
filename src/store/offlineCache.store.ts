import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { preferencesStorage } from '../storage/preferencesStorage';
import { useAuthStore } from './auth.store';
import { useCompanyStore } from './company.store';

/** Most recent responses kept; older ones are dropped. */
const MAX_ENTRADAS = 60;

interface Entrada {
  data: unknown;
  /** ISO */
  guardadoEn: string;
}

interface OfflineCacheState {
  entradas: Record<string, Entrada>;
  guardar: (key: string, data: unknown) => void;
}

/**
 * Last responses of the list and detail screens, so a driver who opens the app without
 * signal still sees their manifiestos and remesas (with the date they were saved).
 */
export const useOfflineCache = create<OfflineCacheState>()(
  persist(
    (set) => ({
      entradas: {},
      guardar: (key, data) =>
        set((s) => {
          const entradas = { ...s.entradas, [key]: { data, guardadoEn: new Date().toISOString() } };
          const keys = Object.keys(entradas);
          if (keys.length > MAX_ENTRADAS) {
            keys
              .sort((a, b) => entradas[a].guardadoEn.localeCompare(entradas[b].guardadoEn))
              .slice(0, keys.length - MAX_ENTRADAS)
              .forEach((k) => delete entradas[k]);
          }
          return { entradas };
        }),
    }),
    { name: 'offline-cache', storage: createJSONStorage(() => preferencesStorage) }
  )
);

// Per company and user: a session never sees another's saved data
const scoped = (key: string) =>
  `${useCompanyStore.getState().company?.code ?? ''}:${useAuthStore.getState().user?.id ?? 0}:${key}`;

export const guardarEnCache = (key: string, data: unknown) => useOfflineCache.getState().guardar(scoped(key), data);

export const leerDeCache = <T,>(key: string): { data: T; guardadoEn: string } | null => {
  const entrada = useOfflineCache.getState().entradas[scoped(key)];
  return entrada ? { data: entrada.data as T, guardadoEn: entrada.guardadoEn } : null;
};
