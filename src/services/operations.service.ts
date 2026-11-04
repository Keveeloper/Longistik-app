/*
 * Manifiestos, remesas and RNDC (P2 of request/mobile-api.md), plus the manifiesto PDF (P6).
 * "Revisar y enviar" and the RNDC report are not used by any screen yet.
 */
import { api, type Page, type PageParams } from '../api/client';

export type EstadoRndc = 'reportado' | 'pendiente' | 'error';
export type EstadoManifiesto = 'activo' | 'cumplido' | 'inactivo';
export type EstadoRemesa = 'creada' | 'manifiesto' | 'en_ruta' | 'cumplido' | 'inactivo';
/** Remesas still to be delivered (the Remesas tab default, also Inicio's "Ver remesas" badge) */
export const REMESAS_POR_ENTREGAR: EstadoRemesa[] = ['manifiesto', 'en_ruta'];

export interface Municipio {
  codigoDane: string;
  nombre: string;
}

export interface Manifiesto {
  id: number;
  numero: string;
  consecutivoRndc: string | null;
  /** Dispatch date, or creation date when there's none */
  fechaExpedicion: string;
  estado: EstadoManifiesto;
  estadoRndc: EstadoRndc;
  vehiculoId: number | null;
  placa: string | null;
  /** Driver saved on the manifiesto when it was issued (older ones: the vehicle's current driver) */
  conductor: { id: number; nombre: string } | null;
  origen: Municipio | null;
  destino: Municipio | null;
  /** Number of remesas */
  remesas: number;
  valorFlete: number;
}

export interface Remesa {
  id: number;
  numero: string;
  consecutivoRndc: string | null;
  fecha: string;
  estado: EstadoRemesa;
  estadoRndc: EstadoRndc;
  /** Current (not voided) manifiesto */
  manifiestoId: number | null;
  cliente: { id: number; nombre: string } | null;
  origen: Municipio | null;
  destino: Municipio | null;
  /** First product, or "X y N más" */
  producto: string | null;
  cantidad: number;
  pesoKg: number;
}

export interface ManifiestoDetalle extends Omit<Manifiesto, 'remesas'> {
  remesas: Remesa[];
  /** Empty until the backend has novedades */
  novedades: unknown[];
  rndcError: string | null;
}

export interface Tercero {
  documento: string | null;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  municipio: Municipio | null;
}

export interface RemesaDetalle extends Remesa {
  rndcError: string | null;
  remitente: Tercero | null;
  destinatario: Tercero | null;
  observaciones: string;
  detalles: { producto: string; cantidad: number; pesoKg: number; valorDeclarado: number }[];
  /** `estadoRndc` is null until the cumplido is sent */
  cumplido: { estadoRndc: EstadoRndc | null; rndcError: string | null };
}

/** `GET /mobile/manifiestos/{id}/pdf`: the web's PDF (with the RNDC QR) in base64. */
export interface ManifiestoPdf {
  manifiestoId: number;
  numero: string;
  generadoEn: string;
  estado: EstadoManifiesto;
  estadoRndc: EstadoRndc;
  qrCompleto: boolean;
  /** Fit to show on the road: accepted by the RNDC, with its QR, not voided */
  valido: boolean;
  motivoNoValido: string | null;
  /** File name, e.g. MT000812.pdf */
  archivo: string;
  pdfBase64: string;
}

export interface RndcResultado {
  remesaId: number;
  estadoRndc: EstadoRndc;
  consecutivoRndc?: string;
  mensaje?: string;
}

export interface RndcReporte {
  desde: string;
  hasta: string;
  totales: Record<EstadoRndc | 'total', number>;
  /** At most 200, newest first */
  errores: (Remesa & { rndcError: string })[];
}

export const operationsService = {
  /**
   * Only what the user's alcance allows (filtered by the backend). `vehiculoId` must be one
   * of the user's vehicles when alcance is "asignados" (else 404). `q`: number, RNDC
   * consecutive, plate, or driver name/document.
   */
  async manifiestos(
    params: PageParams & { estado?: EstadoManifiesto; estadoRndc?: EstadoRndc; vehiculoId?: number; q?: string } = {}
  ) {
    const { data } = await api.get<Page<Manifiesto>>('/mobile/manifiestos', { params });
    return data;
  },

  async manifiesto(id: number) {
    const { data } = await api.get<ManifiestoDetalle>(`/mobile/manifiestos/${id}`);
    return data;
  },

  /** Generated on every call (takes a few seconds); 404 if the user can't see the manifiesto. */
  async manifiestoPdf(id: number) {
    const { data } = await api.get<ManifiestoPdf>(`/mobile/manifiestos/${id}/pdf`, { timeout: 60000 });
    return data;
  },

  /** `q`: number, RNDC consecutive, or client name/document. Several `estado`s match any of them. */
  async remesas(
    params: PageParams & {
      estado?: EstadoRemesa | EstadoRemesa[];
      estadoRndc?: EstadoRndc;
      manifiestoId?: number;
      q?: string;
    } = {}
  ) {
    const estado = Array.isArray(params.estado) ? params.estado.join(',') : params.estado;
    const { data } = await api.get<Page<Remesa>>('/mobile/remesas', { params: { ...params, estado } });
    return data;
  },

  async remesa(id: number) {
    const { data } = await api.get<RemesaDetalle>(`/mobile/remesas/${id}`);
    return data;
  },

  /**
   * Needs `rndc.enviar` (else 403 FORBIDDEN). Sends up to 50 remesas to the RNDC, one by one;
   * resolves when all are done (can take a while). Remesas the user can't see come back as errors.
   */
  async enviarRndc(remesaIds: number[]) {
    const { data } = await api.post<{ resultados: RndcResultado[] }>(
      '/mobile/rndc/enviar',
      { remesaIds },
      { timeout: 0 }
    );
    return data.resultados;
  },

  /** Dates as YYYY-MM-DD; without them the backend uses the current month. */
  async reporteRndc(params: { desde?: string; hasta?: string } = {}) {
    const { data } = await api.get<RndcReporte>('/mobile/rndc/reporte', { params });
    return data;
  },
};
