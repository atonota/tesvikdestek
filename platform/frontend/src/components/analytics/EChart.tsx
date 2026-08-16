/**
 * The ECharts adapter — one place where the chart library touches React.
 *
 * ## Why ECharts is imported the way it is
 *
 * `import * as echarts from "echarts"` pulls every chart type, every component
 * and both renderers: about a megabyte, most of it for charts this product does
 * not draw. That is not a hypothetical - the prototype this repository replaced
 * shipped a 1.59 MB single-file page with ECharts inlined into it, and
 * `FRONTEND-TECHSTACK.md` records "ECharts never enters the main bundle" as a
 * refusal rather than a preference.
 *
 * So the imports are the granular ones ECharts documents: `echarts/core` for
 * the engine, the individual chart and component modules that are actually
 * drawn, and the canvas renderer alone. `use()` registers exactly those. Adding
 * a chart type later is a visible edit here, next to this paragraph.
 *
 * ## Why there is an adapter at all
 *
 * ECharts owns a canvas imperatively and React owns a tree declaratively, and
 * three things go wrong when they meet without a boundary:
 *
 *  - **Disposal.** An instance that is not disposed keeps its canvas, its
 *    animation timers and its listeners alive after the route unmounts. On a
 *    workspace people navigate around all day that is a leak per visit.
 *  - **Resize.** A chart sized once is wrong the moment the assistant rail
 *    appears, the font-scale setting changes, or the phone rotates. A window
 *    listener is not enough - none of those change the window - so this watches
 *    the container with a `ResizeObserver`.
 *  - **Theme.** The two themes are CSS custom properties, and a canvas cannot
 *    read a CSS variable. The values are resolved from the computed style at
 *    draw time and the chart is re-drawn when the theme attribute changes, so
 *    the chart is never the one element still in the light palette.
 *
 * ## What a canvas cannot do
 *
 * It cannot be read. Every caller of this component is required to render the
 * same figures as a table beside it - see `PortfolioAnalytics` - and the canvas
 * itself is `aria-hidden` with the container carrying a role and a name. A
 * chart is a second way to see data that is already available in text, never
 * the only way.
 */

import { BarChart, PieChart } from "echarts/charts";
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { useEffect, useRef } from "react";

echarts.use([BarChart, PieChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer]);

/** The chart palette, read from the design tokens rather than hard-coded. */
export interface ChartTheme {
  readonly foreground: string;
  readonly muted: string;
  readonly line: string;
  readonly surface: string;
  readonly primary: string;
  readonly secondary: string;
  readonly outcome: {
    readonly candidate: string;
    readonly ineligible: string;
    readonly conditional: string;
    readonly insufficient: string;
  };
}

/** Every `--dt-*` custom property this adapter reads a colour from. */
export const REQUIRED_CHART_TOKENS = [
  "--dt-color-fg",
  "--dt-color-fg-muted",
  "--dt-color-line",
  "--dt-color-surface",
  "--dt-color-primary",
  "--dt-color-secondary",
  "--dt-outcome-candidate-line",
  "--dt-outcome-ineligible-line",
  "--dt-outcome-conditional-line",
  "--dt-outcome-insufficient-line",
] as const;

/**
 * Resolves the design tokens a canvas cannot resolve for itself.
 *
 * Read from `<html>`'s computed style, so it answers for whichever theme is
 * currently applied - including the "system" setting, where no attribute is
 * present and the media query decides.
 *
 * There is no built-in colour here, not even as a fallback. A hard-coded hex
 * value that merely *mirrors* a token is still a hard-coded hex value: it
 * silently agrees with `tokens.css` today and silently disagrees with it the
 * day the token changes and this file is not part of that edit. So a missing
 * token is not papered over - it is a defect this function reports by name.
 * Every caller already sits inside a try/catch (drawing is best-effort; the
 * table beside the chart carries the real figures either way), so throwing
 * here reaches exactly the same "this chart quietly does not draw" outcome
 * as before, without a colour this file was never meant to own.
 */
