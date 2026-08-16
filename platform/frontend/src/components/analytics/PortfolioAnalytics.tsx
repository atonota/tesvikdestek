/**
 * The dense analytics section — three distributions, drawn and written.
 *
 * This is the surface `FRONTEND-TECHSTACK.md` reserved ECharts for: "dense
 * analytics, lazy chunk only". It is reached through `React.lazy` from the
 * route that shows it, so the chart engine is fetched by the person looking at
 * a chart and by nobody else.
 *
 * ## The rule this section is built around
 *
 * **Every figure exists as text before it exists as a picture.** Each panel
 * renders a one-sentence summary, a real `<table>` with the counts, and the
 * canvas last - and the canvas is `aria-hidden` outright, because the sentence
 * and the table already say everything it could. That ordering is not
 * decoration:
 *
 *  - a screen reader gets the numbers, not "graphic";
 *  - the figures survive with images off, with the canvas failing to
 *    initialise, and in the printed page;
 *  - at 320px, where a legend and four axis labels cannot fit legibly, the
 *    table is the primary reading and the chart is the summary.
 *
 * ## What it refuses to draw
 *
 * Four states, and three of them used to be one. A read still in flight, a read
 * that failed and a catalogue that genuinely has no rows are different things,
 * and rendering all three as "okunamadı" reported a failure that had not
 * happened and hid a real, correct measurement behind an imaginary fault. The
 * chart is drawn only in the fourth: an empty chart is a picture of nothing
 * shaped like a picture of something.
 *
 * The loading state belongs to whichever *level* is waiting, and the two are
 * not interchangeable: `AnalyticsSkeleton` stands in for the whole section
 * behind the Suspense boundary, when no card and no tab strip exist yet;
 * `AnalyticsPanelSkeleton` stands in for one panel *inside* them.
 */

import { useMemo } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

import { AnalyticsPanelSkeleton } from "./AnalyticsSkeleton";
import { EChart, type ChartTheme } from "./EChart";
import { describeDistribution, type CountedSlice, type Distribution } from "./model";

export interface PortfolioAnalyticsProps {
  /** Programmes by support type. */
  readonly portfolio: Distribution;
  /** Decisions by outcome. */
  readonly outcomes: Distribution;
  /** Source snapshots by review status. */
  readonly evidence: Distribution;
}

/** The palette a slice takes, by the domain tone it declares. */
function sliceColour(theme: ChartTheme, tone: string | undefined, index: number): string {
  if (tone === "candidate") return theme.outcome.candidate;
  if (tone === "ineligible") return theme.outcome.ineligible;
  if (tone === "conditional") return theme.outcome.conditional;
  if (tone === "insufficient") return theme.outcome.insufficient;
  // No tone: the brand pair, alternating. Parliament blue leads.
  return index % 2 === 0 ? theme.primary : theme.secondary;
}

/** The shared tooltip and legend settings, so three charts read alike. */
function baseOption(theme: ChartTheme, reducedMotion: boolean) {
  return {
    // Motion-first, and the preference is absolute: not a shorter animation,
    // no animation. A canvas transition is decorative movement by definition.
    animation: !reducedMotion,
    animationDuration: 240,
    backgroundColor: "transparent",
    textStyle: { fontFamily: "Roboto Variable, Roboto, sans-serif", color: theme.foreground },
    tooltip: {
      trigger: "item",
      backgroundColor: theme.surface,
      borderColor: theme.line,
      textStyle: { color: theme.foreground },
    },
  };
}

