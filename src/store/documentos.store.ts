import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { EstadoManifiesto } from '../services/operations.service';
import { preferencesStorage } from '../storage/preferencesStorage';

/** Manifiesto PDF saved on the phone (the file itself is in src/offline/documentos.ts). */
export interface DocumentoGuardado {
  /** `${companyCode}:${manifiestoId}` */
  key: string;
  companyCode: string;
  manifiestoId: number;
  numero: string;
  placa: string | null;
  estado: EstadoManifiesto;
  valido: boolean;
  motivoNoValido: string | null;
  /** File path inside the app's data folder */
  path: string;
  /** ISO, when the backend generated it */
  generadoEn: string;
  /** ISO, when it was saved on the phone */
  descargadoEn: string;
}

interface DocumentosState {
  documentos: Record<string, DocumentoGuardado>;
  guardar: (doc: DocumentoGuardado) => void;
  quitar: (key: string) => void;
}

export const documentoKey = (companyCode: string, manifiestoId: number) => `${companyCode}:${manifiestoId}`;

export const useDocumentosStore = create<DocumentosState>()(
  persist(
    (set) => ({
      documentos: {},
      guardar: (doc) => set((s) => ({ documentos: { ...s.documentos, [doc.key]: doc } })),
      quitar: (key) =>
        set((s) => {
          const documentos = { ...s.documentos };
          delete documentos[key];
          return { documentos };
        }),
    }),
    { name: 'documentos', storage: createJSONStorage(() => preferencesStorage) }
  )
);
