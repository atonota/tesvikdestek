/**
 * The assistant surface contract and its rules — plain TypeScript, no React,
 * and zero embedded copy.
 *
 * Moved here from `@/components/adaptive` so the clean-room cognitive cockpit
 * can read the same facts (which decisions a rule read, which facts are
 * unanswered, whether a read is partial) without depending on the old visual
 * component system. `@/components/adaptive/types` and `.../rules` re-export
 * from this module for the older `AdaptiveAssistant` surfaces during the
 * transition.
 *
 * This module returns **content ids and interpolation values**, never
 * rendered text: `json-content-authority-contract.test.ts` scans it for
 * visible copy, and `/panel` (`routes/panel.tsx`) is the one place that turns
 * an id into a string, via `@/content`. A caller elsewhere in the old
 * component tree that still wants plain text may resolve these ids itself;
 * nothing here does it on their behalf.
 *
 * The load-bearing decision is `SuggestionBasis`: a suggestion either came
 * from data this client already has on screen, or it came from a provider.
 * Those are different claims with different trust, and there is no third
 * value meaning "probably fine".
 */

import type { Decision, Snapshot } from "@/api/types";

/** Whether a real provider is behind this surface. Absent is the default. */
export type AssistantProviderState = "absent" | "declared" | "connected";

/**
 * Where a suggestion came from.
 *
 * `loaded-data` is a deterministic rule over records already fetched - it is
 * reproducible, and the component says which records it read. `provider` needs
 * a connected provider and is refused without one.
 */
export type SuggestionBasis = "loaded-data" | "provider";

export interface AssistantAction {
  /** Content id for the action's label — resolved by the caller. */
  readonly labelId: string;
  /** Internal route. Actions never mutate from inside this component. */
  readonly to?: string;
  readonly onRun?: () => void;
}

export interface AssistantSuggestion {
  readonly id: string;
  /** Content id for the suggestion's title. */
  readonly titleId: string;
  readonly titleValues?: Readonly<Record<string, string>>;
  /** Content id for why this was suggested — required: an unexplained suggestion is an instruction. */
  readonly whyId: string;
  readonly whyValues?: Readonly<Record<string, string>>;
  readonly basis: SuggestionBasis;
  /** Which loaded records the rule read. Empty for provider suggestions. */
  readonly readFrom: readonly string[];
  readonly nextAction: AssistantAction;
}

/**
 * What the surface knows about its own inputs.
 *
 * `missing` is a list of facts nobody has answered. It is rendered as unknown,
 * never as "no" - the engine treats absence as UNKNOWN, and a panel that
 * displayed it as a negative would be the same lie in a friendlier font.
 *
 * `loading`, `error` and `partial` are *derived* from real query state by
 * `deriveDataStatus`, never declared. `error` is the already-localized
 * message the caller supplied for the failed query, passed through as-is —
 * this module invents no fallback text of its own.
 */
export interface AssistantDataStatus {
  readonly label: string;
  readonly lastLoadedAt: string | null;
  readonly missing: readonly string[];
  readonly partial: boolean;
  readonly loading?: boolean;
  readonly error?: string | null;
}

export interface AssistantCapabilities {
  readonly providerState: AssistantProviderState;
  /** Content id for why there is no provider, when there is none. Rendered, never hidden. */
  readonly providerReasonId: string;
}

export const NO_ASSISTANT_PROVIDER: AssistantCapabilities = {
  providerState: "absent",
  providerReasonId: "cockpit.provider.no_provider_reason",
};

/**
 * Suggestions this surface is allowed to render.
 *
 * The filter is the invariant: without a connected provider, a
 * `provider`-based suggestion is dropped rather than shown greyed out, because
 * a greyed-out answer is still an answer on the screen.
 */
export function renderableSuggestions(
  suggestions: readonly AssistantSuggestion[],
  capabilities: AssistantCapabilities,
): readonly AssistantSuggestion[] {
  return suggestions
    .filter((suggestion) => suggestion.whyId.trim().length > 0)
    .filter(
      (suggestion) =>
        suggestion.basis === "loaded-data" || capabilities.providerState === "connected",
    );
}

