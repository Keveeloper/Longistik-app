/*
 * Novedades del manifiesto (P8 of request/mobile-api.md, detail in request/novedades-api.md).
 * The driver reports what happens to the trip or the cargo; only the web takes, annotates and
 * closes them. The catalog is fixed: each type says which RNDC procedure it maps to.
 */
import { api, type Page, type PageParams } from '../api/client';
import type { Municipio } from './operations.service';

export type CodigoTipoNovedad = 'accidente' | 'varada' | 'siniestro' | 'faltante' | 'deterioro' | 'merma' | 'fuerza_mayor';
export type EstadoNovedad = 'abierta' | 'en_gestion' | 'cerrada';
export type VistaNovedades = 'abiertas' | 'cerradas';

export interface EquivalenteRndc {
  tramite: 'suspension' | 'descuento' | 'ajuste_tiempos';
  codigo: string;
  descripcion: string;
}

export interface TipoNovedad {
  codigo: CodigoTipoNovedad;
  nombre: string;
  ayuda: string;
  rndc: EquivalenteRndc;
  /** faltante, deterioro and merma always belong to a remesa */
  requiereRemesa: boolean;
}

/**
 * Same catalog the backend serves (`GET /mobile/catalogos/tipos-novedad`). It is fixed, so the
 * form works the first time without signal; the server's copy replaces it when it loads.
 */
export const TIPOS_NOVEDAD: TipoNovedad[] = [
  {
    codigo: 'accidente',
    nombre: 'Accidente',
    ayuda: 'Choque o volcamiento del vehículo',
    rndc: { tramite: 'suspension', codigo: 'A', descripcion: 'Suspensión del manifiesto, motivo A (accidente)' },
    requiereRemesa: false,
  },
  {
    codigo: 'varada',
    nombre: 'Vehículo varado',
    ayuda: 'Falla mecánica que no deja seguir',
    rndc: { tramite: 'suspension', codigo: 'V', descripcion: 'Suspensión del manifiesto, motivo V (varada)' },
    requiereRemesa: false,
  },
  {
    codigo: 'siniestro',
    nombre: 'Siniestro',
    ayuda: 'Robo, incendio o pérdida de la carga',
    rndc: { tramite: 'suspension', codigo: 'S', descripcion: 'Suspensión del manifiesto, motivo S (siniestro)' },
    requiereRemesa: false,
  },
  {
    codigo: 'faltante',
    nombre: 'Faltante de carga',
    ayuda: 'Falta mercancía respecto a lo cargado',
    rndc: { tramite: 'descuento', codigo: 'F', descripcion: 'Descuento en el cumplido del manifiesto, motivo F (faltante)' },
    requiereRemesa: true,
  },
  {
    codigo: 'deterioro',
    nombre: 'Carga deteriorada',
    ayuda: 'Mercancía dañada o averiada',
    rndc: { tramite: 'descuento', codigo: 'D', descripcion: 'Descuento en el cumplido del manifiesto, motivo D (deterioro de la carga)' },
    requiereRemesa: true,
  },
  {
    codigo: 'merma',
    nombre: 'Merma',
    ayuda: 'Diferencia de peso o cantidad propia de la carga',
    rndc: { tramite: 'descuento', codigo: 'C', descripcion: 'Descuento en el cumplido del manifiesto, motivo C (merma)' },
    requiereRemesa: true,
  },
  {
    codigo: 'fuerza_mayor',
    nombre: 'Vía afectada',
    ayuda: 'Cierre, derrumbe, bloqueo o clima que impide avanzar',
    rndc: { tramite: 'ajuste_tiempos', codigo: '1', descripcion: 'Ajuste de tiempos del monitoreo, motivo 1 (caso fortuito o fuerza mayor)' },
    requiereRemesa: false,
  },
];

export const DESCRIPCION_MIN = 10;
export const DESCRIPCION_MAX = 500;
export const MAX_FOTOS_NOVEDAD = 5;

export interface Persona {
  id: number | null;
  nombre: string;
}

/** List item (also the `novedades` of a manifiesto's detail). */
export interface Novedad {
  id: number;
  tipo: { codigo: CodigoTipoNovedad; nombre: string };
  rndc: EquivalenteRndc | null;
  /** Accidente and siniestro */
  critica: boolean;
  estado: EstadoNovedad;
  descripcion: string;
  /** Phone time when it was reported */
  capturadaEn: string;
  recibidaEn: string;
  reportadaDesde: 'app' | 'web';
  manifiesto: { id: number; numero: string | null; placa: string | null; origen: Municipio | null; destino: Municipio | null };
  remesa: { id: number; numero: string | null } | null;
  reportadaPor: Persona | null;
  gestionadaPor: Persona | null;
  gestionadaEn: string | null;
  cerradaPor: Persona | null;
  cerradaEn: string | null;
  resolucion: string | null;
  ubicacion: { latitud: number; longitud: number; precisionMetros: number | null } | null;
}

export interface NovedadDetalle extends Novedad {
  conductor: Persona | null;
  viajeId: number | null;
  fotos: { id: number; url: string; tomadaEn: string }[];
  /** Oldest first; without the office's internal notes */
  historial: { tipo: 'creada' | 'en_gestion' | 'nota' | 'cerrada'; texto: string | null; por: Persona | null; en: string }[];
}

/** Text fields of the multipart POST. */
export interface DatosNovedad {
  manifiestoId: number;
  remesaId?: number;
  tipo: CodigoTipoNovedad;
  descripcion: string;
  latitud?: number;
  longitud?: number;
  precisionMetros?: number;
  /** ISO 8601, phone time */
  capturadaEn: string;
}

export const novedadesService = {
  async tipos() {
    const { data } = await api.get<TipoNovedad[]>('/mobile/catalogos/tipos-novedad');
    return data;
  },

  /**
   * Same `idempotencyKey` = same novedad: a retry after a lost response returns it (200)
   * instead of creating a duplicate.
   */
  async reportar(datos: DatosNovedad, fotos: Blob[], idempotencyKey: string) {
    const form = new FormData();
    for (const [key, value] of Object.entries(datos)) {
      if (value === undefined || value === null || value === '') continue;
      form.append(key, String(value));
    }
    fotos.forEach((foto, i) => form.append('fotos', foto, `foto-${i + 1}.jpg`));
    const { data } = await api.post<NovedadDetalle>('/mobile/novedades', form, {
      headers: { 'Idempotency-Key': idempotencyKey },
      // Photos on a weak signal
      timeout: 120000,
    });
    return data;
  },

  async listar(params: PageParams & { vista?: VistaNovedades; manifiestoId?: number } = {}) {
    const { data } = await api.get<Page<Novedad>>('/mobile/novedades', { params });
    return data;
  },

  async detalle(id: number) {
    const { data } = await api.get<NovedadDetalle>(`/mobile/novedades/${id}`);
    return data;
  },
};
