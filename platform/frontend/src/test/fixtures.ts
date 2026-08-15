import type { Decision } from "@/api/types";

/** A decision shaped exactly like `DecisionOut` from the backend schema. */
export function decisionFixture(overrides: Partial<Decision> = {}): Decision {
  return {
    id: "decision-1",
    program_code: "TUBITAK-1501",
    program_version_id: "TUBITAK-1501@2026.1",
    rule_set_version_id: "TUBITAK-1501:2026.1",
    outcome: "conditional",
    outcome_label: "Koşullu",
    input_hash: "a".repeat(64),
    decision_hash: "b".repeat(64),
    source_snapshot_ids: ["snap-tubitak-1501-2026-08-14"],
    reasons: ["call_window_unknown"],
    missing_facts: [],
    traces: [],
    review_status: "current",
    created_at: "2026-08-14T09:00:00+00:00",
    disclaimer:
      "Bu sonuc bir on degerlendirmedir; resmi kurum karari degildir ve baglayici degildir.",
    ...overrides,
  };
}
