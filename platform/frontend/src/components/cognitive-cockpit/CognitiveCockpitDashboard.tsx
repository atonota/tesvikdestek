/**
 * The cognitive cockpit — the clean-room `/panel` master surface.
 *
 * Interaction and visual authority for this package is the design reference
 * with sha256 23c3729ad1856d056699d68503e2d92a0f996ba57f531fe1edc7e00bb85fd146,
 * consulted for behaviour only. Every element below is written from scratch
 * against this product's own tokens, primitives and data — no prototype
 * markup, class name or inline style is copied.
 *
 * This component is presentational: `DashboardRoute` (`src/routes/app.tsx`)
 * owns every query, computes the one read state below and passes real data
 * down. That is what lets Storybook drive all nine states from plain props,
 * with no query client and no network in the catalogue.
 */

import { useMemo, useState, type ReactNode } from "react";

import { Badge, Button, EmptyState, ErrorState, OfflineBanner, PartialDataNotice, Sheet } from "@/foundation";
import { useUiStore } from "@/store/ui";
import { resolveContent, useContent } from "@/content";

import { CognitiveAccountMenu } from "./CognitiveAccountMenu";
import { CognitiveCommandDrawer } from "./CognitiveCommandDrawer";
import { CognitiveCockpitSkeleton } from "./CognitiveCockpitSkeleton";
import { CognitiveSpotlightHeader, type CockpitSearchItem } from "./CognitiveSpotlightHeader";

import "./cognitive-cockpit.css";

/**
 * The nine enterprise read states this cockpit renders explicitly.
 *
 * A read that failed is never folded into `"empty"`, and a search that found
 * nothing is never folded into `"error"` — each is its own branch below, with
 * its own copy, so a reviewer can see which one fired.
 */
export type CockpitReadState =
  | "loading"
  | "empty"
  | "no-result"
  | "error"
  | "partial"
  | "success"
  | "permission"
  | "offline"
  | "stale";

export interface CockpitIdentity {
  readonly organisationLabel: string;
  readonly roleLabel: string;
  readonly isDemo: boolean;
  /** Honest reason the source registry looks stale, or null when it is current. */
  readonly staleSourceNotice?: string | null;
}

export interface CognitiveCockpitDashboardProps {
  readonly state: CockpitReadState;
  readonly identity: CockpitIdentity;
  readonly errorMessage?: string | null;
  readonly onRetry?: () => void;
  readonly searchItems?: readonly CockpitSearchItem[];
  readonly notificationCount?: number;
  readonly onLogout?: () => void;
  readonly loggingOut?: boolean;
  readonly updatedAt?: number | null;
  /** Freshness line under the H1 - when this browser last read the data. */
  readonly readAt?: string | null;
  /** The main canvas — KPI strip, next action, analytics, evidence gaps, audit. */
  readonly mainCanvas?: ReactNode;
  /** The wide context rail — catalog, contextual suggestions, access scope. */
  readonly contextRail?: ReactNode;
}

const STATE_CONTENT_IDS: Record<CockpitReadState, { title: string; reason: string }> = {
  loading: { title: "cockpit.state.loading.title", reason: "cockpit.state.loading.reason" },
  empty: { title: "cockpit.state.empty.title", reason: "cockpit.state.empty.reason" },
  "no-result": { title: "cockpit.state.no_result.title", reason: "cockpit.state.no_result.reason" },
  error: { title: "cockpit.state.error.title", reason: "cockpit.state.error.reason" },
  partial: { title: "cockpit.state.partial.title", reason: "cockpit.state.partial.reason" },
  success: { title: "cockpit.state.success.title", reason: "cockpit.state.success.reason" },
  permission: { title: "cockpit.state.permission.title", reason: "cockpit.state.permission.reason" },
  offline: { title: "cockpit.state.offline.title", reason: "cockpit.state.offline.reason" },
  stale: { title: "cockpit.state.stale.title", reason: "cockpit.state.stale.reason" },
};

