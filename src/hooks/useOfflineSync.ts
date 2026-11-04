import { useCallback, useEffect } from 'react';
import { prepararDocumentosActivos } from '../offline/documentos';
import { colaDeSesion, sincronizarCumplidos } from '../offline/cumplidos';
import { reportarOportunista, reportesDeSesion, sincronizarReportes, VIAJE_ACTIVO_KEY } from '../offline/seguimiento';
import { seguimientoService } from '../services/seguimiento.service';
import { guardarEnCache } from '../store/offlineCache.store';
import { useSeguimientoCola } from '../store/seguimientoCola.store';
import { useAuthStore } from '../store/auth.store';
import { useCumplidosQueue } from '../store/cumplidosQueue.store';
import { useAppResume } from './useAppResume';
import { useOnline } from './useOnline';

/** While deliveries are waiting, try again this often (besides reconnection and resume). */
const REINTENTO_MS = 60_000;

/**
 * Background work for the road, mounted once next to the route guard: sends the deliveries
 * and trip locations saved without signal, keeps the active manifiestos' PDFs on the phone and,
 * during a tracked trip, reports the location when the app is opened (so the server doesn't
 * need to ask). Runs on sign-in, when the connection comes back and when the app returns to the
 * foreground; nothing runs while the app is closed.
 */
export const useOfflineSync = () => {
  const signedIn = useAuthStore((s) => !!s.token);
  const userId = useAuthStore((s) => s.user?.id);
  const online = useOnline();
  const esConductor = useAuthStore((s) => s.user?.alcance === 'asignados');
  const cumplidosPendientes = useCumplidosQueue((s) => colaDeSesion(s.cola).filter((c) => c.estado === 'pendiente').length);
  const reportesPendientes = useSeguimientoCola((s) => s.cola.length && reportesDeSesion().length);
  const pendientes = cumplidosPendientes + reportesPendientes;

  const sync = useCallback(() => {
    if (!signedIn) return;
    sincronizarCumplidos();
    sincronizarReportes();
    prepararDocumentosActivos();
    if (esConductor) {
      seguimientoService
        .activo()
        .then((viaje) => {
          guardarEnCache(VIAJE_ACTIVO_KEY, viaje);
          return reportarOportunista(viaje);
        })
        .catch(() => undefined);
    }
  }, [signedIn, esConductor]);

  useEffect(() => {
    if (online) sync();
  }, [online, sync, userId]);

  useAppResume(sync);

  useEffect(() => {
    if (!signedIn || !pendientes) return;
    const timer = setInterval(() => {
      sincronizarCumplidos();
      sincronizarReportes();
    }, REINTENTO_MS);
    return () => clearInterval(timer);
  }, [signedIn, pendientes]);
};
