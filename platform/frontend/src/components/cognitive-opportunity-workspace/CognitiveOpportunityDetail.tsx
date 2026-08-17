/**
 * The cognitive opportunity detail — clean-room `/firsatlar/:code` surface.
 *
 * Presentational only: the route owns every query and hands down one honest
 * read state. The source ledger carries its own three-way truth, distinct
 * from the programme read: `sources === null` means the registry could not
 * be read at all (`unread`), `sources === []` means it was read and this
 * programme genuinely cites none (`without`), and a non-empty array is the
 * cited evidence (`with`). Collapsing any two of those into one message
 * would tell a reader either "empty" when the read simply failed, or
 * "failed" when the programme simply has no sources — both false.
 */

import type { ReactNode } from "react";

import { EmptyState, ErrorState, Link } from "@/foundation";
import { resolveContent, useContent } from "@/content";

import { CognitiveOpportunityWorkspaceSkeleton } from "./CognitiveOpportunityWorkspaceSkeleton";

import "./cognitive-opportunity-workspace.css";

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

export interface OpportunityDetailProgram {
  readonly code: string;
  readonly name: string;
  readonly version: string;
  readonly support_type: string;
  readonly call_window_state: string;
  readonly official_url: string;
  readonly published_reference: string | null;
  readonly required_documents: readonly string[];
}

export interface OpportunityDetailSource {
  readonly id: string;
  readonly title: string;
  readonly publisher: string;
  readonly url: string;
  readonly captured_at: string;
}

export type OpportunityDetailReadState = "loading" | "session-error" | "error" | "not-found" | "success";

export interface CognitiveOpportunityDetailProps {
  readonly state: OpportunityDetailReadState;
  readonly program?: OpportunityDetailProgram | null;
  /** The requested code, used only to name what could not be found. */
  readonly code?: string;
  /** `null` = registry unread, `[]` = read and empty, else the cited rows. */
  readonly sources?: readonly OpportunityDetailSource[] | null;
  readonly sourcesPending?: boolean;
  readonly sourcesErrorMessage?: string | null;
  readonly onSourcesRetry?: () => void;
  readonly errorMessage?: string | null;
  readonly onRetry?: () => void;
  readonly sessionAction?: ReactNode;
  readonly backHref?: string;
}

