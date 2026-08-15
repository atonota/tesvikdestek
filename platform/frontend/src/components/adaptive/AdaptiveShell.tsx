/**
 * The adaptive enterprise frame.
 *
 * One layout that is honest at 320px and dense at 1440px, rather than a
 * desktop layout with things hidden on a phone.
 *
 *   320px   one column. Navigation and the assistant are **sheets**: modal
 *           dialogs with a backdrop, opened from header controls, closed by
 *           Escape, focus-trapped while open and focus-restoring on close. A
 *           thumb-reachable bottom bar carries the top destinations, and the
 *           conversion action is pinned above it, because the whole point of a
 *           conversion action is that it is reachable without scrolling back.
 *   ≥64rem  three columns: persistent rail, content, context/assistant aside.
 *           No sheets, no drawer toggle, no thumb bar.
 *
 * **Exactly one of the two states is rendered.** The shell asks
 * `useMediaQuery(DESKTOP_QUERY)` and branches, rather than rendering both and
 * hiding one with CSS. The difference is not cosmetic: two copies means the
 * assistant's content exists twice in the document, a screen reader has two
 * identically named panels to walk, and a focus trap can capture the copy
 * nobody can see. What was actually on screen at 320px before this - the rail
 * as an inline accordion that pushed the page down, and the assistant as an
 * ~810px appendix glued to the bottom of the document - is what that costs.
 *
 * The sheets are `@radix-ui/react-dialog`, already a dependency and already the
 * vendor behind `composites.tsx`'s `Dialog`. Modality, the backdrop, Escape,
 * the focus trap and focus restoration all come from it; hand-rolling any one
 * of those is how a panel becomes a trap.
 *
 * The header is genuinely layered rather than one tall row: an identity layer
 * (brand, sheet controls, utilities) and a context layer (breadcrumbs, page
 * title). Each carries `data-header-layer`, which is what the layout test
 * counts - a visual "layer" made of margins is not a layer any assistive
 * technology can see.
 *
 * Layout only. This shell never fetches and never decides; it owns landmarks
 * and where things sit, exactly like the shells it sits beside.
 */

import * as RadixDialog from "@radix-ui/react-dialog";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { NavLink, Link as RouterLink } from "react-router";

import { cn } from "@/lib/cn";
import { DESKTOP_QUERY, useMediaQuery } from "@/lib/use-media-query";
import { applyAppearance, useUiStore } from "@/store/ui";
import { OfflineBanner } from "../patterns";
import { Button, IconButton } from "../primitives";
import type { NavItem } from "../shells";

export interface ConversionAction {
  readonly label: string;
  readonly to?: string;
  readonly onRun?: () => void;
  /** Shown under the action. One line, factual, never a promise. */
  readonly hint?: string;
}

/**
 * Every optional slot accepts an explicit `undefined`.
 *
 * Under `exactOptionalPropertyTypes` an omitted prop and a prop set to
 * `undefined` are different types, and a caller deciding at runtime that a
 * route has no context rail should be able to say so directly rather than
 * building two different JSX trees.
 */
