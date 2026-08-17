/** Registration and login, driving the SSR form endpoints with a signed token. */

import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

import { describeError } from "@/api/client";
import { useLogin, useRegister, useStartDemo } from "@/api/queries";
import { CognitiveAuthCard } from "@/components/cognitive-auth";
import { DEMO_PROFILES, isStaticDemoOnly, matchDemoProfile } from "@/demo";

/** The query parameter the workspace gate writes when it bounces a visitor. */
export const RETURN_PARAM = "donus";

/** Where a signed-in operator lands when there is nothing to return to. */
export const DEFAULT_LANDING = "/panel";

/**
 * Control characters, plus the raw space and DEL.
 *
 * Written as escapes rather than as literal bytes: a tab inside a character
 * class is invisible in a diff, and this is the one expression in the file
 * where a silently deleted character would widen what may be followed.
 */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u0020\u007f]/u;

/**
 * The one place that decides whether a return path may be followed.
 *
 * An open redirect is the classic way a login screen becomes a phishing tool:
 * the link looks like this product, the credentials are typed into this
 * product, and the very next navigation is somebody else's page wearing the
 * same session. So the rule is allow-list shaped rather than deny-list shaped -
 * a value is followed only when it is unmistakably a path *inside this
 * application*, and everything else, including everything nobody thought of,
 * falls back to the dashboard.
 *
 * Rejected, and why none of these is paranoia:
 *
 *   `panel`             a relative path resolves against wherever the login
 *                       screen happens to be, so it is not a stable target.
 *   `//evil.example`    a scheme-relative URL. It has no scheme and it does
 *                       start with a slash, which is exactly what makes it the
 *                       shape a naive check waves through.
 *   `/\evil.example`    the same trick with a backslash; browsers normalise a
 *                       backslash to a slash in the authority position.
 *   `https://…`, `javascript:…`
 *                       absolute and scheme URLs, refused by the leading-slash
 *                       rule they never satisfy.
 *   a leading tab or newline
 *                       stripped by the browser before the URL is parsed, so
 *                       the value that is actually followed is what remains.
 *
 * The value is returned verbatim when it passes. Re-encoding it here would
 * corrupt a query string that is already correctly encoded.
 */
export function safeReturnPath(value: string | null | undefined): string | null {
  if (typeof value !== "string" || value === "") return null;
  if (CONTROL_CHARACTERS.test(value)) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//") || value.startsWith("/\\")) return null;
  return value;
}

/**
 * The login URL that comes back to where the visitor was going.
 *
 * Lives beside `safeReturnPath` so the parameter name is spelled once. The
 * workspace gate builds this link and this route reads it; a second spelling of
 * `donus` in either place would be a silent, permanent redirect to `/panel`.
 */
export function loginHref(returnTo: string | null | undefined): string {
  const safe = safeReturnPath(returnTo);
  return safe === null ? "/giris" : `/giris?${RETURN_PARAM}=${encodeURIComponent(safe)}`;
}

export function RegisterRoute() {
  const register = useRegister();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  return (
    <CognitiveAuthCard
      mode="register"
      staticDemoOnly={isStaticDemoOnly()}
      submitting={register.isPending}
      error={error}
      onSubmit={(values) => {
        setError(null);
        register.mutate(values, {
          onSuccess: () => void navigate("/giris?kayit=tamam"),
          onError: (cause) => setError(describeError(cause)),
        });
      }}
    />
  );
}

export function LoginRoute() {
  const login = useLogin();
  const startDemo = useStartDemo();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  /**
   * Where a successful sign-in lands.
   *
   * Read at submit time from the URL rather than held in state: the parameter
   * is part of the address, and a copy of it would be one more thing that can
   * drift from what the address bar says.
   */
  const returnTo = safeReturnPath(params.get(RETURN_PARAM)) ?? DEFAULT_LANDING;

  return (
    <CognitiveAuthCard
      mode="login"
      staticDemoOnly={isStaticDemoOnly()}
      /*
         * The credential form is busy during a *demo* entry too.
         *
         * Since a printed pair typed into that form opens a demo, the button
         * the visitor actually pressed is the form's - and a submit button
         * that returns to idle while the entry is still in flight invites the
         * second press that races the first.
         */
        submitting={login.isPending || startDemo.isPending}
        error={error}
        demoProfiles={DEMO_PROFILES}
        demoStarting={startDemo.isPending ? startDemo.variables : null}
        onDemoStart={(role) => {
          setError(null);
          /*
           * Entering a demo really signs the browser out first.
           *
           * `useStartDemo` owns that sequence - logout, clear, start - because
           * it has to be one indivisible step: a component that did it in
           * pieces could navigate on a logout that failed, and the visitor
           * would be inside a "demo" while their real cookie was still live.
           * Here the route does only what a route should: it navigates on
           * success and shows the reason on failure.
           */
          startDemo.mutate(role, {
            onSuccess: () => void navigate(returnTo),
            onError: (cause) => setError(describeError(cause)),
          });
        }}
        onSubmit={({ eposta, parola }) => {
          setError(null);
          /*
           * The printed credentials work when they are typed, not only when
           * they are clicked.
           *
           * The screen prints two e-mail addresses and two passwords, and a
           * reviewer does the obvious thing with printed credentials. Before
           * this branch existed that submission went to `POST /giris`, a
           * backend that has never heard of `@demo.destektesvik.local`
           * answered 401, and the form said "E-posta veya parola hatalı."
           * about credentials the card above had just printed as correct.
           *
           * So a matching pair is routed into the *same* mutation the card
           * uses - the same logout-then-start sequence, the same `returnTo` -
           * rather than into a second implementation that could drift from it.
           * `matchDemoProfile` reads `DEMO_PROFILES`, the very list rendered
           * above, so there is one set of credentials on this screen and not
           * two. Everything that does not match falls through untouched: a
           * demo address with a mistyped password is not a demo, and the
           * server, not this branch, is what answers it.
           */
          const demo = matchDemoProfile(eposta, parola);
          if (demo !== null) {
            startDemo.mutate(demo.id, {
              onSuccess: () => void navigate(returnTo),
              onError: (cause) => setError(describeError(cause)),
            });
            return;
          }
          login.mutate(
            { eposta, parola },
            {
              onSuccess: () => void navigate(returnTo),
              onError: (cause) => setError(describeError(cause)),
            },
          );
        }}
      />
  );
}
