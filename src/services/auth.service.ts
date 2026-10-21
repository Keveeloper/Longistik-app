import axios from 'axios';
import { api, apiErrorMessage } from '../api/client';

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
  status?: boolean;
}

export interface LoginResponse {
  accessToken: string;
  /** Seconds (30 days) */
  expiresIn: number;
  user: User;
}

export const fullName = (user: Pick<User, 'name' | 'lastName'>) => `${user.name} ${user.lastName ?? ''}`.trim();

export const authService = {
  /** Logs in against the selected company's backend. */
  async login(email: string, password: string): Promise<LoginResponse> {
    try {
      const { data } = await api.post<LoginResponse>('/mobile/auth/login', { email, password });
      return data;
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      // 401 wrong credentials / 403 inactive user: the backend's message is meant for the user
      if (status === 401) throw new Error(apiErrorMessage(error, 'Correo o contraseña incorrectos'));
      if (status === 403) throw new Error(apiErrorMessage(error, 'Tu usuario está inactivo. Contacta al administrador.'));
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

  /** Current user. 401/403 end the session (handled by the `api` client). */
  async me(): Promise<User> {
    const { data } = await api.get<User>('/mobile/me');
    return data;
  },
};
