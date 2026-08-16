/**
 * The account menu's vendor — Radix's dropdown menu, through one adapter.
 *
 * Built on `@radix-ui/react-dropdown-menu` for the same reason `sheet.tsx` is
 * built on `@radix-ui/react-dialog`: `role="menu"`/`role="menuitem"`, roving
 * focus between items, Escape-to-close and focus restoration to the trigger
 * are all vendor behaviour. Hand-rolling any one of those is how a menu
 * becomes a keyboard trap.
 *
 * Unlike `Sheet`, a dropdown menu is never itself a `dialog` — it is a
 * `menu`, non-modal by the ARIA pattern, opened from a control that already
 * lives inside a real dialog here (the drawer's footer account trigger). That
 * is why `cognitive-shell-v2.test.tsx` can assert "exactly one dialog stays
 * open while the account menu is open": the menu was never a second dialog to
 * begin with.
 */

import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuGroup = DropdownMenuPrimitive.Group;
export const DropdownMenuPortal = DropdownMenuPrimitive.Portal;

export function DropdownMenuContent({
  className,
  sideOffset = 8,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-[14rem] overflow-hidden rounded-lg border border-border bg-card p-1",
          "text-card-foreground shadow-flat-2",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

export function DropdownMenuLabel({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Label>) {
  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      className={cn("px-2 py-1.5 text-sm font-semibold text-muted-foreground", className)}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

/**
 * A single row. `disabled` items still need a *reason*, so the caller passes
 * `aria-describedby` pointing at text the row itself renders — Radix leaves
 * a disabled item fully out of the roving tab sequence but keeps it in the
 * accessibility tree, which is exactly what a stated-reason disabled row
 * needs.
 */
export function DropdownMenuItem({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Item>) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      className={cn(
        "flex min-h-11 cursor-pointer select-none items-center gap-2 rounded-md px-2 py-2 text-sm",
        "outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
        "data-[disabled]:pointer-events-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