export function readChartTheme(): ChartTheme {
  const styles = getComputedStyle(document.documentElement);
  const missing: string[] = [];
  const token = (name: string): string => {
    const value = styles.getPropertyValue(name).trim();
    if (!value) missing.push(name);
    return value;
  };
  const theme: ChartTheme = {
    foreground: token("--dt-color-fg"),
    muted: token("--dt-color-fg-muted"),
    line: token("--dt-color-line"),
    surface: token("--dt-color-surface"),
    primary: token("--dt-color-primary"),
    secondary: token("--dt-color-secondary"),
    outcome: {
      candidate: token("--dt-outcome-candidate-line"),
      ineligible: token("--dt-outcome-ineligible-line"),
      conditional: token("--dt-outcome-conditional-line"),
      insufficient: token("--dt-outcome-insufficient-line"),
    },
  };
  if (missing.length > 0) {
    throw new Error(
      `EChart: tokens.css değeri eksik — ${missing.join(", ")}. Bir grafik, ` +
        ":root üzerinde tanımlı palet token'ları olmadan çizilemez.",
    );
  }
  return theme;
}

/**
 * Whether this environment can give ECharts the 2D context it requires.
 *
 * Asked rather than provoked, and asked *without calling `getContext`*. That
 * call is the honest question in a browser and a mistake under jsdom: jsdom
 * implements the method as a stub that logs "Not implemented:
 * HTMLCanvasElement's getContext() method" through the virtual console, so the
 * previous version printed one line of noise per rendered chart across the
 * whole unit suite - while its own docstring claimed the failure was silent.
 *
 * So what is inspected is whether the method is the *platform's own*. Every
 * browser implements `getContext` natively, and `Function.prototype.toString`
 * on a native method returns a body of `[native code]`; jsdom's is ordinary
 * JavaScript and stringifies to its own source. That distinction is exactly the
 * question being asked - "is there a real canvas implementation here?" - and
 * reading a function's source has no side effects.
 *
 * A real browser that has canvas *disabled* still has the native method and
 * returns `null` from it; ECharts then throws, and the guard around `init`
 * below catches that. Two defences, one for each way this can be absent.
 *
 * Not cached: a test that installs a canvas stub after this module was imported
 * must get the new answer, and the check costs one detached element.
 */
function canDrawCanvas(): boolean {
  try {
    const getContext: unknown = document.createElement("canvas").getContext;
    if (typeof getContext !== "function") return false;
    return /\[native code\]/u.test(Function.prototype.toString.call(getContext));
  } catch {
    return false;
  }
}

/**
 * Whether motion is refused, by either carrier.
 *
 * The operating system's preference and the product's own setting, which the
 * appearance store writes onto `<html>`. ECharts animates on `setOption`, and
 * a canvas animation is exactly the decorative movement that preference is
 * about - so the option carries `animation: false` rather than a shorter
 * duration.
 */
function prefersNoMotion(): boolean {
  if (document.documentElement.dataset["reducedMotion"] === "true") return true;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
}

export interface EChartProps {
  /**
   * Builds the option object from the resolved theme.
   *
   * A function rather than a value, because the option has to be rebuilt when
   * the theme changes and a plain object would carry last theme's colours.
   */
  readonly buildOption: (theme: ChartTheme, reducedMotion: boolean) => Record<string, unknown>;
  readonly className?: string;
  /** CSS height. A canvas with no height renders nothing and reports success. */
  readonly height?: string;
}