export interface AdaptiveShellProps {
  readonly navItems: readonly NavItem[];
  readonly children: ReactNode;
  /** The right-hand context / assistant column. Omitted, the rail disappears. */
  readonly contextRail?: ReactNode | undefined;
  readonly headerUtilities?: ReactNode | undefined;
  readonly breadcrumbs?: ReactNode | undefined;
  readonly conversionAction?: ConversionAction | undefined;
  readonly title?: string | undefined;
  readonly className?: string | undefined;
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

/** The navigation list, identical in the rail and in the sheet. */
function NavList({
  navItems,
  onNavigate,
}: {
  readonly navItems: readonly NavItem[];
  readonly onNavigate?: () => void;
}) {
  return (
    <ul>
      {navItems.map((item) => (
        <li key={item.to}>
          <NavLink
            to={item.to}
            className={({ isActive }) => cn("dt-shell__nav-link", isActive && "is-active")}
            onClick={onNavigate}
          >
            {item.icon ? (
              <span aria-hidden="true" className="dt-shell__nav-icon">
                {item.icon}
              </span>
            ) : null}
            <span>{item.label}</span>
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

/**
 * A modal side sheet, with the control that opens it.
 *
 * **The control must be the dialog's own `Trigger`.** Radix's modal content
 * cancels the browser's focus restoration and returns focus to
 * `triggerRef.current` instead. A hand-wired button with an `onClick` leaves
 * that ref null, so closing the sheet drops focus onto `<body>` - the keyboard
 * user is silently returned to the top of the document, which is the failure a
 * focus trap exists to prevent. The trigger owns the open/close toggle for the
 * same reason: composing a second `onClick` onto it would toggle twice and the
 * sheet would never open.
 *
 * `aria-describedby={undefined}` is deliberate: Radix warns when a dialog has
 * no description, and a sheet whose entire content is a navigation list has
 * nothing to describe that its title does not already say. Inventing a
 * paragraph to silence a warning would put text on screen for the tool's
 * benefit rather than the reader's.
 *
 * `contentId` lands on the `Content` element itself, and the trigger points
 * `aria-controls` at it only while the sheet is open. The id used to sit on the
 * `<nav>` landmark *containing* the trigger - an element that conveniently
 * always exists, and that the trigger does not control. "The thing this button
 * opens is the box you are already standing in" is worse guidance than none,
 * and the dialog is portalled somewhere else entirely.
 */
function Sheet({
  open,
  onOpenChange,
  title,
  side,
  trigger,
  contentId,
  children,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly side: "start" | "end";
  readonly trigger: ReactNode;
  readonly contentId: string;
  readonly children: ReactNode;
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="dt-sheet__overlay" />
        <RadixDialog.Content
          id={contentId}
          className={cn("dt-sheet", `dt-sheet--${side}`)}
          aria-describedby={undefined}
        >
          <div className="dt-sheet__head">
            <RadixDialog.Title className="dt-sheet__title">{title}</RadixDialog.Title>
            <RadixDialog.Close asChild>
              <IconButton label={`${title} panelini kapat`} icon="✕" size="sm" />
            </RadixDialog.Close>
          </div>
          <div className="dt-sheet__body">{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

/**
 * The 320px assistant, and the control that opens it.
 *
 * Its own component for one reason: the open flag lives here, so the flag dies
 * with the layout that owns it. When the window widens past the breakpoint this
 * whole subtree unmounts, and a sheet that was open on the phone cannot
 * reappear on the way back - which is exactly what the drawer, whose flag lives
 * in the global store, used to do.
 */
function AssistantSheet({ children }: { readonly children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const contentId = useId();

  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      title="Bağlam ve yardımcı"
      side="end"
      contentId={contentId}
      trigger={
        <Button
          size="sm"
          variant="secondary"
          aria-expanded={open}
          {...(open ? { "aria-controls": contentId } : {})}
        >
          Yardımcı
        </Button>
      }
    >
      {children}
    </Sheet>
  );
}

/**
 * States: mobile (nav sheet · assistant sheet · both closed) ·
 * desktop (persistent rail · persistent aside) · with-conversion · offline.
 */
export function AdaptiveShell({
  navItems,
  children,
  contextRail,
  headerUtilities,
  breadcrumbs,
  conversionAction,
  title,
  className,
}: AdaptiveShellProps) {
  useAppearance();
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const drawerOpen = useUiStore((state) => state.navDrawerOpen);
  const toggleDrawer = useUiStore((state) => state.toggleNavDrawer);
  const navId = useId();
  const asideId = useId();
  const navSheetId = useId();

  const hasRail = contextRail !== undefined && contextRail !== null;
  const hasConversion = conversionAction !== undefined && conversionAction !== null;
  const hasContextLayer = Boolean(breadcrumbs) || Boolean(title);

  const shellRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const conversionRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLElement>(null);

  /**
   * The drawer belongs to the layout that has one.
   *
   * `navDrawerOpen` is global store state and only the 320px branch renders a
   * control for it, so widening the window left it stuck at `true` with nothing
   * on screen to change it - and narrowing again reopened a modal, focus
   * trapping sheet that nobody asked for. Closing it here, on the crossing, is
   * the whole fix.
   *
   * Guarded on the current value rather than written unconditionally: a store
   * write always notifies, so an unguarded `toggleDrawer(false)` on every
   * desktop render would be a change event per render. Read through
   * `getState()` so `drawerOpen` does not have to be a dependency of an effect
   * whose job is to change it.
   */
  useEffect(() => {
    if (!isDesktop) return;
    if (useUiStore.getState().navDrawerOpen) toggleDrawer(false);
  }, [isDesktop, toggleDrawer]);

  /**
   * Three heights the stylesheet cannot know and must not guess.
   *
   * The header is two layers, wraps at 320px and grows with the font-scale
   * setting; the thumb bar and the pinned action grow with their own content.
   * Anything sticky below the header has to start where the header ends, and
   * the content has to end where the pinned action begins - so the numbers are
   * measured and published as custom properties.
   *
   * Written straight to the element's style rather than into React state: this
   * runs after every layout change, and a state update here would be a render
   * loop with a resize observer driving it.
   */
  useEffect(() => {
    const root = shellRef.current;
    if (root === null) return undefined;

    const measure = () => {
      const publish = (name: string, node: HTMLElement | null) => {
        // Rounded *up*, always. These heights are used to clear other elements,
        // and a header measured at 95.19 that publishes 95 leaves the first
        // sticky row a fifth of a pixel underneath it - which a hit test sees
        // even though nobody can.
        const height = node === null ? 0 : Math.ceil(node.getBoundingClientRect().height);
        root.style.setProperty(name, `${height}px`);
      };
      publish("--dt-shell-header-h", headerRef.current);
      publish("--dt-shell-conversion-h", conversionRef.current);
      publish("--dt-shell-bottom-h", bottomRef.current);
    };

    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measure);
    for (const node of [headerRef.current, conversionRef.current, bottomRef.current]) {
      if (node !== null) observer.observe(node);
    }
    return () => observer.disconnect();
    // Primitives only: the slots are React nodes whose identity changes on
    // every parent render, and depending on them would rebuild the observer
    // each time for no gain. What actually changes the measured boxes is
    // whether a region is rendered at all, and the layout it is rendered in.
  }, [isDesktop, hasRail, hasConversion, hasContextLayer]);

  return (
    <div
      ref={shellRef}
      className={cn("dt-shell", hasRail && "dt-shell--with-rail", className)}
      data-drawer={drawerOpen ? "open" : "closed"}
      data-layout={isDesktop ? "desktop" : "mobile"}
    >
      <a className="dt-skip-link" href="#ana-icerik">
        İçeriğe geç
      </a>

      <header ref={headerRef} className="dt-shell__header">
        <div className="dt-shell__header-layer" data-header-layer="identity">
          {/*
           * On a phone the navigation landmark *is* the disclosure control plus
           * the sheet it opens. Keeping the landmark and its id in the document
           * in both states is what lets `aria-controls` point at something real
           * while the sheet is closed - an `aria-controls` aimed at an element
           * that only exists when open is a dangling reference for exactly the
           * moment a screen reader needs it.
           */}
          {isDesktop ? null : (
            <nav id={navId} className="dt-shell__nav-trigger" aria-label="Ana gezinme">
              <Sheet
                open={drawerOpen}
                onOpenChange={(open) => toggleDrawer(open)}
                title="Ana gezinme"
                side="start"
                contentId={navSheetId}
                trigger={
                  <IconButton
                    label={drawerOpen ? "Menüyü kapat" : "Menüyü aç"}
                    icon={drawerOpen ? "✕" : "☰"}
                    className="dt-shell__menu-toggle"
                    aria-expanded={drawerOpen}
                    {...(drawerOpen ? { "aria-controls": navSheetId } : {})}
                  />
                }
              >
                <NavList navItems={navItems} onNavigate={() => toggleDrawer(false)} />
              </Sheet>
            </nav>
          )}

          <RouterLink to="/panel" className="dt-shell__brand">
            DestekTeşvik
          </RouterLink>

          <div className="dt-shell__utilities">
            {headerUtilities}
            {hasRail && !isDesktop ? (
              <aside
                id={asideId}
                className="dt-shell__aside-trigger"
                aria-label="Bağlam ve yardımcı"
              >
                <AssistantSheet>{contextRail}</AssistantSheet>
              </aside>
            ) : null}
          </div>
        </div>

        <div className="dt-shell__header-layer" data-header-layer="context">
          {breadcrumbs ? (
            <nav className="dt-shell__crumbs" aria-label="Konum">
              {breadcrumbs}
            </nav>
          ) : null}
          {title ? <p className="dt-shell__title">{title}</p> : null}
        </div>
      </header>

      {isDesktop ? (
        <nav id={navId} className="dt-shell__rail" aria-label="Ana gezinme">
          <NavList navItems={navItems} />
        </nav>
      ) : null}

      {conversionAction ? (
        <div ref={conversionRef} className="dt-shell__conversion">
          {conversionAction.onRun ? (
            <Button fullWidth onClick={conversionAction.onRun}>
              {conversionAction.label}
            </Button>
          ) : (
            <RouterLink
              to={conversionAction.to ?? "#"}
              className="dt-btn dt-btn--primary dt-btn--md dt-btn--block"
            >
              {conversionAction.label}
            </RouterLink>
          )}
          {conversionAction.hint ? (
            <p className="dt-shell__conversion-hint">{conversionAction.hint}</p>
          ) : null}
        </div>
      ) : null}

      {/*
       * On a phone this box is the page's scrollport, so it has to be reachable
       * from a keyboard.
       *
       * The frame is bounded to the window and this is the only part that
       * scrolls, which is what stops the thumb bar from covering the content.
       * A scrolling region with no focusable child cannot be scrolled without a
       * pointer, and axe reports exactly that as `scrollable-region-focusable`
       * (serious) - it fired on `/olgunluk`, `/operasyon/saglik` and
       * `/yetenekler`, the three routes whose main content is entirely text.
       * Routes that happen to contain a link were silent about the same defect,
       * which is why this is answered on the region rather than per route.
       *
       * Only on a phone: the desktop content is `overflow: visible` and the
       * document scrolls, so a tab stop here would be a focus stop that does
       * nothing.
       *
       * The `tabIndex` is written out rather than hidden inside a conditional
       * spread, so that what this element is - a focusable scroll container on
       * one layout and an ordinary box on the other - is readable here instead
       * of being assembled out of view. `Stepper` needs an explicit suppression
       * for the same decision; this expression form does not, and an unused
       * disable directive is its own kind of noise.
       */}
      <div
        className="dt-shell__content"
        tabIndex={isDesktop ? undefined : 0}
        {...(isDesktop ? {} : { "aria-label": "Sayfa içeriği, kaydırılabilir" })}
      >
        <OfflineBanner />
        <main id="ana-icerik" className="dt-shell__main" tabIndex={-1}>
          {children}
        </main>
      </div>

      {hasRail && isDesktop ? (
        <aside className="dt-shell__aside" aria-label="Bağlam ve yardımcı">
          {/*
           * The sticky part is the inner block, not the column.
           *
           * The column is stretched across both content rows, so pinning it
           * would give it nowhere to travel; the block inside it travels, and
           * scrolls on its own when the assistant is taller than the window.
           * `position: static` is what made the whole assistant leave the
           * screen at 1440x400.
           */}
          <div className="dt-shell__aside-inner">{contextRail}</div>
        </aside>
      ) : null}

      {isDesktop ? null : (
        <nav ref={bottomRef} className="dt-shell__bottom" aria-label="Hızlı gezinme">
          <ul>
            {navItems.slice(0, 5).map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) => cn("dt-shell__bottom-link", isActive && "is-active")}
                >
                  <span aria-hidden="true">{item.icon ?? "•"}</span>
                  <span className="dt-shell__bottom-label">{item.shortLabel ?? item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
