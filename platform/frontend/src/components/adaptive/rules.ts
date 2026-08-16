/**
 * The rules behind the assistant's suggestions.
 *
 * Every one of these reads records the page has *already loaded* and produces
 * a suggestion whose `why` states the count it counted. That is the whole
 * design: two people looking at the same screen get the same suggestion, and
 * anyone can check it by looking at the same table. No model is asked, so
 * nothing here can hallucinate - the worst it can do is be uninteresting.
 *
 * Plain TypeScript, no React and no network, so the rules can be unit-tested
 * on their own and a future provider-backed suggestion has an obvious seam to
 * arrive through: it would carry `basis: "provider"` and be dropped by
 * `renderableSuggestions` until a provider is genuinely connected.
 *
 * **The input types are `Pick`ed from the real API types, not hand-written.**
 * The first version of this file modelled two fields the backend does not have:
 * a singular `snapshot_id` on a decision and a `fetched_at` on a source. The
 * schema declares `source_snapshot_ids` (a list) and `captured_at`. Because the
 * hand-written shapes made both optional, a genuine `Decision` satisfied them
 * and `decision.snapshot_id` was `undefined` on every record - so the "this
 * decision has no source" rule fired for every decision ever loaded, including
 * the ones that cite a source, and nothing failed to compile. Deriving the
 * input from `Decision` and `Snapshot` means the next rename is a build error
 * instead of a confident, permanently wrong suggestion.
 *
 * The one rule that matters most is the last: a decision with missing facts is
 * described as *unanswered*, never as failing. UNKNOWN is not false.
 *
 * This module carries its own copy, separately from the clean-room
 * `@/domain/assistant`, which returns content ids instead. The two are not the
 * same module on purpose - this one belongs to `AdaptiveAssistant` and the old
 * component subtree, and duplicating the small amount of logic here keeps that
 * subtree working unchanged while `/panel` reads copy from JSON exclusively.
 */

import type { Decision, Snapshot } from "@/api/types";

import type { AssistantDataStatus, AssistantSuggestion } from "./types";

/** Exactly the fields of a real `Decision` these rules read. */
export type DecisionFacts = Pick<
  Decision,
  "id" | "outcome" | "missing_facts" | "source_snapshot_ids"
>;

/** Exactly the fields of a real `Snapshot` these rules read. */
export type SnapshotFacts = Pick<Snapshot, "id" | "captured_at">;

export interface AssistantInput {
  readonly decisions: readonly DecisionFacts[];
  readonly sources?: readonly SnapshotFacts[];
  /** Facts the profile has not answered. Shown as unknown, never as "no". */
  readonly missingProfileFacts?: readonly string[];
}

/**
 * The unanswered facts across every loaded decision, each named once.
 *
 * First-seen order, not sorted: the order the decisions arrived in is the only
 * ordering this client can defend, and re-sorting would imply a priority
 * nothing here computed.
 */
export function uniqueMissingFacts(
  decisions: readonly Pick<Decision, "missing_facts">[],
): readonly string[] {
  return [...new Set(decisions.flatMap((decision) => decision.missing_facts))];
}

/**
 * Suggestions derived from loaded records, most actionable first.
 *
 * Returns an empty list rather than a filler suggestion when nothing matches.
 * "Her şey yolunda" is a claim this client cannot make - it has only seen the
 * rows it loaded.
 */
