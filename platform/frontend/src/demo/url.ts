/**
 * Where the static publication keeps the demo role: in the address bar.
 *
 * `session.ts` explains at length why the demo is not written to
 * `localStorage`, `sessionStorage`, `indexedDB` or a cookie, and none of that
 * has changed. What changed is a fact about one deployment: on GitHub Pages
 * there is no server, so a reload has nothing to fall back on. Module memory
 * dies with the document, the workspace boundary then reaches for
 * `GET /api/degerlendirmeler` on a file server, and the visitor is handed
 * "Çalışma alanı açılamadı" for pressing F5 inside the only feature that
 * publication has.
 *
 * The address bar is the honest place to put it, and the reasons are worth
 * being explicit about rather than asserting "URL state" as a fashion:
 *
 *   - **It is visible.** `?demo=customer` is legible to the person it belongs
 *     to, in the one part of the browser they already read. A storage key is
 *     legible only to somebody who opens developer tools.
 *   - **It has the right lifetime.** It exists exactly as long as the address
 *     does. Close the tab, clear the field, follow a different link, and it is
 *     gone - no residue that a later audit of the browser has to explain.
 *   - **It cannot be mistaken for a session.** It carries a role *name*, not a
 *     token, not a credential, not an identifier. It grants nothing, because
 *     there is nothing to grant: the demo data is compiled into the bundle
 *     that every visitor already downloaded, and the shell says "Demo" on
 *     every screen it opens. Reading this parameter cannot reach anybody's
 *     tenant data, because on this publication there is no tenant and no data
 *     behind the origin at all.
 *   - **It survives the way GitHub Pages serves deep links.** Pages answers an
 *     unknown path with `404.html` - the application - while leaving the URL,
 *     including its query string, exactly as the visitor typed it. So a deep
 *     link into a workspace screen boots the app *and* still carries its demo
 *     context.
 *
 * Nothing in this module is read by the ordinary deployment behind FastAPI.
 * There the parameter grants nothing and is not written; the server session is
 * the only session, and `queries.ts`/`app.tsx` keep it that way.
 */

import { DEMO_PROFILES, type DemoRole } from "./profiles";

/**
 * The parameter name, spelled once.
 *
 * Turkish elsewhere in this codebase's URLs (`donus`, `kayit`), but `demo` is
 * the same word in both languages and it is what the feature is called on
 * screen. A second spelling anywhere would be a demo that silently stops
 * surviving reloads.
 */
export const DEMO_ROLE_PARAM = "demo";

/**
 * The one place that decides whether a URL value names a demo profile.
 *
 * Allow-list shaped, and strictly: the value has to be exactly one of the two
 * ids `DEMO_PROFILES` already declares. No trimming, no case folding, no
 * "starts with". This is deliberately stricter than `normalizeDemoEmail`,
 * which forgives a phone keyboard capitalising a typed address - nobody types
 * a query parameter by hand off a printed card, so leniency here would buy
 * nothing and would widen the set of strings that open something.
 *
 * Everything else - absent, empty, `root`, `SUPERADMIN`, a list, a fragment of
 * markup - returns `null`, and the caller's answer to `null` is the login
 * screen, never a request and never a guess.
 */
export function parseDemoRole(value: string | null | undefined): DemoRole | null {
  if (typeof value !== "string") return null;
  const found = DEMO_PROFILES.find((profile) => profile.id === value);
  return found ? found.id : null;
}

/**
 * The same address, carrying this demo role and keeping everything else.
 *
 * Built from `URLSearchParams` rather than by string concatenation so an
 * existing query (`?donus=…`, a saved grid view) survives untouched, and so
 * the value is encoded once, correctly.
 */
export function withDemoRole(search: string, role: DemoRole): string {
  const params = new URLSearchParams(search);
  params.set(DEMO_ROLE_PARAM, role);
  return `?${params.toString()}`;
}

/**
 * The same address with any demo claim removed.
 *
 * Used on the way *out*: the login link a refused or ended demo produces must
 * not carry the value that was just refused, or the return trip would re-open
 * exactly what was declined. Returns an empty string when nothing is left, so
 * the caller can append it to a path without producing a bare `?`.
 */
export function withoutDemoRole(search: string): string {
  const params = new URLSearchParams(search);
  params.delete(DEMO_ROLE_PARAM);
  const rest = params.toString();
  return rest === "" ? "" : `?${rest}`;
}
