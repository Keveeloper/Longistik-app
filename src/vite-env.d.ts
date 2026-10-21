/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Panel base URL (public company directory). Defaults to the Vite proxy in dev and the real panel in builds. */
  readonly VITE_PANEL_API_URL?: string;
  /** "test" or "production", set per Vite mode in .env.development / .env.test / .env.production */
  readonly VITE_APP_ENV?: string;
  /** Dev server only: local backend that replaces the selected company's apiUrl (e.g. http://localhost:3001) */
  readonly VITE_COMPANY_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
