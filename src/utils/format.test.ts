import { formatCOP, formatDayHeading, formatShortDate, formatTimeAgo, isoDateDaysAgo } from './format';
import { matchesQuery } from './search';

describe('format', () => {
  it('formats pesos like the designs', () => {
    expect(formatCOP(800000)).toBe('$800.000');
    expect(formatCOP(1350000)).toBe('$1.350.000');
  });

  it('formats short dates like the designs', () => {
    expect(formatShortDate('2026-08-22')).toBe('Ago 22');
    expect(formatShortDate('2026-01-05')).toBe('Ene 5');
  });

  it('prefixes today with "Hoy"', () => {
    expect(formatDayHeading(isoDateDaysAgo(0))).toMatch(/^Hoy · /);
    expect(formatDayHeading(isoDateDaysAgo(1))).not.toMatch(/Hoy/);
  });

  it('formats relative times', () => {
    const now = Date.parse('2026-08-22T12:00:00Z');
    const ago = (minutes: number) => new Date(now - minutes * 60000).toISOString();
    expect(formatTimeAgo(ago(0), now)).toBe('Ahora');
    expect(formatTimeAgo(ago(25), now)).toBe('Hace 25 min');
    expect(formatTimeAgo(ago(125), now)).toBe('Hace 2 h');
    expect(formatTimeAgo(ago(60 * 50), now)).toBe('Hace 2 d');
  });
});

describe('search', () => {
  it('ignores case and accents', () => {
    expect(matchesQuery('jamundi', ['Jamundí'])).toBe(true);
    expect(matchesQuery('FERRETERIA', ['Ferretería Andina S.A.'])).toBe(true);
    expect(matchesQuery('bogota', ['Villa Rica', 'Cali'])).toBe(false);
  });

  it('matches everything when the query is blank', () => {
    expect(matchesQuery('   ', ['MT000661'])).toBe(true);
  });
});
