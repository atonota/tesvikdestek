import { describe, expect, it } from "vitest";

import { decisionFixtures, readinessFixture, snapshotFixtures } from "@/mocks/fixtures";
import { formatDate, formatDateTime, formatNumber, formatPublishedCeiling } from "@/lib/intl";
import { answeredFactCount, ALL_FACTS, emptyProfileValues, factLabel } from "./facts";
import { calculateMaturity, levelLabel, MATURITY_DIMENSIONS } from "./maturity";
import { isOutcome, outcomeLabel, reasonLabel } from "./outcomes";
import {
  isAnswered,
  parseTristate,
  serialiseTristate,
  TRISTATE_CHOICES,
  TRISTATE_UNKNOWN,
} from "./tristate";

describe("tri-state semantics", () => {
  it("keeps unknown, yes and no as three distinct wire values", () => {
    expect(new Set([serialiseTristate(""), serialiseTristate("true"), serialiseTristate("false")]))
      .toEqual(new Set(["", "true", "false"]));
  });

  it("parses anything unrecognised as unknown, never as no", () => {
    for (const raw of ["", undefined, null, "belki", "0", "hayir"]) {
      expect(parseTristate(raw as string | undefined)).toBe(TRISTATE_UNKNOWN);
    }
  });

  it("treats an explicit no as answered and a blank as unanswered", () => {
    expect(isAnswered("false")).toBe(true);
    expect(isAnswered("true")).toBe(true);
    expect(isAnswered(TRISTATE_UNKNOWN)).toBe(false);
  });

  it("offers Bilinmiyor as the first and default choice", () => {
    expect(TRISTATE_CHOICES[0]).toEqual({ value: "", label: "Bilinmiyor" });
  });
});

describe("profile facts", () => {
  it("models exactly the twelve backend fields", () => {
    expect(ALL_FACTS).toHaveLength(12);
  });

  it("starts every tri-state fact at unknown", () => {
    const values = emptyProfileValues();
    expect(values["is_capital_company"]).toBe(TRISTATE_UNKNOWN);
    expect(answeredFactCount(values)).toBe(0);
  });

  it("counts an explicit no as answered", () => {
    const values = { ...emptyProfileValues(), is_capital_company: "false" };
    expect(answeredFactCount(values)).toBe(1);
  });

  it("labels a derived fact the engine reports", () => {
    expect(factLabel("company_age_years")).toBe("Şirket yaşı (yıl)");
  });

  it("falls back to the raw name for an unknown fact", () => {
    expect(factLabel("bilinmeyen_alan")).toBe("bilinmeyen_alan");
  });
});

describe("outcome vocabulary", () => {
  it("recognises the four outcomes and nothing else", () => {
    expect(isOutcome("conditional")).toBe(true);
    expect(isOutcome("approved")).toBe(false);
  });

  it("passes an unknown code through untranslated", () => {
    expect(outcomeLabel("beklenmeyen")).toBe("beklenmeyen");
  });

  it("translates the six reason codes", () => {
    expect(reasonLabel("missing_required_facts")).toBe("Zorunlu olgular eksik");
    expect(reasonLabel("bilinmeyen")).toBe("bilinmeyen");
  });
});

describe("maturity", () => {
  it("always returns all seven dimensions", () => {
    expect(MATURITY_DIMENSIONS).toHaveLength(7);
    const report = calculateMaturity({
      decisions: [],
      programs: [],
      snapshots: [],
      health: null,
    });
    expect(report.dimensions.map((d) => d.id)).toEqual(MATURITY_DIMENSIONS.map((d) => d.id));
  });

  it("never exposes an aggregate score", () => {
    const report = calculateMaturity({
      decisions: decisionFixtures,
      programs: [],
      snapshots: snapshotFixtures,
      health: readinessFixture,
    });
    expect(Object.keys(report)).toEqual([
      "dimensions",
      "unmeasurableCount",
      "measuredCount",
      "inferredCount",
    ]);
  });

  it("marks application readiness unmeasurable whatever the data", () => {
    const report = calculateMaturity({
      decisions: decisionFixtures,
      programs: [],
      snapshots: snapshotFixtures,
      health: readinessFixture,
    });
    const readiness = report.dimensions.find((d) => d.id === "application_readiness");
    expect(readiness?.measurability).toBe("unmeasurable");
    expect(readiness?.level).toBeNull();
  });

  it("caps source trust at L2 while every snapshot is pending review", () => {
    const report = calculateMaturity({
      decisions: decisionFixtures,
      programs: [],
      snapshots: snapshotFixtures,
      health: readinessFixture,
    });
    const trust = report.dimensions.find((d) => d.id === "source_trust");
    expect(trust?.level).toBe(2);
    expect(trust?.blocker).toMatch(/pending_review/);
  });

  it("reports evidence as L3 when every decision carries sources and hashes", () => {
    const report = calculateMaturity({
      decisions: decisionFixtures,
      programs: [],
      snapshots: snapshotFixtures,
      health: readinessFixture,
    });
    expect(report.dimensions.find((d) => d.id === "evidence")?.level).toBe(3);
  });

  it("infers organisation completeness from missing facts", () => {
    const report = calculateMaturity({
      decisions: decisionFixtures,
      programs: [],
      snapshots: snapshotFixtures,
      health: readinessFixture,
    });
    const organisation = report.dimensions.find((d) => d.id === "organization");
    expect(organisation?.measurability).toBe("inferred");
  });

  it("counts measurability categories", () => {
    const report = calculateMaturity({
      decisions: decisionFixtures,
      programs: [],
      snapshots: snapshotFixtures,
      health: readinessFixture,
    });
    expect(
      report.measuredCount + report.inferredCount + report.unmeasurableCount,
    ).toBe(7);
  });

  it("names an unmeasured level rather than printing L0", () => {
    expect(levelLabel(null)).toBe("Ölçülemiyor");
    expect(levelLabel(3)).toBe("L3 — Kaynaklı");
  });
});

describe("Turkish formatting", () => {
  it("formats dates in tr-TR", () => {
    expect(formatDate("2026-08-14T06:00:00+00:00")).toContain("2026");
    expect(formatDateTime("2026-08-14T06:00:00+00:00")).toMatch(/14\.08\.2026/);
  });

  it("says Bilinmiyor rather than Invalid Date", () => {
    expect(formatDate(null)).toBe("Bilinmiyor");
    expect(formatDate("saçmalık")).toBe("Bilinmiyor");
    expect(formatDateTime(undefined)).toBe("Bilinmiyor");
  });

  it("uses Turkish thousands separators", () => {
    expect(formatNumber(1234567)).toBe("1.234.567");
  });

  it("renders a dash for an absent number rather than zero", () => {
    expect(formatNumber(null)).toBe("—");
    expect(formatNumber(undefined)).toBe("—");
  });

  it("formats a published ceiling in lira when one exists", () => {
    expect(formatPublishedCeiling(100_000_00)).toMatch(/₺|TRY/u);
  });
});
