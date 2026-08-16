/**
 * One command vocabulary, two surfaces.
 *
 * `ShellHeaderSpotlight` and `ShellSidebarCommand` render different chrome —
 * an in-place header input versus a panel inside the drawer — but they must
 * answer the same query with the same results, because a reader who filters
 * "karar" in one and reopens the other is asking the same question twice, not
 * two different products. This module is the one place that resolves a query
 * against the vocabulary, so the two views cannot drift.
 *
 * Plain TypeScript, no React, for the same reason `rules.ts` is: the
 * resolver is a pure function over data the shell already has (the
 * navigation the workspace already renders), so it can be unit-tested on its
 * own and neither view can quietly special-case its own matching.
 *
 * `CommandStatus` deliberately reuses the shape of the truth this repository
 * already insists on for the assistant panel (`NO_ASSISTANT_PROVIDER` in
 * `types.ts`): a surface states what it actually knows — idle, filtering,
 * no results, or one of the conditions below — and never a claim it cannot
 * back. There is no "AI-ready" or "learned preference" state here because
 * this resolver never asked a model anything; it matched substrings against
 * navigation labels this client already had on screen.
 */

import { NO_ASSISTANT_PROVIDER } from "./types";

export interface CommandEntry {
  readonly id: string;
  readonly label: string;
  readonly to: string;
  /** Extra terms that resolve to this entry without appearing in its label. */
  readonly keywords?: readonly string[];
}

/** What a resolved entry carries back to the caller: itself, unchanged. */
export type CommandResult = CommandEntry;

/**
 * Every condition a command surface may honestly be in.
 *
 * `idle`: no query typed yet. `results`: at least one match. `no-results`: a
 * query that matched nothing — stated, never silent. The remaining five are
 * conditions this resolver cannot itself produce (it is synchronous and
 * local), catalogued in Storybook because a *future* provider-backed
 * vocabulary would need to represent every one of them honestly rather than
 * inventing a sixth, friendlier state.
 */
export type CommandStatus =
  | "idle"
  | "results"
  | "no-results"
  | "loading"
  | "ai-unavailable"
  | "offline"
  | "permission"
  | "error"
  | "partial";

/** One line of Turkish for each status, never a fabricated success claim. */
export function describeCommandStatus(status: CommandStatus): string {
  switch (status) {
    case "idle":
      return "Aramak için yazmaya başlayın.";
    case "results":
      return "";
    case "no-results":
      return "Sonuç bulunamadı.";
    case "loading":
      return "Yükleniyor…";
    case "ai-unavailable":
      return NO_ASSISTANT_PROVIDER.providerReason;
    case "offline":
      return "Çevrimdışısınız. Arama şu anda yalnızca zaten yüklenmiş gezinme hedeflerini tarar.";
    case "permission":
      return "Bu aramayı çalıştırmak için izniniz yok.";
    case "error":
      return "Arama sırasında bir hata oluştu.";
    case "partial":
      return "Kısmi sonuç: bazı hedefler bu taramaya dahil edilemedi.";
    default:
      return "";
  }
}

/** Turkish-aware case folding, so "Kararlar" matches "karar" and "KARAR" alike. */
function fold(value: string): string {
  return value.toLocaleLowerCase("tr-TR").trim();
}

/** Builds the shared vocabulary from the navigation the shell already renders. */
export function buildCommandVocabulary(
  navItems: readonly { readonly to: string; readonly label: string }[],
): readonly CommandEntry[] {
  return navItems.map((item) => ({ id: item.to, label: item.label, to: item.to }));
}

/** Resolves a query against the vocabulary. Empty query resolves to nothing. */
export function resolveCommandQuery(
  query: string,
  vocabulary: readonly CommandEntry[],
): readonly CommandResult[] {
  const needle = fold(query);
  if (needle === "") return [];
  return vocabulary.filter((entry) => {
    if (fold(entry.label).includes(needle)) return true;
    return (entry.keywords ?? []).some((keyword) => fold(keyword).includes(needle));
  });
}

/** The status a surface should honestly report for a query and its results. */
export function deriveCommandStatus(
  query: string,
  results: readonly CommandResult[],
): CommandStatus {
  if (query.trim() === "") return "idle";
  return results.length > 0 ? "results" : "no-results";
}

/**
 * What the execute affordance (the → button, and Enter) runs.
 *
 * The first result, and only when there is exactly one query resolved
 * against the shared vocabulary - never a guess among several matches. Two
 * or more results means the query is still ambiguous, and the honest action
 * is to let the reader pick one, not to run whichever sorted first.
 */
export function resolveExecuteTarget(
  results: readonly CommandResult[],
): CommandResult | null {
  return results.length === 1 ? results[0]! : null;
}
