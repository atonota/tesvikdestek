/**
 * The branches that only appear when something is missing, wrong or absent.
 * These are the paths a real deployment hits most, given how little data the
 * backend currently has.
 */

import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import {
  ApiError,
  ContractError,
  OfflineError,
  describeError,
  fetchCsrfToken,
  fetchDecision,
  fetchPrograms,
  postEvaluation,
  postForm,
} from "@/api/client";
import {
  CatalogList,
  DecisionDetail,
  DecisionList,
  MaturityRadar,
  OpportunityDetail,
  OpsHealth,
  ReadinessTemplate,
  SourceFreshnessMeter,
} from "@/components";
import { capabilitiesByStatus, capabilityById, CAPABILITY_COUNTS } from "@/domain/capabilities";
import { calculateMaturity } from "@/domain/maturity";
import { tristateLabel, isTristate } from "@/domain/tristate";
import { daysSince, formatRelativeDays, pluralTr } from "@/lib/intl";
import { decisionFixtures, programFixtures, snapshotFixtures } from "@/mocks/fixtures";
import { server } from "@/mocks/server";
import { RouteErrorBoundary } from "@/routes/errors";

function routed(element: React.ReactElement) {
  const router = createMemoryRouter([{ path: "*", element }], { initialEntries: ["/"] });
  return render(<RouterProvider router={router} />);
}

describe("API client error taxonomy", () => {
  it("turns each status into a Turkish message without inventing detail", () => {
    expect(describeError(new ApiError("x", 401, "/a"))).toMatch(/tekrar giriş/i);
    expect(describeError(new ApiError("x", 403, "/a"))).toMatch(/yetkiniz yok/i);
    expect(describeError(new ApiError("x", 404, "/a"))).toMatch(/bulunamadı/i);
    expect(describeError(new ApiError("x", 409, "/a"))).toMatch(/çakışıyor/i);
    expect(describeError(new ApiError("x", 503, "/a"))).toMatch(/sunucu tarafında/i);
    expect(describeError(new ApiError("özel", 418, "/a"))).toBe("özel");
    expect(describeError(new OfflineError("/a"))).toMatch(/ulaşılamıyor/i);
    expect(describeError(new ContractError("bozuk", "/a"))).toMatch(/sözleşmeye uymuyor/i);
    expect(describeError(new Error("bilinmeyen"))).toMatch(/beklenmeyen/i);
  });

  it("raises ApiError for a failed request", async () => {
    server.use(http.get("/api/programlar", () => new HttpResponse(null, { status: 500 })));
    await expect(fetchPrograms()).rejects.toBeInstanceOf(ApiError);
  });

  it("raises ContractError when the payload breaks the schema", async () => {
    server.use(http.get("/api/programlar", () => HttpResponse.json([{ nope: true }])));
    await expect(fetchPrograms()).rejects.toBeInstanceOf(ContractError);
  });

  it("raises ContractError when the evaluation write answers off-contract", async () => {
    server.use(http.post("/api/degerlendir", () => HttpResponse.json([{ nope: true }])));
    await expect(postEvaluation()).rejects.toBeInstanceOf(ContractError);
  });

  it("propagates a 404 from a single decision", async () => {
    await expect(fetchDecision("yok")).rejects.toBeInstanceOf(ApiError);
  });

  it("fetches a CSRF token and attaches it to a form post", async () => {
    expect(await fetchCsrfToken()).toBe("test-signed-token");
    await expect(postForm("/profil", { display_name: "X" })).resolves.toMatchObject({ ok: true });
  });
});

describe("maturity branches", () => {
  it("reports zero-decision states as measured zero, not unmeasurable", () => {
    const report = calculateMaturity({
      decisions: [],
      programs: [],
      snapshots: [],
      health: null,
    });
    expect(report.dimensions.find((d) => d.id === "data")?.level).toBe(0);
    expect(report.dimensions.find((d) => d.id === "evidence")?.level).toBe(0);
    expect(report.dimensions.find((d) => d.id === "eligibility")?.level).toBe(0);
    expect(report.dimensions.find((d) => d.id === "source_trust")?.level).toBe(0);
  });

  it("marks security operations unmeasurable without a health payload", () => {
    const report = calculateMaturity({ decisions: [], programs: [], snapshots: [], health: null });
    expect(report.dimensions.find((d) => d.id === "security_operations")?.measurability).toBe(
      "unmeasurable",
    );
  });

  it("reaches L4 source trust only when everything is verified and dated", () => {
    const verified = snapshotFixtures.map((snapshot) => ({
      ...snapshot,
      review_status: "verified",
      effective_from: "2026-01-01",
    }));
    const report = calculateMaturity({
      decisions: decisionFixtures,
      programs: [],
      snapshots: verified,
      health: { database: "ok", catalog: "ok", ai_provider: "disabled", status: "ready" },
    });
    expect(report.dimensions.find((d) => d.id === "source_trust")?.level).toBe(4);
  });

  it("reaches L4 eligibility only when nothing is conditional or insufficient", () => {
    const decisive = decisionFixtures.map((decision) => ({
      ...decision,
      outcome: "candidate_eligible",
      missing_facts: [],
    }));
    const report = calculateMaturity({
      decisions: decisive,
      programs: [],
      snapshots: snapshotFixtures,
      health: null,
    });
    expect(report.dimensions.find((d) => d.id === "eligibility")?.level).toBe(4);
    expect(report.dimensions.find((d) => d.id === "data")?.level).toBe(3);
    expect(report.dimensions.find((d) => d.id === "organization")?.level).toBe(3);
  });

  it("reports a not-ready platform honestly", () => {
    const report = calculateMaturity({
      decisions: [],
      programs: [],
      snapshots: [],
      health: { database: "unavailable", catalog: "ok", ai_provider: "disabled", status: "not_ready" },
    });
    expect(report.dimensions.find((d) => d.id === "security_operations")?.level).toBe(0);
  });
});

