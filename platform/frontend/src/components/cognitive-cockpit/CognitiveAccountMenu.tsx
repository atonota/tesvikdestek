/**
 * The account control in the Spotlight header: tenant identity, settings, sign out.
 */

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  FoundationIcon,
  Link,
} from "@/foundation";
import { useContent } from "@/content";

export interface CognitiveAccountMenuProps {
  readonly organisationLabel: string;
  readonly roleLabel: string;
  readonly onLogout?: () => void;
  readonly loggingOut?: boolean;
}

export function CognitiveAccountMenu({
  organisationLabel,
  roleLabel,
  onLogout,
  loggingOut = false,
}: CognitiveAccountMenuProps) {
  const triggerAriaLabel = useContent("cockpit.account.trigger_aria_label", {
    values: { org: organisationLabel, role: roleLabel },
  });
  const settingsLabel = useContent("cockpit.account.settings");
  const logoutLabel = useContent("cockpit.account.logout");
  const loggingOutLabel = useContent("cockpit.account.logging_out");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="cognitive-account-menu__trigger"
          aria-label={triggerAriaLabel}
        >
          <span className="cognitive-account-menu__label">{roleLabel}</span>
          <FoundationIcon name="expand" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="cognitive-account-menu__content">
        <DropdownMenuLabel>{organisationLabel}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/ayarlar/gorunum">{settingsLabel}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={loggingOut}
          onSelect={(event) => {
            event.preventDefault();
            onLogout?.();
          }}
        >
          {loggingOut ? loggingOutLabel : logoutLabel}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
