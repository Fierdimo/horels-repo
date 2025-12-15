/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_STRIPE_PUBLISHABLE_KEY: string;
  readonly VITE_ENV: string;
  readonly VITE_ENABLE_WEBVIEW_BRIDGE: string;
  readonly VITE_ENABLE_EXPO_NOTIFICATIONS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
