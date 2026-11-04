import { IonBackButton, IonButtons, IonHeader, IonToolbar } from '@ionic/react';
import type { ReactNode } from 'react';
import { icons } from '../icons';
import './AppHeader.css';

interface AppHeaderProps {
  /** Large title on the left (lists, Notificaciones). Details put theirs in the content, so it scrolls */
  title?: ReactNode;
  /** Shows a back arrow; the route to go to when there's no history (e.g. a reloaded page) */
  backHref?: string;
  /** Icon of the back button: a chevron, or an X for full-screen forms */
  backIcon?: string;
  /** Buttons at the end of the toolbar */
  end?: ReactNode;
  /** Extra content under the title, on the same white background (search bar, segment) */
  children?: ReactNode;
}

/** White header with a large title on the left, used by every screen but Inicio. */
const AppHeader: React.FC<AppHeaderProps> = ({ title, backHref, backIcon, end, children }) => {
  const toolbar = !!(backHref || end);
  return (
    <IonHeader className="app-header ion-no-border">
      {toolbar && (
        <IonToolbar className="app-toolbar">
          {backHref && (
            <IonButtons slot="start">
              <IonBackButton defaultHref={backHref} text="" icon={backIcon ?? icons.chevronLeft} />
            </IonButtons>
          )}
          {end && <IonButtons slot="end">{end}</IonButtons>}
        </IonToolbar>
      )}
      {(title || children) && (
        <div className={`bg-white px-5 pb-4 ${toolbar ? 'pt-1' : 'pt-[max(51px,calc(var(--ion-safe-area-top,0px)+4px))]'}`}>
          {title && <h1 className="m-0 tracking-[-0.5px] text-tinta">{title}</h1>}
          {children && <div className="mt-[18px] flex flex-col gap-4">{children}</div>}
        </div>
      )}
    </IonHeader>
  );
};

export default AppHeader;
