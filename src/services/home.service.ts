import { api } from '../api/client';

/** `GET /mobile/home/summary`. Figures are company-wide; "hoy" and "mes" in Colombian time. */
export interface HomeSummary {
  /** YYYY-MM-DD */
  date: string;
  /** Created today, excluding voided ones */
  remesasHoy: number;
  /** Dispatched today (or created today when there's no dispatch date), excluding voided ones */
  manifiestosDespachadosHoy: number;
  /** Not reported to the RNDC yet (pending or rejected), any date */
  remesasPendientesRndc: number;
  /** Current month */
  rndc: { reportadas: number; total: number };
  /** Open and not voided */
  manifiestosActivos: number;
  /** Always 0 until the backend has notifications */
  notificacionesSinLeer: number;
}

export const homeService = {
  async summary(): Promise<HomeSummary> {
    const { data } = await api.get<HomeSummary>('/mobile/home/summary');
    return data;
  },
};
