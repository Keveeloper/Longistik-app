/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Panel base URL (public company directory). Defaults to the Vite proxy in dev and the real panel in builds. */
  readonly VITE_PANEL_API_URL?: string;
  /** "test" or "production", set per Vite mode in .env.development / .env.test / .env.production */
  readonly VITE_APP_ENV?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
