/**
 * The adaptive enterprise frame — Cognitive Shell V2.
 *
 * One layout that is honest at 320px and dense at 1440px, rather than a
 * desktop layout with things hidden on a phone.
 *
 *   Every width  navigation lives behind **one modal drawer**, opened either
 *                by the header's hamburger or by the header's account
 *                avatar. There is no persistent rail at 1024/1440 and no
 *                separate mobile nav sheet at 320/390 - the split this shell
 *                shipped before V2 is gone, in both directions, at once.
 *   ≥64rem       the assistant keeps its own persistent aside column; below
 *                that it stays a separate sheet, exactly as before V2. V2's
 *                scope is navigation and account, not the assistant.
 *
 * **Two triggers, one dialog.** The hamburger and the avatar are visually and
 * semantically distinct controls - different accessible names, different
 * intents - but they open the *same* `Dialog.Root`, tracked as one flag in
 * `useUiStore().navDrawerOpen`. What differs between them is only which part
 * of the drawer receives focus once it opens: the hamburger focuses the
 * command input, the avatar focuses the drawer's footer account trigger. That
 * is `drawerIntent` below, and it is read once, in the effect that runs after
 * the drawer's content has mounted.
 *
 * **Manual trigger + manual focus restoration**, not `Dialog.Trigger`. Radix's
 * own trigger only remembers a single opener; two real openers means the
 * shell has to track "which button was pressed" itself, in `drawerTriggerRef`,
 * and hand it back in `onCloseAutoFocus` - the same guarantee `Sheet` gets for
 * free from a single `SheetTrigger`, reproduced by hand because this drawer
 * genuinely has two doors.
 *
 * The header is genuinely layered rather than one tall row: an identity layer
 * (brand, drawer controls, utilities) and a context layer (breadcrumbs, page
 * title). Each carries `data-header-layer`, which is what the layout test
 * counts - a visual "layer" made of margins is not a layer any assistive
 * technology can see.
 *
 * Layout only. This shell never fetches and never decides; it owns landmarks
 * and where things sit, exactly like the shells it sits beside.
 */

import * as DrawerPrimitive from "@radix-ui/react-dialog";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { NavLink, Link as RouterLink } from "react-router";

