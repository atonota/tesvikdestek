/**
 * Level 4 - shells (4).
 *
 * Layout only. Shells decide where things sit at 320 / 768 / 1024 / 1440 and
 * own the document landmarks; they never fetch and never decide.
 */

import { useEffect, type ReactNode } from "react";
import { NavLink } from "react-router";

import { cn } from "@/lib/cn";
import { applyAppearance, useUiStore } from "@/store/ui";
import { OfflineBanner } from "./patterns";
import { IconButton } from "./primitives";

export interface NavItem {
  to: string;
  label: string;
  /** Short label for the ≤768px bottom bar. */
  shortLabel?: string;
  icon?: ReactNode;
}

function SkipLink() {
  return (
    <a className="dt-skip-link" href="#ana-icerik">
      İçeriğe geç
    </a>
  );
}

/** Applies persisted appearance to <html> once, and on every change. */
function useAppearance() {
  const density = useUiStore((state) => state.density);
  const theme = useUiStore((state) => state.theme);
  const fontScale = useUiStore((state) => state.fontScale);
  const reducedMotion = useUiStore((state) => state.reducedMotion);
  useEffect(() => {
    applyAppearance({ density, theme, fontScale, reducedMotion });
  }, [density, theme, fontScale, reducedMotion]);
}

/* ---------------------------------------------------------------- AppShell */

export interface AppShellProps {
  navItems: readonly NavItem[];
  children: ReactNode;
  /** Right-hand context strip at ≥1024px. */
  contextBar?: ReactNode;
  headerActions?: ReactNode;
}

/**
 * The authenticated frame.
 *
 * ≤768px: bottom navigation plus a drawer, thumb-reachable, no side rail.
 * ≥1024px: persistent left rail and a top context bar.
 *
 * States: drawer-open · drawer-closed · offline.
 */
export function AppShell({ navItems, children, contextBar, headerActions }: AppShellProps) {
  useAppearance();
  const drawerOpen = useUiStore((state) => state.navDrawerOpen);
  const toggleDrawer = useUiStore((state) => state.toggleNavDrawer);

  return (
    <div className={cn("dt-app", drawerOpen && "dt-app--drawer-open")}>
      <SkipLink />
      <header className="dt-app__header">
        <IconButton
          label={drawerOpen ? "Menüyü kapat" : "Menüyü aç"}
          icon={drawerOpen ? "✕" : "☰"}
          className="dt-app__menu-toggle"
          onClick={() => toggleDrawer()}
          aria-expanded={drawerOpen}
          aria-controls="ana-gezinme"
        />
        <NavLink to="/panel" className="dt-app__brand">
          DestekTeşvik
        </NavLink>
        <div className="dt-app__header-actions">{headerActions}</div>
      </header>

      <nav id="ana-gezinme" className="dt-app__rail" aria-label="Ana gezinme">
        <ul>
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) => cn("dt-app__nav-link", isActive && "is-active")}
                onClick={() => toggleDrawer(false)}
              >
                {item.icon ? (
                  <span aria-hidden="true" className="dt-app__nav-icon">
                    {item.icon}
                  </span>
                ) : null}
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="dt-app__content">
        {contextBar ? <div className="dt-app__context">{contextBar}</div> : null}
        <OfflineBanner />
        <main id="ana-icerik" className="dt-app__main" tabIndex={-1}>
          {children}
        </main>
      </div>

      <nav className="dt-app__bottom" aria-label="Hızlı gezinme">
        <ul>
          {navItems.slice(0, 5).map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) => cn("dt-app__bottom-link", isActive && "is-active")}
              >
                <span aria-hidden="true">{item.icon ?? "•"}</span>
                <span className="dt-app__bottom-label">{item.shortLabel ?? item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

/* ---------------------------------------------------------- WorkspaceShell */

export interface WorkspaceShellProps {
  listPanel: ReactNode;
  detailPanel: ReactNode;
  evidencePanel?: ReactNode;
  listLabel?: string;
  detailLabel?: string;
  evidenceLabel?: string;
}

/**
 * The three-panel decision workspace.
 *
 * <768px: the panels stack. 1024px: list plus detail. ≥1440px: all three,
 * because that is the width at which evidence stops being a detour and becomes
 * something you read next to the decision.
 *
 * States: stacked · two-panel · three-panel · evidence-collapsed.
 */
export function WorkspaceShell({
  listPanel,
  detailPanel,
  evidencePanel,
  listLabel = "Liste",
  detailLabel = "Ayrıntı",
  evidenceLabel = "Kanıt",
}: WorkspaceShellProps) {
  const evidenceOpen = useUiStore((state) => state.evidencePanelOpen);
  const toggleEvidence = useUiStore((state) => state.toggleEvidencePanel);

  return (
    <div
      className={cn(
        "dt-workspace",
        evidenceOpen && evidencePanel != null && "dt-workspace--three",
      )}
    >
      <section className="dt-workspace__list" aria-label={listLabel}>
        {listPanel}
      </section>
      <section className="dt-workspace__detail" aria-label={detailLabel}>
        {detailPanel}
      </section>
      {evidencePanel ? (
        <section
          className={cn("dt-workspace__evidence", !evidenceOpen && "is-collapsed")}
          aria-label={evidenceLabel}
        >
          <div className="dt-workspace__evidence-head">
            <h2 className="dt-workspace__evidence-title">{evidenceLabel}</h2>
            <IconButton
              label={evidenceOpen ? "Kanıt panelini kapat" : "Kanıt panelini aç"}
              icon={evidenceOpen ? "⟩" : "⟨"}
              size="sm"
              onClick={() => toggleEvidence()}
              aria-expanded={evidenceOpen}
            />
          </div>
          {evidenceOpen ? evidencePanel : null}
        </section>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------- PublicShell */

export interface PublicShellProps {
  children: ReactNode;
  navItems?: readonly NavItem[];
}

/** The anonymous frame. States: default · offline. */
export function PublicShell({ children, navItems = [] }: PublicShellProps) {
  useAppearance();
  return (
    <div className="dt-public">
      <SkipLink />
      <header className="dt-public__header">
        <NavLink to="/" className="dt-app__brand">
          DestekTeşvik
        </NavLink>
        <nav aria-label="Site gezinme">
          <ul className="dt-public__nav">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) => cn("dt-public__nav-link", isActive && "is-active")}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <OfflineBanner />
      <main id="ana-icerik" className="dt-public__main" tabIndex={-1}>
        {children}
      </main>
      <footer className="dt-public__footer">
        <p className="dt-muted">
          Bu uygulama hukuki veya mali danışmanlık hizmeti vermez. Ürettiği sonuçlar bağlayıcı
          değildir ve resmî kurum kararı yerine geçmez.
        </p>
      </footer>
    </div>
  );
}

/* -------------------------------------------------------------- PrintShell */

export interface PrintShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

/**
 * Print layout for a decision. Navigation and controls are dropped; the
 * disclaimer and the hash pair are not.
 *
 * States: screen (plain) · print (via @media print).
 */
export function PrintShell({ title, subtitle, children }: PrintShellProps) {
  return (
    <div className="dt-print">
      <header className="dt-print__head">
        <h1>{title}</h1>
        {subtitle ? <p className="dt-muted">{subtitle}</p> : null}
      </header>
      <main id="ana-icerik" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
