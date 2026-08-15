/**
 * TanStack Query wiring. Keys in one place so invalidation is never guesswork.
 *
 * One branch runs through every function below: when a demo session is open,
 * reads are answered by `@/demo` and writes are refused out loud. It lives here
 * rather than in `client.ts` on purpose - `client.ts` is the HTTP boundary, and
 * the honest thing for a demo to do is *not reach* that boundary at all rather
 * than fake a response inside it. A screen cannot tell the difference; an
 * auditor watching the network tab can, and should.
 *
 * The branch is read at call time from module memory, never captured into a
 * hook's closure, so starting or ending a demo takes effect on the next query
 * rather than on the next remount.
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";

import {
  DemoWriteRefusedError,
  StaticDemoOnlyError,
  demoDecision,
  demoDecisions,
  demoPrograms,
  demoReadiness,
  demoSnapshots,
  endDemoSession,
  isDemoSession,
  isStaticDemoOnly,
  startDemoSession,
  type DemoRole,
} from "@/demo";
import {
  AUTH_PATHS,
  fetchDecision,
  fetchDecisions,
  fetchPrograms,
  fetchReadiness,
  fetchSnapshots,
  postApproval,
  postEvaluation,
  postForm,
} from "./client";
import type { Decision, Program, ReadinessHealth, Snapshot } from "./types";

export const queryKeys = {
  programs: ["programs"] as const,
  snapshots: ["snapshots"] as const,
  decisions: ["decisions"] as const,
  decision: (id: string) => ["decisions", id] as const,
  readiness: ["readiness"] as const,
};

/**
 * Answer a read from the demo adapter, or from the network.
 *
 * `demo` is a thunk rather than a value so the demo data is only built when a
 * demo is actually open - and so the check happens when the query runs, not
 * when the hook was declared.
 */
function readOrDemo<T>(demo: () => T, live: () => Promise<T>): () => Promise<T> {
  return () => {
    if (isDemoSession()) return Promise.resolve(demo());
    /*
     * The static publication has no origin to read from, so it does not try.
     *
     * Without this, every read on that build - a public catalogue, a workspace
     * screen whose demo context was lost on reload - becomes a request to a
     * file server that answers 404, and the interface reports a server failure
     * for a server that does not exist. `StaticDemoOnlyError` carries the
     * sentence that says so, and `describeError` already renders it verbatim
     * in the error surface every screen has.
     *
     * The refusal lives here, at the last line before `client.ts`, for the
     * same reason the demo branch does: a guard in a route is a guard one new
     * caller can forget.
     */
    if (isStaticDemoOnly()) return refuseWithoutBackend();
    return live();
  };
}

export function useProgramsQuery(): UseQueryResult<Program[]> {
  return useQuery({
    queryKey: queryKeys.programs,
    queryFn: readOrDemo(demoPrograms, fetchPrograms),
  });
}

export function useSnapshotsQuery(): UseQueryResult<Snapshot[]> {
  return useQuery({
    queryKey: queryKeys.snapshots,
    queryFn: readOrDemo(demoSnapshots, fetchSnapshots),
  });
}

export function useDecisionsQuery(): UseQueryResult<Decision[]> {
  return useQuery({
    queryKey: queryKeys.decisions,
    queryFn: readOrDemo(demoDecisions, fetchDecisions),
  });
}

export function useDecisionQuery(id: string): UseQueryResult<Decision> {
  return useQuery({
    queryKey: queryKeys.decision(id),
    queryFn: () => {
      if (!isDemoSession()) {
        if (isStaticDemoOnly()) return refuseWithoutBackend();
        return fetchDecision(id);
      }
      const found = demoDecision(id);
      // Absent in the demo set is a genuine 404-shaped answer, not an empty
      // decision - the workspace must show "bulunamadı", not a blank record.
      return found === null
        ? Promise.reject(new Error("Karar bulunamadı."))
        : Promise.resolve(found);
    },
    enabled: id.length > 0,
  });
}

export function useReadinessQuery(): UseQueryResult<ReadinessHealth> {
  return useQuery({
    queryKey: queryKeys.readiness,
    queryFn: readOrDemo(demoReadiness, fetchReadiness),
    // Operational health goes stale fast; this panel is meant to be current.
    staleTime: 15_000,
    refetchInterval: 60_000,
  });
}

/**
 * Refuse a write that has no server behind it.
 *
 * Every mutation below routes through this in demo mode. The rejection is a
 * typed error carrying its own Turkish sentence, so the surfaces that already
 * render `describeError(...)` in an alert region show the refusal without a
 * single new error branch per screen.
 */
function refuseDemoWrite(what: string): Promise<never> {
  return Promise.reject(new DemoWriteRefusedError(what));
}

/**
 * The one question every write below asks first.
 *
 * Two refusals, ordered, and the order is the honest one: inside a demo the
 * reason a save did not happen is the demo, and that sentence names what was
 * refused; outside a demo on the static publication the reason is that there
 * is no server at all. Only when neither holds does a write reach the network.
 */
function refusedWrite(what: string): Promise<never> | null {
  if (isDemoSession()) return refuseDemoWrite(what);
  if (isStaticDemoOnly()) return refuseWithoutBackend();
  return null;
}

export function useRunEvaluation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => refusedWrite("Yeniden değerlendirme") ?? postEvaluation(),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.decisions });
    },
  });
}

export function useSaveProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (fields: Record<string, string>) =>
      refusedWrite("Profil kaydı") ?? postForm(AUTH_PATHS.profile, fields),
    onSuccess: () => {
      // The profile itself cannot be read back, but decisions derived from it can.
      void client.invalidateQueries({ queryKey: queryKeys.decisions });
    },
  });
}

