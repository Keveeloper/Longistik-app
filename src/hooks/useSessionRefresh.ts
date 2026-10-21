import { useEffect } from 'react';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../store/auth.store';

/**
 * On launch with a saved session, ask `GET /mobile/me`: it refreshes the profile and,
 * when the user was deleted (401) or deactivated (403), the `api` client closes the
 * session. Other failures (offline) keep the saved session.
 */
export const useSessionRefresh = () => {
  useEffect(() => {
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
};
