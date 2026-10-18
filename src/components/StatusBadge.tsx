import { IonBadge } from '@ionic/react';

export type Estado = 'creada' | 'manifiesto' | 'en-ruta' | 'cumplido' | 'activo' | 'inactivo' | 'error-rndc';

// Full class names so Tailwind can detect them
const estadoClasses: Record<Estado, string> = {
  creada: 'bg-creada-soft text-creada',
  manifiesto: 'bg-manifiesto-soft text-manifiesto',
  'en-ruta': 'bg-en-ruta-soft text-en-ruta',
  cumplido: 'bg-cumplido-soft text-cumplido',
  activo: 'bg-activo-soft text-activo',
  inactivo: 'bg-inactivo-soft text-inactivo',
  'error-rndc': 'bg-error-rndc-soft text-error-rndc',
};

const estadoLabels: Record<Estado, string> = {
  creada: 'Creada',
  manifiesto: 'Manifiesto',
  'en-ruta': 'En ruta',
  cumplido: 'Cumplido',
  activo: 'Activo',
  inactivo: 'Inactivo',
  'error-rndc': 'Error RNDC',
};

/**
 * Status pill from the "Estados" section of the visual system.
 * Classes on the IonBadge host win over its internal :host styles.
 */
const StatusBadge: React.FC<{ estado: Estado; className?: string }> = ({ estado, className = '' }) => (
  <IonBadge
    className={`rounded-full px-2 py-0.75 text-badge leading-3.25 uppercase ${estadoClasses[estado]} ${className}`}
  >
    {estadoLabels[estado]}
  </IonBadge>
);

export default StatusBadge;