function barOption(slices: readonly CountedSlice[]) {
  return (theme: ChartTheme, reducedMotion: boolean) => ({
    ...baseOption(theme, reducedMotion),
    grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
    xAxis: {
      type: "value",
      minInterval: 1,
      axisLine: { lineStyle: { color: theme.line } },
      axisLabel: { color: theme.muted },
      splitLine: { lineStyle: { color: theme.line } },
    },
    yAxis: {
      type: "category",
      data: slices.map((slice) => slice.label),
      axisLine: { lineStyle: { color: theme.line } },
      axisLabel: { color: theme.foreground },
    },
    series: [
      {
        type: "bar",
        barMaxWidth: 28,
        // 8px, the product's default corner. The bar is a shape in the design
        // system like any other and does not get its own radius scale.
        itemStyle: {
          borderRadius: [0, 8, 8, 0],
          color: (params: { dataIndex: number }) =>
            sliceColour(theme, slices[params.dataIndex]?.tone, params.dataIndex),
        },
        data: slices.map((slice) => slice.count),
      },
    ],
  });
}

function pieOption(slices: readonly CountedSlice[]) {
  return (theme: ChartTheme, reducedMotion: boolean) => ({
    ...baseOption(theme, reducedMotion),
    legend: {
      bottom: 0,
      textStyle: { color: theme.foreground },
      itemWidth: 12,
      itemHeight: 12,
    },
    series: [
      {
        type: "pie",
        // A doughnut rather than a pie: the hole keeps the slice angles
        // comparable without inviting an area comparison the eye is bad at.
        radius: ["45%", "72%"],
        center: ["50%", "44%"],
        avoidLabelOverlap: true,
        label: { show: false },
        itemStyle: { borderColor: theme.surface, borderWidth: 2 },
        data: slices.map((slice, index) => ({
          name: slice.label,
          value: slice.count,
          itemStyle: { color: sliceColour(theme, slice.tone, index) },
        })),
      },
    ],
  });
}

interface PanelProps {
  readonly what: string;
  readonly unit: string;
  readonly distribution: Distribution;
  readonly shape: "bar" | "pie";
  /** What could not be read, named. Only shown in the error state. */
  readonly unreadWhat: string;
  /** What "no rows" means here. Only shown in the genuine-empty state. */
  readonly emptyMeaning: string;
}

/**
 * One distribution, in whichever of its four states it is actually in.
 *
 * The branches are the point of this component, and three of them were one
 * branch before: pending, error and empty all rendered "okunamadı". A request
 * still in flight was reported as a failure, and a catalogue that genuinely had
 * no rows was reported as a fault that had not occurred.
 *
 * In the populated state the order is fixed: summary, table, chart. The table
 * is not a fallback that appears when something fails - it is on screen beside
 * the chart, because the reader who wants the exact number should not have to
 * hover a canvas, and because at 320px it is the more useful of the two.
 */
