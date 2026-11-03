import {
  IonButton,
  IonContent,
  IonIcon,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonRippleEffect,
  IonSkeletonText,
  IonSpinner,
  useIonRouter,
  useIonToast,
  useIonViewWillEnter,
  type RefresherEventDetail,
} from '@ionic/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { apiErrorMessage } from '../../api/client';
import AppHeader from '../../components/AppHeader';
import { Aviso, AvisoAccion, AvisoSinConexion } from '../../components/Avisos';
import { EstadoBadge, RndcEstado } from '../../components/EstadoBadge';
import SeguimientoViaje from '../../components/SeguimientoViaje';
import { SobreanticipoFila, SolicitarSobreanticipoModal } from '../../components/Sobreanticipos';
import { useCachedQuery } from '../../hooks/useCachedQuery';
import { icons } from '../../icons';
import { descargarDocumento, documentoGuardado } from '../../offline/documentos';
import { hasPermiso } from '../../services/auth.service';
import { operationsService, type ManifiestoDetalle as Detalle, type Remesa } from '../../services/operations.service';
import { sobreanticiposService, type ResultadoSobreanticipo, type SobreanticiposManifiesto } from '../../services/sobreanticipos.service';
import { seguimientoService, type EstadoSeguimiento } from '../../services/seguimiento.service';
import { useAuthStore } from '../../store/auth.store';
import { useDocumentosStore } from '../../store/documentos.store';
import { ciudad, formatFecha, formatFechaHora, formatKg, formatPesos } from '../../utils/format';

export const Dato: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex justify-between gap-4 border-b border-divider py-3 last:border-b-0">
    <span className="shrink-0 text-[14px] leading-5 text-muted">{label}</span>
    <span className="min-w-0 text-right text-[14px] leading-5 text-tinta">{children}</span>
  </div>
);

export const Seccion: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className = '' }) => (
  <section className={`mt-6 ${className}`}>
    <h2 className="m-0 mb-2 text-[18px] leading-6 font-medium text-tinta">{title}</h2>
    {children}
  </section>
);

