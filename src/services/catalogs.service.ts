/*
 * Form catalogs (P3 of request/mobile-api.md). Each accepts `q`, isn't paginated
 * and returns at most 50 matches. clientes, productos and conductores need
 * `manifiestos.crear` or `remesas.crear` (else 403 FORBIDDEN); vehiculos only lists
 * the user's assigned vehicles when alcance is "asignados". Not used yet: the
 * create forms are still pending on the backend.
 */
import { api } from '../api/client';

export interface ClienteOption {
  id: number;
  nombre: string;
  documento: string;
  municipio: string;
}

export interface ProductoOption {
  id: number;
  nombre: string;
  codigoMinisterio: string;
}

export interface MunicipioOption {
  id: number;
  codigoDane: string;
  nombre: string;
}

export interface VehiculoOption {
  id: number;
  nombre: string;
  placa: string;
  conductor: string | null;
}

export interface ConductorOption {
  id: number;
  nombre: string;
  documento: string;
  licencia: string;
}

const search =
  <T>(path: string) =>
  async (q = ''): Promise<T[]> => {
    const { data } = await api.get<T[]>(`/mobile/catalogos/${path}`, { params: q ? { q } : undefined });
    return data;
  };

export const catalogsService = {
  clientes: search<ClienteOption>('clientes'),
  productos: search<ProductoOption>('productos'),
  municipios: search<MunicipioOption>('municipios'),
  vehiculos: search<VehiculoOption>('vehiculos'),
  conductores: search<ConductorOption>('conductores'),
};
