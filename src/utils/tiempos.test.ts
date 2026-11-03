import { aHoraLocal, mostrarHoraLocal, tiemposIniciales, validarTiempos } from './tiempos';

const T = {
  cargue: { llegada: '2026-10-20T07:21', entrada: '2026-10-20T07:25', salida: '2026-10-20T07:30' },
  descargue: { llegada: '2026-10-20T14:59', entrada: '2026-10-20T15:01', salida: '2026-10-20T15:04' },
};

describe('tiempos del cumplido', () => {
  it('converts to Colombian local time regardless of the phone zone', () => {
    expect(aHoraLocal(new Date('2026-10-20T20:05:00Z'))).toBe('2026-10-20T15:05');
    expect(aHoraLocal(new Date('2026-10-21T03:30:00Z'))).toBe('2026-10-20T22:30');
  });

  it('shows a short date', () => {
    expect(mostrarHoraLocal('2026-10-20T07:21')).toBe('20 oct, 7:21');
    expect(mostrarHoraLocal('')).toBe('');
  });

  it('validates like the backend', () => {
    expect(validarTiempos(T)).toBeNull();
    expect(validarTiempos({ ...T, cargue: { ...T.cargue, salida: '' } })).toMatch(/Completa las horas del cargue/);
    expect(validarTiempos({ ...T, cargue: { ...T.cargue, entrada: '2026-10-20T07:30' } })).toMatch(/entrada antes de la salida/);
    expect(validarTiempos({ ...T, descargue: { ...T.descargue, llegada: '2026-10-20T07:00' } })).toMatch(/salida del cargue/);
  });

  it('starts manual entry with the unloading ending now and the loading empty', () => {
    const t = tiemposIniciales(new Date('2026-10-20T20:00:00Z'));
    expect(t.descargue).toEqual({ llegada: '2026-10-20T14:30', entrada: '2026-10-20T14:45', salida: '2026-10-20T15:00' });
    expect(validarTiempos(t)).toMatch(/cargue/);
  });
});
