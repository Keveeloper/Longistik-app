import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonModal,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSkeletonText,
  IonSpinner,
  IonTitle,
  IonToolbar,
  useIonRouter,
  useIonToast,
  useIonViewWillEnter,
  type RefresherEventDetail,
} from '@ionic/react';
import { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiErrorMessage } from '../../api/client';
import AppHeader from '../../components/AppHeader';
import { Aviso, AvisoAccion, AvisoSinConexion } from '../../components/Avisos';
import { Dato, DetalleTitulo, Seccion } from '../../components/Detalle';
import EntregaCard from '../../components/EntregaCard';
import { EstadoBadge, RndcEstado } from '../../components/EstadoBadge';
import { TiemposEditor } from '../../components/TiemposRndc';
import { useCachedQuery } from '../../hooks/useCachedQuery';
import { useOnline } from '../../hooks/useOnline';
import { icons } from '../../icons';
import { colaDeSesion, descartarCumplido, enviarCumplido } from '../../offline/cumplidos';
import { cumplidosService, type EstadoCumplido, type TiemposCumplido } from '../../services/cumplidos.service';
import { operationsService, type RemesaDetalle as Detalle, type Tercero } from '../../services/operations.service';
import { useCumplidosQueue } from '../../store/cumplidosQueue.store';
import { ciudad, formatFecha, formatKg, formatNumero, formatPesos, tipoOracion } from '../../utils/format';
import { tiemposIniciales, validarTiempos } from '../../utils/tiempos';

const TerceroBloque: React.FC<{ titulo: string; tercero: Tercero | null }> = ({ titulo, tercero }) => (
  <div>
    <p className="m-0 text-[13px] leading-[18px] font-medium tracking-[0.06em] text-cielo uppercase">{titulo}</p>
    {tercero ? (
      <>
        <p className="mt-0.5 mb-0 text-[16px] leading-[22px] font-semibold text-white">{tipoOracion(tercero.nombre) || '—'}</p>
        <p className="mt-0.5 mb-0 text-[14px] leading-5 text-white/85">
          {[tipoOracion(tercero.direccion), ciudad(tercero.municipio)].filter(Boolean).join(' · ')}
        </p>
        {tercero.telefono && (
          <a href={`tel:${tercero.telefono}`} className="mt-1 inline-flex items-center gap-1 text-[14px] leading-5 font-medium text-cielo no-underline">
            <IonIcon icon={icons.phone} aria-hidden="true" />
            {tercero.telefono}
          </a>
        )}
      </>
    ) : (
      <p className="mt-0.5 mb-0 text-[15px] text-white/85">—</p>
    )}
  </div>
);

/** Featured dark card: who sends and who receives, joined by the route line. */
const RutaCard: React.FC<{ remitente: Tercero | null; destinatario: Tercero | null }> = ({ remitente, destinatario }) => (
  <div className="flex gap-3.5 rounded-3xl bg-tinta p-5">
    <div className="flex flex-col items-center pt-1 pb-1" aria-hidden="true">
      <span className="h-3 w-3 shrink-0 rounded-full bg-cielo" />
      <span className="my-1 w-0.5 flex-1 bg-white/25" />
      <span className="h-3 w-3 shrink-0 rounded-[3px] bg-[#6cbf84]" />
    </div>
    <div className="flex min-w-0 flex-1 flex-col gap-5">
      <TerceroBloque titulo="Remitente" tercero={remitente} />
      <TerceroBloque titulo="Destinatario" tercero={destinatario} />
    </div>
  </div>
);

/** One of the key figures under the route (Mercancía, Peso, Cantidad). */
const Cifra: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="min-w-0">
    <p className="m-0 text-[14px] leading-5 text-muted">{label}</p>
    <p className="mt-0.5 mb-0 truncate text-[22px] leading-7 font-semibold text-tinta">{children}</p>
  </div>
);

