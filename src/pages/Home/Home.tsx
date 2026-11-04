import {
  IonAvatar,
  IonButton,
  IonContent,
  IonIcon,
  IonItem,
  IonLabel,
  IonPage,
  IonProgressBar,
  IonRefresher,
  IonRefresherContent,
  IonRippleEffect,
  IonSkeletonText,
  useIonActionSheet,
  useIonRouter,
  useIonToast,
  useIonViewWillEnter,
  type RefresherEventDetail,
} from '@ionic/react';
import { Preferences } from '@capacitor/preferences';
import { useCallback, useEffect, useState } from 'react';
import { apiErrorMessage } from '../../api/client';
import ViajeEnCurso from '../../components/ViajeEnCurso';
import { icons } from '../../icons';
import { useAppResume } from '../../hooks/useAppResume';
import { useCachedQuery } from '../../hooks/useCachedQuery';
import { VIAJE_ACTIVO_KEY } from '../../offline/seguimiento';
import { activarPush, cerrarSesion, permisoPush, type PermisoPush } from '../../push/push';
import { seguimientoService, type Viaje } from '../../services/seguimiento.service';
import { useAvisosStore } from '../../store/avisos.store';
import { fullName, hasPermiso, type Permiso } from '../../services/auth.service';
import { homeService, type HomeSummary } from '../../services/home.service';
import { operationsService, REMESAS_POR_ENTREGAR } from '../../services/operations.service';
import { useAuthStore } from '../../store/auth.store';
import { useCompanyStore } from '../../store/company.store';
import './Home.css';

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** Placeholder for a figure while the summary loads */
const Skeleton: React.FC<{ width: string }> = ({ width }) => (
  <IonSkeletonText animated className="inline-block align-middle" style={{ width, height: '0.8em' }} />
);

// Each action shows only when the user's role grants its permission; without `permiso`, whenever
// the user sees manifiestos. `href`: screens already built; the others show "Disponible próximamente".
// `contador`: the badge with what is pending. The app doesn't create manifiestos or remesas.
const quickActions: { label: string; icon: string; permiso?: Permiso; href?: string; contador?: 'manifiestos' | 'remesas' }[] = [
  { label: 'Ver manifiestos', icon: icons.truck, href: '/manifiestos', contador: 'manifiestos' },
  { label: 'Ver remesas', icon: icons.fileDescription, href: '/remesas', contador: 'remesas' },
  { label: 'Reportar novedad', icon: icons.alertTriangle, permiso: 'novedades.reportar' },
  // The Remesas tab opens on the ones still to be delivered
  { label: 'Cumplir remesa', icon: icons.clipboardCheck, permiso: 'remesas.cumplir', href: '/remesas' },
];

const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');

/** "Ahora no" on the notifications card hides it for this long. */
const AVISO_PUSH_PAUSA_MS = 30 * 24 * 60 * 60 * 1000;
const AVISO_PUSH_KEY = 'push-tarjeta-oculta-hasta';

const todayLabel = () =>
  new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long' }).format(new Date());

