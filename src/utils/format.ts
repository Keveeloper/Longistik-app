const numberFormat = new Intl.NumberFormat('es-CO');
const monthFormat = new Intl.DateTimeFormat('es-CO', { month: 'short', timeZone: 'UTC' });

/** Colombian pesos as in the designs: "$800.000" (no space, no decimals). */
export const formatCOP = (value: number) => `$${numberFormat.format(value)}`;

/** Short date as in the designs: "Ago 22". Expects an ISO date (YYYY-MM-DD). */
export const formatShortDate = (isoDate: string) => {
  const date = new Date(`${isoDate}T00:00:00Z`);
  const month = monthFormat.format(date).replace('.', '');
  return `${month.charAt(0).toUpperCase()}${month.slice(1)} ${date.getUTCDate()}`;
};

/** Local calendar date as ISO (YYYY-MM-DD), `daysAgo` days before today. */
export const isoDateDaysAgo = (daysAgo = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Relative time as in the designs: "Hace 25 min", "Hace 2 h", "Hace 3 d". */
export const formatTimeAgo = (isoDateTime: string, now = Date.now()) => {
  const minutes = Math.max(0, Math.floor((now - new Date(isoDateTime).getTime()) / 60000));
  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  return `Hace ${Math.floor(hours / 24)} d`;
};

/** ISO date-time `minutes` minutes before now (for mock data). */
export const isoDateTimeMinutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60000).toISOString();

/** Day group heading as in the designs: "Hoy · Ago 22" for today, "Ago 21" otherwise. */
export const formatDayHeading = (isoDate: string) =>
  isoDate === isoDateDaysAgo(0) ? `Hoy · ${formatShortDate(isoDate)}` : formatShortDate(isoDate);

/* Display formats (Spanish, Colombia). Dates from the backend carry their -05:00 offset. */

const TZ = 'America/Bogota';

const fecha = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ });
const fechaHora = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: TZ,
});
const hora = new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: TZ });
const numero = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });
const pesos = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

const toDate = (value: string | Date) => (value instanceof Date ? value : new Date(value));

/** "21 oct 2026" */
export const formatFecha = (value: string | Date | null | undefined) => (value ? fecha.format(toDate(value)) : '');

/** "21 oct, 3:20 p. m." */
export const formatFechaHora = (value: string | Date | null | undefined) => (value ? fechaHora.format(toDate(value)) : '');

/** "3:20 p. m." */
export const formatHora = (value: string | Date | null | undefined) => (value ? hora.format(toDate(value)) : '');

/** "8.500 kg" */
export const formatKg = (kg: number) => `${numero.format(kg)} kg`;

export const formatNumero = (n: number) => numero.format(n);

/** "$3.200.000", as in the designs (no space, no decimals) */
export const formatPesos = (value: number) => `${value < 0 ? '-' : ''}$${pesos.format(Math.abs(value))}`;

// Abbreviations that stay uppercase, and words that stay lowercase inside a name
const SIGLAS = new Set(['SAS', 'S.A.S', 'S.A.S.', 'SA', 'S.A', 'S.A.', 'LTDA', 'LTDA.', 'EU', 'E.U.', 'C.I.', 'D.C', 'D.C.', 'RNDC', 'NIT']);
const MINUSCULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e']);

/**
 * Names and places as the designs show them: "VILLA RICA, CAUCA" → "Villa Rica, Cauca".
 * Only all-caps text is changed; text that already has lowercase ("HMCL Colombia SAS") is kept.
 */
export const tipoOracion = (texto: string | null | undefined) => {
  if (!texto || /\p{Ll}/u.test(texto)) return texto ?? '';
  let primera = true;
  return texto.replace(/[\p{L}\p{M}.]+/gu, (palabra) => {
    const esPrimera = primera;
    primera = false;
    if (SIGLAS.has(palabra)) return palabra;
    const minuscula = palabra.toLocaleLowerCase('es');
    if (!esPrimera && MINUSCULAS.has(minuscula)) return minuscula;
    return minuscula.charAt(0).toLocaleUpperCase('es') + minuscula.slice(1);
  });
};

/** "Cali, Valle del Cauca" → "Cali" (the first part is enough on small screens). */
export const ciudad = (municipio: { nombre: string } | null | undefined) =>
  tipoOracion(municipio?.nombre.split(',')[0]?.trim());

/** Full place name: "Villa Rica, Cauca". */
export const lugar = (municipio: { nombre: string } | null | undefined) => tipoOracion(municipio?.nombre);

export const plural = (count: number, one: string, many: string) => `${formatNumero(count)} ${count === 1 ? one : many}`;
