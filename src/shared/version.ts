// Build version shown on screen (bottom of the database badge and on ?dbtest).
// Values are injected at build time by vite.config.ts.
declare const __APP_VERSION__: string
declare const __APP_COMMIT__: string
declare const __APP_BUILD_TIME__: string

export const APP_VERSION = __APP_VERSION__
export const APP_COMMIT = __APP_COMMIT__
export const APP_BUILD_TIME = __APP_BUILD_TIME__

/** e.g. "v0.1.0 · 34725c7 · 2026-11-14 19:05 UTC" */
export const VERSION_LABEL = `v${APP_VERSION} · ${APP_COMMIT} · ${APP_BUILD_TIME}`
