import axios from 'axios';
import { api } from '../api/client';

export interface User {
  id: string;
  name: string;
  email: string;
  /** Transport company the user operates for */
  company: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

/** No backend configured yet -> use the mock. */
const USE_MOCK = !import.meta.env.VITE_API_URL;

const mockLogin = async (username: string, password: string): Promise<LoginResponse> => {
  await new Promise((resolve) => setTimeout(resolve, 800)); // simulate network latency
  // Any credentials log in as the demo user, except the password "error" to try the failure path
  if (password === 'error') throw new Error('Usuario o contraseña incorrectos');
  return {
    token: `mock-token-${Date.now()}`,
    user: { id: '1', name: 'Andrés Rojas', email: username, company: 'Transportes del Valle S.A.S.' },
  };
};

export const authService = {
  /** `username` accepts either an email or a username. */
  async login(username: string, password: string): Promise<LoginResponse> {
    if (USE_MOCK) return mockLogin(username, password);
    try {
      const { data } = await api.post<LoginResponse>('/auth/login', { username, password });
      return data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        throw new Error('Usuario o contraseña incorrectos');
      }
      throw new Error('No se pudo conectar con el servidor');
    }
  },
};
