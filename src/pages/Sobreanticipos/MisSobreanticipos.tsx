import {
  IonContent,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonRippleEffect,
  IonSegment,
  IonSegmentButton,
  useIonAlert,
  useIonRouter,
  useIonToast,
  useIonViewWillEnter,
  type RefresherEventDetail,
} from '@ionic/react';
import { useEffect, useState } from 'react';
import { apiErrorMessage } from '../../api/client';
import AppHeader from '../../components/AppHeader';
import { AvisoSinConexion } from '../../components/Avisos';
import { SobreanticipoFila } from '../../components/Sobreanticipos';
import { usePagedList } from '../../hooks/usePagedList';
import { hasPermiso } from '../../services/auth.service';
import {
  esCancelable,
  sobreanticiposService,
  type EstadoSobreanticipo,
  type Sobreanticipo,
} from '../../services/sobreanticipos.service';
import { useAuthStore } from '../../store/auth.store';
import { plural } from '../../utils/format';
import { ListSkeleton } from '../Manifiestos/Manifiestos';

type Filtro = 'todas' | EstadoSobreanticipo;

const filtros: { value: Filtro; label: string }[] = [
  { value: 'todas', label: 'Todas' },
  { value: 'solicitada', label: 'Pendientes' },
  { value: 'aprobada', label: 'Aprobadas' },
  { value: 'pagada', label: 'Pagadas' },
  { value: 'rechazada', label: 'Rechazadas' },
];

/** The user's own sobreanticipo requests; tap one to see it in its manifiesto. */
const MisSobreanticipos: React.FC = () => {
  const router = useIonRouter();
  const [presentAlert] = useIonAlert();
  const [presentToast] = useIonToast();
  const permitido = useAuthStore((s) => hasPermiso(s.user, 'sobreanticipos.solicitar'));
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [cancelando, setCancelando] = useState<number | null>(null);

  const { items, total, error, guardadoEn, reload, loadMore, hasMore } = usePagedList<Sobreanticipo>(
    permitido ? `sobreanticipos:${filtro}` : null,
    (page, pageSize) => sobreanticiposService.mias({ estado: filtro === 'todas' ? undefined : filtro, page, pageSize })
  );

  useEffect(() => {
    if (permitido) reload();
  }, [reload, filtro, permitido]);

  // No push notifications yet: refresh whenever the screen is shown, and on pull down
  useIonViewWillEnter(() => {
    if (permitido) reload();
  }, [reload, permitido]);

  const handleRefresh = async (e: CustomEvent<RefresherEventDetail>) => {
    await reload();
    e.detail.complete();
  };

  const cancelar = async (s: Sobreanticipo, notas: string) => {
    setCancelando(s.id);
    try {
      const r = await sobreanticiposService.cancelar(s.id, notas.trim() || undefined);
      presentToast({ message: r.mensaje, duration: 3000, position: 'bottom' });
    } catch (err) {
      // 409 CONFLICT: it was already decided; the reload shows its current state
      presentToast({ message: apiErrorMessage(err, 'No se pudo cancelar la solicitud'), duration: 4000, position: 'bottom' });
    } finally {
      setCancelando(null);
      reload();
    }
  };

  const confirmarCancelar = (s: Sobreanticipo) =>
    presentAlert({
      header: 'Cancelar solicitud',
      message: `¿Cancelar el sobreanticipo de ${s.manifiesto ?? 'este manifiesto'}?`,
      inputs: [{ name: 'notas', type: 'textarea', placeholder: 'Motivo (opcional)', attributes: { maxlength: 500 } }],
      buttons: [
        { text: 'Volver', role: 'cancel' },
        { text: 'Cancelar solicitud', role: 'destructive', handler: (v: { notas?: string }) => void cancelar(s, v?.notas ?? '') },
      ],
    });

  return (
    <IonPage>
      <AppHeader title="Mis sobreanticipos" backHref="/inicio">
        {permitido && (
          <IonSegment scrollable value={filtro} onIonChange={(e) => setFiltro(e.detail.value as Filtro)}>
            {filtros.map((f) => (
              <IonSegmentButton key={f.value} value={f.value}>
                {f.label}
              </IonSegmentButton>
            ))}
          </IonSegment>
        )}
      </AppHeader>

      <IonContent>
        <IonRefresher slot="fixed" disabled={!permitido} onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <div className="pb-6">
          {!permitido ? (
            <p className="mt-10 px-5 text-center text-body text-muted">No tienes permiso para solicitar sobreanticipos</p>
          ) : (
            <>
              {error && (
                <div className="px-5 pb-3">
                  <AvisoSinConexion error={error} guardadoEn={guardadoEn} onRetry={reload} />
                </div>
              )}
              {items === null ? (
                <ListSkeleton />
              ) : items.length === 0 ? (
                !error && (
                  <p className="mt-10 text-center text-body text-muted">
                    {filtro === 'todas' ? 'No has solicitado sobreanticipos' : 'No hay solicitudes en este estado'}
                  </p>
                )
              ) : (
                <>
                  {!guardadoEn && <p className="m-0 px-5 text-[14px] leading-5 text-muted">{plural(total, 'solicitud', 'solicitudes')}</p>}
                  <div>
                    {items.map((s) => (
                      <div key={s.id} className="border-0 border-b border-solid border-divider px-5 [&_.border-b]:border-b-0">
                        <button
                          type="button"
                          aria-label={`Ver ${s.manifiesto ?? 'manifiesto'}`}
                          onClick={() => router.push(`/manifiestos/${s.manifiestoId}?seccion=sobreanticipos`)}
                          className="ion-activatable relative block w-full cursor-pointer overflow-hidden border-0 bg-transparent p-0 text-left"
                        >
                          <SobreanticipoFila item={s} conManifiesto />
                          <IonRippleEffect />
                        </button>
                        {esCancelable(s) && !guardadoEn && (
                          <button
                            type="button"
                            disabled={cancelando === s.id}
                            onClick={() => confirmarCancelar(s)}
                            className="mb-3 ml-[58px] cursor-pointer border-0 bg-transparent p-0 text-[14px] leading-5 font-semibold text-error-rndc disabled:opacity-50"
                          >
                            {cancelando === s.id ? 'Cancelando…' : 'Cancelar solicitud'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
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

export default MisSobreanticipos;