describe("capability helpers", () => {
  it("counts exactly eighteen, ten and fifteen", () => {
    // Eighteen/ten, not seventeen/eight. The file library and the AI provider
    // centre became routed surfaces whose backends do not exist - which is
    // precisely what `partial` means here - and the capability matrix was
    // finally recorded as the green capability it always was.
    //
    // The blocked count is deliberately untouched. Giving a blockage a screen
    // that explains it does not remove the blockage: `documents` stays blocked
    // because no byte can be uploaded, and `/dosyalar` says so on the screen.
    expect(CAPABILITY_COUNTS).toEqual({ green: 18, partial: 10, blocked: 15 });
    expect(capabilitiesByStatus("blocked")).toHaveLength(15);
  });

  it("finds a capability by id and returns undefined otherwise", () => {
    expect(capabilityById("dashboard")?.status).toBe("green");
    expect(capabilityById("yok")).toBeUndefined();
  });
});

describe("small helpers", () => {
  it("labels every tri-state value", () => {
    expect(tristateLabel("")).toBe("Bilinmiyor");
    expect(tristateLabel("true")).toBe("Evet");
    expect(tristateLabel("false")).toBe("Hayır");
  });

  it("recognises only the three tri-state values", () => {
    expect(isTristate("true")).toBe(true);
    expect(isTristate("belki")).toBe(false);
  });

  it("formats relative days and handles missing input", () => {
    expect(formatRelativeDays(null)).toBe("Bilinmiyor");
    expect(formatRelativeDays("saçmalık")).toBe("Bilinmiyor");
    expect(formatRelativeDays("2026-08-13T00:00:00Z", new Date("2026-08-14T00:00:00Z"))).toMatch(
      /dün|önce/i,
    );
  });

  it("computes age in days and refuses to guess", () => {
    expect(daysSince(null)).toBeNull();
    expect(daysSince("saçmalık")).toBeNull();
    expect(daysSince("2026-08-04T00:00:00Z", new Date("2026-08-14T00:00:00Z"))).toBe(10);
  });

  it("pluralises with Turkish digits", () => {
    expect(pluralTr(1234, "program")).toBe("1.234 program");
  });
});

describe("empty and degraded template states", () => {
  it("decision list offers a way forward when empty", () => {
    routed(<DecisionList decisions={[]} />);
    expect(screen.getByRole("heading", { name: /henüz karar yok/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sihirbazı başlat" })).toBeInTheDocument();
  });

  it("readiness explains that it needs a decision first", () => {
    routed(<ReadinessTemplate decisions={[]} />);
    expect(screen.getByRole("heading", { name: /değerlendirme yok/i })).toBeInTheDocument();
  });

  it("readiness reports a clean profile when nothing is missing", () => {
    const complete = decisionFixtures.map((d) => ({ ...d, missing_facts: [] }));
    routed(<ReadinessTemplate decisions={complete} />);
    expect(screen.getAllByText(/eksik olgu yok/i).length).toBeGreaterThan(0);
  });

  it("catalogue shows an empty state when there are no programmes at all", () => {
    routed(<CatalogList programs={[]} />);
    expect(screen.getByRole("heading", { name: /eşleşen program yok/i })).toBeInTheDocument();
  });

  it("opportunity detail copes with a programme whose sources are missing", () => {
    routed(<OpportunityDetail program={programFixtures[0]!} snapshots={[]} />);
    expect(screen.getByRole("heading", { name: /kaynak bulunamadı/i })).toBeInTheDocument();
  });

  it("decision detail copes with an unknown programme and no snapshots", () => {
    routed(<DecisionDetail decision={decisionFixtures[0]!} program={null} snapshots={[]} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("TUBITAK-1501");
  });

  it("freshness meter reports an empty registry", () => {
    render(<SourceFreshnessMeter snapshots={[]} />);
    expect(screen.getByRole("heading", { name: "Kaynak yok" })).toBeInTheDocument();
  });

  it("maturity radar renders a measured dimension with a bar", () => {
    const report = calculateMaturity({
      decisions: decisionFixtures,
      programs: [],
      snapshots: snapshotFixtures,
      health: { database: "ok", catalog: "ok", ai_provider: "disabled", status: "ready" },
    });
    render(<MaturityRadar dimensions={report.dimensions} />);
    expect(screen.getAllByText(/L\d/).length).toBeGreaterThan(0);
  });

  it("ops health omits the AI note when a provider is configured", () => {
    render(
      <OpsHealth
        health={{ database: "ok", catalog: "ok", ai_provider: "fake", status: "ready" }}
      />,
    );
    expect(screen.queryByText(/yapay zekâ üretimi hiçbir yerde/i)).not.toBeInTheDocument();
  });
});

describe("route error boundary", () => {
  it("renders a technical detail without inventing a request id", () => {
    const router = createMemoryRouter(
      [
        {
          path: "/",
          element: <ThrowsOnRender />,
          errorElement: <RouteErrorBoundary />,
        },
      ],
      { initialEntries: ["/"] },
    );
    render(<RouterProvider router={router} />);
    expect(screen.getByRole("heading", { name: /bir şeyler ters gitti/i })).toBeInTheDocument();
    expect(screen.queryByText(/request[- ]id/i)).not.toBeInTheDocument();
  });
});

function ThrowsOnRender(): React.ReactElement {
  throw new Error("kasıtlı hata");
}
