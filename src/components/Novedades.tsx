import { IonIcon, IonRippleEffect } from '@ionic/react';
import { icons } from '../icons';
import type { EstadoNovedad, Novedad } from '../services/novedades.service';
import type { NovedadEnCola } from '../store/novedadesCola.store';
import { ciudad, formatTimeAgo, tipoOracion } from '../utils/format';
import { NovedadBadge } from './EstadoBadge';

// Full class names so Tailwind can detect them
const ICONO: Record<EstadoNovedad | 'cola', string> = {
  abierta: 'bg-en-ruta-soft text-en-ruta',
  en_gestion: 'bg-creada-soft text-creada',
  cerrada: 'bg-cumplido-soft text-cumplido',
  cola: 'bg-rndc-pendiente-soft text-en-ruta',
};

/** Line next to the badge: who handles it, who closed it or who reported it. */
const pieNovedad = (n: Novedad) => {
  if (n.estado === 'cerrada' && n.cerradaPor) return `Cerrada por ${tipoOracion(n.cerradaPor.nombre)}`;
  if (n.estado === 'en_gestion' && n.gestionadaPor) return `Asignada a ${tipoOracion(n.gestionadaPor.nombre)}`;
  return n.reportadaPor ? `Reportó ${tipoOracion(n.reportadaPor.nombre)}` : '';
};

const Tarjeta: React.FC<{
  estado: EstadoNovedad | 'cola';
  critica?: boolean;
  titulo: string;
  hace: string;
  linea: string;
  descripcion: string;
  pie: React.ReactNode;
  onClick: () => void;
}> = ({ estado, critica, titulo, hace, linea, descripcion, pie, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="novedad-fila ion-activatable relative flex w-full cursor-pointer items-start gap-3.5 overflow-hidden border-0 border-b border-solid border-divider bg-white px-5 py-4 text-left"
  >
    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${critica && estado !== 'cerrada' ? 'bg-error-rndc-soft text-error-rndc' : ICONO[estado]}`}>
      <IonIcon icon={estado === 'cola' ? icons.cloudUpload : icons.alertTriangle} className="text-[22px]" aria-hidden="true" />
    </span>
    <span className="min-w-0 flex-1">
      <span className="flex items-start justify-between gap-3">
        <span className="truncate text-[16px] leading-5 font-semibold text-tinta">{titulo}</span>
        <span className="shrink-0 text-[13px] leading-[15px] text-muted">{hace}</span>
      </span>
      <span className="mt-[3px] block truncate text-[14px] leading-5 text-muted">{linea}</span>
      <span className="mt-1 line-clamp-3 block text-[15px] leading-5 text-tinta">{descripcion}</span>
      <span className="mt-[11px] flex items-center gap-2">{pie}</span>
    </span>
    <IonRippleEffect />
  </button>
);

/** Row of a novedad (Novedades tab and manifiesto detail). */
export const NovedadFila: React.FC<{ novedad: Novedad; onClick: () => void; /** Hide the manifiesto (inside its detail) */ sinManifiesto?: boolean }> = ({
  novedad: n,
  onClick,
  sinManifiesto,
}) => {
  const ruta = [ciudad(n.manifiesto.origen), ciudad(n.manifiesto.destino)].filter(Boolean).join(' → ');
  const linea = sinManifiesto
    ? [n.remesa?.numero, n.reportadaPor && tipoOracion(n.reportadaPor.nombre)].filter(Boolean).join(' · ') || 'Sin remesa'
    : [n.manifiesto.numero, ruta].filter(Boolean).join(' · ');
  const pie = pieNovedad(n);
  return (
    <Tarjeta
      estado={n.estado}
      critica={n.critica}
      titulo={n.tipo.nombre}
      hace={formatTimeAgo(n.capturadaEn)}
      linea={linea}
      descripcion={n.descripcion}
      onClick={onClick}
      pie={
        <>
          <NovedadBadge estado={n.estado} />
          {pie && <span className="truncate text-[13px] leading-5 text-muted">{pie}</span>}
        </>
      }
    />
  );
};

/** Row of a novedad still on the phone: waiting for signal, or refused by the backend. */
export const NovedadEnColaFila: React.FC<{ item: NovedadEnCola; onClick: () => void }> = ({ item, onClick }) => {
  const { tipoNombre, manifiestoNumero, origen, destino } = item.resumen;
  const rechazada = item.estado === 'rechazado';
  return (
    <Tarjeta
      estado="cola"
      titulo={tipoNombre}
      hace={formatTimeAgo(item.datos.capturadaEn)}
      linea={[manifiestoNumero, [origen, destino].filter(Boolean).join(' → ')].filter(Boolean).join(' · ')}
      descripcion={item.datos.descripcion}
      onClick={onClick}
      pie={
        <>
          <NovedadBadge estado={rechazada ? 'rechazada' : 'pendiente_envio'} />
          <span className="truncate text-[13px] leading-5 text-muted">
            {rechazada ? (item.ultimoError ?? 'El servidor no la aceptó') : item.estado === 'enviando' ? 'Enviando…' : 'Se enviará sola con señal'}
          </span>
        </>
      }
    />
  );
};
