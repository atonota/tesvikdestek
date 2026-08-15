/**
 * Level 5 - domain components (18).
 *
 * This is where the product's honesty is enforced in markup. Rules that hold
 * everywhere in this file:
 *
 *  - an outcome renders only through OUTCOME_LABELS; there is no fifth value
 *  - a user's approval is always labelled "Kullanıcı onayı"
 *  - a null call window renders as "Bilinmiyor", never as open
 *  - nothing sums support types, and no amount is ever presented as awarded
 */

import { useMemo, useState, type ReactNode } from "react";

import {
  callWindowLabel,
  reviewStatusLabel,
  supportTypeLabel,
  type Decision,
  type Program,
  type Snapshot,
  type Trace,
} from "@/api/types";
import {
  BLOCKED_LABEL,
  STATUS_LABELS,
  type Capability,
} from "@/domain/capabilities";
import { factLabel } from "@/domain/facts";
import {
  levelLabel,
  MEASURABILITY_LABELS,
  type MaturityDimensionResult,
} from "@/domain/maturity";
import {
  OUTCOME_DESCRIPTIONS,
  OUTCOME_TOKEN,
  USER_APPROVAL_LABEL,
  isOutcome,
  outcomeLabel,
  reasonLabel,
  type Outcome,
} from "@/domain/outcomes";
import { cn } from "@/lib/cn";
import { daysSince, formatDate, formatDateTime, formatNumber } from "@/lib/intl";
import { Card, CopyableHash, DefinitionList } from "./composites";
import { DataGrid } from "./data-grid/DataGrid";
import { compareGridConfig, compareRows, traceGridConfig } from "./data-grid/configs";
import { EmptyState } from "./patterns";
import { Badge, Link, VisuallyHidden, type BadgeTone } from "./primitives";

/* ------------------------------------------------------------ OutcomeBadge */

export interface OutcomeBadgeProps {
  outcome: string;
  /** Server-provided label; falls back to the local map. */
  label?: string;
  showDescription?: boolean;
}

/** States: one per outcome · unknown-value (renders the raw code, never a guess). */
export function OutcomeBadge({ outcome, label, showDescription = false }: OutcomeBadgeProps) {
  const known = isOutcome(outcome);
  const tone = (known ? OUTCOME_TOKEN[outcome as Outcome] : "neutral") as BadgeTone;
  const text = label ?? outcomeLabel(outcome);
  return (
    <span className="dt-outcome">
      <Badge
        tone={tone}
        srDescription={known ? OUTCOME_DESCRIPTIONS[outcome as Outcome] : undefined}
      >
        {text}
      </Badge>
      {showDescription && known ? (
        <span className="dt-outcome__desc">{OUTCOME_DESCRIPTIONS[outcome as Outcome]}</span>
      ) : null}
    </span>
  );
}

/* ----------------------------------------------------- OutcomeDistribution */

export interface OutcomeDistributionProps {
  decisions: readonly Decision[];
  caption?: string;
}

/**
 * Counts of the four outcomes. Counts, not money: the only thing this product
 * can honestly aggregate is how many decisions landed in each bucket.
 *
 * Rendered as a definition list plus proportional bars, so it is readable
 * without colour and without a charting library.
 *
 * States: populated · empty.
 */
