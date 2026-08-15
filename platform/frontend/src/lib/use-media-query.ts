/**
 * A media query React can branch on.
 *
 * CSS alone cannot express "render the navigation as a modal dialog on a phone
 * and as a persistent rail on a desktop". Hiding one of two copies with
 * `display: none` looks the same and is not the same: both copies are in the
 * document, a screen reader walks the visible one and a focus trap can capture
 * the hidden one, and the assistant's content would exist twice on every page.
 * So the shell asks which layout it is in and renders exactly one.
 *
 * `useSyncExternalStore` rather than `useState` + `useEffect`: the first paint
 * reads the real value instead of flashing the mobile layout on a desktop, and
 * React is told about the subscription rather than being raced by it.
 *
 * `matchMedia` is absent in jsdom (`test/setup.ts` installs a stub that answers
 * `false` for everything) and absent during any non-browser render, so the
 * mobile branch is the default. That is the right default for a mobile-first
 * product: the 320px layout is the one that works everywhere.
 */

import { useCallback, useSyncExternalStore } from "react";

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
        return () => undefined;
      }
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia(query).matches;
  }, [query]);

  // The server snapshot is the mobile branch, for the same reason as above.
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/**
 * The one breakpoint the adaptive shell switches layout at.
 *
 * Kept next to the hook and equal to the `@media (min-width: 64rem)` query in
 * `design/adaptive.css`, so the JavaScript branch and the stylesheet cannot
 * drift into disagreeing about which layout is on screen.
 */
export const DESKTOP_QUERY = "(min-width: 64rem)";
