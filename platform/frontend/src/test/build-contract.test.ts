/**
 * What the production build is allowed to contain.
 *
 * Two claims are pinned here, both of which were false when this file was
 * written, and both of which are invisible in any component test:
 *
 * 1. **No dead stylesheet.** The application entry imported the media
 *    stylesheet globally while no route renders a media component, so every
 *    user downloaded rules that nothing could apply. Where it may be imported
 *    instead - and why the subsystem's own entry cannot own it - is recorded on
 *    the first group below, next to the measurement that settled it.
 *
 * 2. **No oversized chunk.** The entry chunk crossed Vite's 500 kB warning
 *    threshold. The threshold is the contract; raising `chunkSizeWarningLimit`
 *    would silence the measurement rather than fix the build, so that escape
 *    hatch is forbidden here too.
 *
 * The structural half runs everywhere. The artifact half needs `dist/`, and
 * follows the convention of `no-mock-artifacts.test.ts`: when nothing has been
 * built in this working tree it returns rather than inventing a verdict.
 *
 * That early return used to be the whole story, and it left a hole big enough
 * to drive the original bug back through. `.github/workflows/frontend-ci.yml`
 * runs the test suite *before* the production build and never runs a guard
 * after it, so on a fresh checkout `dist/` did not exist while these
 * assertions ran: every one of them returned, reported green, and proved
 * nothing about the artifact CI had just produced. A guard that silently
 * abstains is worse than no guard, because the run still says PASS.
 *
 * The fix is not a comment asking people to remember. `package.json`'s `build`
 * script now runs these two guard files itself, immediately after `vite build`,
 * against the `dist/` it just produced - and the first group below reads that
 * script and fails if the ordering is ever removed. So the artifact half is
 * enforced by the build, not by process discipline, and it is enforced in CI
 * and on a laptop by the same one command.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const DIST_ASSETS = join(ROOT, "dist", "assets");

/** Vite's default warning threshold, in kB. Read, never rewritten. */
const CHUNK_WARNING_LIMIT_BYTES = 500 * 1000;

/**
 * The two files that may only report a verdict about a `dist/` that exists.
 *
 * Named exactly rather than matched by a pattern: a glob would let a future
 * rename quietly drop one of them from the build, which is the same class of
 * silent-abstention failure this whole group exists to close.
 */
const ARTIFACT_GUARD_FILES = [
  "src/test/build-contract.test.ts",
  "src/test/no-mock-artifacts.test.ts",
] as const;

/** A selector that exists only in the media stylesheet. */
const MEDIA_ONLY_SELECTOR = "dt-media";

/** A selector that exists only in the provider connection stylesheet. */
const PROVIDER_ONLY_SELECTOR = "dt-provider-wizard";

/** A selector that must survive, so an empty stylesheet cannot pass. */
const GRID_SELECTOR = "dt-grid";

/**
 * An *import* of the media stylesheet, not a mention of it.
 *
 * The distinction matters: `main.tsx` and this file both have to be able to
 * explain in prose why the import is absent, and a guard that forbids the words
 * would forbid the explanation.
 */
const MEDIA_CSS_IMPORT = /import\s+["'][^"']*media\.css["']/u;

/** The same distinction, for the provider connection stylesheet. */
const PROVIDER_CSS_IMPORT = /import\s+["'][^"']*provider-connections\.css["']/u;

/**
 * An *import* of the provider subsystem from the shared component barrel.
 *
 * The barrel is imported by every route, so a re-export from it puts the whole
 * subsystem into the production graph whether or not anything renders it. The
 * media subsystem is re-exported and the measurement above records what that
 * costs for a 4.7 kB stylesheet; this subsystem is larger and equally routeless,
 * so it is reached by its own path instead. Prose about the decision has to stay
 * legal, hence matching the import rather than the words.
 */
