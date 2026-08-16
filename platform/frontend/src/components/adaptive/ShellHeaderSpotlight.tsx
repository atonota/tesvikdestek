/**
 * The header Spotlight — a search input that expands in place.
 *
 * `Cmd/Ctrl+K` never opens a dialog. It grows the border of *this* input,
 * the one already sitting in the header's context layer, and moves focus
 * into it. That is the whole interaction: no portal, no second element
 * appearing somewhere else, which is what `cognitive-shell-v2.spec.ts`'s
 * "same header input's border expands" assertion is checking by comparing
 * the element's own bounding box before and after the shortcut.
 *
 * Results and the drawer's own command surface
 * (`ShellSidebarCommand`) are two views over the exact same vocabulary
 * resolved by `command.ts` — never two independent guesses at what "karar"
 * should return.
 *
 * Exclusivity with the drawer is read, never negotiated: whenever the
 * drawer is open, the nearest `.dt-spotlight[data-expanded]` container
 * reports `false` regardless of what the input still holds, because the
 * drawer's command surface is the one now claiming the shared listbox role.
 * Reading the drawer's open flag rather than a bespoke "who owns search"
 * flag keeps that rule satisfied by construction — there is only one thing
 * to ask.
 *
 * `aria-expanded` is not an allowed WAI-ARIA attribute on a `searchbox` (or
 * `textbox`) role, so the observable expanded/collapsed state lives on this
 * neutral `data-expanded` container instead — never on the input itself.
 *
 * **Provider status, answer and confirmation are structural, not optional
 * decoration.** The master Spotlight contract carries a title, an honest
 * provider-status line, an AI-answer-with-citations shape and a
 * confirmation-preview shape, because a future connected provider needs
 * somewhere to render into that has already been built, styled and tested -
 * not a feature bolted on the day a provider exists. Today this deployment
 * has none (`NO_ASSISTANT_PROVIDER`), so `providerReason` defaults to that
 * exact reason and `answer`/`confirmation` are left undefined by every real
 * caller; `cognitive-shell.stories.tsx` demonstrates all three with fixture
 * values so the shapes stay visible and reviewable even though nothing in
 * this build can produce them. A fixture is a demonstration of a contract,
 * never a claim about what the running application does.
 */

