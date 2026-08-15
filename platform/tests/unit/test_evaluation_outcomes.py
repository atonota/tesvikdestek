"""Tests 2, 3 and 4 - four-valued outcomes, fail-closed sourcing, call windows."""

from datetime import date

import pytest

from destektesvik.domain.errors import SourceMissingError
from destektesvik.domain.evaluation import (
    EligibilityOutcome,
    EvaluationInput,
    evaluate,
)
from destektesvik.domain.programs import CallWindow, CallWindowState
from destektesvik.domain.rules import parse_rule
from tests.conftest import (
    TODAY,
    make_profile,
    make_program,
    make_rule_set,
    make_snapshot,
)

CITATIONS = frozenset({"snap-test"})
OPEN_WINDOW = CallWindow(opens_on=date(2026, 1, 1), closes_on=date(2026, 12, 31))
CLOSED_WINDOW = CallWindow(opens_on=date(2025, 1, 1), closes_on=date(2025, 12, 31))


def _rule_set(document: dict | None = None):
    document = document or {
        "all": [
            {"op": "eq", "fact": "is_capital_company", "value": True, "citation": "snap-test"},
            {"op": "prefix", "fact": "nace", "value": ["62"], "citation": "snap-test"},
        ]
    }
    return make_rule_set(parse_rule(document, CITATIONS))


def _build(
    *,
    facts: dict,
    call_window: CallWindow = OPEN_WINDOW,
    snapshot_ids: tuple[str, ...] = ("snap-test",),
    snapshots: dict | None = None,
    as_of: date = TODAY,
) -> EvaluationInput:
    if snapshots is None:
        snapshot = make_snapshot()
        snapshots = {snapshot.id: snapshot}
    return EvaluationInput(
        profile=make_profile(**facts),
        program=make_program(snapshot_ids=snapshot_ids, call_window=call_window),
        rule_set=_rule_set(),
        snapshots=snapshots,
        as_of=as_of,
    )


class TestFourValuedOutcome:
    def test_all_facts_present_and_satisfied_is_candidate_eligible(self) -> None:
        result = evaluate(_build(facts={"is_capital_company": True, "nace": "62.01"}))
        assert result.outcome is EligibilityOutcome.CANDIDATE_ELIGIBLE

    def test_a_failed_condition_is_ineligible(self) -> None:
        result = evaluate(_build(facts={"is_capital_company": False, "nace": "62.01"}))
        assert result.outcome is EligibilityOutcome.INELIGIBLE

    def test_a_missing_fact_is_insufficient_data_not_ineligible(self) -> None:
        result = evaluate(_build(facts={"is_capital_company": True}))
        assert result.outcome is EligibilityOutcome.INSUFFICIENT_DATA
        assert "nace" in result.missing_facts

    def test_missing_facts_are_named_so_the_user_can_act(self) -> None:
        result = evaluate(_build(facts={}))
        assert set(result.missing_facts) == {"is_capital_company", "nace"}

    def test_there_is_no_officially_approved_outcome(self) -> None:
        values = {member.value for member in EligibilityOutcome}
        assert values == {
            "candidate_eligible",
            "ineligible",
            "conditional",
            "insufficient_data",
        }

    def test_no_boolean_overclaim_is_exposed(self) -> None:
        """The result must not offer a plain True/False eligibility shortcut."""
        result = evaluate(_build(facts={"is_capital_company": True, "nace": "62.01"}))
        assert not hasattr(result, "eligible")
        assert not hasattr(result, "is_eligible")


class TestFailClosedSourcing:
    def test_a_program_without_any_snapshot_cannot_be_evaluated(self) -> None:
        with pytest.raises(SourceMissingError):
            evaluate(_build(facts={"nace": "62.01"}, snapshot_ids=()))

    def test_a_cited_snapshot_that_was_not_supplied_fails_closed(self) -> None:
        with pytest.raises(SourceMissingError):
            evaluate(
                _build(
                    facts={"is_capital_company": True, "nace": "62.01"},
                    snapshot_ids=("snap-test", "snap-missing"),
                )
            )

    def test_a_successful_result_always_carries_its_citations(self) -> None:
        result = evaluate(_build(facts={"is_capital_company": True, "nace": "62.01"}))
        assert result.citations
        assert set(result.citations) <= set(result.source_snapshot_ids)


class TestCallWindow:
    def test_unknown_window_is_unknown_not_guessed_open(self) -> None:
        assert CallWindow().state(TODAY) is CallWindowState.UNKNOWN

    def test_unknown_window_downgrades_an_otherwise_eligible_result_to_conditional(self) -> None:
        result = evaluate(
            _build(
                facts={"is_capital_company": True, "nace": "62.01"},
                call_window=CallWindow(),
            )
        )
        assert result.outcome is EligibilityOutcome.CONDITIONAL
        assert "call_window_unknown" in result.reasons

    def test_closed_window_is_conditional_not_a_claim_about_the_company(self) -> None:
        result = evaluate(
            _build(
                facts={"is_capital_company": True, "nace": "62.01"},
                call_window=CLOSED_WINDOW,
            )
        )
        assert result.outcome is EligibilityOutcome.CONDITIONAL
        assert "call_window_closed" in result.reasons

    def test_an_unknown_window_never_upgrades_an_ineligible_result(self) -> None:
        result = evaluate(
            _build(
                facts={"is_capital_company": False, "nace": "62.01"},
                call_window=CallWindow(),
            )
        )
        assert result.outcome is EligibilityOutcome.INELIGIBLE


class TestSourceEffectiveDates:
    def test_a_source_not_yet_in_effect_cannot_decide_today(self) -> None:
        future = make_snapshot(effective_from=date(2027, 1, 1))
        result = evaluate(
            _build(
                facts={"is_capital_company": True, "nace": "62.01"},
                snapshots={future.id: future},
            )
        )
        assert result.outcome in {
            EligibilityOutcome.CONDITIONAL,
            EligibilityOutcome.INSUFFICIENT_DATA,
        }
        assert "source_not_yet_in_effect" in result.reasons

    def test_an_expired_source_is_flagged_rather_than_silently_applied(self) -> None:
        expired = make_snapshot(effective_from=date(2024, 1, 1), effective_to=date(2025, 1, 1))
        result = evaluate(
            _build(
                facts={"is_capital_company": True, "nace": "62.01"},
                snapshots={expired.id: expired},
            )
        )
        assert "source_expired" in result.reasons

    def test_a_source_with_unknown_effective_dates_is_usable_but_recorded(self) -> None:
        result = evaluate(_build(facts={"is_capital_company": True, "nace": "62.01"}))
        assert result.outcome is EligibilityOutcome.CANDIDATE_ELIGIBLE
        assert "source_effective_dates_unknown" in result.reasons


def test_the_result_always_carries_a_non_binding_disclaimer() -> None:
    result = evaluate(_build(facts={"is_capital_company": True, "nace": "62.01"}))
    assert "baglayici degildir" in result.disclaimer
