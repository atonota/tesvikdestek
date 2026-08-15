/**
 * The GitHub Pages publication, pinned as a contract rather than as a habit.
 *
 * A deployment workflow is the one file in this repository whose failure mode
 * is invisible from the inside: every test can be green, the bundle can be
 * correct, and the published site can still be a 404 - or, far worse, a page
 * that looks like the product and quietly asks a visitor for a password no
 * backend will ever receive. Pages serves static files and nothing else. There
 * is no FastAPI process behind `atonota.github.io`, so a login form that posts
 * to `/giris` there is not a broken feature, it is a form that collects
 * credentials and drops them.
 *
 * So this file asserts on the workflow *source*, deliberately:
 *
 *   - **on the text, not on a parsed object.** Adding a YAML parser to pin a
 *     YAML file means the assertion is only as true as the parser's agreement
 *     with GitHub's, and a new production dependency for a test is a cost paid
 *     by every install forever. The claims below are all shape claims - a key
 *     exists, a version is current, a flag is set - and a regex over the source
 *     settles them without inventing a second YAML dialect.
 *   - **on the pinned major versions.** A deploy that silently runs a
 *     deprecated `upload-pages-artifact` is a deploy that stops one morning for
 *     reasons unrelated to anything anybody changed.
 *   - **on the ordering of the gates.** `needs:` is what makes the deploy job
 *     conditional on the checks; without it the two jobs simply race, and a
 *     red test suite publishes anyway.
 *
 * What this file cannot prove, stated so nobody reads more into a green run:
 * that the workflow *runs* correctly on GitHub. It proves the file says what
 * this change package intended it to say. The run itself is the evidence, and
 * it is the MASTER's to collect.
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The repository root, reached from the package rather than from a guess.
 *
 * `architecture.test.ts` already pins that this package lives at
 * `platform/frontend`, so two levels up is the root by an invariant another
 * test defends rather than by coincidence.
 */
const REPO_ROOT = resolve(process.cwd(), "..", "..");
const WORKFLOW_PATH = join(REPO_ROOT, ".github", "workflows", "pages.yml");

function workflow(): string {
  expect(
    existsSync(WORKFLOW_PATH),
    ".github/workflows/pages.yml yok; Pages yayını tanımlı değil",
  ).toBe(true);
  return readFileSync(WORKFLOW_PATH, "utf8");
}

/** The published application's own address. Spelled once, asserted everywhere. */
const PAGES_BASE = "/tesvikdestek/uygulama/";

