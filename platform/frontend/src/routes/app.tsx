/** Authenticated surfaces: dashboard, discovery, decision workspace, settings, ops. */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  NavLink,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router";

import { SessionExpiredError, describeError, type ApprovalRecord } from "@/api/client";
import {
  useDecisionQuery,
  useDecisionsQuery,
  useLogout,
  useProgramsQuery,
  useReadinessQuery,
  useRecordApproval,
  useRunEvaluation,
  useSaveProfile,
  useSnapshotsQuery,
} from "@/api/queries";
import {
  AdaptiveShell,
  ApprovalForm,
  Badge,
  Button,
  CapabilityMatrix,
  CatalogList,
  DecisionCompare,
  DecisionDetail,
  DecisionList,
  EligibilityWizard,
  EmptyState,
  ErrorState,
  Link,
  MaturityRadar,
  OpportunityDetail,
  OpsHealth,
  PartialDataNotice,
  ProfileWorkspace,
  PublicShell,
  ReadinessTemplate,
  SettingsPanel,
  SkeletonBlock,
  SourceRegistry,
  SourceSnapshotCard,
  Switch,
  UnreadSourceRegistry,
  RadioGroup,
  WorkspaceShell,
  NO_ASSISTANT_PROVIDER,
  deriveDataStatus,
  readSourceRegistry,
  suggestFromLoadedData,
  uniqueMissingFacts,
  type ConversionAction,
} from "@/components";
import {
  CognitiveAccessScopePanel,
  CognitiveAuditTruthBlock,
  CognitiveCatalogPanel,
  CognitiveCockpitDashboard,
  CognitiveEvidenceGapList,
  CognitiveEvidenceRail,
  CognitiveAnalyticsPanel,
  CognitiveKpiStrip,
  CognitiveNextActionQueue,
  type CockpitReadState,
} from "@/components/cognitive-cockpit";
/**
 * The distribution maths, imported normally on purpose.
 *
 * It is plain TypeScript with no chart engine behind it, so a screen that
 * only needs the numbers never pays for the drawing. `CognitiveAnalyticsPanel`
 * is what now owns the drawing half, behind its own lazy boundary.
 */
import {
  evidenceByReviewStatus,
  outcomeDistribution,
  portfolioBySupportType,
  type ReadState,
} from "@/components/analytics/model";
import { AppIcon } from "@/components/icons";
import {
  DEMO_ROLE_PARAM,
  demoBadgeLabel,
  isStaticDemoOnly,
  parseDemoRole,
  startDemoSession,
  useDemoSession,
  wasDemoEndedHere,
  withDemoRole,
  withoutDemoRole,
} from "@/demo";
import { supportTypeLabel, reviewStatusLabel } from "@/api/types";
import { resolveContent, useContent } from "@/content";
import { calculateMaturity } from "@/domain/maturity";
import { emptyProfileValues } from "@/domain/facts";
import { useUiStore, type Density, type FontScale, type ThemeChoice } from "@/store/ui";
import { loginHref } from "./auth";
import { QueryBoundary, SessionRequired, isSessionError } from "./QueryBoundary";

/**
 * The workspace's destinations, with real icons.
 *
 * The glyphs these replace - `◧`, `▤`, `◎`, `❖`, `☑`, `◔`, `♥`, `🗀`, `≡`, `⚙` -
 * were typographic stand-ins, and they failed in three ways that are only
 * visible on somebody else's machine: several are missing from the default
 * Android and Windows system fonts and rendered as a tofu box, `🗀` is an emoji
 * on one platform and a line drawing on another, and `♥` is announced by a
 * screen reader as "black heart suit" beside the word "Sağlık". Phosphor draws
 * them as SVG that is the same everywhere and hidden from assistive technology,
 * with the label beside it doing the naming.
 */
export const APP_NAV = [
  { to: "/panel", label: "Kokpit", shortLabel: "Kokpit", icon: <AppIcon name="dashboard" /> },
  {
    to: "/degerlendirmeler",
    label: "Kararlar",
    shortLabel: "Kararlar",
    icon: <AppIcon name="decisions" />,
  },
  {
    to: "/firsatlar",
    label: "Fırsatlar",
    shortLabel: "Fırsat",
    icon: <AppIcon name="opportunities" />,
  },
  {
    to: "/kaynaklar",
    label: "Kaynaklar",
    shortLabel: "Kaynak",
    icon: <AppIcon name="sources" />,
  },
  {
    to: "/organizasyon/hazirlik",
    label: "Hazırlık",
    shortLabel: "Hazırlık",
    icon: <AppIcon name="readiness" />,
  },
  { to: "/olgunluk", label: "Olgunluk", icon: <AppIcon name="maturity" /> },
  { to: "/operasyon/saglik", label: "Sağlık", icon: <AppIcon name="health" /> },
  { to: "/dosyalar", label: "Dosyalar", shortLabel: "Dosya", icon: <AppIcon name="files" /> },
  { to: "/yetenekler", label: "Yetenekler", icon: <AppIcon name="capabilities" /> },
  { to: "/ayarlar/gorunum", label: "Ayarlar", icon: <AppIcon name="settings" /> },
] as const;

/* ------------------------------------------------------- session boundary */

