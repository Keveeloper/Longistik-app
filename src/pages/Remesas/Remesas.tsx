import { useMemo, useState } from 'react';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonItem,
  IonItemDivider,
  IonItemGroup,
  IonLabel,
  IonList,
  IonPage,
  useIonToast,
} from '@ionic/react';
import FilterChips, { type FilterOption } from '../../components/FilterChips';
import PageTitleBar from '../../components/PageTitleBar';
import RndcStatus from '../../components/RndcStatus';
import SearchBar from '../../components/SearchBar';
import StatusBadge from '../../components/StatusBadge';
import { remesasMock, type Remesa } from '../../data/remesas.mock';
import { icons } from '../../icons';
import { formatDayHeading } from '../../utils/format';
import { matchesQuery } from '../../utils/search';
import './Remesas.css';

type Filtro = 'todas' | 'creada' | 'en-ruta' | 'cumplido';

const filtros: FilterOption<Filtro>[] = [
  { value: 'todas', label: 'Todas' },
  { value: 'creada', label: 'Creadas' },
  { value: 'en-ruta', label: 'En ruta' },
  { value: 'cumplido', label: 'Cumplidas' },
];

/** RNDC line under each remesa, as worded in the design */
const rndcLabel = (r: Remesa) => {
  if (r.estado === 'cumplido' && r.consecutivoCumplido) return `Cumplido RNDC ${r.consecutivoCumplido}`;
  return r.rndc === 'reportado' ? 'RNDC reportado' : 'Pendiente por enviar al RNDC';
};

/** Groups consecutive remesas by date, keeping the list order (newest first). */
const groupByDay = (remesas: Remesa[]) =>
  remesas.reduce<{ fecha: string; remesas: Remesa[] }[]>((groups, r) => {
    const last = groups[groups.length - 1];
    if (last?.fecha === r.fecha) last.remesas.push(r);
    else groups.push({ fecha: r.fecha, remesas: [r] });
    return groups;
  }, []);

const pendientesRndc = remesasMock.filter((r) => r.rndc === 'pendiente').length;

const Remesas: React.FC = () => {
  const [query, setQuery] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [presentToast] = useIonToast();

  const grupos = useMemo(
    () =>
      groupByDay(
        remesasMock.filter(
          (r) => matchesQuery(query, [r.numero, r.cliente, r.nit]) && (filtro === 'todas' || r.estado === filtro),
        ),
      ),
    [query, filtro],
  );

  // TODO: "Nueva remesa", "Detalle de remesa" and sending to the RNDC
  const comingSoon = () =>
    presentToast({ message: 'Disponible próximamente', duration: 2000, position: 'bottom' });

  return (
    <IonPage>
      <IonContent fullscreen>
        <div className="px-5 pt-[max(56px,calc(var(--ion-safe-area-top)+9px))]">
          <PageTitleBar title="Remesas" addLabel="Nueva remesa" onAdd={comingSoon} />

          <SearchBar
            className="mt-4.5"
            placeholder="Buscar por número, cliente o NIT"
            value={query}
            onChange={setQuery}
          />

          <FilterChips
            className="mt-4.5"
            options={filtros}
            value={filtro}
            onChange={setFiltro}
            ariaLabel="Filtrar por estado"
          />

          {pendientesRndc > 0 && (
            <div className="mt-4.5 flex items-center justify-between gap-3 rounded-2xl bg-rndc-pendiente-soft py-3 ps-4 pe-3.5">
              <p className="m-0 text-[14px] leading-4.75 font-medium text-tinta">
                {pendientesRndc} {pendientesRndc === 1 ? 'remesa pendiente' : 'remesas pendientes'} por enviar al RNDC
              </p>
              <IonButton className="remesas-send shrink-0 text-[14px] font-semibold tracking-normal normal-case" onClick={comingSoon}>
                Enviar
              </IonButton>
            </div>
          )}
        </div>

        {grupos.length > 0 ? (
          <IonList lines="none" className="remesas-list">
            {grupos.map((grupo) => (
              <IonItemGroup key={grupo.fecha}>
                <IonItemDivider className="remesas-day pt-4 pb-0.75">
                  <IonLabel className="m-0 leading-5">{formatDayHeading(grupo.fecha)}</IonLabel>
                </IonItemDivider>
                {grupo.remesas.map((r) => (
                  <IonItem key={r.numero} button detail={false} className="remesas-item" onClick={comingSoon}>
                    <span
                      slot="start"
                      className="m-0 me-3.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-superficie"
                    >
                      <IonIcon icon={icons.fileDescription} className="text-[22px] text-tinta" />
                    </span>
                    <IonLabel className="mx-0 mt-0.5 mb-0">
                      <div className="text-[16px] leading-5 font-semibold text-tinta">{r.numero}</div>
                      <div className="mt-px truncate text-[14px] leading-5 text-muted">{r.cliente}</div>
                      <div className="text-[13px] leading-5 text-muted">
                        <RndcStatus estado={r.rndc} label={rndcLabel(r)} />
                      </div>
                    </IonLabel>
                    <StatusBadge slot="end" estado={r.estado} className="m-0 ms-3" />
                  </IonItem>
                ))}
              </IonItemGroup>
            ))}
          </IonList>
        ) : (
          <p className="mt-10 px-5 text-center text-[14px] text-muted">No hay remesas que coincidan con la búsqueda.</p>
        )}
      </IonContent>
    </IonPage>
  );
};

export default Remesas;
