/**
 * The adaptive shell, in a real browser, at the two sizes that matter.
 *
 * The unit suite asserts the shell's landmarks and its stylesheet's contract,
 * but neither can measure a layout: jsdom has no layout engine, so "no
 * horizontal overflow at 320px" and "these two rectangles do not intersect"
 * are only ever real claims here.
 *
 * 320x568 is a small phone in portrait - narrower and shorter than the 320x800
 * used elsewhere, so the sticky conversion action and the thumb bar have to
 * coexist in genuinely little vertical room. 1440x900 is the desktop case where
 * the three-column arrangement is supposed to appear.
 *
 * Three live findings are pinned here and nowhere else, because all three were
 * invisible to every unit test that existed when they shipped: the navigation
 * was an inline accordion rather than an overlay, the assistant was an ~810px
 * appendix at the bottom of the document, and at 1440 the conversion action
 * overlapped the first content card because both were placed in the same grid
 * area.
 *
 * Still a mocked backend, as every spec title in this directory says.
 */

import type { Locator, Page } from "@playwright/test";

import { expect, test } from "./mock-api";

const PANEL_ROUTES = ["./panel", "./degerlendirmeler"] as const;

/**
 * Every authenticated destination, not just the two the shell tests started
 * with.
 *
 * `/kaynaklar` overflowed sideways by 35 pixels at 320px and no test saw it:
 * the data grid's toolbar left its grid columns implicit, and an implicit track
 * takes its minimum from a search field asking for 18rem. Two routes is a
 * sample; the navigation is the population.
 */
const APP_ROUTES = [
  "./panel",
  "./degerlendirmeler",
  "./firsatlar",
  "./kaynaklar",
  "./organizasyon/hazirlik",
  "./organizasyon/profil",
  "./uygunluk/sihirbaz",
  "./olgunluk",
  "./operasyon/saglik",
  "./yetenekler",
  "./ayarlar/gorunum",
] as const;

/**
 * Scroll to the bottom of whatever actually scrolls, and report how far it went.
 *
 * The two layouts scroll in different places, and a helper that only drives
 * `window` silently stops scrolling anything on one of them - which reads as
 * "nothing moved" rather than as a broken test. On a phone the frame is bounded
 * to the viewport and `.dt-shell__content` is the scrollport, so the chrome
 * cannot cover the page; on desktop the document scrolls and the rail and the
 * assistant travel with it. Both are driven, and the larger distance is
 * returned, so `expect(scrolled).toBeGreaterThan(0)` keeps meaning "this route
 * genuinely scrolls".
 */
async function scrollToEnd(page: Page): Promise<number> {
  return page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
    const content = document.querySelector(".dt-shell__content");
    if (content !== null) content.scrollTop = content.scrollHeight;
    return Math.max(window.scrollY, content?.scrollTop ?? 0);
  });
}

/**
 * What a real click at the centre of this element would actually hit.
 *
 * A link can be visible, focusable, correctly positioned in the accessibility
 * tree - and still be underneath the header, where the click lands on the
 * header instead. Only the hit test can tell those two apart.
 */
async function receivesItsOwnClick(locator: Locator): Promise<boolean> {
  return locator.evaluate((node) => {
    const box = node.getBoundingClientRect();
    const found = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return found !== null && (node === found || node.contains(found));
  });
}

/**
 * How far anything can be scrolled sideways. One pixel is rounding.
 *
 * The document *and* the content scrollport, because they are two places the
 * same failure can hide. Making `.dt-shell__content` scroll vertically also
 * makes its computed `overflow-x` a scrollport, so a route that overflows
 * sideways now does it inside that box and `documentElement.scrollWidth` never
 * hears about it. Measuring only the document would have quietly retired the
 * guard that caught `/kaynaklar` overflowing by 35 pixels.
 */
async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const content = document.querySelector(".dt-shell__content");
    return Math.max(
      doc.scrollWidth - doc.clientWidth,
      content === null ? 0 : content.scrollWidth - content.clientWidth,
    );
  });
}

/** True when two rendered rectangles share any area at all. */
async function intersects(first: Locator, second: Locator): Promise<boolean> {
  const a = await first.boundingBox();
  const b = await second.boundingBox();
  expect(a, "the first rectangle did not render").not.toBeNull();
  expect(b, "the second rectangle did not render").not.toBeNull();
  if (!a || !b) return true;
  return (
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
  );
}

