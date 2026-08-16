/**
 * The master button.
 *
 * shadcn/ui's code contract, held exactly: a `cva` recipe for the variants, a
 * `data-slot` attribute so a parent can style or find this part without a
 * class-name guess, `asChild` through Radix's `Slot` so a router link can wear
 * the button's appearance without a nested-interactive element, and `cn` for
 * the merge.
 *
 * What is *not* upstream, and why:
 *
 *  - **The variant names are the product's, not the registry's.** This codebase
 *    has spoken `primary | secondary | ghost | danger` since its first commit,
 *    across roughly forty call sites and their tests. Renaming them to
 *    `default | destructive | outline` would be a rename with no user visible
 *    to it. `outline` and `link` are added because the enterprise surfaces
 *    genuinely need them.
 *  - **Sizes carry a touch floor.** `--dt-target-touch` is 44px, and 320px is
 *    the source layout rather than an afterthought, so the medium and large
 *    sizes reach it and the small one keeps WCAG 2.2's 24px minimum.
 *  - **No pill, ever.** `rounded-md` resolves to the product's 8px token and
 *    the whole radius scale is clamped at 12px in `tailwind.css`, so a
 *    `rounded-full` copied out of an upstream snippet cannot appear here.
 */

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "rounded-md font-medium",
    // Motion-first, and reduced motion is honoured at the token layer: the
    // duration variable collapses to 0ms, so this transition simply stops.
    "transition-[color,background-color,border-color,box-shadow]",
    "outline-none focus-visible:outline-3 focus-visible:outline-ring focus-visible:outline-offset-2",
    "disabled:pointer-events-none disabled:opacity-60",
    // Icons inside a button are decoration beside a label; they never take the
    // pointer and they never dictate the line box.
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary-hover shadow-flat-1",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary-hover shadow-flat-1",
        outline:
          "border border-border-strong bg-card text-foreground hover:bg-accent-soft",
        ghost: "bg-transparent text-foreground hover:bg-accent-soft",
        danger:
          "bg-destructive text-destructive-foreground hover:brightness-110 shadow-flat-1",
        link: "bg-transparent text-accent underline underline-offset-4 hover:no-underline",
      },
      size: {
        sm: "min-h-6 px-3 py-1 text-sm",
        md: "min-h-touch px-4 py-2 text-base",
        lg: "min-h-touch px-6 py-3 text-lg",
        icon: "size-touch p-0",
      },
      block: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "primary", size: "md", block: false },
  },
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;

export function Button({
  className,
  variant,
  size,
  block,
  asChild = false,
  ...props
}: ComponentProps<"button"> & ButtonVariantProps & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, block }), className)}
      {...props}
    />
  );
}
