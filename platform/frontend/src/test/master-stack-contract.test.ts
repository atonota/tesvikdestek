/**
 * The binding frontend technology contract.
 *
 * `~/Desktop/frontend-tecstack.md` is the owner's technical input for this
 * product, not outside advice a repository document may downgrade to
 * "conditional" or "optional". `FRONTEND-TECHSTACK.md` did exactly that: it
 * recorded Tailwind v4 and shadcn/ui as *candidates awaiting measurement*
 * (section 8, rows 1-3 and 13) while declaring the bespoke stylesheet system
 * canonical. That reading is corrected, and the correction is pinned here so it
 * cannot silently revert to a preference.
 *
 * What this file asserts is deliberately structural rather than cosmetic. A
 * design system is "adopted" when three things are true at once, and any one of
 * them alone is a claim rather than a fact:
 *
 *  1. **The toolchain really builds it.** The Tailwind v4 Vite plugin is
 *     installed and wired, the entry imports the Tailwind stylesheet, and
 *     Storybook renders under the same rules the application ships.
 *  2. **The component code follows shadcn/ui's contract**, not merely its
 *     vocabulary: `components.json` in the Tailwind v4 shape (empty
 *     `tailwind.config`, CSS variables on), one canonical `cn` built on `clsx`
 *     and `tailwind-merge`, `data-slot` attributes, and `cva` for variants.
 *  3. **The screens consume it.** A master layer nothing renders is a folder.
 *     So the shared primitives every route already uses - `Button`, `Badge`,
 *     `Card`, `Tabs` - must be *derived from* the master layer rather than
 *     sitting beside it, which is what makes the adoption visible on all
 *     eleven authenticated routes rather than on one new screen.
 *
 * Two exclusions are asserted as hard rules because both are one careless
 * import away: **no SCSS in this package** (Tailwind v4 is the preprocessor;
 * the two must never share a package) and **no Lucide** (shadcn/ui ships with
 * it by default and the owner's icon set is Phosphor).
 *
 * ECharts is held to the shape the owner asked for and the shape this
 * repository already refused once: real, tree-shaken, lazily loaded usage.
 * A dependency in the manifest is not a chart on a screen, and a bare
 * `import "echarts"` is the 1.59 MB defect the root prototype shipped.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");

const manifest = () =>
  JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };

const allDependencies = (): Record<string, string> => {
  const parsed = manifest();
  return { ...parsed.dependencies, ...parsed.devDependencies };
};

/** Every source module under `src/`, this guard excluded. */
function filesUnderSrc(extensions = /\.(ts|tsx)$/u): string[] {
  const found: string[] = [];
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory)) {
      const full = join(directory, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (extensions.test(entry) && entry !== "master-stack-contract.test.ts") {
        found.push(full);
      }
    }
  };
  walk(SRC);
  return found;
}

const readSource = (...parts: string[]) => readFileSync(join(ROOT, ...parts), "utf8");

/**
 * The entry stylesheet the build emitted, or `null` when nothing is built.
 *
 * Same convention as the artifact guards: a working tree nobody has built in
 * returns rather than inventing a verdict. `pnpm build` runs those guards after
 * `vite build`, and the full gate runs this file after both.
 */
function builtEntryStylesheet(): string | null {
  const document = join(ROOT, "dist", "index.html");
  if (!existsSync(document)) return null;
  const named = [...readFileSync(document, "utf8").matchAll(/\/assets\/([\w.-]+\.css)/gu)].map(
    (match) => match[1] as string,
  );
  const sheets = named
    .map((name) => join(ROOT, "dist", "assets", name))
    .filter((path) => existsSync(path));
  if (sheets.length === 0) return null;
  return sheets.map((path) => readFileSync(path, "utf8")).join("\n");
}

/** Comments discuss the banned imports; only code is judged. */
const withoutComments = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/^\s*\/\/.*$/gmu, "");

/* ------------------------------------------------------------- toolchain */

