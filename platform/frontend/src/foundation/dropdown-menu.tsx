/**
 * The clean-room dropdown menu, built directly on Radix's dropdown-menu
 * primitive: `role="menu"`/`role="menuitem"`, roving focus between items,
 * Escape-to-close and focus restoration to the trigger.
 *
 * Surface, border, radius, shadow and text tone come from `fd-menu*`
 * classes in `foundation.css`, not from Tailwind utilities aliased to the
 * legacy design tokens (`rounded-lg`, `border-border`, `bg-card`,
 * `text-card-foreground`, `shadow-flat-2`, `text-sm`, `text-muted-foreground`,
 * `bg-border`, `data-[highlighted]:bg-accent`, `rounded-md`).
 */

import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

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
        className={cn("fd-menu", "z-50 min-w-[14rem] overflow-hidden p-1", className)}
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
      className={cn("fd-menu__label", "px-2 py-1.5 font-semibold", className)}
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
      className={cn("fd-menu__separator", "-mx-1 my-1", className)}
      {...props}
    />
  );
}

export function DropdownMenuItem({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Item>) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      className={cn(
        "fd-menu__item",
        "flex min-h-11 cursor-pointer select-none items-center gap-2 px-2 py-2",
        "outline-none",
        "data-[disabled]:pointer-events-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
