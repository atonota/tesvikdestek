/** Authenticated surfaces: dashboard, discovery, decision workspace, settings, ops. */

import { useMemo, useState, type ReactNode } from "react";
import {
  NavLink,
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
  AdaptiveAssistant,
  AdaptiveShell,
  ApprovalForm,
  Button,
  Card,
  CapabilityMatrix,
  CatalogList,
  DecisionCompare,
  DecisionDetail,
  DecisionList,
  DefinitionList,
  EligibilityWizard,
  EmptyState,
  ErrorState,
  Link,
  MaturityRadar,
  OpportunityDetail,
  OpsHealth,
  OutcomeDistribution,
  PartialDataNotice,
  ProfileWorkspace,
  PublicShell,
  ReadinessTemplate,
  SettingsPanel,
  SkeletonBlock,
  SourceFreshnessMeter,
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
  type AssistantSuggestion,
  type ConversionAction,
} from "@/components";
import { calculateMaturity } from "@/domain/maturity";
import { emptyProfileValues } from "@/domain/facts";
import { useUiStore, type Density, type FontScale, type ThemeChoice } from "@/store/ui";
import { loginHref } from "./auth";
import { QueryBoundary, SessionRequired, isSessionError } from "./QueryBoundary";

export const APP_NAV = [
  { to: "/panel", label: "Kokpit", shortLabel: "Kokpit", icon: "◧" },
  { to: "/degerlendirmeler", label: "Kararlar", shortLabel: "Kararlar", icon: "▤" },
  { to: "/firsatlar", label: "Fırsatlar", shortLabel: "Fırsat", icon: "◎" },
  { to: "/kaynaklar", label: "Kaynaklar", shortLabel: "Kaynak", icon: "❖" },
  { to: "/organizasyon/hazirlik", label: "Hazırlık", shortLabel: "Hazırlık", icon: "☑" },
  { to: "/olgunluk", label: "Olgunluk", icon: "◔" },
  { to: "/operasyon/saglik", label: "Sağlık", icon: "♥" },
  { to: "/dosyalar", label: "Dosyalar", shortLabel: "Dosya", icon: "🗀" },
  { to: "/yetenekler", label: "Yetenekler", icon: "≡" },
  { to: "/ayarlar/gorunum", label: "Ayarlar", icon: "⚙" },
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
  return (
    <AdaptiveShell
      navItems={APP_NAV}
      {...(contextRail ? { contextRail } : {})}
      {...(title ? { title } : {})}
      {...(conversionAction ? { conversionAction } : {})}
      headerUtilities={
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
      }
    >
      {children}
    </AdaptiveShell>
  );
}

/* ------------------------------------------------------------------ panel */

