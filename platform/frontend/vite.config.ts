import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
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
  /**
   * Tailwind's own Vite plugin, not a PostCSS chain.
   *
   * v4 replaces the PostCSS pipeline entirely; running both emits the generated
   * stylesheet twice. There is deliberately no `postcss.config.*` in this
   * package, and `master-stack-contract.test.ts` fails if one appears.
   */
  plugins: [tailwindcss(), react()],
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
            /**
             * zrender, the renderer ECharts draws through, split from it.
             *
             * Not a size trick: they are two packages on two release cycles,
             * and together they exceed the 500 kB threshold this build refuses
             * to raise. Split, each is comfortably under it and a chart-library
             * upgrade that does not move the renderer leaves the renderer's
             * cache entry intact.
             *
             * Declared *before* the ECharts group, and that ordering is
             * load-bearing. Under pnpm, zrender is installed inside the ECharts
             * package directory (`.pnpm/echarts@6.1.0/node_modules/zrender/`),
             * so the ECharts pattern matches its path too - first group to
             * match wins, and with the order reversed this group never fires
             * and the split silently does nothing.
             */
            {
              name: "zrender",
              test: /[\\/]node_modules[\\/](?:\.pnpm[\\/])?zrender[@\\/]/u,
            },
            /**
             * The chart engine, on its own.
             *
             * ECharts is the largest dependency in the package and it is
             * reached only through `React.lazy` from the dashboard's analytics
             * section. Left ungrouped it lands inside that section's chunk, so
             * the section's own code - a few kilobytes of option building -
             * shares a cache entry with half a megabyte of vendor code and is
             * re-downloaded whenever either changes.
             *
             * Grouping it also keeps every emitted chunk under Vite's 500 kB
             * warning threshold, which `build-contract.test.ts` asserts as a
             * contract. The threshold is not raised anywhere; the bundle is
             * split so it does not need to be.
             */
            {
              name: "echarts",
              test: /[\\/]node_modules[\\/](?:\.pnpm[\\/])?echarts[@\\/]/u,
            },
            /**
             * The icon set, on its own.
             *
             * Phosphor icons are used by the shell and by every screen, so they
             * are in the shared component graph by nature - and they move on
             * their own release cycle, like React. Splitting them means a
             * product deploy no longer invalidates a hundred kilobytes of SVG
             * paths in a visitor's cache, and it takes the shared component
             * chunk back under the warning threshold.
             */
            {
              name: "icons",
              test: /[\\/]node_modules[\\/](?:\.pnpm[\\/])?@phosphor-icons[\\/+]/u,
            },
          ],
        },
      },
    },
  },
});
