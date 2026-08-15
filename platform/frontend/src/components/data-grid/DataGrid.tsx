/**
 * The grid itself.
 *
 * Semantic `<table>` with a caption and scoped headers on desktop; a card list
 * below the table breakpoint, because six columns on a 320px phone is a
 * horizontal scroll and this content is meant to be read carefully.
 *
 * Everything it does happens over `rows` - the records already loaded. It never
 * implies knowledge of records it has not received.
 */

import { useCallback, useId, useMemo, useState } from "react";

import { cn } from "@/lib/cn";
import { useUiStore } from "@/store/ui";
import { EmptyState, ErrorState, SkeletonBlock } from "../patterns";
import { Button } from "../primitives";
import { downloadCsv, toCsv } from "./csv";
import { GridToolbar } from "./GridToolbar";
import { initialGridState, orderedVisibleColumns, runPipeline } from "./pipeline";
import { deleteView, listSavedViews, saveView } from "./saved-views";
import { encodeGridState } from "./url-state";
import type { GridConfig, GridState, GridStatus } from "./types";

export interface DataGridProps<TRow> {
  config: GridConfig<TRow>;
  rows: readonly TRow[];
  status?: GridStatus;
  errorMessage?: string;
  onRefresh?: () => void;
  /** Controlled state, for consumers that own the URL. */
  state?: GridState;
  onStateChange?: (state: GridState) => void;
}

