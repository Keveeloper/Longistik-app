/*
 * Deliveries (cumplidos) are saved on the phone first and then sent, so a driver without
 * signal can register them and they go out by themselves when the signal comes back.
 * Each one carries its own Idempotency-Key: a resend after a lost response never duplicates it.
 */
import axios from 'axios';
import { apiErrorMessage } from '../api/client';
import { cumplidosService, type DatosEntrega, type RegistroCumplido } from '../services/cumplidos.service';
import { useAuthStore } from '../store/auth.store';
import { useCompanyStore } from '../store/company.store';
import { useCumplidosQueue } from '../store/cumplidosQueue.store';
import { base64ToBytes, readBase64, removePath, writeBase64 } from './files';

export const nuevoId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

const carpeta = (id: string) => `cumplidos/${id}`;

const sesionActual = () => ({
  companyCode: useCompanyStore.getState().company?.code ?? '',
  userId: useAuthStore.getState().user?.id ?? 0,
});

/** Items of the signed-in user in the selected company (another user's wait for them to sign in). */
export const colaDeSesion = <T extends { companyCode: string; userId: number }>(cola: T[]) => {
  const { companyCode, userId } = sesionActual();
  return cola.filter((c) => c.companyCode === companyCode && c.userId === userId);
};

export const cumplidoEnCola = (remesaId: number) =>
  colaDeSesion(useCumplidosQueue.getState().cola).find((c) => c.remesaId === remesaId);

/** Saves the delivery and its photos (JPEG base64) on the phone. Returns the queue id. */
export const encolarCumplido = async (remesa: { id: number; numero: string }, datos: DatosEntrega, fotosBase64: string[]) => {
  const id = nuevoId();
  const fotos = fotosBase64.map((_, i) => `${carpeta(id)}/${i + 1}.jpg`);
  await Promise.all(fotos.map((path, i) => writeBase64(path, fotosBase64[i])));
  useCumplidosQueue.getState().agregar({
    id,
    ...sesionActual(),
    remesaId: remesa.id,
    remesaNumero: remesa.numero,
    datos,
    fotos,
    creadoEn: new Date().toISOString(),
    intentos: 0,
    estado: 'pendiente',
    ultimoError: null,
  });
  return id;
};

export type ResultadoEnvio =
  | { ok: true; resultado: RegistroCumplido }
  /** `reintentable`: no signal or server error; it stays queued and goes out later */
  | { ok: false; reintentable: boolean; mensaje: string };

/** No response, server error, timeout or rate limit: worth retrying with the same key. */
export const esReintentable = (error: unknown) => {
  if (!axios.isAxiosError(error) || !error.response) return true;
  const status = error.response.status;
  // 401/403: the session ended; the delivery waits for the same user to sign in again
  return status >= 500 || status === 408 || status === 429 || status === 401 || status === 403;
};

export const enviarCumplido = async (id: string): Promise<ResultadoEnvio> => {
  const queue = useCumplidosQueue.getState();
  const item = queue.cola.find((c) => c.id === id);
  if (!item) return { ok: false, reintentable: false, mensaje: 'El cumplido ya no está en el teléfono' };
  if (item.estado === 'enviando') return { ok: false, reintentable: true, mensaje: 'Enviando…' };

  queue.actualizar(id, { estado: 'enviando', intentos: item.intentos + 1 });
  try {
    const fotos = await Promise.all(
      item.fotos.map(async (path) => new Blob([base64ToBytes(await readBase64(path))], { type: 'image/jpeg' }))
    );
    const resultado = await cumplidosService.registrar(item.remesaId, item.datos, fotos, item.id);
    useCumplidosQueue.getState().quitar(id);
    await removePath(carpeta(id));
    return { ok: true, resultado };
  } catch (error) {
    const reintentable = esReintentable(error);
    const mensaje = axios.isAxiosError(error) && !error.response
      ? 'Sin conexión. Se enviará cuando vuelva la señal.'
      : apiErrorMessage(error, 'El servidor no respondió. Se reintentará.');
    useCumplidosQueue.getState().actualizar(id, { estado: reintentable ? 'pendiente' : 'rechazado', ultimoError: mensaje });
    return { ok: false, reintentable, mensaje };
  }
};

/** Deletes a delivery from the phone (only for rejected ones: the user decides). */
export const descartarCumplido = async (id: string) => {
  useCumplidosQueue.getState().quitar(id);
  await removePath(carpeta(id));
};

let sincronizando = false;

/** Sends every pending delivery of the current session, one at a time. Returns how many went out. */
export const sincronizarCumplidos = async () => {
  if (sincronizando || !useAuthStore.getState().token) return 0;
  sincronizando = true;
  let enviados = 0;
  try {
    const pendientes = colaDeSesion(useCumplidosQueue.getState().cola).filter((c) => c.estado === 'pendiente');
    for (const item of pendientes) {
      const r = await enviarCumplido(item.id);
      if (r.ok) enviados++;
      // Still no signal: don't hammer the rest
      else if (r.reintentable) break;
    }
  } finally {
    sincronizando = false;
  }
  return enviados;
};
