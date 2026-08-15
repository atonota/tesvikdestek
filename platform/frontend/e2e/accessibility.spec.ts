/**
 * The canonical accessibility sweep [mocked backend].
 *
 * This file exists because the coverage it replaces was a sample presented as a
 * gate. `public.spec.ts` scanned four paths - the landing page, the catalogue,
 * the decision list and the capability matrix - and every one of them is a
 * *reading* surface. None of the eleven authenticated destinations was scanned
 * at all, so the wizard, the profile, the readiness form, the settings screens
 * and the ops health page shipped with no axe evidence of any kind. What that
 * cost, measured on `/uygunluk/sihirbaz` at 320x568: a `scrollable-region-
 * focusable` violation, rated serious, on a step list that scrolled 362 pixels
 * inside a 288 pixel box with nothing focusable in it.
 *
 * Two viewports, because the shell renders two genuinely different documents.
 * At 320x568 the navigation and the assistant are modal sheets and there is a
 * thumb bar; at 1440x900 they are persistent columns and there is neither. A
 * scan at one size is silent about half the components that ship.
 *
 * The gate is critical and serious only. Moderate and minor findings are real
 * and are not being dismissed - they are simply not what this gate blocks on,
 * and saying so here is better than a filter nobody can find. The rule *tags*
 * are the published WCAG sets and are not narrowed to make a route pass: a
 * route that fails is a route that gets fixed.
 */

import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "./mock-api";

/**
 * Every static address the router publishes. All of them.
 *
 * The previous version of this list was eleven authenticated screens and four
 * public ones, chosen because they were the ones the navigation offered. That
 * is a sample dressed as a population, and the gap was not academic: the two
 * settings screens nobody linked to, the comparison view, the registration and
 * login forms and the whole eligibility list were never scanned at either
 * viewport, and two entire subsystems had no route to scan.
 *
 * `src/test/route-registry.test.ts` reads these lists and fails if the router
 * publishes a static address that is not in one of them, so the sample can no
 * longer drift away from the population quietly. Parameterised routes are
 * excluded on purpose - there is no single address to visit - and so are the
 * two section redirects, which render their target and are therefore already
 * covered by it.
 */
const PUBLIC_ROUTES = ["./", "./programlar", "./nasil-calisir", "./onboarding"] as const;

const AUTH_ROUTES = ["./kayit", "./giris"] as const;

const APP_ROUTES = [
  "./panel",
  "./degerlendirmeler",
  "./degerlendirmeler/karsilastir",
  "./firsatlar",
  "./kaynaklar",
  "./organizasyon/hazirlik",
  "./organizasyon/profil",
  "./uygunluk",
  "./uygunluk/sihirbaz",
  "./olgunluk",
  "./operasyon/saglik",
  "./yetenekler",
  "./dosyalar",
  "./ayarlar/gorunum",
  "./ayarlar/erisilebilirlik",
  "./ayarlar/guvenlik",
  "./ayarlar/yapay-zeka",
] as const;

/**
 * The two sizes the requirement names, and the reason the wide one moved.
 *
 * This swept 1280x900, which is close enough to look right and is not the size
 * anybody asked for. 1440 is where this product's desktop layout reaches its
 * widest columns - the persistent context rail, the three-panel decision
 * workspace and the grid's full column set - so a sweep that stops at 1280 is
 * silent about the layout the owner actually specified. `route-registry.test.ts`
 * reads this list and fails if it drifts from 320x568 and 1440x900 again.
 */
const VIEWPORTS = [
  { name: "320x568", width: 320, height: 568 },
  { name: "1440x900", width: 1440, height: 900 },
] as const;

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] as const;

/**
 * The violations, rendered so a failure names the element it is about.
 *
 * A bare rule id sends the reader back to the browser to find out which of
 * fourteen cards it meant. The selector and the failure summary are what make
 * the report actionable, so they travel with it.
 */
function describeViolations(
  violations: readonly { id: string; help: string; impact?: string | null; nodes: readonly { target: unknown[]; failureSummary?: string }[] }[],
): string[] {
  return violations.flatMap((violation) =>
    violation.nodes.map(
      (node) =>
        `${violation.id} (${violation.impact ?? "?"}) at ${node.target.join(" ")}` +
        ` - ${violation.help}` +
        (node.failureSummary ? `: ${node.failureSummary.replace(/\s+/gu, " ").trim()}` : ""),
    ),
  );
}

for (const viewport of VIEWPORTS) {
  test.describe(`accessibility at ${viewport.name} [mocked backend]`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const path of [...PUBLIC_ROUTES, ...AUTH_ROUTES, ...APP_ROUTES]) {
      test(`no critical or serious axe violations on ${path}`, async ({ page }) => {
        await page.goto(path);
        await page.waitForLoadState("networkidle");

        // The route rendered something. An axe pass over a blank error screen is
        // the easiest green in this file to produce by accident.
        await expect(page.getByRole("main")).toBeVisible();

        /*
         * And it rendered the *route*, not a failure surface.
         *
         * "Non-blank" was too weak a bar and had already been cleared by the
         * wrong thing: a route whose data never loaded renders a perfectly
         * accessible error card inside a perfectly accessible shell, and axe is
         * delighted with it. Every path in these lists is expected to succeed
         * against the mocked backend, so an error state here is a broken route
         * reported as a green accessibility run.
         */
        const main = page.getByRole("main");
        await expect(
          main.locator(".dt-state--error"),
          `${path} bir hata durumu render etti; erişilebilirlik taraması anlamsız`,
        ).toHaveCount(0);
        await expect(
          main.getByRole("heading", { name: "Bir şeyler ters gitti" }),
        ).toHaveCount(0);
        await expect(
          main.getByRole("heading", { name: "Sayfa bulunamadı" }),
          `${path} 404 verdi`,
        ).toHaveCount(0);
        await expect(
          main.getByText("Oturum gerekli"),
          `${path} oturum sınırında takıldı`,
        ).toHaveCount(0);

        const results = await new AxeBuilder({ page }).withTags([...WCAG]).analyze();

        // Evidence the scan was real, whatever the outcome: a run that checked
        // nothing would report zero violations and zero passes alike.
        expect(
          results.passes.length,
          `axe checked nothing on ${path} at ${viewport.name}`,
        ).toBeGreaterThan(0);

        const blocking = results.violations.filter((violation) =>
          ["critical", "serious"].includes(violation.impact ?? ""),
        );
        expect(
          describeViolations(blocking),
          `critical/serious erişilebilirlik ihlali - ${path} @ ${viewport.name}`,
        ).toEqual([]);
      });
    }
  });
}
