/**
 * Templates in isolation, plus the routes that were not covered by the
 * journeys: auth, wizard, settings, compare, error boundary.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";

import {
  ApprovalForm,
  AuthForm,
  CapabilityMatrix,
  DecisionCompare,
  EligibilityWizard,
  OpsHealth,
  ProfileWorkspace,
  PublicLanding,
  SettingsPanel,
  SourceRegistry,
} from "@/components";
import { emptyProfileValues } from "@/domain/facts";
import { calculateMaturity } from "@/domain/maturity";
import { decisionFixtures, readinessFixture, snapshotFixtures } from "@/mocks/fixtures";
import { renderAppAt } from "./render-app";

function routed(element: React.ReactElement) {
  const router = createMemoryRouter([{ path: "*", element }], { initialEntries: ["/"] });
  return render(<RouterProvider router={router} />);
}

describe("PublicLanding", () => {
  it("warns when nothing has been verified yet", () => {
    routed(<PublicLanding programCount={3} snapshotCount={3} verifiedSnapshotCount={0} />);
    expect(screen.getByText(/hiçbir kaynak henüz uzman doğrulamasından geçmedi/i)).toBeInTheDocument();
  });

  it("drops the warning once sources are verified", () => {
    routed(<PublicLanding programCount={3} snapshotCount={3} verifiedSnapshotCount={3} />);
    expect(screen.queryByText(/hiçbir kaynak henüz/i)).not.toBeInTheDocument();
  });
});

describe("AuthForm", () => {
  it("collects registration fields and submits them", async () => {
    const onSubmit = vi.fn();
    render(<AuthForm mode="register" onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText(/E-posta/), "a@b.com");
    await userEvent.type(screen.getByLabelText(/Parola/), "cok-guclu-parola");
    await userEvent.type(screen.getByLabelText(/Organizasyon/), "Örnek A.Ş.");
    await userEvent.click(screen.getByRole("button", { name: "Hesap oluştur" }));
    expect(onSubmit).toHaveBeenCalledWith({
      eposta: "a@b.com",
      parola: "cok-guclu-parola",
      organizasyon: "Örnek A.Ş.",
    });
  });

  it("omits the organisation field when logging in", () => {
    render(<AuthForm mode="login" onSubmit={vi.fn()} />);
    expect(screen.queryByLabelText(/Organizasyon/)).not.toBeInTheDocument();
  });

  it("announces a submission error", () => {
    render(<AuthForm mode="login" onSubmit={vi.fn()} error="E-posta veya parola hatalı." />);
    expect(screen.getByRole("alert")).toHaveTextContent("E-posta veya parola hatalı.");
  });
});

describe("ProfileWorkspace", () => {
  it("always warns that stored values cannot be read back", () => {
    routed(<ProfileWorkspace defaultValues={emptyProfileValues()} onSubmit={vi.fn()} />);
    expect(screen.getByText(/sunucudan geri okunamıyor/i)).toBeInTheDocument();
  });

  it("submits a tri-state choice with its exact wire value", async () => {
    const onSubmit = vi.fn();
    routed(<ProfileWorkspace defaultValues={emptyProfileValues()} onSubmit={onSubmit} />);
    // The custom select opens rather than exposing native options, so the
    // choice is clicked. The claim is unchanged, and now asserted where it
    // finally matters - on the object that is submitted - rather than on a
    // notification a second store used to consume: the exact wire value
    // travels, and "Bilinmiyor" is never collapsed into "false".
    await userEvent.click(screen.getByRole("combobox", { name: /Sermaye şirketi mi/ }));
    await screen.findByRole("listbox");
    await userEvent.click(screen.getByRole("option", { name: "Evet" }));
    await userEvent.click(screen.getByRole("button", { name: "Profili kaydet" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ is_capital_company: "true" });
  });

  it("surfaces missing facts from the last evaluation", () => {
    routed(
      <ProfileWorkspace
        defaultValues={emptyProfileValues()}
        missingFacts={["nace_code"]}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByRole("heading", { name: /son değerlendirmede eksik/i })).toBeInTheDocument();
  });
});

describe("EligibilityWizard", () => {
  it("walks through its four steps", async () => {
    function Harness() {
      const [step, setStep] = useState(0);
      return (
        <EligibilityWizard
          step={step}
          defaultValues={emptyProfileValues()}
          onStepChange={setStep}
          onFinish={vi.fn()}
        />
      );
    }
    routed(<Harness />);
    expect(screen.getByRole("group", { name: "Nitelik beyanları" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "İleri" }));
    expect(await screen.findByRole("group", { name: "Ölçek" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "İleri" }));
    expect(await screen.findByRole("group", { name: "Sınıflandırma" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "İleri" }));
    expect(await screen.findByRole("heading", { name: "Özet" })).toBeInTheDocument();
    expect(screen.getByText(/0 \/ 12 olgu yanıtlandı/)).toBeInTheDocument();
  });

  it("warns that answers cannot be reloaded", () => {
    routed(
      <EligibilityWizard
        step={0}
        defaultValues={emptyProfileValues()}
        onStepChange={vi.fn()}
        onFinish={vi.fn()}
      />,
    );
    expect(screen.getByText(/önceki cevaplarınız geri yüklenemez/i)).toBeInTheDocument();
  });
});

describe("ApprovalForm", () => {
  it("submits a note under the user approval label", async () => {
    const onSubmit = vi.fn();
    routed(<ApprovalForm onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText(/kullanıcı onayı notu/i), "uygun");
    await userEvent.click(screen.getByRole("button", { name: /olarak kaydet/i }));
    expect(onSubmit).toHaveBeenCalledWith("uygun");
  });
});

describe("SourceRegistry, DecisionCompare, SettingsPanel, OpsHealth", () => {
  it("registry admits the raw text cannot be shown", () => {
    routed(<SourceRegistry snapshots={snapshotFixtures} />);
    expect(screen.getByText(/ham metin bu ekranda gösterilemiyor/i)).toBeInTheDocument();
  });

  it("registry shows an empty state with no snapshots", () => {
    routed(<SourceRegistry snapshots={[]} />);
    // Both the freshness meter and the table area report the emptiness.
    expect(screen.getAllByRole("heading", { name: "Kaynak yok" }).length).toBeGreaterThan(0);
  });

  it("compare carries the disclaimer alongside the grid", () => {
    routed(<DecisionCompare decisions={decisionFixtures} />);
    expect(screen.getByTestId("disclaimer")).toBeInTheDocument();
  });

  it("settings panel renders each section as a card", () => {
    render(
      <SettingsPanel
        title="Görünüm"
        sections={[{ id: "a", title: "Yoğunluk", content: <p>seçenekler</p> }]}
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Yoğunluk" })).toBeInTheDocument();
  });

  it("ops health shows an empty state when the endpoint is unreachable", () => {
    render(<OpsHealth health={null} />);
    expect(screen.getByRole("heading", { name: /sağlık bilgisi okunamadı/i })).toBeInTheDocument();
  });

  it("ops health renders maturity without an aggregate score", () => {
    const maturity = calculateMaturity({
      decisions: decisionFixtures,
      programs: [],
      snapshots: snapshotFixtures,
      health: readinessFixture,
    });
    render(<OpsHealth health={readinessFixture} maturity={maturity} lastCheckedAt="2026-08-14T09:00:00+00:00" />);
    expect(screen.getByText(/tek bir toplam puan yoktur/i)).toBeInTheDocument();
    expect(screen.getByText(/son okuma/i)).toBeInTheDocument();
  });

  it("capability matrix groups capabilities and counts them", () => {
    routed(<CapabilityMatrix />);
    expect(screen.getByRole("heading", { level: 1, name: "Yetenek matrisi" })).toBeInTheDocument();
    // "Başvuru hattı" is both a group heading and a capability title.
    expect(screen.getAllByText("Başvuru hattı").length).toBeGreaterThanOrEqual(2);
  });
});

describe("auth and settings routes", () => {
  it("registration route submits and moves on", async () => {
    await renderAppAt("/kayit");
    await userEvent.type(await screen.findByLabelText(/E-posta/), "yeni@ornek.com.tr");
    await userEvent.type(screen.getByLabelText(/Parola/), "cok-guclu-parola-2026");
    await userEvent.click(screen.getByRole("button", { name: "Hesap oluştur" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Giriş" })).toBeInTheDocument();
  });

  it("login route lands on the dashboard", async () => {
    await renderAppAt("/giris");
    await userEvent.type(await screen.findByLabelText(/E-posta/), "biri@ornek.com.tr");
    await userEvent.type(screen.getByLabelText(/Parola/), "cok-guclu-parola-2026");
    await userEvent.click(screen.getByRole("button", { name: "Giriş yap" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Kokpit" })).toBeInTheDocument();
  });

  it("appearance settings change the document density", async () => {
    await renderAppAt("/ayarlar/gorunum");
    await userEvent.click(await screen.findByRole("radio", { name: /Yoğun/ }));
    expect(document.documentElement.dataset["density"]).toBe("dense");
  });

  it("accessibility settings toggle reduced motion", async () => {
    await renderAppAt("/ayarlar/erisilebilirlik");
    await userEvent.click(await screen.findByRole("switch", { name: "Hareketi azalt" }));
    expect(document.documentElement.dataset["reducedMotion"]).toBe("true");
  });

  it("security settings list what the product does not have", async () => {
    await renderAppAt("/ayarlar/guvenlik");
    expect(await screen.findByText("İki adımlı doğrulama")).toBeInTheDocument();
  });

  it("onboarding explains the limits before offering an account", async () => {
    await renderAppAt("/onboarding");
    await userEvent.click(await screen.findByRole("button", { name: "İleri" }));
    expect(await screen.findByText(/alacağınız parayı hesaplamaz/i)).toBeInTheDocument();
  });

  it("how-it-works lists the four outcomes", async () => {
    await renderAppAt("/nasil-calisir");
    expect(await screen.findByText(/“resmen onaylandı” diye bir sonuç yoktur/i)).toBeInTheDocument();
  });

  it("the wizard route reaches its summary step", async () => {
    await renderAppAt("/uygunluk/sihirbaz");
    await screen.findByRole("heading", { level: 1, name: "Uygunluk sihirbazı" });
    for (let i = 0; i < 3; i += 1) {
      await userEvent.click(screen.getByRole("button", { name: "İleri" }));
    }
    expect(await screen.findByRole("button", { name: "Kaydet ve değerlendir" })).toBeInTheDocument();
  });

  it("the compare route reads ids from the query string", async () => {
    await renderAppAt("/degerlendirmeler/karsilastir?ids=decision-1501,decision-1507");
    expect(await screen.findByRole("table")).toBeInTheDocument();
  });

  it("the source detail route explains the missing body", async () => {
    await renderAppAt("/kaynaklar/snap-tubitak-1501-2026-08-14");
    expect(await screen.findByText(/ham metin gösterilemiyor/i)).toBeInTheDocument();
  });

  it("an unknown source id does not fabricate a source", async () => {
    await renderAppAt("/kaynaklar/yok-boyle-bir-kaynak");
    expect(await screen.findByRole("heading", { name: /kaynak bulunamadı/i })).toBeInTheDocument();
  });

  it("the opportunities route reuses the catalogue", async () => {
    await renderAppAt("/firsatlar");
    expect(await screen.findByRole("heading", { level: 1, name: "Fırsat keşfi" })).toBeInTheDocument();
  });

  it("an opportunity detail renders inside the app shell", async () => {
    await renderAppAt("/firsatlar/TUBITAK-1507");
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(/1507/);
  });
});

/**
 * Heading hierarchy.
 *
 * The decision workspace embeds `DecisionDetail` inside a page that already has
 * its own `h1`. Both rendered an `h1`, so `/degerlendirmeler` announced two
 * document titles - a screen reader user landing there is told the page is
 * called two different things, and the outline has no single root.
 *
 * The same component is also a whole page at `/degerlendirmeler/:id`, where its
 * title is legitimately the `h1`. So the fix is context, not deletion: the page
 * heading stays, and the embedded copy steps down one level.
 */
