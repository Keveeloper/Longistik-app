import { useEffect, useRef } from 'react';

/**
 * Runs `callback` whenever the app comes back to the foreground. `visibilitychange`
 * fires both in the browser and in the Capacitor WebView when the app is resumed.
 */
export const useAppResume = (callback: () => void) => {
  const latest = useRef(callback);
  latest.current = callback;

  useEffect(() => {
    const onChange = () => {
      if (document.visibilityState === 'visible') latest.current();
    };
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);
};