/**
 * The workspace's front door.
 *
 * There is no "who am I" endpoint in this backend, so the session is not
 * *asserted* here, it is *observed*: `GET /api/degerlendirmeler` is the one
 * read that requires a session, and the backend answers it with `401` when
 * there is none. That read is the boundary's evidence, and because it uses the
 * same query key the decision surfaces use, it is also the read those surfaces
 * were going to make anyway - one request, not a probe plus a fetch.
 *
 * Three answers, three different surfaces, and the difference between them is
 * the whole point:
 *
 *   `401`/`403`   there is no session. The visitor is told so and given a link
 *                 into the login route carrying where they were going. Nothing
 *                 private renders: not the navigation, not the "Çıkış" button,
 *                 not a page title naming a screen they cannot see.
 *   anything else the server failed. That stays a server failure with a retry -
 *                 it is not an expired session, it is not "çevrimdışı" while
 *                 the browser is plainly online, and it never becomes an empty
 *                 workspace that reads as "your organisation has no data".
 *   `200`         the children render, and they render with the decision list
 *                 already in cache.
 *
 * The anonymous and failed surfaces use `PublicShell` on purpose: it is the
 * frame a visitor without a session is entitled to see.
 */
export function WorkspaceGate() {
  /*
   * Two deployments, two front doors, chosen by a build-time fact.
   *
   * This function holds no hook of its own on purpose: the two gates below ask
   * genuinely different questions - one asks a server, the other asks the
   * address bar - and merging them would mean one component whose hooks run
   * for a deployment they do not apply to. The ordinary path below is the
   * original gate, unchanged, and `isStaticDemoOnly()` is false for every
   * build except the one GitHub Pages workflow.
   */
  return isStaticDemoOnly() ? <StaticDemoGate /> : <ServerSessionGate />;
}

/**
 * The static publication's front door: the address bar, and no network.
 *
 * On GitHub Pages there is no FastAPI process, so the evidence read the server
 * gate depends on cannot be made and must not be attempted - a static page
 * asking a file server for `/api/degerlendirmeler` gets a 404 and turns a
 * refresh into "Çalışma alanı açılamadı", which is the defect this gate exists
 * to remove. What is real on that publication is the demo, so the question
 * here is "which demo profile is this?", and the only place the answer can
 * survive a reload without being written to storage is `?demo=<rol>`.
 *
 * Four answers, and the asymmetry between them is deliberate:
 *
 *   a live demo    renders the workspace, and the address is brought back into
 *                  agreement with the session. The *session* is the fact; a
 *                  stale link that names the other profile does not relabel a
 *                  running demo, it gets corrected by it.
 *   a readable
 *   `?demo=…`      rebuilds that demo, once, and renders. This is the reload.
 *   a demo that
 *   was ended here rebuilds nothing. Pressing Çıkış and then going back to the
 *                  address must not be an undo for leaving.
 *   anything else  goes to the login screen, which is where the two profiles
 *                  are and where the static notice explains the publication.
 *                  Not an error card: nothing failed.
 */
function StaticDemoGate() {
  const location = useLocation();
  const demo = useDemoSession();
  const navigate = useNavigate();

  const roleFromUrl = parseDemoRole(new URLSearchParams(location.search).get(DEMO_ROLE_PARAM));
  /*
   * A demo already left in this document is not rebuilt, however inviting the
   * address looks. `wasDemoEndedHere` is module memory with the document's own
   * lifetime - see `demo/session.ts` for what that does and does not promise.
   */
  const rebuildable = roleFromUrl !== null && !wasDemoEndedHere();

  /*
   * The two writes this gate performs, both in an effect and both idempotent.
   *
   * Starting the session during render would be a side effect in a render
   * pass, and React may run those twice; the query layer reads the session at
   * call time, so an effect is early enough - the first read a workspace
   * screen makes happens after this commit.
   */
  useEffect(() => {
    if (demo === null) {
      if (rebuildable && roleFromUrl !== null) startDemoSession(roleFromUrl);
      return;
    }
    if (roleFromUrl !== demo.role) {
      /*
       * The running session wins, and the address is rewritten to say so.
       *
       * `replace`, because this is a correction rather than a place the
       * visitor navigated to and might want to go back to. And the fragment is
       * carried rather than dropped: `#kanit-3` is where the reader is *inside*
       * the screen, this rewrite happens underneath them while they are looking
       * at it, and losing it would scroll a reviewer back to the top of a long
       * decision page for no reason they could see.
       */
      void navigate(
        `${location.pathname}${withDemoRole(location.search, demo.role)}${location.hash}`,
        { replace: true },
      );
    }
  }, [demo, location.hash, location.pathname, location.search, navigate, rebuildable, roleFromUrl]);

  if (demo === null) {
    if (rebuildable) {
      // The effect above is about to open it; a skeleton for one commit is
      // honest and short, and it is what the server gate shows here too.
      return (
        <PublicShell>
          <SkeletonBlock lines={5} label="Demo yeniden kuruluyor" />
        </PublicShell>
      );
    }
    /*
     * No demo, and nothing readable to rebuild one from.
     *
     * Sent to the login screen rather than shown an error, and the return path
     * is stripped of any demo claim first: a value that was just refused must
     * not be handed back through `donus` and re-applied after entry.
     */
    return (
      <Navigate
        to={loginHref(
          `${location.pathname}${withoutDemoRole(location.search)}${location.hash}`,
        )}
        replace
      />
    );
  }

  return <Outlet />;
}

/**
 * The ordinary deployment's front door, behind a real FastAPI origin.
 *
 * Unchanged by the static-demo work: it observes the session exactly as it
 * always has, and the `?demo=…` parameter grants nothing here. A URL parameter
 * that could open a demo in the deployment that has real tenants would be a
 * link anybody could send to make somebody else's product show example data.
 */
