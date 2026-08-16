/**
 * The desktop frame, asserted where it is actually decided: the stylesheet.
 *
 * Two live-browser findings at 1440x900 sit behind this file.
 *
 * **The conversion action shared `grid-area: content` with the content column.**
 * Two elements placed in one named area are stacked on top of each other by
 * definition, so the primary call to action overlapped the first card on the
 * page. Grid overlap is not a rendering accident to be nudged with a margin -
 * it is what the stylesheet asked for. So header, conversion and content now
 * have three distinct area names, and the guard below fails if any two of them
 * are ever pointed at the same track again.
 *
 * **The left rail stopped at the height of its own list.** It was
 * `align-self: start`, so its border ended partway down a tall page and the
 * shell looked like a floating box rather than a rail. It now stretches through
 * the shell's content height, with the sticky behaviour moved inside so a long
 * navigation list can still scroll without pinning the page.
 *
 * jsdom has no layout engine, so overlap itself is measured in the Playwright
 * suite. What is checkable here is the declaration that causes it.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const SHEET = readFileSync(
  join(process.cwd(), "src", "design", "adaptive.css"),
  "utf8",
).replace(/\/\*[\s\S]*?\*\//gu, "");

/** The declarations inside one selector's block, desktop query included. */
function rule(selector: string): string[] {
  const found: string[] = [];
  const pattern = new RegExp(
    `${selector.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\\s*\\{([^{}]*)\\}`,
    "gu",
  );
  for (const match of SHEET.matchAll(pattern)) found.push(match[1] ?? "");
  return found;
}

function gridAreasOf(selector: string): string[] {
  return rule(selector)
    .map((body) => /grid-area:\s*([\w-]+)/u.exec(body)?.[1] ?? "")
    .filter(Boolean);
}

describe("the guard reads the stylesheet it claims to read", () => {
  it("finds the shell rules at all", () => {
    expect(rule(".dt-shell__conversion").length).toBeGreaterThan(0);
    expect(SHEET).toMatch(/grid-template-areas/u);
  });
});

describe("header, conversion and content occupy distinct tracks", () => {
  it("gives the conversion action an area of its own", () => {
    expect(gridAreasOf(".dt-shell__conversion")).toContain("conversion");
  });

  it("never points two shell regions at the same named area", () => {
    const claimed = [
      [".dt-shell__header", "header"],
      [".dt-shell__conversion", "conversion"],
      [".dt-shell__content", "content"],
      [".dt-shell__aside", "aside"],
    ] as const;

    // A selector may restate its own area; two selectors may never share one.
    const taken = new Map<string, string>();
    for (const [selector, expected] of claimed) {
      const areas = gridAreasOf(selector);
      expect(areas.length, `${selector} declares no grid-area`).toBeGreaterThan(0);
      for (const area of areas) {
        expect(area, `${selector} should own "${expected}"`).toBe(expected);
        const owner = taken.get(area);
        expect(owner ?? selector, `${area} is claimed by ${owner} as well`).toBe(selector);
        taken.set(area, selector);
      }
    }
    expect([...taken.keys()].sort()).toEqual([
      "aside",
      "content",
      "conversion",
      "header",
    ]);
  });

  it("declares every claimed area somewhere in a template", () => {
    // An area name that no template mentions is auto-placed, which is how a
    // region silently lands on top of another one.
    const templates = [...SHEET.matchAll(/grid-template-areas:\s*([^;]+);/gu)].map(
      (match) => match[1] ?? "",
    );
    expect(templates.length).toBeGreaterThan(1);

    const declared = new Set(templates.flatMap((template) => template.match(/[\w-]+/gu) ?? []));
    for (const area of ["header", "conversion", "content", "aside", "bottom"]) {
      expect(declared, `no template declares "${area}"`).toContain(area);
    }

    // Header and content exist in every arrangement, small or large.
    for (const template of templates) {
      expect(template).toMatch(/header/u);
      expect(template).toMatch(/content/u);
      expect(template).toMatch(/conversion/u);
    }
  });
});

/* ------------------------------------------------ sticking below the header */

/**
 * A sticky element that stops at `0` stops underneath the sticky header.
 *
 * The header is itself `position: sticky; inset-block-start: 0`, so anything
 * else pinned to `0` shares that band - and the header, having the larger
 * stacking order, wins. What that looked like in a browser: after scrolling the
 * decision list, the first two rail destinations - Kokpit and Kararlar - sat
 * behind the header. They were still in the accessibility tree, still focusable
 * and completely unclickable, which is the worst of the three.
 *
 * The offset is a measured custom property rather than a hard-coded height: the
 * header is two layers, wraps at 320px, and grows with the font-scale setting,
 * so any number written here would be wrong for some real user.
 */
const HEADER_OFFSET = /var\(--dt-shell-header-h[^)]*\)/u;

