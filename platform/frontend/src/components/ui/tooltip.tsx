/**
 * The master tooltip, on Radix.
 *
 * A tooltip is the control most often built as a hover-only `title` attribute,
 * and that form fails three ways at once: it never appears for a keyboard, it
 * never appears on touch, and its timing is the operating system's. Radix opens
 * on focus as well as hover, closes on Escape, and positions against the
 * viewport - which is what makes it usable at 320px, where a naive tooltip
 * renders off-screen.
 *
 * The `Provider` is exported rather than mounted here. Delay and skip-delay are
 * application-level decisions: a data-dense table where every cell has a
 * tooltip needs a shared skip window, and per-tooltip providers cannot give it
 * one.
 *
 * A tooltip never carries information that exists nowhere else. It is a
 * shortcut for a reader who wants more, not a hiding place for a label.
 */

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export function TooltipProvider({
  delayDuration = 200,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  );
}

export function Tooltip(props: ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
}

export function TooltipTrigger(props: ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

export function TooltipContent({
  className,
  sideOffset = 6,
  children,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "z-50 max-w-72 rounded-md border border-border-strong",
          "bg-popover px-3 py-2 text-sm text-popover-foreground shadow-flat-2",
          className,
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="fill-popover" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}
