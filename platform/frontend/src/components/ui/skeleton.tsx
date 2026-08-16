/**
 * The master skeleton layer — shape first, shimmer second.
 *
 * The product rule this file exists to satisfy is **skeleton shimmer first**:
 * every component's loading state is built before the component itself, and it
 * imitates *that component's* real layout rather than standing in for any
 * component. One grey rectangle is explicitly not enough.
 *
 * The reason is not aesthetic. A skeleton whose shape does not match the loaded
 * content is a layout jump waiting to happen: the reader starts at the top of a
 * three-line placeholder, the real card arrives at six lines with a table in
 * it, and everything they were reading moves. A skeleton that *does* match is
 * the same page, twice, one of them blank - nothing moves when the data lands.
 *
 * Four rules, all enforced by `skeleton-contract.test.tsx`:
 *
 *  1. **The shimmer is a shape, not a rectangle.** `SkeletonText` knows about
 *     line lengths, `SkeletonTable` about columns and rows, `SkeletonChart`
 *     about an axis and bars, `SkeletonForm` about label/field pairs. Each
 *     takes the same density arguments as the component it stands in for.
 *  2. **A skeleton is never read as content.** Every shape is `aria-hidden`.
 *     The *container* carries `role="status"` and one sentence naming what is
 *     loading, so a screen reader hears "Kararlar yükleniyor" once instead of
 *     hearing nothing, or hearing eleven empty list items.
 *  3. **Reduced motion stops the shimmer.** Both carriers: the OS preference
 *     via `motion-reduce:`, and the product's own setting via the
 *     `data-reduced-motion` attribute the appearance store writes on `<html>`.
 *     A shimmer is decorative movement, and decorative movement is exactly what
 *     that preference is about.
 *  4. **It works at 320px.** Every shape is width-relative and wraps; none
 *     declares a fixed pixel width that could push a phone sideways.
 */

import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

/* ------------------------------------------------------------ the shimmer */

/**
 * The single shimmering surface every shape is built from.
 *
 * A moving highlight rather than a pulsing opacity: a pulse reads as "this is
 * disabled" and a sweep reads as "this is arriving", which is the difference
 * the reader is actually being told about.
 *
 * `aria-hidden` is not optional here and is not a prop. A shape that could be
 * announced is a shape that will be, in the one state where the screen has
 * nothing to say yet.
 */
export function Shimmer({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      data-slot="skeleton-shimmer"
      aria-hidden="true"
      className={cn(
        "relative block overflow-hidden rounded-xs bg-muted",
        "before:absolute before:inset-0 before:-translate-x-full",
        "before:animate-[dt-shimmer_1.4s_ease-in-out_infinite]",
        "before:bg-gradient-to-r before:from-transparent before:via-card before:to-transparent",
        // Both carriers of the preference: the operating system's, and the
        // product's own setting, which writes an attribute on <html>.
        "motion-reduce:before:animate-none",
        "[html[data-reduced-motion='true']_&]:before:animate-none",
        className,
      )}
      {...props}
    />
  );
}

/* ---------------------------------------------------------- the container */

export interface SkeletonProps extends ComponentProps<"div"> {
  /**
   * What is loading, in one sentence. Required.
   *
   * This is the only thing a screen reader hears while the shapes are on
   * screen, and "Yükleniyor" alone does not say *what*. A reader who has just
   * pressed a filter needs to know it is the decision list that is coming back.
   */
  readonly label: string;
  readonly children: ReactNode;
}

/**
 * The live region every skeleton shape must sit inside.
 *
 * `role="status"` with `aria-live="polite"` announces the sentence once and
 * does not interrupt; `aria-busy` marks the region as in-progress so assistive
 * technology can skip it rather than walking a tree of empty boxes.
 */
export function Skeleton({ label, className, children, ...props }: SkeletonProps) {
  return (
    <div
      data-slot="skeleton"
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        "flex w-full min-w-0 flex-col gap-2",
        /*
         * The class hook the rest of the package locates a loading state by.
         *
         * Same convention as `dt-btn` and `dt-card`: the appearance comes from
         * the master layer, the `dt-*` name stays so everything already written
         * against it keeps working. `render-app.tsx` waits for `.dt-skeleton`
         * to disappear before a test asserts anything, and without this hook the
         * boot fallback satisfied "loading has finished" while it was still the
         * only thing on screen - thirteen suites then asserted against a page
         * that had not painted yet.
         */
        "dt-skeleton",
        className,
      )}
      {...props}
    >
      <span className="dt-visually-hidden">{label}</span>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------- the shapes */

export interface SkeletonTextProps {
  readonly lines?: number;
  /** The last line is short, as a paragraph's last line is. */
  readonly lastLineWidth?: string;
  readonly className?: string;
}

/** Paragraph copy: full-width lines and a short last one. */
export function SkeletonText({
  lines = 3,
  lastLineWidth = "62%",
  className,
}: SkeletonTextProps) {
  return (
    <span data-slot="skeleton-text" aria-hidden="true" className={cn("block space-y-2", className)}>
      {Array.from({ length: Math.max(1, lines) }, (_, index) => (
        <Shimmer
          key={index}
          className="h-4"
          style={index === lines - 1 ? { inlineSize: lastLineWidth } : undefined}
        />
      ))}
    </span>
  );
}

