import { IonIcon, IonSpinner, useIonAlert } from '@ionic/react';
import { colaDeSesion, descartarCumplido, sincronizarCumplidos } from '../offline/cumplidos';
import { useOnline } from '../hooks/useOnline';
import { icons } from '../icons';
import { useCumplidosQueue, type CumplidoEnCola } from '../store/cumplidosQueue.store';
import { formatFechaHora } from '../utils/format';
import { AvisoAccion } from './Avisos';

const Fila: React.FC<{ item: CumplidoEnCola }> = ({ item }) => {
  const [presentAlert] = useIonAlert();

  const descartar = () =>
    presentAlert({
      header: 'Descartar entrega',
      message: `Se borrarán del teléfono las fotos y los datos de la entrega de ${item.remesaNumero}.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Descartar', role: 'destructive', handler: () => descartarCumplido(item.id) },
      ],
    });

  return (
    <li className="flex items-start gap-3 py-2">
      {item.estado === 'enviando' ? (
        <IonSpinner name="crescent" className="mt-[1px] h-5 w-5 shrink-0 text-tinta" />
      ) : (
        <IonIcon
          icon={item.estado === 'rechazado' ? icons.alertCircle : icons.cloudUpload}
          className={`mt-[1px] shrink-0 text-[20px] ${item.estado === 'rechazado' ? 'text-error-rndc' : 'text-en-ruta'}`}
          aria-hidden="true"
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="m-0 text-[14px] leading-5 font-medium text-tinta">
          {item.remesaNumero} · {formatFechaHora(item.creadoEn)}
        </p>
        <p className={`m-0 text-[13px] leading-[18px] ${item.estado === 'rechazado' ? 'text-error-rndc' : 'text-muted'}`}>
          {item.estado === 'enviando'
            ? 'Enviando…'
            : item.estado === 'rechazado'
              ? item.ultimoError
              : (item.ultimoError ?? 'Esperando señal para enviarse')}
        </p>
      </div>
      {item.estado === 'rechazado' && (
        <AvisoAccion onClick={descartar} className="text-error-rndc">
          Descartar
        </AvisoAccion>
      )}
    </li>
  );
};

/** Deliveries saved on the phone that haven't reached the backend yet. Hidden when there are none. */
const ColaCumplidos: React.FC = () => {
  const cola = useCumplidosQueue((s) => s.cola);
  const online = useOnline();
  const items = colaDeSesion(cola);
  if (!items.length) return null;
  const pendientes = items.filter((c) => c.estado !== 'rechazado').length;

  return (
    <div className="rounded-2xl bg-rndc-pendiente-soft px-4 pt-3 pb-1">
      <div className="flex items-center justify-between gap-3">
        <p className="m-0 text-[15px] leading-5 font-medium text-tinta">
          {pendientes === 1
            ? '1 entrega guardada en el teléfono'
            : pendientes
              ? `${pendientes} entregas guardadas en el teléfono`
              : 'Entregas no aceptadas'}
        </p>
        {pendientes > 0 && online && (
          <AvisoAccion onClick={() => sincronizarCumplidos()} className="text-en-ruta">
            Enviar ahora
          </AvisoAccion>
        )}
      </div>
      <ul className="m-0 list-none p-0">
        {items.map((item) => (
          <Fila key={item.id} item={item} />
        ))}
      </ul>
    </div>
  );
};

export default ColaCumplidos;
