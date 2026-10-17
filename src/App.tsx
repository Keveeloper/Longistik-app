import { useEffect } from 'react';
import { Route, useLocation, useNavigate } from 'react-router-dom';
import { IonApp, IonRouterOutlet, IonSpinner, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import TabsLayout from './layouts/TabsLayout';
import Login from './pages/Login/Login';
import { useAuthStore } from './store/auth.store';

/* Figtree, bundled locally so it works offline inside the native app */
import '@fontsource-variable/figtree';

/* Ionic global CSS + Tailwind (see theme/global.css for the layer setup) */
import './theme/global.css';

/* Theme variables */
import './theme/variables.css';

setupIonicReact();

const LOGIN_PATH = '/login';
const HOME_PATH = '/inicio';

/*
 * Route guard. It lives outside IonRouterOutlet on purpose:
 * - The outlet keeps visited pages mounted (hidden) and reuses them by path, so
 *   redirects rendered inside routes (e.g. a component wrapping <Navigate>) keep
 *   firing from hidden pages and cause infinite redirect loops.
 * - The outlet must stay mounted: an outlet mounted right after a navigation
 *   leaves its first page stuck invisible (`ion-page-invisible`).
 * So routes are static and this component only redirects the active URL.
 */
const AppRoutes: React.FC = () => {
  const isAuthenticated = useAuthStore((s) => !!s.token);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const onLoginPage = pathname === LOGIN_PATH;
  const redirectTo =
    !isAuthenticated && !onLoginPage ? LOGIN_PATH : isAuthenticated && onLoginPage ? HOME_PATH : null;

  useEffect(() => {
    if (redirectTo) navigate(redirectTo, { replace: true });
  }, [redirectTo, navigate]);

  return (
    <IonRouterOutlet>
      <Route path={LOGIN_PATH} element={<Login />} />
      <Route path="/*" element={<TabsLayout />} />
    </IonRouterOutlet>
  );
};

const App: React.FC = () => {
  // Persisted session is read asynchronously; wait for it so the guard
  // doesn't flash the login screen for users who are already signed in.
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  if (!hasHydrated) {
    return (
      <IonApp>
        <div className="flex h-full items-center justify-center">
          <IonSpinner name="crescent" />
        </div>
      </IonApp>
    );
  }

  return (
    <IonApp>
      {/* Opt in to React Router v7 behavior (silences the future-flag warnings) */}
      <IonReactRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppRoutes />
      </IonReactRouter>
    </IonApp>
  );
};

export default App;
