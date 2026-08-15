/**
 * What every screen says about the source registry when it could not read it.
 *
 * One query - `GET /api/kaynaklar` - feeds five surfaces, and each of them used
 * `?? []` to reach the template. That single fallback turned "nobody could read
 * the registry" into "the registry is empty", and an empty registry is a
 * measurement. The result was not a missing figure; it was a confident wrong
 * one, on the screens where the product makes its strongest claims:
 *
 *   `/`                          "0 kaynak yakalaması, 0 doğrulanmış kaynak"
 *                                and, underneath, "Hiçbir kaynak henüz uzman
 *                                doğrulamasından geçmedi" - an assertion about
 *                                a review process, derived from a failed HTTP
 *                                request.
 *   `/programlar/:code`          the programme's own künye says "Kaynak sayısı
 *   `/firsatlar/:code`           1" while the card below it says "Kaynak
 *                                bulunamadı - bu programın kaynak kayıtları
 *                                kütükte yok". Both sentences on one screen,
 *                                and one of them is false.
 *   `/degerlendirmeler`          the evidence panel renders empty, silently.
 *   `/degerlendirmeler/:id`      "Karar kaynak kimliği taşıyor ama kütükte
 *                                eşleşen kayıt yok", and every citation in the
 *                                rule trace marked as an unknown source.
 *
 * The rule this file pins is one sentence: **an unread registry is not an empty
 * registry, and it is never rendered as one.** A read that did not happen says
 * so, names it as a read failure rather than an absence, and offers a retry -
 * because retrying is the thing that can actually change the answer.
 *
 * Programmes and decisions answer normally throughout. That is the point: this
 * is the partial failure, the one where the page still has plenty to show and
 * the temptation to fill the gap with a zero is strongest.
 */

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { server } from "@/mocks/server";
import { snapshotFixtures } from "@/mocks/fixtures";
import { renderAppAt } from "./render-app";

/** The registry read fails; everything else this product serves is fine. */
function unreadableSourceRegistry(status = 502): void {
  server.use(http.get("/api/kaynaklar", () => new HttpResponse(null, { status })));
}

/**
 * The registry fails once, then answers.
 *
 * Used to prove the retry is a real retry rather than a button that re-renders
 * the same failure - a distinction no static assertion can make.
 */
function unreadableUntilRetried(): void {
  let attempts = 0;
  server.use(
    http.get("/api/kaynaklar", () => {
      attempts += 1;
      if (attempts === 1) return new HttpResponse(null, { status: 502 });
      return HttpResponse.json(snapshotFixtures);
    }),
  );
}

/** The sentence a failed read must never produce, in any of its shapes. */
const FALSE_ABSENCE = /kütükte yok|Kaynak bulunamadı|Kaynak kaydı bulunamadı|Hiçbir kaynak/u;

/* --------------------------------------------------------------- landing */

describe("the public landing page counts nothing it did not read", () => {
  it("says the registry could not be read instead of showing zero", async () => {
    unreadableSourceRegistry();
    await renderAppAt("/");

    const card = (await screen.findByText("Bugün depoda ne var")).closest(".dt-card");
    expect(card).not.toBeNull();
    const text = card?.textContent ?? "";

    expect(text, "okunamayan kütük sıfır olarak gösterildi").not.toMatch(/\b0\b/u);
    expect(text).toContain("okunamadı");
    // The programme catalogue arrived, so its figure is a real measurement and
    // must survive: this is a partial failure, not a blank page.
    expect(text).toContain("3");
  });

  it("makes no claim about expert review from a request that failed", async () => {
    unreadableSourceRegistry();
    await renderAppAt("/");
    await screen.findByText("Bugün depoda ne var");

    expect(document.body.textContent ?? "").not.toMatch(FALSE_ABSENCE);
  });

  it("offers a retry, because retrying is what can change the answer", async () => {
    unreadableSourceRegistry();
    await renderAppAt("/");
    await screen.findByText("Bugün depoda ne var");

    expect(screen.getByRole("button", { name: "Tekrar dene" })).toBeInTheDocument();
  });

  it("shows the real figures once the retry succeeds", async () => {
    unreadableUntilRetried();
    await renderAppAt("/");
    await screen.findByText("Bugün depoda ne var");

    await userEvent.click(screen.getByRole("button", { name: "Tekrar dene" }));

    const card = await screen.findByText("Bugün depoda ne var");
    const holder = card.closest(".dt-card") as HTMLElement;
    // Three programmes and three captures: the registry read that failed the
    // first time produced its real figure the second time.
    expect(await within(holder).findAllByText("3")).toHaveLength(2);
    expect(holder.textContent).not.toContain("okunamadı");
  });
});

