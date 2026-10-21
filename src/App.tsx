import { useEffect } from 'react';
import { Navigate, Route, useLocation, useNavigate } from 'react-router-dom';
import { IonApp, IonRouterOutlet, IonSpinner, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import EnvBadge from './components/EnvBadge';
import { useCompanyRefresh } from './hooks/useCompanyRefresh';
import { useSessionRefresh } from './hooks/useSessionRefresh';
import TabsLayout from './layouts/TabsLayout';
import CompanySelect from './pages/CompanySelect/CompanySelect';
import Login from './pages/Login/Login';
import { useAuthStore } from './store/auth.store';
import { useCompanyStore } from './store/company.store';

/* Figtree, bundled locally so it works offline inside the native app */
import '@fontsource-variable/figtree';

/* Ionic global CSS + Tailwind (see theme/global.css for the layer setup) */
import './theme/global.css';

/* Theme variables */
import './theme/variables.css';

setupIonicReact();

const COMPANY_PATH = '/empresa';
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
 *
 * Flow: no company -> /empresa; company but no session -> /login; session -> the app.
 * Screens only change the stores (setCompany, clearCompany, setSession, logout).
 */
const AppRoutes: React.FC = () => {
  const hasCompany = useCompanyStore((s) => !!s.company);
  const isAuthenticated = useAuthStore((s) => !!s.token);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useCompanyRefresh();
  useSessionRefresh();

  const stage = !hasCompany ? COMPANY_PATH : !isAuthenticated ? LOGIN_PATH : HOME_PATH;
  // Signed-in users may be anywhere in the app except the entry screens
  const allowed =
    stage === HOME_PATH ? pathname !== COMPANY_PATH && pathname !== LOGIN_PATH : pathname === stage;
  // The root URL has its own <Navigate> route below, so it isn't redirected twice
  const redirectTo = allowed || pathname === '/' ? null : stage;

  useEffect(() => {
    if (redirectTo) navigate(redirectTo, { replace: true });
  }, [redirectTo, navigate]);

  return (
    <IonRouterOutlet>
      <Route path={COMPANY_PATH} element={<CompanySelect />} />
      <Route path={LOGIN_PATH} element={<Login />} />
      {/* Without this, "/" falls into the tabs layout, whose tab bar stays on top of the entry screens */}
      <Route path="/" element={<Navigate to={stage} replace />} />
      <Route path="/*" element={<TabsLayout />} />
    </IonRouterOutlet>
  );
};

const App: React.FC = () => {
  // Persisted company and session are read asynchronously; wait for both so the guard
  // doesn't flash the selector or the login for users who already chose or signed in.
  const authHydrated = useAuthStore((s) => s.hasHydrated);
  const companyHydrated = useCompanyStore((s) => s.hasHydrated);
  const hasHydrated = authHydrated && companyHydrated;

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
      <EnvBadge />
    </IonApp>
  );
};

export default App;