export interface SkeletonCardProps {
  /** Draws the header row: title block and, optionally, an action. */
  readonly withAction?: boolean;
  readonly lines?: number;
  readonly withFooter?: boolean;
  readonly className?: string;
}

/**
 * A card, shaped like this product's cards.
 *
 * The border, the radius, the padding and the header grid are the real ones -
 * imported nowhere, but written to the same tokens - so the box that appears
 * while loading is the box that stays.
 */
export function SkeletonCard({
  withAction = false,
  lines = 3,
  withFooter = false,
  className,
}: SkeletonCardProps) {
  return (
    <div
      data-slot="skeleton-card"
      aria-hidden="true"
      className={cn(
        "flex w-full min-w-0 flex-col gap-4 rounded-lg border border-border bg-card p-4",
        className,
      )}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <Shimmer className="h-6 w-1/2" />
        {withAction ? <Shimmer className="h-touch w-28 rounded-md" /> : null}
      </div>
      <SkeletonText lines={lines} />
      {withFooter ? (
        <div className="flex flex-wrap gap-2">
          <Shimmer className="h-6 w-24" />
          <Shimmer className="h-6 w-16" />
        </div>
      ) : null}
    </div>
  );
}

export interface SkeletonControlProps {
  /** The control's width, as a Tailwind class. Height is fixed at the target. */
  readonly width?: string;
  readonly className?: string;
}

/**
 * A control: a button, or anything else that has to be reachable by a thumb.
 *
 * Its own shape rather than a bare `Shimmer` because the two claims that matter
 * about a control are its **height** and its **corner**, and a generic bar
 * carries neither. 44px is `--dt-target-touch`, and `rounded-md` is the
 * product's 8px default - so the box that appears while an action bar is
 * loading is the box the buttons will occupy, and the row below it does not
 * move when they arrive.
 */
export function SkeletonControl({ width = "w-40", className }: SkeletonControlProps) {
  /*
   * A shimmer with a control's geometry, and it keeps the shimmer's own
   * `data-slot`. Overriding it to `skeleton-control` was a mistake caught by
   * the contract test: everything that finds a loading shape - the "no shape is
   * announced" assertion, the shape-fidelity counts - looks for
   * `skeleton-shimmer`, so a renamed slot made this shape invisible to all of
   * them while still rendering. The distinguishing marker is a data attribute
   * beside the slot rather than instead of it.
   */
  return (
    <Shimmer data-skeleton="control" className={cn("h-touch rounded-md", width, className)} />
  );
}

export interface SkeletonTabStripProps {
  readonly triggers?: number;
  readonly className?: string;
}

/**
 * A tab strip, drawn as the real `TabsList` draws it.
 *
 * The bordered, muted track is the part a generic placeholder always misses:
 * without it the strip appears to *grow* a background when the data lands, and
 * the panel below shifts by the track's padding. The triggers are at touch
 * height for the same reason the control above is.
 */
export function SkeletonTabStrip({ triggers = 3, className }: SkeletonTabStripProps) {
  const widths = ["w-24", "w-20", "w-20", "w-28", "w-16"];
  return (
    <div
      data-slot="skeleton-tab-strip"
      aria-hidden="true"
      className={cn(
        "flex w-full min-w-0 items-center gap-1 overflow-hidden",
        "rounded-md border border-border bg-muted p-1",
        className,
      )}
    >
      {Array.from({ length: Math.max(1, triggers) }, (_, index) => (
        <Shimmer key={index} className={cn("h-touch shrink-0", widths[index % widths.length])} />
      ))}
    </div>
  );
}

export interface SkeletonTableProps {
  readonly rows?: number;
  readonly columns?: number;
  readonly className?: string;
}

/**
 * A data table, at its real density.
 *
 * Rows are the density token's height, so a "dense" setting produces a dense
 * skeleton. At 320px the product renders tables as cards rather than columns,
 * and this follows: below `sm` the columns collapse to a stacked pair, which is
 * what actually lands.
 */
