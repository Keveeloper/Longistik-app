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
const moneda = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

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

/** "$ 3.200.000" */
export const formatPesos = (value: number) => moneda.format(value);

/** "Cali, Valle del Cauca" → "Cali" (the first part is enough on small screens). */
export const ciudad = (municipio: { nombre: string } | null | undefined) => municipio?.nombre.split(',')[0]?.trim() ?? '';

export const plural = (count: number, one: string, many: string) => `${formatNumero(count)} ${count === 1 ? one : many}`;