const Home: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const companyName = useCompanyStore((s) => s.company?.name);
  const [presentActionSheet] = useIonActionSheet();
  const [presentToast] = useIonToast();
  const router = useIonRouter();
  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [remesasPorEntregar, setRemesasPorEntregar] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permiso, setPermiso] = useState<PermisoPush>('no_disponible');
  const [tarjetaPush, setTarjetaPush] = useState(false);
  const avisos = useAvisosStore((s) => s.version);
  // Drivers: the trip with tracking, if any (also kept on the phone to answer without signal)
  const esConductor = user?.alcance === 'asignados';
  const viajeActivo = useCachedQuery<Viaje | null>(VIAJE_ACTIVO_KEY, () => seguimientoService.activo());
  const loadViaje = viajeActivo.load;

  const name = user ? fullName(user) : '';
  // Nothing to show: the role sees no manifiestos, or only assigned ones and has no vehicle
  const noAccess = user?.alcance === 'ninguno' || (user?.alcance === 'asignados' && !user.vehiculos?.length);
  const actions = quickActions.filter(({ permiso }) => (permiso ? hasPermiso(user, permiso) : !noAccess));
  const contadores = { manifiestos: summary?.manifiestosActivos, remesas: remesasPorEntregar ?? undefined };
  const placas = user?.alcance === 'asignados' ? user.vehiculos?.map((v) => v.placa).join(', ') : '';

  const loadSummary = useCallback(async () => {
    try {
      setSummary(await homeService.summary());
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo cargar el resumen'));
    }
  }, []);

  // The summary has no remesas to deliver: the total of the Remesas tab's default list
  const loadRemesas = useCallback(async () => {
    try {
      const { total } = await operationsService.remesas({ estado: REMESAS_POR_ENTREGAR, page: 1, pageSize: 1 });
      setRemesasPorEntregar(total);
    } catch {
      // Without signal the badge keeps its last value
    }
  }, []);

  const loadAll = useCallback(
    () => Promise.all([loadSummary(), noAccess ? null : loadRemesas(), esConductor ? loadViaje() : null]),
    [loadSummary, loadRemesas, loadViaje, esConductor, noAccess]
  );

  const revisarPermiso = useCallback(async () => {
    const p = await permisoPush();
    setPermiso(p);
    const { value } = await Preferences.get({ key: AVISO_PUSH_KEY });
    setTarjetaPush(p === 'prompt' && (!value || Number(value) < Date.now()));
  }, []);

  // Ionic keeps the page mounted, so refresh every time Inicio is shown (and on pull down)
  useIonViewWillEnter(() => {
    loadAll();
    revisarPermiso();
  }, [loadAll, revisarPermiso]);
  // Figures depend on the assigned vehicles, which may change while the app is in the background
  useAppResume(loadAll);
  // A notification arrived with the app open: the bell's dot and the trip may have changed
  useEffect(() => {
    if (avisos) loadAll();
  }, [avisos, loadAll]);

  const handleRefresh = async (e: CustomEvent<RefresherEventDetail>) => {
    await loadAll();
    e.detail.complete();
  };

  const activarNotificaciones = async () => {
    try {
      const p = await activarPush();
      setPermiso(p);
      setTarjetaPush(false);
      if (p === 'denied') {
        presentToast({ message: 'Puedes activarlas después en los ajustes del teléfono.', duration: 3000, position: 'bottom' });
      }
    } catch (err) {
      presentToast({ message: apiErrorMessage(err, 'No se pudieron activar las notificaciones'), duration: 3000, position: 'bottom' });
    }
  };

  const ocultarTarjetaPush = () => {
    setTarjetaPush(false);
    Preferences.set({ key: AVISO_PUSH_KEY, value: String(Date.now() + AVISO_PUSH_PAUSA_MS) });
  };

  const viaje = esConductor ? viajeActivo.data : null;

  // TODO: each action opens its own screen once those designs are built
  const comingSoon = () =>
    presentToast({ message: 'Disponible próximamente', duration: 2000, position: 'bottom' });

  const openAccountMenu = () =>
    presentActionSheet({
      header: name,
      subHeader: [companyName, placas, permiso === 'denied' ? 'Notificaciones desactivadas en el teléfono' : '']
        .filter(Boolean)
        .join(' · '),
      buttons: [
        // Clearing the session is enough: the route guard redirects to /login. The phone stops
        // getting this user's notifications first.
        { text: 'Cerrar sesión', role: 'destructive', icon: icons.logout, handler: () => void cerrarSesion() },
        { text: 'Cancelar', role: 'cancel' },
      ],
    });

  return (
    <IonPage>
      <IonContent fullscreen>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        {/* Header */}
        <header className="bg-tinta px-5 pt-[max(54px,calc(var(--ion-safe-area-top)+7px))] pb-[26px]">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={openAccountMenu}
              aria-label="Mi cuenta"
              className="flex cursor-pointer border-0 bg-transparent p-0"
            >
              <IonAvatar className="flex h-11 w-11 items-center justify-center bg-white/12 text-[15px] font-semibold text-white">
                {initials(name)}
              </IonAvatar>
            </button>
            <div className="-mr-[2px] flex">
              <IonButton fill="clear" className="home-header-button" aria-label="Mostrar valores" onClick={comingSoon}>
                <IonIcon slot="icon-only" icon={icons.eye} />
              </IonButton>
              <IonButton fill="clear" className="home-header-button" aria-label="Ayuda" onClick={comingSoon}>
                <IonIcon slot="icon-only" icon={icons.helpCircle} />
              </IonButton>
              <IonButton fill="clear" className="home-header-button relative" aria-label="Notificaciones" onClick={() => router.push('/notificaciones')}>
                <IonIcon slot="icon-only" icon={icons.bell} />
                {/* Unread dot */}
                {!!summary?.notificacionesSinLeer && (
                  <span className="absolute top-[12px] right-[1px] h-2 w-2 rounded-full bg-cielo" />
                )}
              </IonButton>
            </div>
          </div>
          <h1 className="mt-5 mb-0 text-[22px] leading-[26px] font-semibold text-white">Hola, {user?.name}</h1>
          <p className="mt-1 mb-0 text-[14px] leading-5 text-cielo">{companyName}</p>
        </header>

        <div className="px-5">
          {error && (
            <div role="alert" className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-error-rndc-soft px-4 py-3">
              <p className="m-0 text-[14px] leading-5 text-error-rndc">{error}</p>
              <button
                type="button"
                onClick={loadSummary}
                className="shrink-0 cursor-pointer border-0 bg-transparent p-0 text-[14px] leading-5 font-semibold text-error-rndc"
              >
                Reintentar
              </button>
            </div>
          )}

          {viaje && <ViajeEnCurso viaje={viaje} onCambio={loadViaje} />}

          {tarjetaPush && (
            <div className="mt-4 rounded-2xl bg-superficie px-4 py-3">
              <div className="flex items-start gap-3">
                <IonIcon icon={icons.bell} className="mt-[2px] shrink-0 text-[22px] text-tinta" aria-hidden="true" />
                <p className="m-0 text-[14px] leading-5 text-tinta">
                  Activa las notificaciones para saber cuándo aprueban tus sobreanticipos, te asignan un viaje o tu empresa necesita tu
                  ubicación.
                </p>
              </div>
              <div className="mt-2 flex justify-end gap-4">
                <button
                  type="button"
                  onClick={ocultarTarjetaPush}
                  className="cursor-pointer border-0 bg-transparent p-0 text-[14px] leading-5 font-semibold text-muted"
                >
                  Ahora no
                </button>
                <button
                  type="button"
                  onClick={activarNotificaciones}
                  className="cursor-pointer border-0 bg-transparent p-0 text-[14px] leading-5 font-semibold text-verde"
                >
                  Activar
                </button>
              </div>
            </div>
          )}

          {noAccess && (
            <div className="mt-4 flex items-start gap-3 rounded-2xl bg-superficie px-4 py-3">
              <IonIcon icon={icons.truck} className="mt-[2px] shrink-0 text-[22px] text-tinta" aria-hidden="true" />
              <p className="m-0 text-[14px] leading-5 text-tinta">
                No tienes vehículos asignados. Pídele a tu administrador que te asigne uno.
              </p>
            </div>
          )}

          {/* Operación de hoy */}
          <section className="pt-6">
            <button
              type="button"
              onClick={comingSoon}
              className="ion-activatable relative flex w-full cursor-pointer items-center justify-between overflow-hidden border-0 bg-transparent p-0 text-left"
            >
              <h2 className="m-0 text-[18px] leading-6 font-medium text-tinta">Operación de hoy</h2>
              <IonIcon icon={icons.chevronRight} className="text-[20px] text-muted" />
              <IonRippleEffect />
            </button>
            <p className="mt-[10px] mb-0 text-[31px] leading-9 font-semibold tracking-[-1px] text-tinta">
              {summary ? plural(summary.remesasHoy, 'remesa', 'remesas') : <Skeleton width="160px" />}
            </p>
            <p className="mt-1 mb-0 text-[14px] leading-5 text-muted">
              {summary ? (
                plural(summary.manifiestosDespachadosHoy, 'manifiesto despachado', 'manifiestos despachados')
              ) : (
                <Skeleton width="150px" />
              )}{' '}
              · {todayLabel()}
            </p>
          </section>

          {/* Quick actions. The gap matches the design's spacing of four 76px buttons, so fewer stay left-aligned */}
          {actions.length > 0 && (
            <nav className="mt-[22px] flex gap-x-[calc((100%-304px)/3)]" aria-label="Acciones rápidas">
              {actions.map(({ label, icon, href, contador }) => {
                const pendientes = contador ? contadores[contador] : undefined;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => (href ? router.push(href) : comingSoon())}
                    aria-label={pendientes ? `${label}: ${pendientes} pendientes` : undefined}
                    className="flex w-[76px] cursor-pointer flex-col items-center border-0 bg-transparent p-0"
                  >
                    <span className="relative">
                      <span className="ion-activatable relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-superficie">
                        <IonIcon icon={icon} className="text-[26px] text-tinta" />
                        <IonRippleEffect />
                      </span>
                      {!!pendientes && (
                        <span className="absolute -top-1 -right-1 flex h-[22px] min-w-[22px] items-center justify-center rounded-full border-2 border-white bg-verde px-1 text-[12px] leading-none font-semibold text-white">
                          {pendientes > 99 ? '99+' : pendientes}
                        </span>
                      )}
                    </span>
                    <span className="mt-2 text-[13px] leading-[17px] text-tinta">{label}</span>
                  </button>
                );
              })}
            </nav>
          )}

          {/* Mis manifiestos activos */}
          {!noAccess && (
            <IonItem button detail={false} lines="none" className="home-row mt-5" onClick={() => router.push('/manifiestos')}>
              <IonIcon slot="start" icon={icons.alignJustified} />
              <IonLabel>Mis manifiestos activos</IonLabel>
              {!!summary?.manifiestosActivos && (
                <span slot="end" className="home-row-count">
                  {summary.manifiestosActivos}
                </span>
              )}
            </IonItem>
          )}

          {/* Requests for more money during a trip (approved and paid on the web) */}
          {hasPermiso(user, 'sobreanticipos.solicitar') && (
            <IonItem button detail={false} lines="none" className="home-row mt-3" onClick={() => router.push('/sobreanticipos')}>
              <IonIcon slot="start" icon={icons.cash} />
              <IonLabel>Mis sobreanticipos</IonLabel>
            </IonItem>
          )}

          {/* Pending RNDC callout: only when there is something to send */}
          {!!summary?.remesasPendientesRndc && (
            <div className="mt-5 rounded-2xl bg-rndc-pendiente-soft px-[18px] pt-4 pb-[14px]">
              <p className="m-0 text-[15px] leading-5 font-medium text-tinta">
                Tienes {plural(summary.remesasPendientesRndc, 'remesa pendiente', 'remesas pendientes')} por enviar al
                RNDC
              </p>
              {hasPermiso(user, 'rndc.enviar') && (
                <button
                  type="button"
                  onClick={comingSoon}
                  className="mt-[5px] cursor-pointer border-0 bg-transparent p-0 text-[14px] leading-5 font-semibold text-en-ruta"
                >
                  Revisar y enviar
                </button>
              )}
            </div>
          )}
        </div>

        {/* Reporte RNDC */}
        <section className="mt-6 border-t border-divider px-5 pt-[23px] pb-[11px]">
          <button
            type="button"
            onClick={comingSoon}
            className="ion-activatable relative flex w-full cursor-pointer items-center justify-between overflow-hidden border-0 bg-transparent p-0 text-left"
          >
            <h2 className="m-0 text-[18px] leading-6 font-medium text-tinta">Reporte RNDC</h2>
            <IonIcon icon={icons.chevronRight} className="text-[20px] text-muted" />
            <IonRippleEffect />
          </button>
          {/* Current month */}
          <p className="mt-2 mb-0 text-[14px] leading-5 text-muted">
            {summary ? (
              `${summary.rndc.reportadas} de ${plural(summary.rndc.total, 'remesa reportada', 'remesas reportadas')}`
            ) : (
              <Skeleton width="190px" />
            )}
          </p>
          <IonProgressBar
            className="home-progress mt-2"
            value={summary?.rndc.total ? summary.rndc.reportadas / summary.rndc.total : 0}
            aria-label="Remesas reportadas al RNDC"
          />
        </section>
      </IonContent>
    </IonPage>
  );
};

export default Home;
