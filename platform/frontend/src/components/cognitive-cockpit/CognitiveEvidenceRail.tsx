/**
 * The cockpit's wide contextual rail — next actions and data-status, honest.
 *
 * Clean-room replacement for the old `AdaptiveAssistant`. This package may
 * reuse the *facts* that component used to show - which decisions a rule read,
 * which facts are still unanswered, whether a read is partial - because those
 * are data, not visual design. The markup, classes and layout below are new
 * and belong only to this cockpit.
 *
 * No AI claim is made here that is not true today: `providerReason` is always
 * rendered, and every suggestion's `why` names the loaded record it came from
 * rather than implying a model was asked.
 */

import { Link } from "@/components";
import { Button } from "@/components/ui";
import { AppIcon } from "@/components/icons";
import { useContent } from "@/content";

export interface CockpitEvidenceSuggestion {
  readonly id: string;
  readonly title: string;
  /** Why this was suggested - required, never left implicit. */
  readonly why: string;
  readonly actionLabel: string;
  readonly to?: string;
  readonly onRun?: () => void;
}

export interface CockpitEvidenceStatus {
  readonly label: string;
  /** When this browser last received the data, or null if it never has. */
  readonly lastLoadedAt: string | null;
  readonly missing: readonly string[];
  readonly partial: boolean;
  readonly loading?: boolean;
  readonly error?: string | null;
}

export interface CognitiveEvidenceRailProps {
  readonly suggestions: readonly CockpitEvidenceSuggestion[];
  readonly status: CockpitEvidenceStatus;
  /** Why there is no connected AI provider today - always shown, never hidden. */
  readonly providerReason: string;
}

function MissingFactItem({ fact }: { readonly fact: string }) {
  const suffix = useContent("cockpit.context.missing_suffix");
  return <li>{fact}{suffix}</li>;
}

export function CognitiveEvidenceRail({
  suggestions,
  status,
  providerReason,
}: CognitiveEvidenceRailProps) {
  const title = useContent("cockpit.context.title");
  const empty = useContent("cockpit.context.empty");
  const statusReading = useContent("cockpit.context.status_reading");
  const statusError = useContent("cockpit.context.status_error", {
    values: { error: status.error ?? "" },
  });
  const statusLastRead = useContent("cockpit.context.status_last_read", {
    values: { when: status.lastLoadedAt ? new Date(status.lastLoadedAt).toLocaleString("tr-TR") : "" },
  });
  const partialNote = useContent("cockpit.context.partial");

  const statusSuffix = status.loading
    ? statusReading
    : status.error
      ? statusError
      : status.lastLoadedAt
        ? statusLastRead
        : "";

  return (
    <aside className="cognitive-evidence-rail" aria-label={title}>
      <h2 className="cognitive-evidence-rail__title">{title}</h2>

      {suggestions.length === 0 ? (
        <p className="cognitive-evidence-rail__empty">{empty}</p>
      ) : (
        <ul className="cognitive-evidence-rail__suggestions">
          {suggestions.map((suggestion) => (
            <li key={suggestion.id} className="cognitive-evidence-rail__suggestion">
              <p className="cognitive-evidence-rail__suggestion-title">{suggestion.title}</p>
              <p className="cognitive-evidence-rail__suggestion-why">{suggestion.why}</p>
              {suggestion.to ? (
                <Button variant="ghost" size="sm" asChild>
                  <Link to={suggestion.to}>{suggestion.actionLabel}</Link>
                </Button>
              ) : suggestion.onRun ? (
                <Button variant="ghost" size="sm" onClick={suggestion.onRun}>
                  {suggestion.actionLabel}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <p className="cognitive-evidence-rail__provider-note" role="note">
        <AppIcon name="info" /> {providerReason}
      </p>

      <div className="cognitive-evidence-rail__status" role="status">
        <p>
          {status.label}
          {statusSuffix}
        </p>
        {status.partial ? <p className="cognitive-evidence-rail__partial">{partialNote}</p> : null}
        {status.missing.length > 0 ? (
          <ul className="cognitive-evidence-rail__missing">
            {status.missing.map((fact) => (
              <MissingFactItem key={fact} fact={fact} />
            ))}
          </ul>
        ) : null}
      </div>
    </aside>
  );
}
