import {
  IonContent,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonRippleEffect,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  useIonRouter,
  useIonViewWillEnter,
  type RefresherEventDetail,
} from '@ionic/react';
import { useEffect, useState } from 'react';
import AppHeader from '../../components/AppHeader';
import { AvisoSinConexion } from '../../components/Avisos';
import ColaCumplidos from '../../components/ColaCumplidos';
import { EstadoBadge, RndcEstado } from '../../components/EstadoBadge';
import { usePagedList } from '../../hooks/usePagedList';
import { icons } from '../../icons';
import { colaDeSesion } from '../../offline/cumplidos';
import { operationsService, type EstadoRemesa, type Remesa } from '../../services/operations.service';
import { useCumplidosQueue } from '../../store/cumplidosQueue.store';
import { ciudad, formatFecha, formatKg, plural } from '../../utils/format';
import { ListSkeleton } from '../Manifiestos/Manifiestos';

type Filtro = 'por_entregar' | 'cumplido' | 'todas';

const filtros: { value: Filtro; label: string; estado?: EstadoRemesa[] }[] = [
  { value: 'por_entregar', label: 'Por entregar', estado: ['manifiesto', 'en_ruta'] },
  { value: 'cumplido', label: 'Cumplidas', estado: ['cumplido'] },
  { value: 'todas', label: 'Todas' },
];

const RemesaCard: React.FC<{ remesa: Remesa; enCola: boolean }> = ({ remesa: r, enCola }) => {
  const router = useIonRouter();
  return (
    <button
      type="button"
      onClick={() => router.push(`/remesas/${r.id}`)}
      className="ion-activatable relative block w-full cursor-pointer overflow-hidden rounded-2xl border border-divider bg-white p-4 text-left"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[17px] leading-6 font-semibold text-tinta">{r.numero}</span>
        {enCola ? <EstadoBadge estado="en_ruta" label="Entrega en cola" /> : <EstadoBadge estado={r.estado} />}
      </div>
      <p className="mt-1 mb-0 truncate text-[14px] leading-5 text-tinta">{r.cliente?.nombre ?? 'Sin cliente'}</p>
      <p className="mt-1 mb-0 text-[13px] leading-[18px] text-muted">
        {ciudad(r.origen) || 'Sin origen'} → {ciudad(r.destino) || 'Sin destino'} · {formatFecha(r.fecha)}
      </p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <RndcEstado estado={r.estadoRndc} />
        <span className="flex min-w-0 items-center gap-1 text-caption text-muted">
          <IonIcon icon={icons.package} className="shrink-0 text-[15px]" aria-hidden="true" />
          <span className="truncate">{[r.producto, formatKg(r.pesoKg)].filter(Boolean).join(' · ')}</span>
        </span>
      </div>
      <IonRippleEffect />
    </button>
  );
};

/** Remesas tab: by default the ones still to be delivered, which is what a driver needs. */
const Remesas: React.FC = () => {
  const [filtro, setFiltro] = useState<Filtro>('por_entregar');
  const [q, setQ] = useState('');
  const cola = useCumplidosQueue((s) => s.cola);
  const enCola = new Set(colaDeSesion(cola).map((c) => c.remesaId));
  const estado = filtros.find((f) => f.value === filtro)?.estado;

  const { items, total, error, guardadoEn, reload, loadMore, hasMore } = usePagedList<Remesa>(
    q ? null : `remesas:${filtro}`,
    (page, pageSize) => operationsService.remesas({ estado, q: q || undefined, page, pageSize })
  );

  // Also when the queue shrinks: a delivery that just went out changes the remesa's state
  const enColaCount = cola.length;
  useEffect(() => {
    reload();
  }, [reload, filtro, q, enColaCount]);

  useIonViewWillEnter(() => {
    reload();
  }, [reload]);

  const handleRefresh = async (e: CustomEvent<RefresherEventDetail>) => {
    await reload();
    e.detail.complete();
  };

  return (
    <IonPage>
      <AppHeader title="Remesas">
        <IonSearchbar
          value={q}
          debounce={400}
          placeholder="Número, cliente o consecutivo"
          searchIcon={icons.search}
          onIonInput={(e) => setQ((e.detail.value ?? '').trim())}
        />
        <IonSegment value={filtro} onIonChange={(e) => setFiltro(e.detail.value as Filtro)}>
          {filtros.map((f) => (
            <IonSegmentButton key={f.value} value={f.value}>
              {f.label}
            </IonSegmentButton>
          ))}
        </IonSegment>
      </AppHeader>

      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <div className="flex flex-col gap-3 px-4 pt-4 pb-6">
          <ColaCumplidos />
          <AvisoSinConexion error={error} guardadoEn={guardadoEn} onRetry={reload} />

          {items === null ? (
            <ListSkeleton />
          ) : items.length === 0 ? (
            !error && (
              <p className="mt-10 text-center text-body text-muted">
                {q ? 'Ninguna remesa coincide con la búsqueda' : filtro === 'por_entregar' ? 'No tienes remesas por entregar' : 'No hay remesas'}
              </p>
            )
          ) : (
            <>
              {!guardadoEn && <p className="m-0 text-caption text-muted">{plural(total, 'remesa', 'remesas')}</p>}
              {items.map((r) => (
                <RemesaCard key={r.id} remesa={r} enCola={enCola.has(r.id)} />
              ))}
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

export default Remesas;