const PROVIDER_BARREL_EXPORT = /export\s+\*\s+from\s+["']\.\/provider-connections["']/u;

/** react-dom ships this URL in its error path; minification keeps the string. */
const REACT_DOM_MARKER = "react.dev/errors";

/**
 * A sentence that exists only in the provider catalogue.
 *
 * A string literal survives minification, so its presence in a chunk is proof
 * the subsystem's code is in that chunk - which is a stronger claim than any
 * file name can make.
 */
const PROVIDER_JS_MARKER = "Barındırıcı tarafından yönetilen oturum";

/** Every TypeScript module under `src/`, excluding this guard itself. */
function filesUnderSrc(): string[] {
  const found: string[] = [];
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory)) {
      const full = join(directory, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/u.test(entry) && entry !== "build-contract.test.ts") found.push(full);
    }
  };
  walk(SRC);
  return found;
}

/**
 * Every source file under `src/`, read as bytes rather than as text.
 *
 * `filesUnderSrc` returns paths; every other group here then reads them with an
 * `"utf8"` decode, because every other claim is about what the source *says*.
 * This one is about what the file *is*, so it reads the same paths without an
 * encoding and asserts on the bytes.
 *
 * The distinction is not that a decoded read could not find a NUL - it can, a
 * string that holds `\0` matches a search for `\0` like any other character.
 * It is that a decode is a lossy answer to a byte-level question: it assumes an
 * encoding, and any sequence that is not valid UTF-8 comes back as U+FFFD, so
 * what the assertion inspects is a repaired reconstruction rather than the
 * bytes Git, `grep` and `file` classify. Those tools are the ones this contract
 * is about, and they read bytes, so the guard reads bytes.
 */
function sourceBytes(): Array<{ readonly file: string; readonly bytes: Buffer }> {
  return filesUnderSrc().map((file) => ({ file, bytes: readFileSync(file) }));
}

function assets(): string[] {
  if (!existsSync(DIST_ASSETS)) return [];
  return readdirSync(DIST_ASSETS).filter((entry) =>
    statSync(join(DIST_ASSETS, entry)).isFile(),
  );
}

/**
 * The assets a visitor downloads before any route has been chosen.
 *
 * Read out of `dist/index.html` rather than guessed from file names: the entry
 * script, everything it preloads, and the stylesheet the document links are
 * *exactly* the eager set, and that is a fact about the emitted document rather
 * than about a naming convention that could change with a Vite release.
 *
 * Anything under `dist/assets` that is not in this set is only fetched when a
 * dynamic import asks for it - which is the whole claim a lazy route makes.
 */
function entryAssets(): string[] {
  const document = join(ROOT, "dist", "index.html");
  if (!existsSync(document)) return [];
  return [...readFileSync(document, "utf8").matchAll(/\/assets\/([\w.-]+)/gu)].map(
    (match) => match[1] as string,
  );
}

/** Emitted assets the entry document does not reference: the lazy half. */
function lazyAssets(): string[] {
  const eager = new Set(entryAssets());
  return assets().filter((asset) => !eager.has(asset));
}

function read(asset: string): string {
  return readFileSync(join(DIST_ASSETS, asset), "utf8");
}

function bytes(asset: string): number {
  return statSync(join(DIST_ASSETS, asset)).size;
}

/**
 * The build must check the artifact it just produced.
 *
 * Every assertion further down that touches `dist/` returns early when `dist/`
 * is absent. That is the right behaviour for a working tree nobody has built
 * in - but it means the guards are only load-bearing if something runs them
 * *after* a build. CI ran them before, so they abstained and reported green.
 *
 * This group closes that by making the ordering part of the build script and
 * checking the script here. It reads `package.json` rather than shelling out:
 * a test that ran `pnpm build` would recurse into itself, take minutes, and
 * assert nothing a string comparison cannot.
 */
