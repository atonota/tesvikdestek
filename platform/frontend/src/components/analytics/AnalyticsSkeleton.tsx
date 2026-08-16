/**
 * The analytics section's own loading state.
 *
 * Skeleton shimmer first, and this is what the rule actually asks for: not a
 * grey block where a chart will be, but *this* section's geometry - the card,
 * its heading, the three-tab strip, the summary line, the three-column table
 * and the chart, at the same heights they will have when the data lands.
 *
 * What that buys, concretely. The real section at 320px is a card whose content
 * is a tab strip (44px), a summary sentence (two lines), a table of three to
 * five rows and a 13rem chart. A generic six-line block is about 150px. When
 * the data arrived the card grew by roughly 300px and everything the reader had
 * already started reading moved down the page. The shape below does not, so
 * nothing moves.
 *
 * It deliberately does **not** import `EChart` or `PortfolioAnalytics`. This is
 * the module the route renders *while* those are still on the wire, so pulling
 * either would put the chart engine back in front of the Suspense boundary and
 * make the fallback wait for the thing it exists to cover.
 *
 * Accessibility and motion are the master layer's: `Skeleton` is the live
 * region that names what is loading, every shape inside it is `aria-hidden`,
 * and the shimmer stops under both carriers of the reduced-motion preference.
 */

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Shimmer,
  Skeleton,
  SkeletonChart,
  SkeletonTable,
  SkeletonTabStrip,
  SkeletonText,
} from "@/components/ui/skeleton";

export interface AnalyticsPanelSkeletonProps {
  /**
   * Which chart shape is coming.
   *
   * The panel knows which tab it is, so the fallback can be right about the
   * figure that is arriving rather than always guessing a bar - a doughnut is
   * two rem taller, and guessing wrong reintroduces the jump this exists to
   * prevent.
   */
  readonly shape?: "bar" | "pie";
  /** Rows the table will have. Three is the demo catalogue's real size. */
  readonly rows?: number;
  readonly label?: string;
}

/**
 * One panel's loading state — **inside** an existing card and tab strip.
 *
 * This is the distinction the section-level skeleton below cannot make, and
 * getting it wrong is what a review caught: the pending branch of a panel used
 * `AnalyticsSkeleton`, which brought its own `Card` and its own tab strip with
 * it. The result was a second card nested inside the first and a second strip
 * drawn under the real one - two boxes and two strips on screen, and two
 * tablists in one region for a screen reader.
 *
 * So the panel's loading state is exactly the panel's contents: the summary
 * sentence, the three-column table and the chart. Nothing that already exists
 * around it is drawn twice.
 */
export function AnalyticsPanelSkeleton({
  shape = "bar",
  rows = 3,
  label = "Dağılım yükleniyor",
}: AnalyticsPanelSkeletonProps) {
  return (
    <Skeleton label={label} className="gap-3" data-testid="analytics-panel-skeleton">
      {/* The summary sentence, which is two lines at 320px and one on a
          desktop - so two lines with a short second one is right at both. */}
      <SkeletonText lines={2} lastLineWidth="45%" />

      {/* Three columns, because the table has three: unit, count, share. */}
      <SkeletonTable rows={rows} columns={3} />

      <SkeletonChart shape={shape} bars={rows} height={shape === "pie" ? "15rem" : "13rem"} />
    </Skeleton>
  );
}

/**
 * The section-level skeleton takes exactly the panel's arguments.
 *
 * An alias rather than an empty `extends`: the two really are the same set of
 * choices - which chart is coming, how many rows, what to announce - and an
 * interface that declares no members of its own is just a second name for its
 * supertype.
 */
export type AnalyticsSkeletonProps = AnalyticsPanelSkeletonProps;

/**
 * The **whole section's** loading state, for the Suspense boundary.
 *
 * Used only where no card and no tab strip exist yet - that is, while the
 * lazily imported section itself is still on the wire. Here the card, the
 * heading and the strip are part of what is missing, so they are part of what
 * the skeleton draws.
 *
 * States: this component *is* a state. Bar and doughnut variants.
 */
export function AnalyticsSkeleton({
  shape = "bar",
  rows = 3,
  label = "Analitik bölümü yükleniyor",
}: AnalyticsSkeletonProps) {
  return (
    <Card data-testid="analytics-skeleton">
      <CardHeader>
        {/* The card's real title is one line of `text-lg`; 1.75rem covers the
            heading plus its line box, so the tab strip below does not move. */}
        <Shimmer className="h-7 w-3/4 max-w-96" />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <SkeletonTabStrip triggers={3} />
        <AnalyticsPanelSkeleton shape={shape} rows={rows} label={label} />
      </CardContent>
    </Card>
  );
}

export default AnalyticsSkeleton;
