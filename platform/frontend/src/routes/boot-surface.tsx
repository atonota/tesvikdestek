/**
 * The two surfaces that must exist before any route module has loaded.
 *
 * The router needs a boot fallback and an error boundary, and both are reached
 * from `app/router.tsx`, which the entry imports directly. Anything they import
 * is therefore in the **eager graph** - downloaded by every visitor before a
 * route has even been chosen.
 *
 * That is how the first-load budget was blown. `routes/errors.tsx` imported
 * `{ Link, PublicShell }` from `@/components`, and that barrel re-exports the
 * primitives, the composites, the patterns, the shells, the domain layer, the
 * twelve templates, the data grid, the media library, the adaptive shell and
 * the form layer. Two components' worth of markup dragged the entire design
 * system, the icon set and TanStack Table into the first load: measured at
 * 236,684 gzipped bytes against a published budget of 180,000.
 *
 * So these surfaces import nothing from the component system. They are a
 * deliberate, small duplication of `PublicShell`'s frame - the same class names,
 * so the same stylesheet paints them and they are visually the *same* frame -
 * and the duplication is the point rather than a compromise: the alternative is
 * a shared import that puts seventy-five components in front of a visitor who
 * has not asked for a screen yet.
 *
 * Two things `PublicShell` does that these deliberately do not:
 *
 *  - **No `OfflineBanner`.** It lives in `patterns.tsx`, which reaches the
 *    primitives and through them Radix's select. A connectivity banner on a
 *    boot spinner is also answering a question nobody has asked yet; the real
 *    frame carries it on every route that has content to be stale.
 *  - **No navigation list.** These surfaces link to two places by hand.
 *
 * `useAppearance` is kept, because a themed product that boots in the light
 * palette and repaints dark once the first route lands is worse than either.
 */

import { useEffect } from "react";
import { Link, isRouteErrorResponse, useRouteError } from "react-router";

import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { applyAppearance, useUiStore } from "@/store/ui";

/**
 * Applies the persisted appearance, exactly as the real shells do.
 *
 * Duplicated from `shells.tsx` for the reason above: importing it would pull
 * the module that holds it, and the module that holds it is the design system.
 * It is four lines and one store read.
 */
function useAppearance(): void {
  const density = useUiStore((state) => state.density);
  const theme = useUiStore((state) => state.theme);
  const fontScale = useUiStore((state) => state.fontScale);
  const reducedMotion = useUiStore((state) => state.reducedMotion);
  useEffect(() => {
    applyAppearance({ density, theme, fontScale, reducedMotion });
  }, [density, theme, fontScale, reducedMotion]);
}

/** The public frame, without anything that would reach the component barrel. */
function BootShell({ children }: { readonly children: React.ReactNode }) {
  useAppearance();
  return (
    <div className="dt-public">
      <a className="dt-skip-link" href="#ana-icerik">
        İçeriğe geç
      </a>
      <header className="dt-public__header">
        <Link to="/" className="dt-app__brand">
          DestekTeşvik
        </Link>
      </header>
      <main id="ana-icerik" className="dt-public__main" tabIndex={-1}>
        {children}
      </main>
      <footer className="dt-public__footer">
        <p className="dt-muted">
          Bu uygulama hukuki veya mali danışmanlık hizmeti vermez. Ürettiği sonuçlar bağlayıcı
          değildir ve resmî kurum kararı yerine geçmez.
        </p>
      </footer>
    </div>
  );
}

/**
 * Shown while the first route chunk is still downloading.
 *
 * Without it the browser paints an empty document for as long as the network
 * takes, which reads as a broken page rather than a loading one.
 *
 * Built on the master skeleton layer rather than on `SkeletonBlock`, and that
 * is both a size decision and the product rule: `ui/skeleton.tsx` imports only
 * `cn`, so it costs the eager graph nothing, and the owner's standing rule is
 * that a loading state imitates the layout it stands in for. What lands here is
 * a page of running text, so this is a page of running text.
 */
export function BootFallback() {
  return (
    <BootShell>
      <Skeleton label="Uygulama yükleniyor" className="gap-4">
        <SkeletonText lines={2} lastLineWidth="40%" />
        <SkeletonText lines={5} />
      </Skeleton>
    </BootShell>
  );
}

/**
 * Where a mistyped address sends people.
 *
 * Both links have to be openable by whoever is reading them, and one of them
 * was not: `/yetenekler` is a workspace route behind the session boundary, so
 * an anonymous visitor who mistyped an address - the least oriented person in
 * the product - was offered a login wall as their recovery. `PUBLIC_NAV` had
 * the same link removed for the same reason; this page kept it.
 *
 * `/nasil-calisir` replaces it rather than nothing replacing it. The capability
 * picture is not being hidden: it is the public account of what this product
 * does and does not do, it needs no session, and it answers the question a
 * visitor on a 404 is actually asking.
 */
export function NotFoundRoute() {
  return (
    <BootShell>
      <div className="dt-stack">
        <h1>Sayfa bulunamadı</h1>
        <p>
          Aradığınız adres bu uygulamada yok. Adres yanlış yazılmış olabilir ya da bu yetenek
          henüz mevcut değildir.
        </p>
        <div className="dt-row">
          <Link to="/" className="dt-link">
            Ana sayfa
          </Link>
          <Link to="/nasil-calisir" className="dt-link">
            Nasıl çalışır
          </Link>
        </div>
      </div>
    </BootShell>
  );
}

/** Router-level error boundary. Never invents a request id. */
export function RouteErrorBoundary() {
  const error = useRouteError();
  const status = isRouteErrorResponse(error) ? error.status : null;
  const message = isRouteErrorResponse(error)
    ? error.statusText
    : error instanceof Error
      ? error.message
      : "Bilinmeyen hata";

  if (status === 404) return <NotFoundRoute />;

  return (
    <BootShell>
      <div className="dt-stack">
        <h1>Bir şeyler ters gitti</h1>
        <p>Bu ekran yüklenirken beklenmeyen bir hata oluştu.</p>
        <details>
          <summary>Teknik ayrıntı</summary>
          <pre className="dt-mono">{message}</pre>
        </details>
        <Link to="/" className="dt-link">
          Ana sayfaya dön
        </Link>
      </div>
    </BootShell>
  );
}
