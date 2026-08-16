/**
 * The seam every renderer and hook depends on instead of a JSON import.
 *
 * A component that only knows `ContentPort` does not know whether the text it
 * receives came from a static JSON file or a future PostgreSQL-backed
 * service - swapping `JsonContentAdapter` for a `PostgresContentAdapter`
 * changes nothing at any call site.
 */

import type { ContentResolveRequest, ContentResolveResult } from "../types";

export interface ContentPort {
  resolve(request: ContentResolveRequest): ContentResolveResult;
}
