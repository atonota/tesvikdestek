/**
 * The cognitive auth family's own shape-matched loading state.
 *
 * Draws the identity strip, the title, the demo card row and the credential
 * form the loaded screen will have, so nothing moves when content lands.
 */

import { Skeleton, SkeletonCard, SkeletonControl, SkeletonList } from "@/foundation";

export interface CognitiveAuthSkeletonProps {
  readonly label: string;
}

export function CognitiveAuthSkeleton({ label }: CognitiveAuthSkeletonProps) {
  return (
    <Skeleton label={label} className="cognitive-auth__skeleton" role="status" aria-busy="true">
      <div className="cognitive-auth__skeleton-row">
        <SkeletonControl />
      </div>
      <SkeletonCard withAction lines={2} />
      <SkeletonList items={2} />
    </Skeleton>
  );
}
