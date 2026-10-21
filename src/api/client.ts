import axios from 'axios';
import { useAuthStore } from '../store/auth.store';
import { useCompanyStore } from '../store/company.store';

/** Client for the selected company's Longistik backend (see request/mobile-api.md). */
export const api = axios.create({ timeout: 30000 });

/** Listing envelope used by every paginated `/mobile` endpoint (`pageSize` max 100). */
export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface PageParams {
  page?: number;
  pageSize?: number;
}

/** User-facing message for a failed request: the backend's `message` when it sent one. */
export const apiErrorMessage = (error: unknown, fallback = 'Ocurrió un error. Intenta de nuevo.') => {
  if (!axios.isAxiosError(error)) return error instanceof Error ? error.message : fallback;
  if (!error.response) return 'No se pudo conectar con el servidor';
  const message = (error.response.data as { message?: unknown } | undefined)?.message;
  return typeof message === 'string' && message ? message : fallback;
};

// Every company has its own backend: use its `apiUrl` as-is, never build it from the code
api.interceptors.request.use((config) => {
  config.baseURL = useCompanyStore.getState().company?.apiUrl;
  return config;
});

// Attach the session token to every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/*
 * The backend checks the user on every request: 401 = token expired or user deleted,
 * 403 = user deactivated. Either way the session is over: clear it (the route guard
 * sends the user to /login) and leave the reason for the login screen.
 * Only for requests that carried a token, so a failed login doesn't count.
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    const hadSession = axios.isAxiosError(error) && !!error.config?.headers?.Authorization;
    if (hadSession && (status === 401 || status === 403)) {
      useAuthStore
        .getState()
        .logout(
          status === 403
            ? apiErrorMessage(error, 'Tu usuario está inactivo. Contacta al administrador.')
            : 'Tu sesión expiró. Ingresa de nuevo.'
        );
    }
    return Promise.reject(error);
  }
);