function stateCopyFor(state: CockpitReadState): { title: string; reason: string } {
  const ids = STATE_CONTENT_IDS[state];
  return { title: resolveContent(ids.title), reason: resolveContent(ids.reason) };
}

/**
 * The stale-source and permission-denied banners, written locally.
 *
 * The product already has `StaleDataNotice` and `PermissionDenied` at
 * `@/components`, but both are registered Storybook-only surfaces there -
 * `route-registry.test.ts` pins that classification by exact count, and
 * rendering either from a live route would make that pin false. These two are
 * small, honest duplicates scoped to this package rather than a change to a
 * contract this package is not the owner of.
 */
function CockpitStaleBanner({
  notice,
  updatedAt,
  onRefresh,
}: {
  readonly notice: string;
  readonly updatedAt: number | null;
  readonly onRefresh?: () => void;
}) {
  const lastRead = useContent("cockpit.banner.stale.last_read", {
    values: {
      when: updatedAt ? new Date(updatedAt).toLocaleString("tr-TR") : "",
    },
  });
  const refreshLabel = useContent("cockpit.action.refresh");
  return (
    <div className="fd-banner fd-banner--stale" role="status">
      <span>
        {notice}
        {updatedAt ? lastRead : ""}
      </span>
      {onRefresh ? (
        <Button variant="ghost" size="sm" onClick={onRefresh}>
          {refreshLabel}
        </Button>
      ) : null}
    </div>
  );
}

function CockpitPermissionBlock({ action }: { readonly action: string }) {
  const title = useContent("cockpit.state.permission.title");
  const reason = useContent("cockpit.state.permission.action_reason", { values: { action } });
  return (
    <div className="fd-state fd-state--denied" role="alert">
      <h3 className="fd-state__title">{title}</h3>
      <p className="fd-state__reason">{reason}</p>
    </div>
  );
}

/** Filters the search index by label or hint, in Turkish locale order. */
function filterSearch(
  items: readonly CockpitSearchItem[],
  query: string,
): readonly CockpitSearchItem[] {
  const needle = query.trim().toLocaleLowerCase("tr");
  if (needle === "") return [];
  return items.filter(
    (item) =>
      item.label.toLocaleLowerCase("tr").includes(needle) ||
      (item.hint ?? "").toLocaleLowerCase("tr").includes(needle),
  );
}

