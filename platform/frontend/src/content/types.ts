/**
 * The canonical shape of frontend content: data, not markup.
 *
 * `ContentBundle`/`ContentEntry` are the migration-ready record shape a future
 * PostgreSQL-backed adapter can produce unchanged - stable `id`, `locale`,
 * `namespace`, `revision`, `status` and `source` on every entry, exactly as a
 * `content_entries` table row would carry them. `JsonContentAdapter` is one
 * implementation of `ContentPort` over static JSON; a `PostgresContentAdapter`
 * would implement the same port without any component call site changing.
 */

export type ContentKind = "text" | "html" | "markdown";

export type ContentStatus = "draft" | "published" | "archived";

export interface ContentSource {
  readonly kind: string;
  readonly ref: string;
}

export interface ContentContext {
  readonly role?: string;
  readonly state?: string;
  readonly component?: string;
}

export interface ContentEntry {
  readonly id: string;
  readonly namespace: string;
  readonly locale: string;
  readonly revision: number;
  readonly status: ContentStatus;
  readonly kind: ContentKind;
  readonly value: string;
  readonly variables?: readonly string[];
  readonly source: ContentSource;
  readonly context?: ContentContext;
}

export interface ContentBundle {
  readonly schemaVersion: 1;
  readonly namespace: string;
  readonly locale: string;
  readonly revision: number;
  readonly status: ContentStatus;
  readonly source: ContentSource;
  readonly entries: readonly ContentEntry[];
}

export interface ContentResolveRequest {
  readonly id: string;
  readonly locale: string;
  readonly values?: Readonly<Record<string, string>>;
  readonly context?: ContentContext;
}

export interface ContentResolveResult {
  readonly id: string;
  readonly text: string;
  readonly revision: number;
  readonly kind: ContentKind;
}

export type EcaOperator = "eq" | "neq";

export interface ContentRuleCondition {
  readonly path: string;
  readonly operator: EcaOperator;
  readonly value: string;
}

export interface ReplacePatternAction {
  readonly type: "replacePattern";
  readonly pattern: string;
  readonly flags: string;
  readonly replacement: string;
}

export type ContentRuleAction = ReplacePatternAction;

export interface ContentRule {
  readonly id: string;
  readonly contentId: string;
  readonly event: string;
  readonly priority: number;
  readonly conditions: readonly ContentRuleCondition[];
  readonly actions: readonly ContentRuleAction[];
}
