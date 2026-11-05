import {
  IonButton,
  IonContent,
  IonIcon,
  IonPage,
  IonRefresher,
  IonRefresherContent,
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
import { Dato, DetalleTitulo, FilaLista, Seccion } from '../../components/Detalle';
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
import { ciudad, formatFecha, formatFechaHora, formatKg, formatPesos, lugar, tipoOracion } from '../../utils/format';
import './ManifiestoDetalle.css';

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
    <div className="rounded-3xl bg-tinta p-5 text-white">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10">
          <IonIcon
            icon={doc && !doc.valido ? icons.alertTriangle : icons.shieldCheck}
            className={`text-[22px] ${doc && !doc.valido ? 'text-rndc-pendiente' : 'text-cielo'}`}
            aria-hidden="true"
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="m-0 text-[17px] leading-[22px] font-semibold">
            {doc?.valido ? 'Documento listo para mostrar en vía' : 'Documento del manifiesto'}
          </p>
          {doc ? (
            <>
              {!doc.valido && <p className="mt-1 mb-0 text-[14px] leading-5">{doc.motivoNoValido}</p>}
              <p className="mt-1 mb-0 text-[13px] leading-[18px] text-white/75">
                Guardado en el teléfono · {formatFechaHora(doc.descargadoEn)}
              </p>
            </>
          ) : (
            <p className="mt-1 mb-0 text-[13px] leading-[18px] text-white/75">
              Guárdalo para mostrarlo en un retén aunque no tengas señal.
            </p>
          )}
        </div>
      </div>
      <div className="mt-4 flex gap-3">
        <IonButton className="doc-ver m-0 h-[46px] flex-1" onClick={() => router.push(`/manifiestos/${manifiestoId}/documento`)}>
          <IonIcon slot="start" icon={icons.eye} />
          Ver manifiesto
        </IonButton>
        <IonButton
          className="doc-actualizar m-0 h-[46px] w-[46px]"
          aria-label={doc ? 'Actualizar' : 'Guardar en el teléfono'}
          disabled={descargando}
          onClick={guardar}
        >
          {descargando ? <IonSpinner name="crescent" /> : <IonIcon slot="icon-only" icon={doc ? icons.refresh : icons.download} />}
        </IonButton>
      </div>
    </div>
  );
};

const RemesaFila: React.FC<{ remesa: Remesa }> = ({ remesa: r }) => {
  const router = useIonRouter();
  return (
    <FilaLista icon={icons.fileDescription} chevron onClick={() => router.push(`/remesas/${r.id}`)} className="py-3 last:border-b-0">
      <div className="flex items-center gap-2">
        <span className="text-[16px] leading-[22px] font-semibold text-tinta">{r.numero}</span>
        <EstadoBadge estado={r.estado} />
      </div>
      <p className="mt-0.5 mb-0 truncate text-[14px] leading-5 text-muted">
        {[tipoOracion(r.cliente?.nombre), `${ciudad(r.origen)} → ${ciudad(r.destino)}`, formatKg(r.pesoKg)].filter(Boolean).join(' · ')}
      </p>
    </FilaLista>
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
    <Seccion
      title="Sobreanticipos"
      count={data?.items.length || undefined}
      end={data?.puedeSolicitar ? `Disponible ${formatPesos(data.disponible)}` : undefined}
    >
      <div id="sobreanticipos" />
      {!data && loading && <IonSkeletonText animated style={{ width: '100%', height: 64, borderRadius: 16, marginTop: 12 }} />}
      {!data && !loading && error && (
        <Aviso
          tono="error"
          className="mt-3"
          action={<AvisoAccion onClick={onRecargar} className="text-error-rndc">Reintentar</AvisoAccion>}
        >
          {error}
        </Aviso>
      )}
      {data && (
        <>
          {alertaTope && (
            <Aviso tono="warning" className="mt-3">
              {alertaTope}
            </Aviso>
          )}
          {data.items.length === 0 ? (
            <p className="mt-2 mb-0 text-[15px] leading-[22px] text-muted">No hay solicitudes</p>
          ) : (
            data.items.map((s) => <SobreanticipoFila key={s.id} item={s} />)
          )}
          <IonButton
            expand="block"
            className="btn-secundario mt-4 mb-0 h-[52px] text-[16px]"
            disabled={!data.puedeSolicitar}
            onClick={() => setAbierto(true)}
          >
            <IonIcon slot="start" icon={icons.plus} />
            Solicitar sobreanticipo
          </IonButton>
          {!data.puedeSolicitar && data.motivoNoDisponible && (
            <p className="mt-2 mb-0 text-center text-caption text-muted">{data.motivoNoDisponible}</p>
          )}
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
      <AppHeader backHref="/manifiestos" />
      <IonContent ref={contentRef}>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <div className="px-5 pt-1 pb-6">
          {error && (
            <div className="mb-4">
              <AvisoSinConexion error={error} guardadoEn={guardadoEn} onRetry={reload} />
            </div>
          )}

          {!m && loading && (
            <div>
              <IonSkeletonText animated style={{ width: '40%', height: 16 }} />
              <IonSkeletonText animated style={{ width: '80%', height: 32, marginTop: 10 }} />
              <IonSkeletonText animated style={{ width: '100%', height: 160, marginTop: 20, borderRadius: 24 }} />
            </div>
          )}

          {/* Even without the details, a saved PDF can be opened */}
          {!m && !loading && documentoGuardado(manifiestoId) && <DocumentoCard manifiestoId={manifiestoId} placa={null} />}

          {m && (
            <>
              <DetalleTitulo
                eyebrow={`Manifiesto ${m.numero}`}
                title={`${ciudad(m.origen) || 'Sin origen'} → ${ciudad(m.destino) || 'Sin destino'}`}
                badge={<EstadoBadge estado={m.estado} />}
                meta={[m.placa, formatFecha(m.fechaExpedicion)].filter(Boolean).join(' · ')}
              />

              <div className="mt-5">
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
            </>
          )}
        </div>

        {m && (
          <div className="pb-8">
            <Seccion title="Datos">
              <Dato label="Conductor">{tipoOracion(m.conductor?.nombre) || '—'}</Dato>
              <Dato label="Placa">{m.placa ?? '—'}</Dato>
              <Dato label="RNDC">
                <RndcEstado estado={m.estadoRndc} variante="dato" />
              </Dato>
              {m.consecutivoRndc && <Dato label="Consecutivo RNDC">{m.consecutivoRndc}</Dato>}
              <Dato label="Origen">{lugar(m.origen) || '—'}</Dato>
              <Dato label="Destino">{lugar(m.destino) || '—'}</Dato>
              <Dato label="Flete">{formatPesos(m.valorFlete)}</Dato>
            </Seccion>

            <Seccion title="Remesas" count={m.remesas.length}>
              {m.remesas.length === 0 ? (
                <p className="mt-2 mb-0 text-[15px] leading-[22px] text-muted">Sin remesas</p>
              ) : (
                <div className="mt-1">
                  {m.remesas.map((r) => (
                    <RemesaFila key={r.id} remesa={r} />
                  ))}
                </div>
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
          </div>
        )}
      </IonContent>
    </IonPage>
  );
};

export default ManifiestoDetalle;
