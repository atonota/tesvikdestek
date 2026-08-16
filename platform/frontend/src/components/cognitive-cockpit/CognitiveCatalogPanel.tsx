/**
 * The context rail's source and catalog panel.
 *
 * Counts and a short freshness list, both read directly off the loaded
 * programs/decisions/snapshots - never a fabricated per-publisher feed. Each
 * row names a snapshot this client actually has: its publisher, its title and
 * when this browser captured it.
 */

export interface CockpitCatalogCount {
  readonly label: string;
  readonly value: string;
}

export interface CockpitCatalogSource {
  readonly id: string;
  readonly publisher: string;
  readonly title: string;
  readonly capturedAt: string;
}

export interface CognitiveCatalogPanelProps {
  readonly counts: readonly CockpitCatalogCount[];
  readonly sources: readonly CockpitCatalogSource[];
}

import { useContent } from "@/content";

export function CognitiveCatalogPanel({ counts, sources }: CognitiveCatalogPanelProps) {
  const title = useContent("cockpit.catalog.title");
  const empty = useContent("cockpit.catalog.empty");

  return (
    <section className="cognitive-catalog-panel" aria-label={title}>
      <h2>{title}</h2>
      <dl className="cognitive-catalog-panel__counts">
        {counts.map((count) => (
          <div key={count.label}>
            <dt>{count.label}</dt>
            <dd>{count.value}</dd>
          </div>
        ))}
      </dl>
      {sources.length > 0 ? (
        <ul className="cognitive-catalog-panel__sources">
          {sources.map((source) => (
            <li key={source.id}>
              <span className="cognitive-catalog-panel__source-publisher">
                {source.publisher}
              </span>
              <span className="cognitive-catalog-panel__source-title">{source.title}</span>
              <span className="cognitive-catalog-panel__source-time">{source.capturedAt}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="cognitive-catalog-panel__empty">{empty}</p>
      )}
    </section>
  );
}
