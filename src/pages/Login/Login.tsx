import { useState } from 'react';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonInput,
  IonInputPasswordToggle,
  IonPage,
  IonSpinner,
  useIonToast,
} from '@ionic/react';
import { eyeOffOutline, eyeOutline, fingerPrintOutline } from 'ionicons/icons';
import logo from '../../assets/logo-longistik.png';
import { authService } from '../../services/auth.service';
import { useAuthStore } from '../../store/auth.store';
import './Login.css';

const Login: React.FC = () => {
  const setSession = useAuthStore((s) => s.setSession);
  const [presentToast] = useIonToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Ingresa tu correo o usuario y tu contraseña');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { token, user } = await authService.login(username, password);
      // Saving the session is enough: PublicRoute reacts and redirects to "/"
      setSession(token, user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  // TODO: password recovery and biometric login are not built yet
  const comingSoon = () =>
    presentToast({ message: 'Disponible próximamente', duration: 2000, position: 'bottom' });

  return (
    <IonPage>
      <IonContent fullscreen>
        <div className="flex min-h-full flex-col px-6 pt-[max(74px,calc(var(--ion-safe-area-top)+24px))] pb-[max(32px,calc(var(--ion-safe-area-bottom)+12px))]">
          <img src={logo} alt="Longistik" className="h-7.5 w-auto self-start" />

          <h1 className="mt-15 mb-0 text-[31px] leading-9.5 font-semibold text-tinta">
            Tu operación de carga, en tu bolsillo.
          </h1>
          <p className="mt-3 mb-0 text-body text-muted">
            Manifiestos, remesas y novedades sincronizados con el RNDC.
          </p>

          <form onSubmit={handleSubmit} noValidate className="mt-11 flex flex-1 flex-col">
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

            <label className="mt-7.25 block">
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

            {error && (
              <p role="alert" className="mt-3 mb-0 text-sm text-danger">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={comingSoon}
              className="mt-7.5 cursor-pointer self-start border-0 bg-transparent p-0 text-[15px] font-semibold text-secondary"
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

          <p className="mx-auto mt-6 mb-0 max-w-80 text-center text-xs leading-4 text-muted">
            DEBUGPLOY S.A.S. · Conectado al RNDC del Ministerio de Transporte
          </p>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Login;
