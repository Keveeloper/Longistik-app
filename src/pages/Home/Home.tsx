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
  useIonToast,
  useIonViewWillEnter,
  type RefresherEventDetail,
} from '@ionic/react';
import { useCallback, useState } from 'react';
import { apiErrorMessage } from '../../api/client';
import { icons } from '../../icons';
import { fullName } from '../../services/auth.service';
import { homeService, type HomeSummary } from '../../services/home.service';
import { useAuthStore } from '../../store/auth.store';
import { useCompanyStore } from '../../store/company.store';
import './Home.css';

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** Placeholder for a figure while the summary loads */
const Skeleton: React.FC<{ width: string }> = ({ width }) => (
  <IonSkeletonText animated className="inline-block align-middle" style={{ width, height: '0.8em' }} />
);

const quickActions = [
  { label: 'Nuevo manifiesto', icon: icons.truck },
  { label: 'Nueva remesa', icon: icons.fileDescription },
  { label: 'Reportar novedad', icon: icons.alertTriangle },
  { label: 'Cumplir remesa', icon: icons.clipboardCheck },
];

const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');

const todayLabel = () =>
  new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long' }).format(new Date());

const Home: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const companyName = useCompanyStore((s) => s.company?.name);
  const [presentActionSheet] = useIonActionSheet();
  const [presentToast] = useIonToast();
  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const name = user ? fullName(user) : '';

  const loadSummary = useCallback(async () => {
    try {
      setSummary(await homeService.summary());
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo cargar el resumen'));
    }
  }, []);

  // Ionic keeps the page mounted, so refresh every time Inicio is shown (and on pull down)
  useIonViewWillEnter(() => {
    loadSummary();
  }, [loadSummary]);

  const handleRefresh = async (e: CustomEvent<RefresherEventDetail>) => {
    await loadSummary();
    e.detail.complete();
  };

  // TODO: each action opens its own screen once those designs are built
  const comingSoon = () =>
    presentToast({ message: 'Disponible próximamente', duration: 2000, position: 'bottom' });

  const openAccountMenu = () =>
    presentActionSheet({
      header: name,
      subHeader: companyName,
      buttons: [
        // Clearing the session is enough: the route guard redirects to /login
        { text: 'Cerrar sesión', role: 'destructive', icon: icons.logout, handler: () => logout() },
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
              <IonButton fill="clear" className="home-header-button relative" aria-label="Notificaciones" onClick={comingSoon}>
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

          {/* Quick actions */}
          <nav className="mt-[22px] flex justify-between" aria-label="Acciones rápidas">
            {quickActions.map(({ label, icon }) => (
              <button
                key={label}
                type="button"
                onClick={comingSoon}
                className="flex w-[76px] cursor-pointer flex-col items-center border-0 bg-transparent p-0"
              >
                <span className="ion-activatable relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-superficie">
                  <IonIcon icon={icon} className="text-[26px] text-tinta" />
                  <IonRippleEffect />
                </span>
                <span className="mt-2 text-[13px] leading-[17px] text-tinta">{label}</span>
              </button>
            ))}
          </nav>

          {/* Mis manifiestos activos */}
          <IonItem button detail={false} lines="none" className="home-row mt-5" onClick={comingSoon}>
            <IonIcon slot="start" icon={icons.alignJustified} />
            <IonLabel>Mis manifiestos activos</IonLabel>
            {!!summary?.manifiestosActivos && (
              <span slot="end" className="home-row-count">
                {summary.manifiestosActivos}
              </span>
            )}
          </IonItem>

          {/* Pending RNDC callout: only when there is something to send */}
          {!!summary?.remesasPendientesRndc && (
            <div className="mt-5 rounded-2xl bg-rndc-pendiente-soft px-[18px] pt-4 pb-[14px]">
              <p className="m-0 text-[15px] leading-5 font-medium text-tinta">
                Tienes {plural(summary.remesasPendientesRndc, 'remesa pendiente', 'remesas pendientes')} por enviar al
                RNDC
              </p>
              <button
                type="button"
                onClick={comingSoon}
                className="mt-[5px] cursor-pointer border-0 bg-transparent p-0 text-[14px] leading-5 font-semibold text-en-ruta"
              >
                Revisar y enviar
              </button>
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