test.describe("adaptive shell at 320x568 [mocked backend]", () => {
  test.use({ viewport: { width: 320, height: 568 } });

  for (const route of PANEL_ROUTES) {
    test(`${route} renders the mobile frame without sideways scroll`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState("networkidle");

      // The frame itself: layered header, main landmark, thumb bar.
      await expect(page.getByRole("banner")).toBeVisible();
      await expect(page.getByRole("main")).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Hızlı gezinme" })).toBeVisible();
      await expect(page.locator("[data-header-layer]")).toHaveCount(2);

      // The rail is a sheet here, reached through a toggle, not a visible column.
      const toggle = page.getByRole("button", { name: /Menüyü aç/ });
      await expect(toggle).toBeVisible();
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await expect(page.getByRole("dialog")).toHaveCount(0);

      expect(await horizontalOverflow(page), `${route} scrolls sideways at 320px`).toBeLessThanOrEqual(1);
    });
  }

  test("the navigation is an overlay sheet, not an accordion that pushes the page", async ({
    page,
  }) => {
    await page.goto("./panel");
    await page.waitForLoadState("networkidle");

    /**
     * Located by id, not by role.
     *
     * While the sheet is open the page behind it is `aria-hidden`, so
     * `getByRole("main")` correctly resolves to nothing - that *is* the
     * modality this test is checking. The element is still on screen and still
     * has a position, which is what is being measured.
     */
    const main = page.locator("#ana-icerik");
    const before = await main.boundingBox();

    await page.getByRole("button", { name: /Menüyü aç/ }).click();
    const sheet = page.getByRole("dialog", { name: /Ana gezinme/ });
    await expect(sheet).toBeVisible();

    // An overlay covers the content; an accordion moves it. The page a person
    // was reading must not shift under the menu they just opened.
    const after = await main.boundingBox();
    expect(after?.y).toBe(before?.y);

    // There is a real backdrop, and it covers the viewport.
    const overlay = page.locator(".dt-sheet__overlay");
    await expect(overlay).toBeVisible();
    const box = await overlay.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(320);

    // The destinations are inside the sheet, and it still does not overflow.
    await expect(sheet.getByRole("link", { name: "Kararlar" })).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  });

  test("Escape closes the navigation sheet and focus returns to its control", async ({ page }) => {
    await page.goto("./panel");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /Menüyü aç/ }).click();
    await expect(page.getByRole("dialog", { name: /Ana gezinme/ })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    const toggle = page.getByRole("button", { name: /Menüyü aç/ });
    await expect(toggle).toBeFocused();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  test("focus stays inside the navigation sheet while it is open", async ({ page }) => {
    await page.goto("./panel");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /Menüyü aç/ }).click();
    const sheet = page.getByRole("dialog", { name: /Ana gezinme/ });
    await expect(sheet).toBeVisible();

    for (let step = 0; step < 10; step += 1) {
      await page.keyboard.press("Tab");
      const contained = await sheet.evaluate((node) => node.contains(document.activeElement));
      expect(contained, `Tab escaped the sheet after ${step + 1} presses`).toBe(true);
    }
  });

  test("the assistant is a sheet from a header control, not an appendix", async ({ page }) => {
    await page.goto("./panel");
    await page.waitForLoadState("networkidle");

    // Nothing of the assistant is in the document until it is asked for, so it
    // cannot be the ~810px tail of the page it used to be.
    await expect(page.getByRole("region", { name: /Sıradaki adımlar/ })).toHaveCount(0);

    const control = page.getByRole("button", { name: "Yardımcı" });
    await expect(control).toBeVisible();
    await control.click();

    const sheet = page.getByRole("dialog", { name: /Bağlam ve yardımcı/ });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("region", { name: /Sıradaki adımlar/ })).toBeVisible();
    // One canonical instance in this responsive state, not two.
    await expect(page.getByRole("region", { name: /Sıradaki adımlar/ })).toHaveCount(1);

    const box = await sheet.boundingBox();
    expect(box?.height).toBeLessThanOrEqual(568);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  });

  test("Escape closes the assistant sheet and focus returns to its control", async ({ page }) => {
    await page.goto("./panel");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Yardımcı" }).click();
    const sheet = page.getByRole("dialog", { name: /Bağlam ve yardımcı/ });
    await expect(sheet).toBeVisible();

    for (let step = 0; step < 8; step += 1) {
      await page.keyboard.press("Tab");
      const contained = await sheet.evaluate((node) => node.contains(document.activeElement));
      expect(contained, `Tab escaped the assistant sheet after ${step + 1} presses`).toBe(true);
    }

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Yardımcı" })).toBeFocused();
  });

  for (const route of APP_ROUTES) {
    test(`${route} does not scroll sideways on a small phone`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      // One pixel is rounding. Thirty-five is a layout that does not fit, and
      // that is what `/kaynaklar` shipped.
      expect(
        await horizontalOverflow(page),
        `${route} scrolls sideways at 320px`,
      ).toBeLessThanOrEqual(1);
    });
  }

  /**
   * The first screen of the journey is the one that has to work.
   *
   * Measured here before the fix, at `scrollY = 0` on `/uygunluk/sihirbaz`: the
   * first answer control occupied `y 494.14 - 538.14` and the thumb bar began at
   * `503.83`, leaving 9.7 of its 44 pixels reachable. A hit test 30% of the way
   * down the control returned `.dt-shell__bottom-link`. It came clear once the
   * page was scrolled to the end, which is why every existing overlap test - all
   * of which scroll first - was green while this was shipping.
   *
   * The claim is deliberately about *every* interactive control on the first
   * screen rather than about this one Select: "the wizard's first field" is a
   * symptom, and a guard written against the symptom goes green the moment the
   * copy above it changes length.
   */
  test("no control on the first screen of the wizard is under the thumb bar", async ({ page }) => {
    await page.goto("./uygunluk/sihirbaz");
    await page.waitForLoadState("networkidle");

    // Deliberately not scrolled: this is the state a person arrives in.
    expect(await page.evaluate(() => window.scrollY)).toBe(0);

    const bar = page.getByRole("navigation", { name: "Hızlı gezinme" });
    await expect(bar).toBeVisible();
    const barBox = await bar.boundingBox();
    expect(barBox, "the thumb bar did not render").not.toBeNull();

    /**
     * "Obscured" is not "below the fold", and a bounding box cannot tell them
     * apart.
     *
     * `getBoundingClientRect()` reports where an element was laid out, whether
     * or not its own scrollport shows that part of it. A control that has
     * scrolled past the bottom of the content region and a control painted over
     * by an opaque bar produce the same rectangle - and only one of them is a
     * defect. The first is reached by scrolling, which is how a page works; the
     * second cannot be reached at all.
     *
     * So each control is clipped to every scrollport above it first. What
     * survives is the part actually on screen, and *that* is hit-tested: if the
     * topmost element at the centre of the visible part is not the control, then
     * something is painted over it.
     */
    const trapped = await page.evaluate(() => {
      const offenders: string[] = [];
      const main = document.querySelector("#ana-icerik");
      if (main === null) return ["#ana-icerik is missing"];

      for (const node of main.querySelectorAll<HTMLElement>(
        "a[href], button, input, select, textarea, [role='combobox'], [tabindex]:not([tabindex='-1'])",
      )) {
        const box = node.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) continue;

        // Clip to the window and to every scrolling ancestor.
        let top = Math.max(box.top, 0);
        let bottom = Math.min(box.bottom, window.innerHeight);
        let left = Math.max(box.left, 0);
        let right = Math.min(box.right, window.innerWidth);
        for (let parent = node.parentElement; parent; parent = parent.parentElement) {
          const style = getComputedStyle(parent);
          if (style.overflowY === "visible" && style.overflowX === "visible") continue;
          const bounds = parent.getBoundingClientRect();
          top = Math.max(top, bounds.top);
          bottom = Math.min(bottom, bounds.bottom);
          left = Math.max(left, bounds.left);
          right = Math.min(right, bounds.right);
        }
        // Nothing of it is on screen: that is scrolling, not occlusion.
        if (bottom - top < 1 || right - left < 1) continue;

        const hit = document.elementFromPoint((left + right) / 2, (top + bottom) / 2);
        if (hit !== null && (hit === node || node.contains(hit) || hit.contains(node))) continue;
        offenders.push(
          `${node.tagName.toLowerCase()}.${node.className || "?"} ` +
            `visible at ${Math.round(top)}-${Math.round(bottom)} is covered by ` +
            `${hit === null ? "nothing" : hit.className || hit.tagName}`,
        );
      }
      return offenders;
    });

    expect(trapped, "a control on the first screen is painted over").toEqual([]);

    /**
     * And the structural reason it cannot happen: the scrollport and the pinned
     * chrome are different rows, so they share no pixels at all. Without this
     * the check above would pass on a page that simply had no control in the
     * bottom band on the day it ran.
     */
    const overlaps = await page.evaluate(() => {
      const rectOf = (selector: string) =>
        document.querySelector(selector)?.getBoundingClientRect() ?? null;
      const content = rectOf(".dt-shell__content");
      const bar = rectOf(".dt-shell__bottom");
      if (content === null || bar === null) return "a region did not render";
      return content.bottom > bar.top + 1
        ? `content ends at ${content.bottom} but the bar starts at ${bar.top}`
        : "";
    });
    expect(overlaps, "the content scrollport runs underneath the thumb bar").toBe("");
  });

  /**
   * A card that clips is a card that can hide the evidence it was built to show.
   *
   * `.dt-card` is `overflow: hidden` so its surface stays inside its own radius.
   * `.dt-mono` - content hashes, endpoints, MIME types - had no break
   * opportunity and `overflow-wrap: normal`, so it ran straight past that edge
   * and the characters were simply gone: `/kaynaklar` lost 34 pixels of the
   * snapshot hash `40fd42e21c92` on three cards, `/yetenekler` lost 7 of an
   * endpoint. Nothing scrolled and nothing was marked truncated, which is what
   * makes it worse than a visible cut - a hash missing its tail still reads as
   * a hash.
   *
   * The rule is geometric rather than about one class: nothing anywhere may be
   * painted past the box that clips it.
   */
  for (const route of APP_ROUTES) {
    test(`${route} clips no evidence inside a card at 320px`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState("networkidle");

      const clipped = await page.evaluate(() => {
        /**
         * The nearest box that constrains this one, and only if it conceals.
         *
         * `auto` and `scroll` are not concealment: the step list is 362 pixels
         * wide inside 288 and every step can still be reached, which is a
         * separate claim owned by the keyboard test above. `hidden` and `clip`
         * are concealment - there is no gesture, no scrollbar and no scroll
         * offset that brings the rest of the text back. So the walk stops at the
         * first ancestor that constrains the inline axis at all, and reports
         * only when that ancestor was one that hides.
         */
        const clipperOf = (node: Element): Element | null => {
          for (let parent = node.parentElement; parent; parent = parent.parentElement) {
            const overflowX = getComputedStyle(parent).overflowX;
            if (overflowX === "visible") continue;
            return /hidden|clip/u.test(overflowX) ? parent : null;
          }
          return null;
        };
        const offenders: string[] = [];
        for (const node of document.querySelectorAll("#ana-icerik *")) {
          if (node.children.length > 0) continue; // leaves carry the text
          const text = (node.textContent ?? "").trim();
          if (text.length === 0) continue;
          const clipper = clipperOf(node);
          if (clipper === null) continue;
          const box = node.getBoundingClientRect();
          const bounds = clipper.getBoundingClientRect();
          if (box.width === 0) continue;
          // One pixel is sub-pixel rounding; 34 is a hash with its tail cut off.
          const over = Math.round(Math.max(box.right - bounds.right, bounds.left - box.left));
          if (over > 1) offenders.push(`"${text.slice(0, 40)}" cut by ${over}px`);
        }
        return offenders;
      });

      expect(clipped, `${route} hides content inside a clipping box`).toEqual([]);
      // And nothing was rescued by letting the page scroll sideways instead.
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
    });
  }

  /**
   * The step list scrolls sideways at 320px - 362 against a 288px client width -
   * so a keyboard has to be able to reach the steps a pointer can drag to. axe
   * calls the missing half `scrollable-region-focusable`, and rates it serious.
   */
  test("the wizard's step list can be scrolled from the keyboard", async ({ page }) => {
    await page.goto("./uygunluk/sihirbaz");
    await page.waitForLoadState("networkidle");

    const list = page.locator(".dt-stepper__list");
    await expect(list).toBeVisible();

    const overflowing = await list.evaluate((node) => node.scrollWidth > node.clientWidth + 1);
    expect(overflowing, "the list does not scroll here, so this proves nothing").toBe(true);

    // Reachable by tabbing rather than only by script.
    await expect(list).toHaveAttribute("tabindex", "0");
    await list.focus();
    await expect(list).toBeFocused();

    // Focused, it shows that it is.
    const ring = await list.evaluate((node) => {
      const style = getComputedStyle(node);
      return { width: style.outlineWidth, style: style.outlineStyle };
    });
    expect(ring.style, "the focused step list draws no outline").not.toBe("none");
    expect(parseFloat(ring.width)).toBeGreaterThan(0);

    // And the arrow keys actually move it.
    const before = await list.evaluate((node) => node.scrollLeft);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect
      .poll(async () => list.evaluate((node) => node.scrollLeft))
      .toBeGreaterThan(before);
  });

  test("exactly one control on the panel is styled as the primary action", async ({ page }) => {
    await page.goto("./panel");
    await page.waitForLoadState("networkidle");

    // Unscoped, deliberately. Scoping the count to `.dt-shell__conversion`
    // proved that the conversion action is primary; it could not see the second
    // primary button that "Değerlendirmeyi çalıştır" put on the same screen.
    // Two primaries is not a style slip: it is two answers to "what should I do
    // next?", and the one that converts is the one that loses.
    await expect(page.locator(".dt-btn--primary")).toHaveCount(1);
    await expect(page.locator(".dt-shell__conversion .dt-btn--primary")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Değerlendirmeyi çalıştır" })).toBeVisible();
  });

  test("the conversion action stays on screen from the top of the page to the bottom", async ({
    page,
  }) => {
    await page.goto("./panel");
    await page.waitForLoadState("networkidle");

    const conversion = page.locator(".dt-shell__conversion");
    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();
    const height = viewport?.height ?? 568;

    const atTop = await conversion.boundingBox();
    expect(atTop, "the conversion action did not render").not.toBeNull();
    expect(atTop?.y ?? -1).toBeGreaterThanOrEqual(0);
    expect((atTop?.y ?? 0) + (atTop?.height ?? 0)).toBeLessThanOrEqual(height + 1);

    const scrolled = await scrollToEnd(page);
    expect(scrolled, "the panel does not scroll, so this proves nothing").toBeGreaterThan(0);

    // The failure this replaces: at scrollY ≈ 584 its top was at -435.
    await expect(conversion).toBeInViewport();
    const atEnd = await conversion.boundingBox();
    expect(atEnd?.y ?? -1).toBeGreaterThanOrEqual(0);
    expect((atEnd?.y ?? 0) + (atEnd?.height ?? 0)).toBeLessThanOrEqual(height + 1);
  });

  test("the pinned conversion action covers no content and no thumb bar", async ({ page }) => {
    await page.goto("./panel");
    await page.waitForLoadState("networkidle");
    await scrollToEnd(page);

    const conversion = page.locator(".dt-shell__conversion");
    expect(
      await intersects(conversion, page.locator("#ana-icerik")),
      "the pinned action sits on top of the content",
    ).toBe(false);
    expect(
      await intersects(conversion, page.getByRole("navigation", { name: "Hızlı gezinme" })),
      "the pinned action sits on top of the thumb bar",
    ).toBe(false);
  });

  test("a sheet trigger names the dialog it opens, not the landmark around it", async ({
    page,
  }) => {
    await page.goto("./panel");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /Menüyü aç/ }).click();
    const sheet = page.getByRole("dialog", { name: /Ana gezinme/ });
    await expect(sheet).toBeVisible();

    // Located by class, not by role: while the sheet is open the page behind it
    // is `aria-hidden`, so a role query for the trigger correctly finds
    // nothing. That is the modality working, and the attribute is still there.
    const toggle = page.locator(".dt-shell__menu-toggle");
    const controls = await toggle.getAttribute("aria-controls");
    expect(controls, "the open trigger controls nothing").toBeTruthy();
    await expect(sheet).toHaveAttribute("id", controls as string);
    // The panel must not contain the control that opens it: "go to the thing
    // you are already inside" is not navigation guidance.
    expect(
      await sheet.evaluate(
        (node, id) => node.querySelector(`[aria-controls="${String(id)}"]`) !== null,
        controls,
      ),
    ).toBe(false);
  });

  test("nothing on the panel is smaller than 1rem", async ({ page }) => {
    await page.goto("./panel");
    await page.waitForLoadState("networkidle");

    // The design contract is asserted against the stylesheets in the unit
    // suite; this is the computed truth after the cascade has run.
    const tooSmall = await page.evaluate(() => {
      const offenders: string[] = [];
      for (const element of document.querySelectorAll("body *")) {
        const text = [...element.childNodes]
          .filter((node) => node.nodeType === Node.TEXT_NODE)
          .map((node) => node.textContent ?? "")
          .join("")
          .trim();
        if (text.length === 0) continue;
        const style = getComputedStyle(element);
        if (style.visibility === "hidden" || style.display === "none") continue;
        if (parseFloat(style.fontSize) < 15.9) {
          offenders.push(`${element.className || element.tagName}: ${style.fontSize}`);
        }
      }
      return offenders.slice(0, 10);
    });
    expect(tooSmall).toEqual([]);
  });
});

