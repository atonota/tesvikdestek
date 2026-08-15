"""Safe, allowlist-only rule DSL with three-valued logic.

Two properties matter here, and both are load-bearing:

1. **Rules are data, not code.**  A rule document is parsed into frozen nodes.
   There is no ``eval``, no ``exec``, no ``compile`` and no dynamic import -
   rule documents and official source text are external input.
2. **A missing fact is UNKNOWN, not False.**  Collapsing "we were never told"
   into "no" is the silent failure that tells a company it is ineligible for
   money it could actually have had.
"""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum
from typing import Any

from destektesvik.domain.errors import RuleDefinitionError

ALLOWED_OPERATORS = frozenset({"eq", "in", "gte", "lte", "prefix"})
ALLOWED_COMBINATORS = frozenset({"all", "any", "not"})

#: Operators whose ``value`` is a list of alternatives rather than a scalar.
SET_OPERATORS = frozenset({"in", "prefix"})

_PREDICATE_KEYS = frozenset({"op", "fact", "value", "citation", "label"})


class Truth(StrEnum):
    TRUE = "true"
    FALSE = "false"
    UNKNOWN = "unknown"


@dataclass(frozen=True, slots=True)
class PredicateTrace:
    """Why one condition came out the way it did, with its source citation."""

    fact: str
    operator: str
    expected: Any
    actual: Any
    citation: str
    result: Truth
    label: str = ""


@dataclass(frozen=True, slots=True)
class RuleEvaluation:
    result: Truth
    traces: tuple[PredicateTrace, ...]
    missing_facts: tuple[str, ...]


# --------------------------------------------------------------------------
# Parsed node types
# --------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class Predicate:
    fact: str
    operator: str
    value: Any
    citation: str
    label: str = ""


@dataclass(frozen=True, slots=True)
class AllOf:
    children: tuple["RuleNode", ...]


@dataclass(frozen=True, slots=True)
class AnyOf:
    children: tuple["RuleNode", ...]


@dataclass(frozen=True, slots=True)
class NotNode:
    child: "RuleNode"


RuleNode = Predicate | AllOf | AnyOf | NotNode


# --------------------------------------------------------------------------
# Parsing
# --------------------------------------------------------------------------


def _reject_floats(value: Any) -> None:
    if isinstance(value, float):
        raise RuleDefinitionError(
            "float literals are not allowed in rule documents; use int, str or Decimal"
        )
    if isinstance(value, Mapping):
        raise RuleDefinitionError("rule values may not be mappings")
    if isinstance(value, list | tuple):
        for item in value:
            _reject_floats(item)


def _parse_predicate(document: Mapping[str, Any], allowed_citations: frozenset[str]) -> Predicate:
    unknown_keys = set(document) - _PREDICATE_KEYS
    if unknown_keys:
        raise RuleDefinitionError(f"unknown predicate keys: {sorted(unknown_keys)}")

    operator = document["op"]
    if operator not in ALLOWED_OPERATORS:
        raise RuleDefinitionError(
            f"operator {operator!r} is not in the allowlist {sorted(ALLOWED_OPERATORS)}"
        )

    fact = document.get("fact")
    if not isinstance(fact, str) or not fact:
        raise RuleDefinitionError("a predicate needs a non-empty 'fact' name")

    citation = document.get("citation")
    if not isinstance(citation, str) or not citation:
        raise RuleDefinitionError(
            f"predicate on {fact!r} has no citation; a rule may not rest on an unsourced condition"
        )
    if citation not in allowed_citations:
        raise RuleDefinitionError(
            f"predicate on {fact!r} cites {citation!r}, which is not one of this "
            f"programme's source snapshots {sorted(allowed_citations)}"
        )

    if "value" not in document:
        raise RuleDefinitionError(f"predicate on {fact!r} has no 'value'")
    value = document["value"]
    _reject_floats(value)

    if operator in SET_OPERATORS:
        if not isinstance(value, list | tuple) or not value:
            raise RuleDefinitionError(
                f"operator {operator!r} needs a non-empty list of alternatives"
            )
        value = tuple(value)
    elif isinstance(value, list | tuple):
        raise RuleDefinitionError(f"operator {operator!r} needs a single scalar value")

    label = document.get("label", "")
    if not isinstance(label, str):
        raise RuleDefinitionError("'label' must be a string")

    return Predicate(fact=fact, operator=operator, value=value, citation=citation, label=label)


def parse_rule(document: Any, allowed_citations: "frozenset[str] | set[str]") -> RuleNode:
    """Parse a rule document into frozen nodes, or refuse it.

    ``allowed_citations`` is the set of source snapshot ids the programme
    actually has.  A predicate citing anything else is refused at load time -
    fail closed, not at decision time.
    """
    citations = frozenset(allowed_citations)

    if not isinstance(document, Mapping):
        raise RuleDefinitionError(f"a rule node must be a mapping, got {type(document)!r}")

    if "op" in document:
        return _parse_predicate(document, citations)

    keys = set(document)
    if len(keys) != 1:
        raise RuleDefinitionError(
            f"a combinator node must have exactly one key, got {sorted(keys)}"
        )
    combinator = next(iter(keys))
    if combinator not in ALLOWED_COMBINATORS:
        raise RuleDefinitionError(
            f"combinator {combinator!r} is not in the allowlist {sorted(ALLOWED_COMBINATORS)}"
        )

    payload = document[combinator]
    if combinator == "not":
        return NotNode(child=parse_rule(payload, citations))

    if not isinstance(payload, Sequence) or isinstance(payload, str | bytes) or not payload:
        raise RuleDefinitionError(f"{combinator!r} needs a non-empty list of child nodes")
    children = tuple(parse_rule(child, citations) for child in payload)
    return AllOf(children=children) if combinator == "all" else AnyOf(children=children)


