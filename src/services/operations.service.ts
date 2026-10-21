/*
 * Manifiestos, remesas and RNDC (P2 of request/mobile-api.md).
 * Not used by any screen yet: the Manifiestos/Remesas tabs and "Revisar y enviar"
 * are built from their designs on top of these calls.
 */
import { api, type Page, type PageParams } from '../api/client';

export type EstadoRndc = 'reportado' | 'pendiente' | 'error';
export type EstadoManifiesto = 'activo' | 'cumplido' | 'inactivo';
export type EstadoRemesa = 'creada' | 'manifiesto' | 'en_ruta' | 'cumplido' | 'inactivo';

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
  placa: string;
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
  producto: string;
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
  documento: string;
  nombre: string;
  direccion: string;
  telefono: string;
  municipio: string;
}

export interface RemesaDetalle extends Remesa {
  rndcError: string | null;
  remitente: Tercero;
  destinatario: Tercero;
  observaciones: string;
  detalles: { producto: string; cantidad: number; pesoKg: number; valorDeclarado: number }[];
  /** `estadoRndc` is null until the cumplido is sent */
  cumplido: { estadoRndc: EstadoRndc | null; rndcError: string | null };
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
  /** `q`: number, RNDC consecutive, plate, or driver name/document. */
  async manifiestos(params: PageParams & { estado?: EstadoManifiesto; estadoRndc?: EstadoRndc; q?: string } = {}) {
    const { data } = await api.get<Page<Manifiesto>>('/mobile/manifiestos', { params });
    return data;
  },

  async manifiesto(id: number) {
    const { data } = await api.get<ManifiestoDetalle>(`/mobile/manifiestos/${id}`);
    return data;
  },

  /** `q`: number, RNDC consecutive, or client name/document. */
  async remesas(
    params: PageParams & { estado?: EstadoRemesa; estadoRndc?: EstadoRndc; manifiestoId?: number; q?: string } = {}
  ) {
    const { data } = await api.get<Page<Remesa>>('/mobile/remesas', { params });
    return data;
  },

  async remesa(id: number) {
    const { data } = await api.get<RemesaDetalle>(`/mobile/remesas/${id}`);
    return data;
  },

  /** Sends up to 50 remesas to the RNDC, one by one; resolves when all are done (can take a while). */
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
