/**
 * The cockpit's one navigation surface — a Radix dialog with no overlay of
 * its own.
 *
 * `CognitiveAppShell` mounts one `Sheet` root and this content inside it -
 * the cockpit's one navigation surface, with no earlier or parallel drawer
 * implementation left to carry a second overlay. This component renders
 * `SheetPrimitive.Content` directly, never `SheetContent` (which bundles a
 * `SheetPrimitive.Overlay`), because `ModalLayerHost` is the cockpit's one
 * owner of blur and scrim. Radix's dialog behaviour — focus trap, Escape to
 * close, focus returned to the trigger — comes from `Content` alone;
 * `Overlay` is purely the paint this component leaves to its sibling.
 */

import * as SheetPrimitive from "@radix-ui/react-dialog";
import { NavLink } from "react-router";

import { FoundationIcon, SheetBody, SheetClose, SheetHeader, SheetTitle } from "@/foundation";
import { resolveContent, useContent } from "@/content";

interface NavigationDestination {
  readonly to: string;
  readonly contentId: string;
}

const DESTINATIONS: readonly NavigationDestination[] = [
  { to: "/panel", contentId: "cockpit.drawer.nav.dashboard" },
  { to: "/degerlendirmeler", contentId: "cockpit.drawer.nav.decisions" },
  { to: "/firsatlar", contentId: "cockpit.drawer.nav.opportunities" },
  { to: "/kaynaklar", contentId: "cockpit.drawer.nav.sources" },
  { to: "/organizasyon/hazirlik", contentId: "cockpit.drawer.nav.readiness" },
  { to: "/olgunluk", contentId: "cockpit.drawer.nav.maturity" },
  { to: "/operasyon/saglik", contentId: "cockpit.drawer.nav.health" },
  { to: "/dosyalar", contentId: "cockpit.drawer.nav.files" },
  { to: "/yetenekler", contentId: "cockpit.drawer.nav.capabilities" },
  { to: "/ayarlar/gorunum", contentId: "cockpit.drawer.nav.settings" },
];

export interface NavigationSheetProps {
  readonly organisationLabel: string;
  readonly roleLabel: string;
  readonly onNavigate?: () => void;
}

export function NavigationSheet({ organisationLabel, roleLabel, onNavigate }: NavigationSheetProps) {
  const ariaLabel = useContent("cockpit.drawer.aria_label");
  const brand = useContent("cockpit.drawer.brand");
  const closeLabel = useContent("cockpit.drawer.close");
  const identity = useContent("cockpit.drawer.identity", {
    values: { org: organisationLabel, role: roleLabel },
  });
  const navAriaLabel = useContent("cockpit.drawer.nav.aria_label");

  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Content
        data-slot="navigation-sheet"
        data-side="start"
        aria-label={ariaLabel}
        className="fd-sheet cognitive-command-drawer fixed inset-y-0 start-0 z-50 flex h-full flex-col gap-4 overflow-y-auto border-e p-4"
      >
        <SheetHeader>
          <SheetTitle>{brand}</SheetTitle>
          <SheetClose asChild>
            <button type="button" className="cognitive-command-drawer__close" aria-label={closeLabel}>
              <FoundationIcon name="close" />
            </button>
          </SheetClose>
        </SheetHeader>
        <p className="cognitive-command-drawer__identity">{identity}</p>
        <SheetBody>
          <nav className="cognitive-command-drawer__nav" aria-label={navAriaLabel}>
            {DESTINATIONS.map((destination) => (
              <NavLink
                key={destination.to}
                to={destination.to}
                onClick={onNavigate}
                className={({ isActive }) =>
                  ["cognitive-command-drawer__link", isActive ? "is-active" : null]
                    .filter(Boolean)
                    .join(" ")
                }
              >
                <span>{resolveContent(destination.contentId)}</span>
              </NavLink>
            ))}
          </nav>
        </SheetBody>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}
