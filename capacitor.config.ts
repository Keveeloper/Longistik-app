import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'Longistik',
  webDir: 'dist',
  plugins: {
    // Native HTTP for fetch/XHR: the panel's CORS doesn't allow the WebView origins
    CapacitorHttp: { enabled: true },
  },
};

export default config;
