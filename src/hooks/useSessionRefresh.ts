import { useCallback, useEffect } from 'react';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../store/auth.store';
import { useAppResume } from './useAppResume';

/**
 * With a saved session, ask `GET /mobile/me` on launch and every time the app comes
 * back to the foreground: it refreshes the profile, permissions and assigned vehicles
 * (a new assignment shows up without logging in again). When the session is over
 * (401, user deactivated, app access removed) the `api` client closes it. Other
 * failures (offline) keep the saved session.
 */
export const useSessionRefresh = () => {
  const refresh = useCallback(() => {
    const { token } = useAuthStore.getState();
    if (!token) return;
    authService
      .me()
      .then((user) => {
        // Skip if the user logged out (or in again) while the request was in flight
        if (useAuthStore.getState().token === token) useAuthStore.getState().setUser(user);
      })
      .catch(() => {});
  }, []);

  useEffect(refresh, [refresh]);
  useAppResume(refresh);
};
