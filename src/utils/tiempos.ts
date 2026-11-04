/* Loading/unloading times of the RNDC cumplido, as Colombian local time "YYYY-MM-DDTHH:MM". */
import type { TiemposCumplido, Ventana } from '../services/cumplidos.service';

const LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** A Date as Colombian local time "YYYY-MM-DDTHH:MM" (what <input type="datetime-local"> uses). */
export const aHoraLocal = (date: Date) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
};

/** "2026-10-20T07:21" → "20 oct, 7:21" (read as Colombian time). */
export const mostrarHoraLocal = (local: string) => {
  if (!LOCAL.test(local)) return '';
  const [fecha, hora] = local.split('T');
  const [, m, d] = fecha.split('-').map(Number);
  const mes = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][m - 1];
  return `${d} ${mes}, ${hora.replace(/^0/, '')}`;
};

const NOMBRES: Record<keyof TiemposCumplido, string> = { cargue: 'cargue', descargue: 'descargue' };

/** Same rules as the backend. null = valid. */
export const validarTiempos = (t: TiemposCumplido): string | null => {
  for (const v of ['cargue', 'descargue'] as const) {
    const w: Ventana = t[v];
    if (!LOCAL.test(w.llegada) || !LOCAL.test(w.entrada) || !LOCAL.test(w.salida)) {
      return `Completa las horas del ${NOMBRES[v]}`;
    }
    if (!(w.llegada <= w.entrada && w.entrada < w.salida)) {
      return `En el ${NOMBRES[v]}, la llegada va antes de la entrada, y la entrada antes de la salida`;
    }
  }
  if (t.descargue.llegada < t.cargue.salida) return 'La llegada al descargue no puede ser antes de la salida del cargue';
  return null;
};

/** Starting point when the RNDC has no monitoring: unloading ends now, loading is left to fill in. */
export const tiemposIniciales = (ahora = new Date()): TiemposCumplido => ({
  cargue: { llegada: '', entrada: '', salida: '' },
  descargue: {
    llegada: aHoraLocal(new Date(ahora.getTime() - 30 * 60_000)),
    entrada: aHoraLocal(new Date(ahora.getTime() - 15 * 60_000)),
    salida: aHoraLocal(ahora),
  },
});
