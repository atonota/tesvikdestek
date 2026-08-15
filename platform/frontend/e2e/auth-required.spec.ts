/**
 * What a signed-out visitor gets when they open a private URL [mocked backend].
 *
 * The unit suite asserts this too, and it is asserted again here for one
 * reason: jsdom has no layout engine and no real navigation, so "the private
 * shell is absent" is a claim about a rendered document that only a browser can
 * settle. A bookmarked `/panel`, a stale link in an email, an expired session
 * on a phone - all three land here, and all three used to land on the signed-in
 * chrome wrapped around "İstek başarısız (401) / Tekrar dene".
 *
 * Both viewports, because the shell renders two genuinely different documents
 * and the thumb bar and navigation sheet only exist on one of them.
 */

import type { Page } from "@playwright/test";

import { expect, test } from "./mock-api";

const PRIVATE_ROUTES = ["./panel", "./dosyalar", "./ayarlar/yapay-zeka"] as const;

const VIEWPORTS = [
  { name: "320x568", width: 320, height: 568 },
  { name: "1440x900", width: 1440, height: 900 },
] as const;

/** The session-scoped read the real backend answers with 401 when signed out. */
async function signedOut(page: Page): Promise<void> {
  await page.route("**/api/degerlendirmeler", (route) =>
    route.fulfill({ status: 401, json: { detail: "Yetkisiz." } }),
  );
}

for (const viewport of VIEWPORTS) {
  test.describe(`anonymous visitor at ${viewport.name} [mocked backend]`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const route of PRIVATE_ROUTES) {
      test(`${route} asks for a session and shows nothing private`, async ({ page }) => {
        await signedOut(page);
        await page.goto(route);
        await page.waitForLoadState("networkidle");

        const main = page.getByRole("main");
        await expect(main.getByRole("heading", { name: "Oturum gerekli" })).toBeVisible();

        // The way in is a link, and it carries where the visitor was going.
        const login = main.getByRole("link", { name: "Giriş yap" });
        await expect(login).toBeVisible();
        expect(await login.getAttribute("href")).toContain("donus=");

        // No status code, and no retry for a condition retrying cannot change.
        await expect(page.getByText("İstek başarısız (401)")).toHaveCount(0);
        await expect(page.getByRole("button", { name: "Tekrar dene" })).toHaveCount(0);

        // No private information architecture at all.
        await expect(page.getByRole("button", { name: "Çıkış" })).toHaveCount(0);
        await expect(page.getByRole("navigation", { name: "Ana gezinme" })).toHaveCount(0);
        await expect(page.getByRole("navigation", { name: "Hızlı gezinme" })).toHaveCount(0);
      });
    }

    test("the login link actually navigates and comes back to the private page", async ({
      page,
    }) => {
      await signedOut(page);
      await page.goto("./dosyalar");
      await page.waitForLoadState("networkidle");

      await page.getByRole("main").getByRole("link", { name: "Giriş yap" }).click();
      await expect(page.getByRole("heading", { level: 1, name: "Giriş" })).toBeVisible();
      expect(new URL(page.url()).searchParams.get("donus")).toBe("/dosyalar");
    });
  });
}

test.describe("a server failure is not a missing session [mocked backend]", () => {
  test("stays a retryable server error and invents no empty workspace", async ({ page }) => {
    await page.route("**/api/degerlendirmeler", (route) =>
      route.fulfill({ status: 502, body: "" }),
    );
    await page.goto("./panel");
    await page.waitForLoadState("networkidle");

    const main = page.getByRole("main");
    await expect(main.getByText("Sunucu tarafında bir hata oluştu.")).toBeVisible();
    await expect(main.getByRole("button", { name: "Tekrar dene" })).toBeVisible();

    // Not a login screen, not "çevrimdışı" while the browser is online, and
    // not a dashboard full of zeros.
    await expect(page.getByText("Oturum gerekli")).toHaveCount(0);
    await expect(page.getByText(/Çevrimdışı/u)).toHaveCount(0);
    await expect(page.getByText("Katalog ve kaynak")).toHaveCount(0);
  });
});
