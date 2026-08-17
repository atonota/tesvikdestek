/**
 * Shape-matched loading state for the cognitive opportunity workspace.
 *
 * `variant="list"` mimics the search bar, filter row and card grid;
 * `variant="detail"` mimics the identity card, the documents list and the
 * source cards — never a single grey rectangle standing in for the page.
 */

import { Skeleton, SkeletonCard, SkeletonControl, SkeletonList } from "@/foundation";
import { useContent } from "@/content";

export type OpportunityWorkspaceSkeletonVariant = "list" | "detail";

export interface CognitiveOpportunityWorkspaceSkeletonProps {
  readonly variant: OpportunityWorkspaceSkeletonVariant;
}

export function CognitiveOpportunityWorkspaceSkeleton({
  variant,
}: CognitiveOpportunityWorkspaceSkeletonProps) {
  const label = useContent("opportunity.state.loading.title");

  if (variant === "detail") {
    return (
      <Skeleton
        label={label}
        className="cognitive-opportunity-workspace__skeleton"
        role="status"
        aria-busy="true"
      >
        <SkeletonCard withAction lines={4} />
        <SkeletonList items={3} />
        <SkeletonList items={2} />
      </Skeleton>
    );
  }

  return (
    <Skeleton
      label={label}
      className="cognitive-opportunity-workspace__skeleton"
      role="status"
      aria-busy="true"
    >
      <div className="cognitive-opportunity-workspace__skeleton-controls">
        <SkeletonControl width="w-full" />
        <SkeletonControl width="w-40" />
        <SkeletonControl width="w-40" />
      </div>
      <SkeletonCard withAction lines={2} />
      <SkeletonCard withAction lines={2} />
      <SkeletonCard withAction lines={2} />
    </Skeleton>
  );
}
