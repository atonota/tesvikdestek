/**
 * "Skeleton shimmer first" — the owner's standing rule, enforced.
 *
 * The rule, stated once so it is not paraphrased differently in each test:
 *
 *  > Every component is built loading state first. Its skeleton imitates *that
 *  > component's* real layout - shape, line count, media boxes, table, chart and
 *  > form density - rather than standing in as a generic rectangle. The skeleton
 *  > is never read as content; the container announces what is loading. Under
 *  > `prefers-reduced-motion` the shimmer stops. Both 320px and desktop are
 *  > tested. Only then come loaded, empty, error, permission and offline.
 *
 * This is a governance test rather than a component test, which is why it lives
 * in `src/test/` beside the design-system and architecture contracts. It asks
 * three different kinds of question, and all three are needed:
 *
 *  1. **Behaviour** - rendered assertions about the accessibility tree and the
 *     shapes, because "the skeleton is not announced as content" is a fact
 *     about what a screen reader receives, not about what the source says.
 *  2. **Shape fidelity** - that a table skeleton has rows and columns and a
 *     chart skeleton has bars, because the failure mode the rule exists to
 *     prevent is one grey box standing in for everything.
 *  3. **Coverage** - that the master layer's skeleton shapes are catalogued in
 *     Storybook. A loading state nobody can look at is a loading state that
 *     rots, and it is the one state a developer never sees by accident.
 *
 * The reduced-motion half is asserted against the stylesheet rather than a
 * computed style: jsdom has no cascade for `motion-reduce:` variants, so the
 * only honest check here is that both carriers - the OS preference and the
 * product's own `data-reduced-motion` attribute - are declared on the shimmer.
 * The *visual* half is measured in a real browser by `e2e/master-layer.spec.ts`.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { PublicShell } from "@/components/shells";
import { NotFoundRoute } from "@/routes/boot-surface";

import { AnalyticsSkeleton } from "@/components/analytics/AnalyticsSkeleton";
import {
  Shimmer,
  Skeleton,
  SkeletonCard,
  SkeletonChart,
  SkeletonForm,
  SkeletonList,
  SkeletonMedia,
  SkeletonTable,
  SkeletonText,
} from "@/components/ui/skeleton";

const ROOT = process.cwd();
const UI = join(ROOT, "src", "components", "ui");

const skeletonSource = () => readFileSync(join(UI, "skeleton.tsx"), "utf8");

/* ------------------------------------------------- 1. the accessibility tree */

