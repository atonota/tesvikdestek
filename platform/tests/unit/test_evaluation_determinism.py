"""Test 1 - the same input, rule version and source version give the same hash.

And when a version moves, the old decision does not.
"""

from datetime import date

from destektesvik.domain.evaluation import EvaluationInput, evaluate
from destektesvik.domain.programs import CallWindow
from destektesvik.domain.rules import parse_rule
from tests.conftest import (
    SNAPSHOT_HASH_A,
    SNAPSHOT_HASH_B,
    TODAY,
    make_profile,
    make_program,
    make_rule_set,
    make_snapshot,
)

CITATIONS = frozenset({"snap-test"})
OPEN_WINDOW = CallWindow(opens_on=date(2026, 1, 1), closes_on=date(2026, 12, 31))


def _rule(version: str = "r1"):
    document = {
        "all": [
            {"op": "eq", "fact": "is_capital_company", "value": True, "citation": "snap-test"},
            {"op": "prefix", "fact": "nace", "value": ["62"], "citation": "snap-test"},
        ]
    }
    return make_rule_set(parse_rule(document, CITATIONS), version=version)


def _input(*, rule_version: str = "r1", content_hash: str = SNAPSHOT_HASH_A) -> EvaluationInput:
    snapshot = make_snapshot(content_hash=content_hash)
    return EvaluationInput(
        profile=make_profile(is_capital_company=True, nace="62.01"),
        program=make_program(call_window=OPEN_WINDOW),
        rule_set=_rule(rule_version),
        snapshots={snapshot.id: snapshot},
        as_of=TODAY,
    )


def test_identical_input_produces_an_identical_decision_hash() -> None:
    first = evaluate(_input())
    second = evaluate(_input())
    assert first.decision_hash == second.decision_hash
    assert first.input_hash == second.input_hash
    assert len(first.decision_hash) == 64


def test_hashes_are_not_placeholders() -> None:
    result = evaluate(_input())
    assert result.decision_hash not in {"", "stub"}
    assert result.input_hash not in {"", "stub"}
    assert result.decision_hash != result.input_hash


def test_a_new_rule_version_produces_a_new_decision_hash() -> None:
    old = evaluate(_input(rule_version="r1"))
    new = evaluate(_input(rule_version="r2"))
    assert old.decision_hash != new.decision_hash


def test_a_changed_source_content_hash_produces_a_new_decision_hash() -> None:
    old = evaluate(_input(content_hash=SNAPSHOT_HASH_A))
    new = evaluate(_input(content_hash=SNAPSHOT_HASH_B))
    assert old.decision_hash != new.decision_hash


def test_the_old_result_object_is_never_mutated_by_a_later_evaluation() -> None:
    old = evaluate(_input(rule_version="r1"))
    old_hash = old.decision_hash
    old_outcome = old.outcome
    evaluate(_input(rule_version="r2"))
    assert old.decision_hash == old_hash
    assert old.outcome is old_outcome


def test_a_different_profile_fact_changes_the_input_hash() -> None:
    snapshot = make_snapshot()
    base = _input()
    other = EvaluationInput(
        profile=make_profile(is_capital_company=True, nace="63.11"),
        program=base.program,
        rule_set=base.rule_set,
        snapshots={snapshot.id: snapshot},
        as_of=TODAY,
    )
    assert evaluate(base).input_hash != evaluate(other).input_hash
