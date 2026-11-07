import {
  IonButton,
  IonContent,
  IonFooter,
  IonIcon,
  IonInput,
  IonPage,
  IonSpinner,
  IonTextarea,
  IonToggle,
  IonToolbar,
  useIonRouter,
  useIonToast,
  useIonViewDidLeave,
} from '@ionic/react';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import AppHeader from '../../components/AppHeader';
import { Aviso, AvisoAccion } from '../../components/Avisos';
import { Dato } from '../../components/Detalle';
import FotosEvidencia from '../../components/FotosEvidencia';
import Paso from '../../components/Paso';
import { TiemposEditor, TiemposResumen } from '../../components/TiemposRndc';
import { useCachedQuery } from '../../hooks/useCachedQuery';
import { useOnline } from '../../hooks/useOnline';
import { icons } from '../../icons';
import { encolarCumplido, enviarCumplido } from '../../offline/cumplidos';
import {
  descripcionDispositivo,
  formatoCoordenadas,
  isCancelacion,
  obtenerUbicacion,
  tomarFotoEstampada,
  type Ubicacion,
} from '../../offline/evidencia';
import { hasPermiso } from '../../services/auth.service';
import {
  cumplidosService,
  type EstadoCumplido,
  type PropuestaTiempos,
  type RegistroCumplido,
  type TiemposCumplido,
} from '../../services/cumplidos.service';
import { operationsService, type RemesaDetalle } from '../../services/operations.service';
import { useAuthStore } from '../../store/auth.store';
import { useCompanyStore } from '../../store/company.store';
import { ciudad, enumerar, formatFechaHora, formatKg, tipoOracion } from '../../utils/format';
import { tiemposIniciales, validarTiempos } from '../../utils/tiempos';
import './CumplirRemesa.css';

const MAX_FOTOS = 5;
/** A location fix older than this is refreshed before the next photo. */
const UBICACION_VIGENTE_MS = 2 * 60 * 1000;

interface Foto {
  base64: string;
  tomadaEn: Date;
}

type Resultado =
  | { tipo: 'enviado'; registro: RegistroCumplido }
  | { tipo: 'en_cola'; mensaje?: string }
  | { tipo: 'rechazado'; mensaje: string };

