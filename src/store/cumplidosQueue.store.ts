import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { DatosEntrega } from '../services/cumplidos.service';
import { preferencesStorage } from '../storage/preferencesStorage';

/**
 * - pendiente: waiting to be sent (no signal, server down, or not tried yet)
 * - enviando: being sent right now
 * - rechazado: the backend refused it (e.g. someone else already registered the delivery);
 *   it won't be retried, the user decides what to do
 */
export type EstadoEnvio = 'pendiente' | 'enviando' | 'rechazado';

/** Delivery taken on the phone, kept until the backend confirms it (src/offline/cumplidos.ts). */
export interface CumplidoEnCola {
  /** Also the Idempotency-Key: resending never duplicates the delivery */
  id: string;
  companyCode: string;
  userId: number;
  remesaId: number;
  remesaNumero: string;
  datos: DatosEntrega;
  /** Paths of the stamped photos inside the app's data folder */
  fotos: string[];
  /** ISO */
  creadoEn: string;
  intentos: number;
  estado: EstadoEnvio;
  ultimoError: string | null;
}

interface CumplidosQueueState {
  cola: CumplidoEnCola[];
  agregar: (item: CumplidoEnCola) => void;
  actualizar: (id: string, cambios: Partial<CumplidoEnCola>) => void;
  quitar: (id: string) => void;
}

export const useCumplidosQueue = create<CumplidosQueueState>()(
  persist(
    (set) => ({
      cola: [],
      agregar: (item) => set((s) => ({ cola: [...s.cola, item] })),
      actualizar: (id, cambios) => set((s) => ({ cola: s.cola.map((c) => (c.id === id ? { ...c, ...cambios } : c)) })),
      quitar: (id) => set((s) => ({ cola: s.cola.filter((c) => c.id !== id) })),
    }),
    {
      name: 'cumplidos-cola',
      storage: createJSONStorage(() => preferencesStorage),
      // A send cut short by closing the app is retried
      onRehydrateStorage: () => (state) => {
        state?.cola.forEach((c) => c.estado === 'enviando' && state.actualizar(c.id, { estado: 'pendiente' }));
      },
    }
  )
);
