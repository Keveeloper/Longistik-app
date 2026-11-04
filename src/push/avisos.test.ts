import { debeReportarOportunista } from '../offline/seguimiento';
import { esDeEstaSesion, parseLink, rutaDeAviso } from './avisos';

describe('rutaDeAviso', () => {
  it('opens the manifiesto at its section', () => {
    expect(rutaDeAviso('sobreanticipo.decidido', { tipo: 'manifiesto', id: 812, seccion: 'sobreanticipos' })).toBe(
      '/manifiestos/812?seccion=sobreanticipos'
    );
    expect(rutaDeAviso('seguimiento.desvio', { tipo: 'seguimiento', id: 812 })).toBe('/manifiestos/812?seccion=seguimiento');
    expect(rutaDeAviso('x', { tipo: 'remesa', id: 4501 })).toBe('/remesas/4501');
  });

  it('a location request goes to the one-tap share screen', () => {
    expect(rutaDeAviso('seguimiento.pedido', { tipo: 'seguimiento', id: 812 })).toBe('/seguimiento/812/compartir');
  });

  it('without a link, the list', () => {
    expect(rutaDeAviso('x', null)).toBe('/notificaciones');
  });
});

describe('parseLink', () => {
  it('reads the JSON that comes in the push data', () => {
    expect(parseLink('{"tipo":"manifiesto","id":"812","seccion":"sobreanticipos"}')).toEqual({
      tipo: 'manifiesto',
      id: 812,
      seccion: 'sobreanticipos',
    });
  });

  it.each(['no es json', '{"tipo":"otro","id":1}', '{"tipo":"remesa","id":0}', undefined])('ignores %s', (v) => {
    expect(parseLink(v)).toBeNull();
  });
});

describe('esDeEstaSesion', () => {
  it('only opens notifications of the signed-in company and user', () => {
    expect(esDeEstaSesion({ empresa: 'finaltest', userId: '34' }, 'finaltest', 34)).toBe(true);
    expect(esDeEstaSesion({ empresa: 'otra', userId: '34' }, 'finaltest', 34)).toBe(false);
    expect(esDeEstaSesion({ empresa: 'finaltest', userId: '35' }, 'finaltest', 34)).toBe(false);
  });

  it("shows the panel's test push to anyone", () => {
    expect(esDeEstaSesion({ tipo: 'prueba', empresa: 'panel' }, 'finaltest', 34)).toBe(true);
  });
});

describe('debeReportarOportunista', () => {
  const ahora = new Date('2026-11-02T15:00:00Z');
  const viaje = (minutos: number | null, estado = 'activo' as const) => ({
    estado,
    intervaloMin: 30,
    ultimoReporte: minutos === null ? null : ({ capturadoEn: new Date(ahora.getTime() - minutos * 60_000).toISOString() } as never),
  });

  it('reports when the last one is older than half the interval', () => {
    expect(debeReportarOportunista(viaje(20), ahora)).toBe(true);
    expect(debeReportarOportunista(viaje(null), ahora)).toBe(true);
  });

  it('not when it reported recently, nor outside an active trip', () => {
    expect(debeReportarOportunista(viaje(10), ahora)).toBe(false);
    expect(debeReportarOportunista({ ...viaje(60), estado: 'pausado' }, ahora)).toBe(false);
    expect(debeReportarOportunista(null, ahora)).toBe(false);
  });
});