export function SkeletonTable({ rows = 5, columns = 4, className }: SkeletonTableProps) {
  return (
    <div
      data-slot="skeleton-table"
      aria-hidden="true"
      className={cn("flex w-full min-w-0 flex-col gap-2", className)}
    >
      <div
        className="hidden gap-3 sm:grid"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: columns }, (_, index) => (
          <Shimmer key={index} className="h-5" />
        ))}
      </div>
      {Array.from({ length: Math.max(1, rows) }, (_, row) => (
        <div
          key={row}
          className="grid gap-3 border-t border-border pt-2 sm:[grid-template-columns:var(--skeleton-cols)]"
          style={
            {
              blockSize: "var(--dt-density-row)",
              "--skeleton-cols": `repeat(${columns}, minmax(0, 1fr))`,
            } as React.CSSProperties
          }
        >
          {Array.from({ length: columns }, (_, column) => (
            <Shimmer
              key={column}
              className={cn("h-4 self-center", column > 1 && "hidden sm:block")}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export interface SkeletonChartProps {
  /** Bars for a bar chart; a ring for a doughnut. */
  readonly shape?: "bar" | "pie";
  readonly bars?: number;
  readonly height?: string;
  readonly className?: string;
}

/**
 * A chart, shaped like the chart that replaces it.
 *
 * The bar form draws an axis and bars of varying length; the doughnut form
 * draws a ring and a legend row. Both are the same height as the real figure,
 * which is the whole point - a chart is the tallest thing on an analytics
 * screen and the most disruptive to get wrong.
 */
export function SkeletonChart({
  shape = "bar",
  bars = 4,
  height = "13rem",
  className,
}: SkeletonChartProps) {
  if (shape === "pie") {
    return (
      <div
        data-slot="skeleton-chart"
        aria-hidden="true"
        className={cn("flex w-full min-w-0 flex-col items-center gap-3", className)}
        style={{ blockSize: height }}
      >
        {/* A ring, not a disc: the real figure is a doughnut. `rounded-lg` is
            the product's 12px ceiling, and on a box this large that reads as a
            rounded square - so the ring is drawn with a thick border instead of
            a banned `rounded-full`. */}
        <span className="mt-2 block size-28 rounded-lg border-[14px] border-muted" />
        <div className="flex flex-wrap justify-center gap-2">
          {Array.from({ length: bars }, (_, index) => (
            <Shimmer key={index} className="h-4 w-20" />
          ))}
        </div>
      </div>
    );
  }

  const widths = ["86%", "64%", "48%", "37%", "29%", "22%"];
  return (
    <div
      data-slot="skeleton-chart"
      aria-hidden="true"
      className={cn("flex w-full min-w-0 gap-3", className)}
      style={{ blockSize: height }}
    >
      <div className="flex w-20 shrink-0 flex-col justify-around">
        {Array.from({ length: bars }, (_, index) => (
          <Shimmer key={index} className="h-4" />
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-around border-s border-border ps-3">
        {Array.from({ length: bars }, (_, index) => (
          <Shimmer
            key={index}
            className="h-6 rounded-e-md"
            style={{ inlineSize: widths[index % widths.length] }}
          />
        ))}
      </div>
    </div>
  );
}

export interface SkeletonFormProps {
  readonly fields?: number;
  readonly columns?: 1 | 2;
  readonly withSubmit?: boolean;
  readonly className?: string;
}

/** Label-and-field pairs at the form's real column count, plus its submit bar. */
export function SkeletonForm({
  fields = 4,
  columns = 1,
  withSubmit = true,
  className,
}: SkeletonFormProps) {
  return (
    <div
      data-slot="skeleton-form"
      aria-hidden="true"
      className={cn("flex w-full min-w-0 flex-col gap-4", className)}
    >
      <div className={cn("grid gap-4", columns === 2 && "sm:grid-cols-[repeat(2,minmax(0,1fr))]")}>
        {Array.from({ length: Math.max(1, fields) }, (_, index) => (
          <div key={index} className="flex min-w-0 flex-col gap-2">
            <Shimmer className="h-4 w-32" />
            <Shimmer className="h-touch w-full rounded-md" />
          </div>
        ))}
      </div>
      {withSubmit ? <Shimmer className="h-touch w-40 rounded-md" /> : null}
    </div>
  );
}

export interface SkeletonMediaProps {
  readonly items?: number;
  readonly className?: string;
}

/** A media grid: square thumbnails with a caption line under each. */
export function SkeletonMedia({ items = 6, className }: SkeletonMediaProps) {
  return (
    <div
      data-slot="skeleton-media"
      aria-hidden="true"
      className={cn(
        "grid w-full min-w-0 gap-3",
        "[grid-template-columns:repeat(auto-fill,minmax(8rem,1fr))]",
        className,
      )}
    >
      {Array.from({ length: Math.max(1, items) }, (_, index) => (
        <div key={index} className="flex min-w-0 flex-col gap-2">
          <Shimmer className="aspect-square w-full rounded-md" />
          <Shimmer className="h-4 w-3/4" />
        </div>
      ))}
    </div>
  );
}

export interface SkeletonListProps {
  readonly items?: number;
  readonly withAvatar?: boolean;
  readonly className?: string;
}

/** A list of rows, each a leading mark plus two lines of text. */
export function SkeletonList({ items = 4, withAvatar = false, className }: SkeletonListProps) {
  return (
    <div
      data-slot="skeleton-list"
      aria-hidden="true"
      className={cn("flex w-full min-w-0 flex-col gap-3", className)}
    >
      {Array.from({ length: Math.max(1, items) }, (_, index) => (
        <div key={index} className="flex min-w-0 items-start gap-3">
          {withAvatar ? <Shimmer className="size-10 shrink-0 rounded-md" /> : null}
          <span className="flex min-w-0 flex-1 flex-col gap-2">
            <Shimmer className="h-4 w-2/3" />
            <Shimmer className="h-4 w-2/5" />
          </span>
        </div>
      ))}
    </div>
  );
}