/** Retry the RNDC cumplido, optionally with adjusted times (CRE111/141/319 and the like). */
const ReintentoRndc: React.FC<{ remesaId: number; mensaje: string | null; onDone: () => void }> = ({ remesaId, mensaje, onDone }) => {
  const [presentToast] = useIonToast();
  const [enviando, setEnviando] = useState(false);
  const [editar, setEditar] = useState(false);
  const [tiempos, setTiempos] = useState<TiemposCumplido>(tiemposIniciales());
  const [cargandoTiempos, setCargandoTiempos] = useState(false);
  const errorTiempos = validarTiempos(tiempos);

  const reintentar = async (conTiempos?: TiemposCumplido) => {
    setEnviando(true);
    try {
      const { entrega } = await cumplidosService.reintentarRndc(remesaId, conTiempos);
      const ok = entrega.rndc.estado === 'reportado';
      presentToast({
        message: ok ? 'Cumplido reportado al RNDC' : (entrega.rndc.mensaje ?? 'El RNDC no aceptó el cumplido'),
        duration: ok ? 2500 : 5000,
        position: 'bottom',
      });
      setEditar(false);
      onDone();
    } catch (err) {
      presentToast({ message: apiErrorMessage(err), duration: 4000, position: 'bottom' });
    } finally {
      setEnviando(false);
    }
  };

  const abrirEditor = async () => {
    setEditar(true);
    setCargandoTiempos(true);
    try {
      const propuesta = await cumplidosService.tiempos(remesaId);
      if (propuesta.tiempos) setTiempos(propuesta.tiempos);
    } catch {
      // keep the manual starting point
    } finally {
      setCargandoTiempos(false);
    }
  };

  return (
    <>
      <Aviso tono="error" className="mt-4">
        <p className="m-0 font-medium">El cumplido no ha llegado al RNDC</p>
        {mensaje && <p className="mt-1 mb-0 break-words">{mensaje}</p>}
        <div className="mt-2 flex gap-4">
          <AvisoAccion onClick={() => reintentar()} className="text-error-rndc">
            {enviando ? 'Enviando…' : 'Reintentar'}
          </AvisoAccion>
          <AvisoAccion onClick={abrirEditor} className="text-error-rndc">
            Ajustar tiempos
          </AvisoAccion>
        </div>
      </Aviso>

      <IonModal isOpen={editar} onDidDismiss={() => setEditar(false)}>
        <IonHeader>
          <IonToolbar className="app-toolbar">
            <IonTitle>Tiempos para el RNDC</IonTitle>
            <IonButtons slot="end">
              <IonButton aria-label="Cerrar" onClick={() => setEditar(false)}>
                <IonIcon slot="icon-only" icon={icons.x} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div className="px-4 pt-4 pb-8">
            {cargandoTiempos ? (
              <div className="flex items-center gap-2 text-caption text-muted">
                <IonSpinner name="crescent" /> Consultando el monitoreo del RNDC…
              </div>
            ) : (
              <>
                <p className="mt-0 mb-4 text-[14px] leading-5 text-muted">
                  Hora de Colombia. El RNDC valida la entrada al cargue contra su propio registro: si lo rechaza, su mensaje
                  dice qué horas espera.
                </p>
                <TiemposEditor value={tiempos} onChange={setTiempos} />
                {errorTiempos && <p className="mt-3 mb-0 text-[13px] text-error-rndc">{errorTiempos}</p>}
                <IonButton
                  expand="block"
                  className="mt-5 normal-case tracking-normal"
                  disabled={!!errorTiempos || enviando}
                  onClick={() => reintentar(tiempos)}
                >
                  {enviando ? <IonSpinner name="crescent" /> : 'Enviar al RNDC'}
                </IonButton>
              </>
            )}
          </div>
        </IonContent>
      </IonModal>
    </>
  );
};

