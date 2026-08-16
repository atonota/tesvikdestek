/**
 * Deterministic event-condition-action application over resolved content.
 *
 * Rules are plain JSON data - condition lists and a `replacePattern` action -
 * never executable code. Two rules that both match the same `contentId` and
 * `event` at the same `priority` are an authoring mistake, not a case to
 * silently pick one for: this fails closed rather than guessing which rule
 * the author meant to win.
 */

import { compileSafePattern } from "./safe-regex";
import type { ContentContext, ContentRule, ContentRuleCondition } from "../types";

export interface ApplyContentRulesRequest {
  readonly text: string;
  readonly contentId: string;
  readonly event: string;
  readonly context?: ContentContext;
  readonly rules: readonly ContentRule[];
}

function readPath(context: ContentContext | undefined, path: string): string | undefined {
  const record = context as Record<string, string | undefined> | undefined;
  return record?.[path];
}

function conditionMatches(condition: ContentRuleCondition, context: ContentContext | undefined): boolean {
  const actual = readPath(context, condition.path);
  if (condition.operator === "eq") return actual === condition.value;
  return actual !== condition.value;
}

function ruleMatches(rule: ContentRule, contentId: string, event: string, context: ContentContext | undefined): boolean {
  if (rule.contentId !== contentId || rule.event !== event) return false;
  return rule.conditions.every((condition) => conditionMatches(condition, context));
}

export function applyContentRules(request: ApplyContentRulesRequest): string {
  const { text, contentId, event, context, rules } = request;
  const matching = rules.filter((rule) => ruleMatches(rule, contentId, event, context));
  if (matching.length === 0) return text;

  const byPriority = new Map<number, ContentRule[]>();
  for (const rule of matching) {
    const bucket = byPriority.get(rule.priority) ?? [];
    bucket.push(rule);
    byPriority.set(rule.priority, bucket);
  }

  const highestPriority = Math.max(...byPriority.keys());
  const winners = byPriority.get(highestPriority) ?? [];
  if (winners.length > 1) {
    throw new Error(
      `applyContentRules: duplicate (çakışan) rules ${winners.map((rule) => rule.id).join(", ")} share priority ${highestPriority} for "${contentId}"/"${event}".`,
    );
  }

  const [winner] = winners;
  if (!winner) return text;

  let result = text;
  for (const action of winner.actions) {
    const regex = compileSafePattern(action.pattern, action.flags);
    result = result.replace(regex, action.replacement);
  }
  return result;
}