/**
 * The refusal that stands in for a backend the static build does not have.
 *
 * Placed at the query layer rather than in the route for the same reason the
 * demo read branch is here: this is the last line before `client.ts`, and
 * `client.ts` is the network. A guard in the route would be a guard one new
 * caller can forget, and the thing it is guarding against is a login form on a
 * public static page posting a password into a 404.
 */
function refuseWithoutBackend(): Promise<never> {
  return Promise.reject(new StaticDemoOnlyError());
}

export function useRegister() {
  return useMutation({
    mutationFn: (fields: { eposta: string; parola: string; organizasyon: string }) =>
      isStaticDemoOnly()
        ? refuseWithoutBackend()
        : postForm(AUTH_PATHS.register, fields),
  });
}

/**
 * A real sign-in, which first ends any demo.
 *
 * The order is the contract and it is asserted by test: the demo is dropped
 * *before* the POST leaves, so the request cannot be answered out of demo data
 * and the cache the successful login invalidates cannot still hold demo rows.
 * Ending it in `onSuccess` would leave a window in which a real session and a
 * demo session were both open, and the query layer would have answered from the
 * demo for every read in that window.
 */
export function useLogin() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (fields: { eposta: string; parola: string }) => {
      /*
       * Refused before anything is torn down, and that order matters.
       *
       * On the static build there is no sign-in to perform, so ending a demo
       * and clearing the cache first would drop the visitor out of a working
       * demo in order to fail at something that was never going to happen -
       * a blank workspace as the reward for typing an address.
       */
      if (isStaticDemoOnly()) return refuseWithoutBackend();
      endDemoSession();
      client.clear();
      return postForm(AUTH_PATHS.login, fields);
    },
    onSuccess: () => {
      void client.invalidateQueries();
    },
  });
}

/**
 * Enter a demo, by first genuinely signing out of whatever session exists.
 *
 * This is the correction to the defect an independent review found, and the
 * reasoning is worth keeping because the wrong version looked more honest than
 * the right one.
 *
 * Authentication is an httpOnly cookie. This code cannot read it, cannot see
 * whether one is present, and - crucially - opening a demo does not disturb it.
 * The first version sent no request at all on demo entry, on the principle that
 * a demo has no server session to create. True, and beside the point: it may
 * have a server session to *destroy*. A signed-in operator who walked to
 * `/giris`, clicked a demo card, looked around and left the demo was left with
 * their real cookie intact, so `/panel` served their real tenant's data - and
 * the interface had just spent five minutes labelling everything "Demo".
 *
 * So the demo starts with a real `POST /cikis`: the same endpoint, the same
 * CSRF token, the same effect as pressing Çıkış. Nothing is simulated. If there
 * was a session it is now gone; if there was not, the backend answers the same
 * way and the demo proceeds. Only on success does the demo state exist.
 *
 * The order inside `mutationFn` is deliberate and asserted by test:
 *
 *   1. `await` the logout      - nothing local changes until the server has.
 *   2. `client.clear()`        - anything cached was fetched for the identity
 *                                that just ended; a demo must not inherit it.
 *   3. `startDemoSession(role)`- now, and only now, is the demo real.
 *
 * Navigation is the caller's, in `onSuccess`, so a failed logout cannot
 * navigate. A failure leaves no demo session and surfaces its message.
 *
 * The static build is the one exception, and it is an exception on a fact
 * rather than on a preference. `VITE_STATIC_DEMO_ONLY=true` is set by exactly
 * one build, the GitHub Pages one, which is served by a file server with no
 * FastAPI process behind it. There is provably no cookie for that origin to
 * have issued and provably no endpoint to send the sign-out to: the request
 * would 404, the mutation would reject, and demo entry - the only thing that
 * works on that publication - would fail for a reason no visitor could act on.
 * So the guard is *not* "skip the logout when it is inconvenient"; it is "skip
 * the logout in the one deployment where there is nothing it could close". The
 * ordinary build is untouched and `demo-login.test.tsx` asserts that both ways
 * round.
 *
 * This is the single call site that reads the flag on the demo path, and it is
 * read here rather than at module load so the two deployments are separable in
 * one test process.
 */
export function useStartDemo() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (role: DemoRole): Promise<DemoRole> => {
      if (!isStaticDemoOnly()) await postForm(AUTH_PATHS.logout, {});
      client.clear();
      startDemoSession(role);
      return role;
    },
  });
}

/**
 * Leaving, by either door.
 *
 * The demo branch sends nothing, and that is now a *derived* fact rather than a
 * principle: `useStartDemo` already closed the server session on the way in, so
 * there is nothing left for a second `POST /cikis` to do. A request that cannot
 * change anything is not caution, it is noise - and here it would also be a
 * request sent on behalf of a session this browser no longer has.
 *
 * The cache is cleared on both paths, which is what stops demo rows from being
 * the first thing the next visitor sees.
 */
export function useLogout() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<void> => {
      if (isDemoSession()) {
        endDemoSession();
        return;
      }
      /*
       * The static publication has no session to close and no endpoint to
       * close it at. Reaching `POST /cikis` there would be a request into a
       * 404 on the one action a visitor takes to *stop* trusting the page.
       */
      if (isStaticDemoOnly()) return;
      await postForm(AUTH_PATHS.logout, {});
    },
    onSuccess: () => {
      client.clear();
    },
  });
}

/**
 * Record a user approval, and hand back the audit record of that write.
 *
 * The returned `approvedAt` is what the screen shows. It is produced once, by
 * the write, and never by a render - see `test/approval-audit.test.tsx` for the
 * failure that motivated it.
 */
export function useRecordApproval(decisionId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (note: string) =>
      refusedWrite("Kullanıcı onayı") ?? postApproval(decisionId, note),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.decision(decisionId) });
    },
  });
}