function ServerSessionGate() {
  const location = useLocation();
  const session = useDecisionsQuery();
  const returnTo = `${location.pathname}${location.search}`;

  if (session.isPending) {
    return (
      <PublicShell>
        <SkeletonBlock lines={5} label="Oturum doğrulanıyor" />
      </PublicShell>
    );
  }

  if (session.isError && isSessionError(session.error)) {
    return (
      <PublicShell>
        <div className="dt-stack">
          <h1>Oturum gerekli</h1>
          <p>
            Bu ekran organizasyonunuza ait verileri gösterir ve yalnızca giriş yaptıktan sonra
            açılır. Giriş yaptığınızda buraya geri dönersiniz.
          </p>
          <div className="dt-row">
            <Link to={loginHref(returnTo)}>Giriş yap</Link>
            <Link to="/kayit">Hesap oluştur</Link>
          </div>
        </div>
      </PublicShell>
    );
  }

  if (session.isError) {
    return (
      <PublicShell>
        <div className="dt-stack">
          <h1>Çalışma alanı açılamadı</h1>
          <ErrorState
            title="Sunucu yanıt vermedi"
            message={describeError(session.error)}
            detail={session.error instanceof Error ? session.error.message : undefined}
            onRetry={() => void session.refetch()}
          />
          <p className="dt-muted">
            Bu bir oturum sorunu değildir ve verinizin boş olduğu anlamına gelmez; sunucu bu isteği
            yanıtlayamadı. Okunamayan veri bu ekranda sıfır olarak gösterilmez.
          </p>
        </div>
      </PublicShell>
    );
  }

  return <Outlet />;
}

/* ------------------------------------------------- honest derived reads */

/** What one query contributes to a derived figure, and what it is called. */
interface DerivedRead {
  readonly label: string;
  readonly isPending: boolean;
  readonly isError: boolean;
  readonly error: unknown;
  readonly refetch: () => void;
}

/**
 * A gate for numbers that are *computed* from several reads.
 *
 * `?? []` is the quietest lie in this codebase. A failed catalogue read becomes
 * an empty list, an empty list becomes "0 programmes", and a maturity score
 * computed over it becomes a measured-looking claim about an organisation
 * nobody managed to read. The list is not empty; it is unknown, and the two
 * must not render the same.
 *
 * So anything derived from more than one read is wrapped here: while a read is
 * in flight there is a skeleton, when a read fails the figure is not produced
 * at all and the failure names which read it was, and only when every input
 * genuinely arrived is the derived surface rendered.
 */
function DerivedReadGate({
  reads,
  what,
  children,
}: {
  readonly reads: readonly DerivedRead[];
  readonly what: string;
  readonly children: ReactNode;
}) {
  if (reads.some((read) => read.isPending)) {
    return <SkeletonBlock lines={5} label={`${what} yükleniyor`} />;
  }

  const failed = reads.filter((read) => read.isError);
  if (failed.length > 0) {
    if (failed.some((read) => isSessionError(read.error))) {
      return <SessionRequired what={what} />;
    }
    return (
      <ErrorState
        title={`${what} hesaplanmadı`}
        message={`${failed
          .map((read) => read.label)
          .join(", ")} okunamadığı için hesaplama yapılmadı. Okunamayan bir veri sıfır sayılmaz.`}
        detail={failed
          .map((read) => `${read.label}: ${describeError(read.error)}`)
          .join("\n")}
        onRetry={() => {
          for (const read of failed) read.refetch();
        }}
      />
    );
  }

  return <>{children}</>;
}

/** Adapts a query result to what `DerivedReadGate` needs, without widening it. */
function derivedRead(
  label: string,
  query: { isPending: boolean; isError: boolean; error: unknown; refetch: () => unknown },
): DerivedRead {
  return {
    label,
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
    refetch: () => void query.refetch(),
  };
}

/**
 * What a count says when the read behind it did not arrive.
 *
 * Never `0`. A zero is a measurement, and there was no measurement.
 */
function countLabel(query: {
  isPending: boolean;
  isSuccess: boolean;
  data: readonly unknown[] | undefined;
}): string {
  if (query.isSuccess && query.data !== undefined) return String(query.data.length);
  return query.isPending ? "okunuyor" : "okunamadı";
}

/**
 * The way back in after a write was refused for want of a session.
 *
 * `describeError` already says the write did not happen. What it cannot say is
 * *where to go*, and a message telling somebody to sign in again without a link
 * to the login screen leaves them to find it - on a page whose navigation, at
 * that moment, still looks signed in.
 *
 * Deliberately not a second `role="alert"`. The form beside it already raises
 * one carrying the same sentence, and two live regions announcing the same
 * failure is not twice the information - it is the message read out twice while
 * the reader is trying to work out what to do. This is the *what to do*, and it
 * is reached by moving to it.
 */
function SessionExpiredNotice() {
  const location = useLocation();
  return (
    <div className="dt-state dt-state--denied">
      <h3 className="dt-state__title">Oturum sona ermiş</h3>
      <p className="dt-state__reason">
        Bu işlem kaydedilmedi ve tekrar denemek tek başına yardımcı olmaz.{" "}
        <Link to={loginHref(`${location.pathname}${location.search}`)}>Tekrar giriş yapın</Link>,
        sonra yeniden gönderin.
      </p>
    </div>
  );
}

/** True when a mutation failed because the session was gone. */
function isExpiredWrite(error: unknown): boolean {
  return error instanceof SessionExpiredError;
}

/* ---------------------------------------------------------- section navs */

const SETTINGS_SECTIONS = [
  { to: "/ayarlar/gorunum", label: "Görünüm" },
  { to: "/ayarlar/erisilebilirlik", label: "Erişilebilirlik" },
  { to: "/ayarlar/guvenlik", label: "Güvenlik" },
  { to: "/ayarlar/yapay-zeka", label: "Yapay zekâ" },
] as const;

const ORGANISATION_SECTIONS = [
  { to: "/organizasyon/profil", label: "Şirket profili" },
  { to: "/organizasyon/hazirlik", label: "Hazırlık" },
] as const;