export function DataGrid<TRow>({
  config,
  rows,
  status = "idle",
  errorMessage,
  onRefresh,
  state: controlledState,
  onStateChange,
}: DataGridProps<TRow>) {
  const initial = useMemo(() => initialGridState(config), [config]);
  const [internalState, setInternalState] = useState<GridState>(initial);
  const state = controlledState ?? internalState;
  const density = useUiStore((store) => store.density);
  const captionId = useId();

  const [savedViewNames, setSavedViewNames] = useState<string[]>(() =>
    listSavedViews(config.id, config.schemaVersion).map((view) => view.name),
  );

  const update = useCallback(
    (patch: Partial<GridState>) => {
      const next = { ...state, ...patch };
      if (onStateChange) onStateChange(next);
      else setInternalState(next);
    },
    [state, onStateChange],
  );

  const columns = useMemo(() => orderedVisibleColumns(config, state), [config, state]);
  const result = useMemo(() => runPipeline(config, state, rows), [config, state, rows]);

  const dataRows = result.rendered.filter(
    (row): row is Extract<typeof row, { type: "row" }> => row.type === "row",
  );
  const loadedIds = useMemo(() => rows.map((row) => config.getRowId(row)), [rows, config]);

  /**
   * A selection only ever means "these loaded rows". Rather than syncing state
   * in an effect when the loaded set changes - which cascades renders - the
   * stale ids are simply ignored at read time. The grid can never act on a row
   * it no longer holds.
   */
  const selectedIds = useMemo(
    () => state.selectedRowIds.filter((id) => loadedIds.includes(id)),
    [state.selectedRowIds, loadedIds],
  );
  const allSelected = loadedIds.length > 0 && selectedIds.length === loadedIds.length;
  const selectedRows = rows.filter((row) => selectedIds.includes(config.getRowId(row)));
  const shareUrl = encodeGridState(state, initial);

  const announcement =
    status === "loading"
      ? "Yükleniyor…"
      : status === "refreshing"
        ? "Yenileniyor…"
        : `${result.matched.length} satır listeleniyor (${result.totalLoaded} yüklenmiş satır içinden).`;

  const rowLabel = (row: TRow): string => {
    const first = columns[0];
    return first ? String(first.accessor(row) ?? "") : config.getRowId(row);
  };

  if (status === "error") {
    return (
      <ErrorState
        message={errorMessage ?? "Tablo yüklenemedi."}
        {...(onRefresh ? { onRetry: onRefresh } : {})}
      />
    );
  }

  if (status === "loading") {
    return (
      <div className="dt-grid">
        {/* One live region at a time: the skeleton already announces itself,
            and a second `role="status"` would make a screen reader read two
            competing messages for one event. */}
        <SkeletonBlock lines={5} label="Tablo yükleniyor" />
      </div>
    );
  }

  const toolbar = (
    <GridToolbar
      config={config}
      state={state}
      matchedCount={result.matched.length}
      onChange={update}
      savedViewNames={savedViewNames}
      shareUrl={shareUrl}
      onExportCsv={() =>
        downloadCsv(`${config.id}.csv`, toCsv(columns, result.matched))
      }
      onSaveView={(name) => {
        saveView(config.id, config.schemaVersion, name, state);
        setSavedViewNames(listSavedViews(config.id, config.schemaVersion).map((v) => v.name));
      }}
      onApplyView={(name) => {
        const view = listSavedViews(config.id, config.schemaVersion).find((v) => v.name === name);
        if (view) update(view.state);
      }}
      onDeleteView={(name) => {
        deleteView(config.id, config.schemaVersion, name);
        setSavedViewNames(listSavedViews(config.id, config.schemaVersion).map((v) => v.name));
      }}
    />
  );

  const selectionBar =
    config.selectable && selectedIds.length > 0 ? (
      <div className="dt-grid__bulkbar" role="region" aria-label="Toplu eylem çubuğu">
        <p>
          <strong>{selectedIds.length} satır seçildi</strong> — yalnızca bu oturumda
          yüklenmiş satırlar.
        </p>
        <div className="dt-row">
          {(config.bulkActions ?? []).map((action) => (
            <span key={action.id} className="dt-row">
              <Button
                size="sm"
                variant={action.destructive ? "danger" : "secondary"}
                disabled={action.allowed === false}
                onClick={() => action.run(selectedRows)}
              >
                {action.label}
              </Button>
              {action.allowed === false && action.reason ? (
                <span className="dt-muted">{action.reason}</span>
              ) : null}
            </span>
          ))}
          <Button size="sm" variant="ghost" onClick={() => update({ selectedRowIds: [] })}>
            Seçimi temizle
          </Button>
        </div>
      </div>
    ) : null;

  const isEmpty = rows.length === 0;
  const isNoResults = !isEmpty && result.matched.length === 0;

  const body = isEmpty ? (
    <EmptyState
      title={config.emptyTitle ?? "Kayıt yok"}
      reason={config.emptyMessage ?? "Bu tabloda gösterilecek yüklenmiş satır yok."}
    />
  ) : isNoResults ? (
    <EmptyState
      title={config.noResultsTitle ?? "Sonuç bulunamadı"}
      reason={
        config.noResultsMessage ??
        "Arama ve filtreler birlikte yüklenmiş satırların hiçbirini bırakmadı."
      }
      action={
        <Button size="sm" variant="secondary" onClick={() => update({ search: "", filters: {}, page: 1 })}>
          Aramayı ve filtreleri temizle
        </Button>
      }
    />
  ) : state.viewMode === "card" ? (
    <ul className="dt-grid__cards" aria-label={config.caption}>
      {dataRows.map((entry) => (
        <li key={entry.id} className="dt-grid__card">
          {config.renderCard ? config.renderCard(entry.row) : rowLabel(entry.row)}
        </li>
      ))}
    </ul>
  ) : (
    <>
      {/* Below the table breakpoint the same rows render as cards. */}
      {config.renderCard ? (
        <ul className="dt-grid__cards dt-grid__cards--mobile" aria-label={config.caption}>
          {dataRows.map((entry) => (
            <li key={entry.id} className="dt-grid__card">
              {config.renderCard?.(entry.row)}
            </li>
          ))}
        </ul>
      ) : null}

      <div className={cn("dt-scroll-x", "dt-grid__tablewrap", config.renderCard && "dt-grid__tablewrap--desktop")}>
        <table className="dt-table" data-density={density}>
          <caption id={captionId} className="dt-table__caption">
            {config.caption}
          </caption>
          <thead>
            <tr>
              {config.selectable ? (
                <th scope="col">
                  <label className="dt-choice">
                    <input
                      type="checkbox"
                      className="dt-choice__control"
                      checked={allSelected}
                      onChange={() =>
                        update({ selectedRowIds: allSelected ? [] : loadedIds })
                      }
                    />
                    <span className="dt-visually-hidden">Yüklenmiş tüm satırları seç</span>
                  </label>
                </th>
              ) : null}
              {columns.map((column) => {
                const rule = state.sort.find((candidate) => candidate.columnId === column.id);
                const ariaSort = !column.sortable
                  ? undefined
                  : rule?.direction === "asc"
                    ? "ascending"
                    : rule?.direction === "desc"
                      ? "descending"
                      : "none";
                return (
                  <th
                    key={column.id}
                    scope="col"
                    aria-sort={ariaSort}
                    data-pinned={state.pinnedColumnIds.includes(column.id) ? "start" : undefined}
                  >
                    {column.sortable ? (
                      <button
                        type="button"
                        className="dt-table__sort"
                        onClick={() =>
                          update({
                            sort: [
                              {
                                columnId: column.id,
                                direction: rule?.direction === "asc" ? "desc" : "asc",
                              },
                            ],
                            page: 1,
                          })
                        }
                      >
                        {column.header}
                        <span aria-hidden="true">
                          {rule?.direction === "asc" ? " ▲" : rule?.direction === "desc" ? " ▼" : " ⇅"}
                        </span>
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {result.rendered.map((entry) =>
              entry.type === "group" ? (
                <tr key={`group-${entry.key}`} className="dt-grid__grouprow">
                  <th scope="colgroup" colSpan={columns.length + (config.selectable ? 1 : 0)}>
                    <button
                      type="button"
                      className="dt-table__sort"
                      aria-expanded={!entry.collapsed}
                      onClick={() =>
                        update({
                          collapsedGroupKeys: entry.collapsed
                            ? state.collapsedGroupKeys.filter((key) => key !== entry.key)
                            : [...state.collapsedGroupKeys, entry.key],
                        })
                      }
                    >
                      {entry.label} grubu ({entry.count})
                    </button>
                  </th>
                </tr>
              ) : (
                <tr
                  key={entry.id}
                  aria-selected={config.selectable ? selectedIds.includes(entry.id) : undefined}
                >
                  {config.selectable ? (
                    <td>
                      <label className="dt-choice">
                        <input
                          type="checkbox"
                          className="dt-choice__control"
                          checked={selectedIds.includes(entry.id)}
                          onChange={() =>
                            update({
                              selectedRowIds: selectedIds.includes(entry.id)
                                ? selectedIds.filter((id) => id !== entry.id)
                                : [...selectedIds, entry.id],
                            })
                          }
                        />
                        <span className="dt-visually-hidden">
                          {rowLabel(entry.row)} satırını seç
                        </span>
                      </label>
                    </td>
                  ) : null}
                  {columns.map((column) => (
                    <td key={column.id}>
                      {column.cell
                        ? column.cell(entry.row)
                        : String(column.accessor(entry.row) ?? "")}
                    </td>
                  ))}
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </>
  );

  return (
    <div className="dt-grid" data-density={density}>
      {toolbar}
      <p role="status" aria-live="polite" className="dt-visually-hidden">
        {announcement}
      </p>
      {selectionBar}
      {body}
      {!isEmpty && !isNoResults && result.pageCount > 1 ? (
        <nav className="dt-grid__pagination" aria-label="Sayfalama">
          <Button
            size="sm"
            variant="secondary"
            disabled={state.page <= 1}
            onClick={() => update({ page: state.page - 1 })}
          >
            Önceki
          </Button>
          <span>
            {Math.min(state.page, result.pageCount)} / {result.pageCount}
          </span>
          <Button
            size="sm"
            variant="secondary"
            disabled={state.page >= result.pageCount}
            onClick={() => update({ page: state.page + 1 })}
          >
            Sonraki
          </Button>
          <span className="dt-muted">
            Sayfalama tarayıcıda yapılır; sunucu tüm kayıtları tek seferde döndürür.
          </span>
        </nav>
      ) : null}
    </div>
  );
}
