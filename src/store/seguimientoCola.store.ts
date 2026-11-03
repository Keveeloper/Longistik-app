import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ReporteNuevo } from '../services/seguimiento.service';
import { preferencesStorage } from '../storage/preferencesStorage';

/** Location report kept on the phone until the backend confirms it (src/offline/seguimiento.ts). */
export interface ReporteEnCola {
  companyCode: string;
  userId: number;
  reporte: ReporteNuevo;
  intentos: number;
}

interface SeguimientoColaState {
  cola: ReporteEnCola[];
  agregar: (item: ReporteEnCola) => void;
  /** Removes the reports with these idempotency keys */
  quitar: (claves: string[]) => void;
  sumarIntento: (claves: string[]) => void;
}

/** Without signal a trip may pile up reports: the oldest go first when this fills up. */
const MAX_REPORTES = 200;

export const useSeguimientoCola = create<SeguimientoColaState>()(
  persist(
    (set) => ({
      cola: [],
      agregar: (item) => set((s) => ({ cola: [...s.cola, item].slice(-MAX_REPORTES) })),
      quitar: (claves) => set((s) => ({ cola: s.cola.filter((c) => !claves.includes(c.reporte.idempotencyKey)) })),
      sumarIntento: (claves) =>
        set((s) => ({ cola: s.cola.map((c) => (claves.includes(c.reporte.idempotencyKey) ? { ...c, intentos: c.intentos + 1 } : c)) })),
    }),
    { name: 'seguimiento-cola', storage: createJSONStorage(() => preferencesStorage) }
  )
);
