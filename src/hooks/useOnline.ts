import { Network } from '@capacitor/network';
import { useEffect, useState } from 'react';

/** Whether the phone has a connection (Capacitor Network: native status, `online` events on the web). */
export const useOnline = () => {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let active = true;
    Network.getStatus().then((s) => active && setOnline(s.connected));
    const listener = Network.addListener('networkStatusChange', (s) => setOnline(s.connected));
    return () => {
      active = false;
      listener.then((l) => l.remove());
    };
  }, []);

  return online;
};
