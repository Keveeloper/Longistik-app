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
