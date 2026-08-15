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

/**
 * What the workflow actually *runs*, with every comment left out.
 *
 * The assertions below used to read the whole file, and that made them
 * measure prose. A sentence mentioning `vite build` in an explanation counted
 * as a build; a step reordered in the text but described in an older comment
 * still satisfied an ordering check; and changing the word "Build" to "build"
 * in a heading could move an index. None of those are the deployment.
 *
 * So the shape claims are made against the `run:` bodies only - the shell that
 * the runner executes - collected here for both the inline form and YAML's
 * folded/literal block forms.
 */
function runCommands(): string[] {
  const lines = workflow().split("\n");
  const commands: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = /^(\s*)run:\s*(.*)$/u.exec(lines[index] ?? "");
    if (!match) continue;
    const indent = (match[1] ?? "").length;
    const inline = (match[2] ?? "").trim();
    if (inline !== "" && !/^[|>][-+]?$/u.test(inline)) {
      commands.push(inline);
      continue;
    }
    // A block scalar: every following line indented past the `run:` key.
    const body: string[] = [];
    for (let next = index + 1; next < lines.length; next += 1) {
      const line = lines[next] ?? "";
      if (line.trim() === "") continue;
      if (line.length - line.trimStart().length <= indent) break;
      body.push(line.trim());
    }
    commands.push(body.join(" "));
  }
  return commands;
}

/** Every executed command, in order, as one searchable string. */
function runScript(): string {
  return runCommands().join("\n");
}

/** The frontend package's scripts, which are the canonical build definitions. */
function packageScripts(): Record<string, string> {
  const parsed: unknown = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
  const scripts = (parsed as { scripts?: Record<string, string> }).scripts;
  expect(scripts, "package.json scripts bölümü yok").toBeDefined();
  return scripts ?? {};
}

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

/** The `deploy:` job's text, from its key to the end of the file. */
function deployJob(): string {
  const found = /\n {2}deploy:\n([\s\S]*)$/u.exec(workflow())?.[1];
  expect(found, "deploy adında bir iş yok").toBeDefined();
  return found ?? "";
}

/** The `build:` job's text: everything between its key and `deploy:`. */
function buildJob(): string {
  const found = /\n {2}build:\n([\s\S]*?)\n {2}deploy:\n/u.exec(workflow())?.[1];
  expect(found, "build adında bir iş yok").toBeDefined();
  return found ?? "";
}

