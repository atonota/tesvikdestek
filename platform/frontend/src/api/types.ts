/**
 * Runtime contracts for the six JSON endpoints the backend actually exposes.
 *
 * These mirror `platform/src/destektesvik/delivery/schemas.py`, which is
 * `extra="forbid"` on every model. The schemas below are `.strict()` for the
 * same reason: if the backend grows a field, this fails loudly in tests rather
 * than silently rendering a half-understood payload.
 *
 * Parsing is not decoration. A decision drives what a company believes about
 * public money, so a malformed payload must stop at the boundary.
 */

import { z } from "zod";

export const traceSchema = z
  .object({
    fact: z.string(),
    operator: z.string(),
    expected: z.unknown(),
    actual: z.unknown(),
    citation: z.string(),
    result: z.string(),
    label: z.string().default(""),
  })
  .strict();

export const decisionSchema = z
  .object({
    id: z.string(),
    program_code: z.string(),
    program_version_id: z.string(),
    rule_set_version_id: z.string(),
    outcome: z.string(),
    outcome_label: z.string(),
    input_hash: z.string(),
    decision_hash: z.string(),
    source_snapshot_ids: z.array(z.string()),
    reasons: z.array(z.string()),
    missing_facts: z.array(z.string()),
    traces: z.array(traceSchema),
    review_status: z.string(),
    created_at: z.string(),
    disclaimer: z.string(),
  })
  .strict();

export const programSchema = z
  .object({
    code: z.string(),
    name: z.string(),
    version: z.string(),
    support_type: z.string(),
    official_url: z.string(),
    call_window_state: z.string(),
    source_snapshot_ids: z.array(z.string()),
    required_documents: z.array(z.string()),
    published_reference: z.string().nullable().default(null),
    notes: z.string().default(""),
  })
  .strict();

export const snapshotSchema = z
  .object({
    id: z.string(),
    url: z.string(),
    publisher: z.string(),
    title: z.string(),
    captured_at: z.string(),
    content_hash: z.string(),
    content_hash_short: z.string(),
    effective_from: z.string().nullable().default(null),
    effective_to: z.string().nullable().default(null),
    review_status: z.string(),
  })
  .strict();

/**
 * `ApprovalOut` from `delivery/schemas.py`, field for field.
 *
 * The canonical audit record of a user approval, `approved_at` included. It is
 * parsed rather than assumed because an audit timestamp is the one value on
 * this screen that must never be invented: the interface used to build it with
 * `new Date()` at render time, which produced a different "recorded moment"
 * every time the page repainted.
 *
 * The endpoint that returns it is the form POST, and today that endpoint
 * answers `303` with an HTML page rather than this body - so the schema is the
 * client's side of a contract the server keeps only when it sends JSON. When it
 * does not, the interface says whose clock it is showing instead of pretending
 * this arrived from the server.
 */
export const approvalSchema = z
  .object({
    id: z.string(),
    decision_id: z.string(),
    actor_user_id: z.string(),
    approved_at: z.string(),
    note: z.string(),
    label: z.string().default("Kullanici onayi"),
  })
  .strict();

export const csrfTokenSchema = z.object({ csrf_token: z.string() }).strict();

/**
 * `/hazir` is assembled dict-style in `routers/health.py` rather than from a
 * Pydantic model, so this one is intentionally permissive about extra keys.
 */
export const readinessHealthSchema = z.object({
  database: z.string(),
  catalog: z.string(),
  program_count: z.number().optional(),
  ai_provider: z.string(),
  status: z.string(),
});

export const decisionListSchema = z.array(decisionSchema);
export const programListSchema = z.array(programSchema);
export const snapshotListSchema = z.array(snapshotSchema);

export type Trace = z.infer<typeof traceSchema>;
export type Decision = z.infer<typeof decisionSchema>;
export type Program = z.infer<typeof programSchema>;
export type Snapshot = z.infer<typeof snapshotSchema>;
export type Approval = z.infer<typeof approvalSchema>;
export type CsrfToken = z.infer<typeof csrfTokenSchema>;
export type ReadinessHealth = z.infer<typeof readinessHealthSchema>;

/** Call window states the backend can report. "unknown" is never shown as open. */
export const CALL_WINDOW_LABELS: Record<string, string> = {
  open: "Açık",
  closed: "Kapalı",
  unknown: "Bilinmiyor",
};

export const REVIEW_STATUS_LABELS: Record<string, string> = {
  verified: "Doğrulanmış",
  pending_review: "İnceleme bekliyor",
  stale: "Güncelliğini yitirmiş",
};

export const SUPPORT_TYPE_LABELS: Record<string, string> = {
  grant: "Hibe",
  loan: "Kredi",
  guarantee: "Garanti",
  tax_incentive: "Vergi teşviki",
  equity: "Sermaye",
  in_kind: "Ayni destek",
};

export function supportTypeLabel(value: string): string {
  return SUPPORT_TYPE_LABELS[value] ?? value;
}

export function callWindowLabel(value: string): string {
  return CALL_WINDOW_LABELS[value] ?? "Bilinmiyor";
}

export function reviewStatusLabel(value: string): string {
  return REVIEW_STATUS_LABELS[value] ?? value;
}
