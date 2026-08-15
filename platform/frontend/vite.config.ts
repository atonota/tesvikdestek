import { fileURLToPath, URL } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * The application is served under `/uygulama/` so it can sit behind the same
 * origin as the FastAPI backend without touching a single line of Python.
 *
 * There is no CORS middleware in the backend (verified: zero `add_middleware`
 * calls in `platform/src`), so a cross-origin dev server simply cannot call the
 * API. The dev proxy below is therefore not a convenience, it is the only way
 * the app talks to the backend in development. Production needs the equivalent
 * reverse-proxy rule; that is an infrastructure decision, documented in
 * `docs/deployment.md`, and deliberately NOT applied here.
 */
const BACKEND_ORIGIN = process.env.DESTEKTESVIK_BACKEND_ORIGIN ?? "http://127.0.0.1:8000";

/** Backend paths that must stay same-origin. Kept in one place on purpose. */
const PROXIED_PATHS = [
  "/api",
  "/saglik",
  "/hazir",
  "/kayit",
  "/giris",
  "/cikis",
  "/profil",
  "/degerlendir",
  "/degerlendirmeler",
  "/kaynaklar",
  "/openapi.json",
  "/static",
] as const;

export default defineConfig({
  base: "/uygulama/",
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: Object.fromEntries(
      PROXIED_PATHS.map((path) => [
        path,
        { target: BACKEND_ORIGIN, changeOrigin: false, secure: false },
      ]),
    ),
  },
  build: {
    target: "es2022",
    /**
     * No public source maps.
     *
     * There is no private error-monitoring pipeline to upload them to, so
     * shipping them would publish the entire TypeScript source under
     * `/uygulama/assets/*.js.map` and roughly quadruple the deployed size, for
     * no one's benefit. If a monitoring service is adopted later the right
     * setting is `"hidden"` - maps generated, uploaded, and not referenced.
     */
    sourcemap: false,
    /**
     * One deterministic vendor group: React and the DOM renderer.
     *
     * The entry chunk had grown past Vite's 500 kB warning threshold. The
     * threshold is not the problem it reports, so it is left exactly where it
     * is - raising `chunkSizeWarningLimit` would replace a measurement with
     * silence. Instead the part of the bundle that never changes with product
     * code is emitted separately: React and react-dom move on their own release
     * cycle, so a product deploy no longer invalidates them in a user's cache.
     *
     * `codeSplitting` is Rolldown's supported manual-chunking API, reached in
     * Vite 8 through `build.rolldownOptions`. (Its predecessor `advancedChunks`
     * still works but logs a deprecation warning, and a build that warns is a
     * build nobody reads.) The `test` pattern is anchored to
     * the package directory so `react-router`, `react-hook-form` and every other
     * `react-*` package stay with the application code they are used by.
     */
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "react",
              test: /[\\/]node_modules[\\/](?:\.pnpm[\\/])?(?:react|react-dom|scheduler)[@\\/]/u,
            },
          ],
        },
      },
    },
  },
});
