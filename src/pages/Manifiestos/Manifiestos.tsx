import {
  IonContent,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonPage,
  IonRefresher,
  IonRefresherContent,
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
import { FilaLista } from '../../components/Detalle';
import { EstadoBadge, RndcEstado } from '../../components/EstadoBadge';
import { usePagedList } from '../../hooks/usePagedList';
import { icons } from '../../icons';
import { operationsService, type EstadoManifiesto, type Manifiesto } from '../../services/operations.service';
import { useCompanyStore } from '../../store/company.store';
import { documentoKey, useDocumentosStore } from '../../store/documentos.store';
import { ciudad, formatFecha, plural, tipoOracion } from '../../utils/format';

type Filtro = EstadoManifiesto | 'todos';

const filtros: { value: Filtro; label: string }[] = [
  { value: 'activo', label: 'Activos' },
  { value: 'cumplido', label: 'Cumplidos' },
  { value: 'todos', label: 'Todos' },
];

/** Placeholder rows while a list loads, shaped like the real ones. */
export const ListSkeleton: React.FC = () => (
  <div>
    {[0, 1, 2].map((i) => (
      <div key={i} className="flex items-center gap-3.5 border-0 border-b border-solid border-divider px-5 py-3">
        <IonSkeletonText animated className="m-0 h-11 w-11 shrink-0 rounded-full" />
        <div className="flex-1">
          <IonSkeletonText animated style={{ width: '40%', height: 18 }} />
          <IonSkeletonText animated style={{ width: '70%', height: 14, marginTop: 10 }} />
          <IonSkeletonText animated style={{ width: '55%', height: 14, marginTop: 6 }} />
        </div>
      </div>
    ))}
  </div>
);

/** Number and state chip, the first line of every list row. */
export const FilaCabecera: React.FC<{ numero: string; badge: React.ReactNode }> = ({ numero, badge }) => (
  <div className="flex items-center justify-between gap-2">
    <span className="text-[17px] leading-6 font-semibold text-tinta">{numero}</span>
    {badge}
  </div>
);

const ManifiestoFila: React.FC<{ manifiesto: Manifiesto; guardado: boolean }> = ({ manifiesto: m, guardado }) => {
  const router = useIonRouter();
  return (
    <FilaLista icon={icons.truck} onClick={() => router.push(`/manifiestos/${m.id}`)}>
      <FilaCabecera numero={m.numero} badge={<EstadoBadge estado={m.estado} />} />
      <p className="mt-0.5 mb-0 truncate text-[16px] leading-[22px] text-tinta">
        {ciudad(m.origen) || 'Sin origen'} → {ciudad(m.destino) || 'Sin destino'}
      </p>
      <p className="m-0 truncate text-[14px] leading-5 text-muted">
        {[m.placa, tipoOracion(m.conductor?.nombre), formatFecha(m.fechaExpedicion)].filter(Boolean).join(' · ')}
      </p>
      <p className="m-0 flex items-center gap-1 text-[14px] leading-5 text-muted">
        <RndcEstado estado={m.estadoRndc} />
        <span>· {plural(m.remesas, 'remesa', 'remesas')}</span>
        {guardado && (
          <IonIcon icon={icons.deviceMobile} aria-label="Guardado en el teléfono" className="ml-1 text-[16px] text-verde" />
        )}
      </p>
    </FilaLista>
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
              <p className="mt-10 text-center text-body text-muted">
                {q ? 'Ningún manifiesto coincide con la búsqueda' : 'No hay manifiestos'}
              </p>
            )
          ) : (
            <>
              {!guardadoEn && <p className="m-0 px-5 text-[14px] leading-5 text-muted">{plural(total, 'manifiesto', 'manifiestos')}</p>}
              {items.map((m) => (
                <ManifiestoFila key={m.id} manifiesto={m} guardado={!!documentos[documentoKey(companyCode, m.id)]} />
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
