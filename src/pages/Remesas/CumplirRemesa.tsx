import {
  IonButton,
  IonContent,
  IonFooter,
  IonIcon,
  IonInput,
  IonItem,
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
import { ciudad, formatFechaHora, formatKg } from '../../utils/format';
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

const Paso: React.FC<{ n: number; titulo: string; children: React.ReactNode }> = ({ n, titulo, children }) => (
  <section className="mt-6 first:mt-0">
    <h2 className="m-0 mb-3 flex items-center gap-2 text-[17px] leading-6 font-medium text-tinta">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-tinta text-[13px] font-semibold text-white">{n}</span>
      {titulo}
    </h2>
    {children}
  </section>
);

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

  if (estado?.municipal) return <Aviso>Remesa municipal: el RNDC la cumple con el cumplido del manifiesto.</Aviso>;
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
    <div className="rounded-2xl bg-superficie p-4">
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

const ResultadoVista: React.FC<{ resultado: Resultado; onVolver: () => void }> = ({ resultado, onVolver }) => {
  const rndc = resultado.tipo === 'enviado' ? resultado.registro.entrega.rndc : null;
  return (
    <div className="flex flex-col items-center px-6 pt-12 text-center">
      <IonIcon
        icon={resultado.tipo === 'rechazado' ? icons.alertCircle : resultado.tipo === 'en_cola' ? icons.cloudUpload : icons.circleCheck}
        className={`text-[64px] ${resultado.tipo === 'rechazado' ? 'text-error-rndc' : resultado.tipo === 'en_cola' ? 'text-en-ruta' : 'text-verde'}`}
        aria-hidden="true"
      />
      <h1 className="mt-4 mb-0 text-[24px] leading-8 font-semibold text-tinta">
        {resultado.tipo === 'enviado'
          ? 'Entrega registrada'
          : resultado.tipo === 'en_cola'
            ? 'Entrega guardada en el teléfono'
            : 'La entrega no fue aceptada'}
      </h1>
      <p className="mt-2 mb-0 text-[15px] leading-[22px] text-muted">
        {resultado.tipo === 'enviado'
          ? 'Las fotos, la ubicación y quién recibió quedaron en la remesa.'
          : resultado.tipo === 'en_cola'
            ? 'Se enviará sola cuando haya señal, con la hora y la ubicación en que se tomó. No borres la app.'
            : resultado.mensaje}
      </p>

      {rndc && (
        <div className="mt-6 w-full text-left">
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

      <IonButton expand="block" className="mt-8 h-[52px] w-full normal-case tracking-normal" onClick={onVolver}>
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
      <>
        <AppHeader title={numero} />
        <IonContent>
          <ResultadoVista resultado={resultado} onVolver={volver} />
        </IonContent>
      </>
    );
  }

  const sinPermiso = !hasPermiso(user, 'remesas.cumplir');
  const bloqueo = sinPermiso ? 'No tienes permiso para cumplir remesas.' : estado && !estado.puedeCumplir ? estado.motivoNoDisponible : null;

  return (
    <>
      <AppHeader title={`Cumplir ${numero}`} backHref={`/remesas/${remesaId}`} />
      <IonContent>
        <div className="px-4 pt-4 pb-8">
          {remesa && (
            <p className="mt-0 mb-5 text-[14px] leading-5 text-muted">
              {[remesa.cliente?.nombre, `${ciudad(remesa.origen)} → ${ciudad(remesa.destino)}`, formatKg(pesoKg)]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}

          {bloqueo ? (
            <Aviso tono="warning">{bloqueo}</Aviso>
          ) : (
            <>
              <Paso n={1} titulo="Fotos de la entrega">
                {/* Location status: every photo is stamped with it */}
                <div className="mb-3">
                  {ubicacion ? (
                    <p className="m-0 flex items-center gap-1 text-[13px] leading-[18px] text-cumplido">
                      <IonIcon icon={icons.mapPin} aria-hidden="true" />
                      {formatoCoordenadas(ubicacion)} · ±{Math.round(ubicacion.precision)} m
                    </p>
                  ) : ubicando ? (
                    <p className="m-0 flex items-center gap-2 text-[13px] leading-[18px] text-muted">
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

                <div className="grid grid-cols-3 gap-2">
                  {fotos.map((f, i) => (
                    <div key={i} className="relative aspect-square overflow-hidden rounded-xl bg-superficie">
                      <img src={`data:image/jpeg;base64,${f.base64}`} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        aria-label={`Quitar foto ${i + 1}`}
                        onClick={() => setFotos(fotos.filter((_, j) => j !== i))}
                        className="absolute top-1 right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-0 bg-tinta/80 p-0 text-white"
                      >
                        <IonIcon icon={icons.x} className="text-[16px]" />
                      </button>
                    </div>
                  ))}
                  {fotos.length < MAX_FOTOS && (
                    <button
                      type="button"
                      onClick={tomarFoto}
                      disabled={!ubicacion || tomando}
                      className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line bg-white p-0 text-tinta disabled:cursor-default disabled:opacity-50"
                    >
                      {tomando ? <IonSpinner name="crescent" /> : <IonIcon icon={icons.camera} className="text-[30px]" />}
                      <span className="text-[13px] leading-[17px] font-medium">{fotos.length ? 'Otra foto' : 'Tomar foto'}</span>
                    </button>
                  )}
                </div>
                <p className="mt-2 mb-0 text-caption text-muted">
                  La remesa firmada y la mercancía entregada. Cada foto lleva la fecha, la hora y las coordenadas.
                </p>
              </Paso>

              <Paso n={2} titulo="¿Quién recibe?">
                <div className="rounded-2xl border border-divider">
                  <IonItem lines="full" className="cumplir-item">
                    <IonInput
                      label="Nombre"
                      labelPlacement="stacked"
                      placeholder="Nombre de quien recibe"
                      autocapitalize="words"
                      value={nombre}
                      onIonInput={(e) => setNombre(e.detail.value ?? '')}
                    />
                  </IonItem>
                  <IonItem lines="none" className="cumplir-item">
                    <IonInput
                      label="Documento (opcional)"
                      labelPlacement="stacked"
                      inputmode="numeric"
                      placeholder="Cédula"
                      value={documento}
                      onIonInput={(e) => setDocumento(e.detail.value ?? '')}
                    />
                  </IonItem>
                </div>
              </Paso>

              <Paso n={3} titulo="Mercancía">
                <div className="rounded-2xl border border-divider">
                  <IonItem lines={completa ? 'none' : 'full'} className="cumplir-item">
                    <IonToggle checked={completa} onIonChange={(e) => setCompleta(e.detail.checked)} justify="space-between">
                      Se entregó completa ({formatKg(pesoKg)})
                    </IonToggle>
                  </IonItem>
                  {!completa && (
                    <IonItem lines="none" className="cumplir-item">
                      <IonInput
                        label="Kg entregados"
                        labelPlacement="stacked"
                        inputmode="decimal"
                        value={kg}
                        onIonInput={(e) => setKg(e.detail.value ?? '')}
                        errorText={`Entre 0 y ${formatKg(pesoKg)}`}
                        className={errorKg && kg !== '' ? 'ion-invalid ion-touched' : ''}
                      />
                    </IonItem>
                  )}
                </div>
                <div className="mt-3 rounded-2xl border border-divider">
                  <IonItem lines="none" className="cumplir-item">
                    <IonTextarea
                      label="Observaciones (opcional)"
                      labelPlacement="stacked"
                      autoGrow
                      rows={2}
                      placeholder={completa ? 'Sin novedad' : 'Qué faltó o llegó averiado'}
                      value={observaciones}
                      onIonInput={(e) => setObservaciones(e.detail.value ?? '')}
                    />
                  </IonItem>
                </div>
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
          <IonToolbar className="cumplir-footer">
            <div className="px-4 pt-2 pb-2">
              {faltantes.length > 0 && <p className="mt-0 mb-2 text-center text-caption text-muted">Falta {faltantes.join(', ')}</p>}
              <IonButton expand="block" className="m-0 h-[52px] normal-case tracking-normal" disabled={!!faltantes.length || enviando} onClick={registrar}>
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
