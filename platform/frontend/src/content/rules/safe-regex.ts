/**
 * A pattern compiler that fails closed on anything an ECA action's regex
 * could use to hang the browser, before it ever becomes a `RegExp`.
 *
 * Content is data, and data is untrusted: a `replacePattern` action's
 * `pattern` string ultimately comes from a JSON file (today) or a future
 * database row (tomorrow), never from source code review. Three shapes are
 * rejected outright rather than sandboxed - a pattern too long to reason
 * about, a backreference, and nested repetition, the classic catastrophic
 * backtracking shape. Everything else is compiled as a normal `RegExp`.
 */

const MAX_PATTERN_LENGTH = 256;

const BACKREFERENCE = /\\[1-9]/u;

/**
 * Nested repetition inside a group that is itself repeated, e.g. `(a+)+`,
 * `(a*)+`, `(a+)*`, `(a+){20,}` - the shape behind catastrophic backtracking.
 * This does not attempt to parse the full regex grammar; it only looks for a
 * quantifier anywhere inside a group, followed by another quantifier on the
 * group itself. A quantifier is `+`, `*`, `?` or a brace form (`{n}`,
 * `{n,}`, `{n,m}`) - the outer one is what turns an already-repeating group
 * into nested repetition, so every quantifier shape is checked on both sides.
 */
const QUANTIFIER = String.raw`(?:[+*?]|\{\d+(?:,\d*)?\})`;
const NESTED_REPETITION = new RegExp(
  String.raw`\([^()]*${QUANTIFIER}[^()]*\)${QUANTIFIER}`,
  "u",
);

export function compileSafePattern(pattern: string, flags: string): RegExp {
  if (pattern.length > MAX_PATTERN_LENGTH) {
    throw new Error(
      `compileSafePattern: pattern is too long (uzun) - ${pattern.length} exceeds the ${MAX_PATTERN_LENGTH} character limit.`,
    );
  }
  if (BACKREFERENCE.test(pattern)) {
    throw new Error(
      "compileSafePattern: backreference (geri referans) patterns are unsafe (güvenli değil) and are rejected.",
    );
  }
  if (NESTED_REPETITION.test(pattern)) {
    throw new Error(
      "compileSafePattern: nested repeat quantifiers are unsafe (güvenli değil, iç içe tekrar) and are rejected.",
    );
  }
  return new RegExp(pattern, flags);
}
