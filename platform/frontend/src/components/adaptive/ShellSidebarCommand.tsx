/**
 * The drawer's command surface — the same vocabulary as the header
 * Spotlight, rendered as a panel instead of an in-place expansion.
 *
 * This is what the hamburger focuses, and it is what the shared drawer's
 * single result surface becomes once the drawer is open — the header
 * Spotlight reads that fact from `navDrawerOpen` and reports itself
 * collapsed, so only one listbox is ever the "expanded" one at a time. See
 * `ShellHeaderSpotlight` for that half of the rule and `command.ts` for the
 * resolver both surfaces share.
 *
 * Escape does **not** get handled here. `@radix-ui/react-dismissable-layer`
 * listens for it on `document`, in the capture phase, ahead of any bubbling
 * handler this input could attach - so a local `preventDefault()` in an
 * `onKeyDown` here always loses the race and the dialog closes anyway.
 * `AdaptiveShell`'s `ShellDrawer` owns the unwind instead, through the
 * `Dialog.Content`'s own `onEscapeKeyDown` prop: Radix calls that *before*
 * deciding to close, which is the one hook that runs early enough to clear
 * this input's query on the first press and let the second one through.
 *
 * **Controlled, not self-owned.** The query itself lives one level up, in
 * `AdaptiveShell`'s `ShellDrawer` — the same reference the sidebar filters
 * (`DestekTesvik Sidebar 3a (standalone).html`) drives its search field and
 * its accordion from one query, not two. `ShellSidebarNav` reads the exact
 * same `query` prop to auto-expand and filter its own sections, so there is
 * one field, not a field with its own private copy sitting beside a second
 * one the accordion never sees.
 */

import { useId } from "react";
import { useLocation, useNavigate } from "react-router";

import { AppIcon } from "@/components/icons";

import {
  buildCommandVocabulary,
  deriveCommandStatus,
  describeCommandStatus,
  resolveCommandQuery,
  resolveExecuteTarget,
  type CommandEntry,
} from "./command";

export interface ShellSidebarCommandProps {
  readonly navItems: readonly { readonly to: string; readonly label: string }[];
  readonly query: string;
  readonly onQueryChange: (query: string) => void;
  readonly onNavigate?: () => void;
}

export function ShellSidebarCommand({
  navItems,
  query,
  onQueryChange,
  onNavigate,
}: ShellSidebarCommandProps) {
  const listboxId = useId();
  const navigate = useNavigate();
  const location = useLocation();

  const vocabulary: readonly CommandEntry[] = buildCommandVocabulary(navItems);
  const results = resolveCommandQuery(query, vocabulary);
  const status = deriveCommandStatus(query, results);
  const executeTarget = resolveExecuteTarget(results);
  const showsPanel = status !== "idle";
  const showsResults = status === "results";

  function go(to: string) {
    onQueryChange("");
    onNavigate?.();
    navigate(`${to}${location.search}`);
  }

  /**
   * A real count, never a fabricated readiness claim.
   *
   * The reference this surface follows pairs its search field with a status
   * row - a match count, or an "AI ready" badge this repository has no
   * provider to back. Only the count is honest here: it is the same
   * navigation vocabulary the drawer already renders, counted rather than
   * guessed at.
   */
  const statusLine =
    status === "idle"
      ? `${vocabulary.length} gezinme hedefi`
      : status === "results"
        ? `${results.length} sonuç eşleşti`
        : describeCommandStatus(status);

  return (
    <div className="dt-drawer__command" data-expanded={showsPanel ? "true" : "false"}>
      <label className="dt-drawer__command-field">
        <AppIcon name="search" />
        <span className="sr-only">Ara</span>
        <input
          type="search"
          aria-label="Gezinme içinde ara"
          {...(showsResults ? { "aria-controls": listboxId } : {})}
          className="dt-drawer__command-input"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && executeTarget !== null) {
              event.preventDefault();
              go(executeTarget.to);
            }
          }}
        />
        {executeTarget !== null ? (
          <button
            type="button"
            aria-label="Çalıştır"
            className="dt-drawer__command-execute"
            onClick={() => go(executeTarget.to)}
          >
            <AppIcon name="next" />
          </button>
        ) : null}
      </label>
      <p className="dt-drawer__command-status">{statusLine}</p>
      {showsResults ? (
        <div id={listboxId} role="listbox" aria-label="Arama sonuçları" className="dt-drawer__command-results">
          {results.map((result) => (
            <button
              key={result.id}
              type="button"
              role="option"
              aria-selected={false}
              className="dt-drawer__command-option"
              onClick={() => go(result.to)}
            >
              {result.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
