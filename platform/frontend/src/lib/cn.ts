/**
 * The historical import path for `cn`, kept pointing at the canonical one.
 *
 * Roughly forty modules import `@/lib/cn`. Rewriting them all in the same
 * package that introduces Tailwind would bury a mechanical rename inside a
 * behavioural change, so the path survives - but the *implementation* does not
 * survive twice. There is exactly one `cn` in this package, it lives in
 * `@/lib/utils` where shadcn/ui expects it, and this module re-exports it.
 *
 * Two implementations would be the worse outcome by a distance: half the tree
 * would merge conflicting Tailwind utilities and half would concatenate them,
 * and which half a component happened to be in would be invisible at the call
 * site.
 */

export { cn } from "./utils";
