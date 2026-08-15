/**
 * One-click demo entry, in a real browser [mocked backend].
 *
 * The unit suite already pins the behaviour. These run anyway, and only the
 * claims jsdom genuinely cannot settle:
 *
 *   - **no horizontal overflow at 320px.** jsdom has no layout engine, so
 *     "the credential row does not widen the page" is not a claim it can make.
 *     A demo e-mail is one unbreakable 34-character token inside a padded card
 *     on the narrowest phone this product supports; that is exactly the shape
 *     that overflows, and only a browser knows whether it did.
 *   - **the action is really 44px tall and really full width.** A class name in
 *     a snapshot is not a measurement.
 *   - **nothing is persisted.** `localStorage`, `sessionStorage` and
 *     `document.cookie` are read from the live page after entering the demo -
 *     a source scan cannot see what a dependency writes at runtime.
 *   - **entry really signs the browser out.** Observed at the browser's own
 *     network layer, and then confirmed against a stateful backend: a session
 *     that was open before the demo must be closed after it. That scenario is
 *     the defect an independent review found, and it is walked below from a
 *     signed-in state rather than asserted about one.
 *
 * The backend is mocked, as everywhere in this directory, and it is mocked to
 * fail *selectively*, which is the only shape that is honest here:
 *
 *   - the tenant reads answer 401, so the demo has to open a working workspace
 *     with no readable tenant data behind it;
 *   - `GET /api/csrf` and `POST /cikis` keep working, because demo entry
 *     performs a genuine sign-out and a genuine sign-out needs a signed token.
 *
 * So this is not "no backend at all", and saying so would contradict the
 * feature under test. It is a backend that will not hand over anybody's data
 * but will still let the browser end a session - which is exactly what a
 * reviewer's laptop looks like when it is pointed at a deployment they have no
 * account on.
 */

import type { Page } from "@playwright/test";

import { expect, test } from "./mock-api";

const DEMO_ACTIONS = [
  { role: "superadmin", action: "Süperadmin demosunu aç", badge: "Demo · Süperadmin" },
  { role: "customer", action: "Müşteri demosunu aç", badge: "Demo · Müşteri" },
] as const;

const VIEWPORTS = [
  { name: "320x568", width: 320, height: 568 },
  { name: "1440x900", width: 1440, height: 900 },
] as const;

/**
 * No session: every tenant-scoped read answers 401.
 *
 * Each tenant read is routed by name rather than by one wildcard over the whole
 * API prefix, and the difference is not cosmetic. `GET /api/csrf` is not
 * tenant-scoped: it hands out the signed token every form POST needs, including
 * the sign-out that demo entry performs. A single catch-all route across the
 * API prefix therefore swallowed the token request too, the genuine logout
 * could not be signed, the demo refused to open - correctly - and for one
 * confusing run that looked like a product defect. Naming the three reads keeps
 * the fixture's own csrf route in force.
 */
async function noBackend(page: Page): Promise<void> {
  for (const path of ["programlar", "kaynaklar", "degerlendirmeler"]) {
    await page.route(`**/api/${path}`, (route) =>
      route.fulfill({ status: 401, json: { detail: "Yetkisiz." } }),
    );
    await page.route(`**/api/${path}/*`, (route) =>
      route.fulfill({ status: 401, json: { detail: "Yetkisiz." } }),
    );
  }
  await page.route("**/hazir", (route) => route.fulfill({ status: 401, body: "" }));
}

