/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend base URL. When empty, auth uses the mock service. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
