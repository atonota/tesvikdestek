/**
 * P1C token contract, part 3: the `data-theme` contract has exactly one
 * writer and exactly three legal states.
 *
 * `tokens.css` (`src/design/tokens.css`, read here but never written) is
 * built on a specific shape: the base palette under `:root` is light, a
 * `prefers-color-scheme: dark` media query repaints it for the "system"
 * setting unless `[data-theme="light"]` overrides that, and
 * `:root[data-theme="dark"]` repaints it again for an explicit choice. That
 * shape only holds if exactly one place in the application ever assigns
 * `data-theme`, using exactly the values `"light"` and `"dark"` (never
 * `"system"` - that state is spelled by *removing* the attribute) - a second
 * writer, or a fourth value, silently produces a screen tokens.css never
 * describes.
 *
 * `applyAppearance` (`src/store/ui.ts`) is that one writer. This file does
 * not change it; it asserts the contract already holds, the way
 * `design-system-contract.test.ts` asserts the stylesheet's own shape
 * without rewriting it.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { applyAppearance, type ThemeChoice } from "@/store/ui";

const ROOT = process.cwd();
const DESIGN = join(ROOT, "src", "design");

const withoutComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/\/\/.*$/gmu, "");

const SELF = join(ROOT, "src", "test", "token-contract-theme.test.ts");

/**
 * Every `.ts`/`.tsx` file under `src/`, comments stripped - excluding this
 * file itself, whose fixture strings (below) deliberately contain the
 * pattern under test and would otherwise report as a second writer of its
 * own accord.
 */
const sourceFiles = (): Array<{ path: string; code: string }> => {
  const found: Array<{ path: string; code: string }> = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules") continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (
        (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) &&
        full !== SELF
      ) {
        found.push({ path: full, code: withoutComments(readFileSync(full, "utf8")) });
      }
    }
  };
  walk(join(ROOT, "src"));
  return found;
};

/**
 * Sites that assign `data-theme` - `dataset["theme"] = ...`,
 * `dataset.theme = ...`, `delete root.dataset["theme"]`, or
 * `setAttribute("data-theme", ...)`. A read (`expect(...dataset...).toBe`,
 * a `MutationObserver` attribute filter) is not a write and must not match,
 * or every test that merely asserts on the theme would look like a second
 * writer.
 */
const THEME_WRITE = /(?:delete\s+)?[\w.]*dataset(?:\[["']theme["']\]|\.theme)\s*=|setAttribute\(\s*["']data-theme["']/gu;

describe("data-theme has exactly one writer", () => {
  it("finds theme-touching source to actually check", () => {
    const touching = sourceFiles().filter(({ code }) => /data-theme|dataset\[.theme.\]|dataset\.theme/u.test(code));
    expect(touching.length).toBeGreaterThan(0);
  });

  it("only src/store/ui.ts assigns data-theme", () => {
    const writers = sourceFiles()
      .filter(({ code }) => THEME_WRITE.test(code))
      .map(({ path }) => path.slice(ROOT.length + 1));
    expect(writers).toEqual(["src/store/ui.ts"]);
  });

  it("the gate is not decorative: it would catch a second writer", () => {
    const injected = 'document.documentElement.setAttribute("data-theme", "dark");';
    expect(THEME_WRITE.test(injected)).toBe(true);
    // A read must not trip the same pattern.
    THEME_WRITE.lastIndex = 0;
    const read = 'expect(document.documentElement.dataset["theme"]).toBe("dark");';
    expect(THEME_WRITE.test(read)).toBe(false);
    THEME_WRITE.lastIndex = 0;
  });
});

describe("applyAppearance only ever writes a value tokens.css defines", () => {
  const THEME_VALUES: readonly ThemeChoice[] = ["system", "light", "dark"];

  it.each(THEME_VALUES)('theme "%s" round-trips through the real <html> element', (theme) => {
    document.documentElement.removeAttribute("data-theme");
    applyAppearance({ theme, density: "comfortable", fontScale: "normal", reducedMotion: false });
    if (theme === "system") {
      expect(document.documentElement.dataset["theme"]).toBeUndefined();
    } else {
      expect(document.documentElement.dataset["theme"]).toBe(theme);
    }
  });

  it("never writes a fourth value", () => {
    const source = withoutComments(readFileSync(join(ROOT, "src", "store", "ui.ts"), "utf8"));
    const assigned = [...source.matchAll(/dataset\["theme"\]\s*=\s*state\.theme/gu)];
    // The only assignment is the pass-through of `state.theme` itself, typed
    // as `ThemeChoice` - so no fourth literal can be introduced without
    // TypeScript already rejecting it at the call site.
    expect(assigned.length).toBe(1);
  });
});

describe("tokens.css answers all three data-theme states", () => {
  const css = () => readFileSync(join(DESIGN, "tokens.css"), "utf8");

  it('repaints for "system" via prefers-color-scheme, deferring to an explicit light override', () => {
    expect(css()).toMatch(/@media \(prefers-color-scheme:\s*dark\)/u);
    expect(css()).toMatch(/:root:not\(\[data-theme=["']light["']\]\)/u);
  });

  it('repaints again for the explicit "dark" choice, independent of the media query', () => {
    expect(css()).toMatch(/:root\[data-theme=["']dark["']\]/u);
  });

  it('declares no fourth data-theme value beyond "light" and "dark"', () => {
    const values = [...css().matchAll(/\[data-theme=["']([\w-]+)["']\]/gu)].map((m) => m[1]);
    expect(new Set(values)).toEqual(new Set(["light", "dark"]));
  });
});