def rule_document(node: RuleNode) -> Any:
    """Round-trip a parsed rule back to a plain document.

    Used for canonical hashing and for showing the user the actual rule that
    was applied.
    """
    if isinstance(node, Predicate):
        document: dict[str, Any] = {
            "op": node.operator,
            "fact": node.fact,
            "value": list(node.value) if isinstance(node.value, tuple) else node.value,
            "citation": node.citation,
        }
        if node.label:
            document["label"] = node.label
        return document
    if isinstance(node, AllOf):
        return {"all": [rule_document(child) for child in node.children]}
    if isinstance(node, AnyOf):
        return {"any": [rule_document(child) for child in node.children]}
    return {"not": rule_document(node.child)}


def referenced_facts(node: RuleNode) -> tuple[str, ...]:
    """Every fact name the rule can ask about, in document order."""
    if isinstance(node, Predicate):
        return (node.fact,)
    if isinstance(node, NotNode):
        return referenced_facts(node.child)
    facts: list[str] = []
    for child in node.children:
        for fact in referenced_facts(child):
            if fact not in facts:
                facts.append(fact)
    return tuple(facts)


# --------------------------------------------------------------------------
# Evaluation
# --------------------------------------------------------------------------

_COMPARABLE = (int, Decimal, date, datetime, str)


def _same_shape(left: Any, right: Any) -> bool:
    """Guard against Python's surprising cross-type comparisons."""
    if isinstance(left, bool) or isinstance(right, bool):
        return isinstance(left, bool) and isinstance(right, bool)
    if isinstance(left, str) != isinstance(right, str):
        return False
    return isinstance(left, datetime) == isinstance(right, datetime)


def _compare(operator: str, actual: Any, expected: Any) -> Truth:
    try:
        if operator == "eq":
            if not _same_shape(actual, expected):
                return Truth.UNKNOWN
            return Truth.TRUE if actual == expected else Truth.FALSE
        if operator == "in":
            # ``in`` is a set of ``eq`` comparisons, so it needs the same guard:
            # without it Python's ``1 == True`` would make a numeric alternative
            # match a boolean fact.  A mismatched alternative simply does not
            # match; it does not poison the whole comparison.
            return (
                Truth.TRUE
                if any(_same_shape(actual, item) and actual == item for item in expected)
                else Truth.FALSE
            )
        if operator == "prefix":
            if not isinstance(actual, str):
                return Truth.UNKNOWN
            return (
                Truth.TRUE
                if any(isinstance(p, str) and actual.startswith(p) for p in expected)
                else Truth.FALSE
            )
        if not isinstance(actual, _COMPARABLE) or not _same_shape(actual, expected):
            return Truth.UNKNOWN
        if isinstance(actual, str) != isinstance(expected, str):
            return Truth.UNKNOWN
        if operator == "gte":
            return Truth.TRUE if actual >= expected else Truth.FALSE
        if operator == "lte":
            return Truth.TRUE if actual <= expected else Truth.FALSE
    except TypeError:
        return Truth.UNKNOWN
    raise RuleDefinitionError(f"unreachable operator {operator!r}")


def _evaluate_node(
    node: RuleNode,
    facts: Mapping[str, Any],
    unusable_citations: frozenset[str],
    traces: list[PredicateTrace],
    missing: list[str],
) -> Truth:
    if isinstance(node, Predicate):
        if node.citation in unusable_citations:
            result = Truth.UNKNOWN
            actual = None
        elif node.fact not in facts or facts[node.fact] is None:
            result = Truth.UNKNOWN
            actual = None
            if node.fact not in missing:
                missing.append(node.fact)
        else:
            actual = facts[node.fact]
            result = _compare(node.operator, actual, node.value)
        traces.append(
            PredicateTrace(
                fact=node.fact,
                operator=node.operator,
                expected=list(node.value) if isinstance(node.value, tuple) else node.value,
                actual=actual,
                citation=node.citation,
                result=result,
                label=node.label,
            )
        )
        return result

    if isinstance(node, NotNode):
        inner = _evaluate_node(node.child, facts, unusable_citations, traces, missing)
        if inner is Truth.UNKNOWN:
            return Truth.UNKNOWN
        return Truth.FALSE if inner is Truth.TRUE else Truth.TRUE

    # Children are always all evaluated - no short circuit - so the user sees
    # the complete trace, not just the first thing that went wrong.
    results = [
        _evaluate_node(child, facts, unusable_citations, traces, missing) for child in node.children
    ]
    if isinstance(node, AllOf):
        if Truth.FALSE in results:
            return Truth.FALSE
        return Truth.UNKNOWN if Truth.UNKNOWN in results else Truth.TRUE
    if Truth.TRUE in results:
        return Truth.TRUE
    return Truth.UNKNOWN if Truth.UNKNOWN in results else Truth.FALSE


def evaluate_rule(
    rule: RuleNode,
    facts: Mapping[str, Any],
    unusable_citations: "frozenset[str] | set[str]" = frozenset(),
) -> RuleEvaluation:
    """Evaluate a parsed rule with Kleene three-valued logic.

    ``unusable_citations`` are snapshot ids that cannot decide anything today -
    for example a source whose effective date is still in the future.  Any
    predicate resting on one of them yields UNKNOWN.
    """
    traces: list[PredicateTrace] = []
    missing: list[str] = []
    result = _evaluate_node(rule, facts, frozenset(unusable_citations), traces, missing)
    return RuleEvaluation(result=result, traces=tuple(traces), missing_facts=tuple(missing))
