/**
 * The cockpit's evidence-gap list: every unanswered fact, and what it blocks.
 *
 * Built from `missing_facts` across the loaded decisions - real fields the
 * engine could not answer, aggregated once per fact. There is no upload or
 * verification pipeline in this product yet, so this list carries exactly one
 * honest status - "yanıtlanmadı" - rather than inventing marked/verified
 * states this backend does not track.
 */

export interface CockpitEvidenceGap {
  readonly fact: string;
  readonly blockedDecisionCount: number;
}

export interface CognitiveEvidenceGapListProps {
  readonly gaps: readonly CockpitEvidenceGap[];
}

import { useContent } from "@/content";

function EvidenceGapItem({ gap }: { readonly gap: CockpitEvidenceGap }) {
  const detail = useContent("cockpit.evidence.blocked_detail", {
    values: { count: String(gap.blockedDecisionCount) },
  });
  const status = useContent("cockpit.evidence.status_unanswered");
  return (
    <li className="cognitive-evidence-gaps__item">
      <span className="cognitive-evidence-gaps__fact">{gap.fact}</span>
      <span className="cognitive-evidence-gaps__detail">{detail}</span>
      <span className="cognitive-evidence-gaps__status">{status}</span>
    </li>
  );
}

export function CognitiveEvidenceGapList({ gaps }: CognitiveEvidenceGapListProps) {
  const title = useContent("cockpit.evidence.title");
  const empty = useContent("cockpit.evidence.empty");

  return (
    <section className="cognitive-evidence-gaps" aria-label={title}>
      <h2>{title}</h2>
      {gaps.length === 0 ? (
        <p className="cognitive-evidence-gaps__empty">{empty}</p>
      ) : (
        <ul className="cognitive-evidence-gaps__list">
          {gaps.map((gap) => (
            <EvidenceGapItem key={gap.fact} gap={gap} />
          ))}
        </ul>
      )}
    </section>
  );
}
