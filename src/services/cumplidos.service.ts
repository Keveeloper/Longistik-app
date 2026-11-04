/*
 * Cumplido de remesas (P6 of request/mobile-api.md): the driver registers the delivery
 * (photos, who received it, kg delivered, the phone's location) and the backend reports
 * the cumplido to the RNDC in the same call, with the times proposed by the manifiesto's
 * monitoring unless the app sends its own.
 */
import { api } from '../api/client';
import type { EstadoRndc } from './operations.service';

/** Colombian local time without zone: "2026-10-20T07:21". */
export interface Ventana {
  llegada: string;
  entrada: string;
  salida: string;
}

export interface TiemposCumplido {
  cargue: Ventana;
  descargue: Ventana;
}

/** RNDC result stored with a delivery. `no_aplica`: municipal remesa, closed with the manifiesto's cumplido. */
export type EstadoCumplidoRndc = 'reportado' | 'error' | 'pendiente' | 'no_aplica';

export interface Entrega {
  id: number;
  /** Phone time when the evidence was taken */
  capturadoEn: string;
  /** Server time when it arrived (later if it waited for signal) */
  registradoEn: string;
  registradoPor: string | null;
  recibidoPor: { nombre: string; documento: string | null };
  cantidadEntregadaKg: number;
  observaciones: string | null;
  ubicacion: { latitud: number; longitud: number; precisionMetros: number | null };
  fotos: string[];
  dispositivo: string | null;
  rndc: { estado: EstadoCumplidoRndc; mensaje: string | null; tiemposFuente: 'app' | 'monitoreo' | null };
}

export interface CumplidoRndc {
  /** null until the cumplido is sent */
  estadoRndc: EstadoRndc | null;
  rndcError: string | null;
}

/** `GET /mobile/remesas/{id}/cumplido` */
export interface EstadoCumplido {
  remesaId: number;
  numero: string;
  puedeCumplir: boolean;
  motivoNoDisponible: string | null;
  /** There's a delivery and the RNDC hasn't accepted the cumplido yet */
  puedeReintentarRndc: boolean;
  /** Same municipality for loading and unloading: the RNDC cumplido goes with the manifiesto's */
  municipal: boolean;
  pesoKg: number;
  cumplido: CumplidoRndc;
  /** Newest first */
  entregas: Entrega[];
}

/** `GET /mobile/remesas/{id}/cumplido/tiempos` */
export interface PropuestaTiempos {
  tiempos: TiemposCumplido | null;
  coherente: boolean;
  fuenteCargue: 'cumplidoInicial' | 'monitoreo' | null;
  avisos: string[];
  /** Why there are no times */
  mensaje: string | null;
}

export interface RegistroCumplido {
  entrega: Entrega;
  cumplido: CumplidoRndc;
}

/** Text fields of the multipart POST. */
export interface DatosEntrega {
  recibidoNombre: string;
  recibidoDocumento?: string;
  /** Kg; the backend defaults to the remesa's total weight */
  cantidadEntregada?: number;
  observaciones?: string;
  latitud: number;
  longitud: number;
  precisionMetros?: number;
  /** ISO 8601 */
  capturadoEn: string;
  dispositivo?: string;
  tiempos?: TiemposCumplido;
}

export const cumplidosService = {
  async estado(remesaId: number) {
    const { data } = await api.get<EstadoCumplido>(`/mobile/remesas/${remesaId}/cumplido`);
    return data;
  },

  /** Asks the RNDC for the monitoring: takes a few seconds. */
  async tiempos(remesaId: number) {
    const { data } = await api.get<PropuestaTiempos>(`/mobile/remesas/${remesaId}/cumplido/tiempos`, { timeout: 60000 });
    return data;
  },

  /**
   * Same `idempotencyKey` = same delivery: retrying after a lost response returns the
   * first result instead of creating a duplicate.
   */
  async registrar(remesaId: number, datos: DatosEntrega, fotos: Blob[], idempotencyKey: string) {
    const form = new FormData();
    for (const [key, value] of Object.entries(datos)) {
      if (value === undefined || value === null || value === '') continue;
      form.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
    }
    fotos.forEach((foto, i) => form.append('fotos', foto, `foto-${i + 1}.jpg`));
    const { data } = await api.post<RegistroCumplido>(`/mobile/remesas/${remesaId}/cumplido`, form, {
      headers: { 'Idempotency-Key': idempotencyKey },
      // Photos on a weak signal, then the RNDC call
      timeout: 120000,
    });
    return data;
  },

  /** Retries the RNDC cumplido of a remesa whose delivery is already registered. */
  async reintentarRndc(remesaId: number, tiempos?: TiemposCumplido) {
    const { data } = await api.post<RegistroCumplido>(
      `/mobile/remesas/${remesaId}/cumplido/rndc`,
      tiempos ? { tiempos } : {},
      { timeout: 60000 }
    );
    return data;
  },
};