describe("heading hierarchy is single-rooted on every route", () => {
  it("the decision workspace has exactly one h1", async () => {
    await renderAppAt("/degerlendirmeler");
    await screen.findAllByText("Koşullu");

    const topLevel = screen.getAllByRole("heading", { level: 1 });
    expect(topLevel).toHaveLength(1);
    expect(topLevel[0]).toHaveTextContent("Karar tezgâhı");
  });

  it("the embedded decision title is an h2 under that h1", async () => {
    await renderAppAt("/degerlendirmeler");
    await screen.findAllByText("Koşullu");

    expect(
      screen.getByRole("heading", { level: 2, name: /TÜBİTAK 1501/ }),
    ).toBeInTheDocument();
  });

  it("the standalone decision page keeps its title as the h1", async () => {
    await renderAppAt("/degerlendirmeler/decision-1501");

    const topLevel = await screen.findAllByRole("heading", { level: 1 });
    expect(topLevel).toHaveLength(1);
    expect(topLevel[0]).toHaveTextContent(/TÜBİTAK 1501/);
  });

  it("no route skips a heading level below the decision title", async () => {
    // Standalone: h1 title, so its sections must be h2 - not h3.
    await renderAppAt("/degerlendirmeler/decision-1501");
    await screen.findAllByRole("heading", { level: 1 });

    const levels = screen
      .getAllByRole("heading")
      .map((heading) => Number(heading.tagName.slice(1)))
      .sort((a, b) => a - b);
    const deduped = [...new Set(levels)];
    for (let index = 1; index < deduped.length; index += 1) {
      expect(
        (deduped[index] ?? 0) - (deduped[index - 1] ?? 0),
        `başlık seviyesi atlandı: h${deduped[index - 1]} -> h${deduped[index]}`,
      ).toBeLessThanOrEqual(1);
    }
  });
});
