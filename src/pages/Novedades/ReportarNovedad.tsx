import {
  IonButton,
  IonContent,
  IonFooter,
  IonIcon,
  IonPage,
  IonSkeletonText,
  IonSpinner,
  IonTextarea,
  IonToolbar,
  useIonRouter,
  useIonToast,
  useIonViewDidLeave,
} from '@ionic/react';
import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import AppHeader from '../../components/AppHeader';
import { Aviso, AvisoAccion } from '../../components/Avisos';
import { Dato } from '../../components/Detalle';
import FotosEvidencia from '../../components/FotosEvidencia';
import Paso from '../../components/Paso';
import { useCachedQuery } from '../../hooks/useCachedQuery';
import { useOnline } from '../../hooks/useOnline';
import { icons } from '../../icons';
import { formatoCoordenadas, isCancelacion, obtenerUbicacion, tomarFotoEstampada, type Ubicacion } from '../../offline/evidencia';
import { encolarNovedad, enviarNovedad } from '../../offline/novedades';
import { hasPermiso } from '../../services/auth.service';
import {
  DESCRIPCION_MAX,
  DESCRIPCION_MIN,
  MAX_FOTOS_NOVEDAD,
  novedadesService,
  TIPOS_NOVEDAD,
  type NovedadDetalle,
  type TipoNovedad,
} from '../../services/novedades.service';
import { operationsService, type Manifiesto, type ManifiestoDetalle } from '../../services/operations.service';
import { useAuthStore } from '../../store/auth.store';
import { useCompanyStore } from '../../store/company.store';
import { ciudad, enumerar, formatFechaHora, tipoOracion } from '../../utils/format';

/** A location fix older than this is refreshed before the next photo. */
const UBICACION_VIGENTE_MS = 2 * 60 * 1000;

type Resultado =
  | { tipo: 'enviada'; novedad: NovedadDetalle }
  | { tipo: 'en_cola'; mensaje?: string }
  | { tipo: 'rechazada'; mensaje: string };

