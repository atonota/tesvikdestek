/**
 * The drawer's navigation — a single-open accordion over the workspace's
 * destinations, replacing the old desktop rail and the old mobile nav sheet
 * at every width.
 *
 * One section per destination, each a disclosure button that reveals the
 * link to that destination. Exactly one section is open at a time — opening
 * a second closes whichever was open — and the section that owns the
 * current route opens by default whenever the drawer is (re)mounted, because
 * Radix unmounts `Dialog.Content` on close and a fresh mount is exactly the
 * moment "where am I" should be answered without a click.
 *
 * Every link's `href` carries the address bar's current search string —
 * `?demo=…` included — because `NavLink`'s own `to` prop is read at render
 * time from `useLocation().search`, not patched in afterwards. A drawer that
 * dropped the demo query on its own links would silently end the demo the
 * next time a keyboard user tabs to a link and reads its target before
 * clicking.
 *
 * **Count, status dot and quick actions are a per-item contract, not
 * decoration baked into the row.** `metaByRoute` is keyed by `NavItem.to`;
 * a section with no entry renders exactly as it always has - no dash, no
 * placeholder dot - because a grey dot beside every one of seven routes,
 * every time, meaning nothing at all seven times over is its own kind of
 * fabrication. This build wires nothing real into it today: there is no
 * per-route action registry or freshness feed reaching the drawer. The
 * capability exists and is exercised with fixture values in
 * `cognitive-shell.stories.tsx`, so a future caller with a real signal - a
 * route that genuinely knows it has 2 pending actions - has a tested surface
 * to bind into rather than one invented the day the data shows up.
 */

import { useState } from "react";
import { NavLink, useLocation } from "react-router";

import { AppIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import type { NavItem } from "../shells";

export type ShellNavStatusTone = "ok" | "warning" | "bad" | "neutral";

/** Colour is never the only carrier - `label` is what a screen reader gets. */
export interface ShellNavStatus {
  readonly tone: ShellNavStatusTone;
  readonly label: string;
}

export interface ShellNavQuickAction {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly to?: string;
  readonly onRun?: () => void;
}

export interface ShellNavItemMeta {
  readonly count?: number;
  readonly status?: ShellNavStatus;
  readonly quickActions?: readonly ShellNavQuickAction[];
}

export interface ShellSidebarNavProps {
  readonly navItems: readonly NavItem[];
  readonly onNavigate?: () => void;
  /** Keyed by `NavItem.to`. See the file header for what an absent entry means. */
  readonly metaByRoute?: Readonly<Record<string, ShellNavItemMeta>> | undefined;
}

function ownsRoute(item: NavItem, pathname: string): boolean {
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

export function ShellSidebarNav({ navItems, onNavigate, metaByRoute }: ShellSidebarNavProps) {
  const location = useLocation();
  const activeIndex = navItems.findIndex((item) => ownsRoute(item, location.pathname));
  const [openIndex, setOpenIndex] = useState<number | null>(activeIndex >= 0 ? activeIndex : null);

  return (
    <nav aria-label="Sürükleme gezinmesi" className="dt-drawer__nav">
      <ul>
        {navItems.map((item, index) => {
          const open = openIndex === index;
          const panelId = `dt-drawer-nav-panel-${index}`;
          const triggerId = `dt-drawer-nav-trigger-${index}`;
          const meta = metaByRoute?.[item.to];
          return (
            <li key={item.to} className="dt-drawer__nav-section">
              <button
                type="button"
                id={triggerId}
                aria-expanded={open}
                aria-controls={panelId}
                className="dt-drawer__nav-disclosure"
                onClick={() => setOpenIndex(open ? null : index)}
              >
                <span aria-hidden="true" className="dt-drawer__nav-icon">
                  {item.icon ?? item.label.charAt(0)}
                </span>
                <span>{item.label}</span>
                {meta?.status ? (
                  <span
                    className="dt-drawer__nav-status-dot"
                    data-tone={meta.status.tone}
                    role="img"
                    aria-label={meta.status.label}
                    title={meta.status.label}
                  />
                ) : null}
                {meta?.count !== undefined ? (
                  <span className="dt-drawer__nav-count">{meta.count}</span>
                ) : null}
                <AppIcon
                  name="expand"
                  className={cn("dt-drawer__nav-caret", open && "is-open")}
                />
              </button>
              {/*
               * Always in the DOM, visually collapsed by CSS rather than
               * unmounted - `adaptive.css` collapses `[data-open="false"]` to
               * zero block size. A destination's link stays reachable by a
               * script (and by `?demo=` href inspection) whether or not a
               * person has opened its disclosure, and the *visual* collapse
               * - what a sighted or low-vision user actually sees - is a
               * browser-rendered fact `e2e/cognitive-shell-v2.spec.ts` checks,
               * not something jsdom can certify either way.
               */}
              <div
                id={panelId}
                role="group"
                aria-labelledby={triggerId}
                data-open={open}
                className="dt-drawer__nav-panel"
              >
                <NavLink
                  to={`${item.to}${location.search}`}
                  tabIndex={open ? undefined : -1}
                  className={({ isActive }) =>
                    cn("dt-drawer__nav-link", isActive && "is-active")
                  }
                  onClick={onNavigate}
                >
                  {item.label}
                </NavLink>
                {meta?.quickActions?.length ? (
                  <ul className="dt-drawer__nav-actions">
                    {meta.quickActions.map((action) => (
                      <li key={action.id}>
                        {action.to ? (
                          <NavLink
                            to={`${action.to}${location.search}`}
                            tabIndex={open ? undefined : -1}
                            className="dt-drawer__nav-action"
                            onClick={onNavigate}
                          >
                            <span className="dt-drawer__nav-action-title">{action.title}</span>
                            <span className="dt-drawer__nav-action-desc">
                              {action.description}
                            </span>
                          </NavLink>
                        ) : (
                          <button
                            type="button"
                            tabIndex={open ? undefined : -1}
                            className="dt-drawer__nav-action"
                            onClick={() => {
                              action.onRun?.();
                              onNavigate?.();
                            }}
                          >
                            <span className="dt-drawer__nav-action-title">{action.title}</span>
                            <span className="dt-drawer__nav-action-desc">
                              {action.description}
                            </span>
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
