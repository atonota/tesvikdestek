/**
 * The clean-room link — React Router for internal paths, a plain anchor
 * (new tab, `rel="noreferrer noopener"`) for anything external.
 *
 * Content-neutral: the "opens in a new tab" note a screen reader hears is a
 * required prop whenever `external` is set, resolved by the caller from
 * `@/content`. There is no default English or Turkish string here.
 */

import type { ComponentProps } from "react";
import { Link as RouterLink } from "react-router";

import { cn } from "@/lib/utils";
import { FoundationIcon } from "./icons";

export interface LinkProps extends Omit<ComponentProps<"a">, "href"> {
  readonly to?: string;
  readonly external?: boolean;
  /** Screen-reader-only note appended when `external` is set — required then. */
  readonly externalIndicatorLabel?: string;
}

export function Link({
  to,
  external = false,
  externalIndicatorLabel,
  children,
  className,
  ...rest
}: LinkProps) {
  if (to && !external) {
    return (
      <RouterLink to={to} className={cn("fd-link", className)} {...rest}>
        {children}
      </RouterLink>
    );
  }
  return (
    <a
      {...rest}
      href={to}
      className={cn("fd-link", className)}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer noopener" : undefined}
    >
      {children}
      {external ? (
        <>
          <FoundationIcon name="externalLink" />
          {externalIndicatorLabel ? (
            <span className="fd-visually-hidden"> {externalIndicatorLabel}</span>
          ) : null}
        </>
      ) : null}
    </a>
  );
}
