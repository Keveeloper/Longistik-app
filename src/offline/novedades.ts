/*
 * Novedades are saved on the phone first and then sent, like the deliveries (cumplidos.ts):
 * a driver without signal reports it and it goes out by itself when the signal comes back,
 * with the phone's time and location of the moment it was reported. Each one carries its own
 * Idempotency-Key, so a resend after a lost response never duplicates it.
 */
import axios from 'axios';
import { apiErrorMessage } from '../api/client';
import { novedadesService, type DatosNovedad, type NovedadDetalle } from '../services/novedades.service';
import { useAuthStore } from '../store/auth.store';
import { useCompanyStore } from '../store/company.store';
import { useNovedadesCola, type NovedadEnCola } from '../store/novedadesCola.store';
import { colaDeSesion, esReintentable, nuevoId } from './cumplidos';
import { base64ToBytes, readBase64, removePath, writeBase64 } from './files';

const carpeta = (id: string) => `novedades/${id}`;

/** Saves the novedad and its photos (JPEG base64) on the phone. Returns the queue id. */
export const encolarNovedad = async (datos: DatosNovedad, resumen: NovedadEnCola['resumen'], fotosBase64: string[]) => {
  const id = nuevoId();
  const fotos = fotosBase64.map((_, i) => `${carpeta(id)}/${i + 1}.jpg`);
  await Promise.all(fotos.map((path, i) => writeBase64(path, fotosBase64[i])));
  useNovedadesCola.getState().agregar({
    id,
    companyCode: useCompanyStore.getState().company?.code ?? '',
    userId: useAuthStore.getState().user?.id ?? 0,
    datos,
    resumen,
    fotos,
    creadoEn: new Date().toISOString(),
    intentos: 0,
    estado: 'pendiente',
    ultimoError: null,
  });
  return id;
};

export type ResultadoNovedad =
  | { ok: true; novedad: NovedadDetalle }
  /** `reintentable`: no signal or server error; it stays queued and goes out later */
  | { ok: false; reintentable: boolean; mensaje: string };

export const enviarNovedad = async (id: string): Promise<ResultadoNovedad> => {
  const cola = useNovedadesCola.getState();
  const item = cola.cola.find((c) => c.id === id);
  if (!item) return { ok: false, reintentable: false, mensaje: 'La novedad ya no está en el teléfono' };
  if (item.estado === 'enviando') return { ok: false, reintentable: true, mensaje: 'Enviando…' };

  cola.actualizar(id, { estado: 'enviando', intentos: item.intentos + 1 });
  try {
    const fotos = await Promise.all(
      item.fotos.map(async (path) => new Blob([base64ToBytes(await readBase64(path))], { type: 'image/jpeg' }))
    );
    const novedad = await novedadesService.reportar(item.datos, fotos, item.id);
    useNovedadesCola.getState().quitar(id);
    await removePath(carpeta(id));
    return { ok: true, novedad };
  } catch (error) {
    const reintentable = esReintentable(error);
    const mensaje =
      axios.isAxiosError(error) && !error.response
        ? 'Sin señal. La novedad se enviará sola cuando vuelva la conexión.'
        : apiErrorMessage(error, 'El servidor no respondió. Se reintentará.');
    useNovedadesCola.getState().actualizar(id, { estado: reintentable ? 'pendiente' : 'rechazado', ultimoError: mensaje });
    return { ok: false, reintentable, mensaje };
  }
};

/** Deletes a novedad from the phone (only rejected ones: the user decides). */
export const descartarNovedad = async (id: string) => {
  useNovedadesCola.getState().quitar(id);
  await removePath(carpeta(id));
};

/** Queued novedades of the signed-in user, newest first. */
export const novedadesEnCola = (cola: NovedadEnCola[] = useNovedadesCola.getState().cola) =>
  [...colaDeSesion(cola)].sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));

let sincronizando = false;

/** Sends every pending novedad of the current session, oldest first. Returns how many went out. */
export const sincronizarNovedades = async () => {
  if (sincronizando || !useAuthStore.getState().token) return 0;
  sincronizando = true;
  let enviadas = 0;
  try {
    const pendientes = novedadesEnCola()
      .filter((c) => c.estado === 'pendiente')
      .reverse();
    for (const item of pendientes) {
      const r = await enviarNovedad(item.id);
      if (r.ok) enviadas++;
      // Still no signal: don't hammer the rest
      else if (r.reintentable) break;
    }
  } finally {
    sincronizando = false;
  }
  return enviadas;
};
