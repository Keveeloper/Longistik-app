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
  IonToolbar,
  useIonRouter,
  useIonViewWillEnter,
  type RefresherEventDetail,
} from '@ionic/react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import AppHeader from '../../components/AppHeader';
import { Aviso, AvisoSinConexion } from '../../components/Avisos';
import { Dato, DetalleTitulo, FilaLista, Seccion } from '../../components/Detalle';
import { NovedadBadge } from '../../components/EstadoBadge';
import { useCachedQuery } from '../../hooks/useCachedQuery';
import { icons } from '../../icons';
import { formatoCoordenadas } from '../../offline/evidencia';
import { novedadesService, type NovedadDetalle as Detalle } from '../../services/novedades.service';
import { useAvisosStore } from '../../store/avisos.store';
import { ciudad, formatFechaHora, tipoOracion } from '../../utils/format';

const EVENTO: Record<Detalle['historial'][number]['tipo'], string> = {
  creada: 'Reportada',
  en_gestion: 'Tomada por la oficina',
  nota: 'Nota',
  cerrada: 'Cerrada',
};

/** A novedad as the office sees it, read-only: only the web takes and closes it. */
const NovedadDetalle: React.FC = () => {
  const { id } = useParams();
  const novedadId = Number(id);
  const router = useIonRouter();
  const [foto, setFoto] = useState<string | null>(null);
  const { data: n, error, guardadoEn, loading, load } = useCachedQuery<Detalle>(`novedad:${novedadId}`, () =>
    novedadesService.detalle(novedadId)
  );

  useIonViewWillEnter(() => {
    load();
  }, [load]);
  // A notification arrived with the app open (e.g. the office took or closed it)
  const avisos = useAvisosStore((s) => s.version);
  useEffect(() => {
    if (avisos) load();
  }, [avisos, load]);

  const handleRefresh = async (e: CustomEvent<RefresherEventDetail>) => {
    await load();
    e.detail.complete();
  };

  const ruta = n ? [ciudad(n.manifiesto.origen), ciudad(n.manifiesto.destino)].filter(Boolean).join(' → ') : '';

  return (
    <IonPage>
      <AppHeader backHref="/novedades" />
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <div className="px-5 pt-1 pb-6">
          {error && (
            <div className="mb-4">
              <AvisoSinConexion error={error} guardadoEn={guardadoEn} onRetry={load} />
            </div>
          )}
          {!n && loading && (
            <div>
              <IonSkeletonText animated style={{ width: '40%', height: 16 }} />
              <IonSkeletonText animated style={{ width: '80%', height: 32, marginTop: 10 }} />
              <IonSkeletonText animated style={{ width: '100%', height: 96, marginTop: 20, borderRadius: 24 }} />
            </div>
          )}
          {n && (
            <>
              <DetalleTitulo
                eyebrow={`Novedad · ${n.manifiesto.numero ?? `Manifiesto ${n.manifiesto.id}`}`}
                title={n.tipo.nombre}
                badge={<NovedadBadge estado={n.estado} />}
                meta={formatFechaHora(n.capturadaEn)}
              />
              <p className="mt-5 mb-0 text-[17px] leading-6 whitespace-pre-line text-tinta">{n.descripcion}</p>

              {n.estado === 'cerrada' && n.resolucion && (
                <Aviso tono="success" className="mt-5">
                  <p className="m-0 font-medium">
                    Cerrada{n.cerradaPor ? ` por ${tipoOracion(n.cerradaPor.nombre)}` : ''}
                    {n.cerradaEn ? ` · ${formatFechaHora(n.cerradaEn)}` : ''}
                  </p>
                  <p className="mt-1 mb-0 whitespace-pre-line">{n.resolucion}</p>
                </Aviso>
              )}
              {n.estado === 'en_gestion' && (
                <Aviso className="mt-5">
                  {n.gestionadaPor ? `${tipoOracion(n.gestionadaPor.nombre)} la está atendiendo.` : 'La oficina la está atendiendo.'}
                </Aviso>
              )}
              {n.estado === 'abierta' && <Aviso className="mt-5">La oficina todavía no la ha tomado.</Aviso>}
            </>
          )}
        </div>

        {n && (
          <div className="pb-8">
            {n.fotos.length > 0 && (
              <Seccion title="Fotos" count={n.fotos.length}>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {n.fotos.map((f, i) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFoto(f.url)}
                      aria-label={`Ver foto ${i + 1}`}
                      className="aspect-square cursor-pointer overflow-hidden rounded-2xl border-0 bg-superficie p-0"
                    >
                      <img src={f.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>
              </Seccion>
            )}

            <Seccion title="Datos">
              <Dato label="Reportó">{tipoOracion(n.reportadaPor?.nombre) || '—'}</Dato>
              <Dato label="Ubicación">
                {n.ubicacion ? (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${n.ubicacion.latitud},${n.ubicacion.longitud}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-petroleo no-underline"
                  >
                    {formatoCoordenadas(n.ubicacion)}
                  </a>
                ) : (
                  'Sin ubicación'
                )}
              </Dato>
              {n.rndc && <Dato label="En el RNDC">{n.rndc.descripcion}</Dato>}
            </Seccion>

            <Seccion title="Manifiesto">
              <div className="mt-1">
                <FilaLista icon={icons.truck} chevron onClick={() => router.push(`/manifiestos/${n.manifiesto.id}`)} className="py-3">
                  <span className="block text-[16px] leading-[22px] font-semibold text-tinta">{n.manifiesto.numero ?? `Manifiesto ${n.manifiesto.id}`}</span>
                  <span className="block truncate text-[14px] leading-5 text-muted">{[ruta, n.manifiesto.placa].filter(Boolean).join(' · ')}</span>
                </FilaLista>
                {n.remesa && (
                  <FilaLista icon={icons.fileDescription} chevron onClick={() => router.push(`/remesas/${n.remesa!.id}`)} className="py-3 last:border-b-0">
                    <span className="block text-[16px] leading-[22px] font-semibold text-tinta">{n.remesa.numero ?? `Remesa ${n.remesa.id}`}</span>
                    <span className="block text-[14px] leading-5 text-muted">Remesa afectada</span>
                  </FilaLista>
                )}
              </div>
            </Seccion>

            <Seccion title="Historial">
              <ol className="m-0 mt-3 list-none p-0">
                {n.historial.map((h, i) => (
                  <li key={i} className="flex gap-3 pb-4 last:pb-0">
                    <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-tinta" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="m-0 text-[15px] leading-[22px] font-semibold text-tinta">
                        {EVENTO[h.tipo]}
                        {h.por && <span className="font-normal text-muted"> · {tipoOracion(h.por.nombre)}</span>}
                      </p>
                      <p className="m-0 text-[13px] leading-[18px] text-muted">{formatFechaHora(h.en)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Seccion>
          </div>
        )}

        <IonModal isOpen={!!foto} onDidDismiss={() => setFoto(null)}>
          <IonHeader className="ion-no-border">
            <IonToolbar>
              <IonButtons slot="end">
                <IonButton aria-label="Cerrar" onClick={() => setFoto(null)}>
                  <IonIcon slot="icon-only" icon={icons.x} />
                </IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent>{foto && <img src={foto} alt="Foto de la novedad" className="block w-full" />}</IonContent>
        </IonModal>
      </IonContent>
    </IonPage>
  );
};

export default NovedadDetalle;
