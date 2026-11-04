import { IonButton, IonContent, IonIcon, IonPage, IonSpinner, useIonRouter, useIonViewDidLeave } from '@ionic/react';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiErrorMessage } from '../../api/client';
import AppHeader from '../../components/AppHeader';
import { icons } from '../../icons';
import { responderPedido } from '../../offline/seguimiento';
import { formatHora } from '../../utils/format';

type Estado =
  | { fase: 'enviando' }
  | { fase: 'enviado' | 'en_cola'; hora: Date }
  | { fase: 'sin_viaje' | 'error'; mensaje: string };

/** One tap: opening the request's notification already shares the location. */
const Compartir: React.FC<{ manifiestoId: number }> = ({ manifiestoId }) => {
  const router = useIonRouter();
  const [estado, setEstado] = useState<Estado>({ fase: 'enviando' });

  const enviar = useCallback(async () => {
    setEstado({ fase: 'enviando' });
    try {
      const r = await responderPedido(manifiestoId);
      setEstado(r.estado === 'sin_viaje' ? { fase: 'sin_viaje', mensaje: r.mensaje } : { fase: r.estado, hora: new Date() });
    } catch (err) {
      setEstado({ fase: 'error', mensaje: apiErrorMessage(err, 'No se pudo compartir la ubicación') });
    }
  }, [manifiestoId]);

  useEffect(() => {
    enviar();
  }, [enviar]);

  const volver = () => (router.canGoBack() ? router.back() : router.push('/inicio', 'root', 'replace'));

  return (
    <IonContent>
      <div className="flex min-h-full flex-col items-center justify-center gap-4 px-6 py-10 text-center">
        {estado.fase === 'enviando' && (
          <>
            <IonSpinner name="crescent" className="h-10 w-10" />
            <p className="m-0 text-[17px] leading-6 text-tinta">Compartiendo tu ubicación…</p>
          </>
        )}
        {(estado.fase === 'enviado' || estado.fase === 'en_cola') && (
          <>
            <IonIcon
              icon={estado.fase === 'enviado' ? icons.circleCheck : icons.cloudUpload}
              className={`text-[64px] ${estado.fase === 'enviado' ? 'text-cumplido' : 'text-en-ruta'}`}
              aria-hidden="true"
            />
            <p className="m-0 text-[20px] leading-7 font-semibold text-tinta">
              {estado.fase === 'enviado' ? 'Listo, gracias' : 'Guardada sin señal'}
            </p>
            <p className="m-0 text-[15px] leading-[22px] text-muted">
              {estado.fase === 'enviado'
                ? `Tu empresa recibió tu ubicación de las ${formatHora(estado.hora)}.`
                : 'Se enviará apenas el teléfono tenga conexión.'}
            </p>
          </>
        )}
        {(estado.fase === 'sin_viaje' || estado.fase === 'error') && (
          <>
            <IonIcon icon={icons.alertCircle} className="text-[64px] text-error-rndc" aria-hidden="true" />
            <p className="m-0 text-[15px] leading-[22px] text-tinta">{estado.mensaje}</p>
            {estado.fase === 'error' && (
              <IonButton className="normal-case tracking-normal" onClick={enviar}>
                Intentar de nuevo
              </IonButton>
            )}
          </>
        )}
        {estado.fase !== 'enviando' && (
          <div className="mt-2 flex flex-col gap-2">
            <IonButton fill="outline" color="dark" className="normal-case tracking-normal" onClick={volver}>
              Volver
            </IonButton>
            <IonButton
              fill="clear"
              color="secondary"
              className="normal-case tracking-normal"
              onClick={() => router.push(`/manifiestos/${manifiestoId}?seccion=seguimiento`)}
            >
              Ver el viaje
            </IonButton>
          </div>
        )}
      </div>
    </IonContent>
  );
};

/**
 * Opened from the "¿Todo bien en tu viaje?" notification (request/seguimiento-viaje.md §6.5).
 * The outlet reuses this page for every trip, so each visit starts clean.
 */
const CompartirUbicacion: React.FC = () => {
  const { manifiestoId } = useParams();
  const [visita, setVisita] = useState(0);
  useIonViewDidLeave(() => setVisita((v) => v + 1));
  return (
    <IonPage>
      <AppHeader title="Compartir ubicación" backHref="/inicio" />
      <Compartir key={`${manifiestoId}-${visita}`} manifiestoId={Number(manifiestoId)} />
    </IonPage>
  );
};

export default CompartirUbicacion;
