/**
 * The cockpit's own ECharts adapter — a new, minimal boundary against the
 * installed `echarts` package, not a wrapper around the old analytics
 * subsystem's `EChart` component. Nothing here imports from
 * `@/components/analytics`; the underlying library is the only thing reused.
 *
 * This module is reached only through a dynamic `import()` (see
 * `CognitiveAnalyticsPanel`), so it - and `echarts`/`zrender` behind it - stay
 * in their own lazy chunk. `build-contract.test.ts` proves that chunk exists
 * and that the eager graph carries none of it; this file is what keeps that
 * proof true for the cockpit's own analytics section.
 *
 * The canvas is `aria-hidden`: every caller renders the same figures as a real
 * `<table>` beside it, so a chart that fails to draw - no 2D context, a token
 * missing from the current theme - costs the reader nothing.
 */

import { BarChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { useEffect, useRef } from "react";

echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer]);

function canDrawCanvas(): boolean {
  try {
    const getContext: unknown = document.createElement("canvas").getContext;
    if (typeof getContext !== "function") return false;
    return /\[native code\]/u.test(Function.prototype.toString.call(getContext));
  } catch {
    return false;
  }
}

function prefersNoMotion(): boolean {
  if (document.documentElement.dataset["reducedMotion"] === "true") return true;
  return window.matchMedia?.("(prefers-reduced-motion:reduce)")?.matches === true;
}

export interface CognitiveChartBar {
  readonly label: string;
  readonly value: number;
  /** A resolved CSS colour - the caller reads the token, this file only draws it. */
  readonly color: string;
}

export interface CognitiveChartCanvasProps {
  readonly bars: readonly CognitiveChartBar[];
  readonly foreground: string;
  readonly line: string;
  readonly height?: string;
}

export function CognitiveChartCanvas({
  bars,
  foreground,
  line,
  height = "14rem",
}: CognitiveChartCanvasProps) {
  const container = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<ReturnType<typeof echarts.init> | null>(null);

  const option = {
    animation: !prefersNoMotion(),
    animationDuration: 240,
    backgroundColor: "transparent",
    textStyle: { color: foreground },
    grid: { left: 8, right: 24, top: 8, bottom: 8, containLabel: true },
    tooltip: { trigger: "item" },
    xAxis: { type: "value", axisLine: { lineStyle: { color: line } }, splitLine: { lineStyle: { color: line } } },
    yAxis: {
      type: "category",
      data: bars.map((bar) => bar.label),
      axisLine: { lineStyle: { color: line } },
    },
    series: [
      {
        type: "bar",
        data: bars.map((bar) => ({ value: bar.value, itemStyle: { color: bar.color } })),
      },
    ],
  };

  useEffect(() => {
    const instance = instanceRef.current;
    if (instance === null) return;
    try {
      instance.setOption(option, true);
    } catch {
      /* the table beside it still carries the figures */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(bars), foreground, line]);

  useEffect(() => {
    const node = container.current;
    if (node === null || !canDrawCanvas()) return undefined;

    let chart: ReturnType<typeof echarts.init> | null = null;
    try {
      chart = echarts.init(node, undefined, { renderer: "canvas" });
      chart.setOption(option, true);
    } catch {
      chart?.dispose();
      return undefined;
    }
    instanceRef.current = chart;

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            try {
              chart?.resize();
            } catch {
              /* same reasoning as above */
            }
          });
    resizeObserver?.observe(node);

    return () => {
      resizeObserver?.disconnect();
      chart?.dispose();
      instanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={container}
      className="cognitive-kpi-chart-canvas"
      style={{ height }}
      aria-hidden="true"
    />
  );
}
