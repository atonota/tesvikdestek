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

/**
 * The static publication is *not* run from this config.
 *
 * It has its own - `playwright.pages.config.ts` - and the separation is not
 * tidiness. Two configs mean two servers and two builds, and holding both here
 * made every ordinary `pnpm e2e` (and every Frontend CI run) build the Pages
 * artifact as well: a second Vite build, started at the same moment as the
 * first, paid for by a job that never looks at its output. `testIgnore` below
 * keeps the spec out of these projects; the other config is what runs it.
 */
const PAGES_SPEC = /pages-static-demo\.spec\.ts/u;

/**
 * Whether the bundle under test was already built, moments ago, by the caller.
 *
 * `pnpm e2e` is self-contained on purpose: run on its own it builds the
 * production bundle and serves it, so nobody can accidentally test yesterday's
 * `dist/`. Inside `pnpm gate` that same self-containment is pure waste - the
 * gate's build step has just produced these exact bytes with these exact
 * settings, and building them again costs a full Vite build for no new
 * information.
 *
 * So the gate sets `DT_GATE_PREBUILT=1`, and only the gate does: it sets it
 * only on a run that also selected the build step (see `scripts/full-gate.mjs`),
 * which is what makes "already built" true rather than hopeful. Any other
 * invocation - a developer's `pnpm e2e`, CI's browser job - leaves it unset and
 * gets the build.
 */
const PREBUILT = process.env["DT_GATE_PREBUILT"] === "1";

/**
 * Serve the built bundle. Local binaries directly, so the command does not
 * depend on a package manager being on the spawned shell's PATH.
 */
const SERVE = "node_modules/.bin/vite preview --host 127.0.0.1 --port 4173 --strictPort";
const BUILD_AND_SERVE = `node_modules/.bin/vite build && ${SERVE}`;

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
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, testIgnore: PAGES_SPEC },
    { name: "mobile", use: { ...devices["Pixel 5"] }, testIgnore: PAGES_SPEC },
  ],
  webServer: {
    // Self-contained by default: builds and serves the real production bundle,
    // with no test-only flag. The only thing that changes it is the gate having
    // just built that same bundle; see `PREBUILT` above.
    command: PREBUILT ? SERVE : BUILD_AND_SERVE,
    url: "http://127.0.0.1:4173/uygulama/",
    reuseExistingServer: !process.env["CI"],
    timeout: 120_000,
  },
});
