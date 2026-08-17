/**
 * The one authenticated workspace chrome.
 *
 * `CognitiveSpotlightHeader` + `NavigationSheet` + `ModalLayerHost` + content
 * + toast, composed exactly once and mounted once, by `workspace-shell.tsx`,
 * above every private route's `<Outlet />`. A page under it — `/panel`
 * included — renders body content only; it never mounts its own header,
 * navigation sheet or scrim, so there is exactly one shell to review and
 * exactly one place blur/scrim ownership can be checked.
 *
 * The `Sheet` root here is the same Radix dialog root `CognitiveSpotlightHeader`'s
 * hamburger `SheetTrigger` already expects — trigger and content talk through
 * context, not DOM adjacency, so the header can stay a sibling of
 * `NavigationSheet` rather than its parent.
 */

import { useMemo, useState, type ReactNode } from "react";

import { Sheet } from "@/foundation";
import { useUiStore } from "@/store/ui";

import { CognitiveAccountMenu } from "./CognitiveAccountMenu";
import { CognitiveSpotlightHeader, type CockpitSearchItem } from "./CognitiveSpotlightHeader";
import { ModalLayerHost, type ModalLayerLevel } from "./ModalLayerHost";
import { NavigationSheet } from "./NavigationSheet";

import "./cognitive-cockpit.css";

export interface CognitiveAppShellIdentity {
  readonly organisationLabel: string;
  readonly roleLabel: string;
}

export interface CognitiveAppShellProps {
  readonly identity: CognitiveAppShellIdentity;
  readonly searchItems?: readonly CockpitSearchItem[];
  readonly notificationCount?: number;
  readonly onLogout?: () => void;
  readonly loggingOut?: boolean;
  readonly children: ReactNode;
}

/** Filters the search index by label or hint, in Turkish locale order. */
function filterSearch(
  items: readonly CockpitSearchItem[],
  query: string,
): readonly CockpitSearchItem[] {
  const needle = query.trim().toLocaleLowerCase("tr");
  if (needle === "") return [];
  return items.filter(
    (item) =>
      item.label.toLocaleLowerCase("tr").includes(needle) ||
      (item.hint ?? "").toLocaleLowerCase("tr").includes(needle),
  );
}

export function CognitiveAppShell({
  identity,
  searchItems = [],
  notificationCount = 0,
  onLogout,
  loggingOut = false,
  children,
}: CognitiveAppShellProps) {
  const theme = useUiStore((store) => store.theme);
  const density = useUiStore((store) => store.density);
  const reducedMotion = useUiStore((store) => store.reducedMotion);

  const [navigationOpen, setNavigationOpen] = useState(false);
  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const [spotlightQuery, setSpotlightQuery] = useState("");

  const searchResults = useMemo(
    () => filterSearch(searchItems, spotlightQuery),
    [searchItems, spotlightQuery],
  );

  const activeLayers: readonly ModalLayerLevel[] = navigationOpen ? ["page"] : [];

  return (
    <div
      className="cognitive-cockpit cognitive-app-shell"
      data-theme={theme === "system" ? undefined : theme}
      data-density={density}
      data-reduced-motion={reducedMotion ? "true" : "false"}
    >
      <Sheet open={navigationOpen} onOpenChange={setNavigationOpen}>
        <CognitiveSpotlightHeader
          open={spotlightOpen}
          onOpenChange={setSpotlightOpen}
          query={spotlightQuery}
          onQueryChange={setSpotlightQuery}
          results={searchResults}
          notificationCount={notificationCount}
          accountMenu={
            <CognitiveAccountMenu
              organisationLabel={identity.organisationLabel}
              roleLabel={identity.roleLabel}
              loggingOut={loggingOut}
              {...(onLogout ? { onLogout } : {})}
            />
          }
        />
        <NavigationSheet
          organisationLabel={identity.organisationLabel}
          roleLabel={identity.roleLabel}
          onNavigate={() => setNavigationOpen(false)}
        />
      </Sheet>

      <ModalLayerHost
        activeLayers={activeLayers}
        onDismiss={() => setNavigationOpen(false)}
      />

      <div className="cognitive-app-shell__content">{children}</div>

      <div className="cognitive-app-shell__toast-region" role="status" aria-live="polite" />
    </div>
  );
}
