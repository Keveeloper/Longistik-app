/** Lowercase without accents, for case- and accent-insensitive search. */
export const normalizeText = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '') // strip accents left by NFD
    .toLowerCase();

/** True when any of the fields contains the query (ignoring case and accents). */
export const matchesQuery = (query: string, fields: string[]) => {
  const q = normalizeText(query.trim());
  return !q || fields.some((field) => normalizeText(field).includes(q));
};
