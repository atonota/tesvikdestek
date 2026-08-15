import { expect, test } from "./mock-api";

/**
 * The claims this product must never make, checked in a real browser.
 */

test.describe("capability truth [mocked backend]", () => {
  test("every blocked capability is disabled and labelled", async ({ page }) => {
    await page.goto("./yetenekler");
    await page.waitForLoadState("networkidle");

    const unavailable = page.getByRole("button", { name: "Kullanılamıyor" });
    await expect(unavailable).toHaveCount(15);
    for (const button of await unavailable.all()) {
      await expect(button).toBeDisabled();
    }
    await expect(page.getByText("Backend yeteneği gerekli").first()).toBeVisible();
  });

  test("no approval or entitlement language appears anywhere on the decision surfaces", async ({
    page,
  }) => {
    for (const path of ["./degerlendirmeler", "./degerlendirmeler/decision-1501", "./panel"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const text = ((await page.locator("body").textContent()) ?? "").toLocaleLowerCase("tr");
      expect(text, `${path} onay iddiası içeriyor`).not.toContain("onaylandı");
      expect(text, `${path} hak iddiası içeriyor`).not.toContain("hak kazan");
      expect(text, `${path} tutar iddiası içeriyor`).not.toContain("alacağınız tutar");
    }
  });

  test("the decision detail always carries the disclaimer", async ({ page }) => {
    await page.goto("./degerlendirmeler/decision-1501");
    await expect(page.getByTestId("disclaimer")).toBeVisible();
  });

  test("no AI badge is rendered while the provider is disabled", async ({ page }) => {
    await page.goto("./operasyon/saglik");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("disabled")).toBeVisible();
    await expect(page.getByText(/yapay zekâ açıklaması/i)).toHaveCount(0);
  });

  test("a call window that is unknown never renders as open", async ({ page }) => {
    await page.goto("./programlar");
    await page.waitForLoadState("networkidle");
    // Scoped to the badge: the filter <select> also contains a "Bilinmiyor"
    // option, which is not what this test is about.
    const badges = page.locator(".dt-badge");
    await expect(badges.filter({ hasText: "Bilinmiyor" }).first()).toBeVisible();
    await expect(badges.filter({ hasText: /^Açık$/ })).toHaveCount(0);
  });
});

test.describe("decision workspace [mocked backend]", () => {
  test("opens a decision, reads its trace and records a user approval", async ({ page }) => {
    await page.goto("./degerlendirmeler/decision-1501");
    await page.waitForLoadState("networkidle");

    await page.getByRole("tab", { name: "Kural izi" }).click();
    // The trace is a table on desktop and a card list on mobile, by design;
    // both are in the DOM and CSS shows exactly one. Assert that whichever is
    // shown carries the content, rather than assuming a presentation.
    await expect(
      page.getByText("Sermaye şirketi mi?").filter({ visible: true }).first(),
    ).toBeVisible();

    await page.getByRole("tab", { name: "Kanıt" }).click();
    await expect(page.getByText("Karar özeti")).toBeVisible();

    await page.getByRole("tab", { name: "Kullanıcı onayı" }).click();
    await page.getByLabel(/Kullanıcı onayı notu/).fill("İç değerlendirmede uygun bulundu.");
    await page.getByRole("button", { name: /olarak kaydet/ }).click();
    await expect(page.getByText(/bu oturumdaki kullanıcı/i)).toBeVisible();
  });
});
