/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Build-time constants injected via vite.config's `define`. The value lives
// in package.json; vite.config reads it at config-load time.
declare const __APP_VERSION__: string;
declare const __BUILD_DATE__: string;