export function OutcomeDistribution({
  decisions,
  caption = "Sonuç dağılımı",
}: OutcomeDistributionProps) {
  const counts = useMemo(() => {
    const base: Record<Outcome, number> = {
      candidate_eligible: 0,
      conditional: 0,
      ineligible: 0,
      insufficient_data: 0,
    };
    for (const decision of decisions) {
      if (isOutcome(decision.outcome)) base[decision.outcome] += 1;
    }
    return base;
  }, [decisions]);

  if (decisions.length === 0) {
    return <EmptyState title="Sonuç yok" reason="Henüz değerlendirme çalıştırılmadı." />;
  }

  const total = decisions.length;
  return (
    <div className="dt-distribution">
      <VisuallyHidden as="h2">{caption}</VisuallyHidden>
      <ul className="dt-distribution__list">
        {(Object.keys(counts) as Outcome[]).map((outcome) => {
          const count = counts[outcome];
          const percent = Math.round((count / total) * 100);
          return (
            <li key={outcome} className="dt-distribution__row">
              <OutcomeBadge outcome={outcome} />
              <span className="dt-distribution__bar" aria-hidden="true">
                <span
                  className={`dt-distribution__fill dt-distribution__fill--${OUTCOME_TOKEN[outcome]}`}
                  style={{ inlineSize: `${percent}%` }}
                />
              </span>
              <span className="dt-distribution__count">
                {formatNumber(count)} <span className="dt-muted">(%{percent})</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------- ReasonList */

export interface ReasonListProps {
  reasons: readonly string[];
  emptyMessage?: string;
}

/** States: populated · empty. */
export function ReasonList({ reasons, emptyMessage = "Ek gerekçe yok." }: ReasonListProps) {
  if (reasons.length === 0) return <p className="dt-muted">{emptyMessage}</p>;
  return (
    <ul className="dt-reasons">
      {reasons.map((reason) => (
        <li key={reason}>{reasonLabel(reason)}</li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------- MissingFactsPanel */

export interface MissingFactsPanelProps {
  missingFacts: readonly string[];
  /** Deep link target for filling the fact in. */
  profileHref?: string;
}

/**
 * The single most actionable surface in the product: which named facts the
 * engine was never told. This is also the only way the client can infer profile
 * completeness at all, since there is no profile read endpoint.
 *
 * States: complete (empty) · incomplete.
 */
export function MissingFactsPanel({
  missingFacts,
  profileHref = "/organizasyon/profil",
}: MissingFactsPanelProps) {
  if (missingFacts.length === 0) {
    return (
      <p className="dt-muted">Bu karar için eksik olgu yok.</p>
    );
  }
  return (
    <div className="dt-missing">
      <p>
        <strong>{formatNumber(missingFacts.length)}</strong> olgu eksik. Bunlar doldurulmadan sonuç
        kesinleşemez.
      </p>
      <ul className="dt-missing__list">
        {missingFacts.map((fact) => (
          <li key={fact}>
            <Link to={`${profileHref}#${fact}`}>{factLabel(fact)}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ----------------------------------------------------- PredicateTraceTable */

export interface PredicateTraceTableProps {
  traces: readonly Trace[];
  /** Snapshot ids that exist, so citations can link where possible. */
  knownSnapshotIds?: readonly string[];
}

const TRUTH_LABELS: Record<string, string> = {
  true: "Sağlandı",
  false: "Sağlanmadı",
  unknown: "Bilinmiyor",
};

/**
 * Why a decision came out the way it did, predicate by predicate.
 *
 * Desktop renders a real table with a caption and scoped headers; below 768px
 * it becomes a card list, because six columns on a phone is a horizontal
 * scroll and this is the content users most need to read carefully.
 *
 * States: populated · empty · unknown-heavy.
 */
export function PredicateTraceTable({ traces, knownSnapshotIds = [] }: PredicateTraceTableProps) {
  // Migrated to the shared grid: the trace gains filtering by result, grouping,
  // column control and CSV export, and stops maintaining its own markup.
  return <DataGrid config={traceGridConfig(knownSnapshotIds)} rows={traces} />;
}

/* ---------------------------------------------------------------- RuleTree */

export interface RuleNodeView {
  kind: "all" | "any" | "not" | "predicate";
  label: string;
  result?: string;
  children?: readonly RuleNodeView[];
}

export interface RuleTreeProps {
  root: RuleNodeView | null;
  emptyMessage?: string;
}

/**
 * The all/any/not structure as a nested list.
 *
 * The API does not return the rule document, so callers build this view from
 * the traces they have. When they cannot, the component says so rather than
 * drawing a plausible tree.
 *
 * States: populated · empty.
 */
export function RuleTree({ root, emptyMessage = "Kural ağacı bu uçtan okunamıyor." }: RuleTreeProps) {
  if (!root) return <p className="dt-muted">{emptyMessage}</p>;

  const renderNode = (node: RuleNodeView, key: string): ReactNode => (
    <li key={key} className={`dt-ruletree__node dt-ruletree__node--${node.kind}`}>
      <span className="dt-ruletree__label">
        {node.label}
        {node.result ? (
          <Badge tone={node.result === "true" ? "candidate" : node.result === "false" ? "ineligible" : "insufficient"}>
            {TRUTH_LABELS[node.result] ?? node.result}
          </Badge>
        ) : null}
      </span>
      {node.children && node.children.length > 0 ? (
        <ul>{node.children.map((child, index) => renderNode(child, `${key}-${index}`))}</ul>
      ) : null}
    </li>
  );

  return (
    <ul className="dt-ruletree" aria-label="Kural ağacı">
      {renderNode(root, "root")}
    </ul>
  );
}

/* ------------------------------------------------------------- CitationChip */

export interface CitationChipProps {
  citation: string;
  known?: boolean;
}

/** States: linkable · unknown-source. */
export function CitationChip({ citation, known = true }: CitationChipProps) {
  if (!known) {
    return (
      <span className="dt-citation dt-citation--unknown" title="Bu kaynak kütükte bulunamadı">
        {citation}
      </span>
    );
  }
  return (
    <Link className="dt-citation" to={`/kaynaklar/${encodeURIComponent(citation)}`}>
      {citation}
    </Link>
  );
}

/* ------------------------------------------------------- SourceSnapshotCard */

export interface SourceSnapshotCardProps {
  snapshot: Snapshot;
  compact?: boolean;
}

/** States: verified · pending-review · stale · undated. */
export function SourceSnapshotCard({ snapshot, compact = false }: SourceSnapshotCardProps) {
  return (
    <Card
      title={compact ? undefined : snapshot.title}
      headingLevel={3}
      tone={snapshot.review_status === "verified" ? "default" : "warning"}
    >
      <DefinitionList
        items={[
          { term: "Yayımlayan", description: snapshot.publisher },
          { term: "Yakalama", description: formatDate(snapshot.captured_at) },
          {
            term: "Yürürlük",
            description:
              snapshot.effective_from || snapshot.effective_to
                ? `${formatDate(snapshot.effective_from)} — ${formatDate(snapshot.effective_to)}`
                : "Bilinmiyor",
          },
          { term: "İnceleme", description: <ReviewStatusBadge status={snapshot.review_status} /> },
          {
            term: "İçerik özeti",
            description: <code className="dt-mono">{snapshot.content_hash_short}</code>,
          },
          {
            term: "Resmî adres",
            description: (
              <Link href={snapshot.url} external>
                Kaynağı aç
              </Link>
            ),
          },
        ]}
      />
    </Card>
  );
}

/* ----------------------------------------------------- SourceFreshnessMeter */

export interface SourceFreshnessMeterProps {
  snapshots: readonly Snapshot[];
  /** Days after which a capture is called ageing. */
  warnAfterDays?: number;
}

/** States: fresh · ageing · empty. */
export function SourceFreshnessMeter({
  snapshots,
  warnAfterDays = 90,
}: SourceFreshnessMeterProps) {
  if (snapshots.length === 0) {
    return <EmptyState title="Kaynak yok" reason="Katalogda kayıtlı kaynak yakalaması yok." />;
  }
  const ages = snapshots
    .map((snapshot) => daysSince(snapshot.captured_at))
    .filter((value): value is number => value !== null);
  const oldest = ages.length > 0 ? Math.max(...ages) : null;
  const ageing = oldest !== null && oldest > warnAfterDays;
  const verified = snapshots.filter((s) => s.review_status === "verified").length;

  return (
    <div className="dt-freshness">
      <p>
        {formatNumber(snapshots.length)} kaynaktan {formatNumber(verified)} tanesi doğrulanmış.
      </p>
      <p className={cn(ageing && "dt-freshness--warn")}>
        {oldest === null
          ? "Yakalama tarihi okunamadı."
          : `En eski yakalama ${formatNumber(oldest)} gün önce.`}
      </p>
      {verified === 0 ? (
        <p className="dt-muted">
          Hiçbir kaynak henüz uzman incelemesinden geçmedi; hepsi inceleme bekliyor.
        </p>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------- ReviewStatusBadge */

export interface ReviewStatusBadgeProps {
  status: string;
}

/** States: verified · pending_review · stale · unknown. */
export function ReviewStatusBadge({ status }: ReviewStatusBadgeProps) {
  const tone: BadgeTone =
    status === "verified" ? "candidate" : status === "stale" ? "ineligible" : "conditional";
  return <Badge tone={tone}>{reviewStatusLabel(status)}</Badge>;
}

/* ----------------------------------------------------------- CallWindowBadge */

export interface CallWindowBadgeProps {
  state: string;
}

/**
 * An unknown call window is never rendered as open. Every seed programme is
 * currently unknown, and guessing "open" would be the single most damaging
 * false signal this product could send.
 *
 * States: open · closed · unknown.
 */
export function CallWindowBadge({ state }: CallWindowBadgeProps) {
  const tone: BadgeTone =
    state === "open" ? "candidate" : state === "closed" ? "ineligible" : "insufficient";
  return (
    <Badge
      tone={tone}
      srDescription={state === "unknown" ? "Çağrı penceresi yayımlanmamış" : undefined}
    >
      {callWindowLabel(state)}
    </Badge>
  );
}

/* ---------------------------------------------------------- DecisionHashPair */

export interface DecisionHashPairProps {
  inputHash: string;
  decisionHash: string;
}

/** States: always both hashes; they are what makes a decision reproducible. */
export function DecisionHashPair({ inputHash, decisionHash }: DecisionHashPairProps) {
  return (
    <div className="dt-hashpair">
      <CopyableHash label="Girdi özeti" value={inputHash} />
      <CopyableHash label="Karar özeti" value={decisionHash} />
      <p className="dt-muted">
        Aynı girdi, aynı kural sürümü ve aynı kaynak ile bu özetler değişmez. Değişirse girdi veya
        kural sürümü değişmiştir.
      </p>
    </div>
  );
}

/* -------------------------------------------------------- DecisionCompareGrid */

export interface DecisionCompareGridProps {
  decisions: readonly Decision[];
}

/** States: two-or-more · fewer-than-two. */
export function DecisionCompareGrid({ decisions }: DecisionCompareGridProps) {
  if (decisions.length < 2) {
    return (
      <EmptyState
        title="Karşılaştırma için en az iki karar gerekir"
        reason="Listeden iki veya daha fazla karar seçin."
      />
    );
  }

  // Transposed through the same grid: columns are the decisions being compared.
  return <DataGrid config={compareGridConfig(decisions)} rows={compareRows(decisions)} />;
}

/* ------------------------------------------------------------- ProgramCard */

export interface ProgramCardProps {
  program: Program;
  href?: string;
}

/** States: default · unknown-window · no-published-reference. */
export function ProgramCard({ program, href }: ProgramCardProps) {
  return (
    <Card
      title={href ? <Link to={href}>{program.name}</Link> : program.name}
      headingLevel={3}
      actions={<CallWindowBadge state={program.call_window_state} />}
    >
      <DefinitionList
        items={[
          { term: "Kod", description: <code className="dt-mono">{program.code}</code> },
          { term: "Destek türü", description: supportTypeLabel(program.support_type) },
          { term: "Sürüm", description: program.version },
          {
            term: "Gerekli belge",
            description:
              program.required_documents.length === 0
                ? "Belirtilmemiş"
                : `${formatNumber(program.required_documents.length)} kalem`,
          },
          {
            term: "Yayımlanmış referans",
            description: <MoneyStateLabel publishedReference={program.published_reference} />,
          },
        ]}
      />
      {program.notes ? <p className="dt-muted">{program.notes}</p> : null}
    </Card>
  );
}

/* ------------------------------------------- RequiredDocumentsChecklist */

export interface RequiredDocumentsChecklistProps {
  documents: readonly string[];
  storageKey?: string;
}

/**
 * The document list is real; the tick marks are not stored anywhere but this
 * browser. That is stated on the surface, because a checklist that looks
 * synced and is not is worse than no checklist.
 *
 * States: empty · unchecked · partially-checked · all-checked.
 */
export function RequiredDocumentsChecklist({
  documents,
  storageKey = "destektesvik.checklist",
}: RequiredDocumentsChecklistProps) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  if (documents.length === 0) {
    return <EmptyState title="Belge listesi yok" reason="Bu program için gerekli belge belirtilmemiş." />;
  }

  return (
    <div className="dt-checklist" data-storage-key={storageKey}>
      <ul>
        {documents.map((document) => {
          const id = `doc-${document.replace(/\W+/gu, "-")}`;
          return (
            <li key={document} className="dt-choice">
              <input
                id={id}
                type="checkbox"
                className="dt-choice__control"
                checked={checked[document] ?? false}
                onChange={(event) =>
                  setChecked((prev) => ({ ...prev, [document]: event.target.checked }))
                }
              />
              <label htmlFor={id}>{document}</label>
            </li>
          );
        })}
      </ul>
      <p className="dt-muted">
        İşaretlemeler yalnızca bu tarayıcıda tutulur, sunucuya gönderilmez ve başka bir cihazda
        görünmez.
      </p>
    </div>
  );
}

/* -------------------------------------------------------- ApprovalRecordCard */

export interface ApprovalRecordCardProps {
  note?: string;
  /**
   * When the approval was recorded. Comes from the write, never from a render:
   * a value built with `new Date()` during rendering moves every time the page
   * repaints, which is an audit line that audits nothing.
   */
  approvedAt?: string;
  /**
   * Whose clock produced `approvedAt`.
   *
   * `server` is `ApprovalOut.approved_at`. `client` is this browser's send
   * time, which is all there is when the endpoint answers `303` with an HTML
   * page - and when that is the case the card says so, rather than presenting a
   * browser clock as an institutional record.
   */
  approvedAtSource?: "server" | "client";
  /** True when the write succeeded but cannot be read back. */
  writeOnly?: boolean;
}

/**
 * The user's own approval. Never "Onaylandı", never an institutional act.
 *
 * States: recorded-in-session · unreadable (no list endpoint) · none.
 */
export function ApprovalRecordCard({
  note,
  approvedAt,
  approvedAtSource = "server",
  writeOnly = true,
}: ApprovalRecordCardProps) {
  return (
    <Card title={USER_APPROVAL_LABEL} headingLevel={3}>
      {approvedAt ? (
        <DefinitionList
          items={[
            { term: "Kaydeden", description: "Bu oturumdaki kullanıcı" },
            { term: "Zaman", description: formatDateTime(approvedAt) },
            { term: "Not", description: note && note.length > 0 ? note : "—" },
          ]}
        />
      ) : (
        <p className="dt-muted">Bu karar için bu oturumda kayıt yapılmadı.</p>
      )}
      {approvedAt && approvedAtSource === "client" ? (
        <p className="dt-muted">
          Bu zaman bu tarayıcıdan kaydedildi: sunucu onay ucu bir denetim zaman damgası
          döndürmüyor, yalnızca sayfaya yönlendiriyor.
        </p>
      ) : null}
      <p className="dt-muted">
        Bu, kullanıcının kendi kaydıdır. Hiçbir kuruma iletilmez ve resmî bir karar değildir.
      </p>
      {writeOnly ? (
        <p className="dt-muted">
          Geçmiş onaylar listelenemiyor: sunucuda onay okuma ucu yok.
        </p>
      ) : null}
    </Card>
  );
}

/* ------------------------------------------------------------ MaturityRadar */

export interface MaturityRadarProps {
  dimensions: readonly MaturityDimensionResult[];
}

/**
 * Seven dimensions, side by side, with no aggregate.
 *
 * Rendered as labelled bars rather than an actual radar polygon: a radar chart
 * with two unmeasurable axes draws a shape that implies measurement where none
 * happened. Bars can simply say "Ölçülemiyor".
 *
 * States: measured · inferred · unmeasurable, per dimension.
 */
export function MaturityRadar({ dimensions }: MaturityRadarProps) {
  return (
    <ul className="dt-maturity">
      {dimensions.map((dimension) => (
        <li key={dimension.id} className="dt-maturity__row">
          <div className="dt-maturity__head">
            <h3 className="dt-maturity__title">{dimension.title}</h3>
            <Badge
              tone={
                dimension.measurability === "measured"
                  ? "accent"
                  : dimension.measurability === "inferred"
                    ? "conditional"
                    : "insufficient"
              }
            >
              {MEASURABILITY_LABELS[dimension.measurability]}
            </Badge>
          </div>
          <p className="dt-maturity__level">{levelLabel(dimension.level)}</p>
          {dimension.level !== null ? (
            <span className="dt-maturity__bar" aria-hidden="true">
              <span
                className="dt-maturity__fill"
                style={{ inlineSize: `${(dimension.level / 5) * 100}%` }}
              />
            </span>
          ) : null}
          <p className="dt-muted">{dimension.rationale}</p>
          {dimension.blocker ? (
            <p className="dt-maturity__blocker">Engel: {dimension.blocker}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/* ---------------------------------------------------------- MoneyStateLabel */

export interface MoneyStateLabelProps {
  publishedReference: string | null;
}

/**
 * The only money-shaped value in the system is a *published ceiling*, and every
 * programme currently has none. This component therefore usually renders an
 * explanation rather than a number - and even when a value exists it is
 * labelled as a published ceiling, never as an amount the user will receive.
 *
 * States: absent (default today) · published-ceiling.
 */
export function MoneyStateLabel({ publishedReference }: MoneyStateLabelProps) {
  if (!publishedReference) {
    return (
      <span className="dt-money dt-money--absent">
        Yayımlanmış üst limit bilgisi yok
        <VisuallyHidden>
          . Bu sistem hak edilmiş veya ödenecek tutar hesaplamaz.
        </VisuallyHidden>
      </span>
    );
  }
  return (
    <span className="dt-money">
      <strong>{publishedReference}</strong>{" "}
      <span className="dt-muted">(kaynakta yayımlanmış üst limit — ödenecek tutar değildir)</span>
    </span>
  );
}

/* --------------------------------------------------- BackendCapabilityGate */

export interface BackendCapabilityGateProps {
  capability: Capability;
  /** Rendered when the capability is green. */
  children?: ReactNode;
}

/**
 * The gate that keeps blocked capabilities honest.
 *
 * A blocked capability renders as a disabled, clearly labelled placeholder with
 * the reason attached. It never renders a working-looking control, and it never
 * says "yakında" - nobody has committed to a date.
 *
 * States: green (passes through) · partial (renders with a notice) · blocked.
 */
export function BackendCapabilityGate({ capability, children }: BackendCapabilityGateProps) {
  if (capability.status === "green") return <>{children}</>;

  if (capability.status === "partial") {
    return (
      <div className="dt-capability dt-capability--partial">
        <p className="dt-capability__label">
          <Badge tone="conditional">{STATUS_LABELS.partial}</Badge> {capability.title}
        </p>
        {capability.reason ? <p className="dt-muted">{capability.reason}</p> : null}
        {children}
      </div>
    );
  }

  return (
    <div className="dt-capability dt-capability--blocked" aria-disabled="true">
      <p className="dt-capability__label">
        <Badge tone="insufficient">{BLOCKED_LABEL}</Badge> {capability.title}
      </p>
      {capability.reason ? <p className="dt-muted">{capability.reason}</p> : null}
      <button type="button" className="dt-btn dt-btn--secondary" disabled aria-disabled="true">
        Kullanılamıyor
      </button>
    </div>
  );
}