describe("the build script runs the artifact guards after building", () => {
  const buildScript = (): string => {
    const manifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    return manifest.scripts["build"] ?? "";
  };

  it("still type checks and builds", () => {
    // The two steps that were already there must survive this change.
    const script = buildScript();
    expect(script).toContain("tsc -b --noEmit");
    expect(script).toContain("vite build");
  });

  it("runs both artifact guard files, named exactly", () => {
    const script = buildScript();
    for (const file of ARTIFACT_GUARD_FILES) {
      expect(script).toContain(file);
    }
  });

  it("runs them after the build, not before", () => {
    // The ordering *is* the fix. Before the build, `dist/` holds the previous
    // run's output at best and nothing at all on a fresh checkout.
    const script = buildScript();
    const built = script.indexOf("vite build");
    const guarded = script.indexOf("vitest run");
    expect(built).toBeGreaterThanOrEqual(0);
    expect(guarded).toBeGreaterThan(built);
    for (const file of ARTIFACT_GUARD_FILES) {
      expect(script.indexOf(file)).toBeGreaterThan(built);
    }
  });

  it("chains the steps so a failure stops the build", () => {
    // `&&` and not `;`: a guard whose failure is discarded is decoration.
    const script = buildScript();
    const afterBuild = script.slice(script.indexOf("vite build"));
    expect(afterBuild).toMatch(/vite build\s*&&\s*/u);
    expect(script).not.toMatch(/;\s*vitest/u);
  });

  it("targets only those two files, so the build does not re-run the suite", () => {
    // A bare `vitest run` here would re-run every test on every build - slow,
    // and it would drag component tests into a step that is about artifacts.
    const script = buildScript();
    const invocation = script.slice(script.indexOf("vitest run") + "vitest run".length).trim();
    const args = invocation.split(/\s+/u).filter((argument) => argument.length > 0);
    expect(args).toEqual([...ARTIFACT_GUARD_FILES]);
  });

  it("does not re-apply coverage thresholds to a two-file run", () => {
    // Global thresholds against two guard files would fail on arithmetic, not
    // on a defect. Coverage belongs to `test:coverage`, which runs the suite.
    expect(buildScript()).not.toContain("--coverage");
  });
});

/**
 * Where the media stylesheet is imported, and why it is exactly one place.
 *
 * The original rule here was "nowhere in `src/`", and it was the right rule for
 * as long as it was true that no route rendered a media component. It was never
 * a rule about the words `media.css`; it was a rule about who pays for them.
 * `main.tsx` imported the stylesheet globally while nothing could apply it, so
 * every visitor downloaded 4.7 kB of dead rules. Loading it from
 * `src/components/media/index.ts` was tried next and measured: the built
 * stylesheet stayed at 31,470 bytes with the media rules still in it, because
 * `src/components/index.ts` re-exports `./media` - a contract pinned by
 * `media-acceptance.test.tsx` - and every route imports that barrel, so a CSS
 * import there is a side effect in everybody's graph.
 *
 * `/dosyalar` changes the answer rather than the question. The route module is
 * reached only through the router's dynamic `import()`, so an import *there*
 * puts the rules in that chunk's own stylesheet: the visitor who opens the file
 * library downloads them, and the visitor who never does, does not. That is now
 * the rule, and it is narrower than "nowhere" rather than weaker - exactly one
 * runtime module may import it, and it must be that route.
 *
 * The JavaScript is a separate matter and is deliberately not claimed here. The
 * barrel re-export puts the media components in the shared component chunk
 * whatever this route does; the provider centre below is the subsystem that
 * shows what avoiding the barrel buys.
 */
