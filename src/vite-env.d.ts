/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Build-time constants injected via vite.config's `define`. Surfaced in
// Settings → About so on-device testing can verify which build is loaded.
// Values resolved at config-load time: __APP_VERSION__ from package.json,
// the rest from git + the build clock.
declare const __APP_VERSION__: string;
declare const __BUILD_TIME__: string;
declare const __GIT_SHA__: string;
declare const __GIT_BRANCH__: string;
