/**
 * The demo catalogue, sources, decisions and readiness reading.
 *
 * This is the product's own demo data, not a test fixture that a production
 * module borrowed. The distinction is the whole reason this file exists: the
 * one-click demo login needs rows to show, `src/mocks` is test-only machinery
 * that must never enter the production graph, and copying the rows into a
 * second file would have produced two catalogues that drift apart. So the
 * canonical copy lives here and `src/mocks/fixtures.ts` re-exports it.
 *
 * Every value is a shape the real backend returns today: three programmes,
 * three snapshots, every call window `unknown`, every snapshot pending review,
 * no published reference anywhere. Enriching them would make the demo look
 * better than the product, which is the failure this repository is built to
 * refuse - a reviewer would be judging a catalogue nobody can ship.
 *
 * The accessors below parse through the API's own Zod schemas before returning.
 * That is not defensive decoration: it is what makes "API-schema compatible" a
 * checked claim rather than a comment. If a field ever drifts from
 * `api/types.ts`, the demo fails loudly here instead of quietly rendering a
 * half-understood row inside a screen a customer is being shown.
 */

import {
  decisionListSchema,
  programListSchema,
  readinessHealthSchema,
  snapshotListSchema,
  type Decision,
  type Program,
  type ReadinessHealth,
  type Snapshot,
} from "@/api/types";

export const programFixtures: Program[] = [
  {
    code: "TUBITAK-1501",
    name: "TÜBİTAK 1501 Sanayi Ar-Ge Projeleri Destekleme Programı",
    version: "2026.1",
    support_type: "grant",
    official_url: "https://tubitak.gov.tr/tr/destekler/sanayi/ulusal-destek-programlari",
    call_window_state: "unknown",
    source_snapshot_ids: ["snap-tubitak-1501-2026-08-14"],
    required_documents: [
      "Proje öneri formu",
      "Mali rapor",
      "İmza sirküleri",
      "KOBİ beyannamesi",
    ],
    published_reference: null,
    notes: "Çağrı takvimi yayımlanmadığı için sonuçlar koşullu üretilir.",
  },
  {
    code: "TUBITAK-1507",
    name: "TÜBİTAK 1507 KOBİ Ar-Ge Başlangıç Destek Programı",
    version: "2026.1",
    support_type: "grant",
    official_url: "https://tubitak.gov.tr/tr/destekler/sanayi/ulusal-destek-programlari",
    call_window_state: "unknown",
    source_snapshot_ids: ["snap-tubitak-1507-2026-08-14"],
    required_documents: ["Proje öneri formu", "KOBİ beyannamesi"],
    published_reference: null,
    notes: "",
  },
  {
    code: "KOSGEB-GIRISIMCI",
    name: "KOSGEB Girişimci Destek Programı",
    version: "2026.1",
    support_type: "grant",
    official_url: "https://kosgeb.gov.tr/site/tr/genel/destekdetay/1231",
    call_window_state: "unknown",
    source_snapshot_ids: ["snap-kosgeb-girisimci-2026-08-14"],
    required_documents: ["Girişimcilik eğitimi katılım belgesi", "İş planı"],
    published_reference: null,
    notes: "",
  },
];

export const snapshotFixtures: Snapshot[] = [
  {
    id: "snap-tubitak-1501-2026-08-14",
    url: "https://tubitak.gov.tr/tr/destekler/sanayi/ulusal-destek-programlari",
    publisher: "TÜBİTAK",
    title: "1501 programı koşulları",
    captured_at: "2026-08-14T06:00:00+00:00",
    content_hash: "c".repeat(64),
    content_hash_short: "c".repeat(12),
    effective_from: null,
    effective_to: null,
    review_status: "pending_review",
  },
  {
    id: "snap-tubitak-1507-2026-08-14",
    url: "https://tubitak.gov.tr/tr/destekler/sanayi/ulusal-destek-programlari",
    publisher: "TÜBİTAK",
    title: "1507 programı koşulları",
    captured_at: "2026-08-14T06:05:00+00:00",
    content_hash: "d".repeat(64),
    content_hash_short: "d".repeat(12),
    effective_from: null,
    effective_to: null,
    review_status: "pending_review",
  },
  {
    id: "snap-kosgeb-girisimci-2026-08-14",
    url: "https://kosgeb.gov.tr/site/tr/genel/destekdetay/1231",
    publisher: "KOSGEB",
    title: "Girişimci destek programı koşulları",
    captured_at: "2026-08-14T06:10:00+00:00",
    content_hash: "e".repeat(64),
    content_hash_short: "e".repeat(12),
    effective_from: null,
    effective_to: null,
    review_status: "pending_review",
  },
];

