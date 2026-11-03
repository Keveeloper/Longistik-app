/*
 * Seguimiento de viaje (P7 of request/mobile-api.md, request/seguimiento-viaje.md): the
 * driver starts the trip and the server asks for the location by push every so often.
 * Nothing runs in the background on the phone.
 */
import { api } from '../api/client';

export type EstadoViaje = 'asignado' | 'activo' | 'pausado' | 'finalizado' | 'cancelado';
export type EstadoReporte = 'en_ruta' | 'desviado' | 'sin_ruta';
export type TipoReporte = 'inicio' | 'pedido' | 'voluntario' | 'oportunista' | 'auxilio' | 'fin';

export interface ReporteViaje {
  id: number;
  tipo: TipoReporte;
  latitud: number;
  longitud: number;
  precisionMetros: number | null;
  bateria: number | null;
  capturadoEn: string;
  recibidoEn: string;
  estado: EstadoReporte;
  distanciaRutaKm: number | null;
  progresoKm: number | null;
  atrasoMin: number | null;
}

export interface Viaje {
  id: number;
  manifiestoId: number;
  manifiesto: string | null;
  placa: string | null;
  conductor: { id: number; nombre: string } | null;
  estado: EstadoViaje;
  origen: 'conductor' | 'asignado';
  asignadoEn: string | null;
  iniciadoEn: string | null;
  finalizadoEn: string | null;
  motivoFin: string | null;
  pausaMotivo: string | null;
  intervaloMin: number;
  ventanaMin: number;
  tieneRuta: boolean;
  paradas: { nombre: string; eta: string | null }[];
  /** When the next location request is due (only while active) */
  proximoPedido: string | null;
  /** Request waiting for an answer */
  pedidoAbierto: { id: number; venceEn: string } | null;
  ultimoReporte: {
    capturadoEn: string;
    estado: EstadoReporte | null;
    latitud: number;
    longitud: number;
    atrasoMin: number | null;
    bateria: number | null;
  } | null;
  alertas: { desvio: boolean; sinRespuesta: number; auxilio: string | null; llegada: string | null };
  ultimosReportes: ReporteViaje[];
}

export interface EstadoSeguimiento {
  viaje: Viaje | null;
  /** The user is the driver who can follow this manifiesto (or the one following it) */
  esConductor: boolean;
  puedeIniciar: boolean;
  motivoNoDisponible: string | null;
  consentimientoVigente: boolean;
  versionConsentimiento: string;
}

/** Location sent to the server; `idempotencyKey` makes resending from the queue safe. */
export interface ReporteNuevo {
  viajeId: number;
  pedidoId?: number | null;
  tipo: TipoReporte;
  latitud: number;
  longitud: number;
  precisionMetros?: number | null;
  bateria?: number | null;
  /** ISO, phone time */
  capturadoEn: string;
  idempotencyKey: string;
}

export interface ResultadoReporte {
  idempotencyKey: string | null;
  estado: 'aceptado' | 'duplicado' | 'rechazado';
  motivo?: string;
}

export const seguimientoService = {
  async activo() {
    const { data } = await api.get<{ viaje: Viaje | null }>('/mobile/viajes/activo');
    return data?.viaje ?? null;
  },

  async estado(manifiestoId: number) {
    const { data } = await api.get<EstadoSeguimiento>(`/mobile/manifiestos/${manifiestoId}/viaje`);
    return data;
  },

  async aceptarConsentimiento(version: string, dispositivo?: string) {
    await api.post('/mobile/seguimiento/consentimiento', { version, dispositivo });
  },

  /** Starts the trip (or accepts the one the company assigned) with the first location (its viajeId/tipo are ignored). */
  async iniciar(manifiestoId: number, reporte: ReporteNuevo) {
    const { data } = await api.post<Viaje>(`/mobile/manifiestos/${manifiestoId}/viaje/iniciar`, { reporte });
    return data;
  },

  async pausar(viajeId: number, motivo?: string) {
    const { data } = await api.post<Viaje>(`/mobile/viajes/${viajeId}/pausar`, { motivo });
    return data;
  },

  async reanudar(viajeId: number) {
    const { data } = await api.post<Viaje>(`/mobile/viajes/${viajeId}/reanudar`);
    return data;
  },

  async terminar(viajeId: number, reporte?: Omit<ReporteNuevo, 'viajeId' | 'tipo'>) {
    const { data } = await api.post<Viaje>(`/mobile/viajes/${viajeId}/terminar`, reporte ? { reporte } : {});
    return data;
  },

  async reportes(reportes: ReporteNuevo[]) {
    const { data } = await api.post<{ resultados: ResultadoReporte[] }>('/mobile/viajes/reportes', reportes);
    return data.resultados;
  },
};
