import { IonIcon } from '@ionic/react';
import type { ReactNode } from 'react';
import { icons } from '../icons';
import { formatFechaHora } from '../utils/format';

type Tono = 'info' | 'warning' | 'error' | 'success';

const TONOS: Record<Tono, { box: string; icon: string; text: string }> = {
  info: { box: 'bg-superficie', icon: icons.infoCircle, text: 'text-tinta' },
  warning: { box: 'bg-rndc-pendiente-soft', icon: icons.alertTriangle, text: 'text-en-ruta' },
  error: { box: 'bg-error-rndc-soft', icon: icons.alertCircle, text: 'text-error-rndc' },
  success: { box: 'bg-cumplido-soft', icon: icons.circleCheck, text: 'text-cumplido' },
};

/** Rounded callout with an icon: gray = information, green = success, orange = pending, red = error. */
export const Aviso: React.FC<{ tono?: Tono; icon?: string; children: ReactNode; action?: ReactNode; className?: string }> = ({
  tono = 'info',
  icon,
  children,
  action,
  className = '',
}) => {
  const t = TONOS[tono];
  return (
    <div role={tono === 'error' ? 'alert' : undefined} className={`flex items-start gap-3 rounded-[20px] px-[18px] py-3.5 ${t.box} ${className}`}>
      <IonIcon
        icon={icon ?? t.icon}
        className={`mt-[1px] shrink-0 text-[20px] ${tono === 'info' ? 'text-muted' : t.text}`}
        aria-hidden="true"
      />
      <div className={`min-w-0 flex-1 text-[15px] leading-[21px] ${t.text}`}>{children}</div>
      {action}
    </div>
  );
};

/** Text button for callouts ("Reintentar", "Descartar"). */
export const AvisoAccion: React.FC<{ onClick: () => void; children: ReactNode; className?: string }> = ({
  onClick,
  children,
  className = 'text-tinta',
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`shrink-0 cursor-pointer border-0 bg-transparent p-0 text-[14px] leading-5 font-semibold ${className}`}
  >
    {children}
  </button>
);

/** Shown when a screen falls back to the copy saved on the phone. */
export const AvisoSinConexion: React.FC<{ guardadoEn: string | null; error: string | null; onRetry: () => void }> = ({
  guardadoEn,
  error,
  onRetry,
}) => {
  if (!error) return null;
  if (guardadoEn) {
    return (
      <Aviso icon={icons.wifiOff} action={<AvisoAccion onClick={onRetry}>Reintentar</AvisoAccion>}>
        Sin conexión. Datos guardados el {formatFechaHora(guardadoEn)}.
      </Aviso>
    );
  }
  return (
    <Aviso tono="error" action={<AvisoAccion onClick={onRetry} className="text-error-rndc">Reintentar</AvisoAccion>}>
      {error}
    </Aviso>
  );
};
