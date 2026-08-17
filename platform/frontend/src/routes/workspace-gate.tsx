/**
 * The workspace's front door — clean-room, W0.
 *
 * Moved out of `routes/app.tsx` so the pathless boundary that guards every
 * `/panel`-adjacent route has a single implementation and does not pull the
 * old visual component system into the clean cockpit's route chain. Behaviour
 * is unchanged from the original gate: the session is *observed*, not
 * asserted, and a static-only build answers from the address bar instead of
 * the network. See the original for the full reasoning; this module carries
 * only what changed — where the surfaces it renders come from.
 */

import { useEffect } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router";

import { ApiError, SessionExpiredError, describeError } from "@/api/client";
import { useDecisionsQuery } from "@/api/queries";
import { CognitiveAuthGate } from "@/components/cognitive-auth";
import {
  DEMO_ROLE_PARAM,
  isStaticDemoOnly,
  parseDemoRole,
  startDemoSession,
  useDemoSession,
  wasDemoEndedHere,
  withDemoRole,
  withoutDemoRole,
} from "@/demo";

/** Same rule `QueryBoundary` uses: an unauthenticated or forbidden read means "no session". */
function isSessionError(error: unknown): boolean {
  if (error instanceof SessionExpiredError) return true;
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

const RETURN_PARAM = "donus";

/** A safe, same-origin path only — never a scheme, a host or a protocol-relative URL. */
function safeReturnPath(value: string | null | undefined): string | null {
  if (typeof value !== "string" || value === "") return null;
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f ]/u.test(value)) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//") || value.startsWith("/\\")) return null;
  return value;
}

function loginHref(returnTo: string | null | undefined): string {
  const safe = safeReturnPath(returnTo);
  return safe === null ? "/giris" : `/giris?${RETURN_PARAM}=${encodeURIComponent(safe)}`;
}

export function WorkspaceGate() {
  return isStaticDemoOnly() ? <StaticDemoGate /> : <ServerSessionGate />;
}

function StaticDemoGate() {
  const location = useLocation();
  const demo = useDemoSession();
  const navigate = useNavigate();

  const roleFromUrl = parseDemoRole(new URLSearchParams(location.search).get(DEMO_ROLE_PARAM));
  const rebuildable = roleFromUrl !== null && !wasDemoEndedHere();

  useEffect(() => {
    if (demo === null) {
      if (rebuildable && roleFromUrl !== null) startDemoSession(roleFromUrl);
      return;
    }
    if (roleFromUrl !== demo.role) {
      void navigate(
        `${location.pathname}${withDemoRole(location.search, demo.role)}${location.hash}`,
        { replace: true },
      );
    }
  }, [demo, location.hash, location.pathname, location.search, navigate, rebuildable, roleFromUrl]);

  if (demo === null) {
    if (rebuildable) {
      return <CognitiveAuthGate state="loading-demo" />;
    }
    return (
      <Navigate
        to={loginHref(`${location.pathname}${withoutDemoRole(location.search)}${location.hash}`)}
        replace
      />
    );
  }

  return <Outlet />;
}

function ServerSessionGate() {
  const location = useLocation();
  const session = useDecisionsQuery();
  const returnTo = `${location.pathname}${location.search}`;

  if (session.isPending) {
    return <CognitiveAuthGate state="loading-session" />;
  }

  if (session.isError && isSessionError(session.error)) {
    return <CognitiveAuthGate state="session-required" loginHref={loginHref(returnTo)} />;
  }

  if (session.isError) {
    return (
      <CognitiveAuthGate
        state="server-error"
        errorMessage={describeError(session.error)}
        errorDetail={session.error instanceof Error ? session.error.message : undefined}
        onRetry={() => void session.refetch()}
      />
    );
  }

  return <Outlet />;
}
