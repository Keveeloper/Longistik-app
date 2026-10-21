import axios from 'axios';
import { COMPANY_API_URL_OVERRIDE } from '../config/env';
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

/** `code` of the `/mobile` error body `{ statusCode, code, message, errors? }`. */
export type ApiErrorCode =
  | 'TOKEN_INVALID'
  | 'INVALID_CREDENTIALS'
  | 'USER_INACTIVE'
  | 'APP_ACCESS_DENIED'
  | 'FORBIDDEN'
  | 'BAD_REQUEST'
  | 'NOT_FOUND'
  | 'CONFLICT';

/** Codes that mean the session is over (the others, like FORBIDDEN, keep the user signed in). */
const SESSION_ENDING_CODES: ApiErrorCode[] = ['TOKEN_INVALID', 'USER_INACTIVE', 'APP_ACCESS_DENIED'];

export const apiErrorCode = (error: unknown): ApiErrorCode | undefined => {
  if (!axios.isAxiosError(error)) return undefined;
  const code = (error.response?.data as { code?: unknown } | undefined)?.code;
  return typeof code === 'string' ? (code as ApiErrorCode) : undefined;
};

/** User-facing message for a failed request: the backend's `message` when it sent one. */
export const apiErrorMessage = (error: unknown, fallback = 'Ocurrió un error. Intenta de nuevo.') => {
  if (!axios.isAxiosError(error)) return error instanceof Error ? error.message : fallback;
  if (!error.response) return 'No se pudo conectar con el servidor';
  const message = (error.response.data as { message?: unknown } | undefined)?.message;
  return typeof message === 'string' && message ? message : fallback;
};

// Every company has its own backend: use its `apiUrl` as-is, never build it from the code.
// In development a local backend can stand in for it (VITE_COMPANY_API_URL, see config/env.ts).
api.interceptors.request.use((config) => {
  config.baseURL = COMPANY_API_URL_OVERRIDE || useCompanyStore.getState().company?.apiUrl;
  return config;
});

// Attach the session token to every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/*
 * The backend checks the user and their role on every request. The session is over on
 * any 401 (token expired/invalid, user deleted) and on the 403s USER_INACTIVE and
 * APP_ACCESS_DENIED: clear it (the route guard sends the user to /login) and leave the
 * reason for the login screen. A 403 FORBIDDEN (missing permission) keeps the session.
 * Only for requests that carried a token, so a failed login doesn't count.
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    const code = apiErrorCode(error);
    const hadSession = axios.isAxiosError(error) && !!error.config?.headers?.Authorization;
    const sessionEnded = status === 401 || (status === 403 && !!code && SESSION_ENDING_CODES.includes(code));
    if (hadSession && sessionEnded) {
      useAuthStore
        .getState()
        .logout(status === 401 ? 'Tu sesión expiró. Ingresa de nuevo.' : apiErrorMessage(error, 'Tu acceso a la app fue retirado.'));
    }
    return Promise.reject(error);
  }
);
