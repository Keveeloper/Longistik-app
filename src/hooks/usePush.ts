import { useIonAlert, useIonToast } from '@ionic/react';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { responderPedido } from '../offline/seguimiento';
import { esDeEstaSesion, parseLink, rutaDeAviso, type DataPush } from '../push/avisos';
import { iniciarPush, permisoPush, pushDisponible, registrarDispositivo } from '../push/push';
import { notificacionesService } from '../services/notificaciones.service';
import { useAuthStore } from '../store/auth.store';
import { useAvisosStore } from '../store/avisos.store';
import { useCompanyStore } from '../store/company.store';

/**
 * Push on the phone, mounted once next to the route guard (request/notificaciones-push.md §7):
 * registers the phone when the permission was already given, shows notifications that arrive
 * with the app open in a modal (Android shows nothing then), and opens the right screen when one
 * is tapped.
 */
export const usePush = () => {
  const signedIn = useAuthStore((s) => !!s.token);
  const userId = useAuthStore((s) => s.user?.id);
  const navigate = useNavigate();
  const [presentToast] = useIonToast();
  const [presentAlert] = useIonAlert();
  const latest = useRef({ navigate, presentToast, presentAlert });
  latest.current = { navigate, presentToast, presentAlert };

  // Already allowed (from a previous launch): keep the token registered with this session
  useEffect(() => {
    if (!signedIn || !pushDisponible()) return;
    permisoPush().then((p) => {
      console.info('[push] permiso:', p);
      if (p === 'granted') registrarDispositivo().catch((err) => console.warn('[push] no se registró el teléfono', err));
    });
  }, [signedIn, userId]);

  useEffect(() => {
    if (!signedIn || !pushDisponible()) return;
    const deEstaSesion = (data: DataPush) =>
      esDeEstaSesion(data, useCompanyStore.getState().company?.code, useAuthStore.getState().user?.id);

    let limpiar: (() => void) | null = null;
    let activo = true;
    iniciarPush({
      onRecibida: (titulo, cuerpo, data) => {
        console.info('[push] recibida con la app abierta:', data.tipo);
        if (!deEstaSesion(data)) return;
        useAvisosStore.getState().refrescar();
        const link = parseLink(data.link);
        // The driver has the app open: answer the location request without asking
        if (data.tipo === 'seguimiento.pedido' && link) {
          responderPedido(link.id)
            .then((r) =>
              latest.current.presentToast({
                message: r.estado === 'sin_viaje' ? r.mensaje : 'Ubicación compartida con tu empresa',
                duration: 2500,
                position: 'top',
              })
            )
            .catch(() => undefined);
          return;
        }
        const abrir = () => {
          if (data.notificacionId) notificacionesService.marcarLeida(Number(data.notificacionId)).catch(() => undefined);
          latest.current.navigate(rutaDeAviso(data.tipo, link));
        };
        latest.current.presentAlert({
          header: titulo || 'Nueva notificación',
          message: cuerpo,
          buttons: [
            { text: 'Cerrar', role: 'cancel' },
            { text: link ? 'Ver' : 'Ver notificaciones', handler: abrir },
          ],
        });
      },
      onAbierta: (data) => {
        if (!deEstaSesion(data)) {
          latest.current.navigate('/inicio');
          return;
        }
        if (data.notificacionId) notificacionesService.marcarLeida(Number(data.notificacionId)).catch(() => undefined);
        useAvisosStore.getState().refrescar();
        latest.current.navigate(rutaDeAviso(data.tipo, parseLink(data.link)));
      },
    }).then((fn) => {
      if (activo) limpiar = fn;
      else fn();
    });
    return () => {
      activo = false;
      limpiar?.();
    };
  }, [signedIn]);
};
