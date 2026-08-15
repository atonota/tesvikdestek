/**
 * The data-grid contract.
 *
 * One typed configuration describes a table completely: its columns, what may
 * be sorted, filtered, grouped, pinned or hidden, which view modes the consumer
 * offers, and which actions a permission allows. Consumers never hand-roll
 * markup, so accessibility and the mobile card fallback cannot be forgotten in
 * one table and remembered in another.
 *
 * Everything here is client-side by construction. The backend exposes no
 * paging, filtering, sorting or bulk endpoints, so this module operates on the
 * rows already loaded and says so - see `capabilities.ts`.
 */

import type { ReactNode } from "react";

/** How a column's values behave when filtered and sorted. */
export type ColumnKind = "text" | "number" | "date" | "enum" | "boolean";

export interface EnumOption {
  readonly value: string;
  readonly label: string;
}

export interface GridColumn<TRow> {
  readonly id: string;
  readonly header: string;
  /** Raw comparable value: drives sorting, filtering, grouping and export. */
  readonly accessor: (row: TRow) => string | number | boolean | null;
  /** Optional rich rendering. Falls back to the accessor value. */
  readonly cell?: (row: TRow) => ReactNode;
  readonly kind?: ColumnKind;
  /** Enum columns declare their options so the filter needs no data scan. */
  readonly options?: readonly EnumOption[];
  readonly sortable?: boolean;
  readonly filterable?: boolean;
  readonly groupable?: boolean;
  readonly hideable?: boolean;
  readonly pinnable?: boolean;
  readonly hiddenByDefault?: boolean;
  /** Screen-reader text when the header itself is an icon or is abbreviated. */
  readonly headerDescription?: string;
}

/** Declared per consumer; a grid never invents a mode its data cannot fill. */
export type GridViewMode = "table" | "card";

export type SortDirection = "asc" | "desc";

export interface SortRule {
  readonly columnId: string;
  readonly direction: SortDirection;
}

/** A filter is always tied to a column and carries its kind for validation. */
export type FilterValue =
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "number"; readonly min: number | null; readonly max: number | null }
  | { readonly kind: "date"; readonly from: string | null; readonly to: string | null }
  | { readonly kind: "enum"; readonly values: readonly string[] }
  | { readonly kind: "boolean"; readonly value: boolean | null };

export type FilterMap = Readonly<Record<string, FilterValue>>;

export type ColumnPin = "start" | "none";

/** Everything a user can change about how a grid is presented. */
export interface GridState {
  readonly search: string;
  readonly sort: readonly SortRule[];
  readonly filters: FilterMap;
  readonly hiddenColumnIds: readonly string[];
  readonly columnOrder: readonly string[];
  readonly pinnedColumnIds: readonly string[];
  readonly groupByColumnId: string | null;
  readonly collapsedGroupKeys: readonly string[];
  readonly selectedRowIds: readonly string[];
  readonly page: number;
  readonly pageSize: number;
  readonly viewMode: GridViewMode;
}

/** What a bulk action may do. Blocked ones are declared, never hidden. */
export interface BulkAction<TRow> {
  readonly id: string;
  readonly label: string;
  /** Runs against the loaded, selected rows only. */
  readonly run: (rows: readonly TRow[]) => void;
  /** When false the control renders disabled with `reason` attached. */
  readonly allowed?: boolean;
  readonly reason?: string;
  readonly destructive?: boolean;
}

export interface RowAction<TRow> {
  readonly id: string;
  readonly label: string;
  readonly run: (row: TRow) => void;
  readonly allowed?: (row: TRow) => boolean;
  readonly reason?: string;
}

export interface GridConfig<TRow> {
  /** Stable id; scopes saved views and URL state. */
  readonly id: string;
  /** Bumping this retires incompatible saved views instead of misreading them. */
  readonly schemaVersion: number;
  /** Required: a table without a caption is a maze for a screen reader. */
  readonly caption: string;
  readonly columns: readonly GridColumn<TRow>[];
  readonly getRowId: (row: TRow) => string;
  readonly viewModes: readonly GridViewMode[];
  readonly defaultViewMode?: GridViewMode;
  /** Required when "card" is offered. */
  readonly renderCard?: (row: TRow) => ReactNode;
  readonly defaultSort?: readonly SortRule[];
  readonly defaultPageSize?: number;
  readonly selectable?: boolean;
  readonly bulkActions?: readonly BulkAction<TRow>[];
  readonly rowActions?: readonly RowAction<TRow>[];
  /** Empty and no-results copy. A generic "Kayıt yok" loses the table's meaning. */
  readonly emptyTitle?: string;
  readonly emptyMessage?: string;
  readonly noResultsTitle?: string;
  readonly noResultsMessage?: string;
}

/** A grid row after the pipeline has run, flattened with its group header. */
export interface GroupHeaderRow {
  readonly type: "group";
  readonly key: string;
  readonly label: string;
  readonly count: number;
  readonly collapsed: boolean;
}

export interface DataRow<TRow> {
  readonly type: "row";
  readonly id: string;
  readonly row: TRow;
}

export type RenderRow<TRow> = GroupHeaderRow | DataRow<TRow>;

export interface PipelineResult<TRow> {
  /** Rows after search, filters and sort, before paging. */
  readonly matched: readonly TRow[];
  /** What the current page renders, including group headers. */
  readonly rendered: readonly RenderRow<TRow>[];
  readonly pageCount: number;
  readonly totalLoaded: number;
}

/** Every state a grid can honestly be in. */
export type GridStatus = "idle" | "loading" | "refreshing" | "error" | "empty" | "no-results";
