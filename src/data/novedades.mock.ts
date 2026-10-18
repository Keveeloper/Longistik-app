import { isoDateTimeMinutesAgo } from '../utils/format';

export interface Novedad {
  id: string;
  /** Kind of incident, e.g. "Bloqueo vial" */
  tipo: string;
  manifiesto: string;
  origen: string;
  destino: string;
  descripcion: string;
  /** ISO date-time when it was reported */
  reportadaEn: string;
  estado: 'abierta' | 'en-gestion' | 'cerrada';
  fotos: number;
  ubicacion: boolean;
  /** Team handling it (en gestión) */
  asignadaA?: string;
  /** Who closed it (cerrada) */
  resueltaPor?: string;
}

// TODO: replace with the novedades API once the backend exists.
// Times are relative to now so "Hace 25 min" stays realistic.
export const novedadesMock: Novedad[] = [
  {
    id: 'NV-0418', tipo: 'Bloqueo vial', manifiesto: 'MT000661', origen: 'Villa Rica', destino: 'Cali',
    descripcion: 'Protesta en la vía Panamericana a la altura de Jamundí. Vehículo detenido.',
    reportadaEn: isoDateTimeMinutesAgo(25), estado: 'abierta', fotos: 1, ubicacion: true,
  },
  {
    id: 'NV-0417', tipo: 'Falla mecánica', manifiesto: 'MT000659', origen: 'Villa Rica', destino: 'Cali',
    descripcion: 'Pinchazo en llanta trasera. Se espera reanudar en 40 minutos.',
    reportadaEn: isoDateTimeMinutesAgo(125), estado: 'en-gestion', fotos: 0, ubicacion: false, asignadaA: 'Despachos',
  },
  {
    id: 'NV-0416', tipo: 'Retraso en cargue', manifiesto: 'MT000658', origen: 'Palmira', destino: 'Villa Rica',
    descripcion: 'Demora de 3 horas en la bodega del cliente por falta de personal de cargue.',
    reportadaEn: isoDateTimeMinutesAgo(60 * 26), estado: 'cerrada', fotos: 2, ubicacion: true, resueltaPor: 'Despachos',
  },
  {
    id: 'NV-0415', tipo: 'Control de tránsito', manifiesto: 'MT000655', origen: 'Jamundí', destino: 'Puerto Tejada',
    descripcion: 'Revisión de documentos en retén de la Policía. Continúa sin novedad.',
    reportadaEn: isoDateTimeMinutesAgo(60 * 50), estado: 'cerrada', fotos: 0, ubicacion: true, resueltaPor: 'el conductor',
  },
];
