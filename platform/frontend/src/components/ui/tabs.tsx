/**
 * The master tabs, on Radix.
 *
 * Radix owns roving focus, the arrow keys, Home/End, the `aria-selected`
 * bookkeeping and the panel association. None of that is styling, and every one
 * of them is something a hand-rolled tab strip gets subtly wrong.
 *
 * The list scrolls rather than wraps. At 320px a five-tab strip cannot fit, and
 * the two honest options are wrapping to a second row or scrolling; scrolling
 * keeps the selected tab and the panel adjacent, which is what a reader needs
 * on a small screen. `snap-x` makes the scroll land on a whole tab rather than
 * halfway through a label.
 */

import * as TabsPrimitive from "@radix-ui/react-tabs";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export function Tabs({ className, ...props }: ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-4", className)}
      {...props}
    />
  );
}

export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "flex snap-x snap-mandatory items-center gap-1 overflow-x-auto",
        "rounded-md border border-border bg-muted p-1",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex min-h-touch shrink-0 snap-start items-center justify-center gap-2",
        "rounded-sm px-3 py-1 text-base font-medium whitespace-nowrap",
        "text-muted-foreground transition-colors",
        // The selected tab is carried by surface, weight *and* a border, not by
        // colour alone.
        "data-[state=active]:border data-[state=active]:border-border-strong",
        "data-[state=active]:bg-card data-[state=active]:text-foreground",
        "data-[state=active]:shadow-flat-1",
        "focus-visible:outline-3 focus-visible:outline-ring focus-visible:outline-offset-2",
        "disabled:pointer-events-none disabled:opacity-60",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("min-w-0 outline-none", className)}
      {...props}
    />
  );
}
