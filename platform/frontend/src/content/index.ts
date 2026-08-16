/**
 * The public seam for the JSON content authority: everything a component,
 * story or test needs, and nothing that reaches into a JSON file directly.
 */

export type {
  ContentBundle,
  ContentContext,
  ContentEntry,
  ContentKind,
  ContentResolveRequest,
  ContentResolveResult,
  ContentRule,
  ContentRuleAction,
  ContentRuleCondition,
  ContentSource,
  ContentStatus,
  EcaOperator,
  ReplacePatternAction,
} from "./types";

export type { ContentPort } from "./ports/ContentPort";
export { JsonContentAdapter } from "./adapters/JsonContentAdapter";
export { ContentRenderer, resolveContent, useContent } from "./renderer";
export { contentPort } from "./loaders/json-content-loader";
export { applyContentRules } from "./rules/eca";
export { compileSafePattern } from "./rules/safe-regex";
