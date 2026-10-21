import axios from 'axios';
import { api, apiErrorMessage } from '../api/client';

/** Permission codes of the "App móvil" group in the web's role matrix. */
export type Permiso =
  | 'app.acceso'
  | 'manifiestos.ver_todos'
  | 'manifiestos.ver_asignados'
  | 'manifiestos.crear'
  | 'remesas.crear'
  | 'remesas.cumplir'
  | 'novedades.reportar'
  | 'rndc.enviar'
  | 'vehiculos.asignar';

/**
 * Which manifiestos and remesas the user sees: everything, only their assigned
 * vehicles', or none. The backend filters every endpoint by it.
 */
export type Alcance = 'todos' | 'asignados' | 'ninguno';

/** Vehicle assignment in force (only filled with alcance "asignados"). */
export interface VehiculoAsignado {
  id: number;
  placa: string;
  desde: string;
  /** null = no end date */
  hasta: string | null;
}

/** `GET /mobile/me` and the `user` of the login response. */
export interface User {
  id: number;
  /** First word of the stored name */
  name: string;
  /** Rest of the stored name (may be empty) */
  lastName: string;
  email: string;
  /** Role name in the web app; null when the user has none */
  role: string | null;
  alcance: Alcance;
  permisos: Permiso[];
  vehiculos: VehiculoAsignado[];
  status?: boolean;
}

export interface LoginResponse {
  accessToken: string;
  /** Seconds (30 days) */
  expiresIn: number;
  user: User;
}

export const fullName = (user: Pick<User, 'name' | 'lastName'>) => `${user.name} ${user.lastName ?? ''}`.trim();

/** Sessions saved before permissions existed have no `permisos` until /mobile/me refreshes them. */
export const hasPermiso = (user: User | null, permiso: Permiso) => !!user?.permisos?.includes(permiso);

export const authService = {
  /** Logs in against the selected company's backend. */
  async login(email: string, password: string): Promise<LoginResponse> {
    try {
      const { data } = await api.post<LoginResponse>('/mobile/auth/login', { email, password });
      return data;
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      // 401 INVALID_CREDENTIALS, 403 USER_INACTIVE / APP_ACCESS_DENIED: the message is meant for the user
      if (status === 401) throw new Error(apiErrorMessage(error, 'Correo o contraseña incorrectos'));
      if (status === 403) throw new Error(apiErrorMessage(error, 'No tienes acceso a la app móvil.'));
      if (status === 404) throw new Error('Tu empresa aún no tiene habilitada la app móvil');
      throw new Error(apiErrorMessage(error, 'No se pudo iniciar sesión. Intenta de nuevo.'));
    }
  },

  /** Always succeeds for any email (the backend doesn't reveal which ones exist). */
  async forgotPassword(email: string): Promise<void> {
    try {
      await api.post('/public/authentication/forgot-password', { email });
    } catch (error) {
      throw new Error(apiErrorMessage(error, 'No se pudo enviar el correo de recuperación'));
    }
  },

  /** Current user, permissions and assigned vehicles. Session-ending errors are handled by the `api` client. */
  async me(): Promise<User> {
    const { data } = await api.get<User>('/mobile/me');
    return data;
  },
};
