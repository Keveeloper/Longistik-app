import { useCallback, useRef, useState } from 'react';
import { apiErrorMessage } from '../api/client';
import { guardarEnCache, leerDeCache } from '../store/offlineCache.store';

interface CachedQuery<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  /** Set when `data` is the copy saved on the phone (no signal): ISO date it was saved */
  guardadoEn: string | null;
}

/**
 * Loads `key` with `loader` and saves the response on the phone. When the request fails
 * (typically no signal), shows the last saved copy instead, with its date.
 */
export const useCachedQuery = <T,>(key: string, loader: () => Promise<T>) => {
  const [state, setState] = useState<CachedQuery<T>>(() => {
    const cached = leerDeCache<T>(key);
    return { data: cached?.data ?? null, error: null, loading: true, guardadoEn: cached?.guardadoEn ?? null };
  });
  const latestLoader = useRef(loader);
  latestLoader.current = loader;

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const data = await latestLoader.current();
      guardarEnCache(key, data);
      setState({ data, error: null, loading: false, guardadoEn: null });
      return data;
    } catch (err) {
      const cached = leerDeCache<T>(key);
      setState({
        data: cached?.data ?? null,
        error: apiErrorMessage(err, 'No se pudo cargar la información'),
        loading: false,
        guardadoEn: cached?.guardadoEn ?? null,
      });
      return null;
    }
  }, [key]);

  return { ...state, load };
};
