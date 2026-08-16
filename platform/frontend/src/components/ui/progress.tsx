/**
 * The master progress bar, on Radix.
 *
 * Radix supplies `role="progressbar"` with `aria-valuenow`, `aria-valuemin` and
 * `aria-valuemax` kept in agreement with the rendered width. That agreement is
 * the whole accessibility story for this control, and it is the part a `<div>`
 * with a percentage width always omits.
 *
 * `value={null}` is a real state and is rendered as one: Radix reports
 * `data-state="indeterminate"` and no `aria-valuenow`, which is how "we do not
 * know how far along this is" stays distinguishable from "0%". This product
 * refuses to render an unmeasured figure as a zero, and a progress bar is
 * exactly where that lie is easiest to tell.
 */

import * as ProgressPrimitive from "@radix-ui/react-progress";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export function Progress({
  className,
  value,
  ...props
}: ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-xs bg-muted",
        "border border-border",
        className,
      )}
      value={value}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(
          "h-full w-full flex-1 bg-primary transition-transform",
          // Indeterminate is drawn as a hatched track rather than as a full or
          // an empty bar, because both of those read as a measurement.
          "data-[state=indeterminate]:bg-border-strong",
        )}
        style={{ transform: `translateX(-${100 - (value ?? 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}
