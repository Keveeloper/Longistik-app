import { IonBackButton, IonButtons, IonHeader, IonTitle, IonToolbar } from '@ionic/react';
import type { ReactNode } from 'react';
import { icons } from '../icons';
import './AppHeader.css';

interface AppHeaderProps {
  title: ReactNode;
  /** Shows a back arrow; the route to go to when there's no history (e.g. a reloaded page) */
  backHref?: string;
  /** Buttons at the end of the toolbar */
  end?: ReactNode;
  /** Extra content under the toolbar, on the same tinta background (search bar, segment) */
  children?: ReactNode;
}

/** Tinta toolbar used by the list, detail and full-screen pages (Inicio has its own header). */
const AppHeader: React.FC<AppHeaderProps> = ({ title, backHref, end, children }) => (
  <IonHeader className="app-header ion-no-border">
    <IonToolbar className="app-toolbar">
      {backHref && (
        <IonButtons slot="start">
          <IonBackButton defaultHref={backHref} text="" icon={icons.arrowLeft} />
        </IonButtons>
      )}
      <IonTitle>{title}</IonTitle>
      {end && <IonButtons slot="end">{end}</IonButtons>}
    </IonToolbar>
    {children && <div className="bg-tinta px-4 pb-3">{children}</div>}
  </IonHeader>
);

export default AppHeader;
