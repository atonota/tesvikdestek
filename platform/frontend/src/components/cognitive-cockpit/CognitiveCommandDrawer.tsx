/**
 * The adaptive, full-width mobile command drawer.
 *
 * Rendered inside the same `Sheet` root as the hamburger trigger in
 * `CognitiveSpotlightHeader` — Radix's dialog primitives talk through context,
 * not DOM adjacency, so trigger and content can live in sibling components and
 * still share one open state, one focus trap and one return-focus target.
 *
 * There is no persistent sidebar in this cockpit. On a phone this drawer is
 * the whole navigation surface; on a wide screen it is still how navigation is
 * reached, because a cockpit that is "data-dense but readable" has no room to
 * spend on a rail of links beside every card.
 */

import { FoundationIcon, SheetBody, SheetClose, SheetContent, SheetHeader, SheetTitle } from "@/foundation";
import { NavLink } from "react-router";

import { resolveContent, useContent } from "@/content";

interface CommandDestination {
  readonly to: string;
  readonly contentId: string;
}

const DESTINATIONS: readonly CommandDestination[] = [
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

export interface CognitiveCommandDrawerProps {
  readonly organisationLabel: string;
  readonly roleLabel: string;
  readonly onNavigate?: () => void;
}

export function CognitiveCommandDrawer({
  organisationLabel,
  roleLabel,
  onNavigate,
}: CognitiveCommandDrawerProps) {
  const drawerAriaLabel = useContent("cockpit.drawer.aria_label");
  const brand = useContent("cockpit.drawer.brand");
  const closeLabel = useContent("cockpit.drawer.close");
  const identity = useContent("cockpit.drawer.identity", {
    values: { org: organisationLabel, role: roleLabel },
  });
  const navAriaLabel = useContent("cockpit.drawer.nav.aria_label");

  return (
    <SheetContent side="start" className="cognitive-command-drawer" aria-label={drawerAriaLabel}>
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
    </SheetContent>
  );
}