import { useEffect, useId, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";

import { AppIcon } from "@/components/icons";
import { useUiStore } from "@/store/ui";

import {
  buildCommandVocabulary,
  deriveCommandStatus,
  describeCommandStatus,
  resolveCommandQuery,
  resolveExecuteTarget,
  type CommandEntry,
} from "./command";
import { NO_ASSISTANT_PROVIDER } from "./types";

/** One cited record behind an answer. Never rendered without its source. */
export interface SpotlightCitation {
  readonly id: string;
  readonly title: string;
  readonly meta: string;
}

/**
 * An AI answer, only ever rendered with the citations it was built from.
 *
 * There is no variant of this shape that carries text without `citations`:
 * an answer that names no source is exactly the fabricated finding
 * `AssistantSuggestion.why` (`types.ts`) already refuses to let through
 * elsewhere in this shell.
 */
export interface SpotlightAnswer {
  readonly text: string;
  readonly confidenceLabel: string;
  readonly citations: readonly SpotlightCitation[];
}

/** A write the surface will not perform without an explicit confirm. */
export interface SpotlightConfirmation {
  readonly text: string;
  readonly confirmLabel: string;
  readonly rejectLabel: string;
  readonly onConfirm: () => void;
  readonly onReject: () => void;
}

/**
 * The compact provider-status word beside the input.
 *
 * `DestekTesvik Master Page (standalone).html` carries a short label -
 * "AI hazır" / "AI çalışıyor" / "AI kapalı" - distinct from the full,
 * accessible reason sentence (`providerReason`) that already sits beside it.
 * `unavailable` is the only state a real caller in this deployment can be
 * honest about today, because `NO_ASSISTANT_PROVIDER` names the one real
 * fact: there is no connected provider. `ready`/`busy` exist so a future
 * connected provider - and `cognitive-shell.stories.tsx` today - has a
 * tested surface to render into rather than one invented later.
 */
export type SpotlightProviderStatus = "unavailable" | "ready" | "busy";

function compactStatusLabel(status: SpotlightProviderStatus): string {
  switch (status) {
    case "ready":
      return "AI hazır";
    case "busy":
      return "AI çalışıyor";
    default:
      return "AI kapalı";
  }
}

/** One rule-derived suggestion. Never a claim the surface asked a model for. */
export interface SpotlightSuggestion {
  readonly id: string;
  readonly label: string;
  readonly onRun: () => void;
}

export interface ShellHeaderSpotlightProps {
  readonly navItems: readonly { readonly to: string; readonly label: string }[];
  /** Defaults to `NO_ASSISTANT_PROVIDER` - this deployment has no connected provider. */
  readonly providerReason?: string;
  /** Defaults to `"unavailable"` - see `SpotlightProviderStatus`. */
  readonly providerStatus?: SpotlightProviderStatus;
  /** Demonstration-only in every real caller today; see the file header. */
  readonly answer?: SpotlightAnswer;
  readonly confirmation?: SpotlightConfirmation;
  /**
   * Rule-derived suggestions, standing beside (not inside) the navigation
   * tiles - see `DestekTesvik Master Page (standalone).html`'s "Senin için
   * öneriler" group. No route wires real ones in today, so every real
   * caller omits this and the group renders its own honest empty state;
   * `cognitive-shell.stories.tsx` demonstrates it with fixture values.
   */
  readonly suggestions?: readonly SpotlightSuggestion[];
}

export function ShellHeaderSpotlight({
  navItems,
  providerReason = NO_ASSISTANT_PROVIDER.providerReason,
  providerStatus = "unavailable",
  answer,
  confirmation,
  suggestions,
}: ShellHeaderSpotlightProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [manuallyExpanded, setManuallyExpanded] = useState(false);
  const drawerOpen = useUiStore((state) => state.navDrawerOpen);
  const navigate = useNavigate();
  const location = useLocation();

  const vocabulary: readonly CommandEntry[] = buildCommandVocabulary(navItems);
  const results = resolveCommandQuery(query, vocabulary);
  const status = deriveCommandStatus(query, results);
  const executeTarget = resolveExecuteTarget(results);

  /** The shared drawer claims the listbox role the moment it is open. */
  const expanded = !drawerOpen && (manuallyExpanded || focused);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setManuallyExpanded(true);
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  /**
   * Fully collapses, regardless of why focus is where it is.
   *
   * `onBlur` below deliberately ignores a blur whose `relatedTarget` is still
   * inside this container - the input losing focus to one of its own result
   * buttons is not "the reader left the Spotlight". But `go()` calls this
   * *because* the reader picked a result and is leaving: without resetting
   * `focused` here too, that guard leaves it `true` forever, the input's own
   * `.blur()` call right after fires no second blur event (focus already
   * moved to the button), and the surface stays expanded after the
   * navigation it was supposed to close behind.
   */
  function collapse() {
    setManuallyExpanded(false);
    setFocused(false);
    setQuery("");
  }

  function go(to: string) {
    collapse();
    inputRef.current?.blur();
    navigate(`${to}${location.search}`);
  }

  return (
    <div ref={containerRef} className="dt-spotlight" data-expanded={expanded ? "true" : "false"}>
      <label className="dt-spotlight__field">
        <AppIcon name="search" />
        <input
          ref={inputRef}
          type="search"
          aria-label="Spotlight arama"
          {...(expanded ? { "aria-controls": listboxId } : {})}
          className="dt-spotlight__input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={(event) => {
            const next = event.relatedTarget as Node | null;
            if (next && containerRef.current?.contains(next)) {
              return;
            }
            setFocused(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape" && expanded) {
              event.preventDefault();
              event.stopPropagation();
              collapse();
              inputRef.current?.blur();
            }
            if (event.key === "Enter" && executeTarget !== null) {
              event.preventDefault();
              go(executeTarget.to);
            }
          }}
        />
        {expanded ? null : (
          <span className="dt-spotlight__kbd" aria-hidden="true">
            ⌘K
          </span>
        )}
        {expanded && executeTarget !== null ? (
          <button
            type="button"
            aria-label="Komutu çalıştır"
            className="dt-spotlight__execute"
            onClick={() => go(executeTarget.to)}
          >
            <AppIcon name="next" />
          </button>
        ) : null}
      </label>
      {expanded ? (
        <div className="dt-spotlight__surface">
          <div className="dt-spotlight__surface-head">
            <span className="dt-spotlight__surface-title">
              {query.trim() === "" ? "Nereye gitmek istersin?" : `"${query.trim()}" için sonuçlar`}
            </span>
            <span className="dt-spotlight__provider-compact" data-tone={providerStatus}>
              {compactStatusLabel(providerStatus)}
            </span>
            <span className="dt-spotlight__provider-status" data-tone="unavailable">
              {providerReason}
            </span>
          </div>
          {answer ? (
            <div className="dt-spotlight__answer">
              <p className="dt-spotlight__answer-text">{answer.text}</p>
              <span className="dt-spotlight__answer-confidence">{answer.confidenceLabel}</span>
              <ul className="dt-spotlight__citations">
                {answer.citations.map((citation) => (
                  <li key={citation.id} className="dt-spotlight__citation">
                    <span className="dt-spotlight__citation-title">{citation.title}</span>
                    <span className="dt-spotlight__citation-meta">{citation.meta}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {confirmation ? (
            <div className="dt-spotlight__confirmation" role="group" aria-label="Onay gerekiyor">
              <p className="dt-spotlight__confirmation-text">{confirmation.text}</p>
              <div className="dt-spotlight__confirmation-actions">
                <button
                  type="button"
                  className="dt-spotlight__confirm"
                  onClick={confirmation.onConfirm}
                >
                  {confirmation.confirmLabel}
                </button>
                <button
                  type="button"
                  className="dt-spotlight__reject"
                  onClick={confirmation.onReject}
                >
                  {confirmation.rejectLabel}
                </button>
              </div>
            </div>
          ) : null}
          {query.trim() === "" ? (
            <div className="dt-spotlight__tiles" role="group" aria-label="Gezinme hedefleri">
              {vocabulary.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className="dt-spotlight__tile"
                  onClick={() => go(entry.to)}
                >
                  {entry.label}
                </button>
              ))}
            </div>
          ) : null}
          {query.trim() === "" ? (
            <div className="dt-spotlight__suggestions" role="group" aria-label="Senin için öneriler">
              {suggestions && suggestions.length > 0 ? (
                suggestions.map((suggestion) => (
                  <button
                    key={suggestion.id}
                    type="button"
                    className="dt-spotlight__suggestion"
                    onClick={suggestion.onRun}
                  >
                    {suggestion.label}
                  </button>
                ))
              ) : (
                <p className="dt-spotlight__suggestions-empty">Bu oturum için öneri yok.</p>
              )}
            </div>
          ) : null}
          <div id={listboxId} role="listbox" aria-label="Spotlight sonuçları" className="dt-spotlight__results">
            {status === "results" ? (
              results.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  className="dt-spotlight__option"
                  onClick={() => go(result.to)}
                >
                  {result.label}
                </button>
              ))
            ) : status === "idle" ? null : (
              <p className="dt-spotlight__status">{describeCommandStatus(status)}</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
