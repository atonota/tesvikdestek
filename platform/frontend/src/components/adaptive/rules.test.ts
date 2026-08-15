/**
 * The assistant's rules read the API's real schema, not an invented one.
 *
 * The first version of `rules.ts` modelled `snapshot_id` and `fetched_at`.
 * Neither field exists: `decisionSchema` carries `source_snapshot_ids` (a list)
 * and `snapshotSchema` carries `captured_at`. Because the rule types were
 * hand-written structural shapes with optional members, a real `Decision`
 * satisfied them trivially - `decision.snapshot_id` was `undefined` on every
 * record, so the "kaynak anlık görüntüsü yok" rule fired for *all* decisions,
 * including the ones that do cite a source. A suggestion that is always true is
 * not a finding, and nothing failed to compile.
 *
 * So these tests are deliberately fed with genuinely typed `Decision` and
 * `Snapshot` values from the fixtures, and the rule input types are `Pick`ed
 * from those same types. If the backend renames a field, this file stops
 * compiling rather than quietly producing a suggestion about nothing.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { Decision, Snapshot } from "@/api/types";
import { decisionFixtures, snapshotFixtures } from "@/mocks/fixtures";

import {
  deriveDataStatus,
  suggestFromLoadedData,
  uniqueMissingFacts,
  type DecisionFacts,
  type SnapshotFacts,
} from "./rules";

const RULES_SOURCE = readFileSync(
  join(process.cwd(), "src", "components", "adaptive", "rules.ts"),
  "utf8",
);

/** Real API values, not literals shaped to fit the rule. */
const DECISIONS: readonly Decision[] = decisionFixtures;
const SNAPSHOTS: readonly Snapshot[] = snapshotFixtures;

describe("the rule input is Pick-ed from the real API types", () => {
  it("accepts a genuine Decision and a genuine Snapshot without a cast", () => {
    const decisions: readonly DecisionFacts[] = DECISIONS;
    const sources: readonly SnapshotFacts[] = SNAPSHOTS;
    expect(decisions.length).toBeGreaterThan(0);
    expect(sources.length).toBeGreaterThan(0);
  });

  it("names only fields the schema actually declares", () => {
    // The two invented names, banned outright - including in prose, because a
    // rule file that still talks about `snapshot_id` invites the next author to
    // reintroduce it. The docstring above refers to them, so only this module
    // is scanned.
    const code = RULES_SOURCE.replace(/\/\*[\s\S]*?\*\//gu, "").replace(
      /(^|[^:])\/\/.*$/gmu,
      "$1",
    );
    expect(code).not.toMatch(/\bsnapshot_id\b/u);
    expect(code).not.toMatch(/\bfetched_at\b/u);
    expect(code).toMatch(/\bsource_snapshot_ids\b/u);
    expect(code).toMatch(/\bcaptured_at\b/u);
  });
});

describe("the source rule counts decisions with no snapshot ids at all", () => {
  it("stays quiet when every loaded decision cites a source", () => {
    const cited = DECISIONS.filter((decision) => decision.source_snapshot_ids.length > 0);
    expect(cited.length).toBeGreaterThan(0);
    const ids = suggestFromLoadedData({ decisions: cited }).map((s) => s.id);
    expect(ids).not.toContain("missing-snapshot");
  });

  it("fires, with a count, for a decision whose source list is empty", () => {
    const orphan: Decision = { ...(DECISIONS[0] as Decision), source_snapshot_ids: [] };
    const found = suggestFromLoadedData({ decisions: [orphan] }).find(
      (s) => s.id === "missing-snapshot",
    );
    expect(found?.title).toMatch(/^1 /u);
  });
});

describe("the freshness rule reads captured_at", () => {
  it("stays quiet for snapshots that carry a capture time", () => {
    const ids = suggestFromLoadedData({ decisions: [], sources: SNAPSHOTS }).map((s) => s.id);
    expect(ids).not.toContain("unfetched-sources");
  });

  it("fires for a snapshot whose capture time is blank", () => {
    const undated: Snapshot = { ...(SNAPSHOTS[0] as Snapshot), captured_at: "" };
    const ids = suggestFromLoadedData({ decisions: [], sources: [undated] }).map((s) => s.id);
    expect(ids).toContain("unfetched-sources");
  });
});

describe("missing facts are a stable, unique union of what the decisions report", () => {
  it("de-duplicates across decisions and keeps first-seen order", () => {
    const a = { ...(DECISIONS[0] as Decision), missing_facts: ["nace_code", "employee_count"] };
    const b = { ...(DECISIONS[0] as Decision), missing_facts: ["employee_count", "founded_year"] };
    expect(uniqueMissingFacts([a, b])).toEqual([
      "nace_code",
      "employee_count",
      "founded_year",
    ]);
  });

  it("is empty, not fabricated, when nothing is missing", () => {
    const complete = DECISIONS.map((decision) => ({ ...decision, missing_facts: [] }));
    expect(uniqueMissingFacts(complete)).toEqual([]);
  });

  it("is stable across calls with the same input", () => {
    expect(uniqueMissingFacts(DECISIONS)).toEqual(uniqueMissingFacts(DECISIONS));
  });
});

describe("the data status is derived from real query state, never hard-coded", () => {
  const settled = { isPending: false, isError: false, dataUpdatedAt: 1_760_000_000_000 };

  it("is neither partial nor loading once every query has settled with data", () => {
    const status = deriveDataStatus({
      label: "Karar listesi",
      missing: [],
      queries: [settled, settled],
    });
    expect(status.partial).toBe(false);
    expect(status.loading).toBe(false);
    expect(status.error).toBeNull();
  });

  it("is loading, and therefore partial, while a query is still pending", () => {
    const status = deriveDataStatus({
      label: "Karar listesi",
      missing: [],
      queries: [{ ...settled, isPending: true, dataUpdatedAt: 0 }, settled],
    });
    expect(status.loading).toBe(true);
    expect(status.partial).toBe(true);
  });

  it("is partial and carries the message when a query failed", () => {
    const status = deriveDataStatus({
      label: "Karar listesi",
      missing: [],
      queries: [{ ...settled, isError: true, errorMessage: "Sunucuya ulaşılamıyor." }, settled],
    });
    expect(status.partial).toBe(true);
    expect(status.error).toBe("Sunucuya ulaşılamıyor.");
  });

  it("reports the newest client fetch time, and null when nothing was fetched", () => {
    const newest = deriveDataStatus({
      label: "x",
      missing: [],
      queries: [settled, { ...settled, dataUpdatedAt: 1_760_000_100_000 }],
    });
    expect(newest.lastLoadedAt).toBe(new Date(1_760_000_100_000).toISOString());

    const never = deriveDataStatus({
      label: "x",
      missing: [],
      queries: [{ isPending: true, isError: false, dataUpdatedAt: 0 }],
    });
    expect(never.lastLoadedAt).toBeNull();
  });
});
