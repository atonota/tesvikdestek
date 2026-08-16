/**
 * The master card — Card UI + Flat 2.0.
 *
 * shadcn/ui's composition, part for part, each with its `data-slot`: header,
 * title, description, action, content, footer. Composition rather than a props
 * bag is the point of this shape - a header that must accept a title, an
 * action, a badge row and a breadcrumb becomes six optional props and four
 * conditional branches when it is one component, and stays readable when it is
 * six.
 *
 * Flat 2.0 in practice: a real one-pixel edge carries the boundary, elevation
 * is a hairline shadow rather than a drop, and the corner is the product's
 * 12px ceiling. `overflow-hidden` keeps the painted surface inside that corner,
 * which is only safe because every content slot below sets `min-w-0` - a card
 * that clips silently is a card that hides evidence, and this product renders
 * content hashes and endpoints inside cards.
 *
 * ## The one extension over upstream: `asChild`
 *
 * Upstream's parts are all `<div>`. That is fine for a marketing card and wrong
 * for this product, where a card is a landmark (`<section>`), its title is a
 * real heading at a level the *screen* chooses, and its footer is a `<footer>`.
 * A heading wrapped in a styled div is not a heading, and a document outline
 * assembled from divs is not an outline.
 *
 * So every part takes `asChild` and renders through Radix's `Slot`, merging its
 * classes onto the element the caller supplies. The styling stays here; the
 * semantics stay with the screen that knows what the card *is*.
 */

import { Slot } from "@radix-ui/react-slot";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

type SlottableProps = ComponentProps<"div"> & { asChild?: boolean };

export function Card({ className, asChild = false, ...props }: SlottableProps) {
  const Comp = asChild ? Slot : "div";
  return (
    <Comp
      data-slot="card"
      className={cn(
        "flex flex-col gap-4 overflow-hidden rounded-lg border border-border",
        "bg-card py-4 text-card-foreground shadow-flat-1",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, asChild = false, ...props }: SlottableProps) {
  const Comp = asChild ? Slot : "div";
  return (
    <Comp
      data-slot="card-header"
      className={cn(
        // The action sits in its own column and the title block takes the rest.
        // `minmax(0,1fr)` is what stops a long unbroken title from widening the
        // grid past the card and, at 320px, past the viewport.
        "grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 px-4",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, asChild = false, ...props }: SlottableProps) {
  const Comp = asChild ? Slot : "div";
  return (
    <Comp
      data-slot="card-title"
      className={cn("min-w-0 text-lg leading-snug font-medium", className)}
      {...props}
    />
  );
}

export function CardDescription({ className, asChild = false, ...props }: SlottableProps) {
  const Comp = asChild ? Slot : "div";
  return (
    <Comp
      data-slot="card-description"
      className={cn("min-w-0 text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

/** The header's right-hand column: one action, or a tight cluster of them. */
export function CardAction({ className, asChild = false, ...props }: SlottableProps) {
  const Comp = asChild ? Slot : "div";
  return (
    <Comp
      data-slot="card-action"
      className={cn("col-start-2 row-span-2 row-start-1 flex items-center gap-2", className)}
      {...props}
    />
  );
}

export function CardContent({ className, asChild = false, ...props }: SlottableProps) {
  const Comp = asChild ? Slot : "div";
  return (
    <Comp data-slot="card-content" className={cn("min-w-0 px-4", className)} {...props} />
  );
}

export function CardFooter({ className, asChild = false, ...props }: SlottableProps) {
  const Comp = asChild ? Slot : "div";
  return (
    <Comp
      data-slot="card-footer"
      className={cn("flex min-w-0 flex-wrap items-center gap-2 px-4", className)}
      {...props}
    />
  );
}
