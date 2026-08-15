import { render, screen, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { decisionFixtures, programFixtures, snapshotFixtures } from "@/mocks/fixtures";
import { calculateMaturity } from "@/domain/maturity";
import { USER_APPROVAL_LABEL } from "@/domain/outcomes";
import {
  ApprovalRecordCard,
  BackendCapabilityGate,
  CallWindowBadge,
  CitationChip,
  DecisionCompareGrid,
  DecisionHashPair,
  MaturityRadar,
  MissingFactsPanel,
  MoneyStateLabel,
  OutcomeBadge,
  OutcomeDistribution,
  PredicateTraceTable,
  ProgramCard,
  ReasonList,
  RequiredDocumentsChecklist,
  ReviewStatusBadge,
  RuleTree,
  SourceFreshnessMeter,
  SourceSnapshotCard,
} from "./domain";

function routed(element: React.ReactElement) {
  const router = createMemoryRouter([{ path: "/", element }], { initialEntries: ["/"] });
  return render(<RouterProvider router={router} />);
}

describe("OutcomeBadge", () => {
  it.each([
    ["candidate_eligible", "Aday uygunluk"],
    ["conditional", "Koşullu"],
    ["ineligible", "Uygun değil"],
    ["insufficient_data", "Yetersiz veri"],
  ])("renders %s as %s", (outcome, label) => {
    render(<OutcomeBadge outcome={outcome} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("never renders an approval word for any outcome", () => {
    for (const outcome of ["candidate_eligible", "conditional", "ineligible", "insufficient_data"]) {
      const { container, unmount } = render(<OutcomeBadge outcome={outcome} />);
      expect(container.textContent?.toLocaleLowerCase("tr")).not.toContain("onaylandı");
      unmount();
    }
  });

  it("shows the raw code for an unknown outcome instead of guessing", () => {
    render(<OutcomeBadge outcome="beklenmeyen_deger" />);
    expect(screen.getByText("beklenmeyen_deger")).toBeInTheDocument();
  });
});

describe("OutcomeDistribution", () => {
  it("counts decisions per outcome and never sums money", () => {
    render(<OutcomeDistribution decisions={decisionFixtures} />);
    expect(screen.getByText("Koşullu")).toBeInTheDocument();
    expect(screen.getByText("Yetersiz veri")).toBeInTheDocument();
    expect(screen.queryByText(/₺|TL\b/u)).not.toBeInTheDocument();
  });

  it("shows an empty state with no decisions", () => {
    render(<OutcomeDistribution decisions={[]} />);
    expect(screen.getByRole("heading", { name: /sonuç yok/i })).toBeInTheDocument();
  });
});

describe("ReasonList and MissingFactsPanel", () => {
  it("translates reason codes to Turkish labels", () => {
    render(<ReasonList reasons={["call_window_unknown"]} />);
    expect(screen.getByText("Çağrı penceresi bilinmiyor")).toBeInTheDocument();
  });

  it("says so plainly when nothing is missing", () => {
    render(<MissingFactsPanel missingFacts={[]} />);
    expect(screen.getByText(/eksik olgu yok/i)).toBeInTheDocument();
  });

  it("deep-links each missing fact to the profile field", () => {
    routed(<MissingFactsPanel missingFacts={["nace_code"]} />);
    expect(screen.getByRole("link", { name: "NACE kodu" })).toHaveAttribute(
      "href",
      "/organizasyon/profil#nace_code",
    );
  });
});

describe("PredicateTraceTable", () => {
  it("renders a captioned table with scoped headers", () => {
    routed(<PredicateTraceTable traces={decisionFixtures[0]!.traces} />);
    const table = screen.getByRole("table");
    expect(within(table).getByText(/kural izi/i)).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader").length).toBeGreaterThanOrEqual(6);
  });

  it("shows an empty state rather than an empty table", () => {
    routed(<PredicateTraceTable traces={[]} />);
    expect(screen.getByRole("heading", { name: /kural izi yok/i })).toBeInTheDocument();
  });

  it("renders an unknown result as Bilinmiyor, not as failure", () => {
    routed(<PredicateTraceTable traces={decisionFixtures[1]!.traces} />);
    expect(screen.getAllByText("Bilinmiyor").length).toBeGreaterThan(0);
  });
});

describe("RuleTree", () => {
  it("says the tree cannot be read rather than drawing a plausible one", () => {
    render(<RuleTree root={null} />);
    expect(screen.getByText(/okunamıyor/i)).toBeInTheDocument();
  });

  it("renders a nested structure when given one", () => {
    render(
      <RuleTree
        root={{
          kind: "all",
          label: "Tümü",
          children: [{ kind: "predicate", label: "Sermaye şirketi", result: "true" }],
        }}
      />,
    );
    expect(screen.getByText("Sermaye şirketi")).toBeInTheDocument();
  });
});

describe("source components", () => {
  it("links a known citation and strikes an unknown one", () => {
    routed(<CitationChip citation="snap-x" known />);
    expect(screen.getByRole("link", { name: "snap-x" })).toBeInTheDocument();
  });

  it("renders snapshot metadata including the review status", () => {
    routed(<SourceSnapshotCard snapshot={snapshotFixtures[0]!} />);
    expect(screen.getByText("İnceleme bekliyor")).toBeInTheDocument();
    expect(screen.getByText("TÜBİTAK")).toBeInTheDocument();
  });

  it("shows undated effective ranges as Bilinmiyor", () => {
    routed(<SourceSnapshotCard snapshot={snapshotFixtures[0]!} />);
    expect(screen.getAllByText(/bilinmiyor/i).length).toBeGreaterThan(0);
  });

  it("says plainly that nothing is verified yet", () => {
    render(<SourceFreshnessMeter snapshots={snapshotFixtures} />);
    expect(screen.getByText(/hiçbir kaynak henüz uzman incelemesinden geçmedi/i)).toBeInTheDocument();
  });

  it("labels review statuses", () => {
    render(<ReviewStatusBadge status="verified" />);
    expect(screen.getByText("Doğrulanmış")).toBeInTheDocument();
  });
});

describe("CallWindowBadge", () => {
  it("never renders unknown as open", () => {
    render(<CallWindowBadge state="unknown" />);
    expect(screen.getByText("Bilinmiyor")).toBeInTheDocument();
    expect(screen.queryByText("Açık")).not.toBeInTheDocument();
  });
});

describe("evidence components", () => {
  it("shows both hashes and explains what they prove", () => {
    render(<DecisionHashPair inputHash={"a".repeat(64)} decisionHash={"b".repeat(64)} />);
    expect(screen.getByText("Girdi özeti")).toBeInTheDocument();
    expect(screen.getByText("Karar özeti")).toBeInTheDocument();
  });

  it("refuses to compare fewer than two decisions", () => {
    routed(<DecisionCompareGrid decisions={[decisionFixtures[0]!]} />);
    expect(screen.getByRole("heading", { name: /en az iki karar/i })).toBeInTheDocument();
  });

  it("compares two decisions field by field", () => {
    routed(<DecisionCompareGrid decisions={decisionFixtures} />);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader").length).toBe(3);
  });
});

describe("ProgramCard and money", () => {
  it("shows a programme without inventing an amount", () => {
    routed(<ProgramCard program={programFixtures[0]!} href="/firsatlar/TUBITAK-1501" />);
    expect(screen.getByText(/yayımlanmış üst limit bilgisi yok/i)).toBeInTheDocument();
  });

  it("labels a published ceiling as a ceiling, not as an award", () => {
    render(<MoneyStateLabel publishedReference="1.000.000 ₺" />);
    expect(screen.getByText(/ödenecek tutar değildir/i)).toBeInTheDocument();
  });

  it("explains the absence when there is no ceiling", () => {
    render(<MoneyStateLabel publishedReference={null} />);
    expect(screen.getByText(/yayımlanmış üst limit bilgisi yok/i)).toBeInTheDocument();
  });
});

describe("RequiredDocumentsChecklist", () => {
  it("says the ticks are local only", () => {
    render(<RequiredDocumentsChecklist documents={["İş planı"]} />);
    expect(screen.getByText(/yalnızca bu tarayıcıda tutulur/i)).toBeInTheDocument();
  });

  it("shows an empty state with no documents", () => {
    render(<RequiredDocumentsChecklist documents={[]} />);
    expect(screen.getByRole("heading", { name: /belge listesi yok/i })).toBeInTheDocument();
  });
});

describe("ApprovalRecordCard", () => {
  it("uses the exact user approval label", () => {
    render(<ApprovalRecordCard />);
    expect(screen.getByRole("heading", { name: USER_APPROVAL_LABEL })).toBeInTheDocument();
  });

  it("admits that past approvals cannot be listed", () => {
    render(<ApprovalRecordCard />);
    expect(screen.getByText(/onay okuma ucu yok/i)).toBeInTheDocument();
  });
});

describe("MaturityRadar", () => {
  it("labels an unmeasurable dimension rather than scoring it zero", () => {
    const report = calculateMaturity({
      decisions: [],
      programs: [],
      snapshots: [],
      health: null,
    });
    render(<MaturityRadar dimensions={report.dimensions} />);
    expect(screen.getAllByText("Ölçülemiyor").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("heading", { name: "Başvuru hazırlığı" })).toBeInTheDocument();
  });
});

describe("BackendCapabilityGate", () => {
  it("passes a green capability straight through", () => {
    render(
      <BackendCapabilityGate
        capability={{
          id: "x",
          title: "Kokpit",
          group: "decisions",
          status: "green",
          enabled: true,
        }}
      >
        <p>Gerçek içerik</p>
      </BackendCapabilityGate>,
    );
    expect(screen.getByText("Gerçek içerik")).toBeInTheDocument();
  });

  it("renders a blocked capability as a disabled, labelled placeholder", () => {
    render(
      <BackendCapabilityGate
        capability={{
          id: "basvurular",
          title: "Başvuru hattı",
          group: "pipeline",
          status: "blocked",
          enabled: false,
          reason: "Application varlığı yok.",
        }}
      />,
    );
    expect(screen.getByText("Backend yeteneği gerekli")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kullanılamıyor" })).toBeDisabled();
    expect(screen.getByText("Application varlığı yok.")).toBeInTheDocument();
  });

  it("never says a blocked capability is coming soon", () => {
    const { container } = render(
      <BackendCapabilityGate
        capability={{
          id: "takvim",
          title: "Takvim",
          group: "pipeline",
          status: "blocked",
          enabled: false,
          reason: "Çağrı penceresi yok.",
        }}
      />,
    );
    expect(container.textContent?.toLocaleLowerCase("tr")).not.toContain("yakında");
  });
});
