import { IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonModal, IonTitle, IonToolbar } from '@ionic/react';
import { useState } from 'react';
import { icons } from '../icons';
import type { Entrega } from '../services/cumplidos.service';
import { formatFechaHora, formatKg, tipoOracion } from '../utils/format';
import { formatoCoordenadas } from '../offline/evidencia';

// Only what the callouts of the remesa don't already say ("Cumplida en el RNDC", "Remesa municipal")
const RNDC_ENTREGA: Partial<Record<Entrega['rndc']['estado'], { label: string; className: string }>> = {
  error: { label: 'El RNDC rechazó el cumplido', className: 'text-error-rndc' },
  pendiente: { label: 'Cumplido RNDC pendiente', className: 'text-en-ruta' },
};

const Linea: React.FC<{ icon: string; children: React.ReactNode }> = ({ icon, children }) => (
  <p className="m-0 flex items-start gap-2 text-[15px] leading-5 text-tinta">
    <IonIcon icon={icon} className="mt-[2px] shrink-0 text-[17px] text-muted" aria-hidden="true" />
    <span className="min-w-0">{children}</span>
  </p>
);

/** Delivery evidence as registered: photos, who received it, where and when. */
const EntregaCard: React.FC<{ entrega: Entrega; /** The remesa's weight, to say "completos" */ pesoKg?: number }> = ({
  entrega: e,
  pesoKg,
}) => {
  const [foto, setFoto] = useState<string | null>(null);
  const { latitud, longitud, precisionMetros } = e.ubicacion;
  const rndc = RNDC_ENTREGA[e.rndc.estado];
  const completa = pesoKg !== undefined && pesoKg > 0 && e.cantidadEntregadaKg >= pesoKg;

  const miniatura = (url: string, i: number, className: string) => (
    <button
      key={url}
      type="button"
      onClick={() => setFoto(url)}
      aria-label={`Ver foto ${i + 1}`}
      className={`shrink-0 cursor-pointer overflow-hidden rounded-xl border-0 bg-superficie p-0 ${className}`}
    >
      <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
    </button>
  );

  return (
    <div className="rounded-3xl bg-cumplido-soft p-4 pt-5">
      <div className="flex items-center gap-3 px-1">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-verde">
          <IonIcon icon={icons.check} className="text-[22px] text-white" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="m-0 text-[18px] leading-6 font-semibold text-tinta">Entregada</p>
          <p className="m-0 text-[14px] leading-5 text-cumplido">
            {formatFechaHora(e.capturadoEn)}
            {e.registradoPor && ` · registró ${tipoOracion(e.registradoPor)}`}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-white p-3">
        <div className="flex items-center gap-3">
          {e.fotos[0] && miniatura(e.fotos[0], 0, 'h-[84px] w-[84px]')}
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Linea icon={icons.user}>
              <span className="sr-only">Recibió </span>
              <span className="font-semibold">{tipoOracion(e.recibidoPor.nombre)}</span>
              {e.recibidoPor.documento && ` · ${e.recibidoPor.documento}`}
            </Linea>
            <Linea icon={icons.package}>
              {formatKg(e.cantidadEntregadaKg)} entregados{completa ? ' completos' : ''}
            </Linea>
            <Linea icon={icons.mapPin}>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${latitud},${longitud}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-tinta no-underline"
              >
                {formatoCoordenadas({ latitud, longitud })}
              </a>
              {precisionMetros !== null && ` · ±${Math.round(precisionMetros)} m`}
            </Linea>
          </div>
        </div>
        {e.fotos.length > 1 && (
          <div className="mt-3 flex gap-2 overflow-x-auto">{e.fotos.slice(1).map((url, i) => miniatura(url, i + 1, 'h-14 w-14'))}</div>
        )}
        {e.observaciones && (
          <div className="mt-3">
            <Linea icon={icons.alignJustified}>{e.observaciones}</Linea>
          </div>
        )}
      </div>

      {rndc && (
        <div className="mt-3 px-1">
          <p className={`m-0 text-[14px] leading-5 font-medium ${rndc.className}`}>{rndc.label}</p>
          {e.rndc.mensaje && <p className="m-0 text-[14px] leading-5 break-words text-muted">{e.rndc.mensaje}</p>}
        </div>
      )}

      <IonModal isOpen={!!foto} onDidDismiss={() => setFoto(null)}>
        <IonHeader className="ion-no-border">
          <IonToolbar className="app-toolbar">
            <IonTitle>Foto de la entrega</IonTitle>
            <IonButtons slot="end">
              <IonButton aria-label="Cerrar" onClick={() => setFoto(null)}>
                <IonIcon slot="icon-only" icon={icons.x} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>{foto && <img src={foto} alt="Foto de la entrega" className="block w-full" />}</IonContent>
      </IonModal>
    </div>
  );
};

export default EntregaCard;
