/**
 * The four outcomes, their Turkish labels and the disclaimer.
 *
 * These are mirrors of `platform/src/destektesvik/domain/evaluation.py`. The
 * backend is the only thing that decides an outcome; this module only names
 * what it decided. There is no fifth value, and adding one here would be a
 * product lie rather than a feature.
 */

export const OUTCOMES = [
  "candidate_eligible",
  "conditional",
  "ineligible",
  "insufficient_data",
] as const;

export type Outcome = (typeof OUTCOMES)[number];

/** Verbatim from `OUTCOME_LABELS` in evaluation.py. */
export const OUTCOME_LABELS: Record<Outcome, string> = {
  candidate_eligible: "Aday uygunluk",
  conditional: "Koşullu",
  ineligible: "Uygun değil",
  insufficient_data: "Yetersiz veri",
};

/** One sentence per outcome, so a badge is never the only explanation. */
export const OUTCOME_DESCRIPTIONS: Record<Outcome, string> = {
  candidate_eligible: "Koşullar, elimizdeki veriyle sağlanıyor görünüyor. Bağlayıcı değildir.",
  conditional: "Bir şey bilinmiyor; örneğin çağrı penceresi henüz yayımlanmamış.",
  ineligible: "En az bir koşul açıkça sağlanmıyor.",
  insufficient_data: "Profilde eksik olgu var; hangileri olduğu adıyla listelenir.",
};

export const OUTCOME_TOKEN: Record<Outcome, string> = {
  candidate_eligible: "candidate",
  conditional: "conditional",
  ineligible: "ineligible",
  insufficient_data: "insufficient",
};

/** Verbatim from `REASON_LABELS` in evaluation.py. */
export const REASON_LABELS: Record<string, string> = {
  rule_condition_failed: "Kural koşulu sağlanmadı",
  missing_required_facts: "Zorunlu olgular eksik",
  call_window_closed: "Çağrı penceresi kapalı",
  call_window_unknown: "Çağrı penceresi bilinmiyor",
  source_effective_dates_unknown: "Kaynak yürürlük tarihleri bilinmiyor",
  source_superseded: "Kaynak güncelliğini yitirmiş",
};

/**
 * The user's own approval. Never "Onaylandı", never an institutional decision.
 * Mirrors `ApprovalEvent.label` in `domain/decisions.py`.
 */
export const USER_APPROVAL_LABEL = "Kullanıcı onayı";

/** Byte-identical to `DISCLAIMER` in evaluation.py. */
export const DISCLAIMER =
  "Bu sonuc bir on degerlendirmedir; resmi kurum karari degildir ve baglayici degildir.";

export function isOutcome(value: string): value is Outcome {
  return (OUTCOMES as readonly string[]).includes(value);
}

export function outcomeLabel(value: string): string {
  return isOutcome(value) ? OUTCOME_LABELS[value] : value;
}

export function reasonLabel(value: string): string {
  return REASON_LABELS[value] ?? value;
}
