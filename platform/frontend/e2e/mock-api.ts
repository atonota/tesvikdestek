/**
 * Backend fixtures for the browser tests.
 *
 * Playwright's own request routing is used rather than a service worker: the
 * worker's scope, the Vite preview proxy and the first-load registration race
 * all interact badly, and none of that is what these tests are about. Routing
 * is deterministic and installed before the first navigation.
 *
 * The payloads are the same fixtures the unit suite uses, which are in turn the
 * shapes the real seeded backend returns.
 */

import { test as base, type Page } from "@playwright/test";

import {
  decisionFixtures,
  programFixtures,
  readinessFixture,
  snapshotFixtures,
} from "../src/mocks/fixtures";

export async function mockBackend(page: Page): Promise<void> {
  await page.route("**/api/programlar", (route) => route.fulfill({ json: programFixtures }));
  await page.route("**/api/kaynaklar", (route) => route.fulfill({ json: snapshotFixtures }));
  await page.route("**/api/csrf", (route) =>
    route.fulfill({ json: { csrf_token: "e2e-signed-token" } }),
  );
  await page.route("**/hazir", (route) => route.fulfill({ json: readinessFixture }));

  await page.route("**/api/degerlendirmeler", (route) =>
    route.fulfill({ json: decisionFixtures }),
  );
  await page.route("**/api/degerlendirmeler/*", (route) => {
    const id = new URL(route.request().url()).pathname.split("/").pop();
    const found = decisionFixtures.find((decision) => decision.id === id);
    return found
      ? route.fulfill({ json: found })
      : route.fulfill({ status: 404, json: { detail: "Karar bulunamadi." } });
  });

  await page.route("**/degerlendirmeler/*/onay", (route) => route.fulfill({ status: 200, body: "" }));
  for (const path of ["kayit", "giris", "cikis", "profil"]) {
    await page.route(`**/${path}`, (route) =>
      route.request().method() === "POST"
        ? route.fulfill({ status: 200, body: "" })
        : route.continue(),
    );
  }
}

/** Every spec gets the mocked backend installed before it navigates. */
export const test = base.extend({
  page: async ({ page }, use) => {
    await mockBackend(page);
    await use(page);
  },
});

export { expect } from "@playwright/test";