function DistributionPanel({
  what,
  unit,
  distribution,
  shape,
  unreadWhat,
  emptyMeaning,
}: PanelProps) {
  /**
   * The option builder, held stable until the figures actually change.
   *
   * `EChart` re-applies whatever builder it is handed with
   * `setOption(option, true)`, and the `true` is a full replace: the instance's
   * state is discarded and everything is redrawn. Rebuilding the closure on
   * every render therefore turned any unrelated re-render - a theme toggle, a
   * sibling query settling, a `useState` two levels up - into a complete chart
   * rebuild with no data change behind it.
   *
   * Declared before the branches below, because a hook may not sit after an
   * early return; it yields `null` in the three states that draw no chart.
   * `distribution` is the dependency rather than `distribution.slices`, so the
   * memo is keyed on the same object identity the caller controls.
   */
  const build = useMemo(() => {
    if (distribution.status !== "populated") return null;
    return shape === "bar" ? barOption(distribution.slices) : pieOption(distribution.slices);
  }, [distribution, shape]);

  if (distribution.status === "pending") {
    /*
     * The *panel's* geometry, not the section's.
     *
     * This branch renders inside the card and inside the tab strip that the
     * component below has already drawn. Reusing `AnalyticsSkeleton` here - as
     * the first version did - nested a second card inside the first and put a
     * second tab strip under the real one.
     */
    return <AnalyticsPanelSkeleton shape={shape} label={`${what} yükleniyor`} />;
  }

  if (distribution.status === "error") {
    return (
      <div className="dt-state dt-state--partial" role="status">
        <h3 className="dt-state__title">{unreadWhat}</h3>
        <p className="dt-state__reason">
          Okunamayan bir kayıt boş bir kayıt değildir, bu yüzden burada sayı yerine bu
          açıklama var. Sunucunun söylediği: {distribution.reason}
        </p>
      </div>
    );
  }

  if (distribution.status === "empty") {
    return (
      <div className="dt-state" role="status">
        <h3 className="dt-state__title">Kayıt yok</h3>
        {/* A measurement, and deliberately worded as one. This is the opposite
            of the branch above, and reading them as the same sentence is the
            defect this component was rewritten to remove. */}
        <p className="dt-state__reason">{emptyMeaning}</p>
      </div>
    );
  }

  const summary = describeDistribution(what, distribution);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{summary}</p>

      {/*
        * The scroll box is the table's own, not the page's.
        *
        * At 320px a three-column table with Turkish headings is wider than the
        * viewport, and the product's standing rule is that the page never
        * scrolls sideways - wide content scrolls inside its own box.
        */}
      <div className="dt-scroll-x">
        <table className="dt-table w-full text-sm">
          <caption className="dt-visually-hidden">{summary}</caption>
          <thead>
            <tr>
              <th scope="col">{unit}</th>
              <th scope="col">Kayıt</th>
              <th scope="col">Pay</th>
            </tr>
          </thead>
          <tbody>
            {distribution.slices.map((slice) => (
              <tr key={slice.key}>
                <th scope="row">{slice.label}</th>
                <td>{slice.count}</td>
                <td>
                  {distribution.total === 0
                    ? "—"
                    : `%${Math.round((slice.count / distribution.total) * 100)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {build === null ? null : (
        <EChart buildOption={build} height={shape === "pie" ? "15rem" : "13rem"} />
      )}
    </div>
  );
}

/**
 * States: each of the three panels is independently pending, unread, empty or
 * populated - a failed source registry does not blank the portfolio beside it.
 */
export function PortfolioAnalytics({
  portfolio,
  outcomes,
  evidence,
}: PortfolioAnalyticsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h2>Teşvik portföyü ve süreç dağılımı</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="portfoy">
          <TabsList aria-label="Analitik görünümleri">
            <TabsTrigger value="portfoy">Portföy</TabsTrigger>
            <TabsTrigger value="sonuc">Sonuç</TabsTrigger>
            <TabsTrigger value="kanit">Kanıt</TabsTrigger>
          </TabsList>

          <TabsContent value="portfoy">
            <DistributionPanel
              what="Destek türüne göre program portföyü"
              unit="Destek türü"
              distribution={portfolio}
              shape="bar"
              unreadWhat="Program kataloğu okunamadı"
              emptyMeaning="Katalogda hiç program yok. Bu bir okuma hatası değil, ölçülmüş bir sonuçtur."
            />
          </TabsContent>

          <TabsContent value="sonuc">
            <DistributionPanel
              what="Ön değerlendirme sonuçlarının dağılımı"
              unit="Sonuç"
              distribution={outcomes}
              shape="pie"
              unreadWhat="Karar listesi okunamadı"
              emptyMeaning="Henüz hiç ön değerlendirme çalıştırılmamış. Sonuç dağılımı ilk değerlendirmeden sonra oluşur."
            />
          </TabsContent>

          <TabsContent value="kanit">
            <DistributionPanel
              what="Kaynak kütüğünün inceleme durumu"
              unit="İnceleme durumu"
              distribution={evidence}
              shape="bar"
              unreadWhat="Kaynak kütüğü okunamadı"
              emptyMeaning="Kütükte hiç kaynak yakalanmamış. Bu bir okuma hatası değil, ölçülmüş bir sonuçtur."
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default PortfolioAnalytics;