export function DashboardRoute() {
  const decisions = useDecisionsQuery();
  const programs = useProgramsQuery();
  const snapshots = useSnapshotsQuery();
  const health = useReadinessQuery();
  const evaluate = useRunEvaluation();

  /**
   * The assistant's input, built only from what this page already loaded.
   *
   * No extra request is made to populate it: a suggestion about a record the
   * page never fetched would be a claim about data this client has not seen.
   */
  const loadedDecisions = decisions.data ?? [];
  const loadedSnapshots = snapshots.data ?? [];
  /**
   * Suggestions are made from data that arrived, or they are not made.
   *
   * A failed snapshot read used to fall through `?? []` into the suggestion
   * rules, which then said perfectly confident things about a source registry
   * nobody had managed to read. The assistant's own `dataStatus` reports the
   * failure below; an empty suggestion list beside it is the honest pairing.
   */
  const suggestions =
    decisions.isSuccess && snapshots.isSuccess
      ? suggestFromLoadedData({ decisions: loadedDecisions, sources: loadedSnapshots })
      : [];

  /**
   * The panel's self-description, derived from the two queries that feed it.
   *
   * All three of these were previously asserted rather than measured: the
   * missing-fact list was hard-coded empty while the decisions on screen
   * carried facts nobody had answered, `partial` was the constant `true`, and
   * the timestamp was presented as though it were when the data became true
   * rather than when this browser fetched it. `deriveDataStatus` computes them
   * from `isPending`, `isError` and `dataUpdatedAt`, and nothing else.
   */
  const dataStatus = deriveDataStatus({
    label: "Karar listesi ve kaynak kütüğü",
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

  return (
    <Shell
      title="Kokpit"
      conversionAction={{
        label: "Uygunluk sihirbazını başlat",
        to: "/uygunluk/sihirbaz",
        hint: "Ön değerlendirme üretir; kurum kararı değildir.",
      }}
      contextRail={
        <AdaptiveAssistant
          capabilities={NO_ASSISTANT_PROVIDER}
          suggestions={suggestions satisfies readonly AssistantSuggestion[]}
          dataStatus={dataStatus}
        />
      }
    >
      <div className="dt-stack">
        <h1>Kokpit</h1>
        <QueryBoundary query={decisions} loadingLabel="Kararlar yükleniyor">
          {(list) => (
            <>
              <Card title="Sonuç dağılımı" headingLevel={2}>
                <OutcomeDistribution decisions={list} />
              </Card>
              <Card
                title="Sıradaki eylem"
                headingLevel={2}
                actions={
                  /*
                   * Secondary, deliberately.
                   *
                   * The shell already puts one primary on this page - the
                   * conversion action that starts the wizard - and this button
                   * was a second one, in the first content card, styled
                   * identically. Two primaries is not a style slip: it is two
                   * answers to "what should I do next?", and the answer that
                   * converts is the one that loses. Running an evaluation is a
                   * real action and stays a real button; it is simply not the
                   * page's headline.
                   */
                  <Button
                    variant="secondary"
                    loading={evaluate.isPending}
                    onClick={() => evaluate.mutate()}
                  >
                    Değerlendirmeyi çalıştır
                  </Button>
                }
              >
                {evaluate.isError ? (
                  <ErrorState message={describeError(evaluate.error)} />
                ) : null}
                {list.length === 0 ? (
                  <p>
                    Henüz karar yok. Önce <Link to="/organizasyon/profil">profili doldurun</Link>,
                    sonra değerlendirmeyi çalıştırın.
                  </p>
                ) : (
                  <p>
                    {list.filter((d) => d.missing_facts.length > 0).length} kararda eksik olgu var.{" "}
                    <Link to="/organizasyon/hazirlik">Hazırlık ekranına git</Link>
                  </p>
                )}
              </Card>
            </>
          )}
        </QueryBoundary>

        {/*
          * Counts, and what they say when there is nothing to count *with*.
          *
          * Every figure here was `?? 0`. A catalogue read that failed rendered
          * as "Program 0" - a confident, wrong, measured-looking claim, and the
          * one a reader is least likely to question because zero is a perfectly
          * ordinary answer. `countLabel` says "okunamadı" instead, and the
          * freshness meter is not drawn at all: a meter over an unread registry
          * would be a picture of nothing, shaped like a picture of something.
          */}
        <Card title="Katalog ve kaynak" headingLevel={2}>
          <DefinitionList
            columns={2}
            items={[
              { term: "Program", description: countLabel(programs) },
              { term: "Kaynak", description: countLabel(snapshots) },
              {
                term: "Platform",
                description: health.isSuccess
                  ? health.data.status
                  : health.isPending
                    ? "okunuyor"
                    : "okunamadı",
              },
            ]}
          />
          {snapshots.isSuccess ? (
            <SourceFreshnessMeter snapshots={snapshots.data} />
          ) : (
            <PartialDataNotice
              what="Kaynak tazeliği gösterilemiyor."
              because="Kaynak kütüğü okunamadı. Okunamayan bir kütük boş bir kütük değildir, bu yüzden burada sayı yerine okunamadı yazar."
            />
          )}
        </Card>
      </div>
    </Shell>
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
