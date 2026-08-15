/**
 * The media stories must actually render.
 *
 * A Storybook *build* only compiles stories; it never executes them. So the
 * suite could be green, the build could be green, and every media story could
 * still be a fatal runtime error the moment a browser opened it - which is
 * exactly what happened. `.storybook/preview.tsx` wraps every story in a
 * `RouterProvider`, and `media.stories.tsx` wrapped its own stories in a second
 * `MemoryRouter` on top of it. React Router refuses that ("You cannot render a
 * <Router> inside another <Router>"), its default error boundary swallowed the
 * throw, and `media-medialibrary--local-only-default` rendered an application
 * error instead of the library. Two of the detail stories nested a *third*.
 *
 * This file closes that hole by composing the real story exports with the real
 * preview and rendering them. It uses Storybook's own portable-stories API, so
 * the decorator topology under test is Storybook's - project annotations, then
 * meta decorators, then story decorators - rather than a hand-rolled
 * approximation that could agree with a bug.
 *
 * Two implementation notes, both load-bearing:
 *
 * 1. The preview is loaded through `import.meta.glob` rather than imported.
 *    `.storybook/**` belongs to `tsconfig.node.json`, a separate composite
 *    project; a static import would pull that file into the app program and
 *    fail `tsc -b`. A glob is resolved by the bundler and never enters the type
 *    program, so the real preview is still what runs.
 *
 * 2. The assertion is on rendered output, not on a thrown error. The router's
 *    default error boundary catches the nested-router invariant, so the render
 *    *succeeds* and paints an error screen. A test that only checked for a
 *    throw would have passed against the broken build.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { composeStories, setProjectAnnotations } from "@storybook/react-vite";
import { render } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";

import * as mediaStories from "./media.stories";

/**
 * The real `.storybook/preview.tsx`, loaded the only way that keeps `tsc -b`
 * honest. Eager, so the annotations are available before `composeStories`.
 */
const previewModules = import.meta.glob("../../../.storybook/preview.tsx", {
  eager: true,
}) as Record<string, { default: unknown }>;

const previewAnnotations = Object.values(previewModules)[0]?.default;

beforeAll(() => {
  // A missing preview would make every assertion below vacuous.
  expect(previewAnnotations).toBeTruthy();
});

setProjectAnnotations(previewAnnotations as Parameters<typeof setProjectAnnotations>[0]);

const composed = composeStories(mediaStories);

/**
 * What React Router paints when it catches an error, plus the invariant text
 * itself. Either one on screen means the story did not render.
 */
const ROUTER_ERROR =
  /Unexpected Application Error|cannot render a <Router> inside another <Router>/iu;

describe("every media story renders under the real Storybook preview", () => {
  it("composes every one of the 19 media stories", () => {
    // Exact, not a floor. `toBeGreaterThan(15)` let three stories be deleted
    // without a failure, which is the same silent-abstention hole this file
    // exists to close. Adding or removing a story is a decision, so it should
    // have to be written down here.
    expect(Object.keys(composed)).toHaveLength(19);
  });

  it.each(Object.entries(composed))("%s renders without a router error", async (_name, Story) => {
    const { container } = render(<Story />);
    const text = container.textContent ?? "";
    expect(text).not.toMatch(ROUTER_ERROR);
    // An error boundary that rendered nothing at all would also be a failure.
    expect(text.trim().length).toBeGreaterThan(0);
  });

  it("the reported story renders the library itself, not an error surface", async () => {
    // `media-medialibrary--local-only-default` is the story the browser
    // evidence named. It must show the workbench, with the local-only default
    // intact: durable local storage and no permissions.
    const { container } = render(<composed.LocalOnlyDefault />);
    expect(container.textContent ?? "").not.toMatch(ROUTER_ERROR);
    expect(container.querySelector("table")).not.toBeNull();
  });
});