for (const viewport of VIEWPORTS) {
  test.describe(`demo entry at ${viewport.name} [mocked backend]`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test("shows both role cards with their demo credentials visible", async ({ page }) => {
      await noBackend(page);
      await page.goto("./giris");

      for (const entry of DEMO_ACTIONS) {
        await expect(page.getByRole("button", { name: entry.action })).toBeVisible();
      }
      await expect(page.getByText("superadmin@demo.destektesvik.local")).toBeVisible();
      await expect(page.getByText("musteri@demo.destektesvik.local")).toBeVisible();
      // The manual form is untouched and still the way a real user signs in.
      await expect(page.getByRole("button", { name: "Giriş yap" })).toBeVisible();
    });

    test("the page does not scroll sideways and the actions are thumb-sized", async ({
      page,
    }) => {
      await noBackend(page);
      await page.goto("./giris");
      await page.waitForLoadState("networkidle");

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, "giriş ekranı yatay taşıyor").toBeLessThanOrEqual(0);

      for (const entry of DEMO_ACTIONS) {
        const box = await page.getByRole("button", { name: entry.action }).boundingBox();
        expect(box, `${entry.action} ölçülemedi`).not.toBeNull();
        expect(box!.height).toBeGreaterThanOrEqual(44);
        /*
         * Full width means the card's *content* box, not its border box.
         *
         * `clientWidth` includes the card's 1rem padding on each side, so
         * comparing against it asks the button to be wider than the space it
         * is allowed to occupy - a test that can only pass if the layout is
         * broken. The content width is what full-width actually means here.
         */
        const contentWidth = await page
          .getByRole("button", { name: entry.action })
          .evaluate((node) => {
            const card = node.parentElement as HTMLElement;
            const style = getComputedStyle(card);
            return (
              card.clientWidth -
              parseFloat(style.paddingInlineStart) -
              parseFloat(style.paddingInlineEnd)
            );
          });
        expect(Math.abs(box!.width - contentWidth)).toBeLessThanOrEqual(1);
      }
    });

    for (const entry of DEMO_ACTIONS) {
      test(`${entry.role}: one click opens the app and the shell says so`, async ({ page }) => {
        await noBackend(page);
        await page.goto("./giris");

        await page.getByRole("button", { name: entry.action }).click();

        await expect(page.getByRole("heading", { level: 1, name: "Kokpit" })).toBeVisible();
        await expect(page.getByText(entry.badge)).toBeVisible();
      });
    }
  });
}

