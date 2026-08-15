/**
 * Fixtures copied from real backend responses.
 *
 * These are the *actual* shapes and values the seeded catalogue returns today:
 * three programmes, three snapshots, every call window unknown, every snapshot
 * pending review, no published reference anywhere. Inventing richer fixtures
 * would make the mocked UI look better than the real one.
 */

import type { Decision, Program, Snapshot } from "@/api/types";

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
