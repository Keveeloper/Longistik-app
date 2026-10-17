import { Navigate, Route } from 'react-router-dom';
import { IonIcon, IonLabel, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs } from '@ionic/react';
import ComingSoon from '../components/ComingSoon';
import { icons } from '../icons';
import Home from '../pages/Home/Home';
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
      <Route path="/manifiestos" element={<ComingSoon title="Manifiestos" />} />
      <Route path="/remesas" element={<ComingSoon title="Remesas" />} />
      <Route path="/novedades" element={<ComingSoon title="Novedades" />} />
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
