/**
 * The one authenticated workspace chrome, mounted once above every private
 * route's `<Outlet />`.
 *
 * `WorkspaceGate` (`workspace-gate.tsx`) already answers "is there a
 * session?" for everything nested beneath it. This module answers the next
 * question - "what does the header say?" - once, rather than letting every
 * route under it plumb its own organisation label, search index and logout
 * handler through a per-page shell. `CognitiveAppShell` is the chrome;
 * `DashboardRoute` and every other private route render body content only.
 */

import { Outlet, useNavigate } from "react-router";

import { useDecisionsQuery, useLogout } from "@/api/queries";
import { useContent } from "@/content";
import { demoBadgeLabel, useDemoSession } from "@/demo";
import { CognitiveAppShell } from "@/components/cognitive-cockpit";

export function WorkspaceShellRoute() {
  const decisions = useDecisionsQuery();
  const logout = useLogout();
  const navigate = useNavigate();
  const demo = useDemoSession();

  const fallbackOrg = useContent("cockpit.identity.fallback_org");
  const superadminRole = useContent("cockpit.identity.role.superadmin");
  const userRole = useContent("cockpit.identity.role.user");

  const organisationLabel = demo ? demoBadgeLabel(demo.role) : fallbackOrg;
  const roleLabel = demo?.role === "superadmin" ? superadminRole : userRole;

  const loadedDecisions = decisions.data ?? [];
  const searchItems = loadedDecisions.map((decision) => ({
    id: decision.id,
    label: decision.outcome_label,
    hint: decision.program_code,
    to: `/degerlendirmeler/${decision.id}`,
  }));
  const notificationCount = loadedDecisions.filter((d) => d.missing_facts.length > 0).length;

  return (
    <CognitiveAppShell
      identity={{ organisationLabel, roleLabel }}
      searchItems={searchItems}
      notificationCount={notificationCount}
      onLogout={() => logout.mutate(undefined, { onSuccess: () => void navigate("/giris") })}
      loggingOut={logout.isPending}
    >
      <Outlet />
    </CognitiveAppShell>
  );
}
