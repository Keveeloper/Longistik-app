import {
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonModal,
  IonSkeletonText,
  IonSpinner,
  IonTitle,
  IonToolbar,
  useIonAlert,
  useIonToast,
} from '@ionic/react';
import { useState } from 'react';
import { apiErrorCode, apiErrorMessage } from '../api/client';
import { useOnline } from '../hooks/useOnline';
import { icons } from '../icons';
import { descripcionDispositivo } from '../offline/evidencia';
import { capturarReporte, reportar } from '../offline/seguimiento';
import { seguimientoService, type EstadoSeguimiento, type Viaje } from '../services/seguimiento.service';
import { useAuthStore } from '../store/auth.store';
import { formatHora, tipoOracion } from '../utils/format';
import { Aviso, AvisoAccion } from './Avisos';

/** Text the driver accepts (Ley 1581 de 2012). Changing it needs a new version in the backend. */
export const TextoConsentimiento: React.FC = () => (
  <div className="flex flex-col gap-3 text-[15px] leading-[22px] text-tinta">
    <p className="m-0">
      <span className="font-medium">Para qué:</span> la seguridad de tu viaje y la tuya. Tu empresa sabe por dónde vas y te puede
      ayudar si algo pasa.
    </p>
    <p className="m-0">
      <span className="font-medium">Qué se comparte:</span> tu ubicación solo cuando la empresa la pide durante el viaje (te
      llega una notificación) o cuando tú la envías. Nunca en segundo plano ni fuera del viaje.
    </p>
    <p className="m-0">
      <span className="font-medium">Quién la ve:</span> tu empresa. Se guarda 90 días.
    </p>
    <p className="m-0">
      <span className="font-medium">Tú decides:</span> puedes pausar o terminar el seguimiento cuando quieras. Si no respondes un
      pedido, no pasa nada.
    </p>
    <p className="m-0 text-muted">Responde los pedidos solo cuando estés detenido de forma segura: no uses el celular manejando.</p>
  </div>
);

const ConsentimientoModal: React.FC<{ isOpen: boolean; onAceptar: () => void; onCerrar: () => void; enviando: boolean }> = ({
  isOpen,
  onAceptar,
  onCerrar,
  enviando,
}) => (
  <IonModal isOpen={isOpen} onDidDismiss={onCerrar}>
    <IonHeader>
      <IonToolbar className="app-toolbar">
        <IonTitle>Seguimiento del viaje</IonTitle>
        <IonButtons slot="end">
          <IonButton aria-label="Cerrar" onClick={onCerrar}>
            <IonIcon slot="icon-only" icon={icons.x} />
          </IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>
    <IonContent>
      <div className="px-4 pt-4 pb-6">
        <TextoConsentimiento />
      </div>
    </IonContent>
    <IonFooter className="ion-no-border">
      <IonToolbar className="app-modal-footer">
        <div className="flex flex-col gap-2 px-4 py-2">
          <IonButton expand="block" className="m-0 h-[52px] normal-case tracking-normal" disabled={enviando} onClick={onAceptar}>
            {enviando ? <IonSpinner name="crescent" /> : 'Aceptar e iniciar'}
          </IonButton>
          <IonButton expand="block" className="btn-secundario m-0 h-[52px]" onClick={onCerrar}>
            Ahora no
          </IonButton>
        </div>
      </IonToolbar>
    </IonFooter>
  </IonModal>
);

const ESTADO_REPORTE: Record<string, { texto: string; clase: string }> = {
  en_ruta: { texto: 'En la ruta', clase: 'text-cumplido' },
  desviado: { texto: 'Fuera de la ruta', clase: 'text-en-ruta' },
  sin_ruta: { texto: 'Ubicación recibida', clase: 'text-muted' },
};

const mapsUrl = (lat: number, lng: number) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

