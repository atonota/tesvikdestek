/**
 * The seven acceptance gates, written before any product code exists.
 *
 * Each one asserts a property this product cannot be shipped without. They are
 * deliberately about behaviour and content, not about file layout: an
 * implementation is free to move things around as long as these stay true.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("gate 1 - the application shell mounts a routed, accessible document", () => {
  it("renders a skip link, one h1 and a main landmark at the root route", async () => {
    const { renderAppAt } = await import("@/test/render-app");
    await renderAppAt("/");

    // Exact string, not a case-insensitive regex: JavaScript's /i flag does not
    // fold Turkish "İ" (U+0130) onto "i", so a regex here would never match.
    expect(screen.getByRole("link", { name: "İçeriğe geç" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("renders an honest not-found surface for an unknown route", async () => {
    const { renderAppAt } = await import("@/test/render-app");
    await renderAppAt("/boyle-bir-sayfa-yok");

    expect(await screen.findByText(/sayfa bulunamadı/i)).toBeInTheDocument();
  });
});

describe("gate 2 - the master component system is complete and categorised", () => {
  it("exports exactly the 73 named components in the six documented levels", async () => {
    const registry = await import("@/components/registry");

    expect(registry.COMPONENT_LEVELS.primitives).toHaveLength(14);
    expect(registry.COMPONENT_LEVELS.composites).toHaveLength(16);
    expect(registry.COMPONENT_LEVELS.patterns).toHaveLength(10);
    expect(registry.COMPONENT_LEVELS.shells).toHaveLength(4);
    expect(registry.COMPONENT_LEVELS.domain).toHaveLength(18);
    expect(registry.COMPONENT_LEVELS.templates).toHaveLength(11);
    expect(registry.ALL_COMPONENT_NAMES).toHaveLength(73);
  });

  it("actually exports every registered name as a real component", async () => {
    const registry = await import("@/components/registry");
    const barrel = (await import("@/components")) as Record<string, unknown>;

    const missing = registry.ALL_COMPONENT_NAMES.filter((name) => !(name in barrel));
    expect(missing).toEqual([]);

    const notCallable = registry.ALL_COMPONENT_NAMES.filter((name) => {
      const exported = barrel[name];
      return typeof exported !== "function" && typeof exported !== "object";
    });
    expect(notCallable).toEqual([]);
  });

  it("registers no duplicate component names across levels", async () => {
    const { ALL_COMPONENT_NAMES } = await import("@/components/registry");
    expect(new Set(ALL_COMPONENT_NAMES).size).toBe(ALL_COMPONENT_NAMES.length);
  });
});

describe("gate 3 - forbidden truth language never reaches the interface", () => {
  it("exposes the four backend outcome labels and nothing resembling approval", async () => {
    const { OUTCOME_LABELS } = await import("@/domain/outcomes");

    expect(Object.keys(OUTCOME_LABELS).sort()).toEqual([
      "candidate_eligible",
      "conditional",
      "ineligible",
      "insufficient_data",
    ]);
    for (const label of Object.values(OUTCOME_LABELS)) {
      expect(label.toLocaleLowerCase("tr")).not.toContain("onaylandı");
      expect(label.toLocaleLowerCase("tr")).not.toContain("hak kazan");
    }
  });

  it("flags entitlement language through the shared guard", async () => {
    const { findForbiddenClaims } = await import("@/domain/truth-guard");

    expect(findForbiddenClaims("Başvurunuz onaylandı.")).not.toEqual([]);
    expect(findForbiddenClaims("Bu destekten hak kazandınız.")).not.toEqual([]);
    expect(findForbiddenClaims("Alacağınız tutar 250.000 TL.")).not.toEqual([]);
    expect(findForbiddenClaims("Destek almanız garanti.")).not.toEqual([]);
    expect(findForbiddenClaims("Kullanıcı onayı kaydedildi.")).toEqual([]);
    expect(findForbiddenClaims("Aday uygunluk")).toEqual([]);
  });

  it("labels a recorded user approval exactly as Kullanıcı onayı", async () => {
    const { USER_APPROVAL_LABEL } = await import("@/domain/outcomes");
    expect(USER_APPROVAL_LABEL).toBe("Kullanıcı onayı");
  });
});

describe("gate 4 - tri-state facts keep unknown distinct from no", () => {
  it("serialises the three states to the exact wire values the backend parses", async () => {
    const { serialiseTristate, parseTristate, TRISTATE_UNKNOWN } = await import(
      "@/domain/tristate"
    );

    expect(serialiseTristate("true")).toBe("true");
    expect(serialiseTristate("false")).toBe("false");
    expect(serialiseTristate(TRISTATE_UNKNOWN)).toBe("");
    expect(parseTristate("")).toBe(TRISTATE_UNKNOWN);
    expect(parseTristate(undefined)).toBe(TRISTATE_UNKNOWN);
  });

  it("never collapses unknown into false", async () => {
    const { serialiseTristate, TRISTATE_UNKNOWN, isAnswered } = await import("@/domain/tristate");

    expect(serialiseTristate(TRISTATE_UNKNOWN)).not.toBe("false");
    expect(isAnswered(TRISTATE_UNKNOWN)).toBe(false);
    expect(isAnswered("false")).toBe(true);
  });
});

describe("gate 5 - maturity is seven dimensions, never one score", () => {
  it("returns all seven dimensions with an explicit measurability label", async () => {
    const { calculateMaturity, MATURITY_DIMENSIONS } = await import("@/domain/maturity");

    expect(MATURITY_DIMENSIONS).toHaveLength(7);
    const result = calculateMaturity({ decisions: [], programs: [], snapshots: [], health: null });
    expect(result.dimensions).toHaveLength(7);
    for (const dimension of result.dimensions) {
      expect(["measured", "inferred", "unmeasurable"]).toContain(dimension.measurability);
    }
  });

  it("refuses to publish a single aggregate score", async () => {
    const report = await import("@/domain/maturity");
    const result = report.calculateMaturity({
      decisions: [],
      programs: [],
      snapshots: [],
      health: null,
    });
    expect(result).not.toHaveProperty("overall");
    expect(result).not.toHaveProperty("score");
    expect(result).not.toHaveProperty("total");
  });

  it("scores application readiness as unmeasurable, not as zero-out-of-five", async () => {
    const { calculateMaturity } = await import("@/domain/maturity");
    const result = calculateMaturity({
      decisions: [],
      programs: [],
      snapshots: [],
      health: null,
    });
    const readiness = result.dimensions.find((d) => d.id === "application_readiness");
    expect(readiness?.measurability).toBe("unmeasurable");
  });
});

describe("gate 6 - every decision surface carries the disclaimer verbatim", () => {
  it("keeps the disclaimer text byte-identical to the backend constant", async () => {
    const { DISCLAIMER } = await import("@/domain/outcomes");
    expect(DISCLAIMER).toBe(
      "Bu sonuc bir on degerlendirmedir; resmi kurum karari degildir ve baglayici degildir.",
    );
  });

  it("renders the disclaimer on the decision detail template", async () => {
    const { DecisionDetail } = await import("@/components");
    const { decisionFixture } = await import("@/test/fixtures");

    render(<DecisionDetail decision={decisionFixture()} program={null} snapshots={[]} />);
    expect(screen.getByText(/on degerlendirmedir/i)).toBeInTheDocument();
  });
});

describe("gate 7 - blocked backend capabilities are labelled, never simulated", () => {
  it("publishes a capability matrix whose blocked entries are all disabled", async () => {
    const { CAPABILITIES, BLOCKED_LABEL } = await import("@/domain/capabilities");

    const blocked = CAPABILITIES.filter((capability) => capability.status === "blocked");
    expect(blocked.length).toBeGreaterThanOrEqual(15);
    for (const capability of blocked) {
      expect(capability.enabled).toBe(false);
      expect(capability.reason).toBeTruthy();
    }
    expect(BLOCKED_LABEL).toBe("Backend yeteneği gerekli");
  });

  it("counts the route inventory exactly as the scope report measured it", async () => {
    const { CAPABILITIES } = await import("@/domain/capabilities");
    const byStatus = (status: string) =>
      CAPABILITIES.filter((capability) => capability.status === status).length;

    // Re-measured when the file library and the AI provider centre were mounted
    // as routes. The blocked count is deliberately untouched: `/dosyalar`
    // explains why uploading is impossible, it does not make it possible.
    expect(byStatus("green")).toBe(18);
    expect(byStatus("partial")).toBe(10);
    expect(byStatus("blocked")).toBe(15);
  });

  it("renders blocked capabilities as disabled with the required label", async () => {
    const { BackendCapabilityGate } = await import("@/components");

    render(
      <BackendCapabilityGate
        capability={{
          id: "basvurular",
          title: "Başvuru hattı",
          group: "pipeline",
          status: "blocked",
          enabled: false,
          reason: "Application varlığı domainde yok.",
          route: "/basvurular",
        }}
      />,
    );

    expect(screen.getByText(/backend yeteneği gerekli/i)).toBeInTheDocument();
  });
});
