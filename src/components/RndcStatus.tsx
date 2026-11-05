export type RndcEstado = 'reportado' | 'pendiente';

interface RndcStatusProps {
  estado: RndcEstado;
  /** Overrides the default text ("RNDC reportado" / "Pendiente RNDC") */
  label?: string;
}

/** Dot + label showing whether a document was reported to the RNDC. */
const RndcStatus: React.FC<RndcStatusProps> = ({ estado, label }) => (
  <span className="inline-flex items-center gap-1.75">
    <span
      aria-hidden="true"
      className={`h-1.75 w-1.75 shrink-0 rounded-full ${estado === 'reportado' ? 'bg-rndc-reportado' : 'bg-rndc-pendiente'}`}
    />
    {label ?? (estado === 'reportado' ? 'RNDC reportado' : 'Pendiente RNDC')}
  </span>
);

export default RndcStatus;
