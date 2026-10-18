import { useMemo, useState } from 'react';
import {
  IonButton,
  IonChip,
  IonContent,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonSearchbar,
  useIonToast,
} from '@ionic/react';
import RndcStatus from '../../components/RndcStatus';
import StatusBadge from '../../components/StatusBadge';
import { manifiestosMock, type Manifiesto } from '../../data/manifiestos.mock';
import { icons } from '../../icons';
import { formatCOP, formatShortDate } from '../../utils/format';
import './Manifiestos.css';

type Filtro = 'todos' | 'activos' | 'inactivos';

const filtros: { value: Filtro; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'activos', label: 'Activos' },
  { value: 'inactivos', label: 'Inactivos' },
];

/** Case- and accent-insensitive comparison for search */
const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '') // strip accents left by NFD
    .toLowerCase();

const matchesSearch = (m: Manifiesto, query: string) => {
  const q = normalize(query.trim());
  if (!q) return true;
  return [m.numero, m.origen, m.destino, m.placa].some((field) => normalize(field).includes(q));
};

const Manifiestos: React.FC = () => {
  const [query, setQuery] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [presentToast] = useIonToast();

  const manifiestos = useMemo(
    () =>
      manifiestosMock.filter(
        (m) =>
          matchesSearch(m, query) &&
          (filtro === 'todos' || (filtro === 'activos' ? m.estado === 'activo' : m.estado === 'inactivo')),
      ),
    [query, filtro],
  );

  // TODO: "Nuevo manifiesto" and "Detalle de manifiesto" screens
  const comingSoon = () =>
    presentToast({ message: 'Disponible próximamente', duration: 2000, position: 'bottom' });

  return (
    <IonPage>
      <IonContent fullscreen>
        <div className="px-5 pt-[max(56px,calc(var(--ion-safe-area-top)+9px))]">
          <div className="flex items-center justify-between">
            <h1 className="m-0 text-[31px] leading-9 font-semibold tracking-[-1px] text-tinta">Manifiestos</h1>
            <IonButton className="manifiestos-add" aria-label="Nuevo manifiesto" onClick={comingSoon}>
              <IonIcon slot="icon-only" icon={icons.plus} />
            </IonButton>
          </div>

          <IonSearchbar
            className="manifiestos-search mt-4.5"
            placeholder="Buscar por número, ruta o placa"
            searchIcon={icons.search}
            showClearButton="focus"
            value={query}
            onIonInput={(e) => setQuery(e.detail.value ?? '')}
            debounce={150}
          />

          <div className="mt-4.5 flex gap-2" role="group" aria-label="Filtrar por estado">
            {filtros.map(({ value, label }) => {
              const selected = filtro === value;
              return (
                <IonChip
                  key={value}
                  role="button"
                  aria-pressed={selected ? 'true' : 'false'}
                  onClick={() => setFiltro(value)}
                  className={`m-0 h-9 rounded-full border border-solid px-4 text-[14px] font-medium ${
                    selected ? 'border-tinta bg-tinta text-white' : 'border-line bg-transparent text-tinta'
                  }`}
                >
                  {label}
                </IonChip>
              );
            })}
          </div>

          <p className="mt-3.5 mb-0 text-[13px] leading-4 text-muted">
            {manifiestos.length} {manifiestos.length === 1 ? 'manifiesto' : 'manifiestos'} · últimos 7 días
          </p>
        </div>

        {manifiestos.length > 0 ? (
          <IonList lines="full" className="manifiestos-list">
            {manifiestos.map((m) => (
              <IonItem key={m.numero} button detail={false} className="manifiestos-item" onClick={comingSoon}>
                <span
                  slot="start"
                  className="m-0 me-3.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-superficie"
                >
                  <IonIcon icon={icons.truck} className="text-[22px] text-tinta" />
                </span>
                <IonLabel className="mx-0 mt-1 mb-0">
                  <div className="text-[16px] leading-5 font-semibold text-tinta">{m.numero}</div>
                  <div className="mt-0.75 truncate text-[14px] leading-5 text-muted">
                    {m.origen} → {m.destino}
                  </div>
                  <div className="text-[13px] leading-5 text-muted">
                    <RndcStatus estado={m.rndc} />
                    <span className="mx-1.5">·</span>
                    {formatShortDate(m.fecha)}
                  </div>
                </IonLabel>
                <div slot="end" className="m-0 ms-3 flex flex-col items-end gap-1">
                  <span className="text-[15px] leading-5 font-semibold text-tinta">{formatCOP(m.valor)}</span>
                  <StatusBadge estado={m.estado} />
                </div>
              </IonItem>
            ))}
          </IonList>
        ) : (
          <p className="mt-10 px-5 text-center text-[14px] text-muted">No hay manifiestos que coincidan con la búsqueda.</p>
        )}
      </IonContent>
    </IonPage>
  );
};

export default Manifiestos;