export function suggestFromLoadedData(input: AssistantInput): readonly AssistantSuggestion[] {
  const suggestions: AssistantSuggestion[] = [];
  const { decisions, sources = [], missingProfileFacts = [] } = input;

  const incomplete = decisions.filter((decision) => decision.missing_facts.length > 0);
  if (incomplete.length > 0) {
    suggestions.push({
      id: "missing-facts",
      title: `${incomplete.length} kararda yanıtlanmamış olgu var`,
      why:
        `Yüklenmiş ${decisions.length} kararın ${incomplete.length} tanesinde en az bir olgu ` +
        "yanıtlanmamış. Yanıtlanmamış olgu olumsuz sayılmaz; motor bunu bilinmiyor olarak işler " +
        "ve sonuç yetersiz veri çıkabilir.",
      basis: "loaded-data",
      readFrom: ["degerlendirmeler"],
      nextAction: { label: "Eksik olguları tamamla", to: "/organizasyon/profil" },
    });
  }

  // A decision cites zero or more snapshots. "No source" is an empty list, not
  // an absent scalar - the distinction is the whole reason this rule was wrong.
  const unsourced = decisions.filter((decision) => decision.source_snapshot_ids.length === 0);
  if (unsourced.length > 0) {
    suggestions.push({
      id: "missing-snapshot",
      title: `${unsourced.length} kararın kaynak anlık görüntüsü yok`,
      why:
        `Yüklenmiş kararlardan ${unsourced.length} tanesi bir mevzuat anlık görüntüsüne bağlı ` +
        "değil. Kaynağı olmayan bir karar denetlenemez.",
      basis: "loaded-data",
      readFrom: ["degerlendirmeler"],
      nextAction: { label: "Kaynak kaydını aç", to: "/kaynaklar" },
    });
  }

  if (missingProfileFacts.length > 0) {
    suggestions.push({
      id: "profile-gaps",
      title: `Profilde ${missingProfileFacts.length} olgu yanıtlanmamış`,
      why:
        `Şu olgular bilinmiyor: ${missingProfileFacts.join(", ")}. Bunlar yanıtlanmadan ` +
        "uygunluk yalnızca yetersiz veri olarak sonuçlanabilir.",
      basis: "loaded-data",
      readFrom: ["organizasyon/profil"],
      nextAction: { label: "Profili aç", to: "/organizasyon/profil" },
    });
  }

  // `captured_at` is a required string in the schema, so the honest question is
  // whether it carries a time, not whether the key is present.
  const undated = sources.filter((source) => source.captured_at.trim().length === 0);
  if (undated.length > 0) {
    suggestions.push({
      id: "unfetched-sources",
      title: `${undated.length} kaynağın yakalanma zamanı bilinmiyor`,
      why:
        `Yüklenmiş ${sources.length} kaynağın ${undated.length} tanesinde yakalanma zamanı boş. ` +
        "Tazeliği bilinmeyen bir kaynak güncel sayılmaz.",
      basis: "loaded-data",
      readFrom: ["kaynaklar"],
      nextAction: { label: "Kaynak kaydını aç", to: "/kaynaklar" },
    });
  }

  return suggestions;
}

/* ------------------------------------------------------------- data status */

/**
 * The slice of a TanStack query result the status derivation reads.
 *
 * Structural rather than the library's own type: the derivation is plain
 * TypeScript with no React and no query client, exactly like the rules above,
 * and a route passes the four numbers it already has.
 */
export interface QueryFacts {
  readonly isPending: boolean;
  readonly isError: boolean;
  /** `Date.now()` at the moment *this browser* last received data. */
  readonly dataUpdatedAt: number;
  readonly errorMessage?: string | null;
}

export interface DataStatusInput {
  readonly label: string;
  readonly missing: readonly string[];
  readonly queries: readonly QueryFacts[];
}

/**
 * The panel's self-description, derived rather than declared.
 *
 * `partial: true` used to be a constant, which made it a claim about nothing,
 * and the notice it triggered blamed a backend endpoint that was never missing.
 * A load is partial when this client genuinely does not have all of it: a query
 * still in flight, or one that failed. When every query has answered, the panel
 * says so.
 */
export function deriveDataStatus(input: DataStatusInput): AssistantDataStatus {
  const { label, missing, queries } = input;

  const loading = queries.some((query) => query.isPending);
  const failed = queries.find((query) => query.isError);
  const newest = Math.max(0, ...queries.map((query) => query.dataUpdatedAt));

  return {
    label,
    missing,
    loading,
    error: failed ? failed.errorMessage ?? "Veri yüklenemedi." : null,
    partial: loading || failed !== undefined,
    lastLoadedAt: newest > 0 ? new Date(newest).toISOString() : null,
  };
}
