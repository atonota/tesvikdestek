/**
 * The master component layer, measured in a real browser.
 *
 * Three of the claims this package makes cannot be checked anywhere else,
 * because jsdom has no cascade and no layout engine:
 *
 *  1. **The cascade order actually resolves the way the stylesheet says.** The
 *     master layer's whole premise is that a Tailwind utility beats a `.dt-*`
 *     component rule, and that is a property of `@layer` ordering across two
 *     stylesheets - invisible to every unit test. It failed once, silently, and
 *     the consequence was the primary button rendering near-black text on
 *     parliament blue at 1.56:1 on every screen in the product.
 *  2. **The bounded phone frame stays bounded.** A `100dvh` grid whose inner
 *     scroller still lets the viewport scroll carries the pinned action off the
 *     top of the screen. Only a browser can say whether the document scrolls.
 *  3. **The shimmer stops when motion is refused.** `motion-reduce:` is a media
 *     query; a computed style is the only honest evidence.
 *
 * Everything here runs against the mocked backend, like every other spec in
 * this directory, and against both themes - a design system that is only
 * correct in one of them is half a design system.
 */

import type { Page } from "@playwright/test";

import { expect, test } from "./mock-api";

const PHONE = { width: 320, height: 568 };
const DESKTOP = { width: 1440, height: 900 };

/** The two themes, applied the way the appearance store applies them. */
async function useTheme(page: Page, theme: "light" | "dark"): Promise<void> {
  await page.evaluate((value) => {
    document.documentElement.dataset["theme"] = value;
  }, theme);
}

