import { IonIcon, IonSpinner } from '@ionic/react';
import { icons } from '../icons';

/**
 * Grid of stamped photos (JPEG base64) with "Tomar foto" / "Otra foto" at the end, as in
 * "Cumplir remesa" and "Reportar novedad". Taking the photo is the caller's job.
 */
const FotosEvidencia: React.FC<{
  fotos: string[];
  max: number;
  tomando: boolean;
  disabled?: boolean;
  onTomar: () => void;
  onQuitar: (index: number) => void;
}> = ({ fotos, max, tomando, disabled, onTomar, onQuitar }) => (
  <div className="grid grid-cols-3 gap-2">
    {fotos.map((base64, i) => (
      <div key={i} className="relative aspect-square overflow-hidden rounded-2xl bg-superficie">
        <img src={`data:image/jpeg;base64,${base64}`} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
        <button
          type="button"
          aria-label={`Quitar foto ${i + 1}`}
          onClick={() => onQuitar(i)}
          className="absolute top-1 right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-0 bg-tinta/80 p-0 text-white"
        >
          <IonIcon icon={icons.x} className="text-[16px]" />
        </button>
      </div>
    ))}
    {fotos.length < max && (
      <button
        type="button"
        onClick={onTomar}
        disabled={disabled || tomando}
        className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-[#c5ced3] bg-white p-0 text-tinta disabled:cursor-default disabled:opacity-50"
      >
        {tomando ? <IonSpinner name="crescent" /> : <IonIcon icon={icons.camera} className="text-[24px]" />}
        <span className="text-[14px] leading-[18px] font-semibold">{fotos.length ? 'Otra foto' : 'Tomar foto'}</span>
      </button>
    )}
  </div>
);

export default FotosEvidencia;
