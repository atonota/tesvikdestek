/**
 * Named views, stored in this browser only.
 *
 * Scoped by grid id *and* schema version: when a grid's columns change in a way
 * that invalidates old state, bumping the version retires those views instead
 * of silently applying a filter to a column that no longer exists.
 *
 * There is no endpoint for user preferences, so these cannot follow a user to
 * another device. That limitation is declared in `capabilities.ts` and shown in
 * the interface; it is never implied away.
 */

import type { GridState } from "./types";

export interface SavedView {
  readonly name: string;
  readonly state: GridState;
}

const PREFIX = "destektesvik.grid-views";

function storageKey(gridId: string, schemaVersion: number): string {
  return `${PREFIX}.${gridId}.v${schemaVersion}`;
}

function read(gridId: string, schemaVersion: number): SavedView[] {
  try {
    const raw = globalThis.localStorage?.getItem(storageKey(gridId, schemaVersion));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedView[]) : [];
  } catch {
    return [];
  }
}

function write(gridId: string, schemaVersion: number, views: readonly SavedView[]): void {
  try {
    globalThis.localStorage?.setItem(storageKey(gridId, schemaVersion), JSON.stringify(views));
  } catch {
    // A full or disabled store must not take the grid down with it.
  }
}

export function listSavedViews(gridId: string, schemaVersion: number): SavedView[] {
  return read(gridId, schemaVersion);
}

export function saveView(
  gridId: string,
  schemaVersion: number,
  name: string,
  state: GridState,
): void {
  const trimmed = name.trim();
  if (trimmed === "") return;
  // Selection is per-session and is never stored.
  const stored: GridState = { ...state, selectedRowIds: [] };
  const existing = read(gridId, schemaVersion).filter((view) => view.name !== trimmed);
  write(gridId, schemaVersion, [...existing, { name: trimmed, state: stored }]);
}

export function deleteView(gridId: string, schemaVersion: number, name: string): void {
  write(
    gridId,
    schemaVersion,
    read(gridId, schemaVersion).filter((view) => view.name !== name),
  );
}