export function CognitiveCockpitDashboard({
  state,
  identity,
  errorMessage = null,
  onRetry,
  searchItems = [],
  notificationCount = 0,
  onLogout,
  loggingOut = false,
  updatedAt = null,
  readAt = null,
  mainCanvas,
  contextRail,
}: CognitiveCockpitDashboardProps) {
  const theme = useUiStore((store) => store.theme);
  const density = useUiStore((store) => store.density);
  const reducedMotion = useUiStore((store) => store.reducedMotion);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const [spotlightQuery, setSpotlightQuery] = useState("");

  const searchResults = useMemo(
    () => filterSearch(searchItems, spotlightQuery),
    [searchItems, spotlightQuery],
  );

  /**
   * The state actually rendered, once a live search is folded in.
   *
   * A read that succeeded is still `"no-result"` while the reader is looking
   * at zero matches for what they typed — the underlying data state does not
   * change, but the state this screen shows them does.
   */
  const effectiveState: CockpitReadState =
    spotlightQuery.trim() !== "" && searchResults.length === 0 ? "no-result" : state;

  const copy = stateCopyFor(effectiveState);

  const identityAriaLabel = useContent("cockpit.identity.aria_label");
  const demoBadgeLabel = useContent("cockpit.badge.demo");
  const demoBadgeSrDescription = useContent("cockpit.badge.demo_sr");
  const pageTitle = useContent("cockpit.page.title");
  const freshness = useContent("cockpit.identity.freshness", {
    values: { org: identity.organisationLabel, role: identity.roleLabel },
  });
  const freshnessReadAt = useContent("cockpit.identity.freshness_read_at", {
    values: { readAt: readAt ?? "" },
  });
  const partialLabel = useContent("cockpit.banner.partial.label");
  const partialWhat = useContent("cockpit.banner.partial.what");
  const partialBecause = useContent("cockpit.banner.partial.because");
  const permissionAction = useContent("cockpit.state.permission.view_action");
  const offlineLabel = useContent("cockpit.offline.label");
  const offlineMessageWithLastRead = useContent("cockpit.offline.message_with_last_read", {
    values: { when: updatedAt ? new Date(updatedAt).toLocaleString("tr-TR") : "" },
  });
  const offlineMessageNoData = useContent("cockpit.offline.message_no_data");
  const retryLabel = useContent("cockpit.action.retry");

  return (
    <div
      className="cognitive-cockpit"
      data-theme={theme === "system" ? undefined : theme}
      data-density={density}
      data-reduced-motion={reducedMotion ? "true" : "false"}
    >
      <div className="cognitive-cockpit__identity" aria-label={identityAriaLabel}>
        <span className="cognitive-cockpit__org">{identity.organisationLabel}</span>
        <span className="cognitive-cockpit__role">{identity.roleLabel}</span>
        {identity.isDemo ? (
          <Badge tone="warning" srDescription={demoBadgeSrDescription}>
            {demoBadgeLabel}
          </Badge>
        ) : null}
      </div>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <CognitiveSpotlightHeader
          open={spotlightOpen}
          onOpenChange={setSpotlightOpen}
          query={spotlightQuery}
          onQueryChange={setSpotlightQuery}
          results={searchResults}
          notificationCount={notificationCount}
          accountMenu={
            <CognitiveAccountMenu
              organisationLabel={identity.organisationLabel}
              roleLabel={identity.roleLabel}
              loggingOut={loggingOut}
              {...(onLogout ? { onLogout } : {})}
            />
          }
        />
        <CognitiveCommandDrawer
          organisationLabel={identity.organisationLabel}
          roleLabel={identity.roleLabel}
          onNavigate={() => setDrawerOpen(false)}
        />
      </Sheet>

      <main className="cognitive-cockpit__body">
        <div className="cognitive-cockpit__heading">
          <h1 className="cognitive-cockpit__title">{pageTitle}</h1>
          <p className="cognitive-cockpit__freshness">
            {freshness}
            {readAt ? freshnessReadAt : ""}
          </p>
        </div>

        {identity.staleSourceNotice ? (
          <CockpitStaleBanner
            notice={identity.staleSourceNotice}
            updatedAt={updatedAt}
            {...(onRetry ? { onRefresh: onRetry } : {})}
          />
        ) : null}
        {state === "offline" ? (
          <OfflineBanner
            label={offlineLabel}
            message={updatedAt ? offlineMessageWithLastRead : offlineMessageNoData}
          />
        ) : null}
        {state === "partial" ? (
          <PartialDataNotice label={partialLabel} what={partialWhat} because={partialBecause} />
        ) : null}

        {effectiveState === "loading" ? <CognitiveCockpitSkeleton /> : null}
        {effectiveState === "permission" ? <CockpitPermissionBlock action={permissionAction} /> : null}
        {effectiveState === "error" ? (
          <ErrorState
            title={copy.title}
            message={errorMessage ?? copy.reason}
            {...(onRetry ? { onRetry, retryLabel } : {})}
          />
        ) : null}
        {effectiveState === "empty" ? <EmptyState title={copy.title} reason={copy.reason} /> : null}
        {effectiveState === "no-result" ? (
          <p className="cognitive-cockpit__no-result" role="status">
            {copy.reason}
          </p>
        ) : null}

        {["success", "stale", "partial", "offline"].includes(effectiveState) ? (
          <>
            <div className="cognitive-cockpit__main">{mainCanvas}</div>
            <div className="cognitive-cockpit__rail">{contextRail}</div>
          </>
        ) : null}
      </main>
    </div>
  );
}
