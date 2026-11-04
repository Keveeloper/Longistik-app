import axios from 'axios';
import { isCompanyAllowed } from '../config/env';

/** Company as returned by the panel's public directory. */
export interface Company {
  /** Stable identifier: the one to persist to remember the choice. */
  code: string;
  name: string;
  /** Base URL of the company's own Longistik backend (login and every other call). Use it as-is. */
  apiUrl: string;
  /** Company's Longistik web (password recovery, support links). */
  webUrl: string;
}

/*
 * The panel's CORS only allows its own web, so the browser dev server goes through
 * the Vite proxy (`/panel-api`, see vite.config.ts); native builds call it directly
 * (CapacitorHttp bypasses CORS). VITE_PANEL_API_URL overrides both.
 */
const PANEL_URL =
  import.meta.env.VITE_PANEL_API_URL || (import.meta.env.DEV ? '/panel-api' : 'https://api.panel.longistik.com');

// Public endpoint: no auth, so it doesn't go through the session-aware `api` client
const panel = axios.create({ baseURL: PANEL_URL, timeout: 15000 });

/** Lowercase without accents, so "logistica" matches "Logística". */
export const normalize = (text: string) =>
  text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export const matchesCompany = (company: Company, query: string) => {
  const q = normalize(query);
  return !q || normalize(company.code).includes(q) || normalize(company.name).includes(q);
};

// The panel answers with `Cache-Control: max-age=300`: reuse the full list for 5 minutes
const CACHE_MS = 5 * 60 * 1000;
let cache: { at: number; companies: Company[] } | null = null;

const fetchAll = async (): Promise<Company[]> => {
  try {
    const { data } = await panel.get<{ companies: Company[] }>('/api/public/companies');
    // Test builds only list the test companies; production hides them
    return (data.companies ?? []).filter((c) => isCompanyAllowed(c.code));
  } catch (error) {
    const message = axios.isAxiosError(error) ? error.response?.data?.message : undefined;
    throw new Error(message || 'No se pudo cargar la lista de empresas');
  }
};

export const companiesService = {
  /**
   * Active companies of this environment (the panel hides suspended ones; see
   * config/env.ts for test vs production). `force` skips the 5-minute cache.
   * A saved company missing from this list is dropped by useCompanyRefresh.
   */
  async list({ force = false } = {}): Promise<Company[]> {
    if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.companies;
    const companies = await fetchAll();
    cache = { at: Date.now(), companies };
    return companies;
  },
};