describe("everything sticky sits below the header, not behind it", () => {
  it("declares the measured header height as a real custom property", () => {
    // Declared with a fallback so the first paint, before measurement, is a
    // layout that merely lacks the offset rather than one built on `calc(… - )`
    // with nothing in it.
    expect(rule(".dt-shell").join(" ")).toMatch(/--dt-shell-header-h:\s*0px/u);
  });

  it("keeps the right-hand assistant on screen with its own bounded scroll", () => {
    // `position: static` meant the whole column scrolled away: at 1440x400 the
    // assistant was simply gone, and the only way back was to scroll the page
    // up again.
    const inner = rule(".dt-shell__aside-inner").join(" ");
    expect(inner, "the assistant column has no sticky inner region").toMatch(
      /position:\s*sticky/u,
    );
    expect(inner).toMatch(new RegExp(`inset-block-start:\\s*${HEADER_OFFSET.source}`, "u"));
    expect(inner).toMatch(new RegExp(`max-block-size:\\s*calc\\([^;]*${HEADER_OFFSET.source}`, "u"));
    expect(inner).toMatch(/overflow-y:\s*auto/u);
  });

  it("leaves the aside itself as the column, with the scroll inside it", () => {
    expect(rule(".dt-shell__aside").join(" ")).not.toMatch(/overflow-y:\s*auto/u);
  });
});

/* ---------------------------------------------- the mobile conversion action */

/**
 * Nothing on a phone is pinned *over* the page any more; the page is what
 * scrolls, inside the frame.
 *
 * The previous arrangement pinned the conversion action with `position: fixed`
 * and left the thumb bar `position: sticky`, both painting on top of a document
 * that scrolled underneath them. Reserving space at the *end* of the content
 * makes the last card clear them, and nothing else: an element that happens to
 * lie in the bottom band at the scroll offset a person arrives at is underneath
 * an opaque bar, and no amount of trailing padding moves it.
 *
 * Measured in Chromium at 320x568 on `/uygunluk/sihirbaz`, at `scrollY = 0`:
 * the first answer `Select` occupied `y 494.14 - 538.14` while the thumb bar
 * began at `503.83`. Nine and a half pixels of a 44px target were reachable, and
 * a hit test at 30% down the control returned `.dt-shell__bottom-link`. It came
 * clear at maximum scroll - which is exactly the point: the first screen of the
 * journey was the broken one.
 *
 * So the phone frame is `100dvh` of grid, and the content is the only part that
 * scrolls. Header, conversion and thumb bar are real rows outside that
 * scrollport, so they are permanently visible *and* structurally incapable of
 * covering anything. Being pinned and covering nothing stop being two competing
 * requirements held apart by arithmetic.
 */
describe("the phone frame scrolls its content, not the whole document", () => {
  const shell = () => rule(".dt-shell")[0] ?? "";
  const shellDesktop = () => rule(".dt-shell").slice(1).join(" ");
  const base = () => rule(".dt-shell__conversion")[0] ?? "";
  const contentBase = () => rule(".dt-shell__content")[0] ?? "";

  it("bounds the frame to the viewport so the chrome cannot scroll away", () => {
    expect(shell()).toMatch(/block-size:\s*100dvh/u);
    // `min-block-size` lets the frame grow past the window, which is what put
    // the content and the bars in the same scrollport to begin with.
    expect(shell()).not.toMatch(/min-block-size:\s*100dvh/u);
  });

  it("orders the rows so the action sits between the content and the thumb bar", () => {
    const template = /grid-template-areas:\s*([^;]+);/u.exec(shell())?.[1] ?? "";
    const areas = (template.match(/[\w-]+/gu) ?? []).filter((name) =>
      ["header", "content", "conversion", "bottom"].includes(name),
    );
    expect(areas).toEqual(["header", "content", "conversion", "bottom"]);
  });

  it("makes the content the scrollport, and only the content", () => {
    expect(contentBase()).toMatch(/overflow-y:\s*auto/u);
    // A scroll gesture that runs out of content must not start scrolling the
    // page behind the frame.
    expect(contentBase()).toMatch(/overscroll-behavior/u);
  });

  it("stops pinning anything on top of the page", () => {
    expect(base(), "the conversion action still paints over the content").not.toMatch(
      /position:\s*fixed/u,
    );
    expect(rule(".dt-shell__bottom")[0] ?? "").not.toMatch(/position:\s*(fixed|sticky)/u);
  });

  it("keeps its own grid area, so it can never share a track with the content", () => {
    expect(base()).toMatch(/grid-area:\s*conversion/u);
  });

  it("hands the document back its scroll where there is room for three columns", () => {
    expect(shellDesktop()).toMatch(/min-block-size:\s*100dvh/u);
    // Otherwise the desktop content keeps its own scrollport and the sticky
    // rail and assistant, which travel with the *page*, have nowhere to go.
    expect(rule(".dt-shell__content").slice(1).join(" ")).toMatch(/overflow:\s*visible/u);
  });
});

/* ------------------------------------------------------------ safe areas */

