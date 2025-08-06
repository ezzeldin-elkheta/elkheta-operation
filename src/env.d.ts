/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Bunny.net Configuration
  readonly VITE_BUNNY_API_KEY?: string
  
  // Application Configuration
  readonly VITE_BASE_PATH?: string
  readonly VITE_API_URL?: string
  
  // Google Configuration (client-side accessible)
  readonly VITE_GOOGLE_CLIENT_ID?: string
  readonly VITE_GOOGLE_API_KEY?: string
  
  // System
  readonly NODE_ENV?: string
  readonly DEV?: boolean
  readonly PROD?: boolean
  
  // Development
  readonly VITE_TEMPO?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
