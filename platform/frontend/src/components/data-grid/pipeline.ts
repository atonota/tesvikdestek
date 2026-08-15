/**
 * Search, filter, sort, group and page - over the rows already loaded.
 *
 * Pure functions on purpose: the whole transformation from "what the server
 * gave us" to "what this page shows" is testable without rendering anything,
 * and the component never has to re-implement a comparison.
 */

import type {
  FilterValue,
  GridColumn,
  GridConfig,
  GridState,
  PipelineResult,
  RenderRow,
  SortRule,
} from "./types";

const LOCALE = "tr";

export function initialGridState<TRow>(config: GridConfig<TRow>): GridState {
  return {
    search: "",
    sort: config.defaultSort ?? [],
    filters: {},
    hiddenColumnIds: config.columns.filter((c) => c.hiddenByDefault).map((c) => c.id),
    columnOrder: config.columns.map((c) => c.id),
    pinnedColumnIds: [],
    groupByColumnId: null,
    collapsedGroupKeys: [],
    selectedRowIds: [],
    page: 1,
    pageSize: config.defaultPageSize ?? 25,
    viewMode: config.defaultViewMode ?? config.viewModes[0] ?? "table",
  };
}

/** Visible columns, in the user's order, pinned ones first. */
export function orderedVisibleColumns<TRow>(
  config: GridConfig<TRow>,
  state: GridState,
): readonly GridColumn<TRow>[] {
  const byId = new Map(config.columns.map((column) => [column.id, column]));
  const ordered = state.columnOrder
    .map((id) => byId.get(id))
    .filter((column): column is GridColumn<TRow> => column !== undefined)
    .filter((column) => !state.hiddenColumnIds.includes(column.id));
  const pinned = ordered.filter((column) => state.pinnedColumnIds.includes(column.id));
  const rest = ordered.filter((column) => !state.pinnedColumnIds.includes(column.id));
  return [...pinned, ...rest];
}

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "evet" : "hayır";
  return String(value);
}

function matchesSearch<TRow>(
  row: TRow,
  columns: readonly GridColumn<TRow>[],
  needle: string,
): boolean {
  if (needle.trim() === "") return true;
  const lowered = needle.toLocaleLowerCase(LOCALE);
  return columns.some((column) =>
    text(column.accessor(row)).toLocaleLowerCase(LOCALE).includes(lowered),
  );
}

function matchesFilter<TRow>(row: TRow, column: GridColumn<TRow>, filter: FilterValue): boolean {
  const raw = column.accessor(row);
  switch (filter.kind) {
    case "text":
      return filter.value.trim() === ""
        ? true
        : text(raw).toLocaleLowerCase(LOCALE).includes(filter.value.toLocaleLowerCase(LOCALE));
    case "enum":
      return filter.values.length === 0 ? true : filter.values.includes(String(raw));
    case "number": {
      const value = typeof raw === "number" ? raw : Number(raw);
      if (Number.isNaN(value)) return false;
      if (filter.min !== null && value < filter.min) return false;
      if (filter.max !== null && value > filter.max) return false;
      return true;
    }
    case "date": {
      const value = text(raw);
      if (value === "") return false;
      if (filter.from !== null && value < filter.from) return false;
      if (filter.to !== null && value > filter.to) return false;
      return true;
    }
    case "boolean":
      return filter.value === null ? true : Boolean(raw) === filter.value;
  }
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
  return String(a).localeCompare(String(b), LOCALE);
}

function sortRows<TRow>(
  rows: readonly TRow[],
  columns: readonly GridColumn<TRow>[],
  rules: readonly SortRule[],
): readonly TRow[] {
  if (rules.length === 0) return rows;
  const byId = new Map(columns.map((column) => [column.id, column]));
  // Stable: `sort` is stable in every engine we target, and equal rows keep
  // their loaded order, which is the server's order.
  return [...rows].sort((left, right) => {
    for (const rule of rules) {
      const column = byId.get(rule.columnId);
      if (!column) continue;
      const result = compare(column.accessor(left), column.accessor(right));
      if (result !== 0) return rule.direction === "asc" ? result : -result;
    }
    return 0;
  });
}

function groupLabel<TRow>(column: GridColumn<TRow>, value: string): string {
  return column.options?.find((option) => option.value === value)?.label ?? value;
}

export function runPipeline<TRow>(
  config: GridConfig<TRow>,
  state: GridState,
  rows: readonly TRow[],
): PipelineResult<TRow> {
  const visible = orderedVisibleColumns(config, state);
  const byId = new Map(config.columns.map((column) => [column.id, column]));

  let matched: readonly TRow[] = rows.filter((row) => matchesSearch(row, visible, state.search));
  for (const [columnId, filter] of Object.entries(state.filters)) {
    const column = byId.get(columnId);
    if (!column) continue;
    matched = matched.filter((row) => matchesFilter(row, column, filter));
  }
  matched = sortRows(matched, config.columns, state.sort);

  const pageSize = Math.max(1, state.pageSize);
  const pageCount = Math.max(1, Math.ceil(matched.length / pageSize));
  const page = Math.min(Math.max(1, state.page), pageCount);

  const groupColumn = state.groupByColumnId ? byId.get(state.groupByColumnId) : undefined;
  if (!groupColumn) {
    const start = (page - 1) * pageSize;
    const rendered: RenderRow<TRow>[] = matched
      .slice(start, start + pageSize)
      .map((row) => ({ type: "row", id: config.getRowId(row), row }));
    return { matched, rendered, pageCount, totalLoaded: rows.length };
  }

  // Grouped: rows are ordered by group, then paged, then the headers for the
  // groups present on this page are inserted. Collapsed groups contribute their
  // header and no rows.
  const groups = new Map<string, TRow[]>();
  for (const row of matched) {
    const key = text(groupColumn.accessor(row));
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  const flat: { key: string; row: TRow }[] = [];
  for (const [key, groupRows] of groups) {
    if (state.collapsedGroupKeys.includes(key)) continue;
    for (const row of groupRows) flat.push({ key, row });
  }

  const groupedPageCount = Math.max(1, Math.ceil(flat.length / pageSize));
  const groupedPage = Math.min(Math.max(1, state.page), groupedPageCount);
  const slice = flat.slice((groupedPage - 1) * pageSize, groupedPage * pageSize);

  const rendered: RenderRow<TRow>[] = [];
  const emitted = new Set<string>();
  for (const [key, groupRows] of groups) {
    const collapsed = state.collapsedGroupKeys.includes(key);
    const onPage = collapsed || slice.some((entry) => entry.key === key);
    if (!onPage) continue;
    rendered.push({
      type: "group",
      key,
      label: groupLabel(groupColumn, key),
      count: groupRows.length,
      collapsed,
    });
    emitted.add(key);
    if (collapsed) continue;
    for (const entry of slice.filter((candidate) => candidate.key === key)) {
      rendered.push({ type: "row", id: config.getRowId(entry.row), row: entry.row });
    }
  }

  return { matched, rendered, pageCount: groupedPageCount, totalLoaded: rows.length };
}
