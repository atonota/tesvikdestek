/**
 * The cockpit's next-action queue.
 *
 * One row per decision still waiting on the reader, ordered by how many
 * unanswered facts block it. The one page-level primary action (running a
 * fresh evaluation) sits at the top of this section, not floating over the
 * heading - it was overlapping the title at 320px in the previous layout.
 */

import { Button, Link } from "@/foundation";
import { useContent } from "@/content";

export interface CockpitQueueItem {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  readonly to: string;
}

export interface CognitiveNextActionQueueProps {
  readonly items: readonly CockpitQueueItem[];
  readonly onRunEvaluation?: () => void;
  readonly running?: boolean;
  readonly runDisabledReason?: string | null;
}

export function CognitiveNextActionQueue({
  items,
  onRunEvaluation,
  running = false,
  runDisabledReason = null,
}: CognitiveNextActionQueueProps) {
  const title = useContent("cockpit.next_action.aria_label");
  const runningLabel = useContent("cockpit.next_action.running");
  const runLabel = useContent("cockpit.action.run_evaluation");
  const empty = useContent("cockpit.next_action.empty");

  return (
    <section className="cognitive-next-action" aria-label={title}>
      <div className="cognitive-next-action__header">
        <h2>{title}</h2>
        {onRunEvaluation ? (
          <Button
            variant="secondary"
            size="sm"
            disabled={running}
            aria-busy={running}
            onClick={onRunEvaluation}
          >
            {running ? runningLabel : runLabel}
          </Button>
        ) : null}
      </div>

      {runDisabledReason ? <p className="cognitive-next-action__error">{runDisabledReason}</p> : null}

      {items.length === 0 ? <p className="cognitive-next-action__empty">{empty}</p> : (
        <ol className="cognitive-next-action__list">
          {items.map((item) => (
            <li key={item.id} className="cognitive-next-action__item">
              <Link to={item.to} className="cognitive-next-action__title">
                {item.title}
              </Link>
              <p className="cognitive-next-action__detail">{item.detail}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
