import type { LinkAviso } from '../services/notificaciones.service';

/** `data` of a push: every value is a string (FCM), `link` comes as JSON. */
export type DataPush = Record<string, string | undefined>;

export const parseLink = (link: unknown): LinkAviso | null => {
  try {
    const l = (typeof link === 'string' ? JSON.parse(link) : link) as LinkAviso | null;
    if (!l || !['manifiesto', 'remesa', 'seguimiento'].includes(l.tipo)) return null;
    const id = Number(l.id);
    return Number.isInteger(id) && id > 0 ? { tipo: l.tipo, id, ...(l.seccion ? { seccion: String(l.seccion) } : {}) } : null;
  } catch {
    return null;
  }
};

/** Route a notification opens. A location request goes straight to the one-tap share screen. */
export const rutaDeAviso = (tipo: string | undefined, link: LinkAviso | null): string => {
  if (!link) return '/notificaciones';
  if (tipo === 'seguimiento.pedido') return `/seguimiento/${link.id}/compartir`;
  if (link.tipo === 'remesa') return `/remesas/${link.id}`;
  const seccion = link.tipo === 'seguimiento' ? 'seguimiento' : link.seccion;
  return `/manifiestos/${link.id}${seccion ? `?seccion=${encodeURIComponent(seccion)}` : ''}`;
};

/**
 * A push that arrives after switching user or company on a shared phone belongs to the
 * other session: it isn't opened.
 */
export const esDeEstaSesion = (data: DataPush, companyCode: string | undefined, userId: number | undefined) =>
  (!data.empresa || data.empresa === companyCode) && (!data.userId || Number(data.userId) === userId);