describe("the media stylesheet travels with the route that renders it", () => {
  const MEDIA_ROUTE = join(SRC, "routes", "media.tsx");

  it("the application entry imports no media stylesheet", () => {
    const main = readFileSync(join(SRC, "main.tsx"), "utf8");
    expect(main).not.toMatch(MEDIA_CSS_IMPORT);
  });

  it("exactly one runtime module imports it, and it is the /dosyalar route", () => {
    const importers = filesUnderSrc().filter((file) =>
      MEDIA_CSS_IMPORT.test(readFileSync(file, "utf8")),
    );
    expect(importers).toEqual([MEDIA_ROUTE]);
  });

  it("that route is only ever reached through a dynamic import", () => {
    // A static import of the route module from anywhere would collapse it into
    // the importer's chunk and take the stylesheet with it.
    const offenders = filesUnderSrc()
      .filter((file) => file !== MEDIA_ROUTE)
      .filter((file) => /^\s*import\s[^(]*["'][^"']*routes\/media["']/mu.test(
        readFileSync(file, "utf8"),
      ));
    expect(offenders.map((file) => file.replace(`${ROOT}/`, ""))).toEqual([]);
  });

  it("the Storybook preview keeps the media styling it needs", () => {
    const preview = readFileSync(join(ROOT, ".storybook", "preview.tsx"), "utf8");
    expect(preview).toMatch(MEDIA_CSS_IMPORT);
  });

  it("the application entry still imports the stylesheets it does use", () => {
    // Guards against "fixed" by deleting every import.
    const main = readFileSync(join(SRC, "main.tsx"), "utf8");
    for (const sheet of ["tokens.css", "base.css", "components.css", "data-grid.css"]) {
      expect(main).toContain(sheet);
    }
  });
});

/**
 * The provider connection centre, held to the media rule and to one more.
 *
 * The extra rule is the one that matters, and it survives the arrival of
 * `/ayarlar/yapay-zeka` unchanged: **this subsystem is not re-exported from
 * `src/components/index.ts`.** The media measurement recorded on the previous
 * group proves what the barrel does - every route imports it, so anything
 * re-exported from it is in the eager graph whether or not a route renders it.
 * Media pre-dates that finding and is stuck with it, which is why only its
 * stylesheet could be made lazy. This subsystem does not, so its route reaches
 * it by its own path and *both* its JavaScript and its CSS stay out of what
 * every signed-in visitor downloads.
 *
 * The old form of this group asserted that no route reached it at all. That
 * assertion has been replaced rather than deleted: exactly one route may reach
 * it, by its own path, and the artifact group below checks what that buys
 * against the built output rather than against this sentence.
 */
describe("the provider connection centre is reached by one route and one path", () => {
  const PROVIDER_ROUTE = join(SRC, "routes", "providers.tsx");

  it("the application entry imports no provider stylesheet", () => {
    expect(readFileSync(join(SRC, "main.tsx"), "utf8")).not.toMatch(PROVIDER_CSS_IMPORT);
  });

  it("exactly one runtime module imports it, and it is the provider route", () => {
    const importers = filesUnderSrc().filter((file) =>
      PROVIDER_CSS_IMPORT.test(readFileSync(file, "utf8")),
    );
    expect(importers).toEqual([PROVIDER_ROUTE]);
  });

  it("the Storybook preview loads it too, because Storybook also renders it", () => {
    const preview = readFileSync(join(ROOT, ".storybook", "preview.tsx"), "utf8");
    expect(preview).toMatch(PROVIDER_CSS_IMPORT);
  });

  it("the shared component barrel does not re-export it", () => {
    const barrel = readFileSync(join(SRC, "components", "index.ts"), "utf8");
    expect(barrel).not.toMatch(PROVIDER_BARREL_EXPORT);
  });

  it("no other route module reaches it, by any path", () => {
    const offenders = filesUnderSrc()
      .filter((file) => file !== PROVIDER_ROUTE)
      .filter((file) => file.includes(join(SRC, "routes")) || file.endsWith("main.tsx"))
      .filter((file) => /provider-connections/u.test(readFileSync(file, "utf8")));
    expect(offenders.map((file) => file.replace(`${ROOT}/`, ""))).toEqual([]);
  });

  it("that route is only ever reached through a dynamic import", () => {
    const offenders = filesUnderSrc()
      .filter((file) => file !== PROVIDER_ROUTE)
      .filter((file) =>
        /^\s*import\s[^(]*["'][^"']*routes\/providers["']/mu.test(readFileSync(file, "utf8")),
      );
    expect(offenders.map((file) => file.replace(`${ROOT}/`, ""))).toEqual([]);
  });
});

/**
 * The measurement that used to read "no media rule anywhere", re-taken.
 *
 * Deleting that assertion when the route arrived would have been the easy move
 * and the wrong one: the finding it recorded - visitors paying for rules they
 * can never apply - is still a real failure mode, it has simply moved one level
 * down. So the claim is not dropped, it is sharpened. The rules must be out of
 * the *entry* stylesheet, which is what every visitor downloads, and they must
 * be present in a lazy one, which is what proves the route actually got them
 * rather than that somebody deleted the import.
 *
 * Both halves are required. Only the first would pass on a build where the
 * stylesheet vanished entirely and `/dosyalar` rendered unstyled.
 */
describe("route-scoped rules are in a lazy chunk and out of the entry", () => {
  it("the entry stylesheet carries the rules every route needs", () => {
    const eager = entryAssets().filter((asset) => asset.endsWith(".css"));
    if (eager.length === 0) return;
    expect(eager.some((sheet) => read(sheet).includes(GRID_SELECTOR))).toBe(true);
  });

  it("the entry stylesheet carries no media rule", () => {
    const eager = entryAssets().filter((asset) => asset.endsWith(".css"));
    if (eager.length === 0) return;
    expect(eager.filter((sheet) => read(sheet).includes(MEDIA_ONLY_SELECTOR))).toEqual([]);
  });

  it("a lazy stylesheet does carry the media rules", () => {
    const stylesheets = assets().filter((asset) => asset.endsWith(".css"));
    if (stylesheets.length === 0) return;
    const carriers = lazyAssets().filter(
      (asset) => asset.endsWith(".css") && read(asset).includes(MEDIA_ONLY_SELECTOR),
    );
    expect(
      carriers.length,
      "medya kuralları hiçbir tembel stil dosyasında yok - /dosyalar stilsiz kalır",
    ).toBeGreaterThan(0);
  });

  it("the entry stylesheet carries no provider connection rule", () => {
    const eager = entryAssets().filter((asset) => asset.endsWith(".css"));
    if (eager.length === 0) return;
    expect(eager.filter((sheet) => read(sheet).includes(PROVIDER_ONLY_SELECTOR))).toEqual([]);
  });

  it("ships no provider connection code in the eager graph either", () => {
    // The stronger half of the claim: the CSS staying out is easy, the
    // JavaScript staying out is what avoiding the shared barrel actually buys.
    const eager = entryAssets().filter((asset) => asset.endsWith(".js"));
    if (eager.length === 0) return;
    const offenders = eager.filter((script) =>
      read(script).includes(PROVIDER_JS_MARKER),
    );
    expect(offenders).toEqual([]);
  });
});

/**
 * The first-load budget, measured rather than believed.
 *
 * `FRONTEND-TECHSTACK.md` section 13 sets it at **180 kB of gzipped JavaScript**
 * and adds the rule that makes it a budget rather than a target: *when it is
 * exceeded the budget is not raised, the code is made smaller.* This group is
 * the enforcement, and until it existed the number was a sentence in a document
 * that no build had ever checked.
 *
 * What counts is what the browser fetches before any route has been chosen: the
 * entry script and everything `index.html` preloads. Not "the entry chunk" - a
 * modulepreload is a download, and splitting a big chunk into three preloaded
 * ones moves bytes between file names without moving one byte off the wire.
 *
 * Gzip rather than raw, because gzip is what crosses the network and because
 * the budget is written in gzipped bytes. `gzipSync` at its default level is
 * within a few per cent of what a server emits and, more importantly, it is
 * deterministic, so a regression is a regression rather than a server setting.
 *
 * The failure this was written against: 236,807 gzipped bytes against a 180,000
 * budget and a 202,512 baseline. The chart engine was already lazy; the weight
 * was the shared component barrel being pulled into the entry graph by the
 * router's own fallback surfaces.
 */
describe("the first load stays inside the published budget", () => {
  /** `FRONTEND-TECHSTACK.md` section 13. Read here, never rewritten here. */
  const FIRST_LOAD_GZIP_BUDGET_BYTES = 180_000;

  const gzipBytes = (asset: string): number =>
    gzipSync(readFileSync(join(DIST_ASSETS, asset))).length;

  it("measures every script the entry document pulls, not just the entry chunk", () => {
    const eager = entryAssets().filter((asset) => asset.endsWith(".js"));
    if (eager.length === 0) return;
    // A guard that measured one file would pass the moment the graph was split
    // into two preloaded files, which is the opposite of what it is for.
    expect(eager.length).toBeGreaterThan(1);
  });

  it("keeps the eager JavaScript at or under 180 kB gzipped", () => {
    const eager = entryAssets().filter((asset) => asset.endsWith(".js"));
    if (eager.length === 0) return;

    const perAsset = eager
      .map((asset) => ({ asset, bytes: gzipBytes(asset) }))
      .sort((a, b) => b.bytes - a.bytes);
    const total = perAsset.reduce((sum, entry) => sum + entry.bytes, 0);

    expect(
      total,
      `ilk yük bütçesi aşıldı: ${total} > ${FIRST_LOAD_GZIP_BUDGET_BYTES} gzip bayt\n${perAsset
        .map((entry) => `  ${entry.asset}: ${entry.bytes}`)
        .join("\n")}\nBütçe yükseltilmez; kod küçültülür.`,
    ).toBeLessThanOrEqual(FIRST_LOAD_GZIP_BUDGET_BYTES);
  });

  it("does not pay for the chart engine on the first load", () => {
    // Stated separately from the total so a future regression says *which*
    // rule it broke: a lazy engine that becomes eager would blow the budget
    // and the reason would be buried in an arithmetic failure.
    const eager = entryAssets().filter((asset) => asset.endsWith(".js"));
    if (eager.length === 0) return;
    expect(eager.filter((asset) => /echarts|zrender/u.test(asset))).toEqual([]);
  });
});

/**
 * The chart engine is in a lazy chunk, and it is out of the eager one.
 *
 * `FRONTEND-TECHSTACK.md` records "ECharts never enters the main bundle" as a
 * refusal rather than a preference, and the refusal has a history: the root
 * prototype this repository replaced was a 1.59 MB single-file page with
 * ECharts minified into it, downloaded in full by anyone who opened the landing
 * screen.
 *
 * Both halves are asserted, for the same reason the media stylesheet group
 * asserts both: only the first would pass on a build where the analytics
 * section had been deleted and the dashboard rendered no chart at all.
 *
 * The marker is a string literal rather than a file name. Chunk names come from
 * a manual-chunking rule that a future edit could rename; `zrender`'s error
 * text is in the library's own source and survives minification, so finding it
 * in a chunk is proof the engine is *in* that chunk.
 */
describe("the chart engine is lazy and stays out of the eager graph", () => {
  /** zrender ships this in its painter; minification keeps the string. */
  const ECHARTS_MARKER = "zrender";

  it("ships no chart engine in the eager graph", () => {
    const eager = entryAssets().filter((asset) => asset.endsWith(".js"));
    if (eager.length === 0) return;
    const offenders = eager.filter((script) => read(script).includes(ECHARTS_MARKER));
    expect(
      offenders,
      "grafik motoru ana pakete girdi - kök prototipin 1.59 MB kusuru tekrar ediyor",
    ).toEqual([]);
  });

  it("a lazy chunk does carry it, so the dashboard really draws a chart", () => {
    const scripts = assets().filter((asset) => asset.endsWith(".js"));
    if (scripts.length === 0) return;
    const carriers = lazyAssets().filter(
      (asset) => asset.endsWith(".js") && read(asset).includes(ECHARTS_MARKER),
    );
    expect(
      carriers.length,
      "hiçbir tembel parça grafik motorunu taşımıyor - panoda grafik yok demektir",
    ).toBeGreaterThan(0);
  });
});

/**
 * No source file may carry a control byte that only a hex editor can see.
 *
 * `select.tsx` held one raw NUL, immediately before the `dt-empty-option`
 * sentinel string. Nothing about it was visible: the editor showed the literal
 * as if the quote and the `d` were adjacent, every test passed, the component
 * behaved correctly, and the build succeeded - because the byte really was part
 * of the sentinel's value and the sentinel really is meant to be unforgeable.
 *
 * What it broke was everything that treats a file as text. Git classifies a
 * blob containing NUL as binary, so `git diff` reported `- -` instead of line
 * counts and refused to show the change; `grep` stopped printing matches and
 * started saying "binary file matches"; `file` called the module `data`. A
 * source file that no diff can display is a source file no review can read.
 *
 * The fix is an escape, not a deletion: `\0` in the source text produces the
 * same byte at runtime, so the sentinel keeps its value and its guarantee while
 * the file on disk stays text. So what this group pins is a property of the
 * bytes on disk, not of the program they spell, and it asserts on a Buffer for
 * the reason given on `sourceBytes`: a decode would answer a byte-level
 * question through an encoding assumption and a U+FFFD repair pass.
 *
 * Scope is deliberately `.ts`/`.tsx` under `src/` and nothing else. Fonts,
 * images and anything under `dist/` are legitimately binary; widening this to
 * them would turn a real contract into a false alarm.
 */
describe("every source file under src/ is text", () => {
  it("contains no raw NUL byte", () => {
    const offenders = sourceBytes()
      .filter((source) => source.bytes.includes(0))
      .map((source) => {
        const at = source.bytes.indexOf(0);
        return `${source.file.replace(`${ROOT}/`, "")} (ilk NUL: ${at}. bayt)`;
      });
    expect(
      offenders,
      "kaynak dosyada ham NUL var - Git dosyayı ikili sayar, diff okunamaz",
    ).toEqual([]);
  });

  it("scans a set that is neither empty nor full of binaries", () => {
    // Guards against "passing" because the walk found nothing, and against a
    // future widening that drags real binary assets into the assertion.
    const scanned = sourceBytes();
    expect(scanned.length).toBeGreaterThan(0);
    expect(scanned.every((source) => /\.tsx?$/u.test(source.file))).toBe(true);
  });
});

describe("vendor code splitting is declared and effective", () => {
  const viteConfig = () => readFileSync(join(ROOT, "vite.config.ts"), "utf8");

  it("declares a deterministic vendor split through the supported build option", () => {
    const config = viteConfig();
    expect(config).toMatch(/rolldownOptions/u);
    expect(config).toMatch(/codeSplitting/u);
    expect(config).toMatch(/react-dom/u);
  });

  it("does not raise or silence the chunk size warning", () => {
    // Again: an assignment, not a mention. The config explains in a comment
    // why the limit is left alone, and that sentence must stay legal.
    const config = viteConfig();
    expect(config).not.toMatch(/chunkSizeWarningLimit\s*:/u);
    expect(config).not.toMatch(/onwarn\s*[:(]/u);
  });

  it("emits react and react-dom as their own chunk", () => {
    const scripts = assets().filter((asset) => asset.endsWith(".js"));
    if (scripts.length === 0) return;
    const vendor = scripts.filter((script) => script.startsWith("react-"));
    expect(vendor).toHaveLength(1);
    expect(read(vendor[0]!)).toContain(REACT_DOM_MARKER);
  });

  it("leaves react-dom out of every other chunk", () => {
    const scripts = assets().filter((asset) => asset.endsWith(".js"));
    if (scripts.length === 0) return;
    const leaking = scripts
      .filter((script) => !script.startsWith("react-"))
      .filter((script) => read(script).includes(REACT_DOM_MARKER));
    expect(leaking).toEqual([]);
  });

  it("keeps every emitted chunk under the warning threshold", () => {
    const scripts = assets().filter((asset) => asset.endsWith(".js"));
    if (scripts.length === 0) return;
    const oversized = scripts
      .filter((script) => bytes(script) > CHUNK_WARNING_LIMIT_BYTES)
      .map((script) => `${script} (${(bytes(script) / 1000).toFixed(2)} kB)`);
    expect(oversized).toEqual([]);
  });
});
