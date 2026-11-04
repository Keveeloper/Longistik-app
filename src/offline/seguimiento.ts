/*
 * Location reports of a trip (request/seguimiento-viaje.md). Every report is queued on the
 * phone first and sent in batches with its idempotency key, so a report taken without
 * signal goes out later and a retry never duplicates it. Nothing runs in the background:
 * the location is only taken when the driver acts or has the app open.
 */
import { Device } from '@capacitor/device';
import { Geolocation } from '@capacitor/geolocation';
import { seguimientoService, type ReporteNuevo, type TipoReporte, type Viaje } from '../services/seguimiento.service';
import { useAuthStore } from '../store/auth.store';
import { useCompanyStore } from '../store/company.store';
import { leerDeCache } from '../store/offlineCache.store';
import { useSeguimientoCola } from '../store/seguimientoCola.store';
import { esReintentable, nuevoId } from './cumplidos';
import { obtenerUbicacion } from './evidencia';

const LOTE = 50;

const sesionActual = () => ({
  companyCode: useCompanyStore.getState().company?.code ?? '',
  userId: useAuthStore.getState().user?.id ?? 0,
});

export const reportesDeSesion = () => {
  const { companyCode, userId } = sesionActual();
  return useSeguimientoCola.getState().cola.filter((c) => c.companyCode === companyCode && c.userId === userId);
};

const bateria = async (): Promise<number | null> => {
  try {
    const { batteryLevel } = await Device.getBatteryInfo();
    return typeof batteryLevel === 'number' && batteryLevel >= 0 ? Math.round(batteryLevel * 100) : null;
  } catch {
    return null;
  }
};

/** Takes the location now (asks for the permission if needed). Throws a user-facing error. */
export const capturarReporte = async (viajeId: number, tipo: TipoReporte, pedidoId?: number | null): Promise<ReporteNuevo> => {
  const [ubicacion, nivel] = await Promise.all([obtenerUbicacion(), bateria()]);
  return {
    viajeId,
    pedidoId: pedidoId ?? null,
    tipo,
    latitud: ubicacion.latitud,
    longitud: ubicacion.longitud,
    precisionMetros: Math.round(ubicacion.precision),
    bateria: nivel,
    capturadoEn: ubicacion.fecha.toISOString(),
    idempotencyKey: nuevoId(),
  };
};

/** `enviado`: the backend has it; otherwise it waits in the queue for signal. */
export const encolarYEnviar = async (reporte: ReporteNuevo): Promise<{ enviado: boolean }> => {
  useSeguimientoCola.getState().agregar({ ...sesionActual(), reporte, intentos: 0 });
  await sincronizarReportes();
  return { enviado: !reportesDeSesion().some((c) => c.reporte.idempotencyKey === reporte.idempotencyKey) };
};

/** Takes the location and sends it (or queues it without signal). */
export const reportar = async (viajeId: number, tipo: TipoReporte, pedidoId?: number | null) =>
  encolarYEnviar(await capturarReporte(viajeId, tipo, pedidoId));

let sincronizando = false;

/** Sends the queued reports of this session in batches. Returns how many the backend took. */
export const sincronizarReportes = async () => {
  if (sincronizando || !useAuthStore.getState().token) return 0;
  sincronizando = true;
  let enviados = 0;
  try {
    for (;;) {
      const lote = reportesDeSesion().slice(0, LOTE);
      if (!lote.length) break;
      const claves = lote.map((c) => c.reporte.idempotencyKey);
      try {
        const resultados = await seguimientoService.reportes(lote.map((c) => c.reporte));
        // aceptado, duplicado (ya estaba) o rechazado (viaje terminado o ajeno): no se reintenta
        useSeguimientoCola.getState().quitar(claves);
        enviados += resultados.filter((r) => r.estado !== 'rechazado').length;
      } catch (error) {
        if (esReintentable(error)) {
          useSeguimientoCola.getState().sumarIntento(claves);
          break;
        }
        // The batch itself was refused (malformed): retrying won't help
        useSeguimientoCola.getState().quitar(claves);
      }
    }
  } finally {
    sincronizando = false;
  }
  return enviados;
};

/**
 * The app was opened during an active trip and the last report is older than half the
 * interval: report silently, so the server doesn't need to ask (§6.4).
 */
export const debeReportarOportunista = (viaje: Pick<Viaje, 'estado' | 'intervaloMin' | 'ultimoReporte'> | null, ahora = new Date()) => {
  if (!viaje || viaje.estado !== 'activo') return false;
  if (!viaje.ultimoReporte) return true;
  return ahora.getTime() - new Date(viaje.ultimoReporte.capturadoEn).getTime() > (viaje.intervaloMin * 60_000) / 2;
};

/** Only with the permission already granted: an automatic report never shows a prompt. */
export const reportarOportunista = async (viaje: Viaje | null) => {
  if (!debeReportarOportunista(viaje)) return false;
  if (reportesDeSesion().some((c) => c.reporte.viajeId === viaje!.id)) return false;
  try {
    const { location } = await Geolocation.checkPermissions();
    if (location !== 'granted') return false;
    await reportar(viaje!.id, 'oportunista');
    return true;
  } catch {
    return false;
  }
};

/** Cache key of the user's active trip (Inicio keeps it fresh), used to answer without signal. */
export const VIAJE_ACTIVO_KEY = 'viaje-activo';

export type RespuestaPedido =
  | { estado: 'enviado' | 'en_cola'; viaje: Viaje }
  | { estado: 'sin_viaje'; mensaje: string };

/**
 * Answers a location request of the trip of `manifiestoId`: the open request if there is one,
 * otherwise a voluntary report. Without signal it uses the trip saved on the phone and queues it.
 */
export const responderPedido = async (manifiestoId: number): Promise<RespuestaPedido> => {
  let viaje: Viaje | null = null;
  try {
    viaje = (await seguimientoService.estado(manifiestoId)).viaje;
  } catch (error) {
    if (!esReintentable(error)) throw error;
    const guardado = leerDeCache<Viaje | null>(VIAJE_ACTIVO_KEY)?.data ?? null;
    viaje = guardado?.manifiestoId === manifiestoId ? guardado : null;
  }
  const userId = useAuthStore.getState().user?.id;
  if (!viaje || viaje.conductor?.id !== userId || (viaje.estado !== 'activo' && viaje.estado !== 'pausado')) {
    return { estado: 'sin_viaje', mensaje: 'Este viaje ya no tiene seguimiento activo.' };
  }
  const { enviado } = await reportar(viaje.id, viaje.pedidoAbierto ? 'pedido' : 'voluntario', viaje.pedidoAbierto?.id);
  return { estado: enviado ? 'enviado' : 'en_cola', viaje };
};
