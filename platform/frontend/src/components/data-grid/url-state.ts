/**
 * Grid state in a query string, so a filtered view can be linked and reloaded.
 *
 * Only differences from the default are encoded. A pristine grid produces an
 * empty string, which keeps the address bar clean and makes "is this the
 * default view?" a cheap question.
 *
 * Selection is deliberately excluded: it refers to rows loaded in one session,
 * and a link that claims to restore a selection it cannot verify would be a
 * small lie of exactly the kind this product avoids.
 */

import type { FilterMap, GridState, SortDirection } from "./types";

function encodeSort(sort: GridState["sort"]): string {
  return sort.map((rule) => `${rule.columnId}:${rule.direction}`).join(",");
}

function decodeSort(raw: string): GridState["sort"] {
  return raw
    .split(",")
    .filter(Boolean)
    .map((chunk) => {
      const [columnId = "", direction = "asc"] = chunk.split(":");
      return { columnId, direction: (direction === "desc" ? "desc" : "asc") as SortDirection };
    })
    .filter((rule) => rule.columnId !== "");
}

export function encodeGridState(state: GridState, initial: GridState): string {
  const params = new URLSearchParams();
  if (state.search !== initial.search) params.set("q", state.search);
  if (encodeSort(state.sort) !== encodeSort(initial.sort)) params.set("sort", encodeSort(state.sort));
  if (state.page !== initial.page) params.set("sayfa", String(state.page));
  if (state.pageSize !== initial.pageSize) params.set("boyut", String(state.pageSize));
  if (state.viewMode !== initial.viewMode) params.set("gorunum", state.viewMode);
  if (state.groupByColumnId !== initial.groupByColumnId) {
    params.set("grup", state.groupByColumnId ?? "");
  }
  if (state.hiddenColumnIds.join(",") !== initial.hiddenColumnIds.join(",")) {
    params.set("gizli", state.hiddenColumnIds.join(","));
  }
  if (state.columnOrder.join(",") !== initial.columnOrder.join(",")) {
    params.set("sira", state.columnOrder.join(","));
  }
  if (state.pinnedColumnIds.join(",") !== initial.pinnedColumnIds.join(",")) {
    params.set("sabit", state.pinnedColumnIds.join(","));
  }
  if (Object.keys(state.filters).length > 0) {
    params.set("filtre", JSON.stringify(state.filters));
  }
  return params.toString();
}

export function decodeGridState(query: string, initial: GridState): GridState {
  const params = new URLSearchParams(query);
  const list = (key: string): string[] | null => {
    const raw = params.get(key);
    if (raw === null) return null;
    return raw.split(",").filter(Boolean);
  };

  let filters: FilterMap = initial.filters;
  const rawFilters = params.get("filtre");
  if (rawFilters) {
    try {
      filters = JSON.parse(rawFilters) as FilterMap;
    } catch {
      // A malformed link falls back to the default rather than throwing the
      // whole screen away.
      filters = initial.filters;
    }
  }

  const sortRaw = params.get("sort");
  const viewMode = params.get("gorunum");
  const group = params.get("grup");

  return {
    ...initial,
    search: params.get("q") ?? initial.search,
    sort: sortRaw === null ? initial.sort : decodeSort(sortRaw),
    page: Number(params.get("sayfa") ?? initial.page) || initial.page,
    pageSize: Number(params.get("boyut") ?? initial.pageSize) || initial.pageSize,
    viewMode: viewMode === "card" || viewMode === "table" ? viewMode : initial.viewMode,
    groupByColumnId: group === null ? initial.groupByColumnId : group === "" ? null : group,
    hiddenColumnIds: list("gizli") ?? initial.hiddenColumnIds,
    columnOrder: list("sira") ?? initial.columnOrder,
    pinnedColumnIds: list("sabit") ?? initial.pinnedColumnIds,
    filters,
  };
}