describe("the Pages workflow exists and is triggered the way a release is", () => {
  it("is a file in the standard workflow directory", () => {
    expect(existsSync(WORKFLOW_PATH)).toBe(true);
  });

  it("publishes from main, and never from an arbitrary branch", () => {
    const source = workflow();
    expect(source).toMatch(/on:/u);
    expect(source).toMatch(/push:\s*\n\s*branches:\s*\[\s*["']?main["']?\s*\]/u);
    // A wildcard branch trigger would publish every feature branch over the
    // live site, which is the failure this assertion exists to make loud.
    expect(source).not.toMatch(/branches:\s*\[\s*["']\*\*["']\s*\]/u);
  });

  it("can also be run by hand, so a republish needs no empty commit", () => {
    expect(workflow()).toMatch(/^\s*workflow_dispatch:\s*$/mu);
  });
});

describe("the workflow asks for exactly the permissions Pages needs", () => {
  it("reads the repository, writes Pages, and mints an id token", () => {
    const source = workflow();
    expect(source).toMatch(/permissions:/u);
    expect(source).toMatch(/^\s*contents:\s*read\s*$/mu);
    expect(source).toMatch(/^\s*pages:\s*write\s*$/mu);
    expect(source).toMatch(/^\s*id-token:\s*write\s*$/mu);
  });

  it("never asks for write access to the repository contents", () => {
    expect(workflow()).not.toMatch(/^\s*contents:\s*write\s*$/mu);
  });

  it("deploys through the github-pages environment and reports its URL", () => {
    const source = workflow();
    expect(source).toMatch(/environment:/u);
    expect(source).toMatch(/name:\s*github-pages/u);
    // The environment's URL is the deployment's own output, not a string
    // somebody typed - a typed one goes stale the day the repository is renamed.
    expect(source).toMatch(/url:\s*\$\{\{\s*steps\.[\w-]+\.outputs\.page_url\s*\}\}/u);
  });
});

describe("the workflow pins the current official actions", () => {
  it.each([
    ["actions/checkout", 6],
    ["actions/setup-node", 6],
    ["actions/configure-pages", 6],
    ["actions/upload-pages-artifact", 5],
    ["actions/deploy-pages", 5],
  ])("uses %s at v%i", (action, major) => {
    const source = workflow();
    const used = [...source.matchAll(new RegExp(`uses:\\s*${action}@v(\\d+)`, "gu"))].map(
      (match) => Number(match[1]),
    );
    expect(used.length, `${action} hiç kullanılmıyor`).toBeGreaterThan(0);
    for (const version of used) {
      expect(version, `${action} güncel olmayan v${version} ile sabitlenmiş`).toBe(major);
    }
  });

  it("pins every action to a major version rather than to a moving branch", () => {
    const source = workflow();
    const unpinned = [...source.matchAll(/uses:\s*(\S+)/gu)]
      .map((match) => match[1] ?? "")
      .filter((reference) => !/@v\d+/u.test(reference) && !/@[0-9a-f]{40}/u.test(reference));
    expect(unpinned, "sürüm sabitlenmemiş action").toEqual([]);
  });
});

describe("the published bundle is a static demo and is built as one", () => {
  it("builds with the static-demo flag explicitly on", () => {
    const source = workflow();
    expect(source).toMatch(/VITE_STATIC_DEMO_ONLY:\s*["']?true["']?/u);
  });

  it("overrides the Vite base to the Pages path, on the command line", () => {
    const source = workflow();
    expect(source).toMatch(new RegExp(`--base\\s+${PAGES_BASE}`, "u"));
    // And the committed config is left alone: the normal deployment still
    // serves the app from /uygulama/ behind the FastAPI origin.
    const config = readFileSync(join(process.cwd(), "vite.config.ts"), "utf8");
    expect(config).toMatch(/base:\s*["']\/uygulama\/["']/u);
    expect(config).not.toMatch(/tesvikdestek/u);
  });
});

describe("the artifact has the shape the published URL implies", () => {
  it("uploads _site as the site root", () => {
    const source = workflow();
    const upload = /uses:\s*actions\/upload-pages-artifact@v\d+[\s\S]{0,200}?path:\s*(\S+)/u.exec(
      source,
    );
    expect(upload, "upload-pages-artifact adımı bir path vermiyor").not.toBeNull();
    expect(upload?.[1]?.replace(/^\.\//u, "").replace(/\/$/u, "")).toBe("_site");
  });

  it("puts the application under _site/uygulama, matching the base path", () => {
    expect(workflow()).toMatch(/_site\/uygulama/u);
  });

  it("writes a root index.html that forwards to the application", () => {
    const source = workflow();
    expect(source).toMatch(/_site\/index\.html/u);
    // Relative, so the redirect survives the repository being renamed.
    expect(source).toMatch(/\.\/uygulama\//u);
  });

  it("writes a 404.html so a deep link into the SPA is not a dead end", () => {
    // `/tesvikdestek/uygulama/giris` is not a file on disk. Pages answers it
    // with the site's 404 document, so that document has to be the app itself.
    expect(workflow()).toMatch(/_site\/404\.html/u);
  });

  it("writes .nojekyll, or every asset directory starting with _ disappears", () => {
    expect(workflow()).toMatch(/_site\/\.nojekyll/u);
  });
});

describe("nothing is published until the checks that matter have passed", () => {
  it("runs lint, type check and the targeted tests before building", () => {
    const source = workflow();
    expect(source).toMatch(/pnpm lint/u);
    expect(source).toMatch(/pnpm typecheck/u);
    expect(source).toMatch(/demo-login\.test\.tsx/u);
    expect(source).toMatch(/pages-deployment-contract\.test\.ts/u);
  });

  it("orders the gates before the build rather than beside it", () => {
    const source = workflow();
    const lint = source.indexOf("pnpm lint");
    const build = source.indexOf("--base");
    expect(lint).toBeGreaterThan(-1);
    expect(build).toBeGreaterThan(-1);
    expect(lint, "derleme lint'ten önce çalışıyor").toBeLessThan(build);
  });

  it("makes the deploy job wait for the build job", () => {
    const source = workflow();
    const deployJob = /jobs:[\s\S]*?\n {2}deploy:\n([\s\S]*)$/u.exec(source);
    expect(deployJob, "deploy adında bir iş yok").not.toBeNull();
    expect(deployJob?.[1]).toMatch(/needs:\s*build/u);
    expect(deployJob?.[1]).toMatch(/uses:\s*actions\/deploy-pages@v\d+/u);
  });

  it("keeps the deploy job free of the build steps, so it cannot publish on its own", () => {
    const source = workflow();
    const deployJob = /\n {2}deploy:\n([\s\S]*)$/u.exec(source)?.[1] ?? "";
    expect(deployJob).not.toMatch(/--base/u);
    expect(deployJob).not.toMatch(/upload-pages-artifact/u);
  });
});
