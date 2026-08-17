/**
 * The cognitive opportunity list — clean-room `/firsatlar` discovery surface.
 *
 * Presentational only: the route owns every query and hands down one honest
 * read state, exactly as `CognitiveCockpitDashboard` does for `/panel`. Two
 * distinct "nothing to show" states exist because they are not the same
 * fact: `state="empty"` means the catalogue itself has no programme, and a
 * filtered-to-zero result inside `state="success"` means the catalogue has
 * programmes but this search and filter combination matched none of them.
 */

import { useMemo, useState, type ReactNode } from "react";

import { EmptyState, ErrorState, FoundationIcon, Link } from "@/foundation";
import { resolveContent, useContent } from "@/content";

import { CognitiveOpportunityWorkspaceSkeleton } from "./CognitiveOpportunityWorkspaceSkeleton";

import "./cognitive-opportunity-workspace.css";

/**
 * Content-id lookups for the backend's open vocabularies. Every visible
 * word still comes from `@/content` — these only decide which entry id a
 * given backend value maps to, falling back to "unknown" for a value
 * neither list has seen yet.
 */
const KNOWN_CALL_WINDOW_STATES = new Set(["open", "closed"]);
const KNOWN_SUPPORT_TYPES = new Set(["grant", "loan", "guarantee", "tax_incentive", "equity", "in_kind"]);

function callWindowVocabId(state: string): string {
  const key = KNOWN_CALL_WINDOW_STATES.has(state) ? state : "unknown";
  return `opportunity.state.vocab.call_window.${key}`;
}

function supportTypeVocabId(type: string): string {
  const key = KNOWN_SUPPORT_TYPES.has(type) ? type : "unknown";
  return `opportunity.state.vocab.support_type.${key}`;
}

export interface OpportunityListProgram {
  readonly code: string;
  readonly name: string;
  readonly support_type: string;
  readonly call_window_state: string;
}

export type OpportunityListReadState = "loading" | "empty" | "session-error" | "error" | "success";

export interface CognitiveOpportunityListProps {
  readonly state: OpportunityListReadState;
  readonly programs?: readonly OpportunityListProgram[];
  readonly hrefFor?: (program: OpportunityListProgram) => string;
  readonly errorMessage?: string | null;
  readonly onRetry?: () => void;
  /** A way back in (e.g. a login link), rendered only for `state="session-error"`. */
  readonly sessionAction?: ReactNode;
  /** Storybook/testing hook to preset the search box to a non-matching query. */
  readonly initialSearch?: string;
}

const ALL_VALUE = "";