export function CognitiveOpportunityDetail({
  state,
  program = null,
  code = "",
  sources = null,
  sourcesPending = false,
  sourcesErrorMessage = null,
  onSourcesRetry,
  errorMessage = null,
  onRetry,
  sessionAction,
  backHref = "/firsatlar",
}: CognitiveOpportunityDetailProps) {
  const backLabel = useContent("opportunity.detail.back_action");
  const identityTitle = useContent("opportunity.detail.section.identity_title");
  const codeFieldLabel = useContent("opportunity.detail.field.code");
  const versionLabel = useContent("opportunity.detail.field.version");
  const supportTypeFieldLabel = useContent("opportunity.detail.field.support_type");
  const callWindowFieldLabel = useContent("opportunity.detail.field.call_window");
  const officialLinkLabel = useContent("opportunity.detail.field.official_link");
  const officialLinkAction = useContent("opportunity.detail.field.official_link_action");
  const officialLinkExternalNote = useContent("opportunity.detail.field.official_link_external_note");
  const publishedReferenceLabel = useContent("opportunity.detail.field.published_reference");
  const publishedReferenceNone = useContent("opportunity.detail.field.published_reference_none");
  const documentsTitle = useContent("opportunity.detail.section.documents_title");
  const documentsEmpty = useContent("opportunity.detail.documents.empty");
  const sourcesTitle = useContent("opportunity.detail.section.sources_title");
  const sourcesCountLabel = useContent("opportunity.detail.sources.count", {
    values: { count: String(sources?.length ?? 0) },
  });
  const sourcesWithoutTitle = useContent("opportunity.detail.sources.without.title");
  const sourcesWithoutReason = useContent("opportunity.detail.sources.without.reason");
  const sourcesUnreadTitle = useContent("opportunity.detail.sources.unread.title");
  const sourcesUnreadReason = useContent("opportunity.detail.sources.unread.reason");
  const capturedAtLabel = useContent("opportunity.detail.source_card.captured_at");
  const openSourceLabel = useContent("opportunity.detail.source_card.open_action");
  const notFoundTitle = useContent("opportunity.detail.not_found.title");
  const notFoundReason = useContent("opportunity.detail.not_found.reason", { values: { code } });
  const sessionErrorTitle = useContent("opportunity.state.session_error.title");
  const sessionErrorReason = useContent("opportunity.state.session_error.reason");
  const genericErrorTitle = useContent("opportunity.state.generic_error.title");
  const genericErrorReason = useContent("opportunity.state.generic_error.reason");
  const retryLabel = useContent("opportunity.state.retry");

  return (
    <div className="cognitive-opportunity-detail" data-state={state}>
      <Link to={backHref} className="cognitive-opportunity-detail__back">
        {backLabel}
      </Link>

      {state === "loading" ? <CognitiveOpportunityWorkspaceSkeleton variant="detail" /> : null}

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

      {state === "not-found" ? <EmptyState title={notFoundTitle} reason={notFoundReason} /> : null}

      {state === "success" && program ? (
        <>
          <div className="cognitive-opportunity-workspace__heading">
            <h1 className="cognitive-opportunity-workspace__title">{program.name}</h1>
            <div className="cognitive-opportunity-detail__badges">
              <span className="fd-badge fd-badge--accent">
                {resolveContent(callWindowVocabId(program.call_window_state))}
              </span>
              <span className="fd-badge fd-badge--neutral">
                {resolveContent(supportTypeVocabId(program.support_type))}
              </span>
            </div>
          </div>

          <section
            className="cognitive-opportunity-detail__section"
            aria-labelledby="cognitive-opportunity-detail-identity"
          >
            <h2 id="cognitive-opportunity-detail-identity" className="cognitive-opportunity-workspace__section-title">
              {identityTitle}
            </h2>
            <dl className="cognitive-opportunity-detail__fields">
              <div className="cognitive-opportunity-detail__field">
                <dt>{codeFieldLabel}</dt>
                <dd className="fd-mono">{program.code}</dd>
              </div>
              <div className="cognitive-opportunity-detail__field">
                <dt>{versionLabel}</dt>
                <dd>{program.version}</dd>
              </div>
              <div className="cognitive-opportunity-detail__field">
                <dt>{supportTypeFieldLabel}</dt>
                <dd>{resolveContent(supportTypeVocabId(program.support_type))}</dd>
              </div>
              <div className="cognitive-opportunity-detail__field">
                <dt>{callWindowFieldLabel}</dt>
                <dd>{resolveContent(callWindowVocabId(program.call_window_state))}</dd>
              </div>
              <div className="cognitive-opportunity-detail__field">
                <dt>{officialLinkLabel}</dt>
                <dd>
                  <Link to={program.official_url} external externalIndicatorLabel={officialLinkExternalNote}>
                    {officialLinkAction}
                  </Link>
                </dd>
              </div>
              <div className="cognitive-opportunity-detail__field">
                <dt>{publishedReferenceLabel}</dt>
                <dd>{program.published_reference ?? publishedReferenceNone}</dd>
              </div>
            </dl>
          </section>

          <section
            className="cognitive-opportunity-detail__section"
            aria-labelledby="cognitive-opportunity-detail-documents"
          >
            <h2 id="cognitive-opportunity-detail-documents" className="cognitive-opportunity-workspace__section-title">
              {documentsTitle}
            </h2>
            {program.required_documents.length === 0 ? (
              <p className="cognitive-opportunity-workspace__lede">{documentsEmpty}</p>
            ) : (
              <ul className="cognitive-opportunity-detail__documents">
                {program.required_documents.map((document) => (
                  <li key={document}>{document}</li>
                ))}
              </ul>
            )}
          </section>

          <section
            className="cognitive-opportunity-detail__section"
            aria-labelledby="cognitive-opportunity-detail-sources"
          >
            <h2 id="cognitive-opportunity-detail-sources" className="cognitive-opportunity-workspace__section-title">
              {sourcesTitle}
            </h2>
            {sources !== null ? (
              <p className="cognitive-opportunity-workspace__lede">{sourcesCountLabel}</p>
            ) : null}

            {sources === null ? (
              sourcesPending ? (
                <CognitiveOpportunityWorkspaceSkeleton variant="detail" />
              ) : (
                <ErrorState
                  title={sourcesUnreadTitle}
                  message={sourcesErrorMessage ?? sourcesUnreadReason}
                  {...(onSourcesRetry ? { onRetry: onSourcesRetry, retryLabel } : {})}
                />
              )
            ) : sources.length === 0 ? (
              <EmptyState title={sourcesWithoutTitle} reason={sourcesWithoutReason} />
            ) : (
              <ul className="cognitive-opportunity-detail__sources">
                {sources.map((source) => (
                  <li key={source.id} className="cognitive-opportunity-detail__source-card">
                    <span className="cognitive-opportunity-detail__source-title">{source.title}</span>
                    <span className="cognitive-opportunity-detail__source-publisher">{source.publisher}</span>
                    <span className="cognitive-opportunity-detail__source-meta">
                      {capturedAtLabel}: {source.captured_at}
                    </span>
                    <Link to={source.url} external>
                      {openSourceLabel}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
