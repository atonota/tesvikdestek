/**
 * The upload queue, as an explicit state machine.
 *
 * Written as a pure reducer with a declared transition table rather than a set
 * of booleans, for one reason: a boolean soup can reach "completed" from
 * anywhere, and "completed" is exactly the claim this product must never make
 * falsely. Here, `completed` has one predecessor - `uploading` - and reaching
 * it any other way is not a transition, it is a no-op.
 *
 * The machine is transport-agnostic. It records what a caller *tells* it
 * happened; it never performs a request, so it can never invent one. The
 * component that owns it refuses to render an enabled control at all unless a
 * transport callback was supplied.
 *
 *   queued ──validate.start──▶ validating ──validate.ok──▶ queued
 *                                   └────validate.reject──▶ failed (terminal
 *                                                            for rejects)
 *   queued ──upload.start──▶ uploading ⇄ paused
 *                                │  └──upload.fail──▶ failed ──retry──▶ queued
 *                                └──upload.complete──▶ completed  [terminal]
 *   any non-terminal ──cancel──▶ cancelled                        [terminal]
 */

import type { UploadEvent, UploadItem, UploadOutcome, UploadPhase } from "./types";

/** No event moves an item out of these. */
export const TERMINAL_PHASES: readonly UploadPhase[] = ["completed", "cancelled"];

/**
 * Outcomes that are decisions rather than transient faults.
 *
 * A duplicate is not a failure to retry into success: the content is already
 * stored. A quota breach will not resolve by trying again either. Retrying
 * these would spin forever and tell the user something false about why.
 */
export const NON_RETRYABLE_OUTCOMES: readonly Exclude<UploadOutcome, null>[] = [
  "duplicate",
  "quota-exceeded",
  "too-large",
  "type-rejected",
];

const OUTCOME_MESSAGES: Record<Exclude<UploadOutcome, null>, string> = {
  duplicate: "Aynı içerik zaten yüklü; yeni kopya yazılmadı.",
  "quota-exceeded": "Depolama kotası dolu.",
  "too-large": "Dosya izin verilen boyutu aşıyor.",
  "type-rejected": "Bu dosya türü kabul edilmiyor.",
};

export function uploadOutcomeMessage(outcome: Exclude<UploadOutcome, null>): string {
  return OUTCOME_MESSAGES[outcome];
}

export function isTerminal(item: UploadItem): boolean {
  return TERMINAL_PHASES.includes(item.phase);
}

export function isRetryable(item: UploadItem): boolean {
  if (item.phase !== "failed") return false;
  if (item.outcome === null) return true;
  return !NON_RETRYABLE_OUTCOMES.includes(item.outcome);
}

export function initialUploadItem(input: {
  readonly id: string;
  readonly fileName: string;
  readonly sizeBytes: number;
  readonly declaredType: string;
}): UploadItem {
  return {
    id: input.id,
    fileName: input.fileName,
    sizeBytes: input.sizeBytes,
    declaredType: input.declaredType,
    phase: "queued",
    progress: 0,
    contentHash: null,
    outcome: null,
    error: null,
    attempts: 0,
  };
}

/** Which phases each event is allowed to act on. */
const ALLOWED_FROM: Record<UploadEvent["type"], readonly UploadPhase[]> = {
  "validate.start": ["queued"],
  "validate.ok": ["validating"],
  "validate.reject": ["validating", "queued"],
  "upload.start": ["queued"],
  "upload.progress": ["uploading"],
  "upload.pause": ["uploading"],
  "upload.resume": ["paused"],
  "upload.fail": ["uploading", "paused", "validating"],
  "upload.complete": ["uploading"],
  retry: ["failed"],
  cancel: ["queued", "validating", "uploading", "paused", "failed"],
};

/**
 * Apply one event.
 *
 * Returns the *same object reference* when the event does not apply, so a
 * caller can cheaply tell "nothing happened" from "something did" and a React
 * list does not re-render for a rejected transition.
 */
export function uploadReducer(item: UploadItem, event: UploadEvent): UploadItem {
  if (isTerminal(item)) return item;
  if (!ALLOWED_FROM[event.type].includes(item.phase)) return item;

  switch (event.type) {
    case "validate.start":
      return { ...item, phase: "validating", error: null };

    case "validate.ok":
      // Back to queued, now carrying the hash the caller computed. Validation
      // succeeding is not the same as an upload starting.
      return { ...item, phase: "queued", contentHash: event.contentHash, error: null };

    case "validate.reject":
      return {
        ...item,
        phase: "failed",
        outcome: event.outcome,
        error: event.message,
      };

    case "upload.start":
      // A file already refused stays refused; `retry` is the only way back and
      // it clears the outcome first.
      if (item.outcome !== null) return item;
      return { ...item, phase: "uploading", error: null };

    case "upload.progress": {
      // Monotonic and clamped: a transport that reports out of order, or in a
      // unit nobody agreed on, must not make the bar jump backwards.
      const clamped = Math.min(100, Math.max(0, Math.round(event.progress)));
      if (clamped <= item.progress) return item;
      return { ...item, progress: clamped };
    }

    case "upload.pause":
      return { ...item, phase: "paused" };

    case "upload.resume":
      return { ...item, phase: "uploading" };

    case "upload.fail":
      return { ...item, phase: "failed", error: event.message };

    case "upload.complete":
      return { ...item, phase: "completed", progress: 100, assetId: event.assetId, error: null };

    case "retry":
      if (!isRetryable(item)) return item;
      return {
        ...item,
        phase: "queued",
        progress: 0,
        error: null,
        outcome: null,
        attempts: item.attempts + 1,
      };

    case "cancel":
      return { ...item, phase: "cancelled" };
  }
}

/** Apply one event to the item with `id`, leaving every other entry untouched. */
export function queueReducer(
  items: readonly UploadItem[],
  id: string,
  event: UploadEvent,
): readonly UploadItem[] {
  let changed = false;
  const next = items.map((item) => {
    if (item.id !== id) return item;
    const updated = uploadReducer(item, event);
    if (updated !== item) changed = true;
    return updated;
  });
  return changed ? next : items;
}

export interface QueueSummary {
  readonly total: number;
  readonly active: number;
  readonly completed: number;
  readonly failed: number;
  readonly cancelled: number;
  /** Mean progress over items that are not terminal. `null` when none are. */
  readonly activeProgress: number | null;
}

export function summariseQueue(items: readonly UploadItem[]): QueueSummary {
  const active = items.filter(
    (item) => !isTerminal(item) && item.phase !== "failed",
  );
  const activeProgress =
    active.length === 0
      ? null
      : Math.round(active.reduce((total, item) => total + item.progress, 0) / active.length);
  return {
    total: items.length,
    active: active.length,
    completed: items.filter((item) => item.phase === "completed").length,
    failed: items.filter((item) => item.phase === "failed").length,
    cancelled: items.filter((item) => item.phase === "cancelled").length,
    activeProgress,
  };
}