import { AppIcon } from "@/components/icons";
import {
  Sheet as MasterSheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/cn";
import { DESKTOP_QUERY, useMediaQuery } from "@/lib/use-media-query";
import { applyAppearance, useUiStore } from "@/store/ui";
import { useDemoSession } from "@/demo";
import { requireCapabilityReason } from "@/domain/capabilities";
import { OfflineBanner } from "../patterns";
import { Button, IconButton } from "../primitives";
import type { NavItem } from "../shells";
import { ShellAccountMenu } from "./ShellAccountMenu";
import { ShellHeaderSpotlight } from "./ShellHeaderSpotlight";
import { ShellIdentityStrip, type ShellIdentityCell } from "./ShellIdentityStrip";
import { ShellSidebarCommand } from "./ShellSidebarCommand";
import { ShellSidebarNav, type ShellNavItemMeta } from "./ShellSidebarNav";

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
  /**
   * Route-level source/evidence freshness, for the top identity strip's
   * third cell. No route wires this yet - see `ShellIdentityStrip`'s own
   * file header - so every current caller leaves it `undefined` and gets the
   * strip's honest "not measured here" cell instead of a fabricated one.
   */
  readonly sourceHealth?: ShellIdentityCell | undefined;
  /** A real unread count. Omitted → the notification trigger stays honestly disabled. */
  readonly notificationsCount?: number | undefined;
  /** Per-route count/status/quick-actions for the drawer's accordion. See `ShellSidebarNav`. */
  readonly navMeta?: Readonly<Record<string, ShellNavItemMeta>> | undefined;
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

/** Which part of the shared drawer a trigger asks to receive focus. */
type DrawerIntent = "command" | "account";

/**
 * The one adaptive navigation drawer, and the two controls that open it.
 *
 * Its own component for the same reason `AssistantSheet` was: the intent and
 * trigger-ref state live and die with this subtree, so they cannot leak
 * across a route change or a layout crossing.
 */
function ShellDrawer({
  navItems,
  navMeta,
}: {
  readonly navItems: readonly NavItem[];
  readonly navMeta?: Readonly<Record<string, ShellNavItemMeta>> | undefined;
}) {
  const drawerOpen = useUiStore((state) => state.navDrawerOpen);
  const toggleDrawer = useUiStore((state) => state.toggleNavDrawer);
  const [intent, setIntent] = useState<DrawerIntent>("command");
  /**
   * The one query the reference sidebar's search field and its accordion
   * share (`DestekTesvik Sidebar 3a (standalone).html`) - lifted here rather
   * than owned separately by `ShellSidebarCommand` and `ShellSidebarNav`, so
   * a query filters and auto-expands the accordion itself instead of
   * producing a second, disconnected results list beside it.
   */
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const drawerId = useId();
  const titleId = useId();

  function open(nextIntent: DrawerIntent, trigger: HTMLButtonElement) {
    triggerRef.current = trigger;
    setIntent(nextIntent);
    toggleDrawer(true);
  }

  /**
   * Which part of *this* open gets focus, decided here rather than left to
   * Radix's own default.
   *
   * Radix's `FocusScope` normally focuses the first focusable descendant on
   * open - here that would always be the close button in `.dt-drawer__head`,
   * regardless of which trigger was pressed. `onOpenAutoFocus` replaces that
   * default entirely: `preventDefault()` cancels it, and the query below
   * lands focus on the one element `intent` actually asked for.
   */
  function focusIntentTarget(event: Event) {
    event.preventDefault();
    const root = contentRef.current;
    if (root === null) return;
    const target =
      intent === "command"
        ? root.querySelector<HTMLElement>('input[type="search"]')
        : root.querySelector<HTMLElement>("[data-shell-account-trigger]");
    target?.focus();
  }

  /**
   * The first layer of Escape: clear the shared query, keep the drawer open.
   *
   * `Dialog.Content`'s `onEscapeKeyDown` is Radix's own hook for exactly
   * this - it runs *before* Radix decides whether to close, which
   * `ShellSidebarCommand`'s own `onKeyDown` cannot: `DismissableLayer`
   * listens for Escape on `document` in the capture phase, ahead of any
   * bubbling handler a nested input could attach, so a `preventDefault()`
   * down there always loses the race. `query` living here rather than inside
   * `ShellSidebarCommand` means clearing it is a plain state update - no
   * reaching into another component's input through the DOM.
   */
  function unwindEscape(event: KeyboardEvent) {
    if (query === "") return;
    event.preventDefault();
    setQuery("");
  }

  const close = () => {
    toggleDrawer(false);
    setQuery("");
  };

  const menuOpen = drawerOpen && intent === "command";

  return (
    <>
      {/*
       * The three-bar hamburger, morphing to an X — built from three literal
       * bars rather than swapped icons, so the morph is a transform on the
       * same three elements rather than one glyph replacing another.
       */}
      <button
        type="button"
        aria-label={menuOpen ? "Menüyü kapat" : "Menü"}
        className="dt-shell__menu-toggle"
        aria-expanded={drawerOpen}
        data-open={menuOpen}
        {...(drawerOpen ? { "aria-controls": drawerId } : {})}
        onClick={(event) => open("command", event.currentTarget)}
      >
        <span className="dt-shell__menu-bars" aria-hidden="true">
          <span className="dt-shell__menu-bar dt-shell__menu-bar--top" />
          <span className="dt-shell__menu-bar dt-shell__menu-bar--mid" />
          <span className="dt-shell__menu-bar dt-shell__menu-bar--bot" />
        </span>
      </button>

      <button
        type="button"
        className="dt-shell__avatar-toggle"
        aria-label="Hesap"
        title="Hesap"
        aria-expanded={drawerOpen}
        {...(drawerOpen ? { "aria-controls": drawerId } : {})}
        onClick={(event) => open("account", event.currentTarget)}
      >
        <AppIcon name="people" />
      </button>

      <DrawerPrimitive.Root open={drawerOpen} onOpenChange={(next) => toggleDrawer(next)}>
        <DrawerPrimitive.Portal>
          <DrawerPrimitive.Overlay className="dt-drawer__overlay" />
          <DrawerPrimitive.Content
            id={drawerId}
            ref={contentRef}
            className="dt-drawer__content"
            aria-describedby={undefined}
            aria-labelledby={titleId}
            onOpenAutoFocus={focusIntentTarget}
            onEscapeKeyDown={unwindEscape}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              triggerRef.current?.focus();
            }}
          >
            <DrawerPrimitive.Title id={titleId} className="sr-only">
              Gezinme ve hesap
            </DrawerPrimitive.Title>
            <DrawerPrimitive.Close asChild>
              <button type="button" className="sr-only">
                Menüyü kapat
              </button>
            </DrawerPrimitive.Close>
            <ShellSidebarCommand
              navItems={navItems}
              query={query}
              onQueryChange={setQuery}
              onNavigate={close}
            />
            <ShellSidebarNav
              navItems={navItems}
              onNavigate={close}
              metaByRoute={navMeta}
              query={query}
            />
            <div className="dt-drawer__footer">
              <ShellAccountMenu onNavigate={close} />
            </div>
          </DrawerPrimitive.Content>
        </DrawerPrimitive.Portal>
      </DrawerPrimitive.Root>
    </>
  );
}

