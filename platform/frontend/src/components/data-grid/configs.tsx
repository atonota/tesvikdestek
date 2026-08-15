/**
 * Typed grid configurations, one per domain table.
 *
 * These are the whole definition of a table: columns, what may be filtered or
 * grouped, which view modes the consumer offers, and the card fallback. A new
 * table - Media, Provider Connection, anything a later package adds - is a new
 * config in this file, not a new hand-written `<table>`.
 *
 * They take their labels from the domain modules, so a decision outcome or a
 * review status is spelled the same way here as everywhere else.
 */

import {
  reviewStatusLabel,
  type Decision,
  type Snapshot,
  type Trace,
} from "@/api/types";
import { factLabel } from "@/domain/facts";
import { OUTCOME_LABELS, OUTCOMES, reasonLabel } from "@/domain/outcomes";
import { formatDate, formatDateTime, formatNumber } from "@/lib/intl";
import {
  CitationChip,
  OutcomeBadge,
  ReviewStatusBadge,
  SourceSnapshotCard,
} from "../domain";
import { Card, DefinitionList } from "../composites";
import { Badge, Link } from "../primitives";
import type { GridConfig } from "./types";

/** One comparison row: a field, and that field's value for each decision. */
export interface CompareRow {
  readonly id: string;
  readonly label: string;
  readonly text: Readonly<Record<string, string>>;
  readonly node: Readonly<Record<string, React.ReactNode>>;
}

/**
 * The comparison matrix is a transposed table - rows are *fields*, columns are
 * *decisions* - so its columns are derived from the data rather than declared
 * ahead of time. It still goes through the same grid, which is what gives it a
 * caption, scoped headers, column control and CSV export for free.
 */
export function compareGridConfig(decisions: readonly Decision[]): GridConfig<CompareRow> {
  return {
    id: "decision-compare",
    schemaVersion: 1,
    caption: "Karar karşılaştırması",
    getRowId: (row) => row.id,
    viewModes: ["table"],
    emptyTitle: "Karşılaştırma için en az iki karar gerekir",
    emptyMessage: "Listeden iki veya daha fazla karar seçin.",
    columns: [
      {
        id: "field",
        header: "Alan",
        accessor: (row) => row.label,
        kind: "text",
        filterable: true,
        pinnable: true,
        hideable: false,
      },
      ...decisions.map((decision) => ({
        id: decision.id,
        header: decision.program_code,
        accessor: (row: CompareRow) => row.text[decision.id] ?? "",
        cell: (row: CompareRow) => row.node[decision.id] ?? "—",
        kind: "text" as const,
        hideable: true,
      })),
    ],
  };
}

/** Builds the comparison rows from the decisions themselves. */
export function compareRows(decisions: readonly Decision[]): CompareRow[] {
  const build = (
    id: string,
    label: string,
    text: (decision: Decision) => string,
    node?: (decision: Decision) => React.ReactNode,
  ): CompareRow => ({
    id,
    label,
    text: Object.fromEntries(decisions.map((d) => [d.id, text(d)])),
    node: Object.fromEntries(decisions.map((d) => [d.id, node ? node(d) : text(d)])),
  });

  return [
    build("program", "Program", (d) => d.program_code),
    build(
      "outcome",
      "Sonuç",
      (d) => d.outcome_label,
      (d) => <OutcomeBadge outcome={d.outcome} label={d.outcome_label} />,
    ),
    build(
      "ruleset",
      "Kural sürümü",
      (d) => d.rule_set_version_id,
      (d) => <code className="dt-mono">{d.rule_set_version_id}</code>,
    ),
    build(
      "programVersion",
      "Program sürümü",
      (d) => d.program_version_id,
      (d) => <code className="dt-mono">{d.program_version_id}</code>,
    ),
    build("reasons", "Gerekçeler", (d) => d.reasons.map(reasonLabel).join(", ") || "Yok"),
    build(
      "missing",
      "Eksik olgular",
      (d) => (d.missing_facts.length === 0 ? "Yok" : d.missing_facts.map(factLabel).join(", ")),
    ),
    build(
      "hash",
      "Karar özeti",
      (d) => d.decision_hash,
      (d) => <code className="dt-mono">{d.decision_hash.slice(0, 12)}…</code>,
    ),
    build("created", "Tarih", (d) => formatDateTime(d.created_at)),
  ];
}

