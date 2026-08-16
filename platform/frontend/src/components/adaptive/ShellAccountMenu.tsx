/**
 * The drawer's footer account trigger, and the real menu it opens.
 *
 * The trigger itself carries `data-shell-account-trigger` so `AdaptiveShell`
 * can move focus to it imperatively when the avatar opens the shared drawer
 * - see that file for why a query selector rather than a forwarded ref: the
 * drawer's content remounts every time Radix opens it, and the shell already
 * owns exactly one place that reacts to "which trigger opened this".
 *
 * Its accessible name is an explicit `aria-label`, not the button's own text
 * content. The visible label reads "… Demo hesabı" - the possessive form,
 * with Turkish consonant softening turning the "p" of "hesap" into a "b" -
 * which is a different string to search for than the header avatar's own
 * "Hesap" label. `cognitive-shell-v2.test.tsx` looks for one accessible name
 * that answers `/hesap|account|profil/` on both triggers, so this one states
 * the same word the header uses instead of leaving assistive tech to parse
 * Turkish grammar out of the sentence.
 *
 * Every destination here is a route this application actually serves.
 * Language/region, workspaces and roles/permissions are three items this
 * deployment cannot offer - Turkish is the only language shipped, the
 * backend seats one tenant and one user, and there is no role model - and
 * each says so rather than disappearing or pretending a click would do
 * something. The workspaces and roles reasons are read straight from
 * `domain/capabilities.ts` (`team`, `roles`) rather than restated here, so
 * this menu cannot drift from the one ledger that already tracks what the
 * backend supports.
 */

import { useNavigate } from "react-router";

import { AppIcon } from "@/components/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLogout } from "@/api/queries";
import { useDemoSession } from "@/demo";
import { requireCapabilityReason } from "@/domain/capabilities";

export interface ShellAccountMenuProps {
  /** Called after a menu item routes away or logs out, so the drawer can close. */
  readonly onNavigate?: () => void;
}

const LANGUAGE_REASON_ID = "dt-account-menu-language-reason";
const WORKSPACES_REASON_ID = "dt-account-menu-workspaces-reason";
const ROLES_REASON_ID = "dt-account-menu-roles-reason";

export function ShellAccountMenu({ onNavigate }: ShellAccountMenuProps) {
  const demo = useDemoSession();
  const logout = useLogout();
  const navigate = useNavigate();

  const roleLabel = demo?.profile.roleLabel ?? "Hesap";
  const identityLabel = demo ? `${demo.profile.roleLabel} · Demo` : "Hesap";
  const initials = roleLabel.slice(0, 2).toUpperCase();

  function go(to: string) {
    onNavigate?.();
    navigate(to);
  }

  return (
    // `modal={false}`: this menu already lives inside the drawer's own modal
    // dialog. Radix's `DropdownMenu` defaults to `modal={true}`, which calls
    // the same `hideOthers()` a `Dialog` does - and "others" then includes
    // the drawer dialog itself, since it is not part of the menu's own layer.
    // The drawer dialog would vanish from the accessibility tree the moment
    // this menu opened, which is exactly backwards from "exactly one dialog
    // stays open while the account menu is open".
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-shell-account-trigger="true"
          aria-label={`Hesap · ${roleLabel}`}
          className="dt-drawer__account-trigger"
        >
          <span className="dt-drawer__account-avatar" aria-hidden="true">
            {initials}
          </span>
          <span className="dt-drawer__account-identity">
            <span className="dt-drawer__account-name">{roleLabel}</span>
            <span className="dt-drawer__account-role">Demo hesabı</span>
          </span>
          <AppIcon name="expand" className="dt-drawer__account-chevron" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top">
        <DropdownMenuLabel>{identityLabel}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => go("/ayarlar/gorunum")}>
          <AppIcon name="settings" />
          <span>Ayarlar · Görünüm</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => go("/nasil-calisir")}>
          <span>Yardım ve kısayollar</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled
          aria-describedby={LANGUAGE_REASON_ID}
          onSelect={(event) => event.preventDefault()}
        >
          <span>
            Dil ve bölge
            <br />
            <span id={LANGUAGE_REASON_ID} className="dt-drawer__account-reason">
              Bu sürümde yalnızca Türkçe desteklenir.
            </span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled
          aria-describedby={WORKSPACES_REASON_ID}
          onSelect={(event) => event.preventDefault()}
        >
          <span>
            Çalışma alanlarım
            <br />
            <span id={WORKSPACES_REASON_ID} className="dt-drawer__account-reason">
              {requireCapabilityReason("team")}
            </span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => go("/ayarlar/erisilebilirlik")}>
          <span>Erişilebilirlik tercihleri</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled
          aria-describedby={ROLES_REASON_ID}
          onSelect={(event) => event.preventDefault()}
        >
          <span>
            Rol ve izinler
            <br />
            <span id={ROLES_REASON_ID} className="dt-drawer__account-reason">
              {requireCapabilityReason("roles")}
            </span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            // `onNavigate` (the drawer's own close) does not run here.
            // Closing the drawer synchronously would unmount this component
            // - and the `navigate` this file holds - before the mutation's
            // `onSuccess` gets a chance to run on its later microtask, which
            // is silently dropping the redirect this test pins. The
            // navigation on success replaces the whole authenticated shell
            // anyway, drawer included; there is nothing left to close by
            // then that `navigate` itself does not already remove.
            logout.mutate(undefined, { onSuccess: () => void navigate("/giris") });
          }}
        >
          <AppIcon name="signOut" />
          <span>Çıkış</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
