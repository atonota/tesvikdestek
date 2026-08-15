import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests.
 *
 * These run against the built SPA served by Vite's preview server, with the
 * backend faked by Playwright request routing (see `e2e/mock-api.ts`). Nothing
 * is installed into the page: no service worker, no mock bundle, no build flag.
 * The artifact under test is the same one a user would receive.
 *
 * It is still a *mocked* backend, and every spec title says so - claiming full
 * real-backend E2E without a live PostgreSQL and a running FastAPI would be
 * exactly the kind of unearned green this product exists to avoid.
 *
 * The build under test is the *production* build, mounted at `/uygulama/`
 * exactly as the reverse proxy will mount it. Only the backend is faked.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 1 : 0,
  workers: process.env["CI"] ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4173/uygulama/",
    trace: "on-first-retry",
    locale: "tr-TR",
  },
  // The first paint waits on a lazy route chunk and, in this harness, on the
  // preview server's first response. Ten seconds is patience, not tolerance
  // for a broken assertion.
  expect: { timeout: 10_000 },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 5"] } },
  ],
  webServer: {
    // Self-contained on purpose: builds and serves the real production bundle,
    // with no test-only flag. Uses the local binaries directly so it does not
    // depend on a package manager being on the spawned shell's PATH.
    command:
      "node_modules/.bin/vite build && node_modules/.bin/vite preview --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173/uygulama/",
    reuseExistingServer: !process.env["CI"],
    timeout: 120_000,
  },
});
