/**
 * The `ContentPort` implementation over static JSON bundles.
 *
 * Bundles are replaced wholesale by `replaceBundles` - the loader's HMR path
 * calls this on every content file save - never mutated entry by entry, so a
 * resolve mid-replacement always sees one consistent generation of content.
 */

import type {
  ContentBundle,
  ContentContext,
  ContentEntry,
  ContentResolveRequest,
  ContentResolveResult,
} from "../types";
import type { ContentPort } from "../ports/ContentPort";

const INTERPOLATION = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/gu;

function interpolate(value: string, values: Readonly<Record<string, string>> | undefined): string {
  if (!values) return value;
  return value.replace(INTERPOLATION, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name) ? values[name]! : match,
  );
}

/**
 * How many of the request's context keys this entry's own context agrees
 * with - the entry's context must never disagree with a key the request
 * actually supplies. Returns `null` when the entry cannot serve this
 * request at all.
 */
function specificity(entry: ContentEntry, context: ContentContext | undefined): number | null {
  const entryContext = entry.context;
  if (!entryContext) return 0;
  const keys = Object.keys(entryContext) as (keyof ContentContext)[];
  let score = 0;
  for (const key of keys) {
    const wanted = entryContext[key];
    if (wanted === undefined) continue;
    if (context?.[key] !== wanted) return null;
    score += 1;
  }
  return score;
}

export class JsonContentAdapter implements ContentPort {
  private bundles: readonly ContentBundle[];

  constructor(bundles: readonly ContentBundle[] = []) {
    this.bundles = bundles;
  }

  replaceBundles(bundles: readonly ContentBundle[]): void {
    this.bundles = bundles;
  }

  private candidates(id: string, locale: string): readonly ContentEntry[] {
    const found: ContentEntry[] = [];
    for (const bundle of this.bundles) {
      if (bundle.locale !== locale) continue;
      for (const entry of bundle.entries) {
        if (entry.id === id && entry.locale === locale) found.push(entry);
      }
    }
    return found;
  }

  resolve(request: ContentResolveRequest): ContentResolveResult {
    const { id, locale, values, context } = request;
    const candidates = this.candidates(id, locale);

    let best: ContentEntry | null = null;
    let bestScore = -1;
    for (const entry of candidates) {
      const score = specificity(entry, context);
      if (score === null) continue;
      if (score > bestScore) {
        best = entry;
        bestScore = score;
      }
    }

    if (!best) {
      return { id, text: id, revision: 0, kind: "text" };
    }

    return {
      id: best.id,
      text: interpolate(best.value, values),
      revision: best.revision,
      kind: best.kind,
    };
  }
}
