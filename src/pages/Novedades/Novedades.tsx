import { useEffect, useState } from 'react';
import {
  IonContent,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonLabel,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSegment,
  IonSegmentButton,
  useIonActionSheet,
  useIonRouter,
  useIonToast,
  useIonViewWillEnter,
  type RefresherEventDetail,
} from '@ionic/react';
import { AvisoSinConexion } from '../../components/Avisos';
import { NovedadEnColaFila, NovedadFila } from '../../components/Novedades';
import PageTitleBar from '../../components/PageTitleBar';
import { usePagedList } from '../../hooks/usePagedList';
import { descartarNovedad, enviarNovedad, novedadesEnCola } from '../../offline/novedades';
import { hasPermiso } from '../../services/auth.service';
import { novedadesService, type Novedad, type VistaNovedades } from '../../services/novedades.service';
import { useAuthStore } from '../../store/auth.store';
import { useNovedadesCola, type NovedadEnCola } from '../../store/novedadesCola.store';
import { plural } from '../../utils/format';
import { ListSkeleton } from '../Manifiestos/Manifiestos';
import './Novedades.css';

/**
 * Novedades tab: the ones the user can see (theirs and those of the manifiestos they see), split
 * into Abiertas (abierta + en gestión) and Cerradas. Those still on the phone go first.
 */
const Novedades: React.FC = () => {
  const router = useIonRouter();
  const [vista, setVista] = useState<VistaNovedades>('abiertas');
  const [presentToast] = useIonToast();
  const [presentActionSheet] = useIonActionSheet();
  const puedeReportar = useAuthStore((s) => hasPermiso(s.user, 'novedades.reportar'));
  const cola = novedadesEnCola(useNovedadesCola((s) => s.cola));

  const { items, total, error, guardadoEn, reload, loadMore, hasMore } = usePagedList<Novedad>(`novedades:${vista}`, (page, pageSize) =>
    novedadesService.listar({ vista, page, pageSize })
  );

  useEffect(() => {
    reload();
  }, [reload, vista]);
  useIonViewWillEnter(() => {
    reload();
  }, [reload]);

  // One that was waiting for signal went out: show it in the list
  const enCola = cola.length;
  useEffect(() => {
    reload();
  }, [enCola, reload]);

  const handleRefresh = async (e: CustomEvent<RefresherEventDetail>) => {
    await reload();
    e.detail.complete();
  };

  const abrirEnCola = (item: NovedadEnCola) => {
    if (item.estado === 'rechazado') {
      presentActionSheet({
        header: item.ultimoError ?? 'El servidor no aceptó la novedad',
        buttons: [
          { text: 'Descartar', role: 'destructive', handler: () => void descartarNovedad(item.id) },
          { text: 'Cancelar', role: 'cancel' },
        ],
      });
      return;
    }
    enviarNovedad(item.id).then((r) => {
      presentToast({ message: r.ok ? 'Novedad enviada' : r.mensaje, duration: 3000, position: 'bottom' });
      if (r.ok) reload();
    });
  };

  const manifiestos = new Set((items ?? []).map((n) => n.manifiesto.id)).size;
  const resumen =
    vista === 'abiertas'
      ? {
          titulo: plural(total, 'abierta', 'abiertas'),
          detalle: total ? `En ${plural(manifiestos, 'manifiesto', 'manifiestos')}` : 'Sin novedades por atender',
        }
      : { titulo: plural(total, 'cerrada', 'cerradas'), detalle: 'Las más recientes primero' };

  return (
    <IonPage>
      <IonContent fullscreen>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <div className="px-5 pt-[max(56px,calc(var(--ion-safe-area-top)+9px))]">
          {puedeReportar ? (
            <PageTitleBar title="Novedades" addLabel="Reportar novedad" onAdd={() => router.push('/novedades/reportar')} />
          ) : (
            <h1 className="m-0 text-[31px] leading-9 font-semibold tracking-[-1px] text-tinta">Novedades</h1>
          )}

          <IonSegment className="novedades-segment mt-4.5" value={vista} onIonChange={(e) => setVista(e.detail.value as VistaNovedades)}>
            <IonSegmentButton value="abiertas">
              <IonLabel>Abiertas</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="cerradas">
              <IonLabel>Cerradas</IonLabel>
            </IonSegmentButton>
          </IonSegment>

          {error && (
            <div className="mt-4">
              <AvisoSinConexion error={error} guardadoEn={guardadoEn} onRetry={reload} />
            </div>
          )}

          {items !== null && !guardadoEn && (
            <>
              <p className="mt-6.25 mb-0 text-[31px] leading-9 font-semibold tracking-[-1px] text-tinta">{resumen.titulo}</p>
              <p className="mt-0.75 mb-0 text-[14px] leading-5 text-muted">{resumen.detalle}</p>
            </>
          )}
        </div>

        <div className="mt-1.5 pb-6">
          {vista === 'abiertas' && cola.map((c) => <NovedadEnColaFila key={c.id} item={c} onClick={() => abrirEnCola(c)} />)}
          {items === null ? (
            <ListSkeleton />
          ) : items.length === 0 && !(vista === 'abiertas' && cola.length) ? (
            !error && <p className="mt-10 px-5 text-center text-[14px] text-muted">No hay novedades {vista}.</p>
          ) : (
            items.map((n) => <NovedadFila key={n.id} novedad={n} onClick={() => router.push(`/novedades/${n.id}`)} />)
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

export default Novedades;
