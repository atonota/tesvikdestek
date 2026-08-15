/**
 * No mocking machinery may reach a production artifact.
 *
 * This guard exists because the claim "the production bundle contains no MSW
 * worker" was made and was false: the runtime import had been removed, but
 * `public/mockServiceWorker.js` was still tracked, and Vite copies `public/`
 * into `dist/` verbatim. A 9,666-byte request interceptor shipped to users
 * while the report said it did not.
 *
 * The lesson encoded here: removing an import is not removing an artifact, and
 * a claim about a build output has to be checked against the build output.
 * The same guard now also pins the *shape* of `dist/`, because the report made
 * a second false claim about it - "no other files" while six `.js.map` files
 * totalling 2.46 MB sat beside the bundle.
 *
 * It also checks that the configuration *describes* the harness that actually
 * runs. Comments that claim a service-worker handshake, when the browser tests
 * use Playwright request routing, send the next reader looking for a mechanism
 * that is not there.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const PUBLIC_DIR = join(ROOT, "public");
const DIST_DIR = join(ROOT, "dist");

const WORKER_FILENAME = "mockServiceWorker.js";

/** This file names the patterns it forbids, so it cannot scan itself. */
const SELF = "no-mock-artifacts.test.ts";

/**
 * Words that turn a mention into a denial.
 *
 * The configuration has to be able to say "no service worker is installed"
 * without tripping a guard that only looks for the phrase. Same rule as the
 * truth guard: a claim is forbidden, its denial is required.
 */
const DENIAL = /\bno\b|\bnot\b|\bnever\b|\bno-op\b|\babsent\b|deliberately|instead of/iu;

/**
 * Sentences that assert the given pattern rather than denying it.
 *
 * Comment prose wraps across lines, so the denial for a phrase is often on the
 * next physical line. Comment markers are stripped and the text rejoined before
 * splitting on sentence terminators, so a sentence is judged whole.
 */
