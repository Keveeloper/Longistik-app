import { useMemo, useState } from 'react';
import {
  IonContent,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonSegment,
  IonSegmentButton,
  useIonToast,
} from '@ionic/react';
import PageTitleBar from '../../components/PageTitleBar';
import StatusBadge from '../../components/StatusBadge';
import { novedadesMock, type Novedad } from '../../data/novedades.mock';
import { icons } from '../../icons';
import { formatTimeAgo } from '../../utils/format';
import './Novedades.css';

type Vista = 'abiertas' | 'cerradas';

// Full class names so Tailwind can detect them
const iconClasses: Record<Novedad['estado'], string> = {
  abierta: 'bg-en-ruta-soft text-en-ruta',
  'en-gestion': 'bg-creada-soft text-creada',
  cerrada: 'bg-cumplido-soft text-cumplido',
};

/** Line next to the badge: who handles it, or the evidence attached. */
const footerText = (n: Novedad) => {
  if (n.estado === 'cerrada' && n.resueltaPor) return `Resuelta por ${n.resueltaPor}`;
  if (n.asignadaA) return `Asignada a ${n.asignadaA}`;
  const evidencias = [
    n.fotos > 0 ? `${n.fotos} ${n.fotos === 1 ? 'foto' : 'fotos'}` : null,
    n.ubicacion ? 'ubicación' : null,
  ].filter(Boolean);
  return evidencias.length ? evidencias.join(' · ') : 'Sin evidencias';
};

const Novedades: React.FC = () => {
  const [vista, setVista] = useState<Vista>('abiertas');
  const [presentToast] = useIonToast();

  const novedades = useMemo(
    () => novedadesMock.filter((n) => (vista === 'abiertas' ? n.estado !== 'cerrada' : n.estado === 'cerrada')),
    [vista],
  );

  const manifiestosAfectados = new Set(novedades.map((n) => n.manifiesto)).size;
  const resumen =
    vista === 'abiertas'
      ? {
          titulo: `${novedades.length} ${novedades.length === 1 ? 'abierta' : 'abiertas'}`,
          detalle: `En ${manifiestosAfectados} ${manifiestosAfectados === 1 ? 'manifiesto activo' : 'manifiestos activos'} hoy`,
        }
      : {
          titulo: `${novedades.length} ${novedades.length === 1 ? 'cerrada' : 'cerradas'}`,
          detalle: 'En los últimos 7 días',
        };

  // TODO: "Reportar novedad" (08) and the novedad detail screens
  const comingSoon = () =>
    presentToast({ message: 'Disponible próximamente', duration: 2000, position: 'bottom' });

  return (
    <IonPage>
      <IonContent fullscreen>
        <div className="px-5 pt-[max(56px,calc(var(--ion-safe-area-top)+9px))]">
          <PageTitleBar title="Novedades" addLabel="Reportar novedad" onAdd={comingSoon} />

          <IonSegment
            className="novedades-segment mt-4.5"
            value={vista}
            onIonChange={(e) => setVista(e.detail.value as Vista)}
          >
            <IonSegmentButton value="abiertas">
              <IonLabel>Abiertas</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="cerradas">
              <IonLabel>Cerradas</IonLabel>
            </IonSegmentButton>
          </IonSegment>

          <p className="mt-6.25 mb-0 text-[31px] leading-9 font-semibold tracking-[-1px] text-tinta">{resumen.titulo}</p>
          <p className="mt-0.75 mb-0 text-[14px] leading-5 text-muted">{resumen.detalle}</p>
        </div>

        {novedades.length > 0 ? (
          <IonList lines="full" className="novedades-list">
            {novedades.map((n) => (
              <IonItem key={n.id} button detail={false} className="novedades-item" onClick={comingSoon}>
                <span
                  slot="start"
                  className={`m-0 me-3.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${iconClasses[n.estado]}`}
                >
                  <IonIcon icon={icons.alertTriangle} className="text-[22px]" />
                </span>
                <IonLabel className="m-0">
                  <div className="flex items-start justify-between gap-3">
                    <span className="truncate text-[16px] leading-5 font-semibold text-tinta">{n.tipo}</span>
                    <span className="shrink-0 text-[13px] leading-3.75 text-muted">{formatTimeAgo(n.reportadaEn)}</span>
                  </div>
                  <div className="mt-0.75 truncate text-[14px] leading-5 text-muted">
                    {n.manifiesto} · {n.origen} → {n.destino}
                  </div>
                  <div className="mt-1 text-[15px] leading-5 whitespace-normal text-tinta">{n.descripcion}</div>
                  <div className="mt-2.75 flex items-center gap-2">
                    <StatusBadge estado={n.estado} />
                    <span className="truncate text-[13px] leading-5 text-muted">{footerText(n)}</span>
                  </div>
                </IonLabel>
              </IonItem>
            ))}
          </IonList>
        ) : (
          <p className="mt-10 px-5 text-center text-[14px] text-muted">No hay novedades {vista}.</p>
        )}
      </IonContent>
    </IonPage>
  );
};

export default Novedades;
