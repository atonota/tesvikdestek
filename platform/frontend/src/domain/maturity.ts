/**
 * Seven-dimensional maturity.
 *
 * Deliberately no aggregate score. One number hides the weakest dimension, and
 * here the weakest is Application Readiness, which is not merely low - it is
 * *unmeasurable*, because `Application` and `Document` do not exist in the
 * domain at all. Averaging an unmeasurable dimension into a headline figure is
 * how a dashboard starts lying.
 *
 * Every dimension therefore carries its own `measurability`:
 *   measured     - computed from real API data
 *   inferred     - a lower bound derived indirectly (e.g. via `missing_facts`)
 *   unmeasurable - no backend capability exists to measure it
 */

import type { Decision, Program, ReadinessHealth, Snapshot } from "@/api/types";

export const MATURITY_LEVELS = [0, 1, 2, 3, 4, 5] as const;
export type MaturityLevel = (typeof MATURITY_LEVELS)[number];

export const LEVEL_LABELS: Record<MaturityLevel, string> = {
  0: "L0 — Yok",
  1: "L1 — Beyan",
  2: "L2 — Kayıtlı",
  3: "L3 — Kaynaklı",
  4: "L4 — Doğrulanmış",
  5: "L5 — Sürdürülen",
};

export type Measurability = "measured" | "inferred" | "unmeasurable";

export const MEASURABILITY_LABELS: Record<Measurability, string> = {
  measured: "Ölçüldü",
  inferred: "Dolaylı çıkarım",
  unmeasurable: "Ölçülemiyor",
};

export interface MaturityDimensionDefinition {
  readonly id: string;
  readonly title: string;
  readonly criterion: string;
}

export const MATURITY_DIMENSIONS: readonly MaturityDimensionDefinition[] = [
  {
    id: "organization",
    title: "Organizasyon",
    criterion: "12 olgudan doldurulmuş oran.",
  },
  {
    id: "data",
    title: "Veri",
    criterion: "Kararlarda eksik olgu (missing_facts) sayısı.",
  },
  {
    id: "source_trust",
    title: "Kaynak güveni",
    criterion: "Snapshot inceleme durumu ve yürürlük tarihlerinin doluluğu.",
  },
  {
    id: "eligibility",
    title: "Uygunluk",
    criterion: "Sonuç dağılımı; yetersiz veri oranının düşüklüğü.",
  },
  {
    id: "application_readiness",
    title: "Başvuru hazırlığı",
    criterion: "Belge durumu ve çağrı penceresi bilinirliği.",
  },
  {
    id: "evidence",
    title: "Kanıt",
    criterion: "Her kararın kaynak zinciri ve hash çifti.",
  },
  {
    id: "security_operations",
    title: "Güvenlik ve operasyon",
    criterion: "Platform sağlığı; kullanıcı güvenlik duruşu.",
  },
];

export interface MaturityDimensionResult {
  readonly id: string;
  readonly title: string;
  readonly criterion: string;
  readonly level: MaturityLevel | null;
  readonly measurability: Measurability;
  /** Plain Turkish sentence explaining the level, always populated. */
  readonly rationale: string;
  /** What would raise it, or what capability is missing. */
  readonly blocker: string | null;
}

export interface MaturityInput {
  readonly decisions: readonly Decision[];
  readonly programs: readonly Program[];
  readonly snapshots: readonly Snapshot[];
  readonly health: ReadinessHealth | null;
}

export interface MaturityReport {
  readonly dimensions: readonly MaturityDimensionResult[];
  /** Number of dimensions that could not be measured at all. */
  readonly unmeasurableCount: number;
  readonly measuredCount: number;
  readonly inferredCount: number;
}

function definition(id: string): MaturityDimensionDefinition {
  const found = MATURITY_DIMENSIONS.find((dimension) => dimension.id === id);
  if (!found) throw new Error(`bilinmeyen olgunluk boyutu: ${id}`);
  return found;
}

function organization(input: MaturityInput): MaturityDimensionResult {
  const base = definition("organization");
  if (input.decisions.length === 0) {
    return {
      ...base,
      level: null,
      measurability: "unmeasurable",
      rationale:
        "Henüz değerlendirme yok. Profil okuma ucu olmadığı için doluluk oranı başka yoldan ölçülemiyor.",
      blocker: "GET /api/profil ucu yok; doluluk yalnızca kararlar üzerinden dolaylı görülebilir.",
    };
  }
  const missing = new Set(input.decisions.flatMap((decision) => decision.missing_facts));
  const answeredLowerBound = Math.max(0, 12 - missing.size);
  const ratio = answeredLowerBound / 12;
  const level: MaturityLevel = ratio >= 0.9 ? 3 : ratio >= 0.6 ? 2 : ratio > 0 ? 1 : 0;
  return {
    ...base,
    level,
    measurability: "inferred",
    rationale: `Kararların eksik olgu listesinden en az ${answeredLowerBound}/12 olgunun dolu olduğu çıkarılıyor.`,
    blocker: "Kesin oran için profil okuma ucu gerekir; bu bir alt sınırdır.",
  };
}

function data(input: MaturityInput): MaturityDimensionResult {
  const base = definition("data");
  if (input.decisions.length === 0) {
    return {
      ...base,
      level: 0,
      measurability: "measured",
      rationale: "Hiç karar üretilmedi; ölçülecek eksik olgu verisi yok.",
      blocker: "Önce profil doldurulup değerlendirme çalıştırılmalı.",
    };
  }
  const uniqueMissing = new Set(input.decisions.flatMap((decision) => decision.missing_facts));
  const level: MaturityLevel =
    uniqueMissing.size === 0 ? 3 : uniqueMissing.size <= 2 ? 2 : uniqueMissing.size <= 5 ? 1 : 0;
  return {
    ...base,
    level,
    measurability: "measured",
    rationale:
      uniqueMissing.size === 0
        ? "Kararların hiçbirinde eksik olgu yok."
        : `${uniqueMissing.size} farklı olgu eksik olarak raporlandı.`,
    blocker: uniqueMissing.size === 0 ? null : "Eksik olguları profilde tamamlayın.",
  };
}

