/**
 * `/dosyalar` in a real browser, at both sizes [mocked backend].
 *
 * The unit suite already asserts what this screen says. What it cannot assert
 * is what the screen *is*: jsdom computes no styles and lays nothing out, so
 * "no corner is rounder than 12px", "nothing scrolls sideways at 320px" and
 * "opening this route downloads a stylesheet the dashboard never asked for"
 * are only real claims here.
 *
 * The radius rule is the owner's, and it has exactly one exception - the search
 * input. That exception is written as a single selector rather than a tolerance
 * band, because a tolerance is how a second exception arrives unnoticed.
 */

import type { Page } from "@playwright/test";

import { expect, test } from "./mock-api";

const ROUTE = "./dosyalar";

const VIEWPORTS = [
  { name: "320x568", width: 320, height: 568 },
  { name: "1440x900", width: 1440, height: 900 },
] as const;

/** The owner's ceiling. `about 12px` is 12px; nothing here needs slack. */
const MAX_RADIUS_PX = 12;

interface MeasuredRadius {
  readonly selector: string;
  readonly radius: string;
}

/**
 * Every element whose computed radius exceeds the ceiling, except the one
 * control that is allowed to.
 *
 * Computed rather than read off the stylesheet: a radius can arrive from a
 * shorthand, from a cascade the source never shows in one place, or from a
 * percentage the browser resolves against a box only it knows the size of.
 */
async function oversizedRadii(page: Page): Promise<MeasuredRadius[]> {
  return page.evaluate((ceiling) => {
    const describe = (element: Element): string => {
      const tag = element.tagName.toLowerCase();
      const classes = typeof element.className === "string" ? element.className : "";
      return classes ? `${tag}.${classes.trim().split(/\s+/u).join(".")}` : tag;
    };

    const offenders: { selector: string; radius: string }[] = [];
    for (const element of Array.from(document.querySelectorAll("*"))) {
      // The one documented exception, and only it.
      if (element.matches('input[type="search"]')) continue;

      const style = getComputedStyle(element);
      const corners = [
        style.borderTopLeftRadius,
        style.borderTopRightRadius,
        style.borderBottomLeftRadius,
        style.borderBottomRightRadius,
      ];
      for (const corner of corners) {
        // A corner may be "8px" or "8px 6px" for an elliptical radius.
        for (const part of corner.split(/\s+/u)) {
          const pixels = Number.parseFloat(part);
          if (Number.isFinite(pixels) && pixels > ceiling) {
            offenders.push({ selector: describe(element), radius: corner });
            break;
          }
        }
      }
    }
    return offenders;
  }, MAX_RADIUS_PX);
}

for (const viewport of VIEWPORTS) {
  test.describe(`file library at ${viewport.name} [mocked backend]`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test("renders the library rather than an error or a login wall", async ({ page }) => {
      await page.goto(ROUTE);
      await page.waitForLoadState("networkidle");

      await expect(
        page.getByRole("heading", { level: 1, name: "Dosya kütüphanesi" }),
      ).toBeVisible();
      await expect(page.getByRole("main").locator(".dt-state--error")).toHaveCount(0);
      await expect(page.getByText("Oturum gerekli")).toHaveCount(0);
    });

    test("keeps every corner at 12px or less, bar the search input", async ({ page }) => {
      await page.goto(ROUTE);
      await page.waitForLoadState("networkidle");

      const offenders = await oversizedRadii(page);
      expect(
        offenders.map((entry) => `${entry.selector}: ${entry.radius}`),
        `12px üstü köşe - ${ROUTE} @ ${viewport.name}`,
      ).toEqual([]);
    });

    test("proves the measurement is real by finding rounded corners at all", async ({ page }) => {
      // A radius check that measured nothing would pass on a blank page.
      await page.goto(ROUTE);
      await page.waitForLoadState("networkidle");

      const rounded = await page.evaluate(
        () =>
          Array.from(document.querySelectorAll("*")).filter(
            (element) => Number.parseFloat(getComputedStyle(element).borderTopLeftRadius) > 0,
          ).length,
      );
      expect(rounded).toBeGreaterThan(0);
    });

    test("does not scroll sideways", async ({ page }) => {
      await page.goto(ROUTE);
      await page.waitForLoadState("networkidle");

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${ROUTE} @ ${viewport.name} yatay taşma`).toBeLessThanOrEqual(0);
    });

    test("refuses the upload with the reason on screen", async ({ page }) => {
      await page.goto(ROUTE);
      await page.waitForLoadState("networkidle");

      const upload = page.getByRole("region", { name: "Dosya yükleme" });
      await expect(upload.locator('input[type="file"]')).toBeDisabled();
      await expect(upload.getByText(/Yükleme ucu yok/u)).toBeVisible();
    });
  });
}

test.describe("the library talks to nothing [mocked backend]", () => {
  test("issues no request while its controls are operated", async ({ page }) => {
    await page.goto(ROUTE);
    await page.waitForLoadState("networkidle");

    const afterLoad: string[] = [];
    page.on("request", (request) => afterLoad.push(request.url()));

    const library = page.getByRole("region", { name: "Dosya kütüphanesi" });
    await library.getByLabel("Ara").fill("sozlesme");
    await library.getByRole("button", { name: "Kart görünümü" }).click();
    await library.getByRole("button", { name: "Sütunlar" }).click();
    await page.waitForTimeout(250);

    expect(afterLoad, "kontroller ağa çıktı").toEqual([]);
  });

  test("carries its stylesheet in a chunk the dashboard never fetches", async ({ page }) => {
    const fetched: string[] = [];
    page.on("request", (request) => fetched.push(request.url()));

    await page.goto("./panel");
    await page.waitForLoadState("networkidle");
    expect(
      fetched.filter((url) => /\/assets\/media-[\w.-]+\.css$/u.test(url)),
      "kokpit medya stil dosyasını indirdi",
    ).toEqual([]);

    await page.goto(ROUTE);
    await page.waitForLoadState("networkidle");
    expect(
      fetched.filter((url) => /\/assets\/media-[\w.-]+\.css$/u.test(url)).length,
      "dosya kütüphanesi kendi stil dosyasını indirmedi",
    ).toBeGreaterThan(0);
  });
});