test.describe("adaptive shell at 1440x900 [mocked backend]", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("the panel shows the persistent rail and the assistant column", async ({ page }) => {
    await page.goto("./panel");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("navigation", { name: "Ana gezinme" })).toBeVisible();
    await expect(page.getByRole("complementary", { name: /Bağlam ve yardımcı/ })).toBeVisible();
    await expect(page.getByRole("region", { name: /Sıradaki adımlar/ })).toBeVisible();
    // The sheet controls and the thumb bar belong to small screens only; all
    // three being present here would be duplicate controls for the same thing.
    await expect(page.getByRole("button", { name: /Menüyü aç/ })).toBeHidden();
    await expect(page.getByRole("button", { name: "Yardımcı" })).toBeHidden();
    await expect(page.getByRole("navigation", { name: "Hızlı gezinme" })).toBeHidden();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    expect(await horizontalOverflow(page), "the desktop panel scrolls sideways").toBeLessThanOrEqual(1);
  });

  test("the left rail runs the height of the shell", async ({ page }) => {
    await page.goto("./panel");
    await page.waitForLoadState("networkidle");

    const rail = page.getByRole("navigation", { name: "Ana gezinme" });
    const railBox = await rail.boundingBox();
    const shellHeight = await page.evaluate(
      () => document.querySelector(".dt-shell")?.getBoundingClientRect().height ?? 0,
    );
    const headerHeight = await page.evaluate(
      () => document.querySelector(".dt-shell__header")?.getBoundingClientRect().height ?? 0,
    );

    // It reaches the bottom of the shell rather than stopping at the height of
    // its own list, which is what `align-self: start` used to do.
    expect(railBox?.height ?? 0).toBeGreaterThanOrEqual(shellHeight - headerHeight - 2);
  });

  test("the conversion action does not overlap the content it sits above", async ({ page }) => {
    await page.goto("./panel");
    await page.waitForLoadState("networkidle");

    const conversion = page.locator(".dt-shell__conversion");
    await expect(conversion).toBeVisible();
    const firstCard = page.getByRole("main").locator(".dt-card").first();
    await expect(firstCard).toBeVisible();

    expect(
      await intersects(conversion, firstCard),
      "the conversion action overlaps the first content card",
    ).toBe(false);

    // It also stays clear of the header above it.
    expect(
      await intersects(conversion, page.getByRole("banner")),
      "the conversion action overlaps the header",
    ).toBe(false);
  });

  test("there is exactly one primary conversion call to action", async ({ page }) => {
    await page.goto("./panel");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("link", { name: "Uygunluk sihirbazını başlat" }),
    ).toHaveCount(1);
    await expect(page.locator(".dt-shell__conversion .dt-btn--primary")).toHaveCount(1);
    // Whole page, not just the conversion block: the scoped count above was
    // true while a second primary button sat in the first content card.
    await expect(page.locator(".dt-btn--primary")).toHaveCount(1);
  });

  test("the left rail stays clickable after the page has been scrolled", async ({ page }) => {
    // A window short enough that the page genuinely scrolls: the failure only
    // exists once the sticky header and the sticky rail share the same band.
    await page.setViewportSize({ width: 1440, height: 500 });
    await page.goto("./yetenekler");
    await page.waitForLoadState("networkidle");
    const scrolled = await scrollToEnd(page);
    expect(scrolled, "this route does not scroll, so this proves nothing").toBeGreaterThan(0);

    const header = await page.getByRole("banner").boundingBox();
    expect(header).not.toBeNull();
    const headerBottom = (header?.y ?? 0) + (header?.height ?? 0);

    const links = page.getByRole("navigation", { name: "Ana gezinme" }).getByRole("link");
    const total = await links.count();
    expect(total).toBeGreaterThan(2);

    for (let index = 0; index < total; index += 1) {
      const link = links.nth(index);
      const name = (await link.textContent())?.trim() ?? `#${index}`;
      const box = await link.boundingBox();
      if (box === null) continue; // Scrolled out of the rail's own overflow.
      // Kokpit and Kararlar used to end up here: on screen, in the tree, and
      // underneath the sticky header.
      expect(box.y, `"${name}" is behind the header`).toBeGreaterThanOrEqual(headerBottom - 1);
      expect(
        await receivesItsOwnClick(link),
        `"${name}" does not receive its own click`,
      ).toBe(true);
    }
  });

  test("the navigation drawer does not reopen itself on the way back to a phone", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("./panel");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /Menüyü aç/ }).click();
    await expect(page.getByRole("dialog", { name: /Ana gezinme/ })).toBeVisible();

    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Ana gezinme" })).toBeVisible();

    await page.setViewportSize({ width: 320, height: 568 });
    const toggle = page.getByRole("button", { name: /Menüyü aç/ });
    await expect(toggle).toBeVisible();
    // The store said "open" the whole time, so the sheet came back modal and
    // focus-trapping with nobody having asked for it.
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  test("the assistant states that no provider is connected and invents nothing", async ({
    page,
  }) => {
    await page.goto("./panel");
    await page.waitForLoadState("networkidle");

    const rail = page.getByRole("region", { name: /Sıradaki adımlar/ });
    await expect(rail.getByText(/bağlı bir yapay zekâ sağlayıcısı yok/i)).toBeVisible();
    await expect(rail.getByText(/analiz tamamlandı|sonuçlar üretildi/i)).toHaveCount(0);
  });
});

