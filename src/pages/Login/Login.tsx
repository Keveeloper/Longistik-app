import { useState } from 'react';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonInput,
  IonInputPasswordToggle,
  IonPage,
  IonRippleEffect,
  IonSpinner,
  useIonToast,
} from '@ionic/react';
import { eyeOffOutline, eyeOutline, fingerPrintOutline } from 'ionicons/icons';
import logo from '../../assets/logo-longistik.png';
import { icons } from '../../icons';
import { authService } from '../../services/auth.service';
import { useAuthStore } from '../../store/auth.store';
import { useCompanyStore } from '../../store/company.store';
import './Login.css';

const Login: React.FC = () => {
  const setSession = useAuthStore((s) => s.setSession);
  // Why the previous session ended (expired, user deactivated), if it wasn't a manual logout
  const notice = useAuthStore((s) => s.notice);
  const company = useCompanyStore((s) => s.company);
  // Clearing the company is enough: the route guard goes back to /empresa
  const clearCompany = useCompanyStore((s) => s.clearCompany);
  const [presentToast] = useIonToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Ingresa tu correo y tu contraseña');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { accessToken, user } = await authService.login(username, password);
      // Saving the session is enough: the route guard redirects to /inicio
      setSession(accessToken, user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  // The backend emails a link to the company's web, where the password is reset
  const handleForgotPassword = async () => {
    if (!username) {
      setError('Ingresa tu correo para recuperar la contraseña');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await authService.forgotPassword(username);
      presentToast({
        message: 'Si el correo está registrado, te enviaremos un enlace para restablecer tu contraseña.',
        duration: 4000,
        position: 'bottom',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  // TODO: biometric login is not built yet
  const comingSoon = () =>
    presentToast({ message: 'Disponible próximamente', duration: 2000, position: 'bottom' });

  return (
    <IonPage>
      <IonContent fullscreen>
        <div className="flex min-h-full flex-col px-6 pt-[max(74px,calc(var(--ion-safe-area-top)+24px))] pb-[max(32px,calc(var(--ion-safe-area-bottom)+12px))]">
          <img src={logo} alt="Longistik" className="h-[30px] w-auto self-start" />

          <h1 className="mt-[60px] mb-0 text-[31px] leading-[38px] font-semibold text-tinta">
            Tu operación de carga, en tu bolsillo.
          </h1>
          <p className="mt-3 mb-0 text-body text-muted">
            Manifiestos, remesas y novedades sincronizados con el RNDC.
          </p>

          {/* Company chosen on the first screen; changing it closes the flow and goes back to the selector */}
          <div className="mt-6 flex items-center gap-3 rounded-2xl bg-superficie py-2 pr-1 pl-4">
            <IonIcon icon={icons.building} className="shrink-0 text-[22px] text-tinta" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <span className="block text-caption text-muted">Empresa</span>
              <span className="block truncate text-[15px] leading-5 font-medium text-tinta">{company?.name}</span>
            </div>
            <button
              type="button"
              onClick={clearCompany}
              disabled={loading}
              aria-label="Cambiar de empresa"
              className="ion-activatable relative shrink-0 cursor-pointer overflow-hidden rounded-full border-0 bg-transparent px-3 py-2 text-[15px] font-semibold text-secondary"
            >
              Cambiar
              <IonRippleEffect />
            </button>
          </div>

          <form onSubmit={handleSubmit} noValidate className="mt-8 flex flex-1 flex-col">
            <label className="block">
              <span className="block text-caption font-medium text-muted">Correo o usuario</span>
              <IonInput
                className="login-field"
                aria-label="Correo o usuario"
                type="text"
                inputmode="email"
                autocomplete="username"
                autocapitalize="off"
                value={username}
                onIonInput={(e) => setUsername(e.detail.value ?? '')}
                disabled={loading}
              />
            </label>

            <label className="mt-[29px] block">
              <span className="block text-caption font-medium text-muted">Contraseña</span>
              <IonInput
                className="login-field"
                aria-label="Contraseña"
                type="password"
                autocomplete="current-password"
                value={password}
                onIonInput={(e) => setPassword(e.detail.value ?? '')}
                disabled={loading}
              >
                <IonInputPasswordToggle slot="end" color="medium" showIcon={eyeOutline} hideIcon={eyeOffOutline} />
              </IonInput>
            </label>

            {(error ?? notice) && (
              <p role="alert" className="mt-3 mb-0 text-sm text-danger">
                {error ?? notice}
              </p>
            )}

            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={loading}
              className="mt-[30px] cursor-pointer self-start border-0 bg-transparent p-0 text-[15px] font-semibold text-secondary"
            >
              ¿Olvidaste tu contraseña?
            </button>

            {/* Pushes the actions to the bottom of the screen */}
            <div className="min-h-8 flex-1" />

            <IonButton
              type="submit"
              expand="block"
              className="login-button m-0 h-14 text-[17px] font-semibold tracking-normal normal-case"
              disabled={loading}
            >
              {loading ? <IonSpinner name="crescent" /> : 'Ingresar'}
            </IonButton>

            <IonButton
              type="button"
              expand="block"
              color="light"
              onClick={comingSoon}
              className="login-button m-0 mt-3 h-14 text-base font-semibold tracking-normal normal-case"
              disabled={loading}
            >
              <IonIcon slot="start" icon={fingerPrintOutline} />
              Ingresar con huella
            </IonButton>
          </form>

          <p className="mx-auto mt-6 mb-0 max-w-[320px] text-center text-xs leading-4 text-muted">
            DEBUGPLOY S.A.S. · Conectado al RNDC del Ministerio de Transporte
          </p>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Login;
