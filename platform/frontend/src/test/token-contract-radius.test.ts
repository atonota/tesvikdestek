/**
 * P1C token contract, part 2: no corner in `.tsx` source exceeds the token
 * scale.
 *
 * `design-system-contract.test.ts` already holds the *stylesheets* to
 * "nothing is a pill, nothing exceeds 12px" - `--dt-radius-lg` tops out
 * there and the CSS files are asserted against it directly. This file holds
 * the same ceiling for `.tsx` source, where a radius can also appear as an
 * inline `style` object or a chart's `itemStyle.borderRadius` array, neither
 * of which a CSS-file scan ever reads.
 *
 * The one documented exception is the search field: the master token spec
 * names a single `22px` radius for the search/spotlight input, nothing
 * higher, and never a pill. That exception is scoped to source text that is
 * actually about search - checked from context around the declaration, not
 * from a filename convention - so a future, unrelated 22px value elsewhere
 * does not slip through as "close enough to be search".
 *
 * Deliberately narrow: this reads `border-radius:` / `borderRadius:`
 * specifically, never the bare word "radius". `PortfolioAnalytics.tsx`
 * declares `radius: ["45%", "72%"]` on a pie chart - that is the chart's
 * geometry (how much of its box the ring occupies), not a CSS corner, and a
 * scan keyed on "radius" alone would misreport it as a pill.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const SEARCH_CONTEXT = /search|arama|spotlight/iu;
const DEFAULT_MAX_PX = 12;
const SEARCH_MAX_PX = 22;
const PILL_TOKENS = ["999px", "9999px", "50%"];

/** Byte ranges `[start, end)` covered by `//` or `/* *‍/` comments. */
function commentRanges(source: string): Array<readonly [number, number]> {
  const ranges: Array<readonly [number, number]> = [];
  const pattern = /\/\*[\s\S]*?\*\/|\/\/.*$/gmu;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source))) {
    ranges.push([match.index, match.index + match[0].length]);
  }
  return ranges;
}

const insideAny = (ranges: Array<readonly [number, number]>, index: number): boolean =>
  ranges.some(([start, end]) => index >= start && index < end);

interface RadiusFinding {
  readonly raw: string;
  readonly numbers: readonly number[];
  readonly isPill: boolean;
  readonly context: string;
}

/**
 * Finds every `border-radius:` / `borderRadius:` declaration in `source` and
 * returns its raw value text, the numeric corner sizes inside it (a bare
 * number is read as px, matching both CSS shorthand and ECharts'
 * `itemStyle.borderRadius` arrays), whether it spells a pill, and the 200
 * characters immediately before it for the search exception to read.
 *
 * A declaration whose *marker* (`border-radius:`) sits inside a comment is
 * skipped outright - it is being discussed, not shipped. A declaration whose
 * marker is real code keeps the original, comment-and-all, surrounding text
 * as its context, because the search exception is signalled by a comment
 * ("// Spotlight search field") as often as by an identifier.
 */
function findRadiusDeclarations(source: string): RadiusFinding[] {
  const comments = commentRanges(source);
  const findings: RadiusFinding[] = [];
  const marker = /border-?radius\s*:\s*/giu;
  let match: RegExpExecArray | null;
  while ((match = marker.exec(source))) {
    if (insideAny(comments, match.index)) continue;
    const start = match.index + match[0].length;
    let depth = 0;
    let end = start;
    while (end < source.length) {
      const ch = source[end];
      if (ch === "[" || ch === "(" || ch === "{") depth += 1;
      else if (ch === "]" || ch === ")" || ch === "}") {
        if (depth === 0) break;
        depth -= 1;
      } else if (depth === 0 && (ch === "," || ch === ";")) {
        break;
      }
      end += 1;
    }
    const raw = source.slice(start, end).trim();
    const numbers = [...raw.matchAll(/(\d+(?:\.\d+)?)(?:px)?/gu)].map((m) => Number(m[1]));
    const isPill = PILL_TOKENS.some((token) => raw.includes(token));
    findings.push({
      raw,
      numbers,
      isPill,
      context: source.slice(Math.max(0, match.index - 200), match.index),
    });
  }
  return findings;
}

/** A finding is acceptable exactly when it is neither a pill nor over its ceiling. */
function violationFor(finding: RadiusFinding): string | undefined {
  if (finding.isPill) return `pill radius: ${finding.raw}`;
  const ceiling = SEARCH_CONTEXT.test(finding.context) ? SEARCH_MAX_PX : DEFAULT_MAX_PX;
  const offenders = finding.numbers.filter((n) => n > ceiling);
  if (offenders.length > 0) {
    return `${finding.raw} exceeds ${ceiling}px (search-scoped: ${ceiling === SEARCH_MAX_PX})`;
  }
  return undefined;
}

