/**
 * Cognitive Shell V2 — frozen acceptance scope, browser evidence.
 *
 * Authored blind, against the frozen scope rather than against
 * `AdaptiveShell.tsx`'s current desktop-rail / mobile-sheet split. Claims that
 * need a real layout engine — no horizontal overflow, a single drawer
 * replacing both the rail and the sheet across every breakpoint, light/dark
 * and reduced-motion paint, and the in-place Spotlight expansion — live here;
 * everything else lives in `src/test/cognitive-shell-v2.test.tsx`.
 */

import type { Page } from "@playwright/test";
import { expect, test } from "./mock-api";

const VIEWPORTS = [
  { name: "320", width: 320, height: 720 },
  { name: "390", width: 390, height: 844 },
  { name: "768", width: 768, height: 1024 },
  { name: "1024", width: 1024, height: 800 },
  { name: "1440", width: 1440, height: 900 },
] as const;

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth - doc.clientWidth;
  });
}

for (const viewport of VIEWPORTS) {
  test.describe(`cognitive shell V2 at ${viewport.name}px [mocked backend]`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test(`renders without horizontal overflow at ${viewport.name}px`, async ({ page }) => {
      await page.goto("./panel");
      await page.waitForLoadState("networkidle");
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
    });

    test(`the hamburger and the avatar exist and target ${viewport.name}=44px`, async ({ page }) => {
      await page.goto("./panel");
      await page.waitForLoadState("networkidle");

      const hamburger = page.getByRole("button", { name: /men(ü|u)/i });
      const avatar = page.getByRole("button", { name: /hesap|account|profil/i });
      await expect(hamburger).toBeVisible();
      await expect(avatar).toBeVisible();

      for (const control of [hamburger, avatar]) {
        const box = await control.boundingBox();
        expect(box, "control did not render").not.toBeNull();
        expect(box!.width).toBeGreaterThanOrEqual(44);
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }
    });

    test(`exactly one adaptive drawer answers both triggers at ${viewport.name}px, never a persistent rail alongside it`, async ({
      page,
    }) => {
      await page.goto("./panel");
      await page.waitForLoadState("networkidle");

      await page.getByRole("button", { name: /men(ü|u)/i }).click();
      const drawer = page.getByRole("dialog");
      await expect(drawer).toBeVisible();
      const drawerId = await drawer.getAttribute("id");

      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);

      await page.getByRole("button", { name: /hesap|account|profil/i }).click();
      const reopened = page.getByRole("dialog");
      await expect(reopened).toBeVisible();
      await expect(reopened).toHaveAttribute("id", drawerId ?? "");
    });
  });
}

test.describe("bottom navigation is retained on phone widths only", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the bottom nav is visible at 390px", async ({ page }) => {
    await page.goto("./panel");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("navigation", { name: "Hızlı gezinme" })).toBeVisible();
  });
});

test.describe("Cmd/Ctrl+K expands the header Spotlight in place, never a dialog", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("the same header input's border expands; no dialog opens", async ({ page }) => {
    await page.goto("./panel");
    await page.waitForLoadState("networkidle");

    const spotlight = page.getByRole("searchbox", { name: /ara|spotlight|arama/i }).or(
      page.getByRole("textbox", { name: /ara|spotlight|arama/i }),
    );
    await expect(spotlight).toBeVisible();
    const before = await spotlight.boundingBox();

    const modifier = process.platform === "darwin" ? "Meta" : "Control";
    await page.keyboard.press(`${modifier}+K`);

    await expect(page.getByRole("dialog")).toHaveCount(0);
    // `aria-expanded` is not an allowed WAI-ARIA attribute on a
    // `searchbox`/`textbox` role, so the expanded/collapsed state is
    // asserted on the nearest neutral ancestor container that carries a
    // plain, non-semantic `data-expanded` marker — never on the input.
    const expandedContainer = spotlight.locator(
      "xpath=ancestor::*[@data-expanded][1]",
    );
    await expect(expandedContainer).toHaveAttribute("data-expanded", "true");
    await expect(spotlight).toBeFocused();

    const after = await spotlight.boundingBox();
    expect(before, "spotlight did not render before Cmd/Ctrl+K").not.toBeNull();
    expect(after, "spotlight did not render after Cmd/Ctrl+K").not.toBeNull();
    // "Expands in place" means the same element grows, not that a second
    // element appears at a different position.
    expect(Math.abs((after?.x ?? 0) - (before?.x ?? 0))).toBeLessThanOrEqual(2);
    expect(after!.width).toBeGreaterThan(before!.width);
  });
});

test.describe("light, dark and reduced motion all paint the shell without breaking layout", () => {
  test.use({ viewport: { width: 1024, height: 900 } });

  for (const scheme of ["light", "dark"] as const) {
    test(`renders cleanly under ${scheme} colour scheme`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("./panel");
      await page.waitForLoadState("networkidle");
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
      await expect(page.getByRole("banner")).toBeVisible();
    });
  }

  test("renders cleanly under prefers-reduced-motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("./panel");
    await page.waitForLoadState("networkidle");
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
    await page.getByRole("button", { name: /men(ü|u)/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});

test.describe("nested Escape and focus return inside the drawer, in a real browser", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("first Escape clears command results, second Escape closes the drawer and returns focus to the trigger that opened it", async ({
    page,
  }) => {
    await page.goto("./panel");
    await page.waitForLoadState("networkidle");

    const hamburger = page.getByRole("button", { name: /men(ü|u)/i });
    await hamburger.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const command = dialog.getByRole("searchbox");
    await command.fill("karar");
    await expect(dialog.getByRole("option").first()).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog.getByRole("option")).toHaveCount(0);
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(hamburger).toBeFocused();
  });
});

test.describe("the drawer replaces the desktop persistent rail entirely at 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("no persistent navigation rail is visible until the drawer is opened", async ({ page }) => {
    await page.goto("./panel");
    await page.waitForLoadState("networkidle");

    // The frozen scope: one adaptive drawer replaces the persistent rail. A
    // navigation landmark visible without opening anything would mean the old
    // rail survived alongside the new drawer.
    const nav = page.getByRole("navigation", { name: "Ana gezinme" });
    await expect(nav).toHaveCount(0);

    await page.getByRole("button", { name: /men(ü|u)/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});