/**
 * `viewport-fit=cover` is a promise the stylesheet has to keep.
 *
 * `index.html` asks for the full display - under the notch, under the rounded
 * corners, under the home indicator - and then no rule anywhere read a single
 * `env(safe-area-inset-*)`. On any modern phone in portrait that puts the last
 * row of the thumb bar under the home indicator, and in landscape it puts the
 * first and last navigation targets under the rounded corners.
 */
describe("the layout respects the display cutouts it opted into", () => {
  it("keeps the thumb bar clear of the home indicator and the corners", () => {
    const bottom = rule(".dt-shell__bottom").join(" ");
    expect(bottom).toMatch(/env\(safe-area-inset-bottom/u);
    expect(bottom).toMatch(/env\(safe-area-inset-left/u);
    expect(bottom).toMatch(/env\(safe-area-inset-right/u);
  });

  it("insets the conversion action on both sides as well", () => {
    const conversion = rule(".dt-shell__conversion")[0] ?? "";
    expect(conversion).toMatch(/env\(safe-area-inset-left/u);
    expect(conversion).toMatch(/env\(safe-area-inset-right/u);
  });

  /**
   * The bottom inset is accounted for once, by the element that touches it.
   *
   * `--dt-shell-bottom-h` is published from `getBoundingClientRect().height` of
   * `.dt-shell__bottom`, and that element's own `padding-block-end` is
   * `env(safe-area-inset-bottom)`. The measured height therefore *already
   * contains* the home-indicator inset. Adding `env(safe-area-inset-bottom)` to
   * `var(--dt-shell-bottom-h)` counted it twice - on an iPhone in portrait
   * that is a 34px gap that nothing occupies, under a control whose whole job
   * is being the first thing a thumb reaches.
   *
   * There is now exactly one place that reads the bottom inset, and it is the
   * bar that sits against it.
   */
  it("counts the home indicator once, where the thumb bar meets it", () => {
    const readers = [...SHEET.matchAll(/([.#][\w-]+[^{}]*)\{([^{}]*)\}/gu)]
      .filter(([, , body]) => /env\(safe-area-inset-bottom/u.test(body ?? ""))
      .map(([, selector]) => (selector ?? "").trim().replace(/\s+/gu, " "));

    // The sheets are portalled overlays with their own edge; the shell frame
    // itself must name the inset in one rule only.
    const shellReaders = readers.filter((selector) => selector.startsWith(".dt-shell"));
    expect(shellReaders).toEqual([".dt-shell__bottom"]);
  });

  it("never adds the inset on top of a measured height that already holds it", () => {
    const doubled = [...SHEET.matchAll(/[^{}]*\{[^{}]*\}/gu)]
      .map((match) => match[0])
      .filter(
        (block) =>
          /var\(--dt-shell-bottom-h/u.test(block) &&
          /env\(safe-area-inset-bottom/u.test(block),
      );
    expect(
      doubled,
      "a rule adds the bottom inset to a height that was measured with it",
    ).toEqual([]);
  });

  it("leaves every consumer of the measured height a fallback", () => {
    // `var(--dt-shell-bottom-h)` with no fallback resolves to nothing before
    // the resize observer's first pass, which turns any `calc()` around it into
    // an invalid declaration rather than a slightly wrong one.
    const bare = [...SHEET.matchAll(/var\(--dt-shell-[\w-]+\s*\)/gu)].map((m) => m[0]);
    expect(bare, "a measured height is read with no fallback").toEqual([]);
  });

  it("keeps the sheets off the cutouts too", () => {
    const sheets = [
      ...rule(".dt-sheet__body"),
      ...rule(".dt-sheet--start"),
      ...rule(".dt-sheet--end"),
    ].join(" ");
    expect(sheets).toMatch(/env\(safe-area-inset-bottom/u);
    expect(sheets).toMatch(/env\(safe-area-inset-left/u);
    expect(sheets).toMatch(/env\(safe-area-inset-right/u);
  });

  it("insets the page padding itself, header included", () => {
    const header = rule(".dt-shell__header-layer").join(" ");
    const content = rule(".dt-shell__content").join(" ");
    expect(header).toMatch(/env\(safe-area-inset-left/u);
    expect(header).toMatch(/env\(safe-area-inset-right/u);
    expect(content).toMatch(/env\(safe-area-inset-left/u);
    expect(content).toMatch(/env\(safe-area-inset-right/u);
    // Not the bottom: the content no longer reaches it. The thumb bar is a row
    // beneath the content's scrollport and owns that edge on its own - see
    // "counts the home indicator once" above.
    expect(content).not.toMatch(/env\(safe-area-inset-bottom/u);
  });

  it("gives every inset a fallback, so a browser without cutouts loses nothing", () => {
    const bare = [...SHEET.matchAll(/env\(safe-area-inset-[a-z]+\s*\)/gu)].map((m) => m[0]);
    expect(bare).toEqual([]);
  });
});