describe("findRadiusDeclarations / violationFor (validator unit tests)", () => {
  it("reads a plain CSS-in-string declaration", () => {
    const [finding] = findRadiusDeclarations("const s = 'border-radius: 16px;';");
    expect(finding?.numbers).toEqual([16]);
    expect(violationFor(finding as RadiusFinding)).toMatch(/exceeds 12px/u);
  });

  it("reads a camelCase style-object declaration", () => {
    const [finding] = findRadiusDeclarations("const s = { borderRadius: 20 };");
    expect(finding?.numbers).toEqual([20]);
    expect(violationFor(finding as RadiusFinding)).toMatch(/exceeds 12px/u);
  });

  it("reads every corner out of an ECharts-style array without stopping at the first comma", () => {
    const [finding] = findRadiusDeclarations("const s = { borderRadius: [0, 8, 20, 0] };");
    expect(finding?.numbers).toEqual([0, 8, 20, 0]);
    expect(violationFor(finding as RadiusFinding)).toMatch(/exceeds 12px/u);
  });

  it("passes a value at or under the 12px ceiling", () => {
    const [finding] = findRadiusDeclarations("const s = { borderRadius: [0, 8, 8, 0] };");
    expect(violationFor(finding as RadiusFinding)).toBeUndefined();
  });

  it("flags a pill outright, independent of the numeric ceiling", () => {
    const [finding] = findRadiusDeclarations("const s = 'border-radius: 999px;';");
    expect(violationFor(finding as RadiusFinding)).toMatch(/pill/u);
  });

  it("flags a percentage pill", () => {
    const [finding] = findRadiusDeclarations("const s = { borderRadius: '50%' };");
    expect(violationFor(finding as RadiusFinding)).toMatch(/pill/u);
  });

  it("allows up to 22px only when the declaration sits in search/spotlight context", () => {
    const searchy = `
      // The Spotlight search field expands from 44px to 52px on focus.
      const idle = { borderRadius: 22 };
    `;
    const [finding] = findRadiusDeclarations(searchy);
    expect(violationFor(finding as RadiusFinding)).toBeUndefined();
  });

  it("does not extend the search exception to an unrelated 22px value", () => {
    const notSearchy = "const s = { borderRadius: 22 };";
    const [finding] = findRadiusDeclarations(notSearchy);
    expect(violationFor(finding as RadiusFinding)).toMatch(/exceeds 12px/u);
  });

  it("still caps the search exception at 22px", () => {
    const searchy = "// search input\nconst s = { borderRadius: 30 };";
    const [finding] = findRadiusDeclarations(searchy);
    expect(violationFor(finding as RadiusFinding)).toMatch(/exceeds 22px/u);
  });

  it("ignores a value discussed only in a comment", () => {
    const commentedOnly = "// border-radius: 999px was the old spec\nconst s = 1;";
    expect(findRadiusDeclarations(commentedOnly)).toEqual([]);
  });

  it("does not mistake a chart's geometric radius for a CSS corner", () => {
    // `PortfolioAnalytics.tsx`'s real shape: a pie chart's inner/outer ring.
    const chart = "const s = { radius: ['45%', '72%'] };";
    expect(findRadiusDeclarations(chart)).toEqual([]);
  });
});

describe("no .tsx corner in src/ exceeds the token scale (repo-wide gate)", () => {
  /**
   * `.test.tsx` and `.stories.tsx` are excluded from the production scan.
   * A test file legitimately spells `border-radius:` inside a regex or a
   * string it is asserting *against* CSS text - `adaptive.test.tsx` does
   * exactly that (`expect(sheet).not.toMatch(/border-radius:...(999px|50%)/)`)
   * - and that is source text discussing the contract, not a component
   * declaring a corner. Neither carries a shipped style, so this gate does
   * not read either.
   */
  const isProductionSource = (name: string): boolean =>
    name.endsWith(".tsx") && !name.endsWith(".test.tsx") && !name.endsWith(".stories.tsx");

  const tsxFiles = (): string[] => {
    const found: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules") continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (isProductionSource(entry.name)) found.push(full);
      }
    };
    walk(join(ROOT, "src"));
    return found;
  };

  it("finds .tsx source to actually check", () => {
    expect(tsxFiles().length).toBeGreaterThan(10);
  });

  it("finds at least one real border-radius declaration to prove the scan sees production code", () => {
    const total = tsxFiles()
      .map((file) => findRadiusDeclarations(readFileSync(file, "utf8")))
      .flat();
    expect(total.length).toBeGreaterThan(0);
  });

  it("every .tsx radius declaration in src/ is within the token contract", () => {
    const offenders: string[] = [];
    for (const file of tsxFiles()) {
      const findings = findRadiusDeclarations(readFileSync(file, "utf8"));
      for (const finding of findings) {
        const violation = violationFor(finding);
        if (violation) offenders.push(`${file}: ${violation}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the gate is not decorative: it still catches an injected pill", () => {
    const injected = "const bad = { borderRadius: '999px' };";
    const findings = findRadiusDeclarations(injected);
    expect(findings.some((f) => violationFor(f) !== undefined)).toBe(true);
  });
});
