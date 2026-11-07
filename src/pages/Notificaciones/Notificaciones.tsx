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
  novedad: icons.alertTriangle,
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

        <div className="pb-6">
          {error && (
            <div className="px-5 pb-3">
              <AvisoSinConexion error={error} guardadoEn={guardadoEn} onRetry={reload} />
            </div>
          )}
          {items === null ? (
            <ListSkeleton />
          ) : items.length === 0 ? (
            !error && (
              <div className="flex flex-col items-center px-10 pt-[120px] text-center">
                <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-superficie">
                  <IonIcon icon={icons.bell} className="text-[28px] text-tinta" aria-hidden="true" />
                </span>
                <p className="mt-5 mb-0 text-[20px] leading-7 font-semibold text-tinta">Todo al día</p>
                <p className="mt-2 mb-0 text-[16px] leading-[22px] text-muted">
                  Aquí verás los avisos de tus manifiestos, remesas y sobreanticipos.
                </p>
              </div>
            )
          ) : (
            <ul className="m-0 list-none p-0">
              {items.map((n) => {
                const nueva = !n.leida && !leidas.has(n.id);
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => abrir(n)}
                      className="ion-activatable relative flex w-full cursor-pointer items-start gap-3.5 overflow-hidden border-0 border-b border-solid border-divider bg-white px-5 py-3 text-left"
                    >
                      <span
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                          n.prioridad === 'alta' ? 'bg-error-rndc-soft text-error-rndc' : 'bg-superficie text-tinta'
                        }`}
                      >
                        <IonIcon icon={iconoDe(n.tipo)} className="text-[22px]" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-[16px] leading-[22px] text-tinta ${nueva ? 'font-semibold' : 'font-medium'}`}>
                          {n.titulo}
                        </span>
                        <span className="mt-0.5 block text-[15px] leading-[21px] text-tinta">{n.mensaje}</span>
                        <span className="mt-0.5 block text-[14px] leading-5 text-muted">{formatFechaHora(n.creadaEn)}</span>
                      </span>
                      {nueva && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-cielo" aria-label="Sin leer" />}
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
