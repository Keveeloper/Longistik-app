import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/react';

/** Placeholder for tab sections whose design isn't implemented yet. */
const ComingSoon: React.FC<{ title: string }> = ({ title }) => (
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonTitle>{title}</IonTitle>
      </IonToolbar>
    </IonHeader>
    <IonContent fullscreen>
      <div className="flex h-full items-center justify-center p-6 text-center text-body text-muted">
        {title}: pantalla en construcción
      </div>
    </IonContent>
  </IonPage>
);

export default ComingSoon;