describe("the workflow asks for exactly the permissions Pages needs", () => {
  it("defaults the whole workflow to reading the repository and nothing else", () => {
    // The top-level block: everything from `permissions:` to the next
    // top-level key. A capability granted here is granted to every job.
    const top = /\npermissions:\n([\s\S]*?)\n[a-z]/u.exec(workflow())?.[1] ?? "";
    expect(top, "üst düzey permissions bloğu yok").toMatch(/contents:\s*read/u);
    expect(top, "üst düzey blok Pages yazma yetkisi veriyor").not.toMatch(/pages:\s*write/u);
    expect(top, "üst düzey blok id-token yetkisi veriyor").not.toMatch(/id-token:\s*write/u);
  });

  /**
   * The build job runs third-party code; the deploy job publishes. Only one of
   * them may do both, and it must be neither.
   *
   * `build` installs dependencies, a browser and a bundler and then executes
   * them. If that job also held `pages: write`, every one of those would be
   * one step away from the live site. Splitting the permissions costs nothing
   * and removes the whole class.
   */
  it("keeps Pages write and the id token out of the build job", () => {
    const job = buildJob();
    expect(job, "build işi permissions bildirmiyor").toMatch(/permissions:/u);
    expect(job).toMatch(/contents:\s*read/u);
    expect(job, "build işi Pages'e yazabiliyor").not.toMatch(/pages:\s*write/u);
    expect(job, "build işi id-token üretebiliyor").not.toMatch(/id-token:\s*write/u);
  });

  it("grants them to the deploy job, which is the only job that publishes", () => {
    const job = deployJob();
    expect(job).toMatch(/permissions:/u);
    expect(job).toMatch(/pages:\s*write/u);
    expect(job).toMatch(/id-token:\s*write/u);
  });

  it("keeps the Pages API call on the side of the fence allowed to make it", () => {
    // `configure-pages` talks to the Pages API, so it belongs to the job that
    // holds `pages: write` rather than to the one that builds.
    expect(deployJob()).toMatch(/uses:\s*actions\/configure-pages@v\d+/u);
    expect(buildJob()).not.toMatch(/configure-pages/u);
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
  /**
   * The build is defined once, in `package.json`, and the workflow calls it.
   *
   * Three facts - the static-demo flag, the published base, the output
   * directory - decide what this publication *is*. Written out in the workflow
   * as well, they became a copy: the browser gate is run locally through the
   * package script, so a drift between the two meant the artifact a developer
   * gated and the artifact this file publishes were built differently from the
   * same commit, with nothing to notice it. So the script carries the
   * contract, and the workflow is pinned to calling that script.
   */
  it("builds through the canonical package script rather than a copy of it", () => {
    expect(runScript(), "workflow kanonik build scriptini çağırmıyor").toMatch(
      /pnpm run e2e:pages:build\b/u,
    );
    expect(runScript(), "workflow kendi vite build komutunu yazıyor").not.toMatch(/vite build/u);
  });

  it("keeps the flag, the published base and the output directory in that script", () => {
    const build = packageScripts()["e2e:pages:build"] ?? "";
    expect(build, "e2e:pages:build scripti yok").not.toBe("");
    // Exact: `isStaticDemoOnly()` compares against the string `true` and
    // nothing else, so `1` or `TRUE` here would publish a bundle that still
    // believes it has a backend.
    expect(build).toMatch(/VITE_STATIC_DEMO_ONLY=true\b/u);
    expect(build).toMatch(new RegExp(`--base ${PAGES_BASE}`, "u"));
    expect(build).toMatch(/--outDir dist-pages\b/u);
    expect(build).toMatch(/vite build/u);
  });

  it("runs the browser gate against that same script's output", () => {
    // The gate's config serves `dist-pages`; it must not build one of its own.
    const pages = readFileSync(join(process.cwd(), "playwright.pages.config.ts"), "utf8");
    expect(pages).toMatch(/--outDir dist-pages/u);
    expect(pages).not.toMatch(/vite build/u);
  });

  it("leaves the committed Vite config on the ordinary deployment's base", () => {
    // The normal deployment still serves the app from /uygulama/ behind the
    // FastAPI origin; only the published bundle carries the Pages path.
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
    expect(source).toMatch(/demo-refresh\.test\.tsx/u);
    expect(source).toMatch(/pages-deployment-contract\.test\.ts/u);
  });

  /**
   * The browser gate, pinned here because it is the one this publication
   * cannot do without.
   *
   * Every check above runs in jsdom, and jsdom cannot reload a document. The
   * defect that motivated this gate was exactly that shape: the demo opened,
   * the unit suite was green, and pressing F5 on the published site dropped
   * the visitor onto "Çalışma alanı açılamadı". A browser is what settles it,
   * so the browser run is a required step and not an optional one.
   *
   * It runs *after* the single build, not before it: the artifact it measures
   * has to exist to be measured. Nothing is uploaded past a red gate, so
   * "built" and "published" remain two different things.
   */
  it("runs the static-publication browser tests through their own config", () => {
    const source = workflow();
    expect(source).toMatch(/playwright install --with-deps chromium/u);
    expect(source).toMatch(/playwright test --config=playwright\.pages\.config\.ts/u);
  });

  /**
   * One build, and the gate measures the bytes that ship.
   *
   * This is the contract the split configs exist to make true. The workflow
   * builds `dist-pages` exactly once; the browser gate serves that directory
   * without rebuilding; `_site/uygulama` is a copy of it. Any second `vite
   * build` would reintroduce the failure this pins against - a gate that
   * passes on an artifact which is then thrown away and rebuilt before being
   * published.
   */
  it("invokes the static build exactly once", () => {
    const builds = runCommands().filter((command) => /e2e:pages:build\b/u.test(command));
    expect(builds.length, "statik yayın birden fazla kez derleniyor").toBe(1);
  });

  it("gates that artifact and then publishes the same directory", () => {
    const script = runScript();
    const build = script.indexOf("e2e:pages:build");
    const gate = script.indexOf("playwright test");
    const copy = script.indexOf("cp -R platform/frontend/dist-pages/. _site/uygulama/");
    expect(build, "statik derleme adımı yok").toBeGreaterThan(-1);
    expect(gate, "tarayıcı kapısı yok").toBeGreaterThan(-1);
    expect(copy, "_site/uygulama dist-pages'ten kopyalanmıyor").toBeGreaterThan(-1);
    expect(gate, "kapı derlemeden önce çalışıyor; ölçtüğü artifact yok").toBeGreaterThan(build);
    expect(copy, "kapıdan önce yayına kopyalanıyor").toBeGreaterThan(gate);
    // And the ordinary build's output directory is not what gets published.
    expect(script).not.toMatch(/cp -R platform\/frontend\/dist\/\./u);
  });

  /**
   * Two configs, and each one runs only what it is for.
   *
   * The ordinary suite must not build or serve the Pages artifact: it does not
   * publish it, and paying for a second concurrent Vite build on every
   * Frontend CI run is a cost with no reader. The static config must not build
   * at all - it serves what the workflow built, which is the whole point of
   * the single-build contract above.
   */
  it("keeps the static publication in its own Playwright config", () => {
    const ordinary = readFileSync(join(process.cwd(), "playwright.config.ts"), "utf8");
    // By project definition, not by the word: the ordinary config still names
    // the static *spec* - that is how it excludes it.
    expect(ordinary, "normal config statik projeleri tanımlıyor").not.toMatch(
      /name:\s*["']pages-static/u,
    );
    expect(ordinary, "normal config statik yayını sunuyor").not.toMatch(/dist-pages/u);
    expect(ordinary).not.toMatch(/VITE_STATIC_DEMO_ONLY/u);
    // The spec still lives in the shared directory, so it is ignored by name.
    expect(ordinary).toMatch(/testIgnore/u);
  });

  it("points that config at the published base, at both widths, and builds nothing", () => {
    const pages = readFileSync(join(process.cwd(), "playwright.pages.config.ts"), "utf8");
    expect(pages).toMatch(/name:\s*["']pages-static["']/u);
    expect(pages).toMatch(/name:\s*["']pages-static-320["']/u);
    expect(pages).toMatch(new RegExp(`4174${PAGES_BASE}`, "u"));
    expect(pages).toMatch(new RegExp(`--base ${PAGES_BASE}`, "u"));
    expect(pages).toMatch(/--outDir dist-pages/u);
    // 320px is the narrowest supported screen and the one the demo card
    // overflows first; a project that quietly widened would still be green.
    expect(pages).toMatch(/width:\s*320/u);
    // It serves; it does not build. A build here would be a second artifact.
    expect(pages, "statik config kendi derlemesini yapıyor").not.toMatch(/vite build/u);
  });

  it("orders lint, types and the unit gates before anything is built", () => {
    const script = runScript();
    const build = script.indexOf("e2e:pages:build");
    expect(build).toBeGreaterThan(-1);
    for (const gate of ["pnpm lint", "pnpm typecheck", "vitest run"]) {
      const index = script.indexOf(gate);
      expect(index, `${gate} çalıştırılmıyor`).toBeGreaterThan(-1);
      expect(index, `derleme ${gate} öncesinde çalışıyor`).toBeLessThan(build);
    }
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
