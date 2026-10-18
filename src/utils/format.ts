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
