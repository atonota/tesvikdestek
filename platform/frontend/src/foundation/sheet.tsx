/**
 * The clean-room sheet — a modal side/bottom panel built directly on Radix's
 * dialog primitive: focus-trapped while open, closed by Escape, and returning
 * focus to whatever opened it. The control that opens a sheet must be its own
 * `SheetTrigger`, so focus restoration has a real ref to return to.
 *
 * The panel's surface, border and shadow come from `fd-sheet` in
 * `foundation.css` rather than Tailwind utilities aliased to the legacy
 * design tokens (`border-border`, `bg-card`, `text-card-foreground`,
 * `shadow-flat-2`).
 */

import * as SheetPrimitive from "@radix-ui/react-dialog";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;
export const SheetTitle = SheetPrimitive.Title;

export function SheetOverlay({ className, ...props }: ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn("fd-overlay", "fixed inset-0 z-40", className)}
      {...props}
    />
  );
}

const SIDES = {
  start: "inset-y-0 start-0 h-full w-[min(20rem,85vw)] border-e",
  end: "inset-y-0 end-0 h-full w-[min(22rem,90vw)] border-s",
  bottom: "inset-x-0 bottom-0 max-h-[85vh] w-full fd-sheet--bottom border-t",
} as const;

export type SheetSide = keyof typeof SIDES;

export function SheetContent({
  className,
  overlayClassName,
  side = "end",
  ...props
}: ComponentProps<typeof SheetPrimitive.Content> & {
  side?: SheetSide;
  overlayClassName?: string;
}) {
  return (
    <SheetPrimitive.Portal>
      <SheetOverlay className={overlayClassName} />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        data-side={side}
        className={cn("fd-sheet", "fixed z-50 flex flex-col gap-4 overflow-y-auto p-4", SIDES[side], className)}
        {...props}
      />
    </SheetPrimitive.Portal>
  );
}

export function SheetHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex items-start justify-between gap-2", className)}
      {...props}
    />
  );
}

export function SheetBody({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="sheet-body" className={cn("min-w-0 flex-1", className)} {...props} />;
}
