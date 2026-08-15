/** TanStack Query wiring. Keys in one place so invalidation is never guesswork. */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";

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

export function useProgramsQuery(): UseQueryResult<Program[]> {
  return useQuery({ queryKey: queryKeys.programs, queryFn: fetchPrograms });
}

export function useSnapshotsQuery(): UseQueryResult<Snapshot[]> {
  return useQuery({ queryKey: queryKeys.snapshots, queryFn: fetchSnapshots });
}

export function useDecisionsQuery(): UseQueryResult<Decision[]> {
  return useQuery({ queryKey: queryKeys.decisions, queryFn: fetchDecisions });
}

export function useDecisionQuery(id: string): UseQueryResult<Decision> {
  return useQuery({
    queryKey: queryKeys.decision(id),
    queryFn: () => fetchDecision(id),
    enabled: id.length > 0,
  });
}

export function useReadinessQuery(): UseQueryResult<ReadinessHealth> {
  return useQuery({
    queryKey: queryKeys.readiness,
    queryFn: fetchReadiness,
    // Operational health goes stale fast; this panel is meant to be current.
    staleTime: 15_000,
    refetchInterval: 60_000,
  });
}

export function useRunEvaluation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: postEvaluation,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.decisions });
    },
  });
}

export function useSaveProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (fields: Record<string, string>) => postForm(AUTH_PATHS.profile, fields),
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

export function useLogin() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (fields: { eposta: string; parola: string }) =>
      postForm(AUTH_PATHS.login, fields),
    onSuccess: () => {
      void client.invalidateQueries();
    },
  });
}

export function useLogout() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => postForm(AUTH_PATHS.logout, {}),
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
    mutationFn: (note: string) => postApproval(decisionId, note),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.decision(decisionId) });
    },
  });
}
