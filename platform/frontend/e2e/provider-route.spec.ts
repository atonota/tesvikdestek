/**
 * `/ayarlar/yapay-zeka` in a real browser, at both sizes [mocked backend].
 *
 * Three claims here can only be settled by a browser, and each of them is the
 * kind that would be embarrassing to get wrong on a credential screen:
 *
 *   1. **No secret input exists.** Asserted against the live DOM rather than a
 *      render tree, because the thing that matters is what a password manager
 *      and a keylogger would find on the page.
 *   2. **Nothing is requested.** A connection centre that quietly probes a
 *      vendor - or ships a key somewhere on blur - is the failure mode; the
 *      only honest number of outbound requests is zero.
 *   3. **The subsystem is lazy.** 38.73 kB of catalogue, wizard and inventory
 *      must not be in the chunk every signed-in visitor downloads on the way to
 *      the dashboard. The network log is the proof, not the bundler's report.
 */

import type { Page } from "@playwright/test";

import { expect, test } from "./mock-api";

const ROUTE = "./ayarlar/yapay-zeka";

const PROVIDERS = ["Google Gemini", "OpenAI / ChatGPT", "Claude", "OpenClaw"] as const;

const VIEWPORTS = [
  { name: "320x568", width: 320, height: 568 },
  { name: "1440x900", width: 1440, height: 900 },
] as const;

const MAX_RADIUS_PX = 12;

/** Same rule and same single exception as the file library's spec. */
async function oversizedRadii(
  page: Page,
): Promise<{ selector: string; radius: string }[]> {
  return page.evaluate((ceiling) => {
    const describe = (element: Element): string => {
      const tag = element.tagName.toLowerCase();
      const classes = typeof element.className === "string" ? element.className : "";
      return classes ? `${tag}.${classes.trim().split(/\s+/u).join(".")}` : tag;
    };

    const offenders: { selector: string; radius: string }[] = [];
    for (const element of Array.from(document.querySelectorAll("*"))) {
      if (element.matches('input[type="search"]')) continue;
      const style = getComputedStyle(element);
      for (const corner of [
        style.borderTopLeftRadius,
        style.borderTopRightRadius,
        style.borderBottomLeftRadius,
        style.borderBottomRightRadius,
      ]) {
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
  test.describe(`provider centre at ${viewport.name} [mocked backend]`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test("lists exactly the four providers the requirement names", async ({ page }) => {
      await page.goto(ROUTE);
      await page.waitForLoadState("networkidle");

      await expect(
        page.getByRole("heading", { level: 1, name: "Yapay zekâ sağlayıcıları" }),
      ).toBeVisible();

      const catalogue = page.getByRole("region", { name: "Sağlayıcı kataloğu" });
      for (const name of PROVIDERS) {
        await expect(catalogue.getByRole("heading", { name })).toBeVisible();
      }
      /*
       * Every method disabled, with a reason, and none offered.
       *
       * `exact` on both, and it is load-bearing rather than tidy: Playwright's
       * default text match is a case-insensitive substring, and the catalogue's
       * own intro sentence contains the phrase "kullanılabilir gösterilmez" -
       * a denial. Without `exact` this assertion reads the sentence that says
       * nothing is offered as evidence that something is.
       */
      await expect(catalogue.getByText("Kullanılabilir", { exact: true })).toHaveCount(0);
      expect(
        await catalogue.getByText("Kullanılamaz", { exact: true }).count(),
      ).toBeGreaterThan(0);
    });

    test("puts no secret field and no live connect control on the page", async ({ page }) => {
      await page.goto(ROUTE);
      await page.waitForLoadState("networkidle");

      await expect(page.locator('input[type="password"]')).toHaveCount(0);
      await expect(page.getByRole("button", { name: /Bağlantı isteği oluştur/u })).toHaveCount(0);
      // And nothing anywhere claims a connection exists.
      await expect(page.getByText("Bağlandı", { exact: true })).toHaveCount(0);
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

    test("does not scroll sideways", async ({ page }) => {
      await page.goto(ROUTE);
      await page.waitForLoadState("networkidle");

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${ROUTE} @ ${viewport.name} yatay taşma`).toBeLessThanOrEqual(0);
    });

    test("is reachable from the persistent settings navigation", async ({ page }) => {
      await page.goto("./ayarlar/gorunum");
      await page.waitForLoadState("networkidle");

      await page
        .getByRole("navigation", { name: "Ayarlar bölümleri" })
        .getByRole("link", { name: "Yapay zekâ" })
        .click();
      await expect(
        page.getByRole("heading", { level: 1, name: "Yapay zekâ sağlayıcıları" }),
      ).toBeVisible();
    });
  });
}

test.describe("the provider centre talks to nothing [mocked backend]", () => {
  test("issues no request while the wizard is driven", async ({ page }) => {
    await page.goto(ROUTE);
    await page.waitForLoadState("networkidle");

    const afterLoad: string[] = [];
    page.on("request", (request) => afterLoad.push(request.url()));

    const wizard = page.getByRole("region", { name: "Sağlayıcı bağlantı sihirbazı" });
    // `click`, not `check`: selecting a provider *is* the step, so the machine
    // moves on and the radio this locator named no longer exists for `check`
    // to verify afterwards.
    await wizard.getByRole("radio", { name: "Claude" }).click();
    await expect(wizard.getByRole("group", { name: /Claude için bağlantı yöntemi/u })).toBeVisible();
    await wizard.getByRole("button", { name: "Geri" }).click();
    await page.waitForTimeout(250);

    expect(afterLoad, "sihirbaz ağa çıktı").toEqual([]);
  });

  test("ships its 38 kB in a chunk the dashboard never fetches", async ({ page }) => {
    const fetched: string[] = [];
    page.on("request", (request) => fetched.push(request.url()));

    await page.goto("./panel");
    await page.waitForLoadState("networkidle");
    const eager = fetched.filter((url) => /\/assets\/providers-[\w.-]+\.(?:js|css)$/u.test(url));
    expect(eager, "kokpit sağlayıcı parçasını indirdi").toEqual([]);

    await page.goto(ROUTE);
    await page.waitForLoadState("networkidle");
    const lazy = fetched.filter((url) => /\/assets\/providers-[\w.-]+\.(?:js|css)$/u.test(url));
    // Both halves: the JavaScript and its stylesheet travel together, and only
    // to the operator who opened this route.
    expect(lazy.filter((url) => url.endsWith(".js")).length).toBeGreaterThan(0);
    expect(lazy.filter((url) => url.endsWith(".css")).length).toBeGreaterThan(0);
  });
});