/**
 * The header's notification trigger.
 *
 * `count` is the whole contract: given a real unread number (even zero - a
 * checked, empty inbox is still a fact), the trigger is enabled and shows it.
 * Given nothing, it stays disabled with a stated reason instead of showing a
 * fabricated badge, which is the failure this codebase's own
 * `truth-guard.test.ts` exists to catch and the same pattern
 * `ShellAccountMenu` already uses for "Dil ve bölge", "Çalışma alanlarım" and
 * "Rol ve izinler". No route in this application feeds a real count today -
 * there is no notification backend - so every real caller passes nothing and
 * gets the honest disabled state; `cognitive-shell.stories.tsx` demonstrates
 * the enabled, counted state with a fixture value.
 */
const NOTIFICATIONS_REASON_ID = "dt-shell-notifications-reason";

export interface ShellNotificationsTriggerProps {
  readonly count?: number | undefined;
}

export function ShellNotificationsTrigger({ count }: ShellNotificationsTriggerProps) {
  if (count === undefined) {
    return (
      <span className="dt-shell__notifications">
        <button
          type="button"
          disabled
          aria-label="Bildirimler"
          aria-describedby={NOTIFICATIONS_REASON_ID}
          className="dt-shell__notifications-trigger"
        >
          <AppIcon name="notifications" />
        </button>
        <span id={NOTIFICATIONS_REASON_ID} className="sr-only">
          Bildirim sistemi bu sürümde yok.
        </span>
      </span>
    );
  }
  return (
    <span className="dt-shell__notifications">
      <button
        type="button"
        aria-label={`Bildirimler · ${count} okunmamış`}
        className="dt-shell__notifications-trigger"
        data-state="enabled"
      >
        <AppIcon name="notifications" />
        {count > 0 ? <span className="dt-shell__notifications-badge">{count}</span> : null}
      </button>
    </span>
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
    <MasterSheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          size="sm"
          variant="secondary"
          aria-expanded={open}
          {...(open ? { "aria-controls": contentId } : {})}
        >
          <AppIcon name="assistant" />
          Yardımcı
        </Button>
      </SheetTrigger>
      <SheetContent
        id={contentId}
        side="end"
        className={cn("dt-sheet", "dt-sheet--end")}
        overlayClassName="dt-sheet__overlay"
        aria-describedby={undefined}
      >
        <SheetHeader className="dt-sheet__head">
          <SheetTitle className="dt-sheet__title">Bağlam ve yardımcı</SheetTitle>
          <SheetClose asChild>
            <IconButton
              label="Bağlam ve yardımcı panelini kapat"
              icon={<AppIcon name="close" />}
              size="sm"
            />
          </SheetClose>
        </SheetHeader>
        <SheetBody className="dt-sheet__body">{children}</SheetBody>
      </SheetContent>
    </MasterSheet>
  );
}

