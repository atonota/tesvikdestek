/**
 * The control family: search, Sütunlar, Filtre, Sırala, Grupla, Daha fazla,
 * and the view-mode switch a consumer declared.
 *
 * Each menu is a plain disclosure rather than a floating widget: it keeps the
 * controls in the tab order, keeps them reachable on touch, and avoids a popup
 * layer that would need its own focus management to be honest about.
 */

import { useId, useState } from "react";

import { cn } from "@/lib/cn";
import { Button, IconButton, Input, Label } from "../primitives";
import { Select } from "../select";
import { DISABLED_CAPABILITIES } from "./capabilities";
import type { FilterValue, GridColumn, GridConfig, GridState, SortRule } from "./types";

export interface GridToolbarProps<TRow> {
  config: GridConfig<TRow>;
  state: GridState;
  matchedCount: number;
  onChange: (patch: Partial<GridState>) => void;
  onExportCsv: () => void;
  onSaveView: (name: string) => void;
  onApplyView: (name: string) => void;
  onDeleteView: (name: string) => void;
  savedViewNames: readonly string[];
  shareUrl: string;
}

type Panel = "columns" | "filter" | "sort" | "group" | "more" | null;

function activeFilterCount(filters: GridState["filters"]): number {
  return Object.values(filters).filter((filter) => {
    switch (filter.kind) {
      case "text":
        return filter.value.trim() !== "";
      case "enum":
        return filter.values.length > 0;
      case "number":
        return filter.min !== null || filter.max !== null;
      case "date":
        return filter.from !== null || filter.to !== null;
      case "boolean":
        return filter.value !== null;
    }
  }).length;
}

