import { IonIcon, IonRippleEffect } from '@ionic/react';
import type { ReactNode } from 'react';
import { icons } from '../icons';

/* Pieces shared by the list and detail screens, so they all look like one app */

/** Round gray icon at the start of a list row. */
export const IconoCirculo: React.FC<{ icon: string; className?: string }> = ({ icon, className = 'h-11 w-11' }) => (
  <span className={`flex shrink-0 items-center justify-center rounded-full bg-superficie text-tinta ${className}`}>
    <IonIcon icon={icon} className="text-[22px]" aria-hidden="true" />
  </span>
);

/** Flat list row: round icon, content and a 1px divider; no card or border. */
export const FilaLista: React.FC<{
  icon: string;
  onClick: () => void;
  children: ReactNode;
  /** Chevron at the end (rows inside a detail) */
  chevron?: boolean;
  className?: string;
}> = ({ icon, onClick, children, chevron, className = 'px-5 py-3' }) => (
  <button
    type="button"
    onClick={onClick}
    className={`ion-activatable relative flex w-full cursor-pointer items-center gap-3.5 overflow-hidden border-0 border-b border-solid border-divider bg-white text-left ${className}`}
  >
    <IconoCirculo icon={icon} />
    <div className="min-w-0 flex-1">{children}</div>
    {chevron && <IonIcon icon={icons.chevronRight} className="shrink-0 text-[20px] text-muted" aria-hidden="true" />}
    <IonRippleEffect />
  </button>
);

/** 8px gray band between the sections of a detail. */
export const Franja: React.FC = () => <div className="h-2 bg-superficie" aria-hidden="true" />;

/** Detail section: gray band on top, then the title ("Remesas · 1") and an optional note on the right. */
export const Seccion: React.FC<{
  title: string;
  count?: number;
  end?: ReactNode;
  children: ReactNode;
  id?: string;
}> = ({ title, count, end, children, id }) => (
  <section id={id}>
    <Franja />
    <div className="px-5 pt-5 pb-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="m-0 text-[20px] leading-7 font-semibold text-tinta">
          {title}
          {count !== undefined && <span className="font-normal text-muted"> · {count}</span>}
        </h2>
        {end && <span className="shrink-0 text-[14px] leading-5 text-muted">{end}</span>}
      </div>
      {children}
    </div>
  </section>
);

/** Label–value row of a detail. */
export const Dato: React.FC<{ label: string; children: ReactNode }> = ({ label, children }) => (
  <div className="flex items-center justify-between gap-4 border-0 border-b border-solid border-divider py-3 last:border-b-0">
    <span className="shrink-0 text-[15px] leading-[22px] text-muted">{label}</span>
    <span className="min-w-0 text-right text-[15px] leading-[22px] font-semibold text-tinta">{children}</span>
  </div>
);

/** Top of a detail: small label ("Manifiesto MT000469"), large title and the state with its data. */
export const DetalleTitulo: React.FC<{ eyebrow: string; title: ReactNode; badge?: ReactNode; meta?: ReactNode }> = ({
  eyebrow,
  title,
  badge,
  meta,
}) => (
  <div>
    <p className="m-0 text-[14px] leading-5 text-muted">{eyebrow}</p>
    <h1 className="mt-2 mb-0 text-[34px] leading-9 tracking-[-0.5px] text-tinta">{title}</h1>
    {(badge || meta) && (
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        {badge}
        {meta && <span className="text-[15px] leading-[22px] text-muted">{meta}</span>}
      </div>
    )}
  </div>
);
