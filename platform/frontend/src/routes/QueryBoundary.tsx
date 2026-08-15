/**
 * One place that turns a query into the right honest surface.
 *
 * Loading, error and empty are not afterthoughts here - they are the states a
 * user of this product will actually see most often, given three programmes
 * and a backend that returns very little.
 *
 * **A missing session is not a failure, and it was rendered as one.** Every
 * error arrived at the same `ErrorState`: the same "Bir şeyler ters gitti"
 * heading, the raw `İstek başarısız (401)` in the technical detail, and a
 * "Tekrar dene" button offering to repeat a request that cannot succeed until
 * somebody signs in. Three separate wrongs - a cause misnamed, an internal
 * status code shown to a user, and an action that cannot work - and all three
 * came from treating one branch as the default. So the branch is split here,
 * once, rather than at every call site: an unauthenticated or forbidden answer
 * asks for a session and offers the way in, and everything else stays the
 * retryable error it genuinely is.
 */

import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useLocation } from "react-router";

import { ApiError, SessionExpiredError, describeError } from "@/api/client";
import { ErrorState, Link, SkeletonBlock } from "@/components";
import { loginHref } from "./auth";

export interface QueryBoundaryProps<T> {
  query: UseQueryResult<T>;
  children: (data: T) => ReactNode;
  loadingLabel?: string;
  skeletonLines?: number;
}

/**
 * Does this error mean "there is no session", rather than "something broke"?
 *
 * `403` is included with `401` deliberately. The backend has no role model, so
 * the only way a signed-in reader can be forbidden is by not really being
 * signed in any more; if a role model ever arrives, this is the line that has
 * to be split, and it is one line.
 */
export function isSessionError(error: unknown): boolean {
  if (error instanceof SessionExpiredError) return true;
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

/**
 * The way back in, carrying wherever the reader currently is.
 *
 * Rendered as an in-app link rather than a button that assigns `location`: the
 * login screen is a route in this application, and reloading the document to
 * reach it throws away everything already downloaded.
 */
export function SessionRequired({ what }: { readonly what?: string }) {
  const location = useLocation();
  return (
    <div className="dt-state dt-state--denied" role="alert">
      <h3 className="dt-state__title">Oturum gerekli</h3>
      <p className="dt-state__reason">
        {what ?? "Bu içeriği görüntülemek"} için giriş yapmanız gerekiyor. Oturumunuz sona ermiş
        olabilir.
      </p>
      <div className="dt-state__action">
        <Link to={loginHref(`${location.pathname}${location.search}`)}>Giriş yap</Link>
      </div>
    </div>
  );
}

export function QueryBoundary<T>({
  query,
  children,
  loadingLabel = "Yükleniyor",
  skeletonLines = 4,
}: QueryBoundaryProps<T>) {
  if (query.isPending) {
    return <SkeletonBlock lines={skeletonLines} label={loadingLabel} />;
  }
  if (query.isError) {
    if (isSessionError(query.error)) {
      return <SessionRequired />;
    }
    return (
      <ErrorState
        message={describeError(query.error)}
        detail={query.error instanceof Error ? query.error.message : undefined}
        onRetry={() => void query.refetch()}
      />
    );
  }
  return <>{children(query.data)}</>;
}
