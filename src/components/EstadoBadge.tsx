import type { EstadoRndc } from '../services/operations.service';
import type { EstadoSobreanticipo } from '../services/sobreanticipos.service';

type Estado = 'creada' | 'manifiesto' | 'en_ruta' | 'cumplido' | 'activo' | 'inactivo';

// Full class names so Tailwind finds them ("Estados" in the design file)
const ESTADOS: Record<Estado, { label: string; className: string }> = {
  creada: { label: 'Creada', className: 'bg-creada-soft text-creada' },
  manifiesto: { label: 'Manifiesto', className: 'bg-manifiesto-soft text-manifiesto' },
  en_ruta: { label: 'En ruta', className: 'bg-en-ruta-soft text-en-ruta' },
  cumplido: { label: 'Cumplido', className: 'bg-cumplido-soft text-cumplido' },
  activo: { label: 'Activo', className: 'bg-activo-soft text-activo' },
  inactivo: { label: 'Anulado', className: 'bg-inactivo-soft text-inactivo' },
};

// `lista`: rows of the lists ("RNDC reportado"); `dato`: value of a detail row, whose label already says RNDC
const RNDC: Record<EstadoRndc, { lista: string; dato: string; dot: string }> = {
  reportado: { lista: 'RNDC reportado', dato: 'Reportado', dot: 'bg-rndc-reportado' },
  pendiente: { lista: 'RNDC pendiente', dato: 'Pendiente', dot: 'bg-rndc-pendiente' },
  error: { lista: 'Error RNDC', dato: 'Con error', dot: 'bg-error-rndc' },
};

// States in UPPERCASE inside the chip
const base = 'inline-flex shrink-0 items-center rounded-full px-2.5 py-[2px] text-badge whitespace-nowrap uppercase';

/** Operating status pill (remesa or manifiesto). */
export const EstadoBadge: React.FC<{ estado: Estado; label?: string }> = ({ estado, label }) => {
  const { label: defaultLabel, className } = ESTADOS[estado] ?? ESTADOS.creada;
  return <span className={`${base} ${className}`}>{label ?? defaultLabel}</span>;
};

/** RNDC sync state: colored dot + text. */
export const RndcEstado: React.FC<{ estado: EstadoRndc; label?: string; variante?: 'lista' | 'dato' }> = ({
  estado,
  label,
  variante = 'lista',
}) => {
  const rndc = RNDC[estado] ?? RNDC.pendiente;
  return (
    <span
      className={`inline-flex items-center gap-2 ${
        variante === 'dato' ? 'text-[15px] leading-[22px] font-semibold text-tinta' : 'text-[14px] leading-5 text-muted'
      }`}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${rndc.dot}`} aria-hidden="true" />
      {label ?? rndc[variante]}
    </span>
  );
};

// Same colors as the web: blue, amber, red, green, gray
const SOBREANTICIPO: Record<EstadoSobreanticipo, { label: string; className: string }> = {
  solicitada: { label: 'Pendiente de aprobación', className: 'bg-creada-soft text-creada' },
  aprobada: { label: 'Aprobada · por pagar', className: 'bg-en-ruta-soft text-en-ruta' },
  rechazada: { label: 'Rechazada', className: 'bg-error-rndc-soft text-error-rndc' },
  pagada: { label: 'Pagada', className: 'bg-cumplido-soft text-cumplido' },
  cancelada: { label: 'Cancelada', className: 'bg-inactivo-soft text-inactivo' },
};

/** State of a sobreanticipo request. */
export const SobreanticipoBadge: React.FC<{ estado: EstadoSobreanticipo }> = ({ estado }) => {
  const { label, className } = SOBREANTICIPO[estado] ?? SOBREANTICIPO.solicitada;
  return <span className={`${base} ${className}`}>{label}</span>;
};
