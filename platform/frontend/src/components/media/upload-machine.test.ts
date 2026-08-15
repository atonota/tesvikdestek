/**
 * The queue machine, exhaustively.
 *
 * The acceptance suite pins the invariants that matter to the product. This
 * file pins the table itself: for every phase and every event, either a defined
 * transition or an explicit no-op. A state machine whose illegal transitions
 * are untested is a state machine with an undocumented back door, and in this
 * subsystem the back door leads to "completed".
 */

import { describe, expect, it } from "vitest";

import {
  NON_RETRYABLE_OUTCOMES,
  TERMINAL_PHASES,
  initialUploadItem,
  isRetryable,
  isTerminal,
  queueReducer,
  summariseQueue,
  uploadOutcomeMessage,
  uploadReducer,
} from "./upload-machine";
import type { UploadEvent, UploadItem, UploadPhase } from "./types";

const ALL_PHASES: readonly UploadPhase[] = [
  "queued",
  "validating",
  "uploading",
  "paused",
  "failed",
  "completed",
  "cancelled",
];

const ALL_EVENTS: readonly UploadEvent[] = [
  { type: "validate.start" },
  { type: "validate.ok", contentHash: "a".repeat(64) },
  { type: "validate.reject", outcome: "duplicate", message: "m" },
  { type: "upload.start" },
  { type: "upload.progress", progress: 50 },
  { type: "upload.pause" },
  { type: "upload.resume" },
  { type: "upload.fail", message: "m" },
  { type: "upload.complete", assetId: "a1" },
  { type: "retry" },
  { type: "cancel" },
];

function item(overrides: Partial<UploadItem> = {}): UploadItem {
  return {
    ...initialUploadItem({
      id: "u1",
      fileName: "a.pdf",
      sizeBytes: 10,
      declaredType: "application/pdf",
    }),
    ...overrides,
  };
}

describe("initialUploadItem", () => {
  it("starts queued with nothing assumed", () => {
    const created = initialUploadItem({
      id: "u9",
      fileName: "x.png",
      sizeBytes: 5,
      declaredType: "image/png",
    });
    expect(created).toMatchObject({
      phase: "queued",
      progress: 0,
      contentHash: null,
      outcome: null,
      error: null,
      attempts: 0,
    });
  });
});

describe("the transition table is total", () => {
  it.each(ALL_PHASES)("every event against phase %s either transitions or no-ops", (phase) => {
    for (const event of ALL_EVENTS) {
      const before = item({ phase });
      const after = uploadReducer(before, event);
      // Either nothing happened (same reference) or the result is a valid item.
      if (after === before) continue;
      expect(ALL_PHASES).toContain(after.phase);
      expect(after.progress).toBeGreaterThanOrEqual(0);
      expect(after.progress).toBeLessThanOrEqual(100);
    }
  });

  it.each(TERMINAL_PHASES)("%s ignores every event", (phase) => {
    const before = item({ phase });
    for (const event of ALL_EVENTS) {
      expect(uploadReducer(before, event)).toBe(before);
    }
  });

  it("returns the same reference when an event does not apply", () => {
    const before = item({ phase: "queued" });
    // `upload.progress` is only meaningful while uploading.
    expect(uploadReducer(before, { type: "upload.progress", progress: 10 })).toBe(before);
  });
});

describe("validation", () => {
  it("clears a previous error when validation restarts", () => {
    const failed = item({ phase: "queued", error: "eski hata" });
    expect(uploadReducer(failed, { type: "validate.start" }).error).toBeNull();
  });

  it("rejects from queued as well as validating", () => {
    for (const phase of ["queued", "validating"] as const) {
      const rejected = uploadReducer(item({ phase }), {
        type: "validate.reject",
        outcome: "quota-exceeded",
        message: "kota",
      });
      expect(rejected.phase).toBe("failed");
      expect(rejected.outcome).toBe("quota-exceeded");
    }
  });

  it("a duplicate keeps its hash and never uploads", () => {
    let current = uploadReducer(item({ phase: "queued" }), { type: "validate.start" });
    current = uploadReducer(current, { type: "validate.ok", contentHash: "b".repeat(64) });
    current = uploadReducer(current, {
      type: "validate.reject",
      outcome: "duplicate",
      message: uploadOutcomeMessage("duplicate"),
    });
    expect(current.contentHash).toBe("b".repeat(64));
    expect(uploadReducer(current, { type: "upload.start" })).toBe(current);
  });
});

