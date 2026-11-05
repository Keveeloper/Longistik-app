import {
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonInput,
  IonModal,
  IonSkeletonText,
  IonSpinner,
  IonTextarea,
  IonToolbar,
  useIonRouter,
  useIonToast,
} from '@ionic/react';
import axios from 'axios';
import { useEffect, useState, type ReactNode } from 'react';
import { apiErrorCode, apiErrorFields, apiErrorMessage } from '../api/client';
import { useOnline } from '../hooks/useOnline';
import { icons } from '../icons';
import {
  sobreanticiposService,
  type MotivoSobreanticipo,
  type ResultadoSobreanticipo,
  type Sobreanticipo,
} from '../services/sobreanticipos.service';
import { formatFechaHora, formatNumero, formatPesos } from '../utils/format';
import { Aviso, AvisoAccion } from './Avisos';
import { IconoCirculo } from './Detalle';
import { SobreanticipoBadge } from './EstadoBadge';

/** One request: value (and approved value when different), reason, state, date and notes. */
export const SobreanticipoFila: React.FC<{
  item: Sobreanticipo;
  /** Show the manifiesto and plate ("Mis sobreanticipos") */
  conManifiesto?: boolean;
  /** Extra content under the request (e.g. the cancel button) */
  children?: ReactNode;
}> = ({ item: s, conManifiesto, children }) => {
  const aprobadoDistinto = s.valorAprobado !== null && s.valorAprobado !== s.valor;
  return (
    <div className="flex items-start gap-3.5 border-0 border-b border-solid border-divider py-3 last:border-b-0">
      <IconoCirculo icon={icons.cash} className="mt-1 h-11 w-11" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="m-0 text-[19px] leading-[26px] font-semibold text-tinta">{formatPesos(s.valor)}</p>
          <SobreanticipoBadge estado={s.estado} />
        </div>
        <p className="mt-0.5 mb-0 text-[15px] leading-[21px] break-words text-tinta">
          {[conManifiesto && s.manifiesto, conManifiesto && s.placa, s.motivoNombre ?? s.motivo, s.descripcion]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <p className="mt-0.5 mb-0 text-[14px] leading-5 text-muted">
          Solicitado {formatFechaHora(s.fechaSolicitud)}
          {aprobadoDistinto && ` · Aprobado por ${formatPesos(s.valorAprobado!)}`}
          {s.fechaDecision && ` · Decidido ${formatFechaHora(s.fechaDecision)}`}
        </p>
        {s.notas && <p className="mt-1 mb-0 text-[14px] leading-5 break-words text-tinta">Notas: {s.notas}</p>}
        {s.alertaTope && s.estado === 'solicitada' && (
          <p className="mt-1 mb-0 text-[14px] leading-5 text-en-ruta">{s.alertaTope}</p>
        )}
        {children}
      </div>
    </div>
  );
};

type Campo = 'valor' | 'motivo' | 'descripcion';

const DESCRIPCION_MAX = 500;
const DESCRIPCION_MIN = 5;

/** Requests the user may have created although the response never arrived. */
const sinRespuesta = (err: unknown) => axios.isAxiosError(err) && !err.response;

const Formulario: React.FC<{
  manifiestoId: number;
  disponible: number;
  onCerrar: () => void;
  onCreada: (resultado: ResultadoSobreanticipo) => void;
  /** The manifiesto changed (or the request may have been created): reload its section */
  onRecargar: () => void;
}> = ({ manifiestoId, disponible, onCerrar, onCreada, onRecargar }) => {
  const online = useOnline();
  const router = useIonRouter();
  const [presentToast] = useIonToast();
  const [motivos, setMotivos] = useState<MotivoSobreanticipo[] | null>(null);
  const [errorMotivos, setErrorMotivos] = useState<string | null>(null);
  const [valor, setValor] = useState('');
  const [motivo, setMotivo] = useState<string | null>(null);
  const [descripcion, setDescripcion] = useState('');
  const [errores, setErrores] = useState<Partial<Record<Campo, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const cargarMotivos = async () => {
    setErrorMotivos(null);
    try {
      setMotivos(await sobreanticiposService.motivos());
    } catch (err) {
      setErrorMotivos(apiErrorMessage(err, 'No se pudieron cargar los motivos'));
    }
  };

  useEffect(() => {
    cargarMotivos();
  }, []);

  const motivoSel = motivos?.find((m) => m.codigo === motivo);
  const pesos = Number(valor || 0);

  const validar = () => {
    const e: Partial<Record<Campo, string>> = {};
    if (!pesos) e.valor = 'Escribe el valor';
    if (!motivo) e.motivo = 'Elige el motivo';
    if (motivoSel?.requiereDescripcion && descripcion.trim().length < DESCRIPCION_MIN) {
      e.descripcion = `Describe para qué es (mínimo ${DESCRIPCION_MIN} caracteres)`;
    }
    setErrores(e);
    return !Object.keys(e).length;
  };

  const enviar = async () => {
    setError(null);
    if (!validar()) return;
    setEnviando(true);
    try {
      const resultado = await sobreanticiposService.solicitar(manifiestoId, {
        valor: pesos,
        motivo: motivo!,
        ...(descripcion.trim() ? { descripcion: descripcion.trim() } : {}),
      });
      onCreada(resultado);
    } catch (err) {
      const code = apiErrorCode(err);
      const message = apiErrorMessage(err, 'No se pudo registrar la solicitud');
      if (sinRespuesta(err)) {
        // It may have been created: never resend blindly, show the list first
        setError('No se pudo confirmar si la solicitud quedó registrada. Revisa la lista de sobreanticipos antes de intentarlo de nuevo.');
        onRecargar();
      } else if (code === 'NOT_FOUND') {
        presentToast({ message: 'Manifiesto no encontrado', duration: 3000, position: 'bottom' });
        onCerrar();
        router.push('/manifiestos', 'back');
      } else if (code === 'BAD_REQUEST') {
        const campos = apiErrorFields(err);
        setErrores({ valor: campos.valor, motivo: campos.motivo, descripcion: campos.descripcion });
        if (!campos.valor && !campos.motivo && !campos.descripcion) setError(message);
      } else if (code === 'SALDO_NEGATIVO' || code === 'SOBREANTICIPO_TOPE') {
        setErrores({ valor: 'Baja el valor' });
        setError(message);
      } else {
        setError(message);
        // CONFLICT: the manifiesto was fulfilled or voided meanwhile
        if (code === 'CONFLICT') onRecargar();
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <IonHeader>
        <IonToolbar className="app-toolbar">
          <IonButtons slot="start">
            <IonButton aria-label="Cerrar" onClick={onCerrar}>
              <IonIcon slot="icon-only" icon={icons.x} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div className="flex flex-col gap-6 px-5 pt-1 pb-8">
          <div>
            <h1 className="m-0 text-[34px] leading-9 tracking-[-0.5px] text-tinta">Solicitar sobreanticipo</h1>
            <p className="mt-2 mb-0 text-[15px] leading-[22px] text-muted">
              Se le entrega al titular del manifiesto. Queda pendiente hasta que un aprobador de la empresa la revise.
            </p>
          </div>

          <label className="block">
            <span className="app-field-label">Valor</span>
            <IonInput
              className={`app-field ${errores.valor ? 'ion-invalid ion-touched' : ''}`}
              aria-label="Valor"
              inputmode="numeric"
              placeholder="0"
              value={valor ? formatNumero(pesos) : ''}
              onIonInput={(e) => {
                const digits = (e.detail.value ?? '').replace(/\D/g, '').replace(/^0+/, '').slice(0, 12);
                setValor(digits);
                // Ionic keeps the raw text when the value doesn't change: write the formatted one back
                e.target.value = digits ? formatNumero(Number(digits)) : '';
                setErrores((x) => ({ ...x, valor: undefined }));
              }}
            >
              <span slot="start" className="mr-1 text-tinta">
                $
              </span>
            </IonInput>
            <span className={`mt-1 block text-caption ${errores.valor ? 'text-error-rndc' : 'text-muted'}`}>
              {errores.valor ? `${errores.valor} · ` : ''}Disponible: {formatPesos(disponible)}
            </span>
          </label>

          <div>
            <p className="m-0 mb-2 text-[14px] leading-5 text-muted">Motivo</p>
            {errorMotivos ? (
              <Aviso tono="error" action={<AvisoAccion onClick={cargarMotivos} className="text-error-rndc">Reintentar</AvisoAccion>}>
                {errorMotivos}
              </Aviso>
            ) : !motivos ? (
              <IonSkeletonText animated style={{ width: '100%', height: 80, borderRadius: 16 }} />
            ) : (
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Motivo">
                {motivos.map((m) => {
                  const activo = m.codigo === motivo;
                  return (
                    <button
                      key={m.codigo}
                      type="button"
                      role="radio"
                      aria-checked={activo}
                      onClick={() => {
                        setMotivo(m.codigo);
                        setErrores((x) => ({ ...x, motivo: undefined, descripcion: undefined }));
                      }}
                      className={`cursor-pointer rounded-full border-0 px-4 py-2.5 text-[15px] leading-5 font-medium ${
                        activo ? 'bg-tinta text-white' : 'bg-superficie text-tinta'
                      }`}
                    >
                      {m.nombre}
                    </button>
                  );
                })}
              </div>
            )}
            {errores.motivo && <p className="mt-1 mb-0 text-caption text-error-rndc">{errores.motivo}</p>}
          </div>

          <label className="block">
            <span className="app-field-label mb-2">{motivoSel?.requiereDescripcion ? 'Descripción' : 'Descripción (opcional)'}</span>
            <IonTextarea
              className={`app-textarea ${errores.descripcion ? 'app-invalid' : ''}`}
              aria-label={motivoSel?.requiereDescripcion ? 'Descripción' : 'Descripción (opcional)'}
              placeholder="Ej. cambio de llanta en La Línea"
              autoGrow
              rows={2}
              maxlength={DESCRIPCION_MAX}
              value={descripcion}
              onIonInput={(e) => {
                setDescripcion(e.detail.value ?? '');
                setErrores((x) => ({ ...x, descripcion: undefined }));
              }}
            />
            {errores.descripcion && <span className="mt-1 block text-caption text-error-rndc">{errores.descripcion}</span>}
          </label>

          {error && <Aviso tono="error">{error}</Aviso>}
        </div>
      </IonContent>
      <IonFooter className="ion-no-border">
        <IonToolbar className="app-modal-footer">
          <div className="px-5 py-3">
            {!online && <p className="mt-0 mb-2 text-center text-caption text-muted">Necesitas señal para enviar la solicitud</p>}
            <IonButton
              expand="block"
              className="m-0 h-14 text-[17px]"
              disabled={enviando || !online || !motivos}
              onClick={enviar}
            >
              {enviando ? <IonSpinner name="crescent" /> : 'Enviar solicitud'}
            </IonButton>
          </div>
        </IonToolbar>
      </IonFooter>
    </>
  );
};

/** Modal with the request form. Ionic mounts its content only while presented, so every opening starts clean. */
export const SolicitarSobreanticipoModal: React.FC<{
  isOpen: boolean;
  manifiestoId: number;
  disponible: number;
  onCerrar: () => void;
  onCreada: (resultado: ResultadoSobreanticipo) => void;
  onRecargar: () => void;
}> = ({ isOpen, onCerrar, ...props }) => (
  <IonModal isOpen={isOpen} onDidDismiss={onCerrar}>
    <Formulario {...props} onCerrar={onCerrar} />
  </IonModal>
);