/**
 * The links that turn a set of orphan URLs into a section.
 *
 * `/ayarlar/erisilebilirlik` and `/ayarlar/guvenlik` were reachable only by
 * typing them: the main navigation offered `/ayarlar/gorunum` and nothing on
 * any screen linked sideways, so two finished settings pages were, in practice,
 * not in the product. The same was true of the organisation profile.
 */
function SectionNav({
  label,
  sections,
}: {
  readonly label: string;
  readonly sections: readonly { readonly to: string; readonly label: string }[];
}) {
  return (
    <nav className="dt-row" aria-label={label}>
      {sections.map((section) => (
        <NavLink
          key={section.to}
          to={section.to}
          className={({ isActive }) => (isActive ? "dt-link is-active" : "dt-link")}
        >
          {section.label}
        </NavLink>
      ))}
    </nav>
  );
}

/** Exported so the settings routes that live in their own module can use it. */
export function SettingsSectionNav() {
  return <SectionNav label="Ayarlar bölümleri" sections={SETTINGS_SECTIONS} />;
}

/**
 * The authenticated frame.
 *
 * `AdaptiveShell` replaces the older `AppShell` here: same landmarks, but a
 * layered header, a persistent right-hand context column at ≥64rem, and the
 * 320px controls (drawer, thumb bar, pinned conversion action) as first-class
 * layout rather than desktop-with-things-hidden.
 *
 * `contextRail` carries the assistant. It is passed per route rather than
 * mounted globally, because a rail with nothing in it is furniture a screen
 * reader user walks past on every page - the shell drops the landmark entirely
 * when a route has no context to offer.
 */