/** RNDC times: what will be sent, and the option to adjust them. */
const TiemposSeccion: React.FC<{
  remesa: RemesaDetalle | null;
  estado: EstadoCumplido | null;
  online: boolean;
  editados: TiemposCumplido | null;
  onEditar: (t: TiemposCumplido | null) => void;
}> = ({ remesa, estado, online, editados, onEditar }) => {
  const [propuesta, setPropuesta] = useState<PropuestaTiempos | null>(null);
  const [cargando, setCargando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const aplica = !estado?.municipal && remesa?.estadoRndc === 'reportado';

  useEffect(() => {
    if (!online || !aplica || !remesa || propuesta) return;
    setCargando(true);
    cumplidosService
      .tiempos(remesa.id)
      .then(setPropuesta)
      .catch(() => setPropuesta({ tiempos: null, coherente: false, fuenteCargue: null, avisos: [], mensaje: 'No se pudo consultar el monitoreo del RNDC' }))
      .finally(() => setCargando(false));
  }, [online, aplica, remesa, propuesta]);

  if (estado?.municipal) return <Aviso>Remesa municipal: el RNDC la cumple junto con el cumplido del manifiesto.</Aviso>;
  if (remesa && remesa.estadoRndc !== 'reportado') {
    return <Aviso>La remesa aún no está aceptada en el RNDC. La oficina enviará el cumplido cuando lo esté.</Aviso>;
  }
  if (!online) {
    return <Aviso icon={icons.wifiOff}>Sin señal: al enviarse, el cumplido usará los tiempos del monitoreo del RNDC.</Aviso>;
  }
  if (cargando) {
    return (
      <p className="m-0 flex items-center gap-2 text-[14px] text-muted">
        <IonSpinner name="crescent" className="h-5 w-5" /> Consultando el monitoreo del RNDC…
      </p>
    );
  }

  const errorTiempos = editados ? validarTiempos(editados) : null;

  return (
    <div className="rounded-[20px] bg-superficie px-[18px] py-4">
      {editados ? (
        <>
          <TiemposEditor value={editados} onChange={onEditar} />
          {errorTiempos && <p className="mt-3 mb-0 text-[13px] text-error-rndc">{errorTiempos}</p>}
          <div className="mt-3">
            <AvisoAccion onClick={() => onEditar(null)} className="text-petroleo">
              {propuesta?.tiempos ? 'Usar los del monitoreo' : 'No enviar tiempos (lo hará la oficina)'}
            </AvisoAccion>
          </div>
        </>
      ) : propuesta?.tiempos ? (
        <>
          <p className="m-0 text-[14px] leading-5 text-tinta">
            Se enviará con los tiempos{' '}
            {propuesta.fuenteCargue === 'cumplidoInicial' ? 'del cumplido inicial y el monitoreo del RNDC' : 'del monitoreo GPS del RNDC'}.
          </p>
          {abierto && (
            <div className="mt-3">
              <TiemposResumen tiempos={propuesta.tiempos} />
              {propuesta.avisos.map((a) => (
                <Aviso key={a} tono="warning" className="mt-3">
                  {a}
                </Aviso>
              ))}
            </div>
          )}
          {!propuesta.coherente && propuesta.mensaje && (
            <Aviso tono="warning" className="mt-3">
              {propuesta.mensaje}
            </Aviso>
          )}
          <div className="mt-3 flex gap-5">
            <AvisoAccion onClick={() => setAbierto(!abierto)} className="text-petroleo">
              {abierto ? 'Ocultar tiempos' : 'Ver tiempos'}
            </AvisoAccion>
            <AvisoAccion onClick={() => onEditar(propuesta.tiempos)} className="text-petroleo">
              Ajustar
            </AvisoAccion>
          </div>
        </>
      ) : (
        <>
          <p className="m-0 text-[14px] leading-5 text-tinta">
            {propuesta?.mensaje ?? 'No hay tiempos del monitoreo RNDC'}. La oficina enviará el cumplido al RNDC, o puedes ingresar los
            tiempos.
          </p>
          <div className="mt-3">
            <AvisoAccion onClick={() => onEditar(tiemposIniciales())} className="text-petroleo">
              Ingresar tiempos
            </AvisoAccion>
          </div>
        </>
      )}
    </div>
  );
};

// Round icon on top of the result: green, orange or red
const RESULTADO_ICONO: Record<Resultado['tipo'], { icon: string; className: string }> = {
  enviado: { icon: icons.check, className: 'bg-cumplido-soft text-verde' },
  en_cola: { icon: icons.cloudUpload, className: 'bg-rndc-pendiente-soft text-en-ruta' },
  rechazado: { icon: icons.alertCircle, className: 'bg-error-rndc-soft text-error-rndc' },
};

const ResultadoVista: React.FC<{
  resultado: Resultado;
  numero: string;
  /** Who received it and when, as typed in the form */
  recibio: string;
  hora: Date | null;
  onVolver: () => void;
}> = ({ resultado, numero, recibio, hora, onVolver }) => {
  const rndc = resultado.tipo === 'enviado' ? resultado.registro.entrega.rndc : null;
  const icono = RESULTADO_ICONO[resultado.tipo];
  return (
    <div className="flex min-h-full flex-col px-6 pt-[calc(var(--ion-safe-area-top,0px)+93px)] pb-[max(16px,var(--ion-safe-area-bottom,0px))]">
      <span className={`flex h-[88px] w-[88px] items-center justify-center rounded-full ${icono.className}`}>
        <IonIcon icon={icono.icon} className="text-[40px]" aria-hidden="true" />
      </span>
      <h1 className="mt-7 mb-0 tracking-[-0.5px] text-tinta">
        {resultado.tipo === 'enviado'
          ? 'Entrega registrada'
          : resultado.tipo === 'en_cola'
            ? 'Entrega guardada en el teléfono'
            : 'La entrega no fue aceptada'}
      </h1>
      <p className="mt-3 mb-0 text-[17px] leading-6 text-muted">
        {resultado.tipo === 'enviado'
          ? `Las fotos, la ubicación y quién recibió quedaron guardados en la remesa ${numero}.`
          : resultado.tipo === 'en_cola'
            ? 'Se enviará sola cuando haya señal, con la hora y la ubicación en que se tomó. No borres la app.'
            : resultado.mensaje}
      </p>

      {resultado.tipo !== 'rechazado' && (
        <div className="mt-8 border-0 border-y border-solid border-divider">
          <Dato label="Recibió">{recibio}</Dato>
          {hora && <Dato label="Hora">{formatFechaHora(hora)}</Dato>}
        </div>
      )}

      {rndc && (
        <div className="mt-6">
          {rndc.estado === 'reportado' && <Aviso tono="success">Cumplido reportado al RNDC.</Aviso>}
          {rndc.estado === 'error' && (
            <Aviso tono="error">
              <p className="m-0 font-medium">El RNDC no aceptó el cumplido</p>
              {rndc.mensaje && <p className="mt-1 mb-0 break-words">{rndc.mensaje}</p>}
              <p className="mt-1 mb-0">Puedes reintentarlo o ajustar los tiempos desde la remesa.</p>
            </Aviso>
          )}
          {rndc.estado === 'pendiente' && <Aviso>{rndc.mensaje ?? 'La oficina enviará el cumplido al RNDC.'}</Aviso>}
          {rndc.estado === 'no_aplica' && <Aviso>{rndc.mensaje}</Aviso>}
        </div>
      )}
      {resultado.tipo === 'en_cola' && resultado.mensaje && <p className="mt-3 mb-0 text-caption text-muted">{resultado.mensaje}</p>}

      {/* Pushes the button to the bottom of the screen */}
      <div className="min-h-8 flex-1" />

      <IonButton expand="block" className="m-0 h-14 w-full text-[17px]" onClick={onVolver}>
        Volver a la remesa
      </IonButton>
    </div>
  );
};

const CumplirFormulario: React.FC<{ remesaId: number }> = ({ remesaId }) => {
  const router = useIonRouter();
  const online = useOnline();
  const [presentToast] = useIonToast();
  const user = useAuthStore((s) => s.user);
  const companyName = useCompanyStore((s) => s.company?.name ?? '');
  const remesaQuery = useCachedQuery<RemesaDetalle>(`remesa:${remesaId}`, () => operationsService.remesa(remesaId));
  const estadoQuery = useCachedQuery<EstadoCumplido>(`remesa-cumplido:${remesaId}`, () => cumplidosService.estado(remesaId));
  const remesa = remesaQuery.data;
  const estado = estadoQuery.data;
  const { load: loadRemesa } = remesaQuery;
  const { load: loadEstado } = estadoQuery;

  const [ubicacion, setUbicacion] = useState<Ubicacion | null>(null);
  const [ubicando, setUbicando] = useState(false);
  const [errorUbicacion, setErrorUbicacion] = useState<string | null>(null);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [tomando, setTomando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [documento, setDocumento] = useState('');
  const [completa, setCompleta] = useState(true);
  const [kg, setKg] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [tiempos, setTiempos] = useState<TiemposCumplido | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const numero = remesa?.numero ?? estado?.numero ?? `Remesa ${remesaId}`;
  const pesoKg = estado?.pesoKg ?? remesa?.pesoKg ?? 0;

  const ubicar = useCallback(async () => {
    setUbicando(true);
    setErrorUbicacion(null);
    try {
      const u = await obtenerUbicacion();
      setUbicacion(u);
      return u;
    } catch (err) {
      setErrorUbicacion((err as Error).message);
      return null;
    } finally {
      setUbicando(false);
    }
  }, []);

  useEffect(() => {
    loadRemesa();
    loadEstado();
    ubicar();
  }, [loadRemesa, loadEstado, ubicar]);

  const tomarFoto = async () => {
    setTomando(true);
    try {
      let u = ubicacion;
      if (!u || Date.now() - u.fecha.getTime() > UBICACION_VIGENTE_MS) u = (await ubicar()) ?? u;
      if (!u) return;
      const ahora = new Date();
      const base64 = await tomarFotoEstampada([
        `${numero} · ${companyName}`.trim(),
        `${formatFechaHora(ahora)} · ${formatoCoordenadas(u)} ±${Math.round(u.precision)} m`,
      ]);
      setFotos((prev) => [...prev, { base64, tomadaEn: ahora }]);
    } catch (err) {
      if (!isCancelacion(err)) presentToast({ message: (err as Error).message, duration: 3000, position: 'bottom' });
    } finally {
      setTomando(false);
    }
  };

  const kgEntregados = completa ? pesoKg : Number(kg.replace(',', '.'));
  const errorKg = !completa && (kg === '' || !Number.isFinite(kgEntregados) || kgEntregados < 0 || (pesoKg > 0 && kgEntregados > pesoKg));
  const faltantes = [
    !fotos.length && 'una foto',
    !ubicacion && 'la ubicación',
    !nombre.trim() && 'quién recibe',
    errorKg && 'los kg entregados',
    tiempos && validarTiempos(tiempos) && 'los tiempos',
  ].filter(Boolean) as string[];

  const registrar = async () => {
    if (faltantes.length || !ubicacion) return;
    setEnviando(true);
    try {
      const id = await encolarCumplido(
        { id: remesaId, numero },
        {
          recibidoNombre: nombre.trim(),
          recibidoDocumento: documento.trim() || undefined,
          cantidadEntregada: completa ? undefined : kgEntregados,
          observaciones: observaciones.trim() || undefined,
          latitud: ubicacion.latitud,
          longitud: ubicacion.longitud,
          precisionMetros: Math.round(ubicacion.precision * 10) / 10,
          capturadoEn: fotos[0].tomadaEn.toISOString(),
          dispositivo: await descripcionDispositivo(),
          tiempos: tiempos ?? undefined,
        },
        fotos.map((f) => f.base64)
      );
      if (!online) {
        setResultado({ tipo: 'en_cola' });
        return;
      }
      const r = await enviarCumplido(id);
      if (r.ok) setResultado({ tipo: 'enviado', registro: r.resultado });
      else if (r.reintentable) setResultado({ tipo: 'en_cola', mensaje: r.mensaje });
      else setResultado({ tipo: 'rechazado', mensaje: r.mensaje });
    } catch (err) {
      presentToast({ message: (err as Error).message || 'No se pudo guardar la entrega', duration: 4000, position: 'bottom' });
    } finally {
      setEnviando(false);
    }
  };

  const volver = () => (router.canGoBack() ? router.goBack() : router.push(`/remesas/${remesaId}`, 'back', 'replace'));

  if (resultado) {
    return (
      <IonContent>
        <ResultadoVista
          resultado={resultado}
          numero={numero}
          recibio={[tipoOracion(nombre.trim()), documento.trim()].filter(Boolean).join(' · ')}
          hora={resultado.tipo === 'enviado' ? new Date(resultado.registro.entrega.capturadoEn) : (fotos[0]?.tomadaEn ?? null)}
          onVolver={volver}
        />
      </IonContent>
    );
  }

  const sinPermiso = !hasPermiso(user, 'remesas.cumplir');
  const bloqueo = sinPermiso ? 'No tienes permiso para cumplir remesas.' : estado && !estado.puedeCumplir ? estado.motivoNoDisponible : null;

  return (
    <>
      <AppHeader backHref={`/remesas/${remesaId}`} backIcon={icons.x} />
      <IonContent>
        <div className="px-5 pt-1 pb-8">
          <div className="mb-8">
            <p className="m-0 text-[14px] leading-5 text-muted">Remesa {numero}</p>
            <h1 className="mt-2 mb-0 text-[34px] leading-9 tracking-[-0.5px] text-tinta">Registra la entrega</h1>
            {remesa && (
              <p className="mt-2 mb-0 text-[16px] leading-[22px] text-muted">
                {[tipoOracion(remesa.cliente?.nombre), `${ciudad(remesa.origen)} → ${ciudad(remesa.destino)}`, formatKg(pesoKg)]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}
          </div>

          {bloqueo ? (
            <Aviso tono="warning">{bloqueo}</Aviso>
          ) : (
            <>
              <Paso n={1} titulo="Fotos de la entrega">
                {/* Location status: every photo is stamped with it */}
                <div className="mb-3">
                  {ubicacion ? (
                    <p className="m-0 inline-flex items-center gap-1.5 rounded-full bg-cumplido-soft px-3 py-1.5 text-[14px] leading-5 text-cumplido">
                      <IonIcon icon={icons.mapPin} aria-hidden="true" />
                      Ubicación lista · {formatoCoordenadas(ubicacion)} · ±{Math.round(ubicacion.precision)} m
                    </p>
                  ) : ubicando ? (
                    <p className="m-0 inline-flex items-center gap-2 rounded-full bg-superficie px-3 py-1.5 text-[14px] leading-5 text-muted">
                      <IonSpinner name="crescent" className="h-4 w-4" /> Obteniendo la ubicación…
                    </p>
                  ) : (
                    errorUbicacion && (
                      <Aviso tono="error" action={<AvisoAccion onClick={ubicar} className="text-error-rndc">Reintentar</AvisoAccion>}>
                        {errorUbicacion}
                      </Aviso>
                    )
                  )}
                </div>

                <FotosEvidencia
                  fotos={fotos.map((f) => f.base64)}
                  max={MAX_FOTOS}
                  tomando={tomando}
                  disabled={!ubicacion}
                  onTomar={tomarFoto}
                  onQuitar={(i) => setFotos(fotos.filter((_, j) => j !== i))}
                />
                <p className="mt-3 mb-0 text-[14px] leading-5 text-muted">
                  La remesa firmada y la mercancía entregada. Cada foto lleva fecha, hora y coordenadas.
                </p>
              </Paso>

              <Paso n={2} titulo="¿Quién recibe?">
                <label className="block">
                  <span className="app-field-label">Nombre</span>
                  <IonInput
                    className="app-field"
                    aria-label="Nombre"
                    placeholder="Nombre de quien recibe"
                    autocapitalize="words"
                    value={nombre}
                    onIonInput={(e) => setNombre(e.detail.value ?? '')}
                  />
                </label>
                <label className="mt-6 block">
                  <span className="app-field-label">Documento (opcional)</span>
                  <IonInput
                    className="app-field"
                    aria-label="Documento (opcional)"
                    inputmode="numeric"
                    placeholder="Cédula"
                    value={documento}
                    onIonInput={(e) => setDocumento(e.detail.value ?? '')}
                  />
                </label>
              </Paso>

              <Paso n={3} titulo="Mercancía">
                <IonToggle
                  className="cumplir-toggle w-full"
                  checked={completa}
                  onIonChange={(e) => setCompleta(e.detail.checked)}
                  justify="space-between"
                >
                  <span className="font-semibold text-tinta">Se entregó completa</span>{' '}
                  <span className="text-muted">({formatKg(pesoKg)})</span>
                </IonToggle>
                {!completa && (
                  <label className="mt-5 block">
                    <span className="app-field-label">Kg entregados</span>
                    <IonInput
                      className={`app-field ${errorKg && kg !== '' ? 'ion-invalid ion-touched' : ''}`}
                      aria-label="Kg entregados"
                      inputmode="decimal"
                      value={kg}
                      onIonInput={(e) => setKg(e.detail.value ?? '')}
                      errorText={`Entre 0 y ${formatKg(pesoKg)}`}
                    />
                  </label>
                )}
                <label className="mt-5 block">
                  <span className="app-field-label mb-2">Observaciones (opcional)</span>
                  <IonTextarea
                    className="app-textarea"
                    aria-label="Observaciones (opcional)"
                    autoGrow
                    rows={2}
                    placeholder={completa ? 'Sin novedad' : 'Qué faltó o llegó averiado'}
                    value={observaciones}
                    onIonInput={(e) => setObservaciones(e.detail.value ?? '')}
                  />
                </label>
              </Paso>

              <Paso n={4} titulo="Cumplido RNDC">
                <TiemposSeccion remesa={remesa} estado={estado} online={online} editados={tiempos} onEditar={setTiempos} />
              </Paso>
            </>
          )}
        </div>
      </IonContent>

      {!bloqueo && (
        <IonFooter className="ion-no-border">
          <IonToolbar className="app-modal-footer">
            <div className="px-5 pt-3 pb-2">
              {faltantes.length > 0 && <p className="mt-0 mb-2.5 text-center text-[14px] leading-5 text-muted">Falta {enumerar(faltantes)}</p>}
              <IonButton expand="block" className="m-0 h-14 text-[17px]" disabled={!!faltantes.length || enviando} onClick={registrar}>
                {enviando ? <IonSpinner name="crescent" /> : online ? 'Registrar entrega' : 'Guardar entrega (sin señal)'}
              </IonButton>
            </div>
          </IonToolbar>
        </IonFooter>
      )}
    </>
  );
};

/**
 * Full-screen cumplido of a remesa. The outlet reuses this page for every remesa, so the
 * form is keyed by remesa and visit: each time it opens, it starts clean.
 */
const CumplirRemesa: React.FC = () => {
  const { id } = useParams();
  const [visita, setVisita] = useState(0);
  // Once the page is out of sight, the next visit starts from scratch
  useIonViewDidLeave(() => setVisita((v) => v + 1));
  return (
    <IonPage>
      <CumplirFormulario key={`${id}-${visita}`} remesaId={Number(id)} />
    </IonPage>
  );
};

export default CumplirRemesa;
