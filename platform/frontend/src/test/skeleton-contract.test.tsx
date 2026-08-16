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
  SkeletonControl,
  SkeletonMedia,
  SkeletonTable,
  SkeletonTabStrip,
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

/* ------------------------------------- 4. every master component has a pair */

/**
 * The half of the rule a grep cannot check.
 *
 * The first version of this group searched `ui.stories.tsx` for the *words*
 * `SkeletonTable`, `SkeletonChart` and so on, and for the string `"320px"`.
 * Both were false green by construction: a gallery of shapes standing on their
 * own satisfied the first, and a story *named* "320px" that rendered at desktop
 * width satisfied the second.
 *
 * So this group asks the three questions the rule is actually about, and asks
 * each of them of a real value rather than of a file's text:
 *
 *  1. **Is every exported master component accounted for?** Enumerated from
 *     the barrel, so a component added tomorrow fails until it is mapped.
 *  2. **Does the mapped skeleton really render a skeleton?** Each shape is
 *     rendered and its shimmer elements counted.
 *  3. **Does the named story exist, and does the 320px story really select a
 *     320px viewport?** The catalogue module is imported and its exported
 *     story objects are inspected.
 */

/**
 * The catalogue module, read as data.
 *
 * Typed as an index rather than as Storybook's `StoryAnnotations`, because what
 * this file needs from it is the *shape of the exported objects* - does the
 * story exist, does it carry `globals.viewport.value` - and the framework type
 * is deliberately narrower than that. `unknown` first, so the widening is
 * visible rather than smuggled through a structural coincidence.
 */
import * as storyModule from "@/components/ui/ui.stories";
import * as masterLayer from "@/components/ui";
import {
  SKELETON_MAP,
  isExempt,
  type SkeletonEntry,
} from "@/components/ui/skeleton-map";

const catalogue = storyModule as unknown as Record<string, Record<string, unknown>>;

const SHAPES = {
  Shimmer: <Shimmer className="h-4 w-24" />,
  SkeletonText: <SkeletonText lines={3} />,
  SkeletonCard: <SkeletonCard lines={2} />,
  SkeletonTable: <SkeletonTable rows={2} columns={3} />,
  SkeletonChart: <SkeletonChart shape="bar" bars={3} />,
  SkeletonForm: <SkeletonForm fields={2} />,
  SkeletonMedia: <SkeletonMedia items={2} />,
  SkeletonList: <SkeletonList items={2} />,
  SkeletonControl: <SkeletonControl />,
  SkeletonTabStrip: <SkeletonTabStrip triggers={3} />,
} as const;

