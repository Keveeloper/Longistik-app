import { ciudad, formatCOP, formatDayHeading, formatShortDate, formatPesos, formatTimeAgo, isoDateDaysAgo, tipoOracion } from './format';
import { matchesQuery } from './search';

describe('format', () => {
  it('writes all-caps names and places in sentence case', () => {
    expect(tipoOracion('VILLA RICA, CAUCA')).toBe('Villa Rica, Cauca');
    expect(tipoOracion('SANTIAGO DE CALI, VALLE DEL CAUCA')).toBe('Santiago de Cali, Valle del Cauca');
    expect(tipoOracion('BOGOTÁ, D.C.')).toBe('Bogotá, D.C.');
    expect(tipoOracion('TRANSPORTES EL CÓNDOR S.A.S.')).toBe('Transportes El Cóndor S.A.S.');
    expect(tipoOracion('CL 10 32 29 BRR COLSEGUROS')).toBe('Cl 10 32 29 Brr Colseguros');
    // Already cased by a person: untouched
    expect(tipoOracion('HMCL Colombia SAS')).toBe('HMCL Colombia SAS');
    expect(tipoOracion(null)).toBe('');
    expect(ciudad({ nombre: 'VILLA RICA, CAUCA' })).toBe('Villa Rica');
  });

  it('formats pesos without a space, as in the designs', () => {
    expect(formatPesos(2500000)).toBe('$2.500.000');
    expect(formatPesos(10)).toBe('$10');
    expect(formatPesos(1234.6)).toBe('$1.235');
    expect(formatPesos(-5000)).toBe('-$5.000');
  });

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
