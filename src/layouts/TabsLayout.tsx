import { Navigate, Route } from 'react-router-dom';
import { IonIcon, IonLabel, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs } from '@ionic/react';
import { icons } from '../icons';
import Home from '../pages/Home/Home';
import Manifiestos from '../pages/Manifiestos/Manifiestos';
import Novedades from '../pages/Novedades/Novedades';
import Remesas from '../pages/Remesas/Remesas';
import './TabsLayout.css';

const tabs = [
  { tab: 'inicio', label: 'Inicio', icon: icons.home },
  { tab: 'manifiestos', label: 'Manifiestos', icon: icons.truck },
  { tab: 'remesas', label: 'Remesas', icon: icons.fileDescription },
  { tab: 'novedades', label: 'Novedades', icon: icons.alertTriangle },
];

/** Authenticated area: bottom tab navigation with its own nested outlet. */
const TabsLayout: React.FC = () => (
  <IonTabs>
    <IonRouterOutlet>
      <Route path="/inicio" element={<Home />} />
      <Route path="/manifiestos" element={<Manifiestos />} />
      <Route path="/remesas" element={<Remesas />} />
      <Route path="/novedades" element={<Novedades />} />
      <Route path="/" element={<Navigate to="/inicio" replace />} />
    </IonRouterOutlet>
    <IonTabBar slot="bottom" className="app-tab-bar">
      {tabs.map(({ tab, label, icon }) => (
        <IonTabButton key={tab} tab={tab} href={`/${tab}`}>
          <IonIcon aria-hidden="true" icon={icon} />
          <IonLabel>{label}</IonLabel>
        </IonTabButton>
      ))}
    </IonTabBar>
  </IonTabs>
);

export default TabsLayout;
