import { IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonModal, IonTitle, IonToolbar } from '@ionic/react';
import { useState } from 'react';
import { icons } from '../icons';
import type { Entrega } from '../services/cumplidos.service';
import { formatFechaHora, formatKg } from '../utils/format';
import { formatoCoordenadas } from '../offline/evidencia';

const RNDC_ENTREGA: Record<Entrega['rndc']['estado'], { label: string; className: string }> = {
  reportado: { label: 'Cumplido reportado al RNDC', className: 'text-cumplido' },
  error: { label: 'El RNDC rechazó el cumplido', className: 'text-error-rndc' },
  pendiente: { label: 'Cumplido RNDC pendiente', className: 'text-en-ruta' },
  no_aplica: { label: 'Se cumple en el RNDC con el manifiesto', className: 'text-muted' },
};

const Linea: React.FC<{ icon: string; children: React.ReactNode }> = ({ icon, children }) => (
  <p className="m-0 flex items-start gap-2 text-[14px] leading-5 text-tinta">
    <IonIcon icon={icon} className="mt-[2px] shrink-0 text-[16px] text-muted" aria-hidden="true" />
    <span className="min-w-0">{children}</span>
  </p>
);

/** Delivery evidence as registered: photos, who received it, where and when. */
const EntregaCard: React.FC<{ entrega: Entrega }> = ({ entrega: e }) => {
  const [foto, setFoto] = useState<string | null>(null);
  const { latitud, longitud, precisionMetros } = e.ubicacion;
  const rndc = RNDC_ENTREGA[e.rndc.estado] ?? RNDC_ENTREGA.pendiente;

  return (
    <div className="rounded-2xl border border-divider p-4">
      {e.fotos.length > 0 && (
        <div className="mb-3 flex gap-2 overflow-x-auto">
          {e.fotos.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => setFoto(url)}
              aria-label={`Ver foto ${i + 1}`}
              className="h-20 w-20 shrink-0 cursor-pointer overflow-hidden rounded-xl border-0 bg-superficie p-0"
            >
              <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-2">
        <Linea icon={icons.user}>
          Recibió <span className="font-medium">{e.recibidoPor.nombre}</span>
          {e.recibidoPor.documento && <span className="text-muted"> · {e.recibidoPor.documento}</span>}
        </Linea>
        <Linea icon={icons.package}>{formatKg(e.cantidadEntregadaKg)} entregados</Linea>
        <Linea icon={icons.clock}>
          {formatFechaHora(e.capturadoEn)}
          {e.registradoPor && <span className="text-muted"> · {e.registradoPor}</span>}
        </Linea>
        <Linea icon={icons.mapPin}>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${latitud},${longitud}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-petroleo no-underline"
          >
            {formatoCoordenadas({ latitud, longitud })}
          </a>
          {precisionMetros !== null && <span className="text-muted"> · ±{Math.round(precisionMetros)} m</span>}
        </Linea>
        {e.observaciones && <Linea icon={icons.alignJustified}>{e.observaciones}</Linea>}
        <p className={`m-0 text-[13px] leading-[18px] font-medium ${rndc.className}`}>{rndc.label}</p>
        {e.rndc.estado !== 'reportado' && e.rndc.mensaje && (
          <p className="m-0 text-[13px] leading-[18px] break-words text-muted">{e.rndc.mensaje}</p>
        )}
      </div>

      <IonModal isOpen={!!foto} onDidDismiss={() => setFoto(null)}>
        <IonHeader>
          <IonToolbar className="app-toolbar">
            <IonTitle>Foto de la entrega</IonTitle>
            <IonButtons slot="end">
              <IonButton aria-label="Cerrar" onClick={() => setFoto(null)}>
                <IonIcon slot="icon-only" icon={icons.x} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          {foto && <img src={foto} alt="Foto de la entrega" className="block w-full" />}
        </IonContent>
      </IonModal>
    </div>
  );
};

export default EntregaCard;
