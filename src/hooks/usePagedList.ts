import { useCallback, useRef, useState } from 'react';
import { apiErrorMessage, type Page } from '../api/client';
import { useAuthStore } from '../store/auth.store';
import { guardarEnCache, leerDeCache } from '../store/offlineCache.store';

const PAGE_SIZE = 20;

/**
 * Paginated `/mobile` listing for infinite scroll. The first page of `cacheKey` is saved
 * on the phone and shown when there's no signal (`guardadoEn` = when it was saved);
 * pass null to skip the cache (e.g. while searching).
 */
export const usePagedList = <T,>(cacheKey: string | null, fetchPage: (page: number, pageSize: number) => Promise<Page<T>>) => {
  const [items, setItems] = useState<T[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [guardadoEn, setGuardadoEn] = useState<string | null>(null);
  const latestFetch = useRef(fetchPage);
  latestFetch.current = fetchPage;
  // Ignore responses of a search that was replaced by a newer one
  const requestId = useRef(0);

  const reload = useCallback(async () => {
    // Tab pages can mount for an instant before the route guard sends a signed-out user away
    if (!useAuthStore.getState().token) return;
    const id = ++requestId.current;
    try {
      const data = await latestFetch.current(1, PAGE_SIZE);
      if (!Array.isArray(data?.items)) throw new Error('Respuesta inesperada del servidor');
      if (id !== requestId.current) return;
      if (cacheKey) guardarEnCache(cacheKey, data);
      setItems(data.items);
      setTotal(data.total);
      setPage(1);
      setError(null);
      setGuardadoEn(null);
    } catch (err) {
      if (id !== requestId.current) return;
      const cached = cacheKey ? leerDeCache<Page<T>>(cacheKey) : null;
      setError(apiErrorMessage(err, 'No se pudo cargar la lista'));
      if (cached) {
        setItems(cached.data.items);
        setTotal(cached.data.items.length);
        setGuardadoEn(cached.guardadoEn);
      } else {
        setItems((prev) => prev ?? []);
      }
    }
  }, [cacheKey]);

  const loadMore = useCallback(async () => {
    if (!items || items.length >= total) return;
    try {
      const data = await latestFetch.current(page + 1, PAGE_SIZE);
      if (!Array.isArray(data?.items)) return;
      setItems((prev) => [...(prev ?? []), ...data.items]);
      setTotal(data.total);
      setPage(page + 1);
    } catch {
      // the infinite scroll tries again on the next scroll
    }
  }, [items, total, page]);

  return { items, total, error, guardadoEn, reload, loadMore, hasMore: !!items && items.length < total };
};
