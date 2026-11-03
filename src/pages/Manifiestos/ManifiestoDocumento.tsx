import { IonButton, IonContent, IonIcon, IonPage, IonSpinner, useIonToast, useIonViewWillEnter } from '@ionic/react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiErrorMessage } from '../../api/client';
import AppHeader from '../../components/AppHeader';
import { Aviso, AvisoAccion } from '../../components/Avisos';
import { useOnline } from '../../hooks/useOnline';
import { icons } from '../../icons';
import { descargarDocumento, documentoGuardado, leerDocumento } from '../../offline/documentos';
import { abrirPdf, renderizarPaginas } from '../../offline/pdfRender';
import { useCompanyStore } from '../../store/company.store';
import { documentoKey, useDocumentosStore } from '../../store/documentos.store';
import { formatFechaHora } from '../../utils/format';

const ZOOMS = [1, 1.5, 2];
/** A saved copy older than this is refreshed in the background when there's signal. */
const REFRESCAR_MS = 60 * 60 * 1000;

/**
 * Full-screen manifiesto PDF to show at a roadside check. Opens the copy saved on the
 * phone right away (no signal needed) and refreshes it in the background when online.
 */
const ManifiestoDocumento: React.FC = () => {
  const { id } = useParams();
  const manifiestoId = Number(id);
  const companyCode = useCompanyStore((s) => s.company?.code ?? '');
  const doc = useDocumentosStore((s) => s.documentos[documentoKey(companyCode, manifiestoId)]);
  const online = useOnline();
  const [presentToast] = useIonToast();

  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [descargando, setDescargando] = useState(false);
  const [zoom, setZoom] = useState(0);
  const pagesRef = useRef<HTMLDivElement>(null);

  const abrirGuardado = useCallback(async () => {
    const guardado = documentoGuardado(manifiestoId);
    if (!guardado) return false;
    setPdf(await abrirPdf(await leerDocumento(guardado)));
    return true;
  }, [manifiestoId]);

  const descargar = useCallback(async () => {
    setDescargando(true);
    try {
      await descargarDocumento(manifiestoId);
      await abrirGuardado();
      setError(null);
      return true;
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo descargar el manifiesto'));
      return false;
    } finally {
      setDescargando(false);
    }
  }, [manifiestoId, abrirGuardado]);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const guardado = documentoGuardado(manifiestoId);
      const abierto = await abrirGuardado();
      const vieja = !guardado || Date.now() - new Date(guardado.descargadoEn).getTime() > REFRESCAR_MS;
      if (!abierto) await descargar();
      // Background refresh: if it fails, the saved copy is still shown and good enough
      else if (vieja && online && !(await descargar())) setError(null);
    } catch (err) {
      console.error('Manifiesto PDF', err);
      setError('No se pudo abrir el manifiesto guardado. Descárgalo de nuevo.');
    }
  }, [manifiestoId, abrirGuardado, descargar, online]);

  useIonViewWillEnter(() => {
    cargar();
  }, [cargar]);

  // Draw the pages whenever the document or the zoom changes
  useEffect(() => {
    const container = pagesRef.current;
    if (!pdf || !container) return;
    let cancelled = false;
    // Fit the screen width (minus the 16px side padding) at 100%
    const width = ((container.parentElement?.clientWidth ?? window.innerWidth) - 32) * ZOOMS[zoom];
    renderizarPaginas(pdf, width).then((canvases) => {
      if (cancelled) return;
      container.replaceChildren(...canvases.map((c) => Object.assign(c, { className: 'block bg-white shadow-md' })));
    });
    return () => {
      cancelled = true;
    };
  }, [pdf, zoom]);

  const actualizar = async () => {
    if (await descargar()) presentToast({ message: 'Manifiesto actualizado', duration: 2000, position: 'bottom' });
  };

  return (
    <IonPage>
      <AppHeader
        title={doc?.numero ?? 'Manifiesto'}
        backHref={`/manifiestos/${manifiestoId}`}
        end={
          <>
            <IonButton aria-label="Reducir" disabled={zoom === 0} onClick={() => setZoom(zoom - 1)}>
              <IonIcon slot="icon-only" icon={icons.zoomOut} />
            </IonButton>
            <IonButton aria-label="Ampliar" disabled={zoom === ZOOMS.length - 1} onClick={() => setZoom(zoom + 1)}>
              <IonIcon slot="icon-only" icon={icons.zoomIn} />
            </IonButton>
            <IonButton aria-label="Actualizar" disabled={descargando || !online} onClick={actualizar}>
              {descargando ? <IonSpinner name="crescent" /> : <IonIcon slot="icon-only" icon={icons.refresh} />}
            </IonButton>
          </>
        }
      />
      <IonContent>
        <div className="flex flex-col gap-2 px-4 pt-3">
          {doc &&
            (doc.valido ? (
              <Aviso tono="success" icon={icons.shieldCheck}>
                <span className="font-medium">Válido para mostrar en vía.</span> Aceptado por el RNDC.
              </Aviso>
            ) : (
              <Aviso tono="warning">{doc.motivoNoValido}</Aviso>
            ))}
          {doc && (
            <p className="m-0 flex items-center gap-1 text-caption text-muted">
              <IonIcon icon={online ? icons.deviceMobile : icons.wifiOff} className="text-[15px]" aria-hidden="true" />
              {online ? 'Copia guardada en el teléfono' : 'Sin conexión: copia guardada'} · {formatFechaHora(doc.descargadoEn)}
            </p>
          )}
          {error && (
            <Aviso
              tono="error"
              action={
                online ? (
                  <AvisoAccion onClick={cargar} className="text-error-rndc">
                    Reintentar
                  </AvisoAccion>
                ) : undefined
              }
            >
              {online ? error : 'Sin conexión, y este manifiesto no está guardado en el teléfono.'}
            </Aviso>
          )}
        </div>

        {!pdf && !error && (
          <div className="flex flex-col items-center gap-3 pt-16 text-muted">
            <IonSpinner name="crescent" />
            <span className="text-caption">{descargando ? 'Descargando manifiesto…' : 'Abriendo…'}</span>
          </div>
        )}

        {/* Scrolls sideways when zoomed in */}
        <div className="overflow-x-auto px-4 pt-3 pb-8">
          <div ref={pagesRef} className="flex w-max flex-col gap-3" />
        </div>
      </IonContent>
    </IonPage>
  );
};

export default ManifiestoDocumento;
