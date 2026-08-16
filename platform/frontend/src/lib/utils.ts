/**
 * The canonical class-name joiner, in the location shadcn/ui expects.
 *
 * `components.json` names `@/lib/utils` as the utils alias, so every component
 * pulled from the shadcn registry imports `cn` from here without being edited.
 * That is the practical half of adopting the registry: a snippet that has to be
 * rewritten on arrival is a snippet that will drift from upstream.
 *
 * The substantive half is `twMerge`. A plain join is not enough once utilities
 * are the styling system: `cn("px-4", "px-6")` must resolve to `px-6`, and a
 * plain join emits both and leaves the winner to source order inside the
 * generated stylesheet - which is not the call site's order and is not stable
 * across builds. Every override passed through a `className` prop depends on
 * this, so the merge is a correctness requirement rather than a convenience.
 *
 * `clsx` handles the conditional forms (arrays, objects, nested falsy values)
 * that the previous joiner did not accept.
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
