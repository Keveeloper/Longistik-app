import type { TiemposCumplido, Ventana } from '../services/cumplidos.service';
import { mostrarHoraLocal } from '../utils/tiempos';

const CAMPOS: { key: keyof Ventana; label: string }[] = [
  { key: 'llegada', label: 'Llegada' },
  { key: 'entrada', label: 'Entrada' },
  { key: 'salida', label: 'Salida' },
];

const VENTANAS: { key: keyof TiemposCumplido; label: string }[] = [
  { key: 'cargue', label: 'Cargue' },
  { key: 'descargue', label: 'Descargue' },
];

/** Read-only summary: "Cargue 20 oct, 7:21 → 7:30 (entrada 7:25)". */
export const TiemposResumen: React.FC<{ tiempos: TiemposCumplido }> = ({ tiempos }) => (
  <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[14px] leading-5">
    {VENTANAS.map(({ key, label }) => (
      <div key={key} className="contents">
        <dt className="text-muted">{label}</dt>
        <dd className="m-0 text-tinta">
          {mostrarHoraLocal(tiempos[key].llegada)} → {mostrarHoraLocal(tiempos[key].salida).split(', ')[1]}
          <span className="text-muted"> · entrada {mostrarHoraLocal(tiempos[key].entrada).split(', ')[1]}</span>
        </dd>
      </div>
    ))}
  </dl>
);

/** Six date-time fields (native pickers), Colombian local time. */
export const TiemposEditor: React.FC<{ value: TiemposCumplido; onChange: (t: TiemposCumplido) => void }> = ({ value, onChange }) => (
  <div className="flex flex-col gap-4">
    {VENTANAS.map(({ key, label }) => (
      <fieldset key={key} className="m-0 border-0 p-0">
        <legend className="mb-2 p-0 text-[14px] leading-5 font-medium text-tinta">{label}</legend>
        <div className="flex flex-col gap-2">
          {CAMPOS.map((campo) => (
            <label key={campo.key} className="flex items-center justify-between gap-3">
              <span className="text-[14px] leading-5 text-muted">{campo.label}</span>
              <input
                type="datetime-local"
                value={value[key][campo.key]}
                onChange={(e) => onChange({ ...value, [key]: { ...value[key], [campo.key]: e.target.value } })}
                className="min-w-0 rounded-xl border border-solid border-line bg-white px-3 py-2 font-sans text-[15px] text-tinta"
              />
            </label>
          ))}
        </div>
      </fieldset>
    ))}
  </div>
);
