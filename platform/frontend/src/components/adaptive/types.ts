/**
 * The adaptive surface contract.
 *
 * Plain TypeScript, no React, so a future backend port has one place to satisfy
 * and the rules below can be asserted in a unit test.
 *
 * The load-bearing decision is `SuggestionBasis`. A suggestion either came from
 * data this client already has on screen, or it came from a provider. Those are
 * different claims with different trust, and collapsing them is exactly how an
 * "AI assistant" starts presenting a guess as a finding. There is no third
 * value meaning "probably fine".
 */

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
  readonly label: string;
  /** Internal route. Actions never mutate from inside this component. */
  readonly to?: string;
  readonly onRun?: () => void;
}

export interface AssistantSuggestion {
  readonly id: string;
  readonly title: string;
  /** Required and non-empty: an unexplained suggestion is an instruction. */
  readonly why: string;
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
 * `deriveDataStatus`, never declared. `partial: true` was previously a constant
 * in the dashboard, which made it a claim about nothing and dragged an invented
 * backend limitation along with it.
 */
export interface AssistantDataStatus {
  readonly label: string;
  /**
   * When *this browser* last received the data - TanStack's `dataUpdatedAt`,
   * not a capture or publication time. The API returns no such time for a
   * decision list, so the panel says which one it is showing rather than
   * letting the reader assume the stronger of the two.
   */
  readonly lastLoadedAt: string | null;
  readonly missing: readonly string[];
  readonly partial: boolean;
  /** A query is still in flight, so the panel has seen less than the whole. */
  readonly loading?: boolean;
  /** Already-translated failure text when a query failed, otherwise null. */
  readonly error?: string | null;
}

export interface AssistantCapabilities {
  readonly providerState: AssistantProviderState;
  /** Why there is no provider, when there is none. Rendered, never hidden. */
  readonly providerReason: string;
}

export const NO_ASSISTANT_PROVIDER: AssistantCapabilities = {
  providerState: "absent",
  providerReason:
    "Bu kurulumda bağlı bir yapay zekâ sağlayıcısı yok. Aşağıdaki öneriler ekrandaki verilerden kural ile üretilir; hiçbiri bir modele sorulmadı.",
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
    .filter((suggestion) => suggestion.why.trim().length > 0)
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
