import {
  IonContent,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonPage,
  IonRefresher,
  IonRefresherContent,
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
import { FilaLista } from '../../components/Detalle';
import { EstadoBadge, RndcEstado } from '../../components/EstadoBadge';
import { usePagedList } from '../../hooks/usePagedList';
import { icons } from '../../icons';
import { colaDeSesion } from '../../offline/cumplidos';
import { operationsService, REMESAS_POR_ENTREGAR, type EstadoRemesa, type Remesa } from '../../services/operations.service';
import { useCumplidosQueue } from '../../store/cumplidosQueue.store';
import { ciudad, formatFecha, formatKg, plural, tipoOracion } from '../../utils/format';
import { FilaCabecera, ListSkeleton } from '../Manifiestos/Manifiestos';

type Filtro = 'por_entregar' | 'cumplido' | 'todas';

const filtros: { value: Filtro; label: string; estado?: EstadoRemesa[] }[] = [
  { value: 'por_entregar', label: 'Por entregar', estado: REMESAS_POR_ENTREGAR },
  { value: 'cumplido', label: 'Cumplidas', estado: ['cumplido'] },
  { value: 'todas', label: 'Todas' },
];

const RemesaFila: React.FC<{ remesa: Remesa; enCola: boolean }> = ({ remesa: r, enCola }) => {
  const router = useIonRouter();
  return (
    <FilaLista icon={icons.fileDescription} onClick={() => router.push(`/remesas/${r.id}`)}>
      <FilaCabecera
        numero={r.numero}
        badge={enCola ? <EstadoBadge estado="en_ruta" label="Entrega en cola" /> : <EstadoBadge estado={r.estado} />}
      />
      <p className="mt-0.5 mb-0 truncate text-[16px] leading-[22px] text-tinta">
        {ciudad(r.origen) || 'Sin origen'} → {ciudad(r.destino) || 'Sin destino'}
      </p>
      <p className="m-0 truncate text-[14px] leading-5 text-muted">
        {[tipoOracion(r.cliente?.nombre) || 'Sin cliente', formatFecha(r.fecha)].join(' · ')}
      </p>
      <p className="m-0 flex min-w-0 items-center gap-1 text-[14px] leading-5 text-muted">
        <RndcEstado estado={r.estadoRndc} />
        <span className="truncate">· {[r.producto, formatKg(r.pesoKg)].filter(Boolean).join(' · ')}</span>
      </p>
    </FilaLista>
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

        <div className="pb-6">
          <div className="flex flex-col gap-3 px-5 pb-3 empty:hidden">
            <ColaCumplidos />
            <AvisoSinConexion error={error} guardadoEn={guardadoEn} onRetry={reload} />
          </div>

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
              {!guardadoEn && <p className="m-0 px-5 text-[14px] leading-5 text-muted">{plural(total, 'remesa', 'remesas')}</p>}
              {items.map((r) => (
                <RemesaFila key={r.id} remesa={r} enCola={enCola.has(r.id)} />
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
