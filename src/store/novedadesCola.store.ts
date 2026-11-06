import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { DatosNovedad } from '../services/novedades.service';
import { preferencesStorage } from '../storage/preferencesStorage';
import type { EstadoEnvio } from './cumplidosQueue.store';

/** Novedad reported on the phone, kept until the backend confirms it (src/offline/novedades.ts). */
export interface NovedadEnCola {
  /** Also the Idempotency-Key: resending never duplicates the novedad */
  id: string;
  companyCode: string;
  userId: number;
  datos: DatosNovedad;
  /** For the "Pendiente de envío" card, which can't ask the server */
  resumen: { tipoNombre: string; manifiestoNumero: string; origen: string; destino: string };
  /** Paths of the stamped photos inside the app's data folder */
  fotos: string[];
  /** ISO */
  creadoEn: string;
  intentos: number;
  estado: EstadoEnvio;
  ultimoError: string | null;
}

interface NovedadesColaState {
  cola: NovedadEnCola[];
  agregar: (item: NovedadEnCola) => void;
  actualizar: (id: string, cambios: Partial<NovedadEnCola>) => void;
  quitar: (id: string) => void;
}

export const useNovedadesCola = create<NovedadesColaState>()(
  persist(
    (set) => ({
      cola: [],
      agregar: (item) => set((s) => ({ cola: [...s.cola, item] })),
      actualizar: (id, cambios) => set((s) => ({ cola: s.cola.map((c) => (c.id === id ? { ...c, ...cambios } : c)) })),
      quitar: (id) => set((s) => ({ cola: s.cola.filter((c) => c.id !== id) })),
    }),
    {
      name: 'novedades-cola',
      storage: createJSONStorage(() => preferencesStorage),
      // A send cut short by closing the app is retried
      onRehydrateStorage: () => (state) => {
        state?.cola.forEach((c) => c.estado === 'enviando' && state.actualizar(c.id, { estado: 'pendiente' }));
      },
    }
  )
);
