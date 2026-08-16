/**
 * The master badge.
 *
 * The tones are the domain's, not a generic status palette, and the difference
 * matters: this product has exactly four eligibility outcomes and deliberately
 * no "success" tone, because a green tick is a claim about public money that
 * nothing in this interface is entitled to make.
 *
 * Colour is never the only carrier. Every tone pairs a tinted surface with a
 * readable foreground *and* a border, all three contrast-checked in both themes
 * by `design-system-contract.test.ts`, and the caller always supplies text.
 */

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  [
    "inline-flex w-fit items-center justify-center gap-1 whitespace-nowrap",
    "rounded-sm border px-2 py-0.5 text-sm font-medium",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      tone: {
        neutral: "border-border-strong bg-muted text-foreground",
        accent: "border-accent bg-accent-soft text-foreground",
        candidate:
          "border-outcome-candidate-line bg-outcome-candidate-bg text-outcome-candidate",
        ineligible:
          "border-outcome-ineligible-line bg-outcome-ineligible-bg text-outcome-ineligible",
        conditional:
          "border-outcome-conditional-line bg-outcome-conditional-bg text-outcome-conditional",
        insufficient:
          "border-outcome-insufficient-line bg-outcome-insufficient-bg text-outcome-insufficient",
        warning:
          "border-secondary-hover bg-secondary-soft text-secondary-foreground",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export type BadgeVariantProps = VariantProps<typeof badgeVariants>;

export function Badge({
  className,
  tone,
  asChild = false,
  ...props
}: ComponentProps<"span"> & BadgeVariantProps & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";
  return (
    <Comp data-slot="badge" className={cn(badgeVariants({ tone }), className)} {...props} />
  );
}
