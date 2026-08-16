/**
 * The master sheet — the native drawer behaviour on a phone.
 *
 * Built on Radix's dialog, because a side panel is a dialog: modal, backdropped,
 * focus-trapped while open, closed by Escape, and returning focus to whatever
 * opened it. Hand-rolling any one of those turns a panel into a trap, and the
 * one that is missed most often is the last.
 *
 * **The control that opens a sheet must be its own `SheetTrigger`.** Radix
 * cancels the browser's focus restoration and returns focus to the trigger's
 * ref instead; a hand-wired button with an `onClick` leaves that ref null, so
 * closing drops focus onto `<body>` and silently returns a keyboard user to the
 * top of the document.
 *
 * Four sides, and the two horizontal ones are written in logical properties so
 * the drawer opens from the correct edge if this interface is ever mirrored.
 * The bottom side is the native phone idiom and takes the product's corner
 * radius on its top edge only.
 */

import * as SheetPrimitive from "@radix-ui/react-dialog";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;
export const SheetTitle = SheetPrimitive.Title;
export const SheetDescription = SheetPrimitive.Description;

export function SheetOverlay({
  className,
  ...props
}: ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn("fixed inset-0 z-40 bg-black/50", className)}
      {...props}
    />
  );
}

const SIDES = {
  start: "inset-y-0 start-0 h-full w-[min(20rem,85vw)] border-e",
  end: "inset-y-0 end-0 h-full w-[min(22rem,90vw)] border-s",
  bottom: "inset-x-0 bottom-0 max-h-[85vh] w-full rounded-t-lg border-t",
  top: "inset-x-0 top-0 max-h-[85vh] w-full rounded-b-lg border-b",
} as const;

export type SheetSide = keyof typeof SIDES;

export function SheetContent({
  className,
  overlayClassName,
  side = "end",
  ...props
}: ComponentProps<typeof SheetPrimitive.Content> & {
  side?: SheetSide;
  /**
   * Class names for the backdrop.
   *
   * The overlay is rendered here rather than by the caller - a sheet without
   * its backdrop is a panel, not a modal - but callers still need to reach it.
   * `AdaptiveShell` styles and locates it as `.dt-sheet__overlay`, and the
   * browser suite asserts modality by finding that element.
   */
  overlayClassName?: string;
}) {
  return (
    <SheetPrimitive.Portal>
      <SheetOverlay className={overlayClassName} />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          "fixed z-50 flex flex-col gap-4 overflow-y-auto",
          "border-border bg-card p-4 text-card-foreground shadow-flat-2",
          SIDES[side],
          className,
        )}
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
  return (
    <div data-slot="sheet-body" className={cn("min-w-0 flex-1", className)} {...props} />
  );
}

export function SheetFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("flex flex-wrap items-center gap-2", className)}
      {...props}
    />
  );
}