describe("every master component is paired with a skeleton or reasoned exempt", () => {
  /** Value exports of the master layer, which is what a screen can import. */
  const exported = () =>
    Object.keys(masterLayer).filter(
      (name) => typeof (masterLayer as Record<string, unknown>)[name] !== "undefined",
    );

  it("enumerates a master layer worth checking", () => {
    // A guard over an empty set is decoration.
    expect(exported().length).toBeGreaterThan(20);
  });

  it("maps every exported name, with no silent gaps", () => {
    const unmapped = exported().filter((name) => !(name in SKELETON_MAP));
    expect(
      unmapped,
      `bu master bileşenlerin skeleton eşi tanımlanmamış: ${unmapped.join(", ")}`,
    ).toEqual([]);
  });

  it("maps nothing that is not exported, so the map cannot rot", () => {
    const names = new Set(exported());
    const stale = Object.keys(SKELETON_MAP).filter((name) => !names.has(name));
    expect(stale, `haritada olup dışa aktarılmayan ad: ${stale.join(", ")}`).toEqual([]);
  });

  it("gives every exemption a kind and a written reason", () => {
    const thin = Object.entries(SKELETON_MAP as Record<string, SkeletonEntry>)
      .filter(([, entry]) => isExempt(entry))
      .filter(([, entry]) => {
        const exemption = entry as { exempt: string; reason: string };
        return (
          !["structural", "on-demand"].includes(exemption.exempt) ||
          exemption.reason.trim().length < 30
        );
      })
      .map(([name]) => name);
    expect(thin, `gerekçesiz veya yüzeysel muafiyet: ${thin.join(", ")}`).toEqual([]);
  });

  const pairings = Object.entries(SKELETON_MAP as Record<string, SkeletonEntry>).filter(
    (entry): entry is [string, Exclude<SkeletonEntry, { exempt: unknown }>] =>
      !isExempt(entry[1]),
  );

  it("has real pairings, not an all-exempt map", () => {
    // An "everything is structural" map would pass every other assertion here.
    expect(pairings.length).toBeGreaterThanOrEqual(6);
  });

  it.each(pairings.map(([name, entry]) => [name, entry] as const))(
    "%s: its mapped shape really renders shimmer",
    (_name, entry) => {
      const shape = SHAPES[entry.shape as keyof typeof SHAPES];
      expect(shape, `bilinmeyen skeleton şekli: ${entry.shape}`).toBeDefined();
      const { container } = render(<div>{shape}</div>);
      expect(container.querySelectorAll("[data-slot='skeleton-shimmer']").length).toBeGreaterThan(
        0,
      );
    },
  );

  it.each(pairings.map(([name, entry]) => [name, entry.story] as const))(
    "%s: its named story %s exists in the catalogue",
    (_name, story) => {
      const found = catalogue[story];
      expect(found, `Storybook'ta ${story} adlı story yok`).toBeDefined();
      // A story is an object with something to render; a stray constant is not.
      expect(typeof found).toBe("object");
      expect(found).toHaveProperty("render");
    },
  );

  it("says in one line what each pairing imitates", () => {
    const vague = pairings.filter(([, entry]) => entry.imitates.trim().length < 20);
    expect(vague.map(([name]) => name)).toEqual([]);
  });
});

describe("the catalogue really renders at 320px", () => {
  /** Story exports that claim to be the narrow viewport. */
  const phoneStories = () =>
    Object.entries(catalogue).filter(
      ([name, value]) =>
        name !== "default" && typeof value === "object" && value !== null && "globals" in value,
    );

  it("has narrow-viewport stories at all", () => {
    expect(phoneStories().length).toBeGreaterThanOrEqual(5);
  });

  it.each(phoneStories().map(([name]) => name))(
    "%s selects the viewport through globals, the way Storybook 10 reads it",
    (name) => {
      const story = catalogue[name] ?? {};
      const globals = story["globals"] as { viewport?: { value?: string } } | undefined;
      const parameters = story["parameters"] as
        | { viewport?: { options?: Record<string, { styles?: { width?: string } }> } }
        | undefined;

      /*
       * Both halves, because either alone is a false green.
       *
       * `parameters.viewport.options` without `globals.viewport.value` declares
       * a size nothing selects; `globals` naming a key that `options` does not
       * define selects a viewport that does not exist. Storybook 10 removed
       * `defaultViewport`, which is what the first version of these stories
       * used - it parsed, it did nothing, and the story rendered full width
       * under a name that said 320px.
       */
      const selected = globals?.viewport?.value;
      expect(selected, `${name}: globals.viewport.value yok`).toBeDefined();
      const options = parameters?.viewport?.options ?? {};
      expect(
        Object.keys(options),
        `${name}: parameters.viewport.options ${String(selected)} tanımlamıyor`,
      ).toContain(selected);
      expect(options[selected as string]?.styles?.width).toBe("320px");
    },
  );

  it("uses no removed Storybook 7 viewport key", () => {
    const offenders = Object.entries(catalogue)
      .filter(([name]) => name !== "default")
      .filter(([, value]) => {
        const parameters = (value as { parameters?: { viewport?: Record<string, unknown> } })
          .parameters;
        const viewport = parameters?.viewport ?? {};
        return "defaultViewport" in viewport || "viewports" in viewport;
      })
      .map(([name]) => name);
    expect(offenders, `Storybook 7 viewport API'si kullanan story: ${offenders.join(", ")}`).toEqual(
      [],
    );
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