export function decisionsGridConfig(options: {
  onCompare?: (ids: readonly string[]) => void;
}): GridConfig<Decision> {
  return {
    id: "decisions",
    schemaVersion: 1,
    caption: "Değerlendirme kararları",
    getRowId: (decision) => decision.id,
    viewModes: ["table", "card"],
    selectable: true,
    defaultSort: [{ columnId: "created", direction: "desc" }],
    emptyMessage:
      "Profilinizi doldurup değerlendirmeyi çalıştırdığınızda kararlar burada listelenir.",
    ...(options.onCompare
      ? {
          bulkActions: [
            {
              id: "compare",
              label: "Karşılaştır",
              run: (rows) => options.onCompare?.(rows.map((row) => row.id)),
            },
          ],
        }
      : {}),
    renderCard: (decision) => (
      <Card headingLevel={3} title={decision.program_code}>
        <div className="dt-row">
          <OutcomeBadge outcome={decision.outcome} label={decision.outcome_label} />
          <span className="dt-muted">{formatDateTime(decision.created_at)}</span>
        </div>
        <Link to={`/degerlendirmeler/${decision.id}`}>Ayrıntıya git</Link>
      </Card>
    ),
    columns: [
      {
        id: "program",
        header: "Program",
        accessor: (decision) => decision.program_code,
        cell: (decision) => (
          <Link to={`/degerlendirmeler/${decision.id}`}>{decision.program_code}</Link>
        ),
        kind: "text",
        sortable: true,
        filterable: true,
        pinnable: true,
      },
      {
        id: "outcome",
        header: "Sonuç",
        accessor: (decision) => decision.outcome,
        cell: (decision) => (
          <OutcomeBadge outcome={decision.outcome} label={decision.outcome_label} />
        ),
        kind: "enum",
        options: OUTCOMES.map((outcome) => ({ value: outcome, label: OUTCOME_LABELS[outcome] })),
        sortable: true,
        filterable: true,
        groupable: true,
      },
      {
        id: "missing",
        header: "Eksik olgu",
        accessor: (decision) => decision.missing_facts.length,
        cell: (decision) => formatNumber(decision.missing_facts.length),
        kind: "number",
        sortable: true,
        filterable: true,
      },
      {
        id: "reasons",
        header: "Gerekçe",
        accessor: (decision) => decision.reasons.map(reasonLabel).join(", "),
        kind: "text",
        filterable: true,
        hiddenByDefault: true,
      },
      {
        id: "ruleset",
        header: "Kural sürümü",
        accessor: (decision) => decision.rule_set_version_id,
        kind: "text",
        sortable: true,
        hiddenByDefault: true,
      },
      {
        id: "created",
        header: "Tarih",
        accessor: (decision) => decision.created_at,
        cell: (decision) => formatDateTime(decision.created_at),
        kind: "date",
        sortable: true,
        filterable: true,
      },
    ],
  };
}

export function sourcesGridConfig(): GridConfig<Snapshot> {
  return {
    id: "sources",
    schemaVersion: 1,
    caption: "Kaynak yakalamaları",
    getRowId: (snapshot) => snapshot.id,
    viewModes: ["table", "card"],
    defaultSort: [{ columnId: "captured", direction: "desc" }],
    emptyMessage: "Katalog henüz seed edilmemiş olabilir.",
    renderCard: (snapshot) => <SourceSnapshotCard snapshot={snapshot} />,
    columns: [
      {
        id: "title",
        header: "Başlık",
        accessor: (snapshot) => snapshot.title,
        cell: (snapshot) => (
          <Link to={`/kaynaklar/${encodeURIComponent(snapshot.id)}`}>{snapshot.title}</Link>
        ),
        kind: "text",
        sortable: true,
        filterable: true,
        pinnable: true,
      },
      {
        id: "publisher",
        header: "Yayımlayan",
        accessor: (snapshot) => snapshot.publisher,
        kind: "enum",
        options: [
          { value: "TÜBİTAK", label: "TÜBİTAK" },
          { value: "KOSGEB", label: "KOSGEB" },
        ],
        sortable: true,
        filterable: true,
        groupable: true,
      },
      {
        id: "captured",
        header: "Yakalama",
        accessor: (snapshot) => snapshot.captured_at,
        cell: (snapshot) => formatDate(snapshot.captured_at),
        kind: "date",
        sortable: true,
        filterable: true,
      },
      {
        id: "status",
        header: "İnceleme",
        accessor: (snapshot) => snapshot.review_status,
        cell: (snapshot) => <ReviewStatusBadge status={snapshot.review_status} />,
        kind: "enum",
        options: ["verified", "pending_review", "stale"].map((value) => ({
          value,
          label: reviewStatusLabel(value),
        })),
        sortable: true,
        filterable: true,
        groupable: true,
      },
      {
        id: "hash",
        header: "İçerik özeti",
        accessor: (snapshot) => snapshot.content_hash_short,
        cell: (snapshot) => <code className="dt-mono">{snapshot.content_hash_short}</code>,
        kind: "text",
        hiddenByDefault: true,
      },
    ],
  };
}

