/**
 * The cockpit's analytics section — an accessible table as ground truth,
 * beside a chart drawn by this package's own adapter.
 *
 * `Distribution`/`CountedSlice` are imported as types only: the plain-data
 * shape the analytics domain layer already produces from loaded decisions,
 * programs and snapshots. No component from `@/components/analytics` is
 * imported here - not `PortfolioAnalytics`, not its `EChart` wrapper. The
 * chart is `CognitiveChartCanvas`, reached through a dynamic `import()` so
 * `echarts` stays out of the eager bundle exactly as it did before, and the
 * table renders unconditionally - if the chart cannot draw, the reader has
 * already seen the numbers.
 */

import { Suspense, lazy, useState } from "react";

import { SkeletonChart } from "@/foundation";
import type { CountedSlice, Distribution } from "@/domain/analytics";
import { useContent } from "@/content";

const CognitiveChartCanvas = lazy(() =>
  import("./CognitiveChartCanvas").then((m) => ({ default: m.CognitiveChartCanvas })),
);

export interface CockpitAnalyticsTab {
  readonly key: string;
  readonly label: string;
  readonly distribution: Distribution;
}

export interface CognitiveAnalyticsPanelProps {
  readonly tabs: readonly CockpitAnalyticsTab[];
  readonly caption: string;
}

/** Reads the tokens a canvas cannot read for itself, once per render. */
function readTokens() {
  const styles = getComputedStyle(document.documentElement);
  const token = (name: string): string => styles.getPropertyValue(name).trim();
  return {
    foreground: token("--fd-color-fg") || "currentColor",
    line: token("--fd-color-line") || "currentColor",
    primary: token("--fd-color-primary") || "currentColor",
    secondary: token("--fd-color-secondary") || "currentColor",
    danger: token("--fd-color-danger") || "currentColor",
    muted: token("--fd-color-fg-muted") || "currentColor",
    candidate: token("--fd-outcome-candidate-line"),
    ineligible: token("--fd-outcome-ineligible-line"),
    conditional: token("--fd-outcome-conditional-line"),
    insufficient: token("--fd-outcome-insufficient-line"),
  };
}

/** The colour behind one slice's tone, falling back to the alternating brand pair. */
function toneColor(tokens: ReturnType<typeof readTokens>, tone: CountedSlice["tone"], index: number): string {
  if (tone === "candidate") return tokens.candidate || tokens.primary;
  if (tone === "ineligible") return tokens.ineligible || tokens.danger;
  if (tone === "conditional") return tokens.conditional || tokens.secondary;
  if (tone === "insufficient") return tokens.insufficient || tokens.muted;
  return index % 2 === 0 ? tokens.primary : tokens.secondary;
}

function TableBody({ distribution }: { readonly distribution: Distribution }) {
  const reading = useContent("cockpit.analytics.table.reading");
  const empty = useContent("cockpit.analytics.table.empty");
  const readFailed = useContent("cockpit.analytics.table.read_failed", {
    values: { reason: distribution.status === "error" ? distribution.reason : "" },
  });

  if (distribution.status === "pending") {
    return (
      <tr>
        <td colSpan={2}>{reading}</td>
      </tr>
    );
  }
  if (distribution.status === "error") {
    return (
      <tr>
        <td colSpan={2}>{readFailed}</td>
      </tr>
    );
  }
  if (distribution.status === "empty") {
    return (
      <tr>
        <td colSpan={2}>{empty}</td>
      </tr>
    );
  }
  return (
    <>
      {distribution.slices.map((slice) => (
        <tr key={slice.key}>
          <th scope="row">{slice.label}</th>
          <td>{slice.count}</td>
        </tr>
      ))}
    </>
  );
}

export function CognitiveAnalyticsPanel({ tabs, caption }: CognitiveAnalyticsPanelProps) {
  const [activeKey, setActiveKey] = useState(tabs[0]?.key ?? "");
  const active = tabs.find((tab) => tab.key === activeKey) ?? tabs[0];
  const distribution = active?.distribution;
  const tokens = readTokens();

  const title = useContent("cockpit.analytics.title");
  const tabsAriaLabel = useContent("cockpit.analytics.tabs_aria_label");
  const decisionColumn = useContent("cockpit.analytics.table.decision_column");

  const bars =
    distribution?.status === "populated"
      ? distribution.slices.map((slice, index) => ({
          label: slice.label,
          value: slice.count,
          color: toneColor(tokens, slice.tone, index),
        }))
      : [];

  return (
    <section className="cognitive-analytics" aria-label={title}>
      <div className="cognitive-analytics__header">
        <h2>{title}</h2>
        <div className="cognitive-analytics__tabs" role="tablist" aria-label={tabsAriaLabel}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={tab.key === active?.key}
              className={["cognitive-analytics__tab", tab.key === active?.key ? "is-active" : null]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setActiveKey(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="cognitive-analytics__body">
        <table className="cognitive-analytics__table">
          <caption>{caption}</caption>
          <thead>
            <tr>
              <th scope="col">{active?.label ?? ""}</th>
              <th scope="col">{decisionColumn}</th>
            </tr>
          </thead>
          <tbody>{distribution ? <TableBody distribution={distribution} /> : null}</tbody>
        </table>

        {bars.length > 0 ? (
          <Suspense fallback={<SkeletonChart shape="bar" bars={bars.length} />}>
            <CognitiveChartCanvas bars={bars} foreground={tokens.foreground} line={tokens.line} />
          </Suspense>
        ) : null}
      </div>
    </section>
  );
}