export function suppressedSuggestionCount(
  suggestions: readonly AssistantSuggestion[],
  capabilities: AssistantCapabilities,
): number {
  return suggestions.length - renderableSuggestions(suggestions, capabilities).length;
}

/* --------------------------------------------------------------- the rules */

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
 * Returns an empty list rather than a filler suggestion when nothing matches
 * - this client cannot claim "her şey yolunda", it has only seen the rows it
 * loaded. Every suggestion carries a content id and the raw values a caller
 * interpolates into it; no sentence is assembled here.
 */
export function suggestFromLoadedData(input: AssistantInput): readonly AssistantSuggestion[] {
  const suggestions: AssistantSuggestion[] = [];
  const { decisions, sources = [], missingProfileFacts = [] } = input;

  const incomplete = decisions.filter((decision) => decision.missing_facts.length > 0);
  if (incomplete.length > 0) {
    suggestions.push({
      id: "missing-facts",
      titleId: "cockpit.suggestion.missing_facts.title",
      titleValues: { count: String(incomplete.length) },
      whyId: "cockpit.suggestion.missing_facts.why",
      whyValues: { total: String(decisions.length), count: String(incomplete.length) },
      basis: "loaded-data",
      readFrom: ["degerlendirmeler"],
      nextAction: {
        labelId: "cockpit.suggestion.missing_facts.action_label",
        to: "/organizasyon/profil",
      },
    });
  }

  const unsourced = decisions.filter((decision) => decision.source_snapshot_ids.length === 0);
  if (unsourced.length > 0) {
    suggestions.push({
      id: "missing-snapshot",
      titleId: "cockpit.suggestion.missing_snapshot.title",
      titleValues: { count: String(unsourced.length) },
      whyId: "cockpit.suggestion.missing_snapshot.why",
      whyValues: { count: String(unsourced.length) },
      basis: "loaded-data",
      readFrom: ["degerlendirmeler"],
      nextAction: { labelId: "cockpit.suggestion.missing_snapshot.action_label", to: "/kaynaklar" },
    });
  }

  if (missingProfileFacts.length > 0) {
    suggestions.push({
      id: "profile-gaps",
      titleId: "cockpit.suggestion.profile_gaps.title",
      titleValues: { count: String(missingProfileFacts.length) },
      whyId: "cockpit.suggestion.profile_gaps.why",
      whyValues: { facts: missingProfileFacts.join(", ") },
      basis: "loaded-data",
      readFrom: ["organizasyon/profil"],
      nextAction: {
        labelId: "cockpit.suggestion.profile_gaps.action_label",
        to: "/organizasyon/profil",
      },
    });
  }

  const undated = sources.filter((source) => source.captured_at.trim().length === 0);
  if (undated.length > 0) {
    suggestions.push({
      id: "unfetched-sources",
      titleId: "cockpit.suggestion.unfetched_sources.title",
      titleValues: { count: String(undated.length) },
      whyId: "cockpit.suggestion.unfetched_sources.why",
      whyValues: { total: String(sources.length), count: String(undated.length) },
      basis: "loaded-data",
      readFrom: ["kaynaklar"],
      nextAction: {
        labelId: "cockpit.suggestion.unfetched_sources.action_label",
        to: "/kaynaklar",
      },
    });
  }

  return suggestions;
}

/* ------------------------------------------------------------- data status */

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
 * A load is partial when this client genuinely does not have all of it: a
 * query still in flight, or one that failed. When every query has answered,
 * the panel says so. `error` is passed through from the failed query's own
 * `errorMessage` — already localized by the caller (`describeError`) — with
 * no invented fallback sentence.
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
    error: failed ? (failed.errorMessage ?? null) : null,
    partial: loading || failed !== undefined,
    lastLoadedAt: newest > 0 ? new Date(newest).toISOString() : null,
  };
}
