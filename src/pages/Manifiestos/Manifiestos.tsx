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
  IonSkeletonText,
  useIonRouter,
  useIonViewWillEnter,
  type RefresherEventDetail,
} from '@ionic/react';
import { useEffect, useState } from 'react';
import AppHeader from '../../components/AppHeader';
import { AvisoSinConexion } from '../../components/Avisos';
import { EstadoBadge, RndcEstado } from '../../components/EstadoBadge';
import { usePagedList } from '../../hooks/usePagedList';
import { icons } from '../../icons';
import { operationsService, type EstadoManifiesto, type Manifiesto } from '../../services/operations.service';
import { useCompanyStore } from '../../store/company.store';
import { documentoKey, useDocumentosStore } from '../../store/documentos.store';
import { ciudad, formatFecha, plural } from '../../utils/format';

type Filtro = EstadoManifiesto | 'todos';

const filtros: { value: Filtro; label: string }[] = [
  { value: 'activo', label: 'Activos' },
  { value: 'cumplido', label: 'Cumplidos' },
  { value: 'todos', label: 'Todos' },
];

export const ListSkeleton: React.FC = () => (
  <div className="flex flex-col gap-3">
    {[0, 1, 2].map((i) => (
      <div key={i} className="rounded-2xl border border-divider p-4">
        <IonSkeletonText animated style={{ width: '40%', height: 18 }} />
        <IonSkeletonText animated style={{ width: '70%', height: 14, marginTop: 10 }} />
        <IonSkeletonText animated style={{ width: '55%', height: 14, marginTop: 6 }} />
      </div>
    ))}
  </div>
);

const ManifiestoCard: React.FC<{ manifiesto: Manifiesto; guardado: boolean }> = ({ manifiesto: m, guardado }) => {
  const router = useIonRouter();
  return (
    <button
      type="button"
      onClick={() => router.push(`/manifiestos/${m.id}`)}
      className="ion-activatable relative block w-full cursor-pointer overflow-hidden rounded-2xl border border-divider bg-white p-4 text-left"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[17px] leading-6 font-semibold text-tinta">{m.numero}</span>
        <EstadoBadge estado={m.estado} />
      </div>
      <p className="mt-1 mb-0 text-[14px] leading-5 text-tinta">
        {ciudad(m.origen) || 'Sin origen'} → {ciudad(m.destino) || 'Sin destino'}
      </p>
      <p className="mt-1 mb-0 text-[13px] leading-[18px] text-muted">
        {[m.placa, m.conductor?.nombre, formatFecha(m.fechaExpedicion)].filter(Boolean).join(' · ')}
      </p>
      <div className="mt-2 flex items-center justify-between">
        <RndcEstado estado={m.estadoRndc} />
        <span className="flex items-center gap-2 text-caption text-muted">
          {guardado && <IonIcon icon={icons.deviceMobile} aria-label="Guardado en el teléfono" className="text-[16px] text-verde" />}
          {plural(m.remesas, 'remesa', 'remesas')}
        </span>
      </div>
      <IonRippleEffect />
    </button>
  );
};

/** Manifiestos tab: the ones the user can see (their vehicles' for drivers), filterable and searchable. */
const Manifiestos: React.FC = () => {
  const [filtro, setFiltro] = useState<Filtro>('activo');
  const [q, setQ] = useState('');
  const companyCode = useCompanyStore((s) => s.company?.code ?? '');
  const documentos = useDocumentosStore((s) => s.documentos);

  const { items, total, error, guardadoEn, reload, loadMore, hasMore } = usePagedList<Manifiesto>(
    q ? null : `manifiestos:${filtro}`,
    (page, pageSize) =>
      operationsService.manifiestos({ estado: filtro === 'todos' ? undefined : filtro, q: q || undefined, page, pageSize })
  );

  useEffect(() => {
    reload();
  }, [reload, filtro, q]);

  useIonViewWillEnter(() => {
    reload();
  }, [reload]);

  const handleRefresh = async (e: CustomEvent<RefresherEventDetail>) => {
    await reload();
    e.detail.complete();
  };

  return (
    <IonPage>
      <AppHeader title="Manifiestos">
        <IonSearchbar
          value={q}
          debounce={400}
          placeholder="Número, placa o conductor"
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
          <AvisoSinConexion error={error} guardadoEn={guardadoEn} onRetry={reload} />

          {items === null ? (
            <ListSkeleton />
          ) : items.length === 0 ? (
            !error && (
              <p className="mt-10 text-center text-body text-muted">
                {q ? 'Ningún manifiesto coincide con la búsqueda' : 'No hay manifiestos'}
              </p>
            )
          ) : (
            <>
              {!guardadoEn && <p className="m-0 text-caption text-muted">{plural(total, 'manifiesto', 'manifiestos')}</p>}
              {items.map((m) => (
                <ManifiestoCard key={m.id} manifiesto={m} guardado={!!documentos[documentoKey(companyCode, m.id)]} />
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

export default Manifiestos;
