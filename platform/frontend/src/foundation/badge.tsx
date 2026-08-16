/**
 * The clean-room badge — a tinted surface, a readable foreground and a
 * border, so tone is never colour alone.
 *
 * Colour, border and radius come from `fd-badge*` classes in
 * `foundation.css`, not from Tailwind utilities aliased to the legacy design
 * tokens (`border-border-strong`, `bg-muted`, `text-foreground` and similar
 * resolve through `src/design/tailwind.css`'s `@theme inline` block).
 */

import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  ["fd-badge", "inline-flex w-fit items-center justify-center gap-1 whitespace-nowrap px-2 py-0.5 font-medium"].join(
    " ",
  ),
  {
    variants: {
      tone: {
        neutral: "fd-badge--neutral",
        accent: "fd-badge--accent",
        warning: "fd-badge--warning",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export type BadgeVariantProps = VariantProps<typeof badgeVariants>;

export interface BadgeProps extends ComponentProps<"span">, BadgeVariantProps {
  /** Read by assistive technology in addition to the visible children. */
  readonly srDescription?: string;
}

export function Badge({ className, tone, srDescription, children, ...props }: BadgeProps) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ tone }), className)} {...props}>
      {children}
      {srDescription ? <span className="fd-visually-hidden">{` ${srDescription}`}</span> : null}
    </span>
  );
}