describe("retry policy", () => {
  it.each(NON_RETRYABLE_OUTCOMES)("%s is a decision, not a retryable fault", (outcome) => {
    const rejected = item({ phase: "failed", outcome });
    expect(isRetryable(rejected)).toBe(false);
    expect(uploadReducer(rejected, { type: "retry" })).toBe(rejected);
  });

  it("a transport fault is retryable and resets progress", () => {
    const failed = uploadReducer(item({ phase: "uploading", progress: 70 }), {
      type: "upload.fail",
      message: "ağ",
    });
    expect(isRetryable(failed)).toBe(true);
    const retried = uploadReducer(failed, { type: "retry" });
    expect(retried).toMatchObject({ phase: "queued", progress: 0, attempts: 1, error: null });
  });

  it("counts attempts across repeated failures", () => {
    let current = item({ phase: "uploading" });
    for (let round = 1; round <= 3; round += 1) {
      current = uploadReducer(current, { type: "upload.fail", message: "ağ" });
      current = uploadReducer(current, { type: "retry" });
      expect(current.attempts).toBe(round);
      current = uploadReducer(current, { type: "upload.start" });
    }
  });

  it("isRetryable is false for anything not failed", () => {
    for (const phase of ALL_PHASES.filter((value) => value !== "failed")) {
      expect(isRetryable(item({ phase }))).toBe(false);
    }
  });
});

describe("progress", () => {
  it("rounds fractional reports", () => {
    const current = item({ phase: "uploading", progress: 0 });
    expect(uploadReducer(current, { type: "upload.progress", progress: 33.6 }).progress).toBe(34);
  });

  it("ignores an equal report so no render is wasted", () => {
    const current = item({ phase: "uploading", progress: 40 });
    expect(uploadReducer(current, { type: "upload.progress", progress: 40 })).toBe(current);
  });

  it("completion forces 100 even if progress lagged", () => {
    const current = item({ phase: "uploading", progress: 12 });
    expect(uploadReducer(current, { type: "upload.complete", assetId: "a" }).progress).toBe(100);
  });
});

describe("isTerminal", () => {
  it.each(ALL_PHASES)("%s", (phase) => {
    expect(isTerminal(item({ phase }))).toBe(TERMINAL_PHASES.includes(phase));
  });
});

describe("queueReducer", () => {
  const queue: readonly UploadItem[] = [
    item({ id: "a", phase: "uploading", progress: 10 }),
    item({ id: "b", phase: "queued" }),
  ];

  it("touches only the addressed item", () => {
    const next = queueReducer(queue, "a", { type: "upload.progress", progress: 50 });
    expect(next[0]?.progress).toBe(50);
    expect(next[1]).toBe(queue[1]);
  });

  it("returns the same array when nothing changed", () => {
    expect(queueReducer(queue, "b", { type: "upload.progress", progress: 50 })).toBe(queue);
    expect(queueReducer(queue, "missing", { type: "cancel" })).toBe(queue);
  });
});

describe("summariseQueue", () => {
  it("reports an empty queue without inventing progress", () => {
    expect(summariseQueue([])).toEqual({
      total: 0,
      active: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      activeProgress: null,
    });
  });

  it("averages only the items still in flight", () => {
    const summary = summariseQueue([
      item({ id: "1", phase: "uploading", progress: 20 }),
      item({ id: "2", phase: "uploading", progress: 60 }),
      item({ id: "3", phase: "completed", progress: 100 }),
      item({ id: "4", phase: "failed" }),
      item({ id: "5", phase: "cancelled" }),
    ]);
    expect(summary).toEqual({
      total: 5,
      active: 2,
      completed: 1,
      failed: 1,
      cancelled: 1,
      activeProgress: 40,
    });
  });
});