/**
 * A short, wide desktop window - a laptop with a browser that is not maximised,
 * or a screen sharing session. It is where a column that is merely `static`
 * stops being a rail and becomes an appendix: at 400px tall the assistant
 * scrolled entirely off the top and the only way back was to scroll the page.
 */
test.describe("adaptive shell at 1440x400 [mocked backend]", () => {
  test.use({ viewport: { width: 1440, height: 400 } });

  test("the assistant column stays on screen while the page scrolls past it", async ({ page }) => {
    await page.goto("./panel");
    await page.waitForLoadState("networkidle");

    const rail = page.getByRole("region", { name: /Sıradaki adımlar/ });
    await expect(rail).toBeVisible();

    const scrolled = await scrollToEnd(page);
    expect(scrolled, "the panel does not scroll at 400px tall").toBeGreaterThan(0);

    await expect(rail).toBeInViewport();
    const header = await page.getByRole("banner").boundingBox();
    const box = await rail.boundingBox();
    expect(box, "the assistant left the document").not.toBeNull();
    // Below the header rather than behind it, and inside the window rather than
    // above it.
    expect(box?.y ?? -1).toBeGreaterThanOrEqual((header?.y ?? 0) + (header?.height ?? 0) - 1);
    expect(box?.y ?? -1).toBeLessThan(400);
  });

  test("the assistant scrolls inside its own column rather than off the page", async ({
    page,
  }) => {
    await page.goto("./panel");
    await page.waitForLoadState("networkidle");
    await scrollToEnd(page);

    const bounded = await page.locator(".dt-shell__aside-inner").evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        position: style.position,
        overflowY: style.overflowY,
        withinWindow: node.getBoundingClientRect().height <= window.innerHeight + 1,
        scrollable: node.scrollHeight > node.clientHeight,
      };
    });
    expect(bounded.position).toBe("sticky");
    expect(bounded.overflowY).toBe("auto");
    expect(bounded.withinWindow, "the assistant column is taller than the window").toBe(true);
    expect(bounded.scrollable, "nothing is bounded here, so nothing was proved").toBe(true);
  });
});