describe("Tailwind CSS v4 is installed the way Tailwind documents it", () => {
  it("pins both the engine and the Vite plugin", () => {
    const dependencies = allDependencies();
    for (const name of ["tailwindcss", "@tailwindcss/vite"]) {
      expect(dependencies[name], `${name} kurulu değil`).toBeDefined();
      expect(dependencies[name]).toMatch(/^4\./u);
    }
  });

  it("registers the plugin in the Vite config rather than a PostCSS chain", () => {
    const config = readSource("vite.config.ts");
    expect(config).toMatch(/from\s+["']@tailwindcss\/vite["']/u);
    expect(config).toMatch(/tailwindcss\(\)/u);
    // v4's Vite plugin replaces the PostCSS pipeline; keeping both is the
    // misconfiguration that silently emits the stylesheet twice.
    expect(existsSync(join(ROOT, "postcss.config.js"))).toBe(false);
    expect(existsSync(join(ROOT, "postcss.config.mjs"))).toBe(false);
  });

  it("imports Tailwind from CSS, with an explicit source scope", () => {
    const sheet = withoutComments(readSource("src", "design", "tailwind.css"));
    // The theme and the utilities, imported by name. `@import "tailwindcss"`
    // would bring Preflight with them; see the group below for why it must not.
    expect(sheet).toMatch(/@import\s+["']tailwindcss\/theme\.css["']\s+layer\(theme\)/u);
    expect(sheet).toMatch(/@import\s+["']tailwindcss\/utilities\.css["']\s+layer\(utilities\)/u);
    // Automatic source detection would walk out of this package into the
    // repository root, where the Python service and the static HTML pages live.
    expect(sheet).toMatch(/@source\s+/u);
    // The bespoke token layer stays the source of truth for colour, so the
    // Tailwind theme is mapped onto it rather than duplicating hex values.
    expect(sheet).toMatch(/@theme/u);
    expect(sheet).toMatch(/--dt-color-primary/u);
  });

  it("is loaded by the application entry and by the Storybook preview", () => {
    for (const source of [
      readSource("src", "main.tsx"),
      readSource(".storybook", "preview.tsx"),
    ]) {
      expect(source).toMatch(/import\s+["'][^"']*tailwind\.css["']/u);
    }
  });

  it("declares the full layer order before anything registers a name", () => {
    /*
     * Layer order is fixed by first registration and a later statement cannot
     * move a name that already exists. Without this line the order resolved to
     * theme, base, components, utilities, reset, layout - putting the product's
     * reset *after* every Tailwind utility. Measured consequence: the primary
     * button inherited body text colour onto parliament blue at 1.56:1.
     */
    // Comments stripped: the sheet's own docstring quotes both the layer
    // statement and the bare `@import "tailwindcss"` it exists to explain, and
    // a guard that read the prose would be reading the explanation.
    const sheet = withoutComments(readSource("src", "design", "tailwind.css"));
    const statement = /@layer\s+([a-z,\s]+);/u.exec(sheet)?.[1] ?? "";
    const order = statement.split(",").map((name) => name.trim());
    expect(order).toEqual(["theme", "base", "reset", "layout", "components", "utilities"]);
    // Declared before the imports, or it is not first registration.
    expect(sheet.indexOf("@layer theme")).toBeLessThan(sheet.indexOf("@import"));
  });

  it("ships no second reset: Preflight is not imported", () => {
    /*
     * The product has its own reset in `base.css`, and two resets is not
     * belt-and-braces - it is two sets of opinions about the same elements.
     * Preflight's `a { text-decoration: inherit }` silently removed the
     * underline from every link in running text, which axe reported as
     * `link-in-text-block` at serious severity.
     *
     * Asserted against the *built* stylesheet as well as the source, because
     * the source could stop importing it while a dependency brought it back.
     */
    const sheet = withoutComments(readSource("src", "design", "tailwind.css"));
    expect(sheet).not.toMatch(/@import\s+["']tailwindcss\/preflight/u);
    expect(sheet).not.toMatch(/@import\s+["']tailwindcss["']/u);

    const built = builtEntryStylesheet();
    if (built === null) return;
    // Two declarations that exist only in Preflight and nowhere in this
    // package's own sheets.
    expect(built).not.toContain("text-decoration:inherit");
    expect(built).not.toContain("tab-size:4");
  });

  it("still emits the utility machinery Preflight is often assumed to carry", () => {
    const built = builtEntryStylesheet();
    if (built === null) return;
    // `border` needs a border-style, and v4 supplies it through a registered
    // custom property rather than through Preflight. If this were missing,
    // every bordered master component would render with invisible edges.
    expect(built).toContain("--tw-border-style");
    expect(built).toContain("border-style:solid");
  });

  it("keeps a single styling system in this package: no SCSS, ever", () => {
    const styleFiles = filesUnderSrc(/\.(scss|sass|less|styl)$/u);
    expect(styleFiles).toEqual([]);
    const dependencies = allDependencies();
    for (const name of ["sass", "sass-embedded", "node-sass", "less", "stylus"]) {
      expect(dependencies[name], `${name} bu pakette olmamalı`).toBeUndefined();
    }
  });
});

/* -------------------------------------------------------- shadcn contract */

describe("the master component layer follows the shadcn/ui code contract", () => {
  it("declares components.json in the Tailwind v4 shape", () => {
    const config = JSON.parse(readSource("components.json")) as {
      $schema?: string;
      tsx?: boolean;
      rsc?: boolean;
      tailwind?: { config?: string; css?: string; cssVariables?: boolean; baseColor?: string };
      aliases?: Record<string, string>;
      iconLibrary?: string;
    };
    expect(config.$schema).toContain("ui.shadcn.com");
    expect(config.tsx).toBe(true);
    // React 19 + Vite, not a server-component framework.
    expect(config.rsc).toBe(false);
    // Tailwind v4 has no JavaScript config file; shadcn expects this empty.
    expect(config.tailwind?.config).toBe("");
    expect(config.tailwind?.css).toBe("src/design/tailwind.css");
    expect(config.tailwind?.cssVariables).toBe(true);
    expect(config.aliases?.["ui"]).toBe("@/components/ui");
    expect(config.aliases?.["utils"]).toBe("@/lib/utils");
    // shadcn's default is Lucide; this product's icon set is Phosphor.
    expect(config.iconLibrary).toBe("@phosphor-icons/react");
  });

  it("has exactly one canonical cn, built on clsx and tailwind-merge", () => {
    const dependencies = allDependencies();
    for (const name of ["clsx", "tailwind-merge", "class-variance-authority"]) {
      expect(dependencies[name], `${name} kurulu değil`).toBeDefined();
    }
    const utils = readSource("src", "lib", "utils.ts");
    expect(utils).toMatch(/from\s+["']clsx["']/u);
    expect(utils).toMatch(/from\s+["']tailwind-merge["']/u);
    expect(utils).toMatch(/twMerge\(/u);

    /*
     * The older joiner must not survive as a second implementation.
     *
     * Two `cn`s is worse than none: half the tree would merge conflicting
     * Tailwind utilities and half would concatenate them, and which half a
     * component landed in would be invisible at the call site. The old module
     * stays as a re-export so the ~40 existing imports keep working.
     */
    const legacy = readSource("src", "lib", "cn.ts");
    expect(legacy).toMatch(/from\s+["']\.\/utils["']/u);
    expect(legacy).not.toMatch(/\.filter\(Boolean\)\.join\(/u);
  });

  const UI_DIRECTORY = join(SRC, "components", "ui");
  const REQUIRED_UI = [
    "button",
    "card",
    "badge",
    "tabs",
    "progress",
    "separator",
    "skeleton",
    "tooltip",
    "sheet",
  ] as const;

  it.each(REQUIRED_UI)("ships the %s master component", (name) => {
    expect(existsSync(join(UI_DIRECTORY, `${name}.tsx`))).toBe(true);
  });

  it.each(REQUIRED_UI)("%s carries shadcn's data-slot attributes", (name) => {
    const source = readFileSync(join(UI_DIRECTORY, `${name}.tsx`), "utf8");
    expect(source).toMatch(/data-slot=/u);
    expect(source).toMatch(/from\s+["']@\/lib\/utils["']/u);
  });

  it.each(["button", "badge"] as const)("%s declares its variants with cva", (name) => {
    const source = readFileSync(join(UI_DIRECTORY, `${name}.tsx`), "utf8");
    expect(source).toMatch(/from\s+["']class-variance-authority["']/u);
    expect(source).toMatch(/cva\(/u);
  });

  it("keeps the master layer out of the 75-component registry barrel", () => {
    /*
     * `@/components` already exports a `Button`, a `Card`, a `Badge` and a
     * `Tabs`. Re-exporting the master layer from the same barrel would be two
     * different components answering to one name, resolved by import order.
     */
    const barrel = readSource("src", "components", "index.ts");
    expect(barrel).not.toMatch(/export\s+\*\s+from\s+["']\.\/ui["']/u);
  });
});

/* ------------------------------------------------------------ consumption */

describe("the existing screens consume the master layer, not just the new one", () => {
  /**
   * The derivation that makes this real.
   *
   * Every authenticated route renders `Button`, `Card` and `Badge` from
   * `@/components`. Building a parallel master layer beside them would leave
   * the product looking exactly as it did while the manifest claimed a new
   * design system. So the shared primitives are *rebuilt on* the master layer
   * with their public API unchanged, and that is what these assertions pin.
   */
  it("the shared Button and Badge are derived from the master button and badge", () => {
    const primitives = withoutComments(readSource("src", "components", "primitives.tsx"));
    expect(primitives).toMatch(/from\s+["']\.\/ui\/button["']/u);
    expect(primitives).toMatch(/from\s+["']\.\/ui\/badge["']/u);
  });

  it("the shared Card and Tabs are derived from the master card and tabs", () => {
    const composites = withoutComments(readSource("src", "components", "composites.tsx"));
    expect(composites).toMatch(/from\s+["']\.\/ui\/card["']/u);
    expect(composites).toMatch(/from\s+["']\.\/ui\/tabs["']/u);
  });

  it("the adaptive shell every route renders uses the master sheet", () => {
    const shell = withoutComments(
      readSource("src", "components", "adaptive", "AdaptiveShell.tsx"),
    );
    expect(shell).toMatch(/from\s+["']@\/components\/ui\/sheet["']/u);
  });

  it("the router's boot fallback uses the master skeleton, and reaches no barrel", () => {
    /*
     * The name of this pair used to promise a skeleton assertion and make only
     * a sheet one. The skeleton claim now has a home, and it is a more useful
     * one: the boot surface is the first thing every visitor sees, it is in the
     * eager graph, and what it must *not* import is the component barrel - that
     * import is what put 236,684 gzipped bytes in front of a first paint.
     */
    const boot = withoutComments(readSource("src", "routes", "boot-surface.tsx"));
    expect(boot).toMatch(/from\s+["']@\/components\/ui\/skeleton["']/u);
    expect(boot).not.toMatch(/from\s+["']@\/components["']/u);

    const router = withoutComments(readSource("src", "app", "router.tsx"));
    expect(router).not.toMatch(/from\s+["']@\/components["']/u);
    expect(router).not.toMatch(/from\s+["']@\/components\/patterns["']/u);
  });
});

/* ----------------------------------------------------------------- icons */

describe("Phosphor is the icon set, and Lucide is absent", () => {
  it("pins @phosphor-icons/react", () => {
    expect(allDependencies()["@phosphor-icons/react"]).toBeDefined();
  });

  it("nothing in the package imports Lucide", () => {
    const dependencies = allDependencies();
    expect(dependencies["lucide-react"]).toBeUndefined();
    const offenders = filesUnderSrc()
      .filter((file) => /from\s+["']lucide-react/u.test(readFileSync(file, "utf8")))
      .map((file) => file.replace(`${ROOT}/`, ""));
    expect(offenders).toEqual([]);
  });

  it("routes icons through one adapter rather than importing the set everywhere", () => {
    const adapter = readSource("src", "components", "icons.tsx");
    expect(adapter).toMatch(/@phosphor-icons\/react/u);
    const importers = filesUnderSrc()
      .filter((file) => file !== join(SRC, "components", "icons.tsx"))
      .filter((file) => /from\s+["']@phosphor-icons\/react/u.test(readFileSync(file, "utf8")))
      .map((file) => file.replace(`${ROOT}/`, ""));
    expect(importers).toEqual([]);
  });

  it("the shell's navigation renders real icons instead of typographic glyphs", () => {
    // `◧`, `▤`, `◎`, `❖` are box-drawing characters that render differently on
    // every platform and are unavailable to a screen reader either way.
    const app = readSource("src", "routes", "app.tsx");
    expect(app).toMatch(/from\s+["']@\/components\/icons["']/u);
    const navBlock = /export const APP_NAV = \[([\s\S]*?)\] as const;/u.exec(app)?.[1] ?? "";
    expect(navBlock.length).toBeGreaterThan(0);
    /*
     * The banned glyphs, listed by code point.
     *
     * Written as escapes rather than pasted in. Several are ambiguous or
     * invisible in a monospaced editor, one of them (U+1F5C0) renders as an
     * emoji on one platform and a line drawing on another - which is the defect
     * itself - and pasting the range that contained them put an irregular
     * whitespace character into this file that only the linter could see.
     */
    const GLYPH_ICONS =
      /icon:\s*["'](?:\u25E7|\u25A4|\u25CE|\u2756|\u2611|\u25D4|\u2665|\u{1F5C0}|\u2261|\u2699)/u;
    expect(navBlock).not.toMatch(GLYPH_ICONS);
  });
});

/* --------------------------------------------------------------- ECharts */

describe("ECharts is real, tree-shaken and lazy", () => {
  const ANALYTICS = join(SRC, "components", "analytics");

  it("pins echarts", () => {
    expect(allDependencies()["echarts"]).toBeDefined();
  });

  it("imports only the core, the charts, the components and the renderer it uses", () => {
    const importers = filesUnderSrc().filter((file) =>
      /from\s+["']echarts/u.test(readFileSync(file, "utf8")),
    );
    expect(importers.length).toBeGreaterThan(0);
    for (const file of importers) {
      // Comments are stripped first, and that is not a loophole: the adapter's
      // docstring has to be able to *quote* the banned form in order to explain
      // why it is banned, and a guard that forbade the sentence would forbid
      // the explanation. What is judged is the code.
      const source = withoutComments(readFileSync(file, "utf8"));
      // A bare `echarts` import pulls every chart type and every component -
      // the 1.59 MB defect the root prototype shipped.
      expect(source, `${file} imports the whole of echarts`).not.toMatch(
        /from\s+["']echarts["']/u,
      );
      expect(source).toMatch(/from\s+["']echarts\/core["']/u);
      expect(source).toMatch(/from\s+["']echarts\/renderers["']/u);
    }
  });

  it("renders a real chart rather than only declaring a dependency", () => {
    expect(existsSync(ANALYTICS)).toBe(true);
    const chart = readFileSync(join(ANALYTICS, "EChart.tsx"), "utf8");
    // init / setOption / resize / dispose: a chart that never disposes leaks a
    // canvas and a resize listener on every route change.
    for (const call of ["init(", "setOption(", "dispose(", "ResizeObserver"]) {
      expect(chart, `EChart.tsx has no ${call}`).toContain(call);
    }
  });

  it("is reached only through a dynamic import, from the route that shows it", () => {
    /*
     * Scoped to the modules that *carry* the chart engine, not to the folder.
     *
     * `analytics/model.ts` is plain arithmetic over three arrays with no
     * ECharts import in it, and the dashboard reads it eagerly on purpose:
     * putting three counts behind a megabyte of canvas code would delay the
     * numbers for no gain. What must never be statically imported is anything
     * that pulls the engine in - the adapter and the section that renders it.
     */
    const CHART_BEARING = /["'][^"']*components\/analytics\/(EChart|PortfolioAnalytics)/u;
    const staticImporters = filesUnderSrc()
      .filter((file) => !file.startsWith(ANALYTICS))
      .filter((file) => {
        const source = readFileSync(file, "utf8");
        return [...source.matchAll(/^\s*import\s[^(]*?from\s*(["'][^"']+["'])/gmu)].some(
          (match) => CHART_BEARING.test(match[1] ?? ""),
        );
      })
      .map((file) => file.replace(`${ROOT}/`, ""));
    expect(staticImporters).toEqual([]);

    const app = readSource("src", "routes", "app.tsx");
    expect(app).toMatch(/lazy\(\s*\(\)\s*=>\s*import\(\s*["'][^"']*components\/analytics/u);
  });

  it("is not re-exported from the shared component barrel", () => {
    const barrel = readSource("src", "components", "index.ts");
    expect(barrel).not.toMatch(/export\s+\*\s+from\s+["']\.\/analytics["']/u);
  });

  it("offers the same figures as text, because a canvas is not readable", () => {
    const analytics = readdirSync(ANALYTICS)
      .filter((entry) => entry.endsWith(".tsx"))
      .map((entry) => readFileSync(join(ANALYTICS, entry), "utf8"))
      .join("\n");
    expect(analytics).toMatch(/<table/u);
  });
});