/** Selectable row of a list of options (manifiesto, tipo, remesa): radio semantics, check on the right. */
const Opcion: React.FC<{ titulo: string; detalle?: string | null; seleccionada: boolean; onClick: () => void }> = ({
  titulo,
  detalle,
  seleccionada,
  onClick,
}) => (
  <button
    type="button"
    role="radio"
    aria-checked={seleccionada}
    onClick={onClick}
    className={`flex w-full cursor-pointer items-center gap-3 rounded-2xl border-[1.5px] border-solid px-4 py-3 text-left ${
      seleccionada ? 'border-verde bg-cumplido-soft' : 'border-line bg-white'
    }`}
  >
    <span className="min-w-0 flex-1">
      <span className="block text-[16px] leading-[22px] font-semibold text-tinta">{titulo}</span>
      {detalle && <span className="block text-[14px] leading-5 text-muted">{detalle}</span>}
    </span>
    <span
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${seleccionada ? 'bg-verde text-white' : 'border-[1.5px] border-solid border-line'}`}
      aria-hidden="true"
    >
      {seleccionada && <IonIcon icon={icons.check} className="text-[16px]" />}
    </span>
  </button>
);

const rutaManifiesto = (m: Pick<Manifiesto, 'origen' | 'destino'>) => `${ciudad(m.origen) || 'Sin origen'} → ${ciudad(m.destino) || 'Sin destino'}`;

/** Remesas of the chosen manifiesto (from its detail, saved on the phone like the detail screen). */
const RemesaSelector: React.FC<{
  manifiestoId: number;
  obligatoria: boolean;
  value: number | null;
  onChange: (id: number | null, numero: string | null) => void;
}> = ({ manifiestoId, obligatoria, value, onChange }) => {
  const { data, loading, load } = useCachedQuery<ManifiestoDetalle>(`manifiesto:${manifiestoId}`, () =>
    operationsService.manifiesto(manifiestoId)
  );
  useEffect(() => {
    load();
  }, [load]);

  if (!data) {
    return loading ? (
      <IonSkeletonText animated style={{ width: '100%', height: 56, borderRadius: 16 }} />
    ) : (
      <Aviso tono="warning">No se pudieron cargar las remesas del manifiesto. Revisa la señal.</Aviso>
    );
  }
  if (!data.remesas.length) return <Aviso>El manifiesto no tiene remesas.</Aviso>;
  return (
    <div className="flex flex-col gap-2" role="radiogroup" aria-label="Remesa">
      {!obligatoria && <Opcion titulo="Ninguna en particular" seleccionada={value === null} onClick={() => onChange(null, null)} />}
      {data.remesas.map((r) => (
        <Opcion
          key={r.id}
          titulo={r.numero}
          detalle={[tipoOracion(r.cliente?.nombre), r.producto].filter(Boolean).join(' · ')}
          seleccionada={value === r.id}
          onClick={() => onChange(r.id, r.numero)}
        />
      ))}
    </div>
  );
};

const ResultadoVista: React.FC<{ resultado: Resultado; onVer: (id: number) => void; onVolver: () => void }> = ({
  resultado,
  onVer,
  onVolver,
}) => {
  const icono =
    resultado.tipo === 'enviada'
      ? { icon: icons.check, className: 'bg-cumplido-soft text-verde' }
      : resultado.tipo === 'en_cola'
        ? { icon: icons.cloudUpload, className: 'bg-rndc-pendiente-soft text-en-ruta' }
        : { icon: icons.alertCircle, className: 'bg-error-rndc-soft text-error-rndc' };
  return (
    <div className="flex min-h-full flex-col px-6 pt-[calc(var(--ion-safe-area-top,0px)+93px)] pb-[max(16px,var(--ion-safe-area-bottom,0px))]">
      <span className={`flex h-[88px] w-[88px] items-center justify-center rounded-full ${icono.className}`}>
        <IonIcon icon={icono.icon} className="text-[40px]" aria-hidden="true" />
      </span>
      <h1 className="mt-7 mb-0 tracking-[-0.5px] text-tinta">
        {resultado.tipo === 'enviada'
          ? 'Novedad reportada'
          : resultado.tipo === 'en_cola'
            ? 'Novedad guardada en el teléfono'
            : 'La novedad no fue aceptada'}
      </h1>
      <p className="mt-3 mb-0 text-[17px] leading-6 text-muted">
        {resultado.tipo === 'enviada'
          ? 'La empresa ya puede verla y gestionarla. Te avisaremos cuando la tomen o la cierren.'
          : resultado.tipo === 'en_cola'
            ? 'Sin señal. La novedad se enviará sola cuando vuelva la conexión, con la hora y la ubicación de ahora. No borres la app.'
            : resultado.mensaje}
      </p>

      {resultado.tipo === 'enviada' && (
        <div className="mt-8 border-0 border-y border-solid border-divider">
          <Dato label="Tipo">{resultado.novedad.tipo.nombre}</Dato>
          <Dato label="Manifiesto">{resultado.novedad.manifiesto.numero ?? '—'}</Dato>
          <Dato label="Hora">{formatFechaHora(resultado.novedad.capturadaEn)}</Dato>
        </div>
      )}
      {resultado.tipo === 'en_cola' && resultado.mensaje && <p className="mt-3 mb-0 text-caption text-muted">{resultado.mensaje}</p>}

      <div className="min-h-8 flex-1" />

      {resultado.tipo === 'enviada' ? (
        <>
          <IonButton expand="block" className="m-0 h-14 w-full text-[17px]" onClick={() => onVer(resultado.novedad.id)}>
            Ver la novedad
          </IonButton>
          <IonButton expand="block" className="btn-secundario mt-3 mb-0 h-14 w-full text-[17px]" onClick={onVolver}>
            Volver
          </IonButton>
        </>
      ) : (
        <IonButton expand="block" className="m-0 h-14 w-full text-[17px]" onClick={onVolver}>
          Volver
        </IonButton>
      )}
    </div>
  );
};

const ReportarFormulario: React.FC<{ manifiestoInicial: number | null }> = ({ manifiestoInicial }) => {
  const router = useIonRouter();
  const online = useOnline();
  const [presentToast] = useIonToast();
  const user = useAuthStore((s) => s.user);
  const companyName = useCompanyStore((s) => s.company?.name ?? '');

  const activos = useCachedQuery<Manifiesto[]>('novedad:manifiestos-activos', () =>
    operationsService.manifiestos({ estado: 'activo', page: 1, pageSize: 50 }).then((p) => p.items)
  );
  const tiposQuery = useCachedQuery<TipoNovedad[]>('novedad:tipos', () => novedadesService.tipos());
  const tipos = tiposQuery.data?.length ? tiposQuery.data : TIPOS_NOVEDAD;
  const { load: loadActivos } = activos;
  const { load: loadTipos } = tiposQuery;

  const [manifiestoId, setManifiestoId] = useState<number | null>(manifiestoInicial);
  const [tipoCodigo, setTipoCodigo] = useState<TipoNovedad['codigo'] | null>(null);
  const [remesa, setRemesa] = useState<{ id: number; numero: string } | null>(null);
  const [descripcion, setDescripcion] = useState('');
  const [fotos, setFotos] = useState<string[]>([]);
  const [tomando, setTomando] = useState(false);
  const [ubicacion, setUbicacion] = useState<Ubicacion | null>(null);
  const [ubicando, setUbicando] = useState(false);
  const [errorUbicacion, setErrorUbicacion] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);

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
    loadActivos();
    loadTipos();
    ubicar();
  }, [loadActivos, loadTipos, ubicar]);

  // A single active manifiesto comes chosen
  const lista = activos.data;
  useEffect(() => {
    if (manifiestoId === null && lista?.length === 1) setManifiestoId(lista[0].id);
  }, [lista, manifiestoId]);

  const manifiesto = lista?.find((m) => m.id === manifiestoId) ?? null;
  // Opened from a manifiesto that isn't in the list (e.g. the list didn't load): its number from the detail cache
  const detalleInicial = useCachedQuery<ManifiestoDetalle>(`manifiesto:${manifiestoInicial ?? 0}`, () =>
    operationsService.manifiesto(manifiestoInicial ?? 0)
  );
  const elegido = manifiesto ?? (manifiestoId !== null && manifiestoId === manifiestoInicial ? detalleInicial.data : null);
  const numeroManifiesto = elegido?.numero ?? (manifiestoId ? `Manifiesto ${manifiestoId}` : '');
  const tipo = tipos.find((t) => t.codigo === tipoCodigo) ?? null;

  const tomarFoto = async () => {
    setTomando(true);
    try {
      let u = ubicacion;
      if (!u || Date.now() - u.fecha.getTime() > UBICACION_VIGENTE_MS) u = (await ubicar()) ?? u;
      const ahora = new Date();
      const base64 = await tomarFotoEstampada([
        [numeroManifiesto, tipo?.nombre, companyName].filter(Boolean).join(' · '),
        u ? `${formatFechaHora(ahora)} · ${formatoCoordenadas(u)} ±${Math.round(u.precision)} m` : `${formatFechaHora(ahora)} · Sin ubicación`,
      ]);
      setFotos((prev) => [...prev, base64]);
    } catch (err) {
      if (!isCancelacion(err)) presentToast({ message: (err as Error).message, duration: 3000, position: 'bottom' });
    } finally {
      setTomando(false);
    }
  };

  const texto = descripcion.trim();
  const faltantes = [
    manifiestoId === null && 'el manifiesto',
    !tipo && 'el tipo',
    tipo?.requiereRemesa && !remesa && 'la remesa',
    texto.length < DESCRIPCION_MIN && 'qué pasó',
  ].filter(Boolean) as string[];

  const reportar = async () => {
    if (faltantes.length || manifiestoId === null || !tipo) return;
    setEnviando(true);
    try {
      const id = await encolarNovedad(
        {
          manifiestoId,
          remesaId: remesa?.id,
          tipo: tipo.codigo,
          descripcion: texto,
          latitud: ubicacion?.latitud,
          longitud: ubicacion?.longitud,
          precisionMetros: ubicacion ? Math.round(ubicacion.precision * 10) / 10 : undefined,
          capturadaEn: new Date().toISOString(),
        },
        {
          tipoNombre: tipo.nombre,
          manifiestoNumero: numeroManifiesto,
          origen: elegido ? ciudad(elegido.origen) : '',
          destino: elegido ? ciudad(elegido.destino) : '',
        },
        fotos
      );
      if (!online) {
        setResultado({ tipo: 'en_cola' });
        return;
      }
      const r = await enviarNovedad(id);
      if (r.ok) setResultado({ tipo: 'enviada', novedad: r.novedad });
      else if (r.reintentable) setResultado({ tipo: 'en_cola', mensaje: r.mensaje });
      else setResultado({ tipo: 'rechazada', mensaje: r.mensaje });
    } catch (err) {
      presentToast({ message: (err as Error).message || 'No se pudo guardar la novedad', duration: 4000, position: 'bottom' });
    } finally {
      setEnviando(false);
    }
  };

  const volver = () => (router.canGoBack() ? router.goBack() : router.push('/novedades', 'back', 'replace'));

  if (resultado) {
    return (
      <IonContent>
        <ResultadoVista resultado={resultado} onVer={(id) => router.push(`/novedades/${id}`, 'forward', 'replace')} onVolver={volver} />
      </IonContent>
    );
  }

  const sinPermiso = !hasPermiso(user, 'novedades.reportar');

  return (
    <>
      <AppHeader backHref="/novedades" backIcon={icons.x} />
      <IonContent>
        <div className="px-5 pt-1 pb-8">
          <div className="mb-8">
            <p className="m-0 text-[14px] leading-5 text-muted">Novedades</p>
            <h1 className="mt-2 mb-0 text-[34px] leading-9 tracking-[-0.5px] text-tinta">Reportar novedad</h1>
            <p className="mt-2 mb-0 text-[16px] leading-[22px] text-muted">La empresa la recibe con la hora y la ubicación de ahora.</p>
          </div>

          {sinPermiso ? (
            <Aviso tono="warning">No tienes permiso para reportar novedades.</Aviso>
          ) : (
            <>
              <Paso n={1} titulo="Manifiesto">
                {lista === null && activos.loading ? (
                  <IonSkeletonText animated style={{ width: '100%', height: 64, borderRadius: 16 }} />
                ) : (
                  <div className="flex flex-col gap-2" role="radiogroup" aria-label="Manifiesto">
                    {(lista ?? []).map((m) => (
                      <Opcion
                        key={m.id}
                        titulo={m.numero}
                        detalle={[rutaManifiesto(m), m.placa].filter(Boolean).join(' · ')}
                        seleccionada={manifiestoId === m.id}
                        onClick={() => {
                          if (m.id !== manifiestoId) setRemesa(null);
                          setManifiestoId(m.id);
                        }}
                      />
                    ))}
                    {/* Opened from a manifiesto the list doesn't show */}
                    {manifiestoInicial !== null && !lista?.some((m) => m.id === manifiestoInicial) && (
                      <Opcion
                        titulo={detalleInicial.data?.numero ?? `Manifiesto ${manifiestoInicial}`}
                        detalle={detalleInicial.data ? rutaManifiesto(detalleInicial.data) : null}
                        seleccionada={manifiestoId === manifiestoInicial}
                        onClick={() => setManifiestoId(manifiestoInicial)}
                      />
                    )}
                    {lista?.length === 0 && manifiestoInicial === null && (
                      <Aviso>No tienes manifiestos activos. Las novedades se reportan sobre un viaje en curso.</Aviso>
                    )}
                    {lista === null && !activos.loading && manifiestoInicial === null && (
                      <Aviso tono="warning" action={<AvisoAccion onClick={loadActivos} className="text-en-ruta">Reintentar</AvisoAccion>}>
                        No se pudieron cargar tus manifiestos activos.
                      </Aviso>
                    )}
                  </div>
                )}
              </Paso>

              <Paso n={2} titulo="¿Qué tipo de novedad?">
                <div className="flex flex-col gap-2" role="radiogroup" aria-label="Tipo de novedad">
                  {tipos.map((t) => (
                    <Opcion
                      key={t.codigo}
                      titulo={t.nombre}
                      detalle={t.ayuda}
                      seleccionada={tipoCodigo === t.codigo}
                      onClick={() => setTipoCodigo(t.codigo)}
                    />
                  ))}
                </div>
              </Paso>

              {manifiestoId !== null && tipo && (
                <Paso n={3} titulo={tipo.requiereRemesa ? 'Remesa afectada' : 'Remesa (opcional)'}>
                  <RemesaSelector
                    key={manifiestoId}
                    manifiestoId={manifiestoId}
                    obligatoria={tipo.requiereRemesa}
                    value={remesa?.id ?? null}
                    onChange={(id, numero) => setRemesa(id && numero ? { id, numero } : null)}
                  />
                </Paso>
              )}

              <Paso n={manifiestoId !== null && tipo ? 4 : 3} titulo="¿Qué pasó?">
                <IonTextarea
                  className="app-textarea"
                  aria-label="Qué pasó"
                  autoGrow
                  rows={3}
                  maxlength={DESCRIPCION_MAX}
                  counter
                  placeholder="Dónde estás, qué pasó y si puedes seguir"
                  value={descripcion}
                  onIonInput={(e) => setDescripcion(e.detail.value ?? '')}
                />
              </Paso>

              <Paso n={manifiestoId !== null && tipo ? 5 : 4} titulo="Fotos (opcional)">
                <FotosEvidencia
                  fotos={fotos}
                  max={MAX_FOTOS_NOVEDAD}
                  tomando={tomando}
                  disabled={manifiestoId === null}
                  onTomar={tomarFoto}
                  onQuitar={(i) => setFotos(fotos.filter((_, j) => j !== i))}
                />
                <p className="mt-3 mb-0 text-[14px] leading-5 text-muted">
                  Solo si es seguro tomarlas. Cada foto lleva el manifiesto, la fecha, la hora y las coordenadas.
                </p>
              </Paso>

              <div className="mt-8 border-0 border-y border-solid border-divider">
                <Dato label="Ubicación">
                  {ubicacion ? (
                    <span className="inline-flex items-center gap-1.5 text-cumplido">
                      <IonIcon icon={icons.mapPin} aria-hidden="true" />
                      {formatoCoordenadas(ubicacion)} · ±{Math.round(ubicacion.precision)} m
                    </span>
                  ) : ubicando ? (
                    <span className="inline-flex items-center gap-2 font-normal text-muted">
                      <IonSpinner name="crescent" className="h-4 w-4" /> Obteniendo…
                    </span>
                  ) : (
                    <button type="button" onClick={ubicar} className="cursor-pointer border-0 bg-transparent p-0 text-[15px] font-semibold text-petroleo">
                      Sin ubicación · Reintentar
                    </button>
                  )}
                </Dato>
                <Dato label="Hora">Al reportar</Dato>
              </div>
              {errorUbicacion && !ubicacion && (
                <p className="mt-2 mb-0 text-caption text-muted">{errorUbicacion} Puedes reportar la novedad sin ubicación.</p>
              )}
            </>
          )}
        </div>
      </IonContent>

      {!sinPermiso && (
        <IonFooter className="ion-no-border">
          <IonToolbar className="app-modal-footer">
            <div className="px-5 pt-3 pb-2">
              {faltantes.length > 0 && <p className="mt-0 mb-2.5 text-center text-[14px] leading-5 text-muted">Falta {enumerar(faltantes)}</p>}
              <IonButton expand="block" className="m-0 h-14 text-[17px]" disabled={!!faltantes.length || enviando} onClick={reportar}>
                {enviando ? <IonSpinner name="crescent" /> : online ? 'Reportar novedad' : 'Guardar novedad (sin señal)'}
              </IonButton>
            </div>
          </IonToolbar>
        </IonFooter>
      )}
    </>
  );
};

/**
 * Full-screen "Reportar novedad" (`/novedades/reportar?manifiestoId=`). Opened from the "+" of
 * the Novedades tab, Inicio's quick action and the manifiesto detail (with the manifiesto
 * chosen). The outlet reuses this page, so the form is keyed by manifiesto and visit.
 */
const ReportarNovedad: React.FC = () => {
  const location = useLocation();
  const param = Number(new URLSearchParams(location.search).get('manifiestoId'));
  const manifiestoInicial = Number.isInteger(param) && param > 0 ? param : null;
  const [visita, setVisita] = useState(0);
  useIonViewDidLeave(() => setVisita((v) => v + 1));
  return (
    <IonPage>
      <ReportarFormulario key={`${manifiestoInicial ?? 0}-${visita}`} manifiestoInicial={manifiestoInicial} />
    </IonPage>
  );
};

export default ReportarNovedad;