export function EChart({ buildOption, className, height = "16rem" }: EChartProps) {
  const container = useRef<HTMLDivElement>(null);
  /**
   * The builder, held in a ref so a new closure on every parent render does not
   * tear down and rebuild the chart instance. Charts are expensive to create
   * and the option is cheap to re-apply.
   *
   * Written in an effect rather than during render. A ref assignment in the
   * render body is a side effect in a pass React may run twice, and the only
   * readers of this ref - the draw, the theme observer, the resize observer -
   * all run after commit, so an effect is early enough for every one of them.
   */
  const builder = useRef(buildOption);
  /**
   * The instance, so a data change can reach a chart that already exists.
   *
   * Holding only the builder was a stale-chart bug: the ref was updated when
   * the data changed, but the effect that draws runs once on mount, so nothing
   * ever called `setOption` again. A dashboard whose figures refetch - which is
   * every dashboard - kept painting the first answer it was given.
   */
  const instanceRef = useRef<ReturnType<typeof echarts.init> | null>(null);
  useEffect(() => {
    builder.current = buildOption;
    const instance = instanceRef.current;
    if (instance === null) return;
    try {
      instance.setOption(buildOption(readChartTheme(), prefersNoMotion()), true);
    } catch {
      /* the table beside it still carries the figures */
    }
  }, [buildOption]);

  useEffect(() => {
    const node = container.current;
    if (node === null) return undefined;

    /*
     * The chart is an enhancement, and it is allowed to be absent.
     *
     * Every caller renders the same figures as a summary sentence and a real
     * table *before* this element, so a canvas that cannot be created costs the
     * reader nothing. What it must never do is take the screen down with it -
     * and it can. ECharts needs a 2D context, and where there is none it fails
     * deep inside zrender (`Cannot set properties of null (setting 'dpr')`)
     * rather than at a documented boundary. The throw happens inside an effect,
     * an effect that throws reaches the route error boundary, and the reader is
     * told "Kokpit açılamadı" because a doughnut could not be drawn.
     *
     * Two defences, in order:
     *
     *  1. **A capability check**, because that is the honest question. jsdom, a
     *     browser with canvas disabled and some hardened corporate builds all
     *     answer `null` here, and asking is cheaper and quieter than provoking
     *     an exception and catching it.
     *  2. **A guard around the whole setup anyway**, because the failure can
     *     also arrive from `setOption` and from `resize`, and a partially
     *     constructed instance still has to be disposed.
     *
     * The failure is silent by design: the information is already on screen in
     * text, and a console error here would fire on every unit test that renders
     * a route.
     */
    if (!canDrawCanvas()) return undefined;

    let chart: ReturnType<typeof echarts.init> | null = null;
    try {
      chart = echarts.init(node, undefined, { renderer: "canvas" });
      chart.setOption(builder.current(readChartTheme(), prefersNoMotion()), true);
    } catch {
      chart?.dispose();
      return undefined;
    }

    const instance = chart;
    instanceRef.current = instance;
    /** Every later call is guarded too; a redraw must not escalate either. */
    const draw = () => {
      try {
        instance.setOption(builder.current(readChartTheme(), prefersNoMotion()), true);
      } catch {
        /* the table beside it still carries the figures */
      }
    };

    /*
     * Re-drawn when the theme changes, watched at its source.
     *
     * `applyAppearance` writes `data-theme` on `<html>`; the "system" setting
     * writes nothing and is answered by the media query instead. Both are
     * observed, because a chart that stays light while the rest of the screen
     * goes dark is the most conspicuous possible failure of a theme.
     */
    const themeObserver = new MutationObserver(draw);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [
        "data-theme",
        "data-font-scale",
        "data-density",
        // The product's own motion switch: a chart that keeps animating after
        // the reader has asked it to stop is the one element still moving.
        "data-reduced-motion",
      ],
    });
    const scheme = window.matchMedia?.("(prefers-color-scheme: dark)");
    scheme?.addEventListener?.("change", draw);
    const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    motion?.addEventListener?.("change", draw);

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            try {
              instance.resize();
            } catch {
              /* same reasoning as `draw` */
            }
          });
    resizeObserver?.observe(node);

    return () => {
      resizeObserver?.disconnect();
      themeObserver.disconnect();
      scheme?.removeEventListener?.("change", draw);
      motion?.removeEventListener?.("change", draw);
      instanceRef.current = null;
      // Without this the canvas, its timers and its listeners survive the
      // unmount - a leak on every visit to a route people open all day.
      instance.dispose();
    };
  }, []);

  return (
    <div
      ref={container}
      /*
       * Genuinely hidden, not named.
       *
       * This element carried `role="img"` with the summary sentence as its
       * label - and every caller already renders that exact sentence as a
       * paragraph and the same figures as a `<table>` immediately above. A
       * screen reader therefore heard the summary twice and then met a graphic
       * it could do nothing with. The table is the canonical reading; the
       * canvas is a second way for a sighted reader to see what is already
       * there, so it is removed from the accessibility tree entirely.
       */
      aria-hidden="true"
      className={className}
      /*
       * `position: relative` is not decoration; it is what keeps the canvas
       * inside the page.
       *
       * ECharts appends its `<canvas>` with `position: absolute`, so the
       * canvas is laid out against its nearest *positioned* ancestor. With this
       * container left `static`, that ancestor was the initial containing
       * block - outside the shell's scrollport - and an absolutely positioned
       * element is only clipped by an `overflow` ancestor that is also its
       * containing block. Measured in Chromium at 320x568: the canvas escaped
       * `.dt-shell__content`, `document.documentElement.scrollHeight` grew from
       * 568 to 1454, the whole bounded frame became scrollable, and scrolling
       * to the end carried the pinned conversion action off the screen.
       *
       * One declaration makes this element the containing block, and the clip
       * applies again.
       */
      style={{ position: "relative", inlineSize: "100%", blockSize: height }}
    />
  );
}
