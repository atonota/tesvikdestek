/**
 * The `/panel` route — clean-room, W0.
 *
 * Moved out of `routes/app.tsx` so this address reaches only the clean
 * cognitive cockpit master and its own foundation, never the old visual
 * component system. `DashboardRoute` is presentational data-plumbing only:
 * every query is owned here, one honest read state is derived, and the
 * result is handed to `CognitiveCockpitDashboard` from
 * `@/components/cognitive-cockpit` — the same master Storybook renders.
 */

import { useMemo } from "react";
import { useNavigate } from "react-router";

import { describeError } from "@/api/client";
import {
  useDecisionsQuery,
  useLogout,
  useProgramsQuery,
  useReadinessQuery,
  useRunEvaluation,
  useSnapshotsQuery,
} from "@/api/queries";
import { supportTypeLabel, reviewStatusLabel } from "@/api/types";
import { resolveContent, useContent } from "@/content";
import {
  CognitiveAccessScopePanel,
  CognitiveAnalyticsPanel,
  CognitiveAuditTruthBlock,
  CognitiveCatalogPanel,
  CognitiveCockpitDashboard,
  CognitiveEvidenceGapList,
  CognitiveEvidenceRail,
  CognitiveKpiStrip,
  CognitiveNextActionQueue,
  type CockpitReadState,
} from "@/components/cognitive-cockpit";
import {
  evidenceByReviewStatus,
  outcomeDistribution,
  portfolioBySupportType,
  type ReadState,
} from "@/domain/analytics";
import {
  NO_ASSISTANT_PROVIDER,
  deriveDataStatus,
  renderableSuggestions,
  suggestFromLoadedData,
  uniqueMissingFacts,
} from "@/domain/assistant";
import { demoBadgeLabel, useDemoSession } from "@/demo";

/** True when a read failed because there is no session — the fix is signing in, not retrying. */
function isSessionError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    ((error as { status?: number }).status === 401 || (error as { status?: number }).status === 403)
  );
}

function readStateOf<T>(
  data: readonly T[] | undefined,
  isPending: boolean,
  isError: boolean,
  error: unknown,
): ReadState<T> {
  return { isPending, isError, data, reason: isError ? describeError(error) : "" };
}

/** What counts as a genuinely unread figure, never a fabricated zero. */
function countLabel(
  query: { isPending: boolean; isSuccess: boolean; data: readonly unknown[] | undefined },
  readingLabel: string,
  readFailedLabel: string,
): string {
  if (query.isSuccess && query.data !== undefined) return String(query.data.length);
  return query.isPending ? readingLabel : readFailedLabel;
}

/**
 * The one read state the cockpit renders, derived from the four queries this
 * route owns. Precedence: pending outranks everything, a session error
 * outranks a generic one, "every read failed" is `"error"`, "some failed" is
 * `"partial"`, and neither is silently treated as an empty tenant.
 */
function deriveCockpitReadState(reads: {
  readonly decisions: ReturnType<typeof useDecisionsQuery>;
  readonly snapshots: ReturnType<typeof useSnapshotsQuery>;
  readonly programs: ReturnType<typeof useProgramsQuery>;
}): CockpitReadState {
  const { decisions, snapshots, programs } = reads;
  const all = [decisions, snapshots, programs];

  if (all.some((query) => query.isPending)) return "loading";
  if (typeof navigator !== "undefined" && !navigator.onLine) return "offline";
  if (all.some((query) => query.isError && isSessionError(query.error))) return "permission";

  const failed = all.filter((query) => query.isError);
  if (failed.length === all.length) return "error";
  if (failed.length > 0) return "partial";

  if ((decisions.data ?? []).length === 0 && (programs.data ?? []).length === 0) return "empty";

  const staleAfterMs = 15 * 60 * 1000;
  if (decisions.dataUpdatedAt > 0 && Date.now() - decisions.dataUpdatedAt > staleAfterMs) {
    return "stale";
  }

  return "success";
}

