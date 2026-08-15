import { isRouteErrorResponse, useRouteError } from "react-router";

import { Link, PublicShell } from "@/components";

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
    <PublicShell>
      <div className="dt-stack">
        <h1>Sayfa bulunamadı</h1>
        <p>
          Aradığınız adres bu uygulamada yok. Adres yanlış yazılmış olabilir ya da bu yetenek
          henüz mevcut değildir.
        </p>
        <div className="dt-row">
          <Link to="/">Ana sayfa</Link>
          <Link to="/nasil-calisir">Nasıl çalışır</Link>
        </div>
      </div>
    </PublicShell>
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
    <PublicShell>
      <div className="dt-stack">
        <h1>Bir şeyler ters gitti</h1>
        <p>Bu ekran yüklenirken beklenmeyen bir hata oluştu.</p>
        <details>
          <summary>Teknik ayrıntı</summary>
          <pre className="dt-mono">{message}</pre>
        </details>
        <Link to="/">Ana sayfaya dön</Link>
      </div>
    </PublicShell>
  );
}
