/**
 * The design-system contract.
 *
 * These are product decisions the owner made explicit, and every one of them is
 * the kind that erodes silently: a 13px caption added "just here", a pill
 * radius copied from a screenshot, a secondary colour that fails contrast in
 * dark mode only. None of them is visible in a component test, and none of them
 * fails a build. So they are asserted against the stylesheets themselves.
 *
 * The rules:
 *
 *  - **Every user-visible size is at least 1rem.** Not "usually" - the token
 *    scale has no member below it, in any density or font-scale variant, and no
 *    stylesheet hard-codes one either.
 *  - **Weights start at 400.** 300 and lighter are unreadable on the LCD panels
 *    this product is actually used on.
 *  - **Nothing is a pill, with three named exceptions.** `999px`, `9999px` and
 *    `50%` are banned outright, and every remaining radius is at most 12px. On
 *    a small box the browser clamps a 12px radius to half the box, so genuine
 *    circles (the spinner) still render as circles without the stylesheet
 *    claiming a pill. qq33 P1 (MASTER karari 2026-08-16, qq33MASTER-PROMPT.md
 *    BÖLÜM 1 "ONAYLI DEĞERLER") opens exactly three closed exceptions -
 *    `@utility rounded-pill` (999px), `@utility rounded-search` (22px) and
 *    `@utility rounded-spotlight-open` (16px) - and no other selector, in no
 *    other stylesheet, may exceed 12px.
 *  - **Parliament blue and lemon yellow are tokens**, not literals sprinkled
 *    through components.
 *  - **Roboto is bundled**, not wished for in a font stack that falls back to
 *    whatever the operating system happens to have.
 *  - **Both themes pass WCAG**, computed here rather than eyeballed.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const DESIGN = join(ROOT, "src", "design");

const stylesheets = () =>
  readdirSync(DESIGN)
    .filter((entry) => entry.endsWith(".css"))
    .map((entry) => ({ name: entry, css: readFileSync(join(DESIGN, entry), "utf8") }));

/** Comments discuss the banned values; only declarations are judged. */
const withoutComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//gu, "");

const tokens = () => withoutComments(readFileSync(join(DESIGN, "tokens.css"), "utf8"));

/* ------------------------------------------------------------ typography */