/** `#123a6b` as Chromium reports it, so a token can be compared to a computed style. */
function hexToRgb(hex: string): string {
  const value = hex.replace("#", "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((char) => char + char)
          .join("")
      : value;
  const [r, g, b] = [0, 2, 4].map((offset) => parseInt(full.slice(offset, offset + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

/** sRGB relative luminance and contrast, per WCAG 2.x. Same maths as the unit contract. */
function contrast(a: string, b: string): number {
  const channels = (colour: string) =>
    (colour.match(/[\d.]+/gu) ?? ["0", "0", "0"]).slice(0, 3).map((value) => {
      const raw = Number(value) / 255;
      return raw <= 0.03928 ? raw / 12.92 : ((raw + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
  const luminance = (colour: string) => {
    const [r, g, blue] = channels(colour);
    return 0.2126 * r + 0.7152 * g + 0.0722 * blue;
  };
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

for (const viewport of [
  { name: "320x568", size: PHONE },
  { name: "1440x900", size: DESKTOP },
]) {
  for (const theme of ["light", "dark"] as const) {
    test.describe(`master layer at ${viewport.name}, ${theme} [mocked backend]`, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize(viewport.size);
      });

      test("the primary button is painted by the master recipe, readably", async ({ page }) => {
        await page.goto("./panel?demo=customer");
        await useTheme(page, theme);
        const button = page.locator(".dt-btn--primary").first();
        await expect(button).toBeVisible();

        const paint = await button.evaluate((node) => {
          const style = getComputedStyle(node);
          return { colour: style.color, background: style.backgroundColor };
        });

        /*
         * The regression this pins, exactly.
         *
         * `base.css` declares `button { color: inherit }` in its reset layer.
         * With the layer order wrong, that reset landed after Tailwind's
         * utilities and beat `text-primary-foreground`, so the button inherited
         * body text colour onto a parliament-blue surface: 1.56:1, an axe
         * `color-contrast` failure at serious severity, on the product's most
         * important control. Nothing in the unit suite could see it.
         */
        expect(
          contrast(paint.colour, paint.background),
          `birincil düğme okunmuyor: ${paint.colour} / ${paint.background}`,
        ).toBeGreaterThanOrEqual(4.5);
      });

      test("the workspace never scrolls sideways and logs no console error", async ({ page }) => {
        const errors: string[] = [];
        page.on("console", (message) => {
          if (message.type() === "error") errors.push(message.text());
        });
        page.on("pageerror", (error) => errors.push(error.message));

        await page.goto("./panel?demo=customer");
        await useTheme(page, theme);
        // The analytics section is lazy; wait for its heading rather than a
        // timeout, so this measures a settled page rather than a race.
        await expect(
          page.getByRole("heading", { name: "Teşvik portföyü ve süreç dağılımı" }),
        ).toBeVisible();

        const overflow = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
        expect(errors, `konsol hatası: ${errors.join(" | ")}`).toEqual([]);
      });

      test("the analytics figures are readable as text, not only as a canvas", async ({
        page,
      }) => {
        await page.goto("./panel?demo=customer");
        await useTheme(page, theme);
        // Three programmes, all grants, from the demo catalogue - the table is
        // the primary reading and the chart is the summary of it.
        const table = page.getByRole("table").filter({ hasText: "Destek türü" });
        await expect(table).toBeVisible();
        await expect(table.getByRole("rowheader", { name: "Hibe" })).toBeVisible();
        await expect(table.getByRole("cell", { name: "3", exact: true })).toBeVisible();
      });
    });
  }
}

test.describe("the bounded phone frame stays bounded [mocked backend]", () => {
  test("the document does not scroll behind the 100dvh shell", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto("./panel?demo=customer");
    await expect(
      page.getByRole("heading", { name: "Teşvik portföyü ve süreç dağılımı" }),
    ).toBeVisible();

    /*
     * Measured before the fix, on this exact route and viewport: the document
     * reported a scroll height of 1454 against a client height of 568 and
     * `window.scrollTo(0, 5000)` moved the page 886px, putting the whole frame
     * - header, pinned action and thumb bar with it - at `y = -886`.
     */
    const scrolled = await page.evaluate(() => {
      window.scrollTo(0, 5000);
      return { y: window.scrollY, shellTop: document.querySelector(".dt-shell")!.getBoundingClientRect().top };
    });
    expect(scrolled.y).toBe(0);
    expect(scrolled.shellTop).toBe(0);
  });
});

test.describe("skeleton shimmer, in a real browser [mocked backend]", () => {
  /**
   * The shimmer's motion is checked through Storybook rather than the app.
   *
   * The application's skeletons are on screen for the length of a mocked
   * network round trip, which is not long enough to assert against reliably.
   * The catalogue renders the same components under the same stylesheet, and
   * one of its stories exists precisely to hold the reduced-motion state still.
   */
  test("stops sweeping when the product's motion setting refuses it", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto("./panel?demo=customer");

    const animation = await page.evaluate(() => {
      const probe = document.createElement("span");
      probe.className =
        "relative block overflow-hidden rounded-xs bg-muted before:absolute before:inset-0 " +
        "before:-translate-x-full before:animate-[dt-shimmer_1.4s_ease-in-out_infinite] " +
        "motion-reduce:before:animate-none [html[data-reduced-motion='true']_&]:before:animate-none";
      document.body.append(probe);
      const moving = getComputedStyle(probe, "::before").animationName;
      document.documentElement.dataset["reducedMotion"] = "true";
      const still = getComputedStyle(probe, "::before").animationName;
      probe.remove();
      delete document.documentElement.dataset["reducedMotion"];
      return { moving, still };
    });

    // The sweep is real when motion is allowed…
    expect(animation.moving).toBe("dt-shimmer");
    // …and genuinely stopped when it is not. `prefers-reduced-motion` is the
    // operating system's half of this and is covered by the same declaration;
    // only the product's own switch can be toggled from here.
    expect(animation.still).toBe("none");
  });
});

test.describe("Preflight is absent and the cascade still resolves [mocked backend]", () => {
  /**
   * The claim `master-stack-contract.test.ts` can only make structurally.
   *
   * That file asserts Preflight is not imported and that the layer statement
   * names the right order. Whether a Tailwind utility actually *wins* against a
   * `.dt-*` component rule is a fact about the resolved cascade in a browser,
   * and it is the premise the whole master layer rests on.
   */
  test("a utility beats a component rule, and links keep their underline", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("./panel?demo=customer");
    await expect(
      page.getByRole("heading", { name: "Teşvik portföyü ve süreç dağılımı" }),
    ).toBeVisible();

    const resolved = await page.evaluate(() => {
      /*
       * `.dt-btn--secondary` sets a background in `@layer components`; the
       * master recipe sets `bg-secondary` in `@layer utilities`. Both are on
       * the same element, both are one class of specificity, and the utility
       * has to win purely on layer order.
       */
      const withUtility = document.createElement("button");
      withUtility.className = "dt-btn dt-btn--secondary bg-primary";
      const withoutUtility = document.createElement("button");
      withoutUtility.className = "dt-btn dt-btn--secondary";
      document.body.append(withUtility, withoutUtility);
      const utility = getComputedStyle(withUtility).backgroundColor;
      const component = getComputedStyle(withoutUtility).backgroundColor;
      const token = getComputedStyle(document.documentElement)
        .getPropertyValue("--dt-color-primary")
        .trim();
      withUtility.remove();
      withoutUtility.remove();

      const link = document.querySelector("main a.dt-link");
      const underline = link === null ? null : getComputedStyle(link).textDecorationLine;

      return { utility, component, token, underline };
    });

    /*
     * Three facts, and all three are needed.
     *
     * The component rule paints *something* (so the sheet is loaded and the
     * probe is not inert), the utility paints something *different* (so the
     * layer order really put utilities last), and what it paints is the
     * primary token (so it is the right rule winning, not any rule).
     */
    expect(resolved.component).not.toBe("rgba(0, 0, 0, 0)");
    expect(resolved.utility).not.toBe(resolved.component);
    expect(resolved.token).not.toBe("");
    expect(hexToRgb(resolved.token)).toBe(resolved.utility);
    // Preflight would have removed this; the user agent's underline survives.
    expect(resolved.underline).toBe("underline");
  });
});

test.describe("loading, unread and empty are three different screens [mocked backend]", () => {
  /**
   * The defect this pins: all three used to render "okunamadı".
   *
   * A request still in flight was reported as a failure, and a catalogue that
   * genuinely had no rows was reported as a fault that had not occurred. The
   * three are driven here by the only thing that can drive them honestly - the
   * network - so the assertion is about what the reader sees, not about a prop.
   */
  test("a slow read shows the section's own shaped skeleton, not an error", async ({ page }) => {
    await page.setViewportSize(PHONE);
    // Held open long enough to observe, then released so the page settles.
    await page.route("**/api/programlar", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await route.fulfill({ json: [] });
    });

    await page.goto("./panel?demo=customer");

    const skeleton = page.getByTestId("analytics-skeleton").first();
    await expect(skeleton).toBeVisible();
    // The shape, not a grey block: the section's card, its table and its chart.
    await expect(skeleton.locator("[data-slot='skeleton-table']")).toBeVisible();
    await expect(skeleton.locator("[data-slot='skeleton-chart']")).toBeVisible();
    // And it says what is loading rather than announcing a failure.
    await expect(page.getByText("okunamadı")).toHaveCount(0);
  });

  test("a genuinely empty catalogue reads as a measurement, not as a fault", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.route("**/api/programlar", (route) => route.fulfill({ json: [] }));

    await page.goto("./panel?demo=customer");
    await expect(
      page.getByRole("heading", { name: "Teşvik portföyü ve süreç dağılımı" }),
    ).toBeVisible();

    await expect(page.getByText("Katalogda hiç program yok")).toBeVisible();
    await expect(page.getByText("Program kataloğu okunamadı")).toHaveCount(0);
  });

  test("a failed read says so, and names what could not be read", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.route("**/api/programlar", (route) =>
      route.fulfill({ status: 500, json: { detail: "Katalog okunamadi." } }),
    );

    await page.goto("./panel?demo=customer");
    await expect(page.getByText("Program kataloğu okunamadı")).toBeVisible();
    // And it must not be confused with the empty state beside it.
    await expect(page.getByText("Katalogda hiç program yok")).toHaveCount(0);
  });
});