const TRUTH_LABELS: Record<string, string> = {
  true: "Sağlandı",
  false: "Sağlanmadı",
  unknown: "Bilinmiyor",
};

function traceValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return value.map((item) => String(item)).join(", ");
  if (typeof value === "boolean") return value ? "Evet" : "Hayır";
  return String(value);
}

/** The rule trace: the most-read table in the product. */
export function traceGridConfig(knownSnapshotIds: readonly string[]): GridConfig<Trace> {
  return {
    id: "decision-trace",
    schemaVersion: 1,
    caption: "Kural izi — her satır, kararın dayandığı tek bir koşuldur",
    getRowId: (trace) => `${trace.fact}-${trace.operator}-${trace.citation}`,
    viewModes: ["table", "card"],
    emptyTitle: "Kural izi yok",
    emptyMessage: "Bu karar için değerlendirilmiş bir koşul kaydı bulunmuyor.",
    renderCard: (trace) => (
      <>
        <div className="dt-row">
          <strong>{factLabel(trace.fact)}</strong>
          <Badge
            tone={
              trace.result === "true"
                ? "candidate"
                : trace.result === "false"
                  ? "ineligible"
                  : "insufficient"
            }
          >
            {TRUTH_LABELS[trace.result] ?? trace.result}
          </Badge>
        </div>
        <DefinitionList
          items={[
            { term: "Koşul", description: trace.operator },
            { term: "Beklenen", description: traceValue(trace.expected) },
            { term: "Girilen", description: traceValue(trace.actual) },
            {
              term: "Kaynak",
              description: (
                <CitationChip
                  citation={trace.citation}
                  known={knownSnapshotIds.includes(trace.citation)}
                />
              ),
            },
          ]}
        />
      </>
    ),
    columns: [
      {
        id: "fact",
        header: "Olgu",
        accessor: (trace) => factLabel(trace.fact),
        kind: "text",
        sortable: true,
        filterable: true,
        pinnable: true,
      },
      { id: "operator", header: "Koşul", accessor: (trace) => trace.operator, kind: "text", filterable: true },
      { id: "expected", header: "Beklenen", accessor: (trace) => traceValue(trace.expected), kind: "text" },
      { id: "actual", header: "Girilen", accessor: (trace) => traceValue(trace.actual), kind: "text" },
      {
        id: "citation",
        header: "Kaynak",
        accessor: (trace) => trace.citation,
        cell: (trace) => (
          <CitationChip
            citation={trace.citation}
            known={knownSnapshotIds.includes(trace.citation)}
          />
        ),
        kind: "text",
        filterable: true,
      },
      {
        id: "result",
        header: "Sonuç",
        accessor: (trace) => trace.result,
        cell: (trace) => (
          <Badge
            tone={
              trace.result === "true"
                ? "candidate"
                : trace.result === "false"
                  ? "ineligible"
                  : "insufficient"
            }
          >
            {TRUTH_LABELS[trace.result] ?? trace.result}
          </Badge>
        ),
        kind: "enum",
        options: Object.entries(TRUTH_LABELS).map(([value, label]) => ({ value, label })),
        sortable: true,
        filterable: true,
        groupable: true,
      },
    ],
  };
}