export const decisionFixtures: Decision[] = [
  {
    id: "decision-1501",
    program_code: "TUBITAK-1501",
    program_version_id: "TUBITAK-1501@2026.1",
    rule_set_version_id: "TUBITAK-1501:2026.1",
    outcome: "conditional",
    outcome_label: "Koşullu",
    input_hash: "a".repeat(64),
    decision_hash: "b".repeat(64),
    source_snapshot_ids: ["snap-tubitak-1501-2026-08-14"],
    reasons: ["source_effective_dates_unknown", "call_window_unknown"],
    missing_facts: [],
    traces: [
      {
        fact: "is_capital_company",
        operator: "eq",
        expected: true,
        actual: true,
        citation: "snap-tubitak-1501-2026-08-14",
        result: "true",
        label: "Sermaye şirketi olma koşulu",
      },
      {
        fact: "employee_count",
        operator: "lte",
        expected: 250,
        actual: 8,
        citation: "snap-tubitak-1501-2026-08-14",
        result: "true",
        label: "",
      },
    ],
    review_status: "current",
    created_at: "2026-08-14T09:00:00+00:00",
    disclaimer:
      "Bu sonuc bir on degerlendirmedir; resmi kurum karari degildir ve baglayici degildir.",
  },
  {
    id: "decision-1507",
    program_code: "TUBITAK-1507",
    program_version_id: "TUBITAK-1507@2026.1",
    rule_set_version_id: "TUBITAK-1507:2026.1",
    outcome: "insufficient_data",
    outcome_label: "Yetersiz veri",
    input_hash: "f".repeat(64),
    decision_hash: "0".repeat(64),
    source_snapshot_ids: ["snap-tubitak-1507-2026-08-14"],
    reasons: ["missing_required_facts"],
    missing_facts: ["nace_code", "sme_declaration"],
    traces: [
      {
        fact: "nace_code",
        operator: "prefix",
        expected: ["62", "63"],
        actual: null,
        citation: "snap-tubitak-1507-2026-08-14",
        result: "unknown",
        label: "",
      },
    ],
    review_status: "current",
    created_at: "2026-08-14T09:05:00+00:00",
    disclaimer:
      "Bu sonuc bir on degerlendirmedir; resmi kurum karari degildir ve baglayici degildir.",
  },
];

export const readinessFixture = {
  database: "ok",
  catalog: "ok",
  program_count: 3,
  ai_provider: "disabled",
  status: "ready",
};

/* ------------------------------------------------------------- accessors */

/**
 * Parsed rather than returned raw, and parsed on every call.
 *
 * The cost is negligible (three arrays, a few dozen fields) and what it buys is
 * that the demo can never show the interface a row the real API could not have
 * sent. A frozen module constant handed straight out would drift silently the
 * first time somebody edited a literal above.
 */
export function demoPrograms(): Program[] {
  return programListSchema.parse(programFixtures);
}

export function demoSnapshots(): Snapshot[] {
  return snapshotListSchema.parse(snapshotFixtures);
}

export function demoDecisions(): Decision[] {
  return decisionListSchema.parse(decisionFixtures);
}

export function demoDecision(id: string): Decision | null {
  return demoDecisions().find((decision) => decision.id === id) ?? null;
}

export function demoReadiness(): ReadinessHealth {
  return readinessHealthSchema.parse(readinessFixture);
}
