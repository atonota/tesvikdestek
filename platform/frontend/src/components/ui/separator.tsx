/**
 * The master separator, on Radix.
 *
 * The default is `decorative`, and that default is the reason to use Radix here
 * rather than a bordered div: a decorative rule is hidden from the
 * accessibility tree, while a semantic one is announced as a separator. A
 * screen reader hearing "separator" between every two rows of a dense table is
 * noise; hearing it between two genuinely different regions is structure. The
 * caller chooses, and the choice is visible at the call site.
 */

import * as SeparatorPrimitive from "@radix-ui/react-separator";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      orientation={orientation}
      decorative={decorative}
      className={cn(
        "shrink-0 bg-border",
        "data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full",
        "data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
        className,
      )}
      {...props}
    />
  );
}
