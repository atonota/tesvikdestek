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

import type { IconName } from "@/components/icons";
import { AppIcon } from "@/components/icons";
import { SheetBody, SheetClose, SheetContent, SheetHeader, SheetTitle } from "@/components/ui";
import { NavLink } from "react-router";

import { resolveContent, useContent } from "@/content";

interface CommandDestination {
  readonly to: string;
  readonly contentId: string;
  readonly icon: IconName;
}

const DESTINATIONS: readonly CommandDestination[] = [
  { to: "/panel", contentId: "cockpit.drawer.nav.dashboard", icon: "dashboard" },
  { to: "/degerlendirmeler", contentId: "cockpit.drawer.nav.decisions", icon: "decisions" },
  { to: "/firsatlar", contentId: "cockpit.drawer.nav.opportunities", icon: "opportunities" },
  { to: "/kaynaklar", contentId: "cockpit.drawer.nav.sources", icon: "sources" },
  { to: "/organizasyon/hazirlik", contentId: "cockpit.drawer.nav.readiness", icon: "readiness" },
  { to: "/olgunluk", contentId: "cockpit.drawer.nav.maturity", icon: "maturity" },
  { to: "/operasyon/saglik", contentId: "cockpit.drawer.nav.health", icon: "health" },
  { to: "/dosyalar", contentId: "cockpit.drawer.nav.files", icon: "files" },
  { to: "/yetenekler", contentId: "cockpit.drawer.nav.capabilities", icon: "capabilities" },
  { to: "/ayarlar/gorunum", contentId: "cockpit.drawer.nav.settings", icon: "settings" },
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
            <AppIcon name="close" />
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
              <AppIcon name={destination.icon} />
              <span>{resolveContent(destination.contentId)}</span>
            </NavLink>
          ))}
        </nav>
      </SheetBody>
    </SheetContent>
  );
}