test.describe("the demo is a frontend session and proves it [mocked backend]", () => {
  test("really signs the browser out on the way in, and reads nothing after", async ({
    page,
  }) => {
    await noBackend(page);
    await page.goto("./giris");

    const sent: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (/^\/uygulama\/(assets|@)/u.test(url.pathname)) return;
      if (url.pathname.endsWith(".js") || url.pathname.endsWith(".css")) return;
      sent.push(`${request.method()} ${url.pathname}`);
    });

    await page.getByRole("button", { name: "Süperadmin demosunu aç" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Kokpit" })).toBeVisible();
    await page.waitForLoadState("networkidle");

    // Exactly one write, and it is the genuine sign-out. Never a sign-in.
    expect(sent.filter((entry) => entry.startsWith("POST"))).toEqual(["POST /cikis"]);
    // Once the demo is running the adapter answers; no tenant read is made.
    expect(sent.filter((entry) => /\/(api\/(programlar|kaynaklar|degerlendirmeler)|hazir)\b/u.test(entry))).toEqual(
      [],
    );
  });

  /**
   * The reviewer's scenario, walked end to end in a browser.
   *
   * A real session is simulated the only way it can be from outside: the
   * backend serves tenant data while a server-side flag is set, `POST /cikis`
   * clears it, and a cleared flag answers 401. This is the test that would have
   * caught the original defect - it enters a demo *from a signed-in state*,
   * leaves it, and asks `/panel` who it thinks the visitor is.
   */
  test("a real session does not survive a demo visit", async ({ page }) => {
    let serverSessionOpen = true;
    await page.route("**/api/degerlendirmeler", (route) =>
      serverSessionOpen
        ? route.fulfill({ json: [] })
        : route.fulfill({ status: 401, json: { detail: "Yetkisiz." } }),
    );
    await page.route("**/cikis", (route) => {
      if (route.request().method() !== "POST") return route.continue();
      serverSessionOpen = false;
      return route.fulfill({ status: 200, body: "" });
    });

    // Signed in: the workspace opens without a login screen.
    await page.goto("./panel");
    await expect(page.getByRole("heading", { level: 1, name: "Kokpit" })).toBeVisible();

    // Walk to the login screen and take the demo.
    await page.goto("./giris");
    await page.getByRole("button", { name: "Müşteri demosunu aç" }).click();
    await expect(page.getByText("Demo · Müşteri")).toBeVisible();
    expect(serverSessionOpen, "demo açıldı ama sunucu oturumu hâlâ açık").toBe(false);

    // Leave the demo, then ask the workspace directly, with a fresh document.
    await page.getByRole("button", { name: "Çıkış" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Giriş" })).toBeVisible();

    await page.goto("./panel");
    await expect(page.getByRole("heading", { name: "Oturum gerekli" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Kokpit" })).toHaveCount(0);
  });

  test("does not open the demo when the sign-out fails", async ({ page }) => {
    await noBackend(page);
    await page.route("**/cikis", (route) =>
      route.request().method() === "POST"
        ? route.fulfill({ status: 500, body: "" })
        : route.continue(),
    );
    await page.goto("./giris");

    await page.getByRole("button", { name: "Süperadmin demosunu aç" }).click();

    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Giriş" })).toBeVisible();
    await expect(page.getByText("Demo · Süperadmin")).toHaveCount(0);
  });

  test("writes nothing to storage and sets no cookie", async ({ page }) => {
    await noBackend(page);
    await page.goto("./giris");
    await page.getByRole("button", { name: "Müşteri demosunu aç" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Kokpit" })).toBeVisible();

    const stored = await page.evaluate(() => ({
      local: Object.entries({ ...window.localStorage }),
      session: Object.entries({ ...window.sessionStorage }),
      cookie: document.cookie,
    }));

    expect(stored.cookie).toBe("");
    expect(stored.session).toEqual([]);
    // The appearance store is the one legitimate writer; nothing it holds may
    // name a role, an address or a session.
    for (const [key, value] of stored.local) {
      expect(`${key} ${String(value)}`).not.toMatch(/superadmin|customer|@demo\.|oturum/iu);
    }
  });

  test("leaving clears the demo and returns to the login screen", async ({ page }) => {
    await noBackend(page);
    await page.goto("./giris");
    await page.getByRole("button", { name: "Süperadmin demosunu aç" }).click();
    await expect(page.getByText("Demo · Süperadmin")).toBeVisible();

    await page.getByRole("button", { name: "Çıkış" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Giriş" })).toBeVisible();
    await expect(page.getByText("Demo · Süperadmin")).toHaveCount(0);
  });

  test("refuses a demo write in words instead of faking a save", async ({ page }) => {
    await noBackend(page);
    await page.goto("./giris");
    await page.getByRole("button", { name: "Müşteri demosunu aç" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Kokpit" })).toBeVisible();

    /*
     * Navigated in-app, and that detail is the feature rather than a test
     * convenience. The demo session lives in module memory, so a `page.goto`
     * is a full document load that discards it - the visitor lands on "Oturum
     * gerekli", which is the correct answer to "you reloaded and there is no
     * server session". Persisting it to survive a reload is exactly the
     * storage this feature refuses, so the reload behaviour is the price and
     * it is a price worth naming.
     */
    await page.getByRole("link", { name: "Hazırlık" }).first().click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Organizasyon hazırlığı" }),
    ).toBeVisible();
    await page.getByRole("link", { name: /profil/iu }).first().click();
    await page.getByRole("button", { name: "Profili kaydet" }).click();

    const alert = page.getByRole("alert");
    await expect(alert).toBeVisible();
    await expect(alert).toContainText("Demo");
    await expect(alert).toContainText("kaydedilmez");
  });
});