describe("no user-visible text is smaller than 1rem", () => {
  it("every font-size token is at least 1rem, in every variant", () => {
    const offenders: string[] = [];
    for (const [, name, value] of tokens().matchAll(
      /(--dt-font-size-[\w-]+):\s*([\d.]+)rem/gu,
    )) {
      if (Number(value) < 1) offenders.push(`${name}: ${value}rem`);
    }
    expect(offenders).toEqual([]);
  });

  it("finds the font-size tokens at all", () => {
    // A guard that silently checks nothing is decorative.
    expect([...tokens().matchAll(/--dt-font-size-[\w-]+:/gu)].length).toBeGreaterThan(4);
  });

  it("no stylesheet hard-codes a font-size below 1rem", () => {
    const offenders: string[] = [];
    for (const { name, css } of stylesheets()) {
      for (const [, value, unit] of withoutComments(css).matchAll(
        /font-size:\s*([\d.]+)(rem|px|em)\b/gu,
      )) {
        const rem = unit === "px" ? Number(value) / 16 : Number(value);
        if (rem < 1) offenders.push(`${name}: ${value}${unit}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("no text is lighter than weight 400", () => {
  it.each(stylesheets().map(({ name }) => name))("%s uses no weight below 400", (name) => {
    const css = withoutComments(
      readFileSync(join(DESIGN, name), "utf8"),
    );
    const offenders = [...css.matchAll(/font-weight:\s*(\d{3})/gu)]
      .map((match) => Number(match[1]))
      .filter((weight) => weight < 400);
    expect(offenders).toEqual([]);
  });
});

/* ----------------------------------------------------------------- shape */

/**
 * The three closed exceptions to the 12px ceiling, by CSS rule selector.
 *
 * Keyed on the exact `@utility` selector so an exception admits nothing
 * beyond the one declaration it names - a stray `border-radius: 999px`
 * anywhere else in the design layer still fails both checks below.
 */
const RADIUS_EXCEPTIONS: Readonly<Record<string, number>> = {
  "@utility rounded-pill": 999,
  "@utility rounded-search": 22,
  "@utility rounded-spotlight-open": 16,
};

/** Rules as `[selector, declarations]`, comments already stripped. */
const cssRules = (css: string): readonly (readonly [string, string])[] =>
  [...css.matchAll(/([^{}]+)\{([^{}]*)\}/gu)].map(
    ([, selector, body]) => [(selector ?? "").trim().replace(/\s+/gu, " "), body ?? ""] as const,
  );

describe("nothing is a pill and no corner exceeds 12px, outside the three named exceptions", () => {
  it.each(stylesheets().map(({ name }) => name))("%s declares no pill radius", (name) => {
    const css = withoutComments(readFileSync(join(DESIGN, name), "utf8"));
    const offenders: string[] = [];
    for (const [selector, body] of cssRules(css)) {
      for (const [, size] of body.matchAll(/border-radius:[^;]*?(999px|9999px|50%)/gu)) {
        const match = size ?? "";
        if (RADIUS_EXCEPTIONS[selector] === Number(match.replace("px", ""))) continue;
        offenders.push(`${selector}: ${match}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it.each(stylesheets().map(({ name }) => name))(
    "%s keeps every corner at 12px or less outside the named exceptions",
    (name) => {
      const css = withoutComments(readFileSync(join(DESIGN, name), "utf8"));
      const offenders: string[] = [];
      for (const [selector, body] of cssRules(css)) {
        for (const [, values] of body.matchAll(/border-radius:\s*([^;]+);/gu)) {
          for (const [, size] of (values ?? "").matchAll(/([\d.]+)px/gu)) {
            if (Number(size) <= 12) continue;
            if (RADIUS_EXCEPTIONS[selector] === Number(size)) continue;
            offenders.push(`${selector}: ${values?.trim()}`);
          }
        }
      }
      expect(offenders).toEqual([]);
    },
  );

  it("the three named exceptions carry exactly their approved values, nowhere else", () => {
    const css = withoutComments(readFileSync(join(DESIGN, "tailwind.css"), "utf8"));
    for (const [selector, expected] of Object.entries(RADIUS_EXCEPTIONS)) {
      const rule = cssRules(css).find(([sel]) => sel === selector);
      expect(rule, `${selector} is not declared in tailwind.css`).toBeDefined();
      expect(rule?.[1]).toMatch(new RegExp(`border-radius:\\s*${expected}px`, "u"));
    }
  });

  it("the radius tokens themselves top out at 12px, except the three named exceptions", () => {
    const exceptionTokens = new Set([
      "--dt-radius-pill",
      "--dt-radius-search",
      "--dt-radius-spotlight-open",
    ]);
    for (const [, name, size] of tokens().matchAll(/(--dt-radius[\w-]*):\s*([\d.]+)px/gu)) {
      if (exceptionTokens.has(name ?? "")) continue;
      expect(Number(size), `${name} is larger than 12px`).toBeLessThanOrEqual(12);
    }
  });

  it("the three exception tokens carry qq33 P1's approved values", () => {
    const css = tokens();
    expect(/--dt-radius-pill:\s*999px/u.test(css)).toBe(true);
    expect(/--dt-radius-search:\s*22px/u.test(css)).toBe(true);
    expect(/--dt-radius-spotlight-open:\s*16px/u.test(css)).toBe(true);
  });
});

/* ----------------------------------------------------------- zero minimums */

/**
 * A grid track's minimum is what decides whether 320px overflows.
 *
 * `adaptive.css` has been held to this since it was written, and the rule was
 * never extended to the stylesheets beside it - so `/kaynaklar` scrolled
 * sideways by 35 pixels on a small phone. The cause was two declarations away
 * from the shell: `.dt-grid` and `.dt-grid__toolbar` left their columns
 * implicit, an implicit track is `auto`, and `auto` takes its minimum from its
 * widest child - here a search field asking for 18rem - and then grows the
 * whole page rather than wrapping.
 *
 * Both halves of the rule matter, and only together:
 *
 *  - a `display: grid` rule must **say** what its columns are, because the
 *    implicit track is the one that overflows;
 *  - a declared track of `1fr` is `minmax(auto, 1fr)`, whose minimum is still
 *    the content, so every flexible track is written `minmax(0, 1fr)`.
 *
 * Scoped to the stylesheets the application entry actually imports - read from
 * `main.tsx` rather than listed here, so a new sheet is covered the day it is
 * imported. The media and provider sheets are outside that scope because they
 * are imported by their own lazily loaded route modules (`routes/media.tsx`,
 * `routes/providers.tsx`) rather than by the entry, so they are not part of the
 * eager bundle this group is written about. They are not unchecked: each is
 * held to the same zero-minimum track rule by the suite that owns its
 * subsystem, and both routes are now visited in a real browser at both
 * viewports - `e2e/media-route.spec.ts`, `e2e/provider-route.spec.ts` and the
 * accessibility sweep - which is a stronger guard than this file can be.
 */
describe("no grid in a shipped stylesheet can overflow a 320px phone", () => {
  const entrySheets = (): string[] => {
    const main = readFileSync(join(ROOT, "src", "main.tsx"), "utf8");
    const found = [...main.matchAll(/import\s+["']@\/design\/([\w-]+\.css)["']/gu)].map(
      (match) => match[1] as string,
    );
    return found;
  };

  /** Rules as `[selector, declarations]`, comments already stripped. */
  const rulesOf = (name: string): readonly (readonly [string, string])[] => {
    const css = withoutComments(readFileSync(join(DESIGN, name), "utf8"));
    return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/gu)].map(
      ([, selector, body]) => [(selector ?? "").trim().replace(/\s+/gu, " "), body ?? ""] as const,
    );
  };

  it("reads the stylesheets the entry really imports", () => {
    const sheets = entrySheets();
    expect(sheets).toContain("adaptive.css");
    expect(sheets).toContain("data-grid.css");
    expect(sheets).toContain("components.css");
    // The two subsystem sheets are loaded by their own route modules, not by
    // the entry, so they stay out of this rule and out of the eager bundle -
    // `build-contract.test.ts` owns that half of the claim.
    expect(sheets).not.toContain("media.css");
    expect(sheets).not.toContain("provider-connections.css");
  });

  it("finds enough grids for the guard to mean something", () => {
    const grids = entrySheets().flatMap((name) =>
      rulesOf(name).filter(([, body]) => /display:\s*(inline-)?grid/u.test(body)),
    );
    expect(grids.length).toBeGreaterThan(20);
  });

  it.each(["adaptive.css", "components.css", "data-grid.css"])(
    "%s declares the columns of every grid it opens",
    (name) => {
      const offenders = rulesOf(name)
        .filter(([, body]) => /display:\s*(inline-)?grid/u.test(body))
        .filter(([, body]) => !/grid-template-columns:/u.test(body))
        .map(([selector]) => selector);
      expect(offenders).toEqual([]);
    },
  );

  it.each(["adaptive.css", "components.css", "data-grid.css"])(
    "%s gives every flexible track a zero minimum",
    (name) => {
      const offenders: string[] = [];
      for (const [selector, body] of rulesOf(name)) {
        for (const [, value] of body.matchAll(/grid-template-columns:\s*([^;]+)/gu)) {
          // `minmax(0, 1fr)` is the whole point, so the well-formed tracks are
          // removed before the bare ones are counted.
          const bare = (value ?? "").replace(/minmax\([^)]*\)/gu, "");
          if (/[\d.]*fr\b/u.test(bare)) offenders.push(`${selector}: ${value?.trim()}`);
        }
      }
      expect(offenders).toEqual([]);
    },
  );

  it("the guard can still tell a good track from a bad one", () => {
    // A check that cannot fail is decoration.
    const bad = "repeat(2, 1fr)".replace(/minmax\([^)]*\)/gu, "");
    const good = "repeat(2, minmax(0, 1fr))".replace(/minmax\([^)]*\)/gu, "");
    expect(/[\d.]*fr\b/u.test(bad)).toBe(true);
    expect(/[\d.]*fr\b/u.test(good)).toBe(false);
  });
});

/* ------------------------------------------------------- clipped evidence */

/**
 * A card that hides an overflow hides evidence.
 *
 * `.dt-card` is `overflow: hidden` - it has to be, or the surface it paints
 * escapes its own rounded corners. That clip is only safe while everything
 * inside it can actually wrap. `.dt-mono` could not: it is the class on content
 * hashes, endpoints and MIME types, which are single tokens with no space in
 * them, and `overflow-wrap` was left at `normal`.
 *
 * Measured in Chromium at 320x568 on the built bundle: `/kaynaklar` painted the
 * snapshot hash `40fd42e21c92` 34 pixels past the right edge of its card, on
 * three cards, and `/yetenekler` cut the `POST /degerlendirmeler/{id}/onay`
 * endpoint by 7. Nothing scrolled, nothing was marked truncated - the characters
 * were simply not on screen. A hash that is missing its last three characters
 * still looks like a hash, which is what makes this worse than a visible cut.
 *
 * `media.css` already reached this conclusion for the media surfaces and wrote
 * it down; this is the same rule for the classes the live routes actually use.
 */
describe("no card silently clips the evidence inside it", () => {
  const declarationsFor = (name: string, selector: string): string => {
    const css = withoutComments(readFileSync(join(DESIGN, name), "utf8"));
    const pattern = new RegExp(
      `(^|[,{}])\\s*${selector.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\\s*\\{([^{}]*)\\}`,
      "gu",
    );
    return [...css.matchAll(pattern)].map((match) => match[2] ?? "").join(" ");
  };

  it("finds the rules it claims to judge", () => {
    expect(declarationsFor("base.css", ".dt-mono")).toMatch(/font-family/u);
    expect(declarationsFor("components.css", ".dt-card")).toMatch(/border-radius/u);
  });

  it("lets an unbreakable token wrap instead of running past the card", () => {
    // `anywhere` rather than `break-word`: `break-word` only breaks when the
    // token is alone on its line, and these sit in a two-column definition row
    // beside their label.
    expect(
      declarationsFor("base.css", ".dt-mono"),
      "long hashes and endpoints have no break opportunity and will be clipped",
    ).toMatch(/overflow-wrap:\s*anywhere/u);
  });

  it("keeps the clip on the card honest by never letting content reach it", () => {
    // The card still clips - that is what keeps the painted surface inside its
    // radius. The contract is that nothing arrives at that edge in the first
    // place, so `min-inline-size: 0` on the body that carries the columns.
    const card = declarationsFor("components.css", ".dt-card");
    expect(card).toMatch(/overflow:\s*hidden/u);
    expect(declarationsFor("components.css", ".dt-card__body")).toMatch(
      /min-inline-size:\s*0/u,
    );
  });
});

/* -------------------------------------------------- the focusable scroller */

/**
 * A scrolling region that takes focus has to show that it has it.
 *
 * The step list gets `tabindex="0"` so a keyboard can scroll it (axe
 * `scrollable-region-focusable`, serious). A focus stop with no ring is a
 * keyboard user landing somewhere invisible, which trades one serious failure
 * for another.
 */
describe("the step list shows its own focus", () => {
  it("draws a visible ring when the scrolling region is focused", () => {
    const css = withoutComments(readFileSync(join(DESIGN, "components.css"), "utf8"));
    const rule = /\.dt-stepper__list:focus-visible\s*\{([^{}]*)\}/u.exec(css)?.[1] ?? "";
    expect(rule, "the focusable step list has no focus style").toMatch(/outline/u);
  });
});

/* ---------------------------------------------------------------- brand */

describe("the brand palette is tokenised", () => {
  it("declares parliament blue as the primary and lemon as the secondary", () => {
    const css = tokens();
    for (const token of [
      "--dt-color-primary",
      "--dt-color-primary-fg",
      "--dt-color-secondary",
      "--dt-color-secondary-fg",
    ]) {
      expect(css).toContain(`${token}:`);
    }
  });

  it("defines both brands in the light and the dark theme", () => {
    const css = tokens();
    const dark = css.slice(css.indexOf(':root[data-theme="dark"]'));
    expect(dark).toContain("--dt-color-primary:");
    expect(dark).toContain("--dt-color-secondary:");
  });
});

/* ------------------------------------------------------------------ font */

describe("Roboto is actually bundled", () => {
  const manifest = () =>
    JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
      dependencies: Record<string, string>;
    };

  it("is a pinned dependency, not a hope about the operating system", () => {
    const roboto = manifest().dependencies["@fontsource-variable/roboto"];
    expect(roboto).toBeDefined();
    // Exact version, in keeping with every other dependency in this manifest.
    expect(roboto).toMatch(/^\d+\.\d+\.\d+$/u);
  });

  it("is loaded by the application entry and by the Storybook preview", () => {
    const main = readFileSync(join(ROOT, "src", "main.tsx"), "utf8");
    const preview = readFileSync(join(ROOT, ".storybook", "preview.tsx"), "utf8");
    for (const source of [main, preview]) {
      expect(source).toMatch(/roboto\.css/u);
    }
  });

  it("declares its faces from the bundled package rather than a remote host", () => {
    // The whole point of bundling: no request leaves the origin for a font.
    const face = readFileSync(join(DESIGN, "roboto.css"), "utf8");
    expect(face).toMatch(/@fontsource-variable\/roboto\/files\//u);
    expect(face).not.toMatch(/https?:\/\//u);
    expect(face).toMatch(/font-display:\s*swap/u);
  });

  it("ships only the subsets a Turkish interface reads", () => {
    /**
     * The package contains 54 files - six axes across nine subsets, italics
     * included. Emitting all of them would be the same dead-weight mistake the
     * build contract exists to catch, so exactly two faces are declared:
     * Latin, and Latin Extended for ı, İ, ş, ğ and Ç.
     */
    const face = readFileSync(join(DESIGN, "roboto.css"), "utf8");
    const files = [...face.matchAll(/roboto-([a-z-]+)-wght-normal\.woff2/gu)].map((m) => m[1]);
    expect(files.sort()).toEqual(["latin", "latin-ext"]);
    // Comments stripped: the docstring explains why italic is absent, and a
    // guard that banned the word would ban the explanation with it.
    expect(withoutComments(face)).not.toMatch(/italic/u);
  });

  it("is the first family in the sans stack", () => {
    const stack = /--dt-font-sans:\s*([^;]+);/u.exec(tokens())?.[1] ?? "";
    expect(stack.trim()).toMatch(/^["']?Roboto/u);
  });
});

/* -------------------------------------------------------------- contrast */

/** sRGB relative luminance, per WCAG 2.x. */
function luminance(hex: string): number {
  const value = hex.replace("#", "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((char) => char + char)
          .join("")
      : value;
  const channels = [0, 2, 4].map((offset) => {
    const raw = parseInt(full.slice(offset, offset + 2), 16) / 255;
    return raw <= 0.03928 ? raw / 12.92 : ((raw + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground: string, background: string): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a) as [
    number,
    number,
  ];
  return (light + 0.05) / (dark + 0.05);
}

/** Hex values declared inside one selector block of `tokens.css`. */
function palette(selector: string): Record<string, string> {
  const css = tokens();
  const start = css.indexOf(selector);
  if (start < 0) return {};
  const open = css.indexOf("{", start);
  let depth = 1;
  let index = open + 1;
  while (index < css.length && depth > 0) {
    if (css[index] === "{") depth += 1;
    else if (css[index] === "}") depth -= 1;
    index += 1;
  }
  const block = css.slice(open, index);
  const found: Record<string, string> = {};
  for (const [, name, value] of block.matchAll(/(--dt-color-[\w-]+):\s*(#[0-9a-fA-F]{3,8})/gu)) {
    found[name ?? ""] = value ?? "";
  }
  return found;
}

/** Text pairs need 4.5:1; non-text UI boundaries need 3:1. */
const TEXT_PAIRS: readonly (readonly [string, string])[] = [
  ["--dt-color-fg", "--dt-color-bg"],
  ["--dt-color-fg", "--dt-color-surface"],
  ["--dt-color-fg-muted", "--dt-color-bg"],
  ["--dt-color-fg-muted", "--dt-color-surface"],
  ["--dt-color-accent-fg", "--dt-color-accent"],
  ["--dt-color-primary-fg", "--dt-color-primary"],
  ["--dt-color-secondary-fg", "--dt-color-secondary"],
  /* The destructive pair. Added when a button hard-coded `text-white` onto it:
     correct on the light theme's deep red, 1.8:1 on the dark theme's tint. */
  ["--dt-color-danger-fg", "--dt-color-danger"],
];

/**
 * `--dt-color-line-strong` on `--dt-color-surface` is deliberately absent
 * here. qq33 P1 (MASTER karari 2026-08-16) is the owner-canonical token
 * contract and its `--border-strong` (#C1CBD8 light / #3D4A59 dark) is a
 * literal value from the two approved prototypes, not derived to clear 3:1 -
 * it measures 1.64:1 light and 1.91:1 dark, both below the non-text UI
 * boundary floor. This is a named, recorded exception (see the block below),
 * not a silently dropped check: `border-strong` is a divider/secondary-border
 * tone, never the sole cue for an interactive element's boundary in the
 * qq33 prototypes, so it is out of this blanket 3:1 sweep rather than out of
 * the design system's accessibility obligations altogether.
 */
const UI_PAIRS: readonly (readonly [string, string])[] = [
  ["--dt-color-focus", "--dt-color-bg"],
  ["--dt-color-primary", "--dt-color-surface"],
];

describe.each([
  ["light", ":root"],
  ["dark", ':root[data-theme="dark"]'],
])("the %s theme passes WCAG", (_theme, selector) => {
  const colours = () => {
    // The dark block overrides a subset; anything it does not restate is
    // inherited from `:root`, so the light palette is the base for both.
    const base = palette(":root");
    return selector === ":root" ? base : { ...base, ...palette(selector) };
  };

  it("declares the colours this check needs", () => {
    const found = colours();
    for (const [foreground, background] of [...TEXT_PAIRS, ...UI_PAIRS]) {
      expect(found[foreground], `${foreground} missing`).toBeDefined();
      expect(found[background], `${background} missing`).toBeDefined();
    }
  });

  /**
   * A missing token must fail, not default.
   *
   * Falling back to black-on-white would make every pair involving an
   * undeclared colour pass at 21:1 - the loudest possible false green, on
   * exactly the tokens most likely to be forgotten.
   */
  const ratioFor = (foreground: string, background: string): number => {
    const found = colours();
    const from = found[foreground];
    const onto = found[background];
    expect(from, `${foreground} is not declared`).toBeDefined();
    expect(onto, `${background} is not declared`).toBeDefined();
    return Number(contrast(from as string, onto as string).toFixed(2));
  };

  it.each(TEXT_PAIRS)("%s on %s reaches 4.5:1", (foreground, background) => {
    expect(ratioFor(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(UI_PAIRS)("%s on %s reaches 3:1", (foreground, background) => {
    expect(ratioFor(foreground, background)).toBeGreaterThanOrEqual(3);
  });

  it("--dt-color-line-strong on --dt-color-surface is the known qq33 P1 exception, tracked rather than dropped", () => {
    // Pinned to the literal qq33 prototype value's real ratio, not to "under
    // 3", so this fails loudly the moment anyone tries to quietly worsen it
    // further, and fails loudly the other way if a future palette pass fixes
    // it and this comment is left stale.
    const expected = _theme === "light" ? 1.64 : 1.91;
    expect(ratioFor("--dt-color-line-strong", "--dt-color-surface")).toBe(expected);
  });

  it("the contrast maths itself is right", () => {
    // Black on white is exactly 21:1. A guard that can only pass is decorative.
    expect(Number(contrast("#000000", "#ffffff").toFixed(0))).toBe(21);
    expect(Number(contrast("#ffffff", "#ffffff").toFixed(0))).toBe(1);
  });
});
