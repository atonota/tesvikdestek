import { defineConfig, devices } from "@playwright/test";

/**
 * The GitHub Pages publication, and nothing else.
 *
 * A second config rather than two more projects in `playwright.config.ts`,
 * for two reasons that are both about what a run costs and what it proves:
 *
 *   - **cost.** The ordinary suite builds `/uygulama/` and serves it. Holding
 *     the static publication in the same config made every ordinary run build
 *     the Pages artifact too - a second Vite build, concurrent with the first,
 *     for an artifact that run never opens. Frontend CI should not pay for a
 *     publication it does not publish.
 *   - **honesty about the artifact.** This config **does not build**. It
 *     serves `dist-pages` as it finds it, so the bytes under test are the
 *     bytes somebody else produced - in CI, the single build whose output is
 *     then copied into `_site/uygulama` and deployed. A config that rebuilt
 *     here would be testing an artifact that no longer exists by the time the
 *     site is published, and the whole point of this gate is that the thing
 *     measured and the thing published are the same thing.
 *
 * So `dist-pages` has to exist before this runs. `pnpm e2e:pages` builds it
 * with the right flag and base and then runs this config;
 * `.github/workflows/pages.yml` does the same two steps around the single
 * build it publishes.
 */

/** The one spec that belongs to the static publication. */
const PAGES_SPEC = /pages-static-demo\.spec\.ts/u;

/** The published address, served locally at the base Pages will use. */
const PAGES_URL = "http://127.0.0.1:4174/tesvikdestek/uygulama/";

export default defineConfig({
  testDir: "./e2e",
  testMatch: PAGES_SPEC,
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 1 : 0,
  workers: process.env["CI"] ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: PAGES_URL,
    trace: "on-first-retry",
    locale: "tr-TR",
  },
  expect: { timeout: 10_000 },
  projects: [
    /*
     * Two widths, one spec. 320px is not decoration: it is the narrowest
     * screen this product supports, and the demo card - which prints an
     * unbreakable 34-character address - is where a layout widens first.
     */
    { name: "pages-static", use: { ...devices["Desktop Chrome"] } },
    {
      name: "pages-static-320",
      use: { ...devices["Desktop Chrome"], viewport: { width: 320, height: 568 } },
    },
  ],
  webServer: {
    /*
     * Preview only - no build. See the note above: this serves the artifact it
     * is given. `--base` is passed because `vite preview` reads the base from
     * `vite.config.ts` (`/uygulama/`) otherwise, and would then answer the
     * published paths with a 404 and a helpful suggestion nobody asked for.
     */
    command:
      "node_modules/.bin/vite preview --outDir dist-pages --base /tesvikdestek/uygulama/ " +
      "--host 127.0.0.1 --port 4174 --strictPort",
    url: PAGES_URL,
    reuseExistingServer: !process.env["CI"],
    timeout: 120_000,
  },
});
