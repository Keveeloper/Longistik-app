/*
 * Sobreanticipos (P5 of request/mobile-api.md): the driver or the despachador asks for more
 * money during a trip; it's approved and paid on the web. The app only requests and cancels
 * the user's own requests. Functional spec: request/app-movil-sobreanticipos.md.
 */
import { api, type Page, type PageParams } from '../api/client';

export type EstadoSobreanticipo = 'solicitada' | 'aprobada' | 'rechazada' | 'pagada' | 'cancelada';

export interface Sobreanticipo {
  id: number;
  manifiestoId: number;
  /** Manifiesto number, e.g. "MT000812" */
  manifiesto: string | null;
  placa: string | null;
  /** Pesos */
  valor: number;
  /** null until approved; may be less than `valor` */
  valorAprobado: number | null;
  /** Only in the manifiesto's list */
  pagado?: number;
  motivo: string;
  motivoNombre: string | null;
  descripcion: string | null;
  soporteUrl: string | null;
  origen: string | null;
  estado: EstadoSobreanticipo;
  fechaSolicitud: string;
  fechaDecision: string | null;
  /** Reason for the rejection, approver's or cancellation notes */
  notas: string | null;
  /** Set when it was requested above the company's cap (warning mode) */
  alertaTope: string | null;
}

export interface SobreanticiposManifiesto {
  manifiestoId: number;
  /** Most that can be requested by balance (the company's cap is checked on submit) */
  disponible: number;
  puedeSolicitar: boolean;
  motivoNoDisponible: string | null;
  items: Sobreanticipo[];
}

export interface MotivoSobreanticipo {
  codigo: string;
  nombre: string;
  requiereDescripcion: boolean;
}

export interface SolicitudSobreanticipo {
  valor: number;
  motivo: string;
  descripcion?: string;
  soporte?: string;
}

/** POST responses: the request plus a message for the user. */
export type ResultadoSobreanticipo = Sobreanticipo & { mensaje: string };

export const sobreanticiposService = {
  async motivos() {
    const { data } = await api.get<MotivoSobreanticipo[]>('/mobile/catalogos/motivos-sobreanticipo');
    return data;
  },

  /** The manifiesto's requests (everyone's), what's available and whether another can be requested. */
  async delManifiesto(manifiestoId: number) {
    const { data } = await api.get<SobreanticiposManifiesto>(`/mobile/manifiestos/${manifiestoId}/sobreanticipos`);
    return data;
  },

  /** Never retried automatically: after a network error the request may have been created. */
  async solicitar(manifiestoId: number, body: SolicitudSobreanticipo) {
    const { data } = await api.post<ResultadoSobreanticipo>(`/mobile/manifiestos/${manifiestoId}/sobreanticipos`, body);
    return data;
  },

  /** The user's own requests, newest first. */
  async mias(params: PageParams & { estado?: EstadoSobreanticipo } = {}) {
    const { data } = await api.get<Page<Sobreanticipo>>('/mobile/sobreanticipos', { params });
    return data;
  },

  /** Only the user's own, `solicitada` or `aprobada` without payments; otherwise 409 CONFLICT. */
  async cancelar(id: number, notas?: string) {
    const { data } = await api.post<ResultadoSobreanticipo>(`/mobile/sobreanticipos/${id}/cancelar`, notas ? { notas } : {});
    return data;
  },
};

/** Whether the user can still cancel one of their own requests. */
export const esCancelable = (s: Pick<Sobreanticipo, 'estado' | 'pagado'>) =>
  s.estado === 'solicitada' || (s.estado === 'aprobada' && !s.pagado);