export function Shell({
  children,
  contextRail,
  title,
  conversionAction,
}: {
  children: React.ReactNode;
  contextRail?: React.ReactNode;
  title?: string;
  conversionAction?: ConversionAction;
}) {
  const logout = useLogout();
  const navigate = useNavigate();
  const demo = useDemoSession();
  return (
    <AdaptiveShell
      navItems={APP_NAV}
      {...(contextRail ? { contextRail } : {})}
      {...(title ? { title } : {})}
      {...(conversionAction ? { conversionAction } : {})}
      headerUtilities={
        <>
          {/*
            * The demo badge, in the header of every workspace screen.
            *
            * Here rather than on the dashboard alone, because the screenshot
            * that ends up in somebody's deck is rarely the dashboard. It is a
            * `warning` tone and it carries an `srDescription`: colour is never
            * the only carrier in this design system, and "Demo" on its own does
            * not tell a screen reader user that the figures are not theirs.
            */}
          {demo ? (
            <Badge
              tone="warning"
              srDescription="Bu oturum bir arayüz demosudur; veriler örnektir ve sunucuya hiçbir kayıt yazılmaz."
            >
              {demoBadgeLabel(demo.role)}
            </Badge>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            loading={logout.isPending}
            onClick={() =>
              logout.mutate(undefined, { onSuccess: () => void navigate("/giris") })
            }
          >
            Çıkış
          </Button>
        </>
      }
    >
      {children}
    </AdaptiveShell>
  );
}

/* -------------------------------------------------------------- analytics */

/**
 * Adapts a query to the four-state vocabulary the analytics model speaks.
 *
 * The three booleans are copied rather than the query handed over whole, so
 * `components/analytics/model.ts` stays plain TypeScript with no dependency on
 * a query client - which is what lets its four-way branching be unit tested
 * without a renderer or a network.
 *
 * `reason` is only meaningful in the error branch and is computed unconditionally
 * because `describeError` is pure and cheap; the model reads it only after
 * `isError` has been checked.
 *
 * The four fields are taken as separate arguments rather than as the query
 * object, and that is a memoisation decision rather than a style one. A query
 * object gets a new identity on every notification, so a `useMemo` that
 * referenced one would list it as a dependency and re-run on every render -
 * rebuilding the distribution, changing its identity, and forcing the chart
 * downstream into a full `setOption` replace with no data change behind it.
 * Passing the fields lets the memo depend on the four values that actually
 * decide the answer.
 */
function readStateOf<T>(
  data: readonly T[] | undefined,
  isPending: boolean,
  isError: boolean,
  error: unknown,
): ReadState<T> {
  return { isPending, isError, data, reason: isError ? describeError(error) : "" };
}

/* ------------------------------------------------------------------ panel */

/**
 * The one read state the cockpit renders, derived from the four queries
 * `DashboardRoute` owns.
 *
 * Precedence matters: a pending read outranks everything (nothing has failed
 * yet, it just has not arrived), a session error outranks a generic one (the
 * fix is signing in, not retrying), and "every read failed" is a different
 * fact from "one read failed while the others are fine" - the first is
 * `"error"`, the second is `"partial"`, and neither is silently treated as an
 * empty tenant.
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

  /**
   * The cockpit's wide contextual rail: facts only, no visual component.
   *
   * `suggestFromLoadedData` and `deriveDataStatus` are data rules, not the old
   * `AdaptiveAssistant` panel - they are read here for what they compute, and
   * the result is mapped into `CognitiveEvidenceRail`'s own, clean-room prop
   * shape rather than passed to any old visual component.
   */
  const rawSuggestions =
    decisions.isSuccess && snapshots.isSuccess
      ? suggestFromLoadedData({ decisions: loadedDecisions, sources: loadedSnapshots })
      : [];
  const railSuggestions = rawSuggestions.map((suggestion) => ({
    id: suggestion.id,
    title: suggestion.title,
    why: suggestion.why,
    actionLabel: suggestion.nextAction.label,
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

  /**
   * The KPI strip's four tiles and its provenance row - counts and record
   * identity read directly off the loaded lists, never a fabricated figure.
   * A read that has not arrived or has failed renders an em dash with a
   * reason on the tile itself, not a silent zero.
   */
  const pendingEvidenceCount = loadedDecisions.filter((d) => d.missing_facts.length > 0).length;
  const unverifiedSourceCount = loadedSnapshots.filter((s) => s.review_status !== "verified").length;
  const openCallCount = loadedPrograms.filter((p) => p.call_window_state === "open").length;
  const kpiTiles = [
    {
      id: "pending-evidence",
      label: pendingEvidenceLabel,
      value: decisions.isSuccess ? String(pendingEvidenceCount) : "—",
      hint: pendingEvidenceHint,
      unavailableReason: decisions.isSuccess
        ? null
        : decisions.isPending
          ? readingLabel
          : readFailedLabel,
    },
    {
      id: "unverified-sources",
      label: unverifiedSourcesLabel,
      value: snapshots.isSuccess ? String(unverifiedSourceCount) : "—",
      hint: unverifiedSourcesHint,
      unavailableReason: snapshots.isSuccess
        ? null
        : snapshots.isPending
          ? readingLabel
          : readFailedLabel,
    },
    {
      id: "open-calls",
      label: openCallsLabel,
      value: programs.isSuccess ? String(openCallCount) : "—",
      hint: openCallsHint,
      unavailableReason: programs.isSuccess
        ? null
        : programs.isPending
          ? readingLabel
          : readFailedLabel,
    },
    {
      id: "platform-status",
      label: platformStatusLabel,
      value: health.isSuccess ? health.data.status : "—",
      hint: platformStatusHint,
      unavailableReason: health.isSuccess ? null : health.isPending ? readingLabel : readFailedLabel,
    },
  ];
  const latestSnapshot = [...loadedSnapshots].sort((a, b) =>
    b.captured_at.localeCompare(a.captured_at),
  )[0];
  const ruleVersionCounts = new Map<string, number>();
  for (const d of loadedDecisions) {
    ruleVersionCounts.set(d.rule_set_version_id, (ruleVersionCounts.get(d.rule_set_version_id) ?? 0) + 1);
  }
  const dominantRuleVersion = [...ruleVersionCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const kpiProvenance = {
    sourceId: latestSnapshot?.id ?? "—",
    capturedAt: latestSnapshot?.captured_at ?? "—",
    ruleVersion: dominantRuleVersion ?? "—",
    calibrationStatus: health.isSuccess ? health.data.status : "—",
  };

  /** The next-action queue: one row per decision still missing a fact. */
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

  /** The evidence-gap list: every unanswered fact, aggregated once. */
  const gapCounts = new Map<string, number>();
  for (const d of loadedDecisions) {
    for (const fact of d.missing_facts) {
      gapCounts.set(fact, (gapCounts.get(fact) ?? 0) + 1);
    }
  }
  const evidenceGaps = [...gapCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([fact, count]) => ({ fact, blockedDecisionCount: count }));

  /** The catalog panel: real counts and the most recently captured sources. */
  const catalogCounts = [
    { label: programsCountLabel, value: countLabel(programs) },
    { label: decisionsCountLabel, value: countLabel(decisions) },
    { label: sourcesCountLabel, value: countLabel(snapshots) },
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

  /**
   * The three distributions, computed once per real change.
   *
   * `DistributionPanel` memoises its chart option on the identity of the
   * distribution it is given, and a fresh object on every render would defeat
   * that memo completely - the chart would be fully rebuilt whenever anything
   * on this screen re-rendered, which on a dashboard with five live queries is
   * constantly. Memoising at the source is what makes the memo downstream real
   * rather than decorative.
   *
   * The dependencies are the query facts the model actually reads - the data
   * reference and the two flags - not the query objects, whose identity changes
   * on every notification.
   */
  const portfolio = useMemo(
    () =>
      portfolioBySupportType(
        readStateOf(programs.data, programs.isPending, programs.isError, programs.error),
        supportTypeLabel,
      ),
    [programs.data, programs.isPending, programs.isError, programs.error],
  );
  const outcomes = useMemo(
    () =>
      outcomeDistribution(
        readStateOf(decisions.data, decisions.isPending, decisions.isError, decisions.error),
      ),
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
      onLogout={() =>
        logout.mutate(undefined, { onSuccess: () => void navigate("/giris") })
      }
      loggingOut={logout.isPending}
      updatedAt={decisions.dataUpdatedAt}
      readAt={
        decisions.dataUpdatedAt > 0
          ? new Date(decisions.dataUpdatedAt).toLocaleTimeString("tr-TR", {
              hour: "2-digit",
              minute: "2-digit",
            })
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
            providerReason={NO_ASSISTANT_PROVIDER.providerReason}
          />
          <CognitiveAccessScopePanel
            tenantLabel={organisationLabel}
            roleLabel={roleLabel}
            isDemo={demo !== null}
          />
        </>
      }
    />
  );
}

/* -------------------------------------------------------------- discovery */

export function OpportunitiesRoute() {
  const programs = useProgramsQuery();
  return (
    <Shell>
      <QueryBoundary query={programs}>
        {(list) => (
          <CatalogList
            programs={list}
            title="Fırsat keşfi"
            hrefFor={(program) => `/firsatlar/${program.code}`}
          />
        )}
      </QueryBoundary>
    </Shell>
  );
}

export function OpportunityDetailRoute() {
  const { code = "" } = useParams();
  const programs = useProgramsQuery();
  const snapshots = useSnapshotsQuery();
  // Same reading as the public twin: the registry either produced rows or it
  // did not, and "did not" is never rendered as "there are none".
  const sources = readSourceRegistry(
    snapshots,
    snapshots.isError ? describeError(snapshots.error) : undefined,
  );
  return (
    <Shell>
      <QueryBoundary query={programs}>
        {(list) => {
          const program = list.find((candidate) => candidate.code === code);
          if (!program) {
            return <EmptyState title="Program bulunamadı" reason={`"${code}" katalogda yok.`} />;
          }
          return (
            <OpportunityDetail
              program={program}
              snapshots={sources.rows}
              sourcesRead={sources.state}
            />
          );
        }}
      </QueryBoundary>
    </Shell>
  );
}

export function SourceRegistryRoute() {
  const snapshots = useSnapshotsQuery();
  return (
    <Shell>
      <QueryBoundary query={snapshots}>
        {(list) => <SourceRegistry snapshots={list} />}
      </QueryBoundary>
    </Shell>
  );
}

export function SourceDetailRoute() {
  const { id = "" } = useParams();
  const snapshots = useSnapshotsQuery();
  return (
    <Shell>
      <QueryBoundary query={snapshots}>
        {(list) => {
          const snapshot = list.find((candidate) => candidate.id === id);
          if (!snapshot) {
            return <EmptyState title="Kaynak bulunamadı" reason={`"${id}" kütükte yok.`} />;
          }
          return (
            <div className="dt-stack">
              <h1>{snapshot.title}</h1>
              <PartialDataNotice
                what="Yakalanan ham metin gösterilemiyor."
                because="API kaynak gövdesini döndürmüyor; yalnızca üstveri okunabiliyor."
              />
              <SourceSnapshotCard snapshot={snapshot} />
            </div>
          );
        }}
      </QueryBoundary>
    </Shell>
  );
}

/* ------------------------------------------------------- decision workspace */

export function DecisionsRoute() {
  const decisions = useDecisionsQuery();
  const snapshots = useSnapshotsQuery();
  const programs = useProgramsQuery();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const navigate = useNavigate();
  const sources = readSourceRegistry(
    snapshots,
    snapshots.isError ? describeError(snapshots.error) : undefined,
  );

  return (
    <Shell>
      <QueryBoundary query={decisions} loadingLabel="Kararlar yükleniyor">
        {(list) => {
          const selected = list.find((d) => d.id === selectedId) ?? list[0] ?? null;
          const program =
            programs.data?.find((p) => p.code === selected?.program_code) ?? null;
          return (
            <>
              <h1 className="dt-visually-hidden">Karar tezgâhı</h1>
              {compareIds.length >= 2 ? (
                <div className="dt-row">
                  <Button
                    size="sm"
                    onClick={() =>
                      void navigate(`/degerlendirmeler/karsilastir?ids=${compareIds.join(",")}`)
                    }
                  >
                    {compareIds.length} kararı karşılaştır
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setCompareIds([])}>
                    Seçimi temizle
                  </Button>
                </div>
              ) : null}
              <WorkspaceShell
                listLabel="Kararlar"
                detailLabel="Karar ayrıntısı"
                evidenceLabel="Kanıt"
                listPanel={
                  <DecisionList
                    decisions={list}
                    onSelect={setSelectedId}
                    selectedIds={compareIds}
                    onToggleCompare={(id) =>
                      setCompareIds((prev) =>
                        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
                      )
                    }
                  />
                }
                detailPanel={
                  selected ? (
                    <DecisionDetail
                      decision={selected}
                      program={program}
                      snapshots={sources.rows}
                      sourcesRead={sources.state}
                      // Embedded: this page already owns the h1 above.
                      headingLevel={2}
                    />
                  ) : (
                    <EmptyState
                      title="Karar seçilmedi"
                      reason="Soldaki listeden bir karar seçin."
                    />
                  )
                }
                evidencePanel={
                  selected ? (
                    /*
                     * An evidence panel that renders empty says "no evidence".
                     *
                     * With `?? []` that is precisely what a failed registry read
                     * produced here: a silent, blank third column beside a
                     * decision that cites a snapshot by id. Nothing on the
                     * screen told the reader that a request had failed - the
                     * panel simply looked like a decision with nothing behind
                     * it, which is the most damaging thing this product can
                     * imply about a decision.
                     */
                    <div className="dt-stack">
                      {sources.rows === null ? (
                        <UnreadSourceRegistry
                          what="Bu kararın kanıt kayıtları gösterilemiyor."
                          state={sources.state}
                        />
                      ) : (
                        sources.rows
                          .filter((snapshot) => selected.source_snapshot_ids.includes(snapshot.id))
                          .map((snapshot) => (
                            <SourceSnapshotCard key={snapshot.id} snapshot={snapshot} compact />
                          ))
                      )}
                    </div>
                  ) : null
                }
              />
            </>
          );
        }}
      </QueryBoundary>
    </Shell>
  );
}

export function DecisionDetailRoute() {
  const { id = "" } = useParams();
  const decision = useDecisionQuery(id);
  const snapshots = useSnapshotsQuery();
  const programs = useProgramsQuery();
  const approval = useRecordApproval(id);
  /**
   * The audit record of this session's write, captured once.
   *
   * Held here rather than derived in the template, because it is a fact about
   * the mutation - what was written, when the write happened, and whose clock
   * said so - and a fact about a write does not belong to a render.
   */
  const [recorded, setRecorded] = useState<ApprovalRecord | null>(null);
  const sources = readSourceRegistry(
    snapshots,
    snapshots.isError ? describeError(snapshots.error) : undefined,
  );

  return (
    <Shell>
      <QueryBoundary query={decision} loadingLabel="Karar yükleniyor">
        {(found) => (
          <DecisionDetail
            decision={found}
            program={programs.data?.find((p) => p.code === found.program_code) ?? null}
            snapshots={sources.rows}
            sourcesRead={sources.state}
            approvalSlot={
              <>
                {isExpiredWrite(approval.error) ? <SessionExpiredNotice /> : null}
                <ApprovalForm
                  submitting={approval.isPending}
                  recordedNote={recorded?.note ?? null}
                  recordedAt={recorded?.approvedAt ?? null}
                  recordedAtSource={recorded?.source ?? "server"}
                  error={approval.isError ? describeError(approval.error) : null}
                  onSubmit={(note) =>
                    approval.mutate(note, { onSuccess: (record) => setRecorded(record) })
                  }
                />
              </>
            }
          />
        )}
      </QueryBoundary>
    </Shell>
  );
}

export function DecisionCompareRoute() {
  const [params] = useSearchParams();
  const ids = useMemo(
    () => (params.get("ids") ?? "").split(",").filter(Boolean),
    [params],
  );
  const decisions = useDecisionsQuery();

  return (
    <Shell>
      <QueryBoundary query={decisions}>
        {(list) => <DecisionCompare decisions={list.filter((d) => ids.includes(d.id))} />}
      </QueryBoundary>
    </Shell>
  );
}

/* ---------------------------------------------------------- organisation */

export function ProfileRoute() {
  /**
   * The form's starting point, and nothing more.
   *
   * This used to be a `useState` store fed by a per-field callback, and *that*
   * copy was what got POSTed - while react-hook-form validated a different
   * object. The form is the only store now; the route hands it a starting
   * value and receives the validated result back.
   */
  const defaultValues = useMemo(
    () => emptyProfileValues() as Record<string, string>,
    [],
  );
  const save = useSaveProfile();
  const decisions = useDecisionsQuery();
  const missing = useMemo(
    () => [...new Set((decisions.data ?? []).flatMap((d) => d.missing_facts))],
    [decisions.data],
  );

  return (
    <Shell>
      <div className="dt-stack">
        <SectionNav label="Organizasyon bölümleri" sections={ORGANISATION_SECTIONS} />
        {isExpiredWrite(save.error) ? <SessionExpiredNotice /> : null}
        <ProfileWorkspace
          defaultValues={defaultValues}
          missingFacts={missing}
          submitting={save.isPending}
          error={save.isError ? describeError(save.error) : null}
          onSubmit={(values) => save.mutate(values)}
        />
      </div>
    </Shell>
  );
}

export function ReadinessRoute() {
  const decisions = useDecisionsQuery();
  return (
    <Shell>
      <div className="dt-stack">
        <SectionNav label="Organizasyon bölümleri" sections={ORGANISATION_SECTIONS} />
        <QueryBoundary query={decisions}>
          {(list) => <ReadinessTemplate decisions={list} />}
        </QueryBoundary>
      </div>
    </Shell>
  );
}

export function WizardRoute() {
  const [step, setStep] = useState(0);
  // Same reasoning as the profile: a starting value, not a second store.
  const defaultValues = useMemo(
    () => emptyProfileValues() as Record<string, string>,
    [],
  );
  const save = useSaveProfile();
  const evaluate = useRunEvaluation();
  const navigate = useNavigate();

  return (
    <Shell>
      {isExpiredWrite(save.error) || isExpiredWrite(evaluate.error) ? (
        <SessionExpiredNotice />
      ) : null}
      <EligibilityWizard
        step={step}
        defaultValues={defaultValues}
        submitting={save.isPending || evaluate.isPending}
        // Whichever half failed. The wizard stays put either way: a failed save
        // must not lead to an evaluation, and a failed evaluation must not lead
        // to a decision list that has nothing new in it.
        error={
          save.isError
            ? describeError(save.error)
            : evaluate.isError
              ? describeError(evaluate.error)
              : null
        }
        onStepChange={setStep}
        onFinish={(values) =>
          save.mutate(values, {
            onSuccess: () =>
              evaluate.mutate(undefined, {
                onSuccess: () => void navigate("/degerlendirmeler"),
              }),
          })
        }
      />
    </Shell>
  );
}

/* ------------------------------------------------------ maturity and ops */

export function MaturityRoute() {
  const decisions = useDecisionsQuery();
  const programs = useProgramsQuery();
  const snapshots = useSnapshotsQuery();
  const health = useReadinessQuery();

  /**
   * Health is allowed to be `null`; the other three are not allowed to be `[]`.
   *
   * `calculateMaturity` already treats an unreadable `/hazir` as an
   * *unmeasurable* dimension rather than as a bad score, which is exactly
   * right. It has no such defence for the lists: an empty decision list and an
   * unread decision list arrive at it identically, and it scores the second one
   * as though the first were true. So the lists are gated and health is not.
   */
  const report = useMemo(
    () =>
      calculateMaturity({
        decisions: decisions.data ?? [],
        programs: programs.data ?? [],
        snapshots: snapshots.data ?? [],
        health: health.data ?? null,
      }),
    [decisions.data, programs.data, snapshots.data, health.data],
  );

  return (
    <Shell>
      <div className="dt-stack">
        <h1>Olgunluk</h1>
        <DerivedReadGate
          what="Olgunluk"
          reads={[
            derivedRead("Karar listesi", decisions),
            derivedRead("Program kataloğu", programs),
            derivedRead("Kaynak kütüğü", snapshots),
          ]}
        >
          <p className="dt-lede">
            Yedi boyut ayrı ayrı gösterilir. Tek bir toplam puan yoktur, çünkü{" "}
            {report.unmeasurableCount} boyut bugün ölçülemiyor ve ortalama almak bunu gizlerdi.
          </p>
          <MaturityRadar dimensions={report.dimensions} />
        </DerivedReadGate>
      </div>
    </Shell>
  );
}

export function OpsHealthRoute() {
  const health = useReadinessQuery();
  const decisions = useDecisionsQuery();
  const programs = useProgramsQuery();
  const snapshots = useSnapshotsQuery();

  const report = useMemo(
    () =>
      calculateMaturity({
        decisions: decisions.data ?? [],
        programs: programs.data ?? [],
        snapshots: snapshots.data ?? [],
        health: health.data ?? null,
      }),
    [decisions.data, programs.data, snapshots.data, health.data],
  );

  return (
    <Shell>
      {/*
        * Same rule as `/olgunluk`, and it matters more here.
        *
        * This page is where an operator goes to decide whether the platform is
        * healthy. A maturity report computed over three failed reads would show
        * them a low score and let them conclude the organisation is immature,
        * when what actually happened is that the server did not answer.
        */}
      <DerivedReadGate
        what="Olgunluk"
        reads={[
          derivedRead("Karar listesi", decisions),
          derivedRead("Program kataloğu", programs),
          derivedRead("Kaynak kütüğü", snapshots),
        ]}
      >
        <OpsHealth
          health={health.data ?? null}
          maturity={report}
          {...(health.dataUpdatedAt
            ? { lastCheckedAt: new Date(health.dataUpdatedAt).toISOString() }
            : {})}
        />
      </DerivedReadGate>
    </Shell>
  );
}

export function CapabilityMatrixRoute() {
  return (
    <Shell>
      <CapabilityMatrix />
    </Shell>
  );
}

/* -------------------------------------------------------------- settings */

export function AppearanceSettingsRoute() {
  const density = useUiStore((s) => s.density);
  const setDensity = useUiStore((s) => s.setDensity);
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const fontScale = useUiStore((s) => s.fontScale);
  const setFontScale = useUiStore((s) => s.setFontScale);

  return (
    <Shell>
      <div className="dt-stack">
        <SettingsSectionNav />
      <SettingsPanel
        title="Görünüm"
        sections={[
          {
            id: "density",
            title: "Yoğunluk",
            content: (
              <RadioGroup
                name="density"
                legend="Satır yoğunluğu"
                value={density}
                onValueChange={(value) => setDensity(value as Density)}
                options={[
                  { value: "comfortable", label: "Rahat", description: "48 piksel satır" },
                  { value: "compact", label: "Sıkı", description: "40 piksel satır" },
                  { value: "dense", label: "Yoğun", description: "32 piksel satır" },
                ]}
              />
            ),
          },
          {
            id: "theme",
            title: "Tema",
            content: (
              <RadioGroup
                name="theme"
                legend="Renk teması"
                value={theme}
                onValueChange={(value) => setTheme(value as ThemeChoice)}
                options={[
                  { value: "system", label: "Sistem" },
                  { value: "light", label: "Açık" },
                  { value: "dark", label: "Koyu" },
                ]}
              />
            ),
          },
          {
            id: "font",
            title: "Yazı boyutu",
            content: (
              <RadioGroup
                name="font"
                legend="Yazı ölçeği"
                value={fontScale}
                onValueChange={(value) => setFontScale(value as FontScale)}
                options={[
                  { value: "normal", label: "Normal" },
                  { value: "large", label: "Büyük" },
                ]}
              />
            ),
          },
        ]}
      />
      </div>
    </Shell>
  );
}

export function AccessibilitySettingsRoute() {
  const reducedMotion = useUiStore((s) => s.reducedMotion);
  const setReducedMotion = useUiStore((s) => s.setReducedMotion);

  return (
    <Shell>
      <div className="dt-stack">
        <SettingsSectionNav />
      <SettingsPanel
        title="Erişilebilirlik"
        sections={[
          {
            id: "motion",
            title: "Hareket",
            content: (
              <Switch
                checked={reducedMotion}
                onCheckedChange={setReducedMotion}
                label="Hareketi azalt"
                description="Geçiş ve animasyon sürelerini sıfırlar. İşletim sistemi ayarınız zaten hareketi azaltıyorsa bu ayar da uygulanır."
              />
            ),
          },
          {
            id: "keyboard",
            title: "Klavye",
            content: (
              <ul className="dt-list">
                <li>Her sayfada ilk sekme “İçeriğe geç” bağlantısına gider.</li>
                <li>Tablolarda sütun başlıkları sıralama düğmesidir ve klavyeyle çalışır.</li>
                <li>Diyaloglar odağı hapseder; Esc kapatır ve odak geri döner.</li>
              </ul>
            ),
          },
        ]}
      />
      </div>
    </Shell>
  );
}

export function SecuritySettingsRoute() {
  const logout = useLogout();
  const navigate = useNavigate();
  return (
    <Shell>
      <div className="dt-stack">
        <SettingsSectionNav />
      <SettingsPanel
        title="Güvenlik"
        sections={[
          {
            id: "session",
            title: "Oturum",
            content: (
              <div className="dt-stack">
                <p>Oturumunuz sunucuda tutulur ve çıkışta sunucu tarafında iptal edilir.</p>
                <Button
                  variant="danger"
                  loading={logout.isPending}
                  onClick={() =>
                    logout.mutate(undefined, { onSuccess: () => void navigate("/giris") })
                  }
                >
                  Çıkış yap
                </Button>
              </div>
            ),
          },
          {
            id: "missing",
            title: "Bu sürümde olmayanlar",
            content: (
              <ul className="dt-list">
                <li>Parola değiştirme ve sıfırlama</li>
                <li>İki adımlı doğrulama</li>
                <li>Aktif oturum listesi</li>
                <li>Hesap silme ve veri dışa aktarma</li>
              </ul>
            ),
          },
        ]}
      />
      </div>
    </Shell>
  );
}