/** Document card: open the PDF, is it valid on the road, is it saved on the phone. */
const DocumentoCard: React.FC<{ manifiestoId: number; placa: string | null }> = ({ manifiestoId, placa }) => {
  const router = useIonRouter();
  const [presentToast] = useIonToast();
  const [descargando, setDescargando] = useState(false);
  // Re-render when the saved copy changes
  useDocumentosStore((s) => s.documentos);
  const doc = documentoGuardado(manifiestoId);

  const guardar = async () => {
    setDescargando(true);
    try {
      await descargarDocumento(manifiestoId, placa);
      presentToast({ message: 'Manifiesto guardado en el teléfono', duration: 2000, position: 'bottom' });
    } catch (err) {
      presentToast({ message: apiErrorMessage(err, 'No se pudo descargar el manifiesto'), duration: 3000, position: 'bottom' });
    } finally {
      setDescargando(false);
    }
  };

  return (
    <div className="rounded-2xl bg-superficie p-4">
      <div className="flex items-start gap-3">
        <IonIcon icon={icons.fileText} className="mt-[2px] shrink-0 text-[26px] text-tinta" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="m-0 text-[15px] leading-5 font-medium text-tinta">Documento del manifiesto</p>
          {doc ? (
            <>
              <p className={`mt-1 mb-0 text-[13px] leading-[18px] ${doc.valido ? 'text-cumplido' : 'text-en-ruta'}`}>
                {doc.valido ? 'Válido para mostrar en vía' : doc.motivoNoValido}
              </p>
              <p className="mt-1 mb-0 flex items-center gap-1 text-[13px] leading-[18px] text-muted">
                <IonIcon icon={icons.deviceMobile} className="text-[15px]" aria-hidden="true" />
                Guardado en el teléfono · {formatFechaHora(doc.descargadoEn)}
              </p>
            </>
          ) : (
            <p className="mt-1 mb-0 text-[13px] leading-[18px] text-muted">
              Guárdalo para mostrarlo en un retén aunque no tengas señal.
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <IonButton
          className="flex-1 normal-case tracking-normal"
          onClick={() => router.push(`/manifiestos/${manifiestoId}/documento`)}
        >
          <IonIcon slot="start" icon={icons.eye} />
          Ver manifiesto
        </IonButton>
        <IonButton fill="outline" color="dark" className="normal-case tracking-normal" disabled={descargando} onClick={guardar}>
          {descargando ? <IonSpinner name="crescent" /> : <IonIcon slot="start" icon={doc ? icons.refresh : icons.download} />}
          {doc ? 'Actualizar' : 'Guardar'}
        </IonButton>
      </div>
    </div>
  );
};

const RemesaFila: React.FC<{ remesa: Remesa }> = ({ remesa: r }) => {
  const router = useIonRouter();
  return (
    <button
      type="button"
      onClick={() => router.push(`/remesas/${r.id}`)}
      className="ion-activatable relative flex w-full cursor-pointer items-center gap-3 overflow-hidden border-0 border-b border-solid border-divider bg-transparent px-0 py-3 text-left last:border-b-0"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[15px] leading-5 font-semibold text-tinta">{r.numero}</span>
          <EstadoBadge estado={r.estado} />
        </div>
        <p className="mt-1 mb-0 truncate text-[13px] leading-[18px] text-muted">
          {[r.cliente?.nombre, `${ciudad(r.origen)} → ${ciudad(r.destino)}`, formatKg(r.pesoKg)].filter(Boolean).join(' · ')}
        </p>
      </div>
      <IonIcon icon={icons.chevronRight} className="shrink-0 text-[20px] text-muted" />
      <IonRippleEffect />
    </button>
  );
};

/**
 * The manifiesto's sobreanticipos (everyone's) and the button to request one. Only for users
 * with `sobreanticipos.solicitar`; the backend says whether another one can be requested.
 */
const SobreanticiposSeccion: React.FC<{
  manifiestoId: number;
  data: SobreanticiposManifiesto | null;
  error: string | null;
  loading: boolean;
  onRecargar: () => void;
}> = ({ manifiestoId, data, error, loading, onRecargar }) => {
  const [presentToast] = useIonToast();
  const [abierto, setAbierto] = useState(false);
  const [alertaTope, setAlertaTope] = useState<string | null>(null);

  const creada = (r: ResultadoSobreanticipo) => {
    setAbierto(false);
    setAlertaTope(r.alertaTope);
    presentToast({ message: r.mensaje, duration: 4000, position: 'bottom' });
    onRecargar();
  };

  return (
    <Seccion title={data?.items.length ? `Sobreanticipos (${data.items.length})` : 'Sobreanticipos'}>
      <div id="sobreanticipos" />
      {!data && loading && <IonSkeletonText animated style={{ width: '100%', height: 64, borderRadius: 16 }} />}
      {!data && !loading && error && (
        <Aviso tono="error" action={<AvisoAccion onClick={onRecargar} className="text-error-rndc">Reintentar</AvisoAccion>}>
          {error}
        </Aviso>
      )}
      {data && (
        <>
          {alertaTope && (
            <Aviso tono="warning" className="mb-3">
              {alertaTope}
            </Aviso>
          )}
          {data.items.length === 0 ? (
            <p className="m-0 text-[14px] text-muted">No hay solicitudes</p>
          ) : (
            data.items.map((s) => <SobreanticipoFila key={s.id} item={s} />)
          )}
          <IonButton
            expand="block"
            fill="outline"
            color="dark"
            className="mt-3 normal-case tracking-normal"
            disabled={!data.puedeSolicitar}
            onClick={() => setAbierto(true)}
          >
            <IonIcon slot="start" icon={icons.plus} />
            Solicitar sobreanticipo
          </IonButton>
          <p className="mt-2 mb-0 text-caption text-muted">
            {data.puedeSolicitar ? `Disponible: ${formatPesos(data.disponible)}` : data.motivoNoDisponible}
          </p>
          <SolicitarSobreanticipoModal
            isOpen={abierto}
            manifiestoId={manifiestoId}
            disponible={data.disponible}
            onCerrar={() => setAbierto(false)}
            onCreada={creada}
            onRecargar={onRecargar}
          />
        </>
      )}
    </Seccion>
  );
};

const ManifiestoDetalle: React.FC = () => {
  const { id } = useParams();
  const manifiestoId = Number(id);
  const { data: m, error, guardadoEn, loading, load } = useCachedQuery<Detalle>(`manifiesto:${manifiestoId}`, () =>
    operationsService.manifiesto(manifiestoId)
  );

  const puedeSobreanticipos = useAuthStore((s) => hasPermiso(s.user, 'sobreanticipos.solicitar'));
  const sobre = useCachedQuery<SobreanticiposManifiesto>(`sobreanticipos:${manifiestoId}`, () =>
    sobreanticiposService.delManifiesto(manifiestoId)
  );
  const loadSobre = sobre.load;
  const seguimiento = useCachedQuery<EstadoSeguimiento>(`seguimiento:${manifiestoId}`, () => seguimientoService.estado(manifiestoId));
  const loadSeguimiento = seguimiento.load;
  // Only when there is something to do or see: no card for a despachador with no trip
  const verSeguimiento =
    !!seguimiento.data &&
    (seguimiento.data.puedeIniciar || ['asignado', 'activo', 'pausado'].includes(seguimiento.data.viaje?.estado ?? ''));

  const reload = useCallback(
    () => Promise.all([load(), loadSeguimiento(), puedeSobreanticipos ? loadSobre() : null]),
    [load, loadSeguimiento, loadSobre, puedeSobreanticipos]
  );

  // "Mis sobreanticipos" and the notifications open the detail at a section (?seccion=…)
  const location = useLocation();
  const contentRef = useRef<HTMLIonContentElement>(null);
  const seccion =
    location.pathname === `/manifiestos/${manifiestoId}` ? new URLSearchParams(location.search).get('seccion') : null;
  const haySeccion = !!m && (seccion === 'seguimiento' ? verSeguimiento : seccion === 'sobreanticipos' ? !!sobre.data : false);
  useEffect(() => {
    if (!seccion || !haySeccion) return;
    const content = contentRef.current;
    const el = content?.querySelector(`#${seccion}`);
    if (!content || !el) return;
    content.getScrollElement().then((scroll) => {
      const top = el.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop;
      content.scrollToPoint(0, top - 48, 300);
    });
  }, [seccion, haySeccion]);
  useIonViewWillEnter(() => {
    reload();
  }, [reload]);

  const handleRefresh = async (e: CustomEvent<RefresherEventDetail>) => {
    await reload();
    e.detail.complete();
  };

  return (
    <IonPage>
      <AppHeader title={m?.numero ?? 'Manifiesto'} backHref="/manifiestos" />
      <IonContent ref={contentRef}>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <div className="px-4 pt-4 pb-8">
          <AvisoSinConexion error={error} guardadoEn={guardadoEn} onRetry={reload} />

          {!m && loading && (
            <div className="mt-2">
              <IonSkeletonText animated style={{ width: '50%', height: 28 }} />
              <IonSkeletonText animated style={{ width: '80%', height: 16, marginTop: 12 }} />
              <IonSkeletonText animated style={{ width: '100%', height: 120, marginTop: 20, borderRadius: 16 }} />
            </div>
          )}

          {/* Even without the details, a saved PDF can be opened */}
          {!m && !loading && documentoGuardado(manifiestoId) && (
            <div className="mt-4">
              <DocumentoCard manifiestoId={manifiestoId} placa={null} />
            </div>
          )}

          {m && (
            <>
              <div className={`flex items-center justify-between gap-2 ${error ? 'mt-4' : ''}`}>
                <p className="m-0 text-[22px] leading-7 font-semibold text-tinta">
                  {ciudad(m.origen) || 'Sin origen'} → {ciudad(m.destino) || 'Sin destino'}
                </p>
                <EstadoBadge estado={m.estado} />
              </div>
              <p className="mt-1 mb-0 text-[14px] leading-5 text-muted">
                {[m.placa, formatFecha(m.fechaExpedicion)].filter(Boolean).join(' · ')}
              </p>

              <div className="mt-4">
                <DocumentoCard manifiestoId={m.id} placa={m.placa} />
              </div>

              {verSeguimiento && (
                <div className="mt-3" id="seguimiento">
                  <SeguimientoViaje
                    manifiestoId={m.id}
                    data={seguimiento.data}
                    loading={seguimiento.loading}
                    error={seguimiento.error}
                    onRecargar={loadSeguimiento}
                  />
                </div>
              )}

              {m.estadoRndc === 'error' && m.rndcError && (
                <Aviso tono="error" className="mt-4">
                  <span className="font-medium">Rechazado por el RNDC:</span> {m.rndcError}
                </Aviso>
              )}

              <Seccion title="Datos">
                <Dato label="Conductor">{m.conductor?.nombre ?? '—'}</Dato>
                <Dato label="Placa">{m.placa ?? '—'}</Dato>
                <Dato label="RNDC">
                  <RndcEstado estado={m.estadoRndc} />
                </Dato>
                {m.consecutivoRndc && <Dato label="Consecutivo RNDC">{m.consecutivoRndc}</Dato>}
                <Dato label="Origen">{m.origen?.nombre ?? '—'}</Dato>
                <Dato label="Destino">{m.destino?.nombre ?? '—'}</Dato>
                <Dato label="Flete">{formatPesos(m.valorFlete)}</Dato>
              </Seccion>

              <Seccion title={`Remesas (${m.remesas.length})`}>
                {m.remesas.length === 0 ? (
                  <p className="m-0 text-[14px] text-muted">Sin remesas</p>
                ) : (
                  m.remesas.map((r) => <RemesaFila key={r.id} remesa={r} />)
                )}
              </Seccion>

              {puedeSobreanticipos && (
                <SobreanticiposSeccion
                  manifiestoId={m.id}
                  data={sobre.data}
                  error={sobre.error}
                  loading={sobre.loading}
                  onRecargar={loadSobre}
                />
              )}
            </>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default ManifiestoDetalle;
