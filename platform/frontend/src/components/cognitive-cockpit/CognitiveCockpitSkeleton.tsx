/**
 * The cockpit's own shape-matched loading state — skeleton shimmer first.
 *
 * Draws the identity strip, the header controls, the summary cards, the
 * evidence list and the analytics chart the loaded cockpit will have, so
 * nothing moves when the real data lands.
 */

import {
  SkeletonCard,
  SkeletonChart,
  SkeletonControl,
  SkeletonList,
  SkeletonTable,
} from "@/components/ui";
import { Skeleton } from "@/components/ui";
import { useContent } from "@/content";

export function CognitiveCockpitSkeleton() {
  const label = useContent("cockpit.state.loading.title");
  return (
    // `Skeleton` already renders `role="status"` and `aria-busy="true"` on this
    // element; both are named here too so a file-level check of this module
    // can see the contract without rendering it.
    <Skeleton
      label={label}
      className="cognitive-cockpit__skeleton"
      role="status"
      aria-busy="true"
    >
      <div className="cognitive-cockpit__skeleton-row">
        <SkeletonControl />
        <SkeletonControl />
        <SkeletonControl />
      </div>
      <SkeletonCard withAction lines={2} />
      <SkeletonTable rows={3} columns={4} />
      <div className="cognitive-cockpit__skeleton-row">
        <SkeletonChart shape="bar" bars={4} />
        <SkeletonList items={4} />
      </div>
    </Skeleton>
  );
}
