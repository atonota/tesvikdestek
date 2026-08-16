/**
 * The clean-room skeleton layer — shape first, shimmer second, matching
 * `skeleton-shimmer-first`: every shape imitates the real content it stands
 * in for rather than a single grey rectangle.
 *
 * Every shape is `aria-hidden`; the container carries `role="status"` and
 * `aria-busy="true"` plus one sentence naming what is loading.
 */

import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Shimmer({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      data-slot="skeleton-shimmer"
      aria-hidden="true"
      className={cn("fd-shimmer", "relative block overflow-hidden", className)}
      {...props}
    />
  );
}

export interface SkeletonProps extends ComponentProps<"div"> {
  /** What is loading, in one sentence — the only thing a screen reader hears. */
  readonly label: string;
  readonly children: ReactNode;
}

export function Skeleton({ label, className, children, ...props }: SkeletonProps) {
  return (
    <div
      data-slot="skeleton"
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn("flex w-full min-w-0 flex-col gap-2", "fd-skeleton", className)}
      {...props}
    >
      <span className="fd-visually-hidden">{label}</span>
      {children}
    </div>
  );
}

export interface SkeletonControlProps {
  readonly width?: string;
  readonly className?: string;
}

export function SkeletonControl({ width = "w-40", className }: SkeletonControlProps) {
  return <Shimmer data-skeleton="control" className={cn("fd-h-touch fd-radius-md", width, className)} />;
}

export interface SkeletonCardProps {
  readonly withAction?: boolean;
  readonly lines?: number;
  readonly className?: string;
}

export function SkeletonCard({ withAction = false, lines = 3, className }: SkeletonCardProps) {
  return (
    <div
      data-slot="skeleton-card"
      aria-hidden="true"
      className={cn("fd-card", "flex w-full min-w-0 flex-col gap-4 p-4", className)}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <Shimmer className="h-5 w-1/2" />
        {withAction ? <Shimmer className="fd-h-touch fd-radius-md w-24" /> : null}
      </div>
      <span className="flex min-w-0 flex-col gap-2">
        {Array.from({ length: Math.max(1, lines) }, (_, index) => (
          <Shimmer key={index} className="h-4" style={{ inlineSize: index === lines - 1 ? "62%" : undefined }} />
        ))}
      </span>
    </div>
  );
}

export interface SkeletonTableProps {
  readonly rows?: number;
  readonly columns?: number;
  readonly className?: string;
}

export function SkeletonTable({ rows = 5, columns = 4, className }: SkeletonTableProps) {
  return (
    <div data-slot="skeleton-table" aria-hidden="true" className={cn("flex w-full min-w-0 flex-col gap-2", className)}>
      <div className="hidden gap-3 sm:grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {Array.from({ length: columns }, (_, index) => (
          <Shimmer key={index} className="h-5" />
        ))}
      </div>
      {Array.from({ length: Math.max(1, rows) }, (_, row) => (
        <div
          key={row}
          className="grid gap-3 border-t fd-border-line pt-2 sm:[grid-template-columns:var(--skeleton-cols)]"
          style={
            {
              blockSize: "var(--fd-density-row)",
              "--skeleton-cols": `repeat(${columns}, minmax(0, 1fr))`,
            } as React.CSSProperties
          }
        >
          {Array.from({ length: columns }, (_, column) => (
            <Shimmer key={column} className={cn("h-4 self-center", column > 1 && "hidden sm:block")} />
          ))}
        </div>
      ))}
    </div>
  );
}

export interface SkeletonListProps {
  readonly items?: number;
  readonly className?: string;
}

export function SkeletonList({ items = 4, className }: SkeletonListProps) {
  return (
    <div data-slot="skeleton-list" aria-hidden="true" className={cn("flex w-full min-w-0 flex-col gap-3", className)}>
      {Array.from({ length: Math.max(1, items) }, (_, index) => (
        <div key={index} className="flex min-w-0 items-start gap-3">
          <span className="flex min-w-0 flex-1 flex-col gap-2">
            <Shimmer className="h-4 w-2/3" />
            <Shimmer className="h-4 w-2/5" />
          </span>
        </div>
      ))}
    </div>
  );
}

export interface SkeletonChartProps {
  readonly shape?: "bar" | "pie";
  readonly bars?: number;
  readonly height?: string;
  readonly className?: string;
}

export function SkeletonChart({ shape = "bar", bars = 4, height = "13rem", className }: SkeletonChartProps) {
  if (shape === "pie") {
    return (
      <div
        data-slot="skeleton-chart"
        aria-hidden="true"
        className={cn("flex w-full min-w-0 flex-col items-center gap-3", className)}
        style={{ blockSize: height }}
      >
        <span className="mt-2 block size-28 fd-radius-lg border-[14px] fd-border-muted" />
        <div className="flex flex-wrap justify-center gap-2">
          {Array.from({ length: bars }, (_, index) => (
            <Shimmer key={index} className="h-4 w-20" />
          ))}
        </div>
      </div>
    );
  }

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
      <div className="flex flex-1 items-end gap-3 border-s fd-border-line ps-3">
        {Array.from({ length: bars }, (_, index) => (
          <Shimmer key={index} className="w-full self-end" style={{ blockSize: `${30 + ((index * 17) % 60)}%` }} />
        ))}
      </div>
    </div>
  );
}
