import { AxiosError, AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { novedadesService, type DatosNovedad } from '../services/novedades.service';
import { useAuthStore } from '../store/auth.store';
import { useCompanyStore } from '../store/company.store';
import { useNovedadesCola } from '../store/novedadesCola.store';
import { encolarNovedad, enviarNovedad, novedadesEnCola, sincronizarNovedades } from './novedades';

vi.mock('./files', () => ({
  writeBase64: vi.fn().mockResolvedValue(undefined),
  readBase64: vi.fn().mockResolvedValue('AAAA'),
  removePath: vi.fn().mockResolvedValue(undefined),
  base64ToBytes: () => new Uint8Array([0, 0, 0]),
}));

const datos: DatosNovedad = {
  manifiestoId: 812,
  tipo: 'varada',
  descripcion: 'Se rompió la caja de cambios',
  capturadaEn: '2026-11-06T14:00:00.000Z',
};
const resumen = { tipoNombre: 'Vehículo varado', manifiestoNumero: 'MT000812', origen: 'Cali', destino: 'Bogotá' };

const httpError = (status?: number) => {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError(
    'fail',
    status ? 'ERR_BAD_RESPONSE' : 'ERR_NETWORK',
    config,
    {},
    status ? { status, statusText: '', headers: {}, config, data: { message: 'El manifiesto ya está cumplido' } } : undefined
  );
};

describe('cola de novedades', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useNovedadesCola.setState({ cola: [] });
    useCompanyStore.setState({ company: { code: 'finaltest', name: 'STAGING', apiUrl: 'https://x', webUrl: 'https://y' } } as never);
    useAuthStore.setState({ token: 't', user: { id: 34 } } as never);
  });

  it('se envía con su id como Idempotency-Key y sale de la cola', async () => {
    const reportar = vi.spyOn(novedadesService, 'reportar').mockResolvedValue({ id: 90 } as never);
    const id = await encolarNovedad(datos, resumen, ['AAAA']);

    const r = await enviarNovedad(id);

    expect(r.ok).toBe(true);
    expect(reportar).toHaveBeenCalledWith(datos, [expect.any(Blob)], id);
    expect(useNovedadesCola.getState().cola).toHaveLength(0);
  });

  it('sin señal queda pendiente para reintentar', async () => {
    vi.spyOn(novedadesService, 'reportar').mockRejectedValue(httpError());
    const id = await encolarNovedad(datos, resumen, []);

    const r = await enviarNovedad(id);

    expect(r).toMatchObject({ ok: false, reintentable: true });
    expect(useNovedadesCola.getState().cola[0]).toMatchObject({ id, estado: 'pendiente', intentos: 1 });
  });

  it('un 422 la deja rechazada con el mensaje del servidor', async () => {
    vi.spyOn(novedadesService, 'reportar').mockRejectedValue(httpError(422));
    const id = await encolarNovedad(datos, resumen, []);

    const r = await enviarNovedad(id);

    expect(r).toMatchObject({ ok: false, reintentable: false, mensaje: 'El manifiesto ya está cumplido' });
    expect(useNovedadesCola.getState().cola[0]).toMatchObject({ estado: 'rechazado', ultimoError: 'El manifiesto ya está cumplido' });
  });

  it('sincroniza solo las de la sesión y se detiene sin señal', async () => {
    const reportar = vi.spyOn(novedadesService, 'reportar').mockRejectedValue(httpError());
    await encolarNovedad(datos, resumen, []);
    await encolarNovedad({ ...datos, descripcion: 'Otra novedad del viaje' }, resumen, []);
    useNovedadesCola.getState().agregar({ ...useNovedadesCola.getState().cola[0], id: 'de-otro', userId: 99 });

    expect(novedadesEnCola()).toHaveLength(2);
    expect(await sincronizarNovedades()).toBe(0);
    // The first one failed without signal: the second waits
    expect(reportar).toHaveBeenCalledTimes(1);
  });
});
