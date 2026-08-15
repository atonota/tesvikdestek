/**
 * The GitHub Pages publication, in a real browser, with no backend at all.
 *
 * Every other spec in this directory runs the ordinary bundle with the backend
 * faked by request routing. This one is the opposite in the one way that
 * matters: it runs the *published* artifact - built with
 * `VITE_STATIC_DEMO_ONLY=true` and base `/tesvikdestek/uygulama/`, exactly as
 * `.github/workflows/pages.yml` builds it - and it installs no backend of any
 * kind. Nothing answers `/api/…`, `/giris`, `/kayit`, `/cikis` or `/hazir`,
 * because on the real publication nothing does.
 *
 * **The defect being regression-tested.** A visitor opened the demo, pressed
 * reload, and the demo was gone: the session lived in module memory, the
 * workspace boundary fell back to a tenant read, the file server answered 404
 * and the screen said "Çalışma alanı açılamadı". This file walks that exact
 * sequence, for both profiles, at both widths.
 *
 * **What jsdom cannot settle, and this can.** That a real reload of a real
 * document restores the demo. That the address survives the way Pages serves a
 * deep link. That nothing lands in `localStorage`, `sessionStorage` or a
 * cookie at runtime, whatever a dependency does. That not one request leaves
 * for a backend path. That the demo shell does not overflow a 320px screen.
 *
 * **One honest difference from the real publication.** `vite preview` answers
 * an unknown path with `200` and the application, while GitHub Pages answers
 * `404` with `404.html`, which the workflow makes a byte-identical copy of the
 * application. The document the browser boots is the same in both cases, and
 * the basename it boots with is the same, which is what these tests are about.
 * The status code difference is stated here rather than glossed;
 * `pages-deployment-contract.test.ts` is what pins the copy that makes the
 * real publication behave this way.
 */

import { expect, test, type Page } from "@playwright/test";

const PROFILES = [
  { role: "superadmin", action: "Süperadmin demosunu aç", badge: "Demo · Süperadmin" },
  { role: "customer", action: "Müşteri demosunu aç", badge: "Demo · Müşteri" },
] as const;

/** Where the published application lives. Everything under it is the bundle. */
const BASE = "/tesvikdestek/uygulama/";

/**
 * Backend paths, as `client.ts` and `vite.config.ts` spell them.
 *
 * All of them are *origin-root* paths: the application is served from a
 * sub-path, but it asks the backend at `/api/…`, `/giris`, `/cikis` and so on,
 * because in the ordinary deployment a reverse proxy puts FastAPI there. On
 * the static publication a request to any of them is a defect by definition -
 * there is no process behind this origin to answer one.
 *
 * The distinction the first draft of this file got wrong, recorded because it
 * is exactly the confusion the test exists to avoid: `/tesvikdestek/uygulama/giris`
 * is not `/giris`. The first is the application's own login *screen*, fetched
 * as a document when the browser navigates to it; the second is a form
 * endpoint on a server. Counting the former as a backend call made the demo
 * look like it was phoning home for opening its own login page.
 */
const BACKEND = /^\/(api\/|giris|kayit|cikis|profil|hazir|degerlendir|openapi\.json)/u;

/** Everything the browser asked for, recorded before the first navigation. */
function recordRequests(page: Page): string[] {
  const seen: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    seen.push(`${request.method()} ${url.pathname}`);
  });
  return seen;
}

function backendCalls(seen: readonly string[]): string[] {
  return seen.filter((entry) => {
    const path = entry.slice(entry.indexOf(" ") + 1);
    // Anything served from under the base is the bundle itself: its documents,
    // its chunks, its fonts. Only what leaves that prefix can be a backend.
    return !path.startsWith(BASE) && BACKEND.test(path);
  });
}