/**
 * States: drawer (closed · open via hamburger · open via avatar) ·
 * with-conversion · offline.
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
  sourceHealth,
  notificationsCount,
  navMeta,
}: AdaptiveShellProps) {
  useAppearance();
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const drawerOpen = useUiStore((state) => state.navDrawerOpen);
  const demo = useDemoSession();
  const asideId = useId();

  const hasRail = contextRail !== undefined && contextRail !== null;
  const hasConversion = conversionAction !== undefined && conversionAction !== null;
  const hasContextLayer = Boolean(breadcrumbs) || Boolean(title);

  /**
   * The top strip's three cells, resolved here rather than inside
   * `ShellIdentityStrip` itself - see that component's own file header for
   * why the strip stays a dumb renderer and this shell owns the honesty
   * decision for each cell.
   */
  const organisationCell: ShellIdentityCell = {
    label: "Çalışma alanı yok",
    tone: "neutral",
    description: requireCapabilityReason("team"),
  };
  const roleCell: ShellIdentityCell = demo
    ? { label: demo.profile.roleLabel, tone: "ok" }
    : { label: "Rol tanımsız", tone: "neutral", description: requireCapabilityReason("roles") };
  const sourceHealthCell: ShellIdentityCell = sourceHealth ?? {
    label: "Kaynak durumu bilinmiyor",
    tone: "neutral",
    description: "Kaynak tazeliği bu ekranda izlenmiyor.",
  };

  const shellRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const conversionRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLElement>(null);

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
        // The shared drawer is a Radix `Portal`, appended under `document.body`
        // rather than under this element - a custom property set only here
        // never reaches it, and the sheet falls back to the CSS `0px` default,
        // starting at the very top of the viewport and painting over the
        // header it is supposed to sit beneath. Publishing the same value on
        // the document root as well gives that portalled subtree something to
        // inherit.
        document.documentElement.style.setProperty(name, `${height}px`);
      };
      publish("--dt-shell-header-h", headerRef.current);
      publish("--dt-shell-conversion-h", conversionRef.current);
      publish("--dt-shell-bottom-h", bottomRef.current);
    };

    measure();

    const restoreDocumentProperties = () => {
      for (const name of ["--dt-shell-header-h", "--dt-shell-conversion-h", "--dt-shell-bottom-h"]) {
        document.documentElement.style.removeProperty(name);
      }
    };

    if (typeof ResizeObserver === "undefined") return restoreDocumentProperties;
    const observer = new ResizeObserver(measure);
    for (const node of [headerRef.current, conversionRef.current, bottomRef.current]) {
      if (node !== null) observer.observe(node);
    }
    return () => {
      observer.disconnect();
      restoreDocumentProperties();
    };
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
        <ShellIdentityStrip
          organisation={organisationCell}
          role={roleCell}
          sourceHealth={sourceHealthCell}
        />

        <div className="dt-shell__header-layer" data-header-layer="identity">
          <ShellDrawer navItems={navItems} navMeta={navMeta} />

          <RouterLink to="/panel" className="dt-shell__brand">
            DestekTeşvik
          </RouterLink>

          <ShellHeaderSpotlight navItems={navItems} />

          <div className="dt-shell__utilities">
            <ShellNotificationsTrigger count={notificationsCount} />
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
                  <span aria-hidden="true" className="dt-shell__bottom-icon">
                    {item.icon ?? <AppIcon name="next" />}
                  </span>
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
