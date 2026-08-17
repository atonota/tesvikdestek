/**
 * The cognitive auth gate — the pre-migration states `workspace-gate.tsx`
 * renders: verifying a session, asking an anonymous visitor to sign in, and a
 * server that could not answer at all. Presentational only: the route decides
 * which state applies and passes the retry callback and the already-described
 * error message; this package owns only the frame and the copy.
 */

import type { ReactNode } from "react";

import { useContent } from "@/content";
import { ErrorState, Link } from "@/foundation";

import { CognitiveAuthSkeleton } from "./CognitiveAuthSkeleton";
import { CognitiveAuthSpotlight } from "./CognitiveAuthSpotlight";

import "./cognitive-auth.css";

export type CognitiveAuthGateState = "loading-session" | "loading-demo" | "session-required" | "server-error";

export interface CognitiveAuthGateProps {
  readonly state: CognitiveAuthGateState;
  readonly loginHref?: string;
  readonly errorMessage?: string;
  readonly errorDetail?: string | undefined;
  readonly onRetry?: () => void;
}

function GateFrame({ children }: { readonly children: ReactNode }) {
  return (
    <div className="cognitive-auth" data-cognitive-auth data-mode="gate">
      <CognitiveAuthSpotlight />
      <main id="ana-icerik" className="cognitive-auth__canvas" tabIndex={-1}>
        <div className="cognitive-auth__panel">{children}</div>
      </main>
    </div>
  );
}

export function CognitiveAuthGate({ state, loginHref = "/giris", errorMessage, errorDetail, onRetry }: CognitiveAuthGateProps) {
  const loadingSessionLabel = useContent("auth.gate.loading.session");
  const loadingDemoLabel = useContent("auth.gate.loading.demo");
  const requiredTitle = useContent("auth.gate.session_required.title");
  const requiredReason = useContent("auth.gate.session_required.reason");
  const loginAction = useContent("auth.gate.session_required.login_action");
  const registerAction = useContent("auth.gate.session_required.register_action");
  const errorTitle = useContent("auth.gate.server_error.title");
  const errorHeading = useContent("auth.gate.server_error.heading");
  const errorFootnote = useContent("auth.gate.server_error.footnote");
  const detailSummaryLabel = useContent("auth.gate.server_error.detail_summary");
  const retryLabel = useContent("auth.gate.action.retry");

  if (state === "loading-session" || state === "loading-demo") {
    return (
      <GateFrame>
        <CognitiveAuthSkeleton label={state === "loading-demo" ? loadingDemoLabel : loadingSessionLabel} />
      </GateFrame>
    );
  }

  if (state === "session-required") {
    return (
      <GateFrame>
        <h1 className="cognitive-auth__title">{requiredTitle}</h1>
        <p className="cognitive-auth__lede">{requiredReason}</p>
        <div className="cognitive-auth__gate-actions">
          <Link to={loginHref}>{loginAction}</Link>
          <Link to="/kayit">{registerAction}</Link>
        </div>
      </GateFrame>
    );
  }

  return (
    <GateFrame>
      <h1 className="cognitive-auth__title">{errorTitle}</h1>
      <ErrorState
        title={errorHeading}
        message={errorMessage ?? errorHeading}
        detail={errorDetail}
        detailSummaryLabel={detailSummaryLabel}
        {...(onRetry ? { onRetry, retryLabel } : {})}
      />
      <p className="cognitive-auth__gate-footnote">{errorFootnote}</p>
    </GateFrame>
  );
}
