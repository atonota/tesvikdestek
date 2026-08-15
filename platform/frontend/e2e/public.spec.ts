import { expect, test } from "./mock-api";

/**
 * Public navigation, responsiveness and accessibility.
 *
 * The backend is faked by Playwright request routing, so these prove the
 * *frontend* behaves. They are not evidence about FastAPI, PostgreSQL or a
 * real session, and the spec titles say so.
 */

test.describe("public navigation [mocked backend]", () => {
  test("landing renders one h1, a skip link and the disclaimer", async ({ page }) => {
    await page.goto("./");
    await expect(page.getByRole("link", { name: "İçeriğe geç" })).toBeAttached();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByTestId("disclaimer")).toBeVisible();
  });

  test("navigates to the catalogue and into a programme", async ({ page }) => {
    await page.goto("./");
    await page.getByRole("link", { name: "Programlar" }).first().click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Program kataloğu");
    await page.getByRole("link", { name: /TÜBİTAK 1501/ }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("1501");
  });

  test("an unknown route shows the not-found surface", async ({ page }) => {
    await page.goto("./boyle-bir-sayfa-yok");
    await expect(page.getByRole("heading", { name: /Sayfa bulunamadı/ })).toBeVisible();
  });
});

test.describe("responsive behaviour [mocked backend]", () => {
  for (const width of [320, 768, 1024, 1440]) {
    test(`no page-level horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("./degerlendirmeler");
      await page.waitForLoadState("networkidle");

      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return doc.scrollWidth - doc.clientWidth;
      });
      expect(overflow, `${width}px viewport scrolls sideways`).toBeLessThanOrEqual(1);
    });
  }
});

/*
 * The axe sweep used to live here and covered four paths, all of them reading
 * surfaces. It now lives in `accessibility.spec.ts`, which scans the same public
 * routes *and* all eleven authenticated destinations, at 320x568 and at
 * 1440x900. It was moved rather than duplicated: two gates over the same routes
 * drift, and the one that is easier to satisfy is the one people keep.
 */
