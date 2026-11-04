/*
 * Campana y registro del teléfono para push (P4 of request/mobile-api.md,
 * request/notificaciones-push.md). The bell is the source of truth: push is only the ring.
 */
import { api, type Page, type PageParams } from '../api/client';

/** Screen a notification opens. */
export interface LinkAviso {
  tipo: 'manifiesto' | 'remesa' | 'seguimiento';
  id: number;
  seccion?: string;
}

export interface Notificacion {
  id: number;
  /** e.g. sobreanticipo.decidido, seguimiento.pedido */
  tipo: string;
  titulo: string;
  mensaje: string;
  link: LinkAviso | null;
  prioridad: 'normal' | 'alta';
  creadaEn: string;
  leida: boolean;
}

export type Plataforma = 'android' | 'ios' | 'web';

export const notificacionesService = {
  async listar(params: PageParams & { soloNoLeidas?: boolean } = {}) {
    const { data } = await api.get<Page<Notificacion>>('/mobile/notificaciones', { params });
    return data;
  },

  async marcarLeida(id: number) {
    await api.post(`/mobile/notificaciones/${id}/leida`);
  },

  async marcarTodas() {
    await api.post('/mobile/notificaciones/leidas');
  },

  /** Idempotent: called on every launch and whenever Firebase hands out a new token. */
  async registrarDispositivo(body: { token: string; plataforma: Plataforma; appVersion?: string; descripcion?: string }) {
    await api.post('/mobile/dispositivos', body);
  },

  /** On logout, while the session token is still valid. */
  async borrarDispositivo(token: string) {
    await api.delete(`/mobile/dispositivos/${encodeURIComponent(token)}`, { timeout: 5000 });
  },
};
