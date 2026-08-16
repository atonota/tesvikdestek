/**
 * The clean-room button.
 *
 * Built directly on Radix's `Slot` so a router link can wear the button's
 * appearance without a nested-interactive element, with the same variant
 * vocabulary and touch-target floor the rest of the product uses. Owned by
 * the W0 clean panel package rather than imported from the old component
 * system.
 *
 * Colour, radius, shadow and the touch-height floor come from `fd-btn*`
 * classes in `foundation.css`, styled against this package's own tokens —
 * not from Tailwind utilities that resolve through the legacy design system
 * (`bg-primary`, `rounded-md`, `min-h-touch`, `shadow-flat-1`, `text-base`
 * and their kin are all aliased to the old tokens in
 * `src/design/tailwind.css`'s `@theme inline` block). Layout utilities that
 * are not tied to that legacy mapping — flex, gap, padding, transitions —
 * remain plain Tailwind.
 */

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  [
    "fd-btn",
    "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium",
    "transition-[color,background-color,border-color,box-shadow]",
    "outline-none focus-visible:outline-3 focus-visible:outline-offset-2",
    "disabled:pointer-events-none disabled:opacity-60",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        primary: "fd-btn--primary",
        secondary: "fd-btn--secondary",
        outline: "fd-btn--outline",
        ghost: "fd-btn--ghost",
        danger: "fd-btn--danger",
      },
      size: {
        sm: "fd-btn--sm px-3 py-1",
        md: "fd-btn--md px-4 py-2",
        lg: "fd-btn--lg px-6 py-3",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ComponentProps<"button"> & ButtonVariantProps & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
