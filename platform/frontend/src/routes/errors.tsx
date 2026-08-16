/**
 * The error surfaces, re-exported from where they now live.
 *
 * They moved to `boot-surface.tsx` because of what they were dragging behind
 * them: this module is reached from `app/router.tsx`, which the entry imports
 * directly, and it used to import `{ Link, PublicShell }` from `@/components`.
 * That barrel re-exports the whole design system, so two components' worth of
 * markup put seventy-five components, the icon set and TanStack Table into the
 * first load - 236,684 gzipped bytes against a published budget of 180,000.
 *
 * The path survives because tests and a route table import it, and because the
 * *names* are the contract rather than the file. There is one implementation,
 * in `boot-surface.tsx`, and it imports nothing from the component system.
 */

export { NotFoundRoute, RouteErrorBoundary } from "./boot-surface";