const RemesaDetalle: React.FC = () => {
  const { id } = useParams();
  const remesaId = Number(id);
  const router = useIonRouter();
  const online = useOnline();
  const [presentToast] = useIonToast();
  const remesa = useCachedQuery<Detalle>(`remesa:${remesaId}`, () => operationsService.remesa(remesaId));
  const cumplido = useCachedQuery<EstadoCumplido>(`remesa-cumplido:${remesaId}`, () => cumplidosService.estado(remesaId));
  const enCola = useCumplidosQueue((s) => colaDeSesion(s.cola).find((c) => c.remesaId === remesaId));
  const [enviando, setEnviando] = useState(false);

  const r = remesa.data;
  const c = cumplido.data;
  const { load: loadRemesa } = remesa;
  const { load: loadCumplido } = cumplido;

  const reload = useCallback(() => Promise.all([loadRemesa(), loadCumplido()]), [loadRemesa, loadCumplido]);
  useIonViewWillEnter(() => {
    reload();
  }, [reload]);

  const handleRefresh = async (e: CustomEvent<RefresherEventDetail>) => {
    await reload();
    e.detail.complete();
  };

  const enviarAhora = async () => {
    if (!enCola) return;
    setEnviando(true);
    const res = await enviarCumplido(enCola.id);
    setEnviando(false);
    if (res.ok) reload();
    else presentToast({ message: res.mensaje, duration: 3000, position: 'bottom' });
  };

  const ultimaEntrega = c?.entregas[0];

  return (
    <IonPage>
      <AppHeader backHref="/remesas" />
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <div className="px-5 pt-1 pb-6">
          {remesa.error && (
            <div className="mb-4">
              <AvisoSinConexion error={remesa.error} guardadoEn={remesa.guardadoEn} onRetry={reload} />
            </div>
          )}

          {!r && remesa.loading && (
            <div>
              <IonSkeletonText animated style={{ width: '40%', height: 16 }} />
              <IonSkeletonText animated style={{ width: '80%', height: 32, marginTop: 10 }} />
              <IonSkeletonText animated style={{ width: '100%', height: 56, marginTop: 20, borderRadius: 28 }} />
            </div>
          )}

          {r && (
            <>
              <DetalleTitulo
                eyebrow={`Remesa ${r.numero}`}
                title={`${ciudad(r.origen) || 'Sin origen'} → ${ciudad(r.destino) || 'Sin destino'}`}
                badge={<EstadoBadge estado={r.estado} />}
                meta={[tipoOracion(r.cliente?.nombre), formatFecha(r.fecha)].filter(Boolean).join(' · ')}
              />

              {/* Delivery saved on the phone, waiting for signal */}
              {enCola && (
                <Aviso
                  tono={enCola.estado === 'rechazado' ? 'error' : 'warning'}
                  icon={enCola.estado === 'rechazado' ? icons.alertCircle : icons.cloudUpload}
                  className="mt-5"
                  action={
                    enCola.estado === 'rechazado' ? (
                      <AvisoAccion onClick={() => descartarCumplido(enCola.id)} className="text-error-rndc">
                        Descartar
                      </AvisoAccion>
                    ) : online ? (
                      <AvisoAccion onClick={enviarAhora} className="text-en-ruta">
                        {enviando || enCola.estado === 'enviando' ? 'Enviando…' : 'Enviar ahora'}
                      </AvisoAccion>
                    ) : undefined
                  }
                >
                  <p className="m-0 font-medium">
                    {enCola.estado === 'rechazado' ? 'La entrega no fue aceptada' : 'Entrega guardada en el teléfono'}
                  </p>
                  <p className="mt-1 mb-0">
                    {enCola.estado === 'rechazado'
                      ? enCola.ultimoError
                      : 'Se enviará sola cuando haya señal, con la hora y la ubicación en que se tomó.'}
                  </p>
                </Aviso>
              )}

              {((!enCola && c?.puedeCumplir) ||
                // Offline and never loaded: the delivery can still be registered
                (!enCola && !c && cumplido.error && r.estado !== 'cumplido' && r.estado !== 'inactivo')) && (
                <IonButton expand="block" className="mt-5 mb-0 h-14 text-[17px]" onClick={() => router.push(`/remesas/${remesaId}/cumplir`)}>
                  <IonIcon slot="start" icon={icons.camera} />
                  Cumplir remesa
                </IonButton>
              )}

              {!!c?.entregas.length && (
                <div className="mt-5 flex flex-col gap-3">
                  {c.entregas.map((e) => (
                    <EntregaCard key={e.id} entrega={e} pesoKg={r.pesoKg} />
                  ))}
                </div>
              )}

              {c?.cumplido.estadoRndc === 'reportado' && (
                <Aviso tono="success" className="mt-3">
                  Cumplida en el RNDC
                </Aviso>
              )}
              {c?.puedeReintentarRndc && !enCola && (
                <ReintentoRndc remesaId={remesaId} mensaje={ultimaEntrega?.rndc.mensaje ?? c.cumplido.rndcError} onDone={reload} />
              )}
              {c?.municipal && !!c.entregas.length && c.cumplido.estadoRndc !== 'reportado' && (
                <Aviso className="mt-3">Remesa municipal: el RNDC la cumple junto con el cumplido del manifiesto.</Aviso>
              )}
              {c && !c.puedeCumplir && !c.entregas.length && c.cumplido.estadoRndc !== 'reportado' && c.motivoNoDisponible && (
                <p className="mt-4 mb-0 text-[15px] leading-[22px] text-muted">{c.motivoNoDisponible}</p>
              )}

              {r.estadoRndc === 'error' && r.rndcError && (
                <Aviso tono="error" className="mt-3">
                  <span className="font-medium">Remesa rechazada por el RNDC:</span> {r.rndcError}
                </Aviso>
              )}

              <div className="mt-5">
                <RutaCard remitente={r.remitente} destinatario={r.destinatario} />
              </div>

              <div className="mt-6 grid grid-cols-3 gap-3">
                <Cifra label="Mercancía">{r.producto ?? '—'}</Cifra>
                <Cifra label="Peso">{formatKg(r.pesoKg)}</Cifra>
                <Cifra label="Cantidad">{formatNumero(r.cantidad)} u</Cifra>
              </div>
            </>
          )}
        </div>

        {r && (
          <div className="pb-8">
            <Seccion title="Datos">
              <Dato label="RNDC">
                <RndcEstado estado={r.estadoRndc} variante="dato" />
              </Dato>
              {r.consecutivoRndc && <Dato label="Consecutivo RNDC">{r.consecutivoRndc}</Dato>}
              {r.detalles.length > 0 && (
                <Dato label="Valor declarado">{formatPesos(r.detalles.reduce((total, d) => total + d.valorDeclarado, 0))}</Dato>
              )}
              {r.manifiestoId && (
                <Dato label="Manifiesto">
                  <button
                    type="button"
                    onClick={() => router.push(`/manifiestos/${r.manifiestoId}`)}
                    className="inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-[15px] leading-[22px] font-semibold text-petroleo"
                  >
                    Ver manifiesto
                    <IonIcon icon={icons.chevronRight} className="text-[18px]" aria-hidden="true" />
                  </button>
                </Dato>
              )}
            </Seccion>

            {/* Several products: each one with its figures */}
            {r.detalles.length > 1 && (
              <Seccion title="Mercancía" count={r.detalles.length}>
                {r.detalles.map((d, i) => (
                  <Dato key={i} label={d.producto ?? 'Producto'}>
                    {formatKg(d.pesoKg)} · {d.cantidad} u · {formatPesos(d.valorDeclarado)}
                  </Dato>
                ))}
              </Seccion>
            )}

            {r.observaciones && (
              <Seccion title="Observaciones">
                <p className="mt-2 mb-0 text-[15px] leading-[22px] text-tinta">{r.observaciones}</p>
              </Seccion>
            )}
          </div>
        )}
      </IonContent>
    </IonPage>
  );
};

export default RemesaDetalle;
