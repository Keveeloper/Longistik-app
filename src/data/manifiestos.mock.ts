import type { RndcEstado } from '../components/RndcStatus';

export interface Manifiesto {
  numero: string;
  origen: string;
  destino: string;
  placa: string;
  /** ISO date (YYYY-MM-DD) */
  fecha: string;
  /** Freight value in COP */
  valor: number;
  estado: 'activo' | 'inactivo';
  rndc: RndcEstado;
}

// TODO: replace with the manifiestos API once the backend exists
export const manifiestosMock: Manifiesto[] = [
  { numero: 'MT000662', origen: 'Puerto Tejada', destino: 'Villa Rica', placa: 'WGK482', fecha: '2026-08-22', valor: 800000, estado: 'inactivo', rndc: 'reportado' },
  { numero: 'MT000661', origen: 'Villa Rica', destino: 'Santiago de Cali', placa: 'SXT915', fecha: '2026-08-22', valor: 720000, estado: 'activo', rndc: 'reportado' },
  { numero: 'MT000660', origen: 'Villa Rica', destino: 'Santiago de Cali', placa: 'TPL207', fecha: '2026-08-22', valor: 720000, estado: 'inactivo', rndc: 'reportado' },
  { numero: 'MT000659', origen: 'Villa Rica', destino: 'Santiago de Cali', placa: 'WGK482', fecha: '2026-08-22', valor: 720000, estado: 'activo', rndc: 'pendiente' },
  { numero: 'MT000658', origen: 'Palmira', destino: 'Villa Rica', placa: 'SXT915', fecha: '2026-08-19', valor: 1100000, estado: 'inactivo', rndc: 'reportado' },
  { numero: 'MT000657', origen: 'Palmira', destino: 'Buenaventura', placa: 'KRD330', fecha: '2026-08-19', valor: 1350000, estado: 'activo', rndc: 'reportado' },
  { numero: 'MT000656', origen: 'Santiago de Cali', destino: 'Buenaventura', placa: 'TPL207', fecha: '2026-08-18', valor: 1250000, estado: 'inactivo', rndc: 'reportado' },
  { numero: 'MT000655', origen: 'Jamundí', destino: 'Puerto Tejada', placa: 'KRD330', fecha: '2026-08-18', valor: 650000, estado: 'activo', rndc: 'pendiente' },
  { numero: 'MT000654', origen: 'Yumbo', destino: 'Santiago de Cali', placa: 'WGK482', fecha: '2026-08-17', valor: 480000, estado: 'inactivo', rndc: 'reportado' },
  { numero: 'MT000653', origen: 'Santiago de Cali', destino: 'Tuluá', placa: 'SXT915', fecha: '2026-08-16', valor: 980000, estado: 'inactivo', rndc: 'reportado' },
];
