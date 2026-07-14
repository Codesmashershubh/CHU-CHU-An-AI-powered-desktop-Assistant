/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_APP_SHARED_SECRET: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
