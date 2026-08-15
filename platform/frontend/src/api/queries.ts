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
  demoDecision,
  demoDecisions,
  demoPrograms,
  demoReadiness,
  demoSnapshots,
  endDemoSession,
  isDemoSession,
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
  return () => (isDemoSession() ? Promise.resolve(demo()) : live());
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
      if (!isDemoSession()) return fetchDecision(id);
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

export function useRunEvaluation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () =>
      isDemoSession() ? refuseDemoWrite("Yeniden değerlendirme") : postEvaluation(),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.decisions });
    },
  });
}

export function useSaveProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (fields: Record<string, string>) =>
      isDemoSession()
        ? refuseDemoWrite("Profil kaydı")
        : postForm(AUTH_PATHS.profile, fields),
    onSuccess: () => {
      // The profile itself cannot be read back, but decisions derived from it can.
      void client.invalidateQueries({ queryKey: queryKeys.decisions });
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (fields: { eposta: string; parola: string; organizasyon: string }) =>
      postForm(AUTH_PATHS.register, fields),
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
 */
export function useStartDemo() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (role: DemoRole): Promise<DemoRole> => {
      await postForm(AUTH_PATHS.logout, {});
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
      isDemoSession() ? refuseDemoWrite("Kullanıcı onayı") : postApproval(decisionId, note),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.decision(decisionId) });
    },
  });
}