function sourceTrust(input: MaturityInput): MaturityDimensionResult {
  const base = definition("source_trust");
  if (input.snapshots.length === 0) {
    return {
      ...base,
      level: 0,
      measurability: "measured",
      rationale: "Kayıtlı kaynak yakalaması yok.",
      blocker: "Katalog seed edilmemiş.",
    };
  }
  const verified = input.snapshots.filter((s) => s.review_status === "verified").length;
  const dated = input.snapshots.filter((s) => s.effective_from !== null).length;
  const allVerified = verified === input.snapshots.length;
  const allDated = dated === input.snapshots.length;
  const level: MaturityLevel = allVerified && allDated ? 4 : allDated ? 3 : 2;
  return {
    ...base,
    level,
    measurability: "measured",
    rationale: `${input.snapshots.length} kaynaktan ${verified} tanesi doğrulanmış, ${dated} tanesinin yürürlük tarihi dolu.`,
    blocker: allVerified
      ? null
      : "Kaynaklar uzman incelemesinden geçmedi (pending_review); inceleme yazma ucu da yok.",
  };
}

function eligibility(input: MaturityInput): MaturityDimensionResult {
  const base = definition("eligibility");
  if (input.decisions.length === 0) {
    return {
      ...base,
      level: 0,
      measurability: "measured",
      rationale: "Hiç karar üretilmedi.",
      blocker: "Değerlendirme çalıştırılmalı.",
    };
  }
  const insufficient = input.decisions.filter((d) => d.outcome === "insufficient_data").length;
  const conditional = input.decisions.filter((d) => d.outcome === "conditional").length;
  const decisive = input.decisions.length - insufficient - conditional;
  const level: MaturityLevel =
    insufficient === 0 && conditional === 0 ? 4 : insufficient === 0 ? 2 : 1;
  return {
    ...base,
    level,
    measurability: "measured",
    rationale: `${input.decisions.length} karardan ${decisive} tanesi kesin, ${conditional} koşullu, ${insufficient} yetersiz veri.`,
    blocker:
      conditional > 0
        ? "Koşullu sonuçların başlıca nedeni çağrı penceresinin yayımlanmamış olması."
        : null,
  };
}

function applicationReadiness(): MaturityDimensionResult {
  const base = definition("application_readiness");
  return {
    ...base,
    level: null,
    measurability: "unmeasurable",
    rationale:
      "Başvuru, görev ve belge varlıkları sistemde hiç yok; hazırlık durumu ölçülemez. Sıfır puan vermek de yanlış olurdu, çünkü ölçüm yapılmadı.",
    blocker: "Application / Document / Task varlıkları backend'de tanımlı değil.",
  };
}

function evidence(input: MaturityInput): MaturityDimensionResult {
  const base = definition("evidence");
  if (input.decisions.length === 0) {
    return {
      ...base,
      level: 0,
      measurability: "measured",
      rationale: "Kanıt zinciri değerlendirilecek karar yok.",
      blocker: "Değerlendirme çalıştırılmalı.",
    };
  }
  const sourced = input.decisions.filter((d) => d.source_snapshot_ids.length > 0).length;
  const hashed = input.decisions.filter((d) => d.decision_hash && d.input_hash).length;
  const complete = sourced === input.decisions.length && hashed === input.decisions.length;
  return {
    ...base,
    level: complete ? 3 : 1,
    measurability: "measured",
    rationale: complete
      ? "Her kararın kaynak kimlikleri ve hash çifti tam."
      : `${sourced}/${input.decisions.length} kararda kaynak zinciri var.`,
    blocker: complete ? "L4 için kaynakların uzman doğrulaması gerekir." : null,
  };
}

function securityOperations(input: MaturityInput): MaturityDimensionResult {
  const base = definition("security_operations");
  if (!input.health) {
    return {
      ...base,
      level: null,
      measurability: "unmeasurable",
      rationale: "Sağlık ucu okunamadı.",
      blocker: "GET /hazir yanıt vermiyor.",
    };
  }
  const healthy = input.health.status === "ready";
  return {
    ...base,
    level: healthy ? 1 : 0,
    measurability: "inferred",
    rationale: healthy
      ? "Platform sağlığı okunuyor (veritabanı ve katalog hazır). Kullanıcı tarafı güvenlik duruşu ölçülemiyor."
      : "Platform hazır değil.",
    blocker:
      "Parola sıfırlama, iki adımlı doğrulama, oturum listesi ve hız sınırı bu sürümde yok; ölçülecek bir duruş da yok.",
  };
}

export function calculateMaturity(input: MaturityInput): MaturityReport {
  const dimensions: readonly MaturityDimensionResult[] = [
    organization(input),
    data(input),
    sourceTrust(input),
    eligibility(input),
    applicationReadiness(),
    evidence(input),
    securityOperations(input),
  ];

  return {
    dimensions,
    unmeasurableCount: dimensions.filter((d) => d.measurability === "unmeasurable").length,
    measuredCount: dimensions.filter((d) => d.measurability === "measured").length,
    inferredCount: dimensions.filter((d) => d.measurability === "inferred").length,
  };
}

export function levelLabel(level: MaturityLevel | null): string {
  return level === null ? "Ölçülemiyor" : LEVEL_LABELS[level];
}