async function enterDemo(page: Page, action: string): Promise<void> {
  await page.goto("./giris");
  await page.getByRole("button", { name: action }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Kokpit" })).toBeVisible();
}

/*
 * The width comes from the project, not from this file.
 *
 * `playwright.config.ts` runs this spec twice - once at a desktop width and
 * once at 320px, the narrowest screen this product supports - so every test
 * below is a test at both widths. Setting a viewport here as well would run
 * the desktop cases inside the 320px project and vice versa, and the titles
 * would then name a width the test was not running at.
 */
test.describe("the static Pages demo [no backend at all]", () => {
  for (const profile of PROFILES) {
    test(`${profile.role}: survives a reload with the same role`, async ({ page }) => {
      const seen = recordRequests(page);
      await enterDemo(page, profile.action);
      await expect(page.getByText(profile.badge)).toBeVisible();

      /*
       * The address is the whole persistence mechanism, so it has to say so
       * before a reload can be expected to find anything there.
       *
       * Polled rather than read once: the workspace paints as soon as the
       * demo session exists, and the address is brought into agreement with
       * it on the following commit. That is one tick, invisible to a person
       * and quite visible to a browser test that reloads immediately.
       */
      await expect
        .poll(() => new URL(page.url()).searchParams.get("demo"))
        .toBe(profile.role);

      await page.reload();

      await expect(page.getByRole("heading", { level: 1, name: "Kokpit" })).toBeVisible();
      // The chosen role came back - not the other one, and not a generic demo.
      await expect(page.getByText(profile.badge)).toBeVisible();
      for (const other of PROFILES.filter((entry) => entry.role !== profile.role)) {
        await expect(page.getByText(other.badge)).toHaveCount(0);
      }
      await expect(page.getByText("Çalışma alanı açılamadı")).toHaveCount(0);
      expect(backendCalls(seen), "statik yayın backend'e istek gönderdi").toEqual([]);
    });

    test(`${profile.role}: opens a protected deep link directly`, async ({ page }) => {
      const seen = recordRequests(page);

      // Typed, pasted or bookmarked - the case Pages answers with 404.html.
      await page.goto(`./organizasyon/hazirlik?demo=${profile.role}`);

      await expect(
        page.getByRole("heading", { level: 1, name: "Organizasyon hazırlığı" }),
      ).toBeVisible();
      await expect(page.getByText(profile.badge)).toBeVisible();
      expect(backendCalls(seen)).toEqual([]);
    });
  }

  test("keeps the demo across in-app navigation, so every screen is reloadable", async ({
    page,
  }) => {
    await enterDemo(page, PROFILES[1].action);

    await page.getByRole("link", { name: "Hazırlık" }).first().click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Organizasyon hazırlığı" }),
    ).toBeVisible();
    await expect
      .poll(() => new URL(page.url()).searchParams.get("demo"))
      .toBe(PROFILES[1].role);

    await page.reload();
    await expect(
      page.getByRole("heading", { level: 1, name: "Organizasyon hazırlığı" }),
    ).toBeVisible();
    await expect(page.getByText(PROFILES[1].badge)).toBeVisible();
  });

  test("sends an unreadable or missing demo context to the login screen", async ({ page }) => {
    const seen = recordRequests(page);

    await page.goto("./panel?demo=root");
    await expect(page.getByRole("heading", { level: 1, name: "Giriş" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Kokpit" })).toHaveCount(0);

    await page.goto("./panel");
    await expect(page.getByRole("heading", { level: 1, name: "Giriş" })).toBeVisible();
    // The screen explains the publication rather than reporting a failure.
    await expect(page.getByTestId("statik-yayin-uyarisi")).toBeVisible();
    expect(backendCalls(seen)).toEqual([]);
  });

  test("does not scroll sideways, on the demo screen or inside the workspace", async ({
    page,
  }) => {
    const overflow = () =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );

    await page.goto("./giris");
    await expect.poll(overflow, { message: "giriş ekranı yatay taşıyor" }).toBeLessThanOrEqual(0);

    await page.getByRole("button", { name: PROFILES[0].action }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Kokpit" })).toBeVisible();
    await expect.poll(overflow, { message: "kokpit yatay taşıyor" }).toBeLessThanOrEqual(0);
    await expect.poll(() => new URL(page.url()).searchParams.get("demo")).toBe(PROFILES[0].role);

    await page.reload();
    await expect(page.getByText(PROFILES[0].badge)).toBeVisible();
    await expect
      .poll(overflow, { message: "yenilemeden sonra kokpit yatay taşıyor" })
      .toBeLessThanOrEqual(0);
  });
});

test.describe("the static Pages demo persists nothing and closes properly", () => {
  test("writes no demo, session or credential to storage and sets no cookie", async ({ page }) => {
    await enterDemo(page, PROFILES[0].action);
    await expect.poll(() => new URL(page.url()).searchParams.get("demo")).toBe(PROFILES[0].role);
    await page.reload();
    await expect(page.getByText(PROFILES[0].badge)).toBeVisible();

    const stored = await page.evaluate(async () => ({
      local: Object.entries({ ...window.localStorage }),
      session: Object.entries({ ...window.sessionStorage }),
      cookie: document.cookie,
      databases:
        typeof indexedDB.databases === "function"
          ? (await indexedDB.databases()).map((entry) => entry.name ?? "")
          : [],
    }));

    expect(stored.cookie).toBe("");
    expect(stored.session).toEqual([]);
    expect(stored.databases).toEqual([]);
    // The appearance store is the one legitimate writer; nothing it holds may
    // name a role, an address, a password or a session.
    for (const [key, value] of stored.local) {
      expect(`${key} ${String(value)}`).not.toMatch(
        /superadmin|customer|@demo\.|parola|oturum|demo-/iu,
      );
    }
  });

  test("leaving the demo cannot be undone by going back to the same address", async ({ page }) => {
    await enterDemo(page, PROFILES[1].action);
    await expect.poll(() => new URL(page.url()).searchParams.get("demo")).toBe(PROFILES[1].role);
    const demoUrl = page.url();

    await page.getByRole("button", { name: "Çıkış" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Giriş" })).toBeVisible();

    /*
     * Back, into the address the demo was running at, in the same document.
     *
     * What is asserted here is the latch, not a string this test wrote itself.
     * An earlier draft ended on `expect(demoUrl).toContain("demo=customer")` -
     * a claim about a local variable, true whatever the application did. The
     * observable facts are these: the browser really returned to that address,
     * the gate refused to rebuild the demo from it, and it replaced the
     * address with the login screen's own. All three are read off the live
     * page after the navigation.
     */
    await page.goBack();
    await expect(page.getByRole("heading", { level: 1, name: "Giriş" })).toBeVisible();

    await expect
      .poll(() => page.url(), { message: "geri dönüş adresi giriş ekranına taşınmadı" })
      .not.toBe(demoUrl);
    const landed = new URL(page.url());
    expect(landed.pathname).toBe(`${BASE}giris`);
    // The refused demo claim is not carried forward into the login address.
    expect(landed.searchParams.get("demo")).toBeNull();
    expect(landed.search).not.toContain("demo%3Dcustomer");
    // And the demo really is not running: no badge, no workspace, and the
    // static notice - the login surface - is what is on screen.
    await expect(page.getByText(PROFILES[1].badge)).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1, name: "Kokpit" })).toHaveCount(0);
    await expect(page.getByTestId("statik-yayin-uyarisi")).toBeVisible();
  });

  test("never reaches a backend or auth endpoint, whatever the visitor does", async ({ page }) => {
    const seen = recordRequests(page);

    await page.goto("./");
    await page.goto("./programlar");
    await page.goto("./giris");
    // A real sign-in attempt: the form must refuse it without sending it.
    await page.getByLabel(/E-posta/u).fill("biri@ornek.com.tr");
    await page.getByLabel(/Parola/u).fill("cok-guclu-parola-2026");
    await page.getByRole("button", { name: "Giriş yap" }).click();
    await expect(page.getByRole("alert").first()).toBeVisible();

    await page.getByRole("button", { name: PROFILES[0].action }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Kokpit" })).toBeVisible();
    await expect.poll(() => new URL(page.url()).searchParams.get("demo")).toBe(PROFILES[0].role);
    await page.reload();
    await expect(page.getByText(PROFILES[0].badge)).toBeVisible();
    await page.getByRole("button", { name: "Çıkış" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Giriş" })).toBeVisible();

    expect(backendCalls(seen), "statik yayın backend'e istek gönderdi").toEqual([]);
  });

  test("boots under the Pages base path, and its links stay inside it", async ({ page }) => {
    await page.goto("./panel?demo=superadmin");
    await expect(page.getByRole("heading", { level: 1, name: "Kokpit" })).toBeVisible();

    // The published address, not the ordinary deployment's /uygulama/.
    expect(new URL(page.url()).pathname).toBe("/tesvikdestek/uygulama/panel");

    await page.getByRole("link", { name: "Hazırlık" }).first().click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Organizasyon hazırlığı" }),
    ).toBeVisible();
    expect(new URL(page.url()).pathname.startsWith("/tesvikdestek/uygulama/")).toBe(true);
  });
});