/* ------------------------------------------------------- programme detail */

describe.each([
  ["/programlar/KOSGEB-GIRISIMCI", "kamu"],
  ["/firsatlar/KOSGEB-GIRISIMCI", "çalışma alanı"],
])("%s contradicts itself about sources no longer (%s)", (path) => {
  it("keeps the programme's own source count and refuses to call the sources absent", async () => {
    unreadableSourceRegistry();
    await renderAppAt(path);
    await screen.findByRole("heading", { level: 1, name: /KOSGEB/u });

    // The count comes from the programme record, which arrived.
    const identity = (await screen.findByText("Künye")).closest(".dt-card");
    expect(identity?.textContent).toContain("Kaynak sayısı");
    expect(identity?.textContent).toContain("1");

    // And the card below it must not answer the same question differently.
    expect(document.body.textContent ?? "", "aynı ekranda çelişen iki cümle").not.toMatch(
      FALSE_ABSENCE,
    );
  });

  it("names the failed read and offers a retry in the sources card", async () => {
    unreadableSourceRegistry();
    await renderAppAt(path);
    await screen.findByRole("heading", { level: 1, name: /KOSGEB/u });

    const sources = (await screen.findByText("Dayandığı kaynaklar")).closest(
      ".dt-card",
    ) as HTMLElement;
    expect(within(sources).getByText(/okunamadı/u)).toBeInTheDocument();
    expect(within(sources).getByRole("button", { name: "Tekrar dene" })).toBeInTheDocument();
  });
});

/* ------------------------------------------------------- decision surfaces */

describe("the decision workspace shows no evidence it could not read", () => {
  it("gates the evidence panel with a named failure instead of leaving it empty", async () => {
    unreadableSourceRegistry();
    await renderAppAt("/degerlendirmeler");
    await screen.findByRole("heading", { name: "Karar tezgâhı" });

    const evidence = screen.getByRole("region", { name: "Kanıt" });
    expect(within(evidence).getByText(/okunamadı/u)).toBeInTheDocument();
    expect(within(evidence).getByRole("button", { name: "Tekrar dene" })).toBeInTheDocument();
    expect(evidence.textContent ?? "").not.toMatch(FALSE_ABSENCE);
  });
});

describe("a single decision never reports its evidence as absent or unknown", () => {
  const DECISION = "/degerlendirmeler/decision-1501";

  it("refuses to say the cited snapshot is missing from the registry", async () => {
    unreadableSourceRegistry();
    await renderAppAt(DECISION);
    await screen.findByRole("heading", { level: 1 });

    await userEvent.click(screen.getByRole("tab", { name: "Kanıt" }));

    expect(document.body.textContent ?? "").not.toMatch(FALSE_ABSENCE);
    expect(screen.getByText(/okunamadı/u)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tekrar dene" })).toBeInTheDocument();
  });

  it("marks no citation as an unknown source when the registry was never read", async () => {
    unreadableSourceRegistry();
    await renderAppAt(DECISION);
    await screen.findByRole("heading", { level: 1 });

    await userEvent.click(screen.getByRole("tab", { name: "Kural izi" }));

    expect(
      document.querySelectorAll(".dt-citation--unknown").length,
      "okunamayan kütük, kaynağı 'bulunamadı' yapmaz",
    ).toBe(0);
    expect(screen.getByRole("button", { name: "Tekrar dene" })).toBeInTheDocument();
  });

  it("still shows the parts of the decision that do not depend on the registry", async () => {
    unreadableSourceRegistry();
    await renderAppAt(DECISION);
    await screen.findByRole("heading", { level: 1 });

    // The outcome and its reasons come from the decision itself. A registry
    // failure must not take them down with it.
    expect(screen.getByText("Koşullu")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Gerekçe" }));
    expect(screen.getByText("Gerekçeler")).toBeInTheDocument();
  });
});