export function DashboardRoute() {
  const decisions = useDecisionsQuery();
  const programs = useProgramsQuery();
  const snapshots = useSnapshotsQuery();
  const health = useReadinessQuery();
  const evaluate = useRunEvaluation();
  const logout = useLogout();
  const navigate = useNavigate();
  const demo = useDemoSession();

  const fallbackOrg = useContent("cockpit.identity.fallback_org");
  const superadminRole = useContent("cockpit.identity.role.superadmin");
  const userRole = useContent("cockpit.identity.role.user");
  const staleNotice = useContent("cockpit.state.stale.notice");
  const analyticsCaption = useContent("cockpit.analytics.caption");
  const portfolioTabLabel = useContent("cockpit.analytics.tab.portfolio");
  const outcomesTabLabel = useContent("cockpit.analytics.tab.outcomes");
  const evidenceTabLabel = useContent("cockpit.analytics.tab.evidence");
  const programsCountLabel = useContent("cockpit.catalog.count.programs");
  const decisionsCountLabel = useContent("cockpit.catalog.count.decisions");
  const sourcesCountLabel = useContent("cockpit.catalog.count.sources");
  const pendingEvidenceLabel = useContent("cockpit.kpi.pending_evidence.label");
  const pendingEvidenceHint = useContent("cockpit.kpi.pending_evidence.hint");
  const unverifiedSourcesLabel = useContent("cockpit.kpi.unverified_sources.label");
  const unverifiedSourcesHint = useContent("cockpit.kpi.unverified_sources.hint");
  const openCallsLabel = useContent("cockpit.kpi.open_calls.label");
  const openCallsHint = useContent("cockpit.kpi.open_calls.hint");
  const platformStatusLabel = useContent("cockpit.kpi.platform_status.label");
  const platformStatusHint = useContent("cockpit.kpi.platform_status.hint");
  const readingLabel = useContent("cockpit.data.reading");
  const readFailedLabel = useContent("cockpit.data.read_failed");
  const contextStatusLabel = useContent("cockpit.context.status_label");
  const unavailableValueMark = useContent("cockpit.access.value_dash");
  const providerReason = useContent(NO_ASSISTANT_PROVIDER.providerReasonId);

  const organisationLabel = demo ? demoBadgeLabel(demo.role) : fallbackOrg;
  const roleLabel = demo?.role === "superadmin" ? superadminRole : userRole;

  const loadedDecisions = decisions.data ?? [];
  const loadedPrograms = programs.data ?? [];
  const loadedSnapshots = snapshots.data ?? [];

  const readState = deriveCockpitReadState({ decisions, snapshots, programs });
  const searchItems = loadedDecisions.map((decision) => ({
    id: decision.id,
    label: decision.outcome_label,
    hint: decision.program_code,
    to: `/degerlendirmeler/${decision.id}`,
  }));

  const rawSuggestions =
    decisions.isSuccess && snapshots.isSuccess
      ? suggestFromLoadedData({ decisions: loadedDecisions, sources: loadedSnapshots })
      : [];
  const shownSuggestions = renderableSuggestions(rawSuggestions, NO_ASSISTANT_PROVIDER);
  const railSuggestions = shownSuggestions.map((suggestion) => ({
    id: suggestion.id,
    title: resolveContent(suggestion.titleId, suggestion.titleValues ? { values: suggestion.titleValues } : {}),
    why: resolveContent(suggestion.whyId, suggestion.whyValues ? { values: suggestion.whyValues } : {}),
    actionLabel: resolveContent(suggestion.nextAction.labelId),
    ...(suggestion.nextAction.to ? { to: suggestion.nextAction.to } : {}),
    ...(suggestion.nextAction.onRun ? { onRun: suggestion.nextAction.onRun } : {}),
  }));
  const rawDataStatus = deriveDataStatus({
    label: contextStatusLabel,
    missing: uniqueMissingFacts(loadedDecisions),
    queries: [
      {
        isPending: decisions.isPending,
        isError: decisions.isError,
        dataUpdatedAt: decisions.dataUpdatedAt,
        errorMessage: decisions.isError ? describeError(decisions.error) : null,
      },
      {
        isPending: snapshots.isPending,
        isError: snapshots.isError,
        dataUpdatedAt: snapshots.dataUpdatedAt,
        errorMessage: snapshots.isError ? describeError(snapshots.error) : null,
      },
    ],
  });
  const railStatus = {
    label: rawDataStatus.label,
    lastLoadedAt: rawDataStatus.lastLoadedAt,
    missing: rawDataStatus.missing,
    partial: rawDataStatus.partial,
    ...(rawDataStatus.loading !== undefined ? { loading: rawDataStatus.loading } : {}),
    ...(rawDataStatus.error !== undefined ? { error: rawDataStatus.error } : {}),
  };

  const pendingEvidenceCount = loadedDecisions.filter((d) => d.missing_facts.length > 0).length;
  const unverifiedSourceCount = loadedSnapshots.filter((s) => s.review_status !== "verified").length;
  const openCallCount = loadedPrograms.filter((p) => p.call_window_state === "open").length;
  const kpiTiles = [
    {
      id: "pending-evidence",
      label: pendingEvidenceLabel,
      value: decisions.isSuccess ? String(pendingEvidenceCount) : unavailableValueMark,
      hint: pendingEvidenceHint,
      unavailableReason: decisions.isSuccess ? null : decisions.isPending ? readingLabel : readFailedLabel,
    },
    {
      id: "unverified-sources",
      label: unverifiedSourcesLabel,
      value: snapshots.isSuccess ? String(unverifiedSourceCount) : unavailableValueMark,
      hint: unverifiedSourcesHint,
      unavailableReason: snapshots.isSuccess ? null : snapshots.isPending ? readingLabel : readFailedLabel,
    },
    {
      id: "open-calls",
      label: openCallsLabel,
      value: programs.isSuccess ? String(openCallCount) : unavailableValueMark,
      hint: openCallsHint,
      unavailableReason: programs.isSuccess ? null : programs.isPending ? readingLabel : readFailedLabel,
    },
    {
      id: "platform-status",
      label: platformStatusLabel,
      value: health.isSuccess ? health.data.status : unavailableValueMark,
      hint: platformStatusHint,
      unavailableReason: health.isSuccess ? null : health.isPending ? readingLabel : readFailedLabel,
    },
  ];
  const latestSnapshot = [...loadedSnapshots].sort((a, b) => b.captured_at.localeCompare(a.captured_at))[0];
  const ruleVersionCounts = new Map<string, number>();
  for (const d of loadedDecisions) {
    ruleVersionCounts.set(d.rule_set_version_id, (ruleVersionCounts.get(d.rule_set_version_id) ?? 0) + 1);
  }
  const dominantRuleVersion = [...ruleVersionCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const kpiProvenance = {
    sourceId: latestSnapshot?.id ?? unavailableValueMark,
    capturedAt: latestSnapshot?.captured_at ?? unavailableValueMark,
    ruleVersion: dominantRuleVersion ?? unavailableValueMark,
    calibrationStatus: health.isSuccess ? health.data.status : unavailableValueMark,
  };

  const queueItems = loadedDecisions
    .filter((d) => d.missing_facts.length > 0)
    .sort((a, b) => b.missing_facts.length - a.missing_facts.length)
    .map((d) => ({
      id: d.id,
      title: resolveContent("cockpit.queue.item.title", {
        values: { outcomeLabel: d.outcome_label, programCode: d.program_code },
      }),
      detail: resolveContent("cockpit.queue.item.detail", {
        values: { count: String(d.missing_facts.length) },
      }),
      to: `/degerlendirmeler/${d.id}`,
    }));

  const gapCounts = new Map<string, number>();
  for (const d of loadedDecisions) {
    for (const fact of d.missing_facts) {
      gapCounts.set(fact, (gapCounts.get(fact) ?? 0) + 1);
    }
  }
  const evidenceGaps = [...gapCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([fact, count]) => ({ fact, blockedDecisionCount: count }));

  const catalogCounts = [
    { label: programsCountLabel, value: countLabel(programs, readingLabel, readFailedLabel) },
    { label: decisionsCountLabel, value: countLabel(decisions, readingLabel, readFailedLabel) },
    { label: sourcesCountLabel, value: countLabel(snapshots, readingLabel, readFailedLabel) },
  ];
  const catalogSources = snapshots.isSuccess
    ? [...loadedSnapshots]
        .sort((a, b) => b.captured_at.localeCompare(a.captured_at))
        .slice(0, 5)
        .map((s) => ({
          id: s.id,
          publisher: s.publisher,
          title: s.title,
          capturedAt: new Date(s.captured_at).toLocaleString("tr-TR"),
        }))
    : [];

  const portfolio = useMemo(
    () =>
      portfolioBySupportType(
        readStateOf(programs.data, programs.isPending, programs.isError, programs.error),
        supportTypeLabel,
      ),
    [programs.data, programs.isPending, programs.isError, programs.error],
  );
  const outcomes = useMemo(
    () => outcomeDistribution(readStateOf(decisions.data, decisions.isPending, decisions.isError, decisions.error)),
    [decisions.data, decisions.isPending, decisions.isError, decisions.error],
  );
  const evidence = useMemo(
    () =>
      evidenceByReviewStatus(
        readStateOf(snapshots.data, snapshots.isPending, snapshots.isError, snapshots.error),
        reviewStatusLabel,
      ),
    [snapshots.data, snapshots.isPending, snapshots.isError, snapshots.error],
  );

  return (
    <CognitiveCockpitDashboard
      state={readState}
      identity={{
        organisationLabel,
        roleLabel,
        isDemo: demo !== null,
        staleSourceNotice: readState === "stale" ? staleNotice : null,
      }}
      errorMessage={
        decisions.isError
          ? describeError(decisions.error)
          : snapshots.isError
            ? describeError(snapshots.error)
            : programs.isError
              ? describeError(programs.error)
              : null
      }
      onRetry={() => {
        void decisions.refetch();
        void programs.refetch();
        void snapshots.refetch();
      }}
      searchItems={searchItems}
      notificationCount={loadedDecisions.filter((d) => d.missing_facts.length > 0).length}
      onLogout={() => logout.mutate(undefined, { onSuccess: () => void navigate("/giris") })}
      loggingOut={logout.isPending}
      updatedAt={decisions.dataUpdatedAt}
      readAt={
        decisions.dataUpdatedAt > 0
          ? new Date(decisions.dataUpdatedAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
          : null
      }
      mainCanvas={
        <>
          <CognitiveKpiStrip tiles={kpiTiles} provenance={kpiProvenance} />
          <CognitiveNextActionQueue
            items={queueItems}
            onRunEvaluation={() => evaluate.mutate()}
            running={evaluate.isPending}
            runDisabledReason={evaluate.isError ? describeError(evaluate.error) : null}
          />
          <CognitiveAnalyticsPanel
            caption={analyticsCaption}
            tabs={[
              { key: "portfolio", label: portfolioTabLabel, distribution: portfolio },
              { key: "outcomes", label: outcomesTabLabel, distribution: outcomes },
              { key: "evidence", label: evidenceTabLabel, distribution: evidence },
            ]}
          />
          <CognitiveEvidenceGapList gaps={evidenceGaps} />
          <CognitiveAuditTruthBlock />
        </>
      }
      contextRail={
        <>
          <CognitiveCatalogPanel counts={catalogCounts} sources={catalogSources} />
          <CognitiveEvidenceRail
            suggestions={railSuggestions}
            status={railStatus}
            providerReason={providerReason}
          />
          <CognitiveAccessScopePanel tenantLabel={organisationLabel} roleLabel={roleLabel} isDemo={demo !== null} />
        </>
      }
    />
  );
}
