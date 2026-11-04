import { IonIcon, IonSpinner, useIonRouter, useIonToast } from '@ionic/react';
import { useState } from 'react';
import { apiErrorMessage } from '../api/client';
import { icons } from '../icons';
import { responderPedido } from '../offline/seguimiento';
import type { Viaje } from '../services/seguimiento.service';

/**
 * Inicio, while the driver has a trip with tracking (request/seguimiento-viaje.md §6.3):
 * share the location in one tap, or open the trip.
 */
const ViajeEnCurso: React.FC<{ viaje: Viaje; onCambio: () => void }> = ({ viaje, onCambio }) => {
  const router = useIonRouter();
  const [presentToast] = useIonToast();
  const [enviando, setEnviando] = useState(false);
  const numero = viaje.manifiesto ?? `#${viaje.manifiestoId}`;
  const abrir = () => router.push(`/manifiestos/${viaje.manifiestoId}?seccion=seguimiento`);

  const compartir = async () => {
    setEnviando(true);
    try {
      const r = await responderPedido(viaje.manifiestoId);
      presentToast({
        message:
          r.estado === 'sin_viaje' ? r.mensaje : r.estado === 'enviado' ? 'Ubicación compartida con tu empresa' : 'Sin señal: se enviará apenas haya conexión',
        duration: 2500,
        position: 'bottom',
      });
    } catch (err) {
      presentToast({ message: apiErrorMessage(err, 'No se pudo compartir la ubicación'), duration: 3500, position: 'bottom' });
    } finally {
      setEnviando(false);
      onCambio();
    }
  };

  const titulo =
    viaje.estado === 'asignado'
      ? `Tu empresa activó el seguimiento de ${numero}`
      : viaje.estado === 'pausado'
        ? `Viaje ${numero} en pausa`
        : `Viaje ${numero} en curso`;

  return (
    <div className="mt-4 rounded-2xl bg-superficie px-4 py-3" role="region" aria-label="Viaje en curso">
      <button type="button" onClick={abrir} className="flex w-full cursor-pointer items-center gap-3 border-0 bg-transparent p-0 text-left">
        <IonIcon icon={icons.route} className="shrink-0 text-[22px] text-tinta" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] leading-5 font-medium text-tinta">{titulo}</span>
          {viaje.estado === 'activo' && viaje.pedidoAbierto && (
            <span className="block text-[13px] leading-[18px] font-medium text-en-ruta">Tu empresa pidió tu ubicación</span>
          )}
          {viaje.estado === 'asignado' && <span className="block text-[13px] leading-[18px] text-muted">Toca para aceptarlo</span>}
        </span>
        <IonIcon icon={icons.chevronRight} className="shrink-0 text-[20px] text-muted" />
      </button>
      {viaje.estado === 'activo' && (
        <button
          type="button"
          onClick={compartir}
          disabled={enviando}
          className="mt-2 flex cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-[14px] leading-5 font-semibold text-verde disabled:opacity-60"
        >
          {enviando ? <IonSpinner name="crescent" className="h-4 w-4" /> : <IonIcon icon={icons.mapPinShare} className="text-[18px]" />}
          Compartir ubicación
        </button>
      )}
    </div>
  );
};

export default ViajeEnCurso;