export function GridToolbar<TRow>({
  config,
  state,
  matchedCount,
  onChange,
  onExportCsv,
  onSaveView,
  onApplyView,
  onDeleteView,
  savedViewNames,
  shareUrl,
}: GridToolbarProps<TRow>) {
  const [panel, setPanel] = useState<Panel>(null);
  const [viewName, setViewName] = useState("");
  const [sortRows, setSortRows] = useState<SortRule[]>([]);
  const searchId = useId();

  const toggle = (next: Panel) => setPanel((current) => (current === next ? null : next));
  const filterCount = activeFilterCount(state.filters);

  const sortable = config.columns.filter((column) => column.sortable);
  const groupable = config.columns.filter((column) => column.groupable);
  const filterable = config.columns.filter((column) => column.filterable);
  const hideable = config.columns.filter((column) => column.hideable !== false);

  const openSort = () => {
    if (panel !== "sort") {
      setSortRows(
        state.sort.length > 0
          ? [...state.sort]
          : [{ columnId: sortable[0]?.id ?? "", direction: "asc" }],
      );
    }
    toggle("sort");
  };

  const commitSort = (rows: SortRule[]) => {
    setSortRows(rows);
    onChange({ sort: rows.filter((rule) => rule.columnId !== ""), page: 1 });
  };

  const setFilter = (columnId: string, value: FilterValue) =>
    onChange({ filters: { ...state.filters, [columnId]: value }, page: 1 });

  const filterOf = (column: GridColumn<TRow>): FilterValue => {
    const existing = state.filters[column.id];
    if (existing) return existing;
    switch (column.kind) {
      case "number":
        return { kind: "number", min: null, max: null };
      case "date":
        return { kind: "date", from: null, to: null };
      case "enum":
        return { kind: "enum", values: [] };
      case "boolean":
        return { kind: "boolean", value: null };
      default:
        return { kind: "text", value: "" };
    }
  };

  const move = (columnId: string, delta: -1 | 1) => {
    const order = [...state.columnOrder];
    const index = order.indexOf(columnId);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= order.length) return;
    const [moved] = order.splice(index, 1);
    order.splice(target, 0, moved as string);
    onChange({ columnOrder: order });
  };

  return (
    <div className="dt-grid__toolbar">
      <div className="dt-grid__toolbar-row">
        <div className="dt-grid__search">
          <Label htmlFor={searchId}>Ara</Label>
          <Input
            id={searchId}
            type="search"
            value={state.search}
            placeholder="Yüklenmiş satırlarda ara"
            onChange={(event) => onChange({ search: event.target.value, page: 1 })}
          />
        </div>

        <div className="dt-row" role="group" aria-label="Tablo denetimleri">
          {hideable.length > 0 ? (
            <Button variant="secondary" size="sm" aria-expanded={panel === "columns"} onClick={() => toggle("columns")}>
              Sütunlar
            </Button>
          ) : null}
          {filterable.length > 0 ? (
            <Button variant="secondary" size="sm" aria-expanded={panel === "filter"} onClick={() => toggle("filter")}>
              Filtre{filterCount > 0 ? ` (${filterCount})` : ""}
            </Button>
          ) : null}
          {sortable.length > 0 ? (
            <Button variant="secondary" size="sm" aria-expanded={panel === "sort"} onClick={openSort}>
              Sırala{state.sort.length > 0 ? ` (${state.sort.length})` : ""}
            </Button>
          ) : null}
          {groupable.length > 0 ? (
            <Button variant="secondary" size="sm" aria-expanded={panel === "group"} onClick={() => toggle("group")}>
              Grupla
            </Button>
          ) : null}
          <Button variant="secondary" size="sm" aria-expanded={panel === "more"} onClick={() => toggle("more")}>
            Daha fazla
          </Button>

          {config.viewModes.length > 1
            ? config.viewModes.map((mode) => (
                <IconButton
                  key={mode}
                  label={mode === "table" ? "Tablo görünümü" : "Kart görünümü"}
                  icon={mode === "table" ? "▤" : "▥"}
                  size="sm"
                  aria-pressed={state.viewMode === mode}
                  onClick={() => onChange({ viewMode: mode })}
                />
              ))
            : null}
        </div>
      </div>

      {panel === "columns" ? (
        <div className="dt-grid__panel" aria-label="Sütun ayarları">
          <ul className="dt-grid__panel-list">
            {state.columnOrder.map((columnId) => {
              const column = config.columns.find((candidate) => candidate.id === columnId);
              if (!column) return null;
              const visible = !state.hiddenColumnIds.includes(column.id);
              const pinned = state.pinnedColumnIds.includes(column.id);
              return (
                <li key={column.id} className="dt-grid__panel-item">
                  <label className="dt-choice">
                    <input
                      type="checkbox"
                      className="dt-choice__control"
                      checked={visible}
                      disabled={column.hideable === false}
                      onChange={() =>
                        onChange({
                          hiddenColumnIds: visible
                            ? [...state.hiddenColumnIds, column.id]
                            : state.hiddenColumnIds.filter((id) => id !== column.id),
                        })
                      }
                    />
                    <span>{column.header}</span>
                  </label>
                  <span className="dt-row">
                    <Button size="sm" variant="ghost" onClick={() => move(column.id, -1)}>
                      <span aria-hidden="true">↑</span>
                      <span className="dt-visually-hidden">{column.header} sütununu yukarı taşı</span>
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => move(column.id, 1)}>
                      <span aria-hidden="true">↓</span>
                      <span className="dt-visually-hidden">{column.header} sütununu aşağı taşı</span>
                    </Button>
                    {column.pinnable ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-pressed={pinned}
                        onClick={() =>
                          onChange({
                            pinnedColumnIds: pinned
                              ? state.pinnedColumnIds.filter((id) => id !== column.id)
                              : [...state.pinnedColumnIds, column.id],
                          })
                        }
                      >
                        <span aria-hidden="true">📌</span>
                        <span className="dt-visually-hidden">
                          {column.header} sütununu {pinned ? "çöz" : "sabitle"}
                        </span>
                      </Button>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {panel === "filter" ? (
        <div className="dt-grid__panel" aria-label="Filtreler">
          {filterable.map((column) => {
            const filter = filterOf(column);
            return (
              <fieldset key={column.id} className="dt-grid__filter">
                <legend>{column.header}</legend>
                {filter.kind === "enum" ? (
                  <div className="dt-row">
                    {(column.options ?? []).map((option) => {
                      const checked = filter.values.includes(option.value);
                      return (
                        <label key={option.value} className="dt-choice">
                          <input
                            type="checkbox"
                            className="dt-choice__control"
                            checked={checked}
                            onChange={() =>
                              setFilter(column.id, {
                                kind: "enum",
                                values: checked
                                  ? filter.values.filter((value) => value !== option.value)
                                  : [...filter.values, option.value],
                              })
                            }
                          />
                          <span>{option.label}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : null}

                {filter.kind === "number" ? (
                  <div className="dt-row">
                    <label>
                      <span className="dt-visually-hidden">{column.header} en az</span>
                      <input
                        type="number"
                        className="dt-input"
                        aria-label={`${column.header} en az`}
                        value={filter.min ?? ""}
                        onChange={(event) =>
                          setFilter(column.id, {
                            kind: "number",
                            min: event.target.value === "" ? null : Number(event.target.value),
                            max: filter.max,
                          })
                        }
                      />
                    </label>
                    <label>
                      <span className="dt-visually-hidden">{column.header} en fazla</span>
                      <input
                        type="number"
                        className="dt-input"
                        aria-label={`${column.header} en fazla`}
                        value={filter.max ?? ""}
                        onChange={(event) =>
                          setFilter(column.id, {
                            kind: "number",
                            min: filter.min,
                            max: event.target.value === "" ? null : Number(event.target.value),
                          })
                        }
                      />
                    </label>
                  </div>
                ) : null}

                {filter.kind === "date" ? (
                  <div className="dt-row">
                    <input
                      type="date"
                      className="dt-input"
                      aria-label={`${column.header} başlangıç`}
                      value={filter.from ?? ""}
                      onChange={(event) =>
                        setFilter(column.id, {
                          kind: "date",
                          from: event.target.value || null,
                          to: filter.to,
                        })
                      }
                    />
                    <input
                      type="date"
                      className="dt-input"
                      aria-label={`${column.header} bitiş`}
                      value={filter.to ?? ""}
                      onChange={(event) =>
                        setFilter(column.id, {
                          kind: "date",
                          from: filter.from,
                          to: event.target.value || null,
                        })
                      }
                    />
                  </div>
                ) : null}

                {filter.kind === "boolean" ? (
                  // "Hepsi" is the unfiltered state and its wire value is the
                  // empty string, exactly as it was with the native control.
                  <Select
                    label={`${column.header} durumu`}
                    value={filter.value === null ? "" : String(filter.value)}
                    onValueChange={(value) =>
                      setFilter(column.id, {
                        kind: "boolean",
                        value: value === "" ? null : value === "true",
                      })
                    }
                    options={[
                      { value: "", label: "Hepsi" },
                      { value: "true", label: "Evet" },
                      { value: "false", label: "Hayır" },
                    ]}
                  />
                ) : null}

                {filter.kind === "text" ? (
                  <input
                    type="text"
                    className="dt-input"
                    aria-label={`${column.header} içerir`}
                    value={filter.value}
                    onChange={(event) =>
                      setFilter(column.id, { kind: "text", value: event.target.value })
                    }
                  />
                ) : null}
              </fieldset>
            );
          })}
          <Button size="sm" variant="ghost" onClick={() => onChange({ filters: {}, page: 1 })}>
            Filtreleri temizle
          </Button>
        </div>
      ) : null}

      {panel === "sort" ? (
        <div className="dt-grid__panel" aria-label="Sıralama">
          {sortRows.map((rule, index) => (
            <div key={`${rule.columnId}-${index}`} className="dt-row">
              <Select
                label={`Sıralama sütunu ${index + 1}`}
                value={rule.columnId}
                onValueChange={(value) => {
                  const next = [...sortRows];
                  next[index] = { ...rule, columnId: value };
                  commitSort(next);
                }}
                options={[
                  { value: "", label: "Seçiniz" },
                  ...sortable.map((column) => ({ value: column.id, label: column.header })),
                ]}
              />
              <Select
                label={`Sıralama yönü ${index + 1}`}
                value={rule.direction}
                onValueChange={(value) => {
                  const next = [...sortRows];
                  next[index] = { ...rule, direction: value === "desc" ? "desc" : "asc" };
                  commitSort(next);
                }}
                options={[
                  { value: "asc", label: "Artan" },
                  { value: "desc", label: "Azalan" },
                ]}
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => commitSort(sortRows.filter((_, position) => position !== index))}
              >
                <span aria-hidden="true">×</span>
                <span className="dt-visually-hidden">{index + 1}. sıralama ölçütünü kaldır</span>
              </Button>
            </div>
          ))}
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              setSortRows([...sortRows, { columnId: sortable[0]?.id ?? "", direction: "asc" }])
            }
          >
            Sıralama ölçütü ekle
          </Button>
        </div>
      ) : null}

      {panel === "group" ? (
        <div className="dt-grid__panel" aria-label="Gruplama">
          <fieldset>
            <legend>Gruplama sütunu</legend>
            <label className="dt-choice">
              <input
                type="radio"
                className="dt-choice__control"
                name={`${config.id}-group`}
                checked={state.groupByColumnId === null}
                onChange={() => onChange({ groupByColumnId: null, page: 1 })}
              />
              <span>Gruplama yok</span>
            </label>
            {groupable.map((column) => (
              <label key={column.id} className="dt-choice">
                <input
                  type="radio"
                  className="dt-choice__control"
                  name={`${config.id}-group`}
                  checked={state.groupByColumnId === column.id}
                  onChange={() => onChange({ groupByColumnId: column.id, page: 1 })}
                />
                <span>{column.header}</span>
              </label>
            ))}
          </fieldset>
        </div>
      ) : null}

      {panel === "more" ? (
        <div className="dt-grid__panel" aria-label="Diğer işlemler">
          <div className="dt-stack">
            <Button size="sm" variant="secondary" onClick={onExportCsv}>
              CSV indir ({matchedCount} yüklenmiş satır)
            </Button>

            <div className="dt-row">
              <label>
                <span className="dt-visually-hidden">Görünüm adı</span>
                <input
                  className="dt-input"
                  aria-label="Görünüm adı"
                  value={viewName}
                  onChange={(event) => setViewName(event.target.value)}
                />
              </label>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  onSaveView(viewName);
                  setViewName("");
                }}
              >
                Görünümü kaydet
              </Button>
            </div>

            {savedViewNames.length > 0 ? (
              <ul className="dt-grid__panel-list">
                {savedViewNames.map((name) => (
                  <li key={name} className="dt-grid__panel-item">
                    <Button size="sm" variant="ghost" onClick={() => onApplyView(name)}>
                      {name}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onDeleteView(name)}>
                      <span aria-hidden="true">🗑</span>
                      <span className="dt-visually-hidden">{name} görünümünü sil</span>
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}

            <p className="dt-muted">
              Bağlantı: <code className="dt-mono">{shareUrl === "" ? "varsayılan görünüm" : `?${shareUrl}`}</code>
            </p>

            <details>
              <summary>Bu tablonun yapamadıkları</summary>
              <ul className="dt-list">
                {DISABLED_CAPABILITIES.map((capability) => (
                  <li key={capability.id}>
                    <strong>{capability.title}:</strong> {capability.reason}
                  </li>
                ))}
              </ul>
            </details>
          </div>
        </div>
      ) : null}

      <p className={cn("dt-muted", "dt-grid__scope")}>
        Tüm işlemler bu oturumda yüklenmiş satırlar üzerinde çalışır.
      </p>
    </div>
  );
}
