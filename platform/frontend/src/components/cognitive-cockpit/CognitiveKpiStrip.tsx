/**
 * The cockpit's top KPI and provenance strip.
 *
 * Every tile is a count over currently loaded records - never a fabricated
 * money figure, never an invented deadline. A metric this screen cannot
 * measure renders an em dash and says why, in the tile itself, right beside
 * the number a reader might otherwise assume is a real zero.
 */

import { useContent } from "@/content";

export interface CockpitKpiTile {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
  readonly unavailableReason?: string | null;
}

export interface CockpitProvenance {
  readonly sourceId: string;
  readonly capturedAt: string;
  readonly ruleVersion: string;
  readonly calibrationStatus: string;
}

export interface CognitiveKpiStripProps {
  readonly tiles: readonly CockpitKpiTile[];
  readonly provenance: CockpitProvenance;
}

export function CognitiveKpiStrip({ tiles, provenance }: CognitiveKpiStripProps) {
  const ariaLabel = useContent("cockpit.kpi.aria_label");
  const sourceIdLabel = useContent("cockpit.kpi.provenance.source_id");
  const capturedAtLabel = useContent("cockpit.kpi.provenance.captured_at");
  const ruleVersionLabel = useContent("cockpit.kpi.provenance.rule_version");
  const calibrationStatusLabel = useContent("cockpit.kpi.provenance.calibration_status");
  return (
    <section className="cognitive-kpi-strip" aria-label={ariaLabel}>
      <ul className="cognitive-kpi-strip__tiles">
        {tiles.map((tile) => (
          <li key={tile.id} className="cognitive-kpi-strip__tile">
            <p className="cognitive-kpi-strip__value">{tile.value}</p>
            <p className="cognitive-kpi-strip__label">{tile.label}</p>
            <p className="cognitive-kpi-strip__hint">
              {tile.unavailableReason ?? tile.hint}
            </p>
          </li>
        ))}
      </ul>
      <dl className="cognitive-kpi-strip__provenance">
        <div>
          <dt>{sourceIdLabel}</dt>
          <dd>{provenance.sourceId}</dd>
        </div>
        <div>
          <dt>{capturedAtLabel}</dt>
          <dd>{provenance.capturedAt}</dd>
        </div>
        <div>
          <dt>{ruleVersionLabel}</dt>
          <dd>{provenance.ruleVersion}</dd>
        </div>
        <div>
          <dt>{calibrationStatusLabel}</dt>
          <dd>{provenance.calibrationStatus}</dd>
        </div>
      </dl>
    </section>
  );
}