describe("the media stories own no router", () => {
  /**
   * Complementary to the render assertions above, not a substitute for them.
   * The render test proves the composition works today; this one names *why*,
   * so a future author who re-adds a wrapper gets a message that explains the
   * rule instead of a puzzling error screen.
   */
  it("declares no second router, because the preview already provides one", () => {
    const source = readFileSync(
      join(process.cwd(), "src", "components", "media", "media.stories.tsx"),
      "utf8",
    );
    const code = source.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/(^|[^:])\/\/.*$/gmu, "$1");
    expect(code).not.toMatch(/\bMemoryRouter\b/u);
    expect(code).not.toMatch(/\bRouterProvider\b/u);
    expect(code).not.toMatch(/\bcreateMemoryRouter\b/u);
  });

  it("the global preview is still the one place a router is set up", () => {
    const preview = readFileSync(join(process.cwd(), ".storybook", "preview.tsx"), "utf8");
    expect(preview).toMatch(/createMemoryRouter/u);
    expect(preview).toMatch(/RouterProvider/u);
  });
});

/**
 * The 320px contract for media, asserted against the stylesheet.
 *
 * Same limitation as the provider subsystem's equivalent group, and worth
 * repeating rather than cross-referencing: these run in jsdom, which has no
 * layout engine, so no real width can be measured here. Once the stories could
 * render at all, a browser matrix over all 19 of them at 320x800 found the
 * library at `scrollWidth` 334 and the upload panel at 401. These assertions
 * pin the causes that were fixed; the pixels were verified separately in
 * Chromium.
 */
describe("the media surfaces fit a 320px viewport", () => {
  const stylesheet = () =>
    readFileSync(join(process.cwd(), "src", "design", "media.css"), "utf8").replace(
      /\/\*[\s\S]*?\*\//gu,
      "",
    );

  function rules(css: string) {
    const found: { selector: string; body: string; index: number }[] = [];
    const rule = /([^{}]+)\{([^{}]*)\}/gu;
    let match: RegExpExecArray | null;
    while ((match = rule.exec(css)) !== null) {
      found.push({ selector: (match[1] ?? "").trim(), body: match[2] ?? "", index: match.index });
    }
    return found;
  }

  const ruleFor = (pattern: RegExp) =>
    rules(stylesheet()).find((entry) => pattern.test(entry.selector));

  it.each([
    [".dt-media", /^\.dt-media$/u],
    [".dt-media-upload__zone", /^\.dt-media-upload__zone$/u],
  ])("%s declares a zero-minimum column track", (_label, selector) => {
    // An `auto` track's minimum is its item's min-content, so it grows past its
    // own container rather than letting the content wrap.
    const entry = ruleFor(selector);
    expect(entry).toBeDefined();
    expect(entry?.body ?? "").toMatch(/grid-template-columns:\s*minmax\(0/u);
  });

  it("lets the file input shrink below its intrinsic width", () => {
    // Chromium gives `<input type="file">` a 320px intrinsic width. `max-width`
    // caps the used width but not the contribution the track is sized from.
    const entry = ruleFor(/^\.dt-media-upload__input$/u);
    expect(entry?.body ?? "").toMatch(/max-width:\s*100%/u);
    expect(entry?.body ?? "").toMatch(/min-width:\s*0/u);
  });

  it("stacks its definition rows instead of holding a 9rem term column", () => {
    const css = stylesheet();
    const scoped = rules(css).filter((entry) => /\.dt-media[\w-]*\s+\.dt-dl__row/u.test(entry.selector));
    expect(scoped.length).toBeGreaterThanOrEqual(2);

    const stacked = scoped.filter((entry) =>
      /grid-template-columns:\s*minmax\(0,\s*1fr\)/u.test(entry.body),
    );
    expect(stacked.length).toBeGreaterThan(0);
    for (const entry of scoped) {
      expect(entry.body).not.toContain("9rem");
    }

    // The two-column form still exists, restored only where there is room.
    expect(css).toMatch(/@media \(min-width: 30rem\)/u);
  });

  it("does not hide the overflow instead of fixing it", () => {
    // Clipping turns a visible bug into an invisible one. `overflow-wrap` is
    // wrapping, not hiding, so it stays allowed.
    const css = stylesheet();
    expect(css).not.toMatch(/overflow(-[xy])?:\s*hidden/u);
    expect(css).not.toMatch(/white-space:\s*nowrap/u);
  });
});
