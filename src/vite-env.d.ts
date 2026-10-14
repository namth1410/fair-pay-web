/// <reference types="vite/client" />

declare const __DEV__: boolean

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_R2_PUBLIC_BASE_URL: string
  readonly VITE_GOOGLE_WEB_CLIENT_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