describe("a skeleton announces the wait and is never read as content", () => {
  it("names what is loading, once, in a polite live region", () => {
    render(
      <Skeleton label="Kararlar yükleniyor">
        <SkeletonText lines={3} />
      </Skeleton>,
    );
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveAttribute("aria-busy", "true");
    expect(region).toHaveTextContent("Kararlar yükleniyor");
  });

  it("says *what* is loading rather than only that something is", () => {
    // "Yükleniyor" alone leaves a reader who has just pressed a filter with no
    // idea which region is coming back. The label is required by the type, and
    // this is the assertion that the requirement is not satisfied by a constant.
    const source = skeletonSource();
    expect(source).toMatch(/readonly label: string;/u);
    expect(source).not.toMatch(/label\s*=\s*["']Yükleniyor["']/u);
  });

  it("hides every shape from assistive technology", () => {
    const { container } = render(
      <Skeleton label="Tablo yükleniyor">
        <SkeletonTable rows={3} columns={4} />
        <SkeletonChart shape="bar" bars={4} />
        <SkeletonCard withAction lines={2} />
      </Skeleton>,
    );
    const shapes = container.querySelectorAll("[data-slot^='skeleton-']");
    expect(shapes.length).toBeGreaterThan(0);
    for (const shape of shapes) {
      expect(shape.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("exposes no text of its own beyond the label", () => {
    // A skeleton that renders placeholder words is a skeleton a screen reader
    // reads out as content. The only text in the tree is the announcement.
    render(
      <Skeleton label="Portföy yükleniyor">
        <SkeletonMedia items={4} />
        <SkeletonForm fields={3} />
      </Skeleton>,
    );
    const region = screen.getByRole("status");
    expect(region.textContent?.trim()).toBe("Portföy yükleniyor");
  });
});

/* ---------------------------------------------------- 2. shape, not a box */

describe("a skeleton imitates the layout it stands in for", () => {
  it("a text skeleton draws several lines and a short last one", () => {
    const { container } = render(<SkeletonText lines={4} lastLineWidth="50%" />);
    const lines = container.querySelectorAll("[data-slot='skeleton-shimmer']");
    expect(lines).toHaveLength(4);
    expect(lines[3]?.getAttribute("style")).toContain("50%");
  });

  it("a table skeleton draws the rows and columns the table will have", () => {
    const { container } = render(<SkeletonTable rows={6} columns={5} />);
    const table = container.querySelector("[data-slot='skeleton-table']");
    expect(table).not.toBeNull();
    // A header row plus six body rows, five cells each.
    const cells = table!.querySelectorAll("[data-slot='skeleton-shimmer']");
    expect(cells.length).toBe(5 + 6 * 5);
  });

  it("a table skeleton inherits the density row height rather than guessing", () => {
    // "Dense" must produce a dense skeleton, or the layout jumps for exactly
    // the users who chose the tightest setting.
    expect(skeletonSource()).toMatch(/--dt-density-row/u);
  });

  it("a bar chart skeleton draws an axis and bars of differing length", () => {
    const { container } = render(<SkeletonChart shape="bar" bars={4} />);
    const chart = container.querySelector("[data-slot='skeleton-chart']");
    expect(chart).not.toBeNull();
    const bars = chart!.querySelectorAll("[data-slot='skeleton-shimmer']");
    // Four axis labels and four bars.
    expect(bars).toHaveLength(8);
    const widths = [...bars]
      .map((bar) => bar.getAttribute("style"))
      .filter((style): style is string => style !== null && style.includes("inline-size"));
    expect(new Set(widths).size).toBeGreaterThan(1);
  });

  it("a doughnut skeleton draws a ring, not a bar chart", () => {
    const { container } = render(<SkeletonChart shape="pie" bars={3} />);
    const chart = container.querySelector("[data-slot='skeleton-chart']");
    expect(chart?.querySelector(".rounded-lg.border-\\[14px\\]")).not.toBeNull();
  });

  it("a form skeleton draws label-and-field pairs and a submit control", () => {
    const { container } = render(<SkeletonForm fields={3} withSubmit />);
    const form = container.querySelector("[data-slot='skeleton-form']");
    // Three labels, three fields, one submit.
    expect(form!.querySelectorAll("[data-slot='skeleton-shimmer']")).toHaveLength(7);
  });

  it("a media skeleton draws square thumbnails with a caption each", () => {
    const { container } = render(<SkeletonMedia items={4} />);
    const media = container.querySelector("[data-slot='skeleton-media']");
    expect(media!.querySelectorAll(".aspect-square")).toHaveLength(4);
    expect(media!.querySelectorAll("[data-slot='skeleton-shimmer']")).toHaveLength(8);
  });

  it("a card skeleton draws the header grid the real card uses", () => {
    const { container } = render(<SkeletonCard withAction lines={3} withFooter />);
    const card = container.querySelector("[data-slot='skeleton-card']");
    expect(card?.className).toContain("rounded-lg");
    expect(card?.className).toContain("border-border");
    expect(card!.querySelector(".grid")?.className).toContain("minmax(0,1fr)");
  });

  it("a list skeleton can carry a leading mark", () => {
    const { container } = render(<SkeletonList items={3} withAvatar />);
    const list = container.querySelector("[data-slot='skeleton-list']");
    // Three marks plus two lines each.
    expect(list!.querySelectorAll("[data-slot='skeleton-shimmer']")).toHaveLength(9);
  });

  it("no shape declares a fixed pixel width that could overflow 320px", () => {
    const source = skeletonSource();
    const offenders = [...source.matchAll(/(?:inline-size|width):\s*["']?(\d{3,})px/gu)].map(
      (match) => match[0],
    );
    expect(offenders).toEqual([]);
  });
});

/* ------------------------------------------------------ 3. reduced motion */

describe("the shimmer stops when motion is refused", () => {
  it("answers both carriers of the preference", () => {
    const { container } = render(<Shimmer className="h-4" />);
    const className = container.firstElementChild?.className ?? "";
    // The operating system's preference…
    expect(className).toContain("motion-reduce:before:animate-none");
    // …and the product's own setting, written on <html> by the appearance store.
    expect(className).toContain("data-reduced-motion='true'");
  });

  it("moves rather than pulses, so the motion means 'arriving'", () => {
    const keyframes = readFileSync(join(ROOT, "src", "design", "tailwind.css"), "utf8");
    expect(keyframes).toMatch(/@keyframes\s+dt-shimmer/u);
    expect(keyframes).toMatch(/translateX/u);
  });
});

/* ------------------------------------- 4. cognitive master story contracts */

const COGNITIVE_STORY_FILES = [
  join(ROOT, "src", "components", "cognitive-cockpit", "cognitive-cockpit.stories.tsx"),
  join(ROOT, "src", "components", "cognitive-file-library", "cognitive-file-library.stories.tsx"),
  join(ROOT, "src", "components", "cognitive-provider-center", "cognitive-provider-center.stories.tsx"),
] as const;

describe("the cognitive master stories are skeleton-first and truly 320px", () => {
  it.each(COGNITIVE_STORY_FILES)("%s exposes the enterprise read states", (storyFile) => {
    const source = readFileSync(storyFile, "utf8");
    for (const state of ["Loading", "Empty", "Permission", "Offline", "Success"]) {
      expect(source, `${storyFile}: ${state}`).toMatch(new RegExp(`export const ${state}\\b`, "u"));
    }
    expect(source).toMatch(/export const (?:Error|ErrorState)\b/u);
  });

  it.each(COGNITIVE_STORY_FILES)("%s selects an explicit 320px viewport", (storyFile) => {
    const source = readFileSync(storyFile, "utf8");
    expect(source).toMatch(/globals:\s*\{\s*viewport:\s*\{\s*value:\s*["']phone320["']/u);
    expect(source).toMatch(/phone320:\s*\{[\s\S]*?width:\s*["']320px["']/u);
    expect(source).not.toMatch(/defaultViewport|viewports\s*:/u);
  });
});

describe("the analytics section has its own shaped loading state", () => {
  it("draws the card, the tab strip, the table and the chart it stands in for", () => {
    const { container } = render(<AnalyticsSkeleton shape="bar" rows={3} />);

    // The live region names what is loading, once.
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-busy", "true");
    expect(region.textContent?.trim()).toBe("Analitik bölümü yükleniyor");

    // The real section's geometry: a card, a three-trigger tab strip, a
    // three-column table and a chart. A generic block has none of these.
    expect(container.querySelector("[data-slot='card']")).not.toBeNull();
    expect(container.querySelector("[data-slot='skeleton-table']")).not.toBeNull();
    expect(container.querySelector("[data-slot='skeleton-chart']")).not.toBeNull();
    expect(container.querySelectorAll("[data-slot='skeleton-shimmer']").length).toBeGreaterThan(
      10,
    );
  });

  it("follows the chart shape it is standing in for", () => {
    const { container } = render(<AnalyticsSkeleton shape="pie" />);
    // The doughnut form draws a ring; the bar form draws bars. A fallback that
    // always guessed a bar would still move the page for the doughnut panel.
    expect(container.querySelector(".rounded-lg.border-\\[14px\\]")).not.toBeNull();
  });

  it("is reachable without the chart engine", async () => {
    // The whole point of a Suspense fallback: it must not import the thing it
    // is covering for. A static import of ECharts here would make the fallback
    // wait for the megabyte it exists to hide.
    const source = readFileSync(
      join(ROOT, "src", "components", "analytics", "AnalyticsSkeleton.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/from\s+["'](?:echarts|\.\/EChart)/u);
  });
});

/* ---------------------------------- 5. the two shells agree on their frame */

/**
 * `BootShell` and `PublicShell` are the same frame, drawn twice.
 *
 * The duplication is deliberate and recorded in `boot-surface.tsx`: the boot
 * surface may not import the component barrel, because that import is what put
 * the whole design system in front of a first paint. What the duplication buys
 * in bytes it risks in drift - two frames that are supposed to be one, edited
 * independently, until a visitor who lands on a 404 gets a different skip link,
 * a different landmark id or no disclaimer at all.
 *
 * So the parts that must not drift are asserted against each other by rendering
 * both. Not a string comparison of two files: what matters is the accessible
 * frame a reader gets, and that is a property of the rendered document.
 */
describe("the boot surface and the public shell are the same frame", () => {
  const frameOf = (container: HTMLElement) => {
    const skip = container.querySelector("a.dt-skip-link");
    const main = container.querySelector("main");
    const footer = container.querySelector("footer.dt-public__footer p");
    return {
      skipHref: skip?.getAttribute("href") ?? null,
      skipText: skip?.textContent?.trim() ?? null,
      mainId: main?.getAttribute("id") ?? null,
      mainClass: main?.getAttribute("class") ?? null,
      mainTabIndex: main?.getAttribute("tabindex") ?? null,
      disclaimer: footer?.textContent?.trim() ?? null,
    };
  };

  const renderBoth = () => {
    const boot = render(
      <MemoryRouter>
        <NotFoundRoute />
      </MemoryRouter>,
    );
    const shell = render(
      <MemoryRouter>
        <PublicShell>
          <p>içerik</p>
        </PublicShell>
      </MemoryRouter>,
    );
    return { boot: frameOf(boot.container), shell: frameOf(shell.container) };
  };

  it("finds a real frame in both, so the comparison is not two nulls", () => {
    const { boot, shell } = renderBoth();
    for (const frame of [boot, shell]) {
      expect(frame.skipHref).not.toBeNull();
      expect(frame.mainId).not.toBeNull();
      expect(frame.disclaimer).not.toBeNull();
    }
  });

  it("offers the same skip link", () => {
    const { boot, shell } = renderBoth();
    expect(boot.skipHref).toBe(shell.skipHref);
    expect(boot.skipText).toBe(shell.skipText);
    // And it points at the landmark that exists, or it is a link to nowhere.
    expect(boot.skipHref).toBe(`#${boot.mainId}`);
  });

  it("names its main landmark identically", () => {
    const { boot, shell } = renderBoth();
    expect(boot.mainId).toBe("ana-icerik");
    expect(boot.mainId).toBe(shell.mainId);
    expect(boot.mainClass).toBe(shell.mainClass);
    // Focusable by script so the skip link can move focus, not by tab order.
    expect(boot.mainTabIndex).toBe("-1");
    expect(boot.mainTabIndex).toBe(shell.mainTabIndex);
  });

  it("carries the same disclaimer, word for word", () => {
    const { boot, shell } = renderBoth();
    // This sentence is a legal statement about what the product is not. A
    // 404 page that drops it is a page making a claim by omission.
    expect(boot.disclaimer).toBe(shell.disclaimer);
    expect(boot.disclaimer).toContain("bağlayıcı değildir");
  });
});

/* ------------------------------------ 6. the document tells the whole truth */

/**
 * What the technology document may claim about this rule.
 *
 * The master layer is finished and gated. The *product* is not: seventeen call
 * sites still render the old generic `SkeletonBlock`, which is a fixed number
 * of lines with no relationship to the component behind it. A document that
 * described the rule as satisfied would be describing the master layer and
 * being read as describing the product.
 *
 * So the section must carry both halves, and the list of modules still to
 * migrate must match what is actually in the tree - a list that drifts is worse
 * than no list, because it reads as a plan somebody is following.
 */
describe("the technology document separates the master layer from the product", () => {
  const DOC = join(ROOT, "..", "..", "FRONTEND-TECHSTACK.md");
  const doc = () => readFileSync(DOC, "utf8");

  /** The skeleton section, from its heading to the next one. */
  const section = (): string => {
    const text = doc();
    const start = text.search(/^## \d+\. Skeleton shimmer first/mu);
    if (start < 0) return "";
    const rest = text.slice(start + 1);
    const end = rest.search(/^## /mu);
    return end < 0 ? rest : rest.slice(0, end);
  };

  /** Runtime modules still rendering the old generic block. */
  const legacyUsers = (): string[] => {
    const found: string[] = [];
    const walk = (directory: string) => {
      for (const entry of readdirSync(directory)) {
        const full = join(directory, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (
          /\.tsx$/u.test(entry) &&
          !/\.(test|stories)\.tsx$/u.test(entry) &&
          /<SkeletonBlock\b/u.test(readFileSync(full, "utf8"))
        ) {
          found.push(full.replace(`${ROOT}/`, ""));
        }
      }
    };
    walk(join(ROOT, "src"));
    return found.sort();
  };

  it("has a skeleton section to read", () => {
    expect(section().length).toBeGreaterThan(400);
  });

  it("says the master layer is done and the product-wide migration is not", () => {
    const text = section();
    expect(text).toMatch(/master katman/iu);
    expect(text).toMatch(/kalan kapsam/iu);
    // And it must not read as finished. "Tamamlandı" on its own, about this
    // rule, is the claim this group exists to refuse.
    expect(text).not.toMatch(/kural[ıi]?\s+tamamland[ıi]/iu);
  });

  it("names SkeletonBlock as the thing still to be replaced", () => {
    expect(section()).toContain("SkeletonBlock");
  });

  it("lists exactly the modules that still use it", () => {
    /*
     * Only the bullet list, not every path the section happens to mention.
     *
     * The section also names the contract test, the catalogue and the shape
     * module in prose, and a looser match swept those in - so the assertion
     * compared a mixed bag against the real list and could never agree. The
     * claim being checked is the *list*, so the list is what is read: markdown
     * bullets whose entire content is one backticked path.
     */
    const listed = [...section().matchAll(/^- `(src\/[\w./-]+\.tsx)`\s*$/gmu)].map(
      (match) => match[1],
    );
    const actual = legacyUsers();
    expect(actual.length, "artık hiç eski kullanım yok - belge güncellenmeli").toBeGreaterThan(0);
    expect([...new Set(listed)].sort()).toEqual(actual);
  });

  it("numbers its headings in order, with no repeats", () => {
    const numbers = [...doc().matchAll(/^## (\d+)\./gmu)].map((match) => Number(match[1]));
    expect(numbers.length).toBeGreaterThan(10);
    expect(new Set(numbers).size, `yinelenen bölüm numarası: ${numbers.join(", ")}`).toBe(
      numbers.length,
    );
    expect([...numbers].sort((a, b) => a - b)).toEqual(numbers);
  });
});
