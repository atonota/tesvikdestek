/**
 * Integration journeys against MSW, exercising the real router and the real
 * API client - including the CSRF handshake the backend actually requires.
 */

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { server } from "@/mocks/server";
import { renderAppAt } from "./render-app";

describe("public journeys", () => {
  it("landing shows the real catalogue counts and the disclaimer", async () => {
    await renderAppAt("/");
    expect(await screen.findByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByTestId("disclaimer")).toBeInTheDocument();
  });

  it("catalogue lists the three seeded programmes", async () => {
    await renderAppAt("/programlar");
    expect(await screen.findByText(/TÜBİTAK 1501/)).toBeInTheDocument();
    expect(screen.getByText(/KOSGEB Girişimci/)).toBeInTheDocument();
  });

  it("filters the catalogue down to nothing and says so", async () => {
    await renderAppAt("/programlar");
    await screen.findByText(/TÜBİTAK 1501/);
    await userEvent.type(screen.getByLabelText("Ara"), "böyle-bir-program-yok");
    expect(await screen.findByRole("heading", { name: /eşleşen program yok/i })).toBeInTheDocument();
  });

  it("programme detail shows sources and no invented amount", async () => {
    await renderAppAt("/programlar/TUBITAK-1501");
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(/1501/);
    expect(screen.getAllByText(/yayımlanmış üst limit bilgisi yok/i).length).toBeGreaterThan(0);
  });

  it("an unknown programme code does not pretend the programme exists", async () => {
    await renderAppAt("/programlar/YOK-BOYLE-BIR-SEY");
    expect(await screen.findByRole("heading", { name: /program bulunamadı/i })).toBeInTheDocument();
  });
});

describe("decision workspace journeys", () => {
  it("lists decisions with their four-valued outcomes", async () => {
    await renderAppAt("/degerlendirmeler");
    // The responsive table renders both the mobile card list and the desktop
    // table; CSS shows exactly one. In jsdom both are present, so match all.
    expect((await screen.findAllByText("Koşullu")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Yetersiz veri").length).toBeGreaterThan(0);
  });

  it("decision detail shows the rule trace and the hash pair", async () => {
    await renderAppAt("/degerlendirmeler/decision-1501");
    await screen.findByRole("heading", { level: 1 });

    await userEvent.click(screen.getByRole("tab", { name: "Kural izi" }));
    expect(await screen.findByRole("table")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Kanıt" }));
    expect(await screen.findByText("Karar özeti")).toBeInTheDocument();
  });

  it("every decision surface carries the disclaimer", async () => {
    await renderAppAt("/degerlendirmeler/decision-1501");
    expect(await screen.findByTestId("disclaimer")).toBeInTheDocument();
  });

  it("records a user approval with the exact label", async () => {
    await renderAppAt("/degerlendirmeler/decision-1501");
    await screen.findByRole("heading", { level: 1 });
    await userEvent.click(screen.getByRole("tab", { name: "Kullanıcı onayı" }));

    const note = await screen.findByLabelText(/kullanıcı onayı notu/i);
    await userEvent.type(note, "İç değerlendirmede uygun bulundu.");
    await userEvent.click(screen.getByRole("button", { name: /olarak kaydet/i }));

    await waitFor(() => {
      expect(screen.getByText(/bu oturumdaki kullanıcı/i)).toBeInTheDocument();
    });
  });

  it("a 404 from the decision endpoint surfaces as an honest error", async () => {
    await renderAppAt("/degerlendirmeler/yok-boyle-bir-karar");
    expect(await screen.findByRole("alert")).toHaveTextContent(/bulunamadı/i);
  });
});

describe("readiness and maturity journeys", () => {
  it("readiness derives missing facts from the decisions themselves", async () => {
    await renderAppAt("/organizasyon/hazirlik");
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(
      "Organizasyon hazırlığı",
    );
    expect(screen.getByRole("link", { name: "NACE kodu" })).toBeInTheDocument();
  });

  it("maturity shows seven dimensions and refuses a single score", async () => {
    await renderAppAt("/olgunluk");
    await screen.findByRole("heading", { level: 1 });
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(7);
    expect(screen.getByText(/tek bir toplam puan yoktur/i)).toBeInTheDocument();
  });

  it("profile says its stored values cannot be read back", async () => {
    await renderAppAt("/organizasyon/profil");
    expect(await screen.findByText(/sunucudan geri okunamıyor/i)).toBeInTheDocument();
  });
});

describe("operations and capability journeys", () => {
  it("health renders the real readiness payload", async () => {
    await renderAppAt("/operasyon/saglik");
    expect(await screen.findByText("Hazır")).toBeInTheDocument();
    expect(screen.getByText("disabled")).toBeInTheDocument();
  });

  it("says plainly that the AI provider is off", async () => {
    await renderAppAt("/operasyon/saglik");
    expect(await screen.findByText(/yapay zekâ üretimi hiçbir yerde/i)).toBeInTheDocument();
  });

  it("capability matrix marks every blocked capability as unavailable", async () => {
    await renderAppAt("/yetenekler");
    await screen.findByRole("heading", { level: 1 });
    // One disabled control per blocked capability. The label also appears once
    // more in the summary counts, which is why the buttons are what is counted.
    const unavailable = screen.getAllByRole("button", { name: "Kullanılamıyor" });
    expect(unavailable).toHaveLength(15);
    for (const button of unavailable) {
      expect(button).toBeDisabled();
    }
  });

  it("shows no AI badge anywhere in the shell", async () => {
    await renderAppAt("/panel");
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByText(/yapay zekâ açıklaması/i)).not.toBeInTheDocument();
  });
});

describe("failure journeys", () => {
  it("a server error becomes a retryable error state, not a blank page", async () => {
    server.use(http.get("/api/programlar", () => new HttpResponse(null, { status: 500 })));
    await renderAppAt("/programlar");
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/sunucu tarafında bir hata/i)).toBeInTheDocument();
    expect(within(alert).getByRole("button", { name: "Tekrar dene" })).toBeInTheDocument();
  });

  it("a contract violation is refused at the boundary rather than rendered", async () => {
    server.use(
      http.get("/api/programlar", () =>
        HttpResponse.json([{ code: "X", beklenmeyen_alan: true }]),
      ),
    );
    await renderAppAt("/programlar");
    expect(await screen.findByRole("alert")).toHaveTextContent(/sözleşmeye uymuyor/i);
  });

  it("an unknown route renders the not-found surface", async () => {
    await renderAppAt("/hicbir-yer");
    expect(await screen.findByRole("heading", { name: /sayfa bulunamadı/i })).toBeInTheDocument();
  });
});
