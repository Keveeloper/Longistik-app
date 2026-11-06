import { Route } from 'react-router-dom';
import { IonIcon, IonLabel, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs } from '@ionic/react';
import { icons } from '../icons';
import Home from '../pages/Home/Home';
import ManifiestoDetalle from '../pages/Manifiestos/ManifiestoDetalle';
import Manifiestos from '../pages/Manifiestos/Manifiestos';
import NovedadDetalle from '../pages/Novedades/NovedadDetalle';
import Novedades from '../pages/Novedades/Novedades';
import RemesaDetalle from '../pages/Remesas/RemesaDetalle';
import Remesas from '../pages/Remesas/Remesas';
import MisSobreanticipos from '../pages/Sobreanticipos/MisSobreanticipos';
import Notificaciones from '../pages/Notificaciones/Notificaciones';
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
      {/* Details stay in their tab's stack, with the tab bar */}
      <Route path="/manifiestos/:id" element={<ManifiestoDetalle />} />
      <Route path="/remesas" element={<Remesas />} />
      <Route path="/remesas/:id" element={<RemesaDetalle />} />
      {/* Opened from Inicio; not a tab of its own */}
      <Route path="/sobreanticipos" element={<MisSobreanticipos />} />
      <Route path="/notificaciones" element={<Notificaciones />} />
      <Route path="/novedades" element={<Novedades />} />
      <Route path="/novedades/:id" element={<NovedadDetalle />} />
      {/* "/" is redirected by the guard in App.tsx */}
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