function claimingSentences(text: string, pattern: RegExp): string[] {
  const prose = text
    .split("\n")
    .map((line) => line.replace(/^\s*(#|\/\/|\*|\/\*)\s?/u, ""))
    .join(" ");
  return prose
    .split(/[.!?;]/u)
    .filter((sentence) => pattern.test(sentence))
    .filter((sentence) => !DENIAL.test(sentence))
    .map((sentence) => sentence.trim());
}

function filesUnder(directory: string): string[] {
  if (!existsSync(directory)) return [];
  const found: string[] = [];
  const walk = (current: string) => {
    for (const entry of readdirSync(current)) {
      const full = join(current, entry);
      if (statSync(full).isDirectory()) walk(full);
      else found.push(full);
    }
  };
  walk(directory);
  return found;
}

describe("no mock service worker is shipped", () => {
  it("public/ does not contain a mock service worker", () => {
    // `public/` is copied verbatim into `dist/`, so this is the root cause.
    expect(existsSync(join(PUBLIC_DIR, WORKER_FILENAME))).toBe(false);
  });

  it("public/ contains no mocking artifact under any name", () => {
    const offenders = filesUnder(PUBLIC_DIR).filter((file) =>
      /mock|msw/iu.test(file.replace(ROOT, "")),
    );
    expect(offenders).toEqual([]);
  });

  it("the built output, when present, contains no mock service worker", () => {
    if (!existsSync(DIST_DIR)) {
      // Nothing built yet in this working tree; the public/ guards above are
      // what prevent it from ever appearing.
      return;
    }
    const offenders = filesUnder(DIST_DIR).filter((file) =>
      /mockserviceworker/iu.test(file),
    );
    expect(offenders).toEqual([]);
  });

  it("the built output, when present, contains no MSW runtime code", () => {
    if (!existsSync(DIST_DIR)) return;
    const offenders = filesUnder(DIST_DIR)
      .filter((file) => file.endsWith(".js"))
      .filter((file) => /setupWorker|msw\/browser/u.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });
});

describe("the production build ships exactly what is claimed", () => {
  const dist = () => filesUnder(DIST_DIR).map((file) => file.replace(`${DIST_DIR}/`, ""));

  it("publishes no source maps", () => {
    if (!existsSync(DIST_DIR)) return;
    expect(dist().filter((file) => file.endsWith(".map"))).toEqual([]);
  });

  it("references no source map from a shipped asset", () => {
    if (!existsSync(DIST_DIR)) return;
    const referencing = filesUnder(DIST_DIR)
      .filter((file) => /\.(js|css)$/u.test(file))
      .filter((file) => /sourceMappingURL/u.test(readFileSync(file, "utf8")))
      .map((file) => file.replace(`${DIST_DIR}/`, ""));
    expect(referencing).toEqual([]);
  });

  it("is one HTML document, three stylesheets, ten scripts, two fonts - and nothing else", () => {
    if (!existsSync(DIST_DIR)) return;
    const files = dist();
    const byKind = (extension: string) => files.filter((file) => file.endsWith(extension));

    expect(byKind(".html")).toHaveLength(1);
    // One stylesheet became three when `/dosyalar` and `/ayarlar/yapay-zeka`
    // mounted the file library and the provider connection centre. The two
    // extra sheets are the point rather than a regression: each is imported by
    // exactly one route module, so Rolldown emits it beside that route's lazy
    // chunk and only a visitor who opens the route downloads it. The group
    // below checks that neither of them is reachable from the entry document.
    expect(byKind(".css")).toHaveLength(3);
    // Eight scripts became nine when the adaptive shell and the form layer
    // entered the shared component barrel: Rolldown split the components out
    // of the entry chunk. The count is pinned rather than loosened - a further
    // script is a question to answer, not a detail to absorb.
    //
    // It has now been asked twice. `/dosyalar` added a route chunk while the
    // `queries` chunk folded into the entry, so nine stayed nine.
    // `/ayarlar/yapay-zeka` added the tenth, and that one is load-bearing: it
    // is the provider catalogue, wizard and inventory, reached by its own path
    // rather than through the shared component barrel. Folding it back into
    // the components chunk would put it into every signed-in visitor's first
    // paint, which is exactly what this count exists to notice.
    expect(byKind(".js")).toHaveLength(10);
    // Two font files, and exactly two: Roboto's Latin and Latin Extended
    // weight axes. The package ships 54 files across nine unicode subsets and
    // both italic sets; `src/design/roboto.css` declares only the two faces a
    // Turkish interface renders, so only those two are emitted.
    expect(byKind(".woff2")).toHaveLength(2);
    // The sum is the whole directory: nothing unaccounted for.
    expect(files).toHaveLength(16);
  });

  /**
   * The three route-scoped assets are lazy, and this is what proves it.
   *
   * The counts above would be satisfied by a build that emitted the media and
   * provider chunks *and* preloaded them from `index.html` - which would be the
   * old defect wearing new file names, every visitor paying for two routes most
   * of them never open. The entry document is the authority on what is eager,
   * so it is read rather than inferred from a naming convention.
   */
  it("references none of the route-scoped chunks from the entry document", () => {
    if (!existsSync(DIST_DIR)) return;
    const document = readFileSync(join(DIST_DIR, "index.html"), "utf8");
    const referenced = [...document.matchAll(/\/assets\/([\w.-]+)/gu)].map(
      (match) => match[1] as string,
    );

    // The guard sees the document it is supposed to see.
    expect(referenced.length).toBeGreaterThan(3);

    const eagerRouteAssets = referenced.filter((asset) =>
      /^(?:media|providers)-/u.test(asset),
    );
    expect(
      eagerRouteAssets,
      "rota kapsamlı varlıklar giriş belgesinden çağrılıyor; tembel yükleme kayboldu",
    ).toEqual([]);

    // Exactly one stylesheet is eager. The other two are the lazy ones counted
    // above, and a build that made them eager would fail here rather than pass
    // quietly with three sheets in the directory.
    expect(referenced.filter((asset) => asset.endsWith(".css"))).toHaveLength(1);
  });

  it("ships no font subset this product cannot read", () => {
    if (!existsSync(DIST_DIR)) return;
    const fonts = dist().filter((file) => file.endsWith(".woff2"));
    for (const font of fonts) {
      expect(font).toMatch(/roboto-latin(-ext)?-wght-normal/u);
    }
    expect(fonts.filter((font) => /cyrillic|greek|vietnamese|italic/u.test(font))).toEqual([]);
  });
});

describe("MSW stays confined to the Node test interceptor", () => {
  it("no application source imports the browser worker", () => {
    const offenders = filesUnder(join(ROOT, "src"))
      .filter((file) => /\.tsx?$/u.test(file))
      .filter((file) => !file.endsWith(SELF))
      .filter((file) => /msw\/browser|setupWorker/u.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("package.json does not ask MSW to install a worker anywhere", () => {
    const manifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as Record<
      string,
      unknown
    >;
    expect(manifest["msw"]).toBeUndefined();
  });

  it("the Node interceptor is still the one MSW entry point in use", () => {
    const server = readFileSync(join(ROOT, "src", "mocks", "server.ts"), "utf8");
    expect(server).toContain("msw/node");
  });
});

describe("the end-to-end configuration describes the harness that runs", () => {
  const playwrightConfig = () => readFileSync(join(ROOT, "playwright.config.ts"), "utf8");

  it("does not claim a service worker intercepts anything", () => {
    const text = playwrightConfig();
    expect(claimingSentences(text, /service worker/iu)).toEqual([]);
    expect(claimingSentences(text, /\bMSW\b/u)).toEqual([]);
    expect(claimingSentences(text, /worker handshake/iu)).toEqual([]);
  });

  it("does not claim a mock-enabled build", () => {
    expect(playwrightConfig()).not.toMatch(/VITE_USE_MOCKS/u);
  });

  it("names the mechanism it actually uses", () => {
    expect(playwrightConfig()).toMatch(/request routing/iu);
  });

  it("the pnpm workspace notes do not claim the worker benefits Storybook or Playwright", () => {
    const workspace = readFileSync(join(ROOT, "pnpm-workspace.yaml"), "utf8");
    expect(claimingSentences(workspace, /service worker/iu)).toEqual([]);
    expect(workspace).not.toMatch(/Storybook and Playwright benefit/iu);
  });

  it("the guard still catches a config that claims interception", () => {
    // A guard that can only pass is decorative. This proves it can fail.
    const lie = "# The MSW service worker intercepts every API call in the browser.";
    expect(claimingSentences(lie, /service worker/iu)).not.toEqual([]);
  });
});
