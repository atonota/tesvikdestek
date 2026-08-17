/**
 * `/firsatlar` and `/firsatlar/:code` — the opportunity workspace, clean-room.
 *
 * Moved out of `routes/app.tsx` so both addresses reach only the clean
 * `CognitiveOpportunityList` / `CognitiveOpportunityDetail` masters and their
 * own foundation, never the rejected visual component graph. This module is
 * presentational data-plumbing only: every query is owned here, one honest
 * read state is derived per surface, and the result is handed to the same
 * masters Storybook renders from `@/components/cognitive-opportunity-workspace`.
 */

import { useLocation, useParams } from "react-router";

import { ApiError, SessionExpiredError, describeError } from "@/api/client";
import { useProgramsQuery, useSnapshotsQuery } from "@/api/queries";
import { Link } from "@/foundation";
import { useContent } from "@/content";
import {
  CognitiveOpportunityDetail,
  CognitiveOpportunityList,
  type OpportunityDetailSource,
} from "@/components/cognitive-opportunity-workspace";

/** True when a read failed because there is no session — the fix is signing in, not retrying. */
function isSessionError(error: unknown): boolean {
  if (error instanceof SessionExpiredError) return true;
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

/** The query parameter the workspace gate reads when it bounces a visitor back in. */
const RETURN_PARAM = "donus";

function SessionLoginAction() {
  const location = useLocation();
  const label = useContent("opportunity.state.session_error.login_action");
  const returnTo = `${location.pathname}${location.search}`;
  return <Link to={`/giris?${RETURN_PARAM}=${encodeURIComponent(returnTo)}`}>{label}</Link>;
}

export function OpportunitiesRoute() {
  const programs = useProgramsQuery();

  if (programs.isPending) {
    return <CognitiveOpportunityList state="loading" />;
  }
  if (programs.isError) {
    if (isSessionError(programs.error)) {
      return <CognitiveOpportunityList state="session-error" sessionAction={<SessionLoginAction />} />;
    }
    return (
      <CognitiveOpportunityList
        state="error"
        errorMessage={describeError(programs.error)}
        onRetry={() => void programs.refetch()}
      />
    );
  }
  if (programs.data.length === 0) {
    return <CognitiveOpportunityList state="empty" />;
  }
  return <CognitiveOpportunityList state="success" programs={programs.data} />;
}

export function OpportunityDetailRoute() {
  const { code = "" } = useParams();
  const programs = useProgramsQuery();
  const snapshots = useSnapshotsQuery();

  if (programs.isPending) {
    return <CognitiveOpportunityDetail state="loading" />;
  }
  if (programs.isError) {
    if (isSessionError(programs.error)) {
      return <CognitiveOpportunityDetail state="session-error" sessionAction={<SessionLoginAction />} />;
    }
    return (
      <CognitiveOpportunityDetail
        state="error"
        errorMessage={describeError(programs.error)}
        onRetry={() => void programs.refetch()}
      />
    );
  }

  const program = programs.data.find((candidate) => candidate.code === code);
  if (!program) {
    return <CognitiveOpportunityDetail state="not-found" code={code} />;
  }

  // The registry either produced rows or it did not, and "did not" is never
  // rendered as "this programme cites nothing".
  let sources: readonly OpportunityDetailSource[] | null = null;
  let sourcesErrorMessage: string | null = null;
  if (snapshots.isSuccess) {
    sources = snapshots.data
      .filter((snapshot) => program.source_snapshot_ids.includes(snapshot.id))
      .map((snapshot) => ({
        id: snapshot.id,
        title: snapshot.title,
        publisher: snapshot.publisher,
        url: snapshot.url,
        captured_at: snapshot.captured_at,
      }));
  } else if (snapshots.isError) {
    sourcesErrorMessage = describeError(snapshots.error);
  }

  return (
    <CognitiveOpportunityDetail
      state="success"
      program={{
        code: program.code,
        name: program.name,
        version: program.version,
        support_type: program.support_type,
        call_window_state: program.call_window_state,
        official_url: program.official_url,
        published_reference: program.published_reference,
        required_documents: program.required_documents,
      }}
      sources={sources}
      sourcesPending={snapshots.isPending}
      sourcesErrorMessage={sourcesErrorMessage}
      onSourcesRetry={() => void snapshots.refetch()}
    />
  );
}
