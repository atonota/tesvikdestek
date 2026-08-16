/**
 * The render-time seam: components ask for content through a `ContentPort`,
 * never by importing JSON directly.
 *
 * `ContentRenderer` takes its `port` as a prop, exactly as the contract test
 * exercises it - useful for Storybook fixtures and tests that supply their
 * own adapter. `useContent` is the everyday hook for this app's own
 * components: it defaults to the singleton `contentPort` the loader builds
 * from `src/content/base/**`, and re-renders when a content file hot-reloads.
 */

import { useSyncExternalStore } from "react";

import type { ContentContext } from "./types";
import type { ContentPort } from "./ports/ContentPort";
import { contentPort as defaultContentPort } from "./loaders/json-content-loader";

export interface UseContentOptions {
  readonly locale?: string;
  readonly values?: Readonly<Record<string, string>>;
  readonly context?: ContentContext;
  readonly port?: ContentPort;
}

const DEFAULT_LOCALE = "tr-TR";

/** Plain, non-hook resolution - safe to call at module scope (Storybook fixtures). */
export function resolveContent(id: string, options: UseContentOptions = {}): string {
  const port = options.port ?? defaultContentPort;
  return port.resolve({
    id,
    locale: options.locale ?? DEFAULT_LOCALE,
    ...(options.values ? { values: options.values } : {}),
    ...(options.context ? { context: options.context } : {}),
  }).text;
}

function subscribe(callback: () => void): () => void {
  window.addEventListener("dt-content-updated", callback);
  return () => window.removeEventListener("dt-content-updated", callback);
}

/** Re-renders a component when the content adapter hot-replaces its bundles. */
export function useContent(id: string, options: UseContentOptions = {}): string {
  useSyncExternalStore(subscribe, () => resolveContent(id, options), () => resolveContent(id, options));
  return resolveContent(id, options);
}

export interface ContentRendererProps {
  readonly port: ContentPort;
  readonly id: string;
  readonly locale: string;
  readonly values?: Readonly<Record<string, string>>;
  readonly context?: ContentContext;
}

export function ContentRenderer({ port, id, locale, values, context }: ContentRendererProps) {
  const resolved = port.resolve({
    id,
    locale,
    ...(values ? { values } : {}),
    ...(context ? { context } : {}),
  });
  return <>{resolved.text}</>;
}
