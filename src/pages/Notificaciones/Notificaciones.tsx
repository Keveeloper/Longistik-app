import {
  IonButton,
  IonContent,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonRippleEffect,
  useIonRouter,
  useIonToast,
  useIonViewWillEnter,
  type RefresherEventDetail,
} from '@ionic/react';
import { useEffect, useState } from 'react';
import { apiErrorMessage } from '../../api/client';
import AppHeader from '../../components/AppHeader';
import { AvisoSinConexion } from '../../components/Avisos';
import { usePagedList } from '../../hooks/usePagedList';
import { icons } from '../../icons';
import { rutaDeAviso } from '../../push/avisos';
import { notificacionesService, type Notificacion } from '../../services/notificaciones.service';
import { useAvisosStore } from '../../store/avisos.store';
import { formatFechaHora } from '../../utils/format';
import { ListSkeleton } from '../Manifiestos/Manifiestos';

const ICONO: Record<string, string> = {
  sobreanticipo: icons.cash,
  seguimiento: icons.route,
};
const iconoDe = (tipo: string) =>
  tipo === 'seguimiento.auxilio' ? icons.lifebuoy : ICONO[tipo.split('.')[0]] ?? icons.bell;

/** The bell (request/notificaciones-push.md §7.6): every notification, even those whose push never arrived. */
const Notificaciones: React.FC = () => {
  const router = useIonRouter();
  const [presentToast] = useIonToast();
  const version = useAvisosStore((s) => s.version);
  const [leidas, setLeidas] = useState<Set<number>>(new Set());

  const { items, error, guardadoEn, reload, loadMore, hasMore } = usePagedList<Notificacion>('notificaciones', (page, pageSize) =>
    notificacionesService.listar({ page, pageSize })
  );

  useEffect(() => {
    reload();
  }, [reload, version]);

  useIonViewWillEnter(() => {
    reload();
  }, [reload]);

  const handleRefresh = async (e: CustomEvent<RefresherEventDetail>) => {
    await reload();
    e.detail.complete();
  };

  const abrir = (n: Notificacion) => {
    if (!n.leida) {
      setLeidas((s) => new Set(s).add(n.id));
      notificacionesService.marcarLeida(n.id).catch(() => undefined);
    }
    if (n.link) router.push(rutaDeAviso(n.tipo, n.link));
  };

  const marcarTodas = async () => {
    try {
      await notificacionesService.marcarTodas();
      setLeidas(new Set((items ?? []).map((n) => n.id)));
    } catch (err) {
      presentToast({ message: apiErrorMessage(err, 'No se pudieron marcar'), duration: 3000, position: 'bottom' });
    }
  };

  const sinLeer = (items ?? []).filter((n) => !n.leida && !leidas.has(n.id)).length;

  return (
    <IonPage>
      <AppHeader
        title="Notificaciones"
        backHref="/inicio"
        end={
          <IonButton aria-label="Marcar todas como leídas" disabled={!sinLeer || !!guardadoEn} onClick={marcarTodas}>
            <IonIcon slot="icon-only" icon={icons.checks} />
          </IonButton>
        }
      />
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <div className="px-4 pt-4 pb-6">
          <AvisoSinConexion error={error} guardadoEn={guardadoEn} onRetry={reload} />
          {items === null ? (
            <ListSkeleton />
          ) : items.length === 0 ? (
            !error && <p className="mt-10 text-center text-body text-muted">No tienes notificaciones</p>
          ) : (
            <ul className="m-0 mt-1 list-none p-0">
              {items.map((n) => {
                const nueva = !n.leida && !leidas.has(n.id);
                return (
                  <li key={n.id} className="border-0 border-b border-solid border-divider last:border-b-0">
                    <button
                      type="button"
                      onClick={() => abrir(n)}
                      className="ion-activatable relative flex w-full cursor-pointer items-start gap-3 overflow-hidden border-0 bg-transparent px-0 py-3 text-left"
                    >
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                          n.prioridad === 'alta' ? 'bg-error-rndc-soft text-error-rndc' : 'bg-superficie text-tinta'
                        }`}
                      >
                        <IonIcon icon={iconoDe(n.tipo)} className="text-[20px]" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-[15px] leading-5 text-tinta ${nueva ? 'font-semibold' : 'font-medium'}`}>
                          {n.titulo}
                        </span>
                        <span className="mt-[2px] block text-[14px] leading-5 text-tinta">{n.mensaje}</span>
                        <span className="mt-1 block text-caption text-muted">{formatFechaHora(n.creadaEn)}</span>
                      </span>
                      {nueva && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-cielo" aria-label="Sin leer" />}
                      <IonRippleEffect />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <IonInfiniteScroll
          disabled={!hasMore || !!guardadoEn}
          onIonInfinite={async (e) => {
            await loadMore();
            e.target.complete();
          }}
        >
          <IonInfiniteScrollContent />
        </IonInfiniteScroll>
      </IonContent>
    </IonPage>
  );
};

export default Notificaciones;