export function CognitiveOpportunityList({
  state,
  programs = [],
  hrefFor = (program) => `/firsatlar/${program.code}`,
  errorMessage = null,
  onRetry,
  sessionAction,
  initialSearch = "",
}: CognitiveOpportunityListProps) {
  const [search, setSearch] = useState(initialSearch);
  const [supportType, setSupportType] = useState(ALL_VALUE);
  const [callWindow, setCallWindow] = useState(ALL_VALUE);

  const pageTitle = useContent("opportunity.list.page_title");
  const lede = useContent("opportunity.list.lede");
  const searchLabel = useContent("opportunity.list.search.label");
  const searchPlaceholder = useContent("opportunity.list.search.placeholder");
  const supportTypeLabel = useContent("opportunity.list.filter.support_type.label");
  const supportTypeAll = useContent("opportunity.list.filter.support_type.all");
  const callWindowLabel = useContent("opportunity.list.filter.call_window.label");
  const callWindowAll = useContent("opportunity.list.filter.call_window.all");
  const resetLabel = useContent("opportunity.list.filter.reset");
  const viewActionLabel = useContent("opportunity.list.card.view_action");
  const codeLabel = useContent("opportunity.list.card.code_label");
  const emptyTitle = useContent("opportunity.list.empty.title");
  const emptyReason = useContent("opportunity.list.empty.reason");
  const filteredEmptyTitle = useContent("opportunity.list.filtered_empty.title");
  const filteredEmptyReason = useContent("opportunity.list.filtered_empty.reason");
  const sessionErrorTitle = useContent("opportunity.state.session_error.title");
  const sessionErrorReason = useContent("opportunity.state.session_error.reason");
  const genericErrorTitle = useContent("opportunity.state.generic_error.title");
  const genericErrorReason = useContent("opportunity.state.generic_error.reason");
  const retryLabel = useContent("opportunity.state.retry");

  const supportTypes = useMemo(
    () => [...new Set(programs.map((program) => program.support_type))],
    [programs],
  );
  const callWindows = useMemo(
    () => [...new Set(programs.map((program) => program.call_window_state))],
    [programs],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("tr");
    return programs.filter((program) => {
      if (supportType && program.support_type !== supportType) return false;
      if (callWindow && program.call_window_state !== callWindow) return false;
      if (!needle) return true;
      return (
        program.name.toLocaleLowerCase("tr").includes(needle) ||
        program.code.toLocaleLowerCase("tr").includes(needle)
      );
    });
  }, [programs, search, supportType, callWindow]);

  const resultCountLabel = useContent("opportunity.list.result_count", {
    values: { count: String(filtered.length) },
  });

  return (
    <div className="cognitive-opportunity-list" data-state={state}>
      <div className="cognitive-opportunity-workspace__heading">
        <h1 className="cognitive-opportunity-workspace__title">{pageTitle}</h1>
        <p className="cognitive-opportunity-workspace__lede">{lede}</p>
      </div>

      {state === "loading" ? <CognitiveOpportunityWorkspaceSkeleton variant="list" /> : null}

      {state === "session-error" ? (
        <div className="fd-state fd-state--denied" role="alert">
          <h3 className="fd-state__title">{sessionErrorTitle}</h3>
          <p className="fd-state__reason">{sessionErrorReason}</p>
          {sessionAction ? <div className="fd-state__action">{sessionAction}</div> : null}
        </div>
      ) : null}

      {state === "error" ? (
        <ErrorState
          title={genericErrorTitle}
          message={errorMessage ?? genericErrorReason}
          {...(onRetry ? { onRetry, retryLabel } : {})}
        />
      ) : null}

      {state === "empty" ? <EmptyState title={emptyTitle} reason={emptyReason} /> : null}

      {state === "success" ? (
        <>
          <div className="cognitive-opportunity-list__controls">
            <label className="cognitive-opportunity-list__search">
              <span className="fd-visually-hidden">{searchLabel}</span>
              <FoundationIcon name="search" />
              <input
                type="search"
                value={search}
                placeholder={searchPlaceholder}
                onChange={(event) => setSearch(event.currentTarget.value)}
              />
            </label>

            <label className="cognitive-opportunity-list__filter">
              <span>{supportTypeLabel}</span>
              <select
                value={supportType}
                onChange={(event) => setSupportType(event.currentTarget.value)}
              >
                <option value={ALL_VALUE}>{supportTypeAll}</option>
                {supportTypes.map((value) => (
                  <option key={value} value={value}>
                    {resolveContent(supportTypeVocabId(value))}
                  </option>
                ))}
              </select>
            </label>

            <label className="cognitive-opportunity-list__filter">
              <span>{callWindowLabel}</span>
              <select
                value={callWindow}
                onChange={(event) => setCallWindow(event.currentTarget.value)}
              >
                <option value={ALL_VALUE}>{callWindowAll}</option>
                {callWindows.map((value) => (
                  <option key={value} value={value}>
                    {resolveContent(callWindowVocabId(value))}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className="fd-btn fd-btn--secondary fd-btn--sm"
              onClick={() => {
                setSearch("");
                setSupportType(ALL_VALUE);
                setCallWindow(ALL_VALUE);
              }}
            >
              {resetLabel}
            </button>
          </div>

          <p className="cognitive-opportunity-list__result-count" role="status">
            {resultCountLabel}
          </p>

          {filtered.length === 0 ? (
            <EmptyState title={filteredEmptyTitle} reason={filteredEmptyReason} />
          ) : (
            <ul className="cognitive-opportunity-list__grid">
              {filtered.map((program) => (
                <li key={program.code} className="cognitive-opportunity-list__row">
                  <Link to={hrefFor(program)} className="cognitive-opportunity-list__card">
                    <div className="cognitive-opportunity-list__card-heading">
                      <span className="cognitive-opportunity-list__card-name">{program.name}</span>
                      <span className="cognitive-opportunity-list__card-code">
                        {codeLabel}: {program.code}
                      </span>
                    </div>
                    <div className="cognitive-opportunity-list__card-badges">
                      <span className="fd-badge fd-badge--accent">
                        {resolveContent(callWindowVocabId(program.call_window_state))}
                      </span>
                      <span className="fd-badge fd-badge--neutral">
                        {resolveContent(supportTypeVocabId(program.support_type))}
                      </span>
                    </div>
                    <span className="cognitive-opportunity-list__card-action">{viewActionLabel}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </div>
  );
}
