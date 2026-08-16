/**
 * qq33 P1 — token package contract.
 *
 * MASTER karari (2026-08-16): qq33MASTER-PROMPT.md BÖLÜM 1 is the new
 * owner-canonical token contract for `src/design`. This file asserts the P1
 * values land in `tokens.css` and `tailwind.css` literally, byte for byte
 * against the spec, rather than trusting a paraphrase.
 *
 * Every value below was cross-checked against the two approved prototypes'
 * root `style` attribute (`qq11...Header...html`, `qq22...Sidebar 3a...html`)
 * before being written here — the light-theme brand/bg/surface/text values
 * are identical in both sources, which is why this suite treats them as a
 * single fact rather than two.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const DESIGN = join(process.cwd(), "src", "design");

const withoutComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//gu, "");
const tokensCss = () => withoutComments(readFileSync(join(DESIGN, "tokens.css"), "utf8"));
const tailwindCss = () => withoutComments(readFileSync(join(DESIGN, "tailwind.css"), "utf8"));

/** First declared value of a custom property inside a given block of CSS. */
function valueOf(css: string, name: string): string | undefined {
  const pattern = new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}:\\s*([^;]+);`, "u");
  return pattern.exec(css)?.[1]?.trim();
}

/** Slice out one selector block (`:root`, `:root[data-theme="dark"]`, ...). */
function block(css: string, selector: string): string {
  const start = css.indexOf(selector);
  if (start < 0) return "";
  const open = css.indexOf("{", start);
  let depth = 1;
  let index = open + 1;
  while (index < css.length && depth > 0) {
    if (css[index] === "{") depth += 1;
    else if (css[index] === "}") depth -= 1;
    index += 1;
  }
  return css.slice(open, index);
}

describe("qq33 P1 — light theme (:root)", () => {
  const root = () => block(tokensCss(), ":root {");

  it.each([
    ["--dt-color-primary", "#123a6b"],
    ["--dt-color-primary-hover", "#0d2b50"],
    ["--dt-color-primary-fg", "#ffffff"],
    ["--dt-color-secondary", "#f2e14c"],
    ["--dt-color-bg", "#f7f8fa"],
    ["--dt-color-surface", "#ffffff"],
    ["--dt-color-surface-raised", "#ffffff"],
    ["--dt-color-fg", "#14181f"],
    ["--dt-color-fg-muted", "#4c5666"],
    ["--dt-color-line", "#dde3eb"],
    ["--dt-color-line-strong", "#c1cbd8"],
    ["--dt-color-hover", "#f1f4f8"],
    ["--dt-color-selected", "#eaf0f9"],
    ["--dt-color-ok", "#0f6b3f"],
    ["--dt-color-warn", "#7a5000"],
    ["--dt-color-danger", "#9b211b"],
    ["--dt-color-neutral", "#41505f"],
    ["--dt-color-neutral-bg", "#edf1f5"],
  ])("%s is %s", (name, expected) => {
    expect(valueOf(root(), name)?.toLowerCase()).toBe(expected);
  });
});

describe("qq33 P1 — dark theme (:root[data-theme=\"dark\"])", () => {
  const dark = () => block(tokensCss(), ':root[data-theme="dark"]');

  it.each([
    ["--dt-color-primary", "#9dbdea"],
    ["--dt-color-primary-hover", "#bcd3f3"],
    ["--dt-color-primary-fg", "#0d1117"],
    ["--dt-color-secondary", "#e0d04a"],
    ["--dt-color-bg", "#0d1117"],
    ["--dt-color-surface", "#151b23"],
    ["--dt-color-surface-raised", "#1c242e"],
    ["--dt-color-fg", "#f2f6fb"],
    ["--dt-color-fg-muted", "#aeb9c9"],
    ["--dt-color-line", "#2a3440"],
    ["--dt-color-line-strong", "#3d4a59"],
    ["--dt-color-hover", "#1b2531"],
    ["--dt-color-selected", "#17263a"],
    ["--dt-color-ok", "#6fdca6"],
    ["--dt-color-warn", "#f0be63"],
    ["--dt-color-danger", "#f79289"],
    ["--dt-color-neutral", "#aeb9c9"],
    ["--dt-color-neutral-bg", "#1c242e"],
  ])("%s is %s", (name, expected) => {
    expect(valueOf(dark(), name)?.toLowerCase()).toBe(expected);
  });

  it("the prefers-color-scheme media block mirrors the same values", () => {
    const css = tokensCss();
    const mediaStart = css.indexOf("@media (prefers-color-scheme: dark)");
    const media = block(css.slice(mediaStart), ':root:not([data-theme="light"])');
    for (const [name, expected] of [
      ["--dt-color-fg", "#f2f6fb"],
      ["--dt-color-line-strong", "#3d4a59"],
      ["--dt-color-danger", "#f79289"],
    ] as const) {
      expect(valueOf(media, name)?.toLowerCase()).toBe(expected);
    }
  });
});

describe("qq33 P1 — shape and scale (theme-independent)", () => {
  const root = () => tokensCss();

  it("keeps the shared sm/md/lg radius scale at 4/8/12px", () => {
    expect(valueOf(root(), "--dt-radius-sm")).toBe("4px");
    expect(valueOf(root(), "--dt-radius")).toBe("8px");
    expect(valueOf(root(), "--dt-radius-lg")).toBe("12px");
  });

  it("declares the three approved radius exceptions and nothing else above 12px", () => {
    expect(valueOf(root(), "--dt-radius-pill")).toBe("999px");
    expect(valueOf(root(), "--dt-radius-search")).toBe("22px");
    expect(valueOf(root(), "--dt-radius-spotlight-open")).toBe("16px");
  });

  it.each([
    ["--dt-space-1", "4px"],
    ["--dt-space-2", "8px"],
    ["--dt-space-3", "12px"],
    ["--dt-space-4", "16px"],
    ["--dt-space-5", "20px"],
    ["--dt-space-6", "24px"],
  ])("%s is %s", (name, expected) => {
    expect(valueOf(root(), name)).toBe(expected);
  });

  it("touch targets are 44px minimum and 48px comfortable", () => {
    expect(valueOf(root(), "--dt-target-touch")).toBe("44px");
    expect(valueOf(root(), "--dt-target-touch-comfortable")).toBe("48px");
  });
});

describe("qq33 P1 — motion", () => {
  const root = () => tokensCss();

  it("declares the four durations from the spec", () => {
    expect(valueOf(root(), "--dt-motion-duration-fast")).toBe("160ms");
    expect(valueOf(root(), "--dt-motion-duration-base")).toBe("200ms");
    expect(valueOf(root(), "--dt-motion-duration-slow")).toBe("220ms");
    expect(valueOf(root(), "--dt-motion-duration-morph")).toBe("300ms");
  });

  it("the default duration token is the fast tier, unchanged from before qq33", () => {
    expect(valueOf(root(), "--dt-motion-duration")).toBe("160ms");
  });

  it("the standard easing curve is qq33's cubic-bezier, replacing the prior curve", () => {
    expect(valueOf(root(), "--dt-motion-ease")).toBe("cubic-bezier(0.2, 0.8, 0.2, 1)");
  });
});

describe("qq33 P1 — layer (scrim + blur), fixed across themes", () => {
  const root = () => tokensCss();

  it("the scrim is cool grey / slate-500, as rgb channels for rgb(var(...) / alpha)", () => {
    expect(valueOf(root(), "--dt-scrim-grey")).toBe("100 116 139");
  });

  it.each([
    ["--dt-scrim-page", "0.12"],
    ["--dt-scrim-nested", "0.1"],
  ])("%s is %s", (name, expected) => {
    const value = valueOf(root(), name);
    expect(Number(value)).toBe(Number(expected));
  });

  it.each([
    ["--dt-blur-page", "2px"],
    ["--dt-blur-nested", "1px"],
  ])("%s is %s", (name, expected) => {
    expect(valueOf(root(), name)).toBe(expected);
  });

  it("the scrim and blur tokens are declared once, outside any theme selector", () => {
    // They must exist in the base :root block, not only inside a dark override -
    // the atom rule is "rengi HER ZAMAN sabit" (always fixed), not per-theme.
    const rootBlock = block(tokensCss(), ":root {");
    expect(rootBlock).toContain("--dt-scrim-grey:");
    expect(rootBlock).toContain("--dt-blur-page:");
  });
});

describe("qq33 P1 — typography (already aligned, guarded against drift)", () => {
  const root = () => tokensCss();

  it("the font stack leads with Roboto Variable", () => {
    expect(valueOf(root(), "--dt-font-sans")).toMatch(/^"Roboto Variable"/u);
  });

  it.each([
    ["--dt-font-size-base", "1rem"],
    ["--dt-font-size-lg", "1.125rem"],
    ["--dt-font-size-xl", "1.375rem"],
    ["--dt-font-size-2xl", "1.75rem"],
  ])("%s is %s", (name, expected) => {
    expect(valueOf(root(), name)).toBe(expected);
  });

  it("line-height is 1.55 and weights stop at 400/500/700", () => {
    expect(valueOf(root(), "--dt-line-height")).toBe("1.55");
    expect(valueOf(root(), "--dt-font-weight-regular")).toBe("400");
    expect(valueOf(root(), "--dt-font-weight-medium")).toBe("500");
    expect(valueOf(root(), "--dt-font-weight-bold")).toBe("700");
  });
});

describe("qq33 P1 — Tailwind v4 @theme bridge", () => {
  const theme = () => tailwindCss();

  it("bridges the new semantic colours by reference, not by literal", () => {
    for (const [tw, dt] of [
      ["--color-hover", "var(--dt-color-hover)"],
      ["--color-selected", "var(--dt-color-selected)"],
      ["--color-ok", "var(--dt-color-ok)"],
      ["--color-warn", "var(--dt-color-warn)"],
      ["--color-neutral", "var(--dt-color-neutral)"],
      ["--color-neutral-bg", "var(--dt-color-neutral-bg)"],
    ] as const) {
      expect(valueOf(theme(), tw)).toBe(dt);
    }
  });

  it("exposes the three radius exceptions as utilities with the exact approved values", () => {
    const css = theme();
    expect(css).toMatch(/@utility rounded-search\s*\{\s*border-radius:\s*22px;\s*\}/u);
    expect(css).toMatch(/@utility rounded-spotlight-open\s*\{\s*border-radius:\s*16px;\s*\}/u);
    expect(css).toMatch(/@utility rounded-pill\s*\{\s*border-radius:\s*999px;\s*\}/u);
  });

  it("bridges the comfortable touch target alongside the existing minimum", () => {
    expect(valueOf(theme(), "--spacing-touch")).toBe("var(--dt-target-touch)");
    expect(valueOf(theme(), "--spacing-touch-comfortable")).toBe(
      "var(--dt-target-touch-comfortable)",
    );
  });

  it("bridges the motion tiers as duration/easing utilities", () => {
    expect(valueOf(theme(), "--duration-fast")).toBe("var(--dt-motion-duration-fast)");
    expect(valueOf(theme(), "--duration-base")).toBe("var(--dt-motion-duration-base)");
    expect(valueOf(theme(), "--duration-slow")).toBe("var(--dt-motion-duration-slow)");
    expect(valueOf(theme(), "--duration-morph")).toBe("var(--dt-motion-duration-morph)");
    expect(valueOf(theme(), "--ease-standard")).toBe("var(--dt-motion-ease)");
  });

  it("bridges blur tiers for the layer atoms", () => {
    expect(valueOf(theme(), "--blur-page")).toBe("var(--dt-blur-page)");
    expect(valueOf(theme(), "--blur-nested")).toBe("var(--dt-blur-nested)");
  });
});
