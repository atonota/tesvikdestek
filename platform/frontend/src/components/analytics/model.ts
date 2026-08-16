/**
 * What the analytics section counts, and the four different things it can say.
 *
 * Plain TypeScript with no React and no network, for the same reason the domain
 * layer is: a figure a customer will read about public money should be testable
 * without a renderer.
 *
 * ## Four states, not two
 *
 * The first version of this module had two: a list of slices, or an empty list
 * meaning "the read did not arrive". That collapsed three genuinely different
 * situations into one and told the reader the wrong thing in two of them:
 *
 *   **pending**    the request is in flight. Nothing is known yet, and saying
 *                  "okunamadı" about a request that has not finished is a
 *                  failure report for a failure that has not happened.
 *   **error**      the read failed. The reader must be told, and the figure
 *                  must not be produced - an unread catalogue is not an empty
 *                  catalogue, and this product does not render an unmeasured
 *                  value as a zero.
 *   **empty**      the read succeeded and there genuinely is nothing. "Kayıt
 *                  yok" is a *measurement*, and it is the opposite of the line
 *                  above; showing "okunamadı" here would hide a real, correct,
 *                  reportable state behind an imaginary fault.
 *   **populated**  there are rows. Table and chart.
 *
 * The distinction is the whole reason this is a tagged union rather than an
 * array plus a flag: a caller cannot forget to check, because there is nothing
 * to read until it has narrowed the state.
 */

import type { Decision, Program, Snapshot } from "@/api/types";
import { OUTCOMES, OUTCOME_LABELS, OUTCOME_TOKEN } from "@/domain/outcomes";

export interface CountedSlice {
  readonly key: string;
  readonly label: string;
  readonly count: number;
  /**
   * Which of the four outcome palettes this slice belongs to, if any.
   *
   * `| undefined` rather than only `?`: `exactOptionalPropertyTypes` is on, so
   * an omitted property and one explicitly set to `undefined` are different
   * types, and the outcome mapping below produces the second.
   */
  readonly tone?: "candidate" | "ineligible" | "conditional" | "insufficient" | undefined;
}

/** The four things a distribution can be. Narrow before reading. */
export type Distribution =
  | { readonly status: "pending" }
  | { readonly status: "error"; readonly reason: string }
  | { readonly status: "empty" }
  | {
      readonly status: "populated";
      readonly slices: readonly CountedSlice[];
      readonly total: number;
    };

/**
 * What a caller knows about one read, in the vocabulary the query layer speaks.
 *
 * Deliberately structural rather than a TanStack Query type: this module is
 * plain TypeScript and stays testable without a query client, and the shape is
 * the same three booleans every read in this codebase already exposes.
 */
export interface ReadState<T> {
  readonly isPending: boolean;
  readonly isError: boolean;
  readonly data: readonly T[] | undefined;
  /** Only consulted when `isError`. Never invented. */
  readonly reason: string;
}

/**
 * Turns one read plus a counting function into a distribution.
 *
 * The order of the branches is the contract. `isPending` first, because a
 * request in flight is not a failure; `isError` next, because a failed read
 * has no rows to count and must not fall through to "empty"; then the genuine
 * zero; then the figures.
 */
function fromRead<T>(
  read: ReadState<T>,
  count: (rows: readonly T[]) => readonly CountedSlice[],
): Distribution {
  if (read.isPending) return { status: "pending" };
  if (read.isError || read.data === undefined) {
    return { status: "error", reason: read.reason };
  }
  if (read.data.length === 0) return { status: "empty" };
  return { status: "populated", slices: count(read.data), total: read.data.length };
}

/**
 * Decisions by outcome, in the domain's own order.
 *
 * Every one of the four outcomes appears even at zero. A distribution that
 * silently drops empty categories is a chart that redraws its own axis as the
 * data changes, and a reader comparing two screenshots cannot tell a category
 * that fell to zero from one that was never there.
 */
export function outcomeDistribution(read: ReadState<Decision>): Distribution {
  return fromRead(read, (decisions) =>
    OUTCOMES.map(
      (outcome) =>
        ({
          key: outcome,
          label: OUTCOME_LABELS[outcome],
          count: decisions.filter((decision) => decision.outcome === outcome).length,
          tone: OUTCOME_TOKEN[outcome] as NonNullable<CountedSlice["tone"]>,
        }) satisfies CountedSlice,
    ),
  );
}

/**
 * Programmes by support type — the incentive portfolio.
 *
 * Only the types actually present are listed: unlike the four outcomes, the
 * support-type vocabulary is the backend's and open-ended, so listing every
 * possible value would draw six empty bars beside one real one.
 */
export function portfolioBySupportType(
  read: ReadState<Program>,
  labelFor: (value: string) => string,
): Distribution {
  return fromRead(read, (programs) => countBy(programs.map((p) => p.support_type), labelFor));
}

/**
 * Source snapshots by review status — the evidence pipeline.
 *
 * This is the distribution that decides how much of the catalogue is standing
 * on verified ground, so it is drawn beside the portfolio rather than buried in
 * the source registry: a portfolio of three programmes whose every citation is
 * still pending review is a different product situation from the same three
 * with verified sources, and the two look identical on a programme count.
 */
export function evidenceByReviewStatus(
  read: ReadState<Snapshot>,
  labelFor: (value: string) => string,
): Distribution {
  return fromRead(read, (snapshots) =>
    countBy(snapshots.map((s) => s.review_status), labelFor),
  );
}

/**
 * Counts an open-ended vocabulary, largest first.
 *
 * Only the values actually present are listed. Unlike the four outcomes, the
 * support-type and review-status vocabularies belong to the backend and are
 * open-ended, so listing every possible value would draw six empty bars beside
 * one real one.
 */
function countBy(
  values: readonly string[],
  labelFor: (value: string) => string,
): readonly CountedSlice[] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .map(([key, count]) => ({ key, label: labelFor(key), count }) satisfies CountedSlice)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "tr"));
}

/**
 * The one-sentence summary a screen reader hears before the table.
 *
 * Written rather than generated from the slice list alone, because "3 hibe, 0
 * kredi, 0 garanti" is a list and not a summary; what a reader needs first is
 * the total and the largest share.
 */
export function describeDistribution(what: string, distribution: Distribution): string {
  if (distribution.status === "pending") return `${what} yükleniyor.`;
  if (distribution.status === "error") return `${what} okunamadı.`;
  if (distribution.status === "empty") return `${what}: kayıt yok.`;
  const largest = [...distribution.slices].sort((a, b) => b.count - a.count)[0];
  if (largest === undefined || distribution.total === 0) return `${what}: kayıt yok.`;
  const share = Math.round((largest.count / distribution.total) * 100);
  return `${what}: toplam ${distribution.total} kayıt; en büyük pay ${largest.label} (${largest.count} kayıt, %${share}).`;
}
