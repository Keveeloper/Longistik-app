/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Panel base URL (public company directory). Defaults to the Vite proxy in dev and the real panel in builds. */
  readonly VITE_PANEL_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
