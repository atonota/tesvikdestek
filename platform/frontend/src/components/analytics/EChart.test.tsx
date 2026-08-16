/**
 * `readChartTheme`'s own contract, isolated from the chart it feeds.
 *
 * `analytics.test.tsx` mocks `EChart` (and `readChartTheme` with it) entirely
 * - deliberately, because a canvas that cannot initialise under jsdom makes
 * the memoisation that file is about unobservable through the real module.
 * That mock means the real resolver is never exercised anywhere else in the
 * suite, which is exactly why it gets its own file: the P1C token contract
 * ("no raw hex in `.tsx`, ever") removed `readChartTheme`'s hex fallback, and
 * a removed fallback is only a real guarantee if something proves what
 * replaced it - reading every token from computed style, with nothing of its
 * own - actually behaves as the docstring in `EChart.tsx` claims.
 *
 * Tokens are set directly on `<html>`'s inline style rather than by
 * importing the real `tokens.css`. jsdom's `getComputedStyle` resolves an
 * inline custom property deterministically in every version; resolving one
 * cascaded from a `<style>` element - especially through the dark-theme
 * selectors and the `prefers-color-scheme` media query `tokens.css` uses -
 * is not something every jsdom version is guaranteed to do, and a resolver
 * test has no business depending on that. What is asserted here is
 * `readChartTheme`'s own contract: read named tokens, complain by name if
 * one is absent. Whether `tokens.css` actually supplies them in a browser is
 * `token-contract-theme.test.ts` and `design-system-contract.test.ts`'s claim,
 * not this file's.
 */
import { afterEach, describe, expect, it } from "vitest";

import { readChartTheme, REQUIRED_CHART_TOKENS } from "./EChart";

/**
 * Any distinct, well-formed value works - the resolver does not judge shape,
 * it only forwards what `getPropertyValue` answers. Deliberately not hex:
 * proving the resolver is opaque to colour *format* also keeps this fixture
 * outside the P1C hex-literal gate it exists to prove, rather than needing a
 * second exception from a rule that now has none.
 */
const FIXTURE_VALUE: Record<(typeof REQUIRED_CHART_TOKENS)[number], string> = {
  "--dt-color-fg": "oklch(0.2 0.01 260)",
  "--dt-color-fg-muted": "oklch(0.45 0.02 260)",
  "--dt-color-line": "oklch(0.85 0.01 260)",
  "--dt-color-surface": "oklch(1 0 0)",
  "--dt-color-primary": "oklch(0.35 0.08 250)",
  "--dt-color-secondary": "oklch(0.88 0.15 100)",
  "--dt-outcome-candidate-line": "oklch(0.5 0.1 150)",
  "--dt-outcome-ineligible-line": "oklch(0.5 0.15 25)",
  "--dt-outcome-conditional-line": "oklch(0.55 0.12 70)",
  "--dt-outcome-insufficient-line": "oklch(0.5 0.03 250)",
};

/** Sets every required token except the ones named in `except`. */
function setTokens(except: readonly string[] = []): void {
  for (const name of REQUIRED_CHART_TOKENS) {
    if (except.includes(name)) continue;
    document.documentElement.style.setProperty(name, FIXTURE_VALUE[name]);
  }
}

afterEach(() => {
  for (const name of REQUIRED_CHART_TOKENS) {
    document.documentElement.style.removeProperty(name);
  }
});

describe("readChartTheme", () => {
  it("resolves every token from computed style", () => {
    setTokens();
    const theme = readChartTheme();
    expect(theme).toEqual({
      foreground: FIXTURE_VALUE["--dt-color-fg"],
      muted: FIXTURE_VALUE["--dt-color-fg-muted"],
      line: FIXTURE_VALUE["--dt-color-line"],
      surface: FIXTURE_VALUE["--dt-color-surface"],
      primary: FIXTURE_VALUE["--dt-color-primary"],
      secondary: FIXTURE_VALUE["--dt-color-secondary"],
      outcome: {
        candidate: FIXTURE_VALUE["--dt-outcome-candidate-line"],
        ineligible: FIXTURE_VALUE["--dt-outcome-ineligible-line"],
        conditional: FIXTURE_VALUE["--dt-outcome-conditional-line"],
        insufficient: FIXTURE_VALUE["--dt-outcome-insufficient-line"],
      },
    });
  });

  it("answers a different value when computed style answers a different value", () => {
    // Not decorative: proves the theme is actually *read*, not hard-coded
    // back in under another name.
    setTokens();
    document.documentElement.style.setProperty("--dt-color-primary", "oklch(0.75 0.09 250)");
    expect(readChartTheme().primary).toBe("oklch(0.75 0.09 250)");
  });

  it("throws, naming the missing token, when one required token is absent", () => {
    setTokens(["--dt-color-primary"]);
    expect(() => readChartTheme()).toThrow(/--dt-color-primary/u);
  });

  it("names every missing token, not just the first, when several are absent", () => {
    setTokens(["--dt-color-fg", "--dt-outcome-conditional-line"]);
    try {
      readChartTheme();
      expect.unreachable("readChartTheme'in eksik token'larda fırlatması bekleniyordu");
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toMatch(/--dt-color-fg/u);
      expect(message).toMatch(/--dt-outcome-conditional-line/u);
    }
  });

  it("throws when every token is absent, rather than answering an empty theme", () => {
    // Nothing set - the default state a fresh jsdom document starts in.
    expect(() => readChartTheme()).toThrow(Error);
  });

  it("carries no hex literal of its own", () => {
    // A structural echo of the P1C lint gate: read the compiled source text
    // and confirm no #RRGGBB survives in it, independent of the ESLint rule.
    // (The rule already asserts this repo-wide in token-contract-hex.test.ts;
    // this is the resolver's own file staying honest about why it can.)
    expect(readChartTheme.toString()).not.toMatch(/#[0-9a-fA-F]{3,8}\b/u);
  });
});