/** Last report, next request and alerts of a trip. */
const ResumenViaje: React.FC<{ viaje: Viaje; propio: boolean }> = ({ viaje: v, propio }) => {
  const ultimo = v.ultimoReporte;
  return (
    <div className="flex flex-col gap-1 text-[14px] leading-5 text-tinta">
      {!propio && v.conductor && <p className="m-0">Conductor: {v.conductor.nombre}</p>}
      {ultimo ? (
        <p className="m-0">
          Último reporte {formatHora(ultimo.capturadoEn)}
          {ultimo.estado && <span className={ESTADO_REPORTE[ultimo.estado]?.clase}> · {ESTADO_REPORTE[ultimo.estado]?.texto}</span>}
          {ultimo.atrasoMin !== null && ultimo.atrasoMin > 15 && <span className="text-muted"> · {ultimo.atrasoMin} min de atraso</span>}
          {!propio && (
            <>
              {' · '}
              <a href={mapsUrl(ultimo.latitud, ultimo.longitud)} target="_blank" rel="noreferrer" className="text-petroleo">
                Ver en el mapa
              </a>
            </>
          )}
        </p>
      ) : (
        <p className="m-0 text-muted">Sin reportes todavía</p>
      )}
      {v.estado === 'activo' && v.pedidoAbierto && (
        <p className="m-0 font-medium text-en-ruta">Tu empresa pidió tu ubicación (hasta las {formatHora(v.pedidoAbierto.venceEn)})</p>
      )}
      {v.estado === 'activo' && !v.pedidoAbierto && v.proximoPedido && (
        <p className="m-0 text-muted">Próximo pedido de ubicación ~{formatHora(v.proximoPedido)}</p>
      )}
      {v.estado === 'pausado' && <p className="m-0 text-muted">En pausa{v.pausaMotivo ? `: ${v.pausaMotivo}` : ''}</p>}
    </div>
  );
};

/**
 * "Seguimiento del viaje" in the manifiesto detail (request/seguimiento-viaje.md §6.2):
 * the driver starts it (or accepts the one the company assigned), shares the location,
 * asks for help, pauses or ends it. Others see the trip's status.
 */
