/**
 * The analytics section's structure, and the two defects a review found in it.
 *
 * Both are invisible to a passing screenshot and to every assertion that only
 * asks "did a skeleton appear?", which is why they are pinned here as DOM and
 * identity facts rather than as prose in a docstring.
 *
 * **1. A pending panel must not redraw the section around itself.** The
 * section is one `Card` containing one `Tabs`. When a panel *inside* those is
 * waiting, the loading state belongs to the panel - so it may not bring its
 * own card and its own tab strip with it. The first version reused the
 * section-level `AnalyticsSkeleton` in the panel branch, which nested a second
 * `[data-slot="card"]` inside the first and drew a second tab list underneath
 * the real one. A reader saw two boxes and two strips, and a screen reader
 * found two tablists in one region.
 *
 * **2. The chart option must be stable across unrelated renders.** ECharts
 * `setOption(…, true)` is a full replace: it discards the instance's state and
 * redraws everything. `buildOption` was rebuilt on every render of the section,
 * so any parent re-render - a theme toggle, a sibling query settling, a
 * `useState` two levels up - triggered a complete chart rebuild with no data
 * change behind it. Identity is the thing that decides that, so identity is
 * what is asserted.
 */

import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The distribution type, imported statically for its *type* only.
 *
 * The components below are imported with a top-level `await import` so that
 * `vi.mock` above is in place before their module graph is evaluated. A dynamic
 * import gives back a value, and a value cannot be used in type position - so
 * the type comes through the ordinary `import type`, which is erased and
 * therefore cannot defeat the mock.
 */
import type { Distribution } from "./model";

/**
 * The chart adapter, replaced by a recorder.
 *
 * Mocked rather than driven, for one reason: `EChart` deliberately declines to
 * initialise where there is no real canvas, so under jsdom the real component
 * renders an empty div and never calls `setOption`. That is correct behaviour
 * and it makes the memoisation unobservable through the real module. The prop
 * it is *handed* is the observable, and it is exactly the thing under test.
 */
const buildOptionCalls: Array<(...args: never[]) => unknown> = [];

vi.mock("@/components/analytics/EChart", () => ({
  EChart: ({ buildOption }: { buildOption: (...args: never[]) => unknown }) => {
    buildOptionCalls.push(buildOption);
    return <div data-testid="echart-stub" />;
  },
  readChartTheme: () => ({}),
}));

const { PortfolioAnalytics } = await import("./PortfolioAnalytics");
const { AnalyticsSkeleton } = await import("./AnalyticsSkeleton");

const populated = (label: string): Distribution => ({
  status: "populated",
  slices: [
    { key: "grant", label, count: 3 },
    { key: "loan", label: `${label} 2`, count: 1 },
  ],
  total: 4,
});

const PENDING: Distribution = { status: "pending" };

beforeEach(() => {
  buildOptionCalls.length = 0;
});

/* ------------------------------------------- the panel does not nest a card */

describe("a pending panel draws itself, not the section around it", () => {
  it("nests no second card inside the section's card", () => {
    const { container } = render(
      <PortfolioAnalytics portfolio={PENDING} outcomes={PENDING} evidence={PENDING} />,
    );

    const cards = container.querySelectorAll("[data-slot='card']");
    expect(
      cards,
      "bekleyen panel bölümün kartının içine ikinci bir kart çizdi",
    ).toHaveLength(1);
  });

  it("draws exactly one tab list, the real one", () => {
    const { container } = render(
      <PortfolioAnalytics portfolio={PENDING} outcomes={PENDING} evidence={PENDING} />,
    );
    // Radix renders the real strip as `role="tablist"`; a skeleton strip is
    // `aria-hidden` and carries the shape's data-slot instead.
    expect(container.querySelectorAll("[role='tablist']")).toHaveLength(1);
    expect(container.querySelectorAll("[data-slot='skeleton-tab-strip']")).toHaveLength(0);
  });

  it("still shows a shaped loading state inside the panel", () => {
    const { container } = render(
      <PortfolioAnalytics portfolio={PENDING} outcomes={PENDING} evidence={PENDING} />,
    );
    // The panel's own geometry: summary lines, the three-column table and the
    // chart. Not a grey block, and not the whole section again.
    expect(container.querySelector("[data-slot='skeleton-table']")).not.toBeNull();
    expect(container.querySelector("[data-slot='skeleton-chart']")).not.toBeNull();
    expect(container.querySelector("[data-slot='skeleton']")).not.toBeNull();
  });

  it("the section-level skeleton does carry the card and the strip", () => {
    // The distinction is the point: `AnalyticsSkeleton` stands in for the whole
    // section behind Suspense, when no card and no strip exist yet.
    const { container } = render(<AnalyticsSkeleton />);
    expect(container.querySelectorAll("[data-slot='card']")).toHaveLength(1);
    expect(container.querySelectorAll("[data-slot='skeleton-tab-strip']")).toHaveLength(1);
  });
});

/* --------------------------------------------------- the option is memoised */

describe("the chart option is stable until the data changes", () => {
  it("hands the same builder back on a re-render with identical data", () => {
    const portfolio = populated("Hibe");
    const view = render(
      <PortfolioAnalytics portfolio={portfolio} outcomes={PENDING} evidence={PENDING} />,
    );
    const first = buildOptionCalls.at(-1);

    view.rerender(
      <PortfolioAnalytics portfolio={portfolio} outcomes={PENDING} evidence={PENDING} />,
    );
    const second = buildOptionCalls.at(-1);

    expect(first).toBeDefined();
    expect(
      second,
      "ilgisiz bir render tam setOption tetikliyor: builder kimliği değişti",
    ).toBe(first);
  });

  it("hands a new builder back when the data really changes", () => {
    // The other half. A memo that never invalidates is a stale chart, which is
    // the defect this repository already fixed once.
    const view = render(
      <PortfolioAnalytics portfolio={populated("Hibe")} outcomes={PENDING} evidence={PENDING} />,
    );
    const first = buildOptionCalls.at(-1);

    view.rerender(
      <PortfolioAnalytics portfolio={populated("Kredi")} outcomes={PENDING} evidence={PENDING} />,
    );
    const second = buildOptionCalls.at(-1);

    expect(second).not.toBe(first);
  });
});
