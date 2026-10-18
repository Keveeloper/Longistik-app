import type { RndcEstado } from '../components/RndcStatus';
import { isoDateDaysAgo } from '../utils/format';

export interface Remesa {
  numero: string;
  cliente: string;
  nit: string;
  /** ISO date (YYYY-MM-DD) */
  fecha: string;
  estado: 'creada' | 'manifiesto' | 'en-ruta' | 'cumplido';
  rndc: RndcEstado;
  /** RNDC consecutive number once the remesa is fulfilled ("cumplida") */
  consecutivoCumplido?: string;
}

// TODO: replace with the remesas API once the backend exists.
// Dates are relative to today so the "Hoy" group always shows.
export const remesasMock: Remesa[] = [
  { numero: 'RM0001956', cliente: 'Distrimotos del Pacífico', nit: '900456123-4', fecha: isoDateDaysAgo(0), estado: 'cumplido', rndc: 'reportado', consecutivoCumplido: '141883793' },
  { numero: 'RM0001955', cliente: 'Distrimotos del Pacífico', nit: '900456123-4', fecha: isoDateDaysAgo(0), estado: 'manifiesto', rndc: 'reportado' },
  { numero: 'RM0001954', cliente: 'Agrocomercial del Valle', nit: '805012345-6', fecha: isoDateDaysAgo(0), estado: 'cumplido', rndc: 'reportado', consecutivoCumplido: '141888215' },
  { numero: 'RM0001953', cliente: 'Ferretería Andina S.A.', nit: '890321654-2', fecha: isoDateDaysAgo(1), estado: 'creada', rndc: 'pendiente' },
  { numero: 'RM0001952', cliente: 'Importadora Pacífico Ltda', nit: '901234567-8', fecha: isoDateDaysAgo(1), estado: 'en-ruta', rndc: 'reportado' },
  { numero: 'RM0001951', cliente: 'Ferretería Andina S.A.', nit: '890321654-2', fecha: isoDateDaysAgo(1), estado: 'creada', rndc: 'pendiente' },
  { numero: 'RM0001950', cliente: 'Agrocomercial del Valle', nit: '805012345-6', fecha: isoDateDaysAgo(2), estado: 'creada', rndc: 'pendiente' },
  { numero: 'RM0001949', cliente: 'Lácteos del Cauca S.A.S.', nit: '817004321-9', fecha: isoDateDaysAgo(2), estado: 'en-ruta', rndc: 'reportado' },
  { numero: 'RM0001948', cliente: 'Importadora Pacífico Ltda', nit: '901234567-8', fecha: isoDateDaysAgo(2), estado: 'cumplido', rndc: 'reportado', consecutivoCumplido: '141876502' },
];