const SeguimientoViaje: React.FC<{
  manifiestoId: number;
  data: EstadoSeguimiento | null;
  loading: boolean;
  error: string | null;
  onRecargar: () => void;
}> = ({ manifiestoId, data, loading, error, onRecargar }) => {
  const online = useOnline();
  const [presentToast] = useIonToast();
  const [presentAlert] = useIonAlert();
  // A second alert opened while the first one is closing needs its own controller
  const [presentResultado] = useIonAlert();
  const [consentimiento, setConsentimiento] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const userId = useAuthStore((s) => s.user?.id);

  const viaje = data?.viaje && ['asignado', 'activo', 'pausado'].includes(data.viaje.estado) ? data.viaje : null;
  // The driver of this trip; anyone else (e.g. the despachador) only sees its status
  const propio = !!viaje && viaje.conductor?.id === userId;

  const accion = async (nombre: string, fn: () => Promise<unknown>, exito?: string) => {
    setOcupado(nombre);
    try {
      await fn();
      if (exito) presentToast({ message: exito, duration: 2500, position: 'bottom' });
    } catch (err) {
      presentToast({ message: apiErrorMessage(err, 'No se pudo completar'), duration: 4000, position: 'bottom' });
    } finally {
      setOcupado(null);
      onRecargar();
    }
  };

  const iniciar = async () => {
    setOcupado('iniciar');
    try {
      // The first location goes with the start (asks for the permission the first time)
      await seguimientoService.iniciar(manifiestoId, await capturarReporte(0, 'inicio'));
      setConsentimiento(false);
      presentToast({ message: 'Viaje iniciado. Te pediremos la ubicación cada tanto.', duration: 3000, position: 'bottom' });
    } catch (err) {
      // The acceptance was withdrawn or the text changed version: ask again
      if (apiErrorCode(err) === 'CONSENTIMIENTO_REQUERIDO') setConsentimiento(true);
      else presentToast({ message: apiErrorMessage(err, 'No se pudo iniciar el viaje'), duration: 4000, position: 'bottom' });
    } finally {
      setOcupado(null);
      onRecargar();
    }
  };

  const empezar = () => (data?.consentimientoVigente ? iniciar() : setConsentimiento(true));

  const aceptarConsentimiento = async () => {
    setOcupado('consentimiento');
    try {
      await seguimientoService.aceptarConsentimiento(data!.versionConsentimiento, await descripcionDispositivo());
    } catch (err) {
      presentToast({ message: apiErrorMessage(err, 'No se pudo registrar la aceptación'), duration: 4000, position: 'bottom' });
      setOcupado(null);
      return;
    }
    await iniciar();
  };

  const compartir = () =>
    accion('compartir', async () => {
      const { enviado } = await reportar(viaje!.id, viaje!.pedidoAbierto ? 'pedido' : 'voluntario', viaje!.pedidoAbierto?.id);
      presentToast({
        message: enviado ? 'Ubicación compartida con tu empresa' : 'Sin señal: la ubicación se enviará apenas haya conexión',
        duration: 2500,
        position: 'bottom',
      });
    });

  const ayuda = () =>
    presentAlert({
      header: '¿Necesitas ayuda?',
      message: 'Se enviará tu ubicación a tu empresa como alerta de auxilio.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Enviar alerta',
          role: 'destructive',
          handler: () =>
            void accion('ayuda', async () => {
              const { enviado } = await reportar(viaje!.id, 'auxilio');
              presentResultado({
                header: enviado ? 'Alerta enviada' : 'Alerta guardada',
                message: enviado
                  ? 'Tu empresa recibió tu ubicación. Si es una emergencia, llama al 123.'
                  : 'No hay señal: se enviará apenas haya conexión. Si es una emergencia, llama al 123.',
                buttons: [{ text: 'Llamar al 123', handler: () => void window.open('tel:123', '_system') }, { text: 'Cerrar', role: 'cancel' }],
              });
            }),
        },
      ],
    });

  const pausar = () =>
    presentAlert({
      header: 'Pausar seguimiento',
      message: 'No te pediremos la ubicación hasta que lo reanudes.',
      inputs: [{ name: 'motivo', type: 'text', placeholder: 'Motivo (opcional)', attributes: { maxlength: 200 } }],
      buttons: [
        { text: 'Volver', role: 'cancel' },
        { text: 'Pausar', handler: (v: { motivo?: string }) => void accion('pausar', () => seguimientoService.pausar(viaje!.id, v?.motivo?.trim() || undefined)) },
      ],
    });

  const terminar = () =>
    presentAlert({
      header: 'Terminar viaje',
      message: 'Se dejará de pedir tu ubicación en este viaje.',
      buttons: [
        { text: 'Volver', role: 'cancel' },
        { text: 'Terminar', role: 'destructive', handler: () => void accion('terminar', () => seguimientoService.terminar(viaje!.id), 'Viaje terminado') },
      ],
    });

  if (!data) {
    if (loading) return <IonSkeletonText animated style={{ width: '100%', height: 72, borderRadius: 16 }} />;
    return error ? (
      <Aviso tono="error" action={<AvisoAccion onClick={onRecargar} className="text-error-rndc">Reintentar</AvisoAccion>}>
        {error}
      </Aviso>
    ) : null;
  }

  // Main action: green pill across the card; the others: smaller pills side by side
  const boton = (
    nombre: string,
    texto: string,
    icon: string,
    onClick: () => void,
    { principal = false, className = '', ...props }: { principal?: boolean; className?: string } & Record<string, unknown> = {}
  ) => (
    <IonButton
      expand={principal ? 'block' : undefined}
      className={`m-0 ${principal ? 'h-[52px] text-[17px]' : 'h-11 flex-1 text-[15px]'} ${className}`}
      disabled={!!ocupado}
      onClick={onClick}
      {...props}
    >
      {ocupado === nombre ? <IonSpinner name="crescent" /> : <IonIcon slot="start" icon={icon} />}
      {texto}
    </IonButton>
  );

  const principal =
    data.puedeIniciar && (!viaje || viaje.estado === 'asignado')
      ? boton('iniciar', viaje ? 'Aceptar e iniciar' : 'Iniciar viaje', icons.playerPlay, empezar, {
          principal: true,
          disabled: !!ocupado || !online,
        })
      : propio && viaje?.estado === 'activo'
        ? boton('compartir', 'Compartir ubicación', icons.mapPinShare, compartir, { principal: true })
        : propio && viaje?.estado === 'pausado'
          ? boton('reanudar', 'Reanudar', icons.playerPlay, () => void accion('reanudar', () => seguimientoService.reanudar(viaje.id)), {
              principal: true,
            })
          : null;

  return (
    <div className="rounded-3xl bg-superficie p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white">
          <IonIcon icon={icons.route} className="text-[22px] text-tinta" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          {!viaje && data.puedeIniciar && (
            <>
              <p className="m-0 text-[17px] leading-[22px] font-semibold text-tinta">Activa el seguimiento</p>
              <p className="mt-1 mb-0 text-[15px] leading-5 text-muted">
                Tu empresa sabrá que vas bien. Te pediremos la ubicación cada tanto; tú decides cuándo responder.
              </p>
            </>
          )}
          {!viaje && !data.puedeIniciar && data.motivoNoDisponible && (
            <p className="m-0 text-[15px] leading-5 text-muted">{data.motivoNoDisponible}</p>
          )}
          {viaje?.estado === 'asignado' && (
            <>
              <p className="m-0 text-[17px] leading-[22px] font-semibold text-tinta">
                {propio ? 'Tu empresa activó el seguimiento de este viaje' : 'Seguimiento asignado, sin aceptar'}
              </p>
              {!propio && viaje.conductor && (
                <p className="mt-1 mb-0 text-[15px] leading-5 text-tinta">Conductor: {tipoOracion(viaje.conductor.nombre)}</p>
              )}
            </>
          )}
          {(viaje?.estado === 'activo' || viaje?.estado === 'pausado') && (
            <>
              <p className="m-0 mb-1 text-[17px] leading-[22px] font-semibold text-tinta">
                {viaje.estado === 'activo' ? 'Viaje en curso' : 'Seguimiento en pausa'}
              </p>
              <ResumenViaje viaje={viaje} propio={propio} />
            </>
          )}
        </div>
      </div>

      {!online && (propio || data.puedeIniciar) && (
        <p className="mt-3 mb-0 text-caption text-muted">Sin señal: lo que compartas se enviará al recuperar la conexión.</p>
      )}

      {principal && <div className="mt-5">{principal}</div>}
      {propio && (viaje?.estado === 'activo' || viaje?.estado === 'pausado') && (
        <div className="mt-2 flex flex-wrap gap-2">
          {viaje.estado === 'activo' && (
            <>
              {boton('ayuda', 'Necesito ayuda', icons.lifebuoy, ayuda, { className: 'btn-peligro basis-full' })}
              {boton('pausar', 'Pausar', icons.playerPause, pausar, { className: 'btn-blanco' })}
            </>
          )}
          {boton('terminar', 'Terminar viaje', icons.flag, terminar, { className: 'btn-blanco' })}
        </div>
      )}

      <ConsentimientoModal
        isOpen={consentimiento}
        enviando={ocupado === 'consentimiento' || ocupado === 'iniciar'}
        onAceptar={aceptarConsentimiento}
        onCerrar={() => setConsentimiento(false)}
      />
    </div>
  );
};

export default SeguimientoViaje;
