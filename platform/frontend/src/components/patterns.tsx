/**
 * Level 3 - state patterns (10).
 *
 * These are the surfaces that show what is *not* there. In this product they
 * carry unusual weight: several capabilities are genuinely half-present, and
 * the difference between "loading", "empty", "you may not", and "the server
 * cannot tell us" is exactly the difference between an honest product and a
 * plausible-looking one.
 */

import { useEffect, useState, type ReactNode } from "react";

import { DISCLAIMER } from "@/domain/outcomes";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/intl";
import { Button } from "./primitives";

/* ----------------------------------------------------------- SkeletonBlock */

export interface SkeletonBlockProps {
  /** Number of shimmer rows. */
  lines?: number;
  /** Announced to screen readers instead of a silent shimmer. */
  label?: string;
  height?: string;
}

/** States: loading only. Always paired with an aria-busy live message. */
export function SkeletonBlock({ lines = 3, label = "Yükleniyor", height }: SkeletonBlockProps) {
  return (
    <div className="dt-skeleton" role="status" aria-live="polite" aria-busy="true">
      <span className="dt-visually-hidden">{label}…</span>
      {Array.from({ length: lines }, (_, index) => (
        <span
          key={index}
          className="dt-skeleton__line"
          style={height ? { height } : undefined}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- EmptyState */

export interface EmptyStateProps {
  title: string;
  /** Why it is empty. Never omitted - "no data" alone is not an explanation. */
  reason: string;
  action?: ReactNode;
  icon?: ReactNode;
}

/** States: informational · actionable. */
export function EmptyState({ title, reason, action, icon }: EmptyStateProps) {
  return (
    <div className="dt-state dt-state--empty">
      {icon ? (
        <span className="dt-state__icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <h3 className="dt-state__title">{title}</h3>
      <p className="dt-state__reason">{reason}</p>
      {action ? <div className="dt-state__action">{action}</div> : null}
    </div>
  );
}

/* --------------------------------------------------------------- ErrorState */

export interface ErrorStateProps {
  title?: string;
  message: string;
  /** Collapsed technical text. No request id is shown - we do not have one. */
  detail?: string | undefined;
  onRetry?: () => void;
}

/** States: message-only · with-detail · retryable. */
export function ErrorState({
  title = "Bir şeyler ters gitti",
  message,
  detail,
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="dt-state dt-state--error" role="alert">
      <h3 className="dt-state__title">{title}</h3>
      <p className="dt-state__reason">{message}</p>
      {detail ? (
        <details className="dt-state__detail">
          <summary>Teknik ayrıntı</summary>
          <pre className="dt-mono">{detail}</pre>
        </details>
      ) : null}
      {onRetry ? (
        <div className="dt-state__action">
          <Button variant="secondary" onClick={onRetry}>
            Tekrar dene
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------- PermissionDenied */

export interface PermissionDeniedProps {
  /** What was attempted, in the user's language. */
  action?: string;
  loginHref?: string;
}

/**
 * States: anonymous · authenticated-but-not-allowed.
 *
 * The way in is a link, not a button that assigns `window.location`.
 *
 * Assigning the location throws away the running application and asks the
 * server for a fresh document, which in a single-page app means the login
 * screen arrives after a full reload rather than a route change - and, worse,
 * the control was a `<button>`, so it could not be opened in a new tab, could
 * not be copied, and told assistive technology it would act rather than
 * navigate. A plain anchor is used rather than the router's `Link` because this
 * pattern is rendered in Storybook and in isolation tests where no router is
 * mounted; the surfaces that live inside the router link to `/giris`
 * themselves.
 */
export function PermissionDenied({
  action = "Bu sayfayı görüntülemek",
  loginHref = "/giris",
}: PermissionDeniedProps) {
  return (
    <div className="dt-state dt-state--denied" role="alert">
      <h3 className="dt-state__title">Oturum gerekli</h3>
      <p className="dt-state__reason">{action} için giriş yapmanız gerekiyor.</p>
      <div className="dt-state__action">
        <a className="dt-btn dt-btn--primary dt-btn--md" href={loginHref}>
          Giriş yap
        </a>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- OfflineBanner */

export interface OfflineBannerProps {
  /** Override for tests; defaults to the live navigator value. */
  forceOffline?: boolean;
  lastUpdated?: string | null;
}

/**
 * Writes are never queued while offline. A silent queue reads as success and
 * then quietly fails, which is worse than refusing the write outright.
 *
 * States: online (hidden) · offline · offline-with-cached-data.
 */
export function OfflineBanner({ forceOffline, lastUpdated }: OfflineBannerProps) {
  // The browser's own connectivity, tracked by subscription only. The override
  // is applied at read time rather than copied into state, so there is no
  // effect writing state back into React on every prop change.
  const [navigatorOffline, setNavigatorOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );

  useEffect(() => {
    const goOnline = () => setNavigatorOffline(false);
    const goOffline = () => setNavigatorOffline(true);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const offline = forceOffline ?? navigatorOffline;

  if (!offline) return null;

  return (
    <div className="dt-banner dt-banner--offline" role="status" aria-live="polite">
      <strong>Çevrimdışı.</strong>{" "}
      {lastUpdated
        ? `Gösterilen veriler ${formatDateTime(lastUpdated)} tarihinde okundu.`
        : "Yeni veri okunamıyor."}{" "}
      Kayıt işlemleri kuyruğa alınmaz; bağlantı gelince tekrar deneyin.
    </div>
  );
}

/* ------------------------------------------------------------ PartialDataNotice */

export interface PartialDataNoticeProps {
  /** Exactly what cannot be read, in plain Turkish. */
  what: string;
  /** The missing backend capability. */
  because: string;
  children?: ReactNode;
}

/**
 * The honest face of the read gaps: the profile can be written but not read,
 * approvals can be recorded but not listed. This notice names the specific
 * field and the specific missing endpoint rather than shrugging.
 *
 * States: always visible where it applies.
 */
export function PartialDataNotice({ what, because, children }: PartialDataNoticeProps) {
  return (
    <aside className="dt-banner dt-banner--partial" data-testid="partial-data">
      <p>
        <strong>Kısmi veri:</strong> {what}
      </p>
      <p className="dt-muted">{because}</p>
      {children}
    </aside>
  );
}

/* -------------------------------------------------------------- StaleDataNotice */

export interface StaleDataNoticeProps {
  isStale: boolean;
  updatedAt?: number | null;
  onRefresh?: () => void;
}

/** States: fresh (hidden) · stale · refreshing. */
export function StaleDataNotice({ isStale, updatedAt, onRefresh }: StaleDataNoticeProps) {
  if (!isStale) return null;
  return (
    <div className="dt-banner dt-banner--stale" role="status">
      <span>
        Bu veriler yenilenmemiş olabilir
        {updatedAt ? ` (son okuma: ${formatDateTime(new Date(updatedAt).toISOString())})` : ""}.
      </span>
      {onRefresh ? (
        <Button variant="ghost" size="sm" onClick={onRefresh}>
          Yenile
        </Button>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------- ConfirmDestructive */

export interface ConfirmDestructiveProps {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}

/** States: idle · busy. Rendered inside a Dialog by the caller. */
export function ConfirmDestructive({
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
  busy = false,
}: ConfirmDestructiveProps) {
  return (
    <div className="dt-confirm">
      <h3 className="dt-state__title">{title}</h3>
      <p>{body}</p>
      <div className="dt-row">
        <Button variant="danger" onClick={onConfirm} loading={busy}>
          {confirmLabel}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          Vazgeç
        </Button>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- FormSubmitBarrier */

export interface FormSubmitBarrierProps {
  submitting: boolean;
  children: ReactNode;
  /** Announced while the submission is in flight. */
  busyLabel?: string;
}

/**
 * Blocks double submission. The engine writes an append-only decision row per
 * run, so a double-click is not cosmetic - it produces a duplicate record.
 *
 * States: idle · submitting.
 */
export function FormSubmitBarrier({
  submitting,
  children,
  busyLabel = "Gönderiliyor",
}: FormSubmitBarrierProps) {
  return (
    <div className="dt-barrier" aria-busy={submitting}>
      <fieldset disabled={submitting} className="dt-barrier__fieldset">
        {children}
      </fieldset>
      {submitting ? (
        <p role="status" aria-live="polite" className="dt-muted">
          {busyLabel}…
        </p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------- DisclaimerBlock */

export interface DisclaimerBlockProps {
  /** Compact rendering for cards; full rendering for decision pages. */
  variant?: "full" | "compact";
  className?: string;
}

/**
 * The disclaimer, verbatim from the backend constant. Required on every
 * decision surface, and never paraphrased - the wording is the product's legal
 * and ethical boundary, not copy to be improved.
 *
 * States: full · compact.
 */
export function DisclaimerBlock({ variant = "full", className }: DisclaimerBlockProps) {
  return (
    <p
      className={cn("dt-disclaimer", variant === "compact" && "dt-disclaimer--compact", className)}
      data-testid="disclaimer"
    >
      {DISCLAIMER}
    </p>
  );
}
