import { IonHeader } from '@ionic/react';
import './ListPageHeader.css';

/**
 * Fixed top area of the list screens (title, search, filters, summary).
 * Lives in an IonHeader so only the IonContent below it (the items) scrolls.
 */
const ListPageHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <IonHeader className="list-page-header">
    <div className="px-5 pt-[max(56px,calc(var(--ion-safe-area-top)+9px))]">{children}</div>
  </IonHeader>
);

export default ListPageHeader;
