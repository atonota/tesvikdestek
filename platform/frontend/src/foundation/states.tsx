/**
 * The clean-room read-state surfaces: empty, error, offline, partial. Every
 * one names honestly what happened rather than rendering a plausible blank
 * screen — an unread list is never drawn the same as an empty one.
 *
 * Content-neutral: every visible and accessible string is a required prop.
 * Nothing here declares a default label, a fallback title or a hardcoded
 * sentence — the caller resolves all of it from `@/content` and passes the
 * resolved text down, so `json-content-authority-contract.test.ts` finds
 * zero embedded copy in this module.
 */

import { useEffect, useState, type ReactNode } from "react";

import { Button } from "./button";

export interface EmptyStateProps {
  readonly title: string;
  readonly reason: string;
  readonly action?: ReactNode;
}

export function EmptyState({ title, reason, action }: EmptyStateProps) {
  return (
    <div className="fd-state fd-state--empty">
      <h3 className="fd-state__title">{title}</h3>
      <p className="fd-state__reason">{reason}</p>
      {action ? <div className="fd-state__action">{action}</div> : null}
    </div>
  );
}

export interface ErrorStateProps {
  readonly title: string;
  readonly message: string;
  readonly detail?: string | undefined;
  /** Rendered as the collapsed `<summary>` only when `detail` is also given. */
  readonly detailSummaryLabel?: string | undefined;
  readonly onRetry?: () => void;
  /** Rendered on the retry button only when `onRetry` is also given. */
  readonly retryLabel?: string | undefined;
}

export function ErrorState({
  title,
  message,
  detail,
  detailSummaryLabel,
  onRetry,
  retryLabel,
}: ErrorStateProps) {
  return (
    <div className="fd-state fd-state--error" role="alert">
      <h3 className="fd-state__title">{title}</h3>
      <p className="fd-state__reason">{message}</p>
      {detail && detailSummaryLabel ? (
        <details className="fd-state__detail">
          <summary>{detailSummaryLabel}</summary>
          <pre className="fd-mono">{detail}</pre>
        </details>
      ) : null}
      {onRetry && retryLabel ? (
        <div className="fd-state__action">
          <Button variant="secondary" onClick={onRetry}>
            {retryLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export interface PartialDataNoticeProps {
  /** The "kısmi veri" prefix, bold, before `what`. */
  readonly label: string;
  readonly what: string;
  readonly because: string;
  readonly children?: ReactNode;
}

export function PartialDataNotice({ label, what, because, children }: PartialDataNoticeProps) {
  return (
    <aside className="fd-banner fd-banner--partial" data-testid="partial-data">
      <p>
        <strong>{label}</strong> {what}
      </p>
      <p className="fd-muted">{because}</p>
      {children}
    </aside>
  );
}

export interface OfflineBannerProps {
  readonly forceOffline?: boolean;
  /** The bold lead-in, e.g. "Çevrimdışı." */
  readonly label: string;
  /**
   * The rest of the sentence, fully composed by the caller — including any
   * last-read timestamp, already interpolated. This component performs no
   * text composition of its own.
   */
  readonly message: string;
}

export function OfflineBanner({ forceOffline, label, message }: OfflineBannerProps) {
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
    <div className="fd-banner fd-banner--offline" role="status" aria-live="polite">
      <strong>{label}</strong> {message}
    </div>
  );
}
