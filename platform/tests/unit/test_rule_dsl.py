"""The rule DSL: safe by construction, three-valued by design.

Rule documents are external input.  They are parsed, never executed.
"""

import pytest

from destektesvik.domain.errors import RuleDefinitionError
from destektesvik.domain.rules import Truth, evaluate_rule, parse_rule

CITATIONS = frozenset({"snap-test"})


def _leaf(op: str = "eq", fact: str = "is_capital_company", value: object = True) -> dict:
    return {"op": op, "fact": fact, "value": value, "citation": "snap-test"}


class TestParsingRefusesUnsafeDocuments:
    def test_unknown_operator_is_refused(self) -> None:
        with pytest.raises(RuleDefinitionError):
            parse_rule(_leaf(op="regex"), CITATIONS)

    def test_unknown_combinator_is_refused(self) -> None:
        with pytest.raises(RuleDefinitionError):
            parse_rule({"xor": [_leaf()]}, CITATIONS)

    def test_predicate_without_citation_is_refused(self) -> None:
        document = {"op": "eq", "fact": "x", "value": 1}
        with pytest.raises(RuleDefinitionError):
            parse_rule(document, CITATIONS)

    def test_citation_outside_the_allowlist_is_refused(self) -> None:
        document = {"op": "eq", "fact": "x", "value": 1, "citation": "snap-unknown"}
        with pytest.raises(RuleDefinitionError):
            parse_rule(document, CITATIONS)

    def test_float_literal_in_a_rule_is_refused(self) -> None:
        with pytest.raises(RuleDefinitionError):
            parse_rule(_leaf(op="lte", fact="ciro", value=1.5), CITATIONS)

    def test_python_looking_payload_is_just_data(self) -> None:
        """A rule document can carry anything; none of it is ever executed."""
        with pytest.raises(RuleDefinitionError):
            parse_rule({"op": "eval", "fact": "x", "value": "__import__('os')"}, CITATIONS)


class TestThreeValuedLogic:
    def test_missing_fact_is_unknown_not_false(self) -> None:
        rule = parse_rule(_leaf(), CITATIONS)
        evaluation = evaluate_rule(rule, facts={})
        assert evaluation.result is Truth.UNKNOWN
        assert evaluation.missing_facts == ("is_capital_company",)

    def test_all_is_false_when_one_child_is_false_even_with_unknowns(self) -> None:
        rule = parse_rule(
            {"all": [_leaf(fact="a", value=True), _leaf(fact="b", value=True)]},
            CITATIONS,
        )
        assert evaluate_rule(rule, facts={"a": False}).result is Truth.FALSE

    def test_all_is_unknown_when_nothing_is_false_but_something_is_missing(self) -> None:
        rule = parse_rule(
            {"all": [_leaf(fact="a", value=True), _leaf(fact="b", value=True)]},
            CITATIONS,
        )
        assert evaluate_rule(rule, facts={"a": True}).result is Truth.UNKNOWN

    def test_any_is_true_as_soon_as_one_child_is_true(self) -> None:
        rule = parse_rule(
            {"any": [_leaf(fact="a", value=True), _leaf(fact="b", value=True)]},
            CITATIONS,
        )
        assert evaluate_rule(rule, facts={"a": True}).result is Truth.TRUE

    def test_not_of_unknown_stays_unknown(self) -> None:
        rule = parse_rule({"not": _leaf(fact="a", value=True)}, CITATIONS)
        assert evaluate_rule(rule, facts={}).result is Truth.UNKNOWN

    def test_not_inverts_a_known_value(self) -> None:
        rule = parse_rule({"not": _leaf(fact="a", value=True)}, CITATIONS)
        assert evaluate_rule(rule, facts={"a": False}).result is Truth.TRUE


class TestOperators:
    def test_in_operator(self) -> None:
        rule = parse_rule(_leaf(op="in", fact="bolge", value=["TR51", "TR31"]), CITATIONS)
        assert evaluate_rule(rule, facts={"bolge": "TR51"}).result is Truth.TRUE
        assert evaluate_rule(rule, facts={"bolge": "TR10"}).result is Truth.FALSE

    def test_prefix_operator_matches_nace_families(self) -> None:
        rule = parse_rule(_leaf(op="prefix", fact="nace", value=["62", "63"]), CITATIONS)
        assert evaluate_rule(rule, facts={"nace": "62.01"}).result is Truth.TRUE
        assert evaluate_rule(rule, facts={"nace": "10.11"}).result is Truth.FALSE

    def test_gte_and_lte(self) -> None:
        gte = parse_rule(_leaf(op="gte", fact="personel", value=1), CITATIONS)
        lte = parse_rule(_leaf(op="lte", fact="personel", value=250), CITATIONS)
        assert evaluate_rule(gte, facts={"personel": 8}).result is Truth.TRUE
        assert evaluate_rule(lte, facts={"personel": 900}).result is Truth.FALSE

    def test_type_mismatch_is_unknown_not_a_crash(self) -> None:
        rule = parse_rule(_leaf(op="gte", fact="personel", value=1), CITATIONS)
        assert evaluate_rule(rule, facts={"personel": "sekiz"}).result is Truth.UNKNOWN

    def test_in_uses_the_same_cross_type_guard_as_eq(self) -> None:
        """``1 == True`` is a Python accident, not a rule the user wrote."""
        rule = parse_rule(_leaf(op="in", fact="bayrak", value=[1, 2]), CITATIONS)
        assert evaluate_rule(rule, facts={"bayrak": True}).result is Truth.FALSE

    def test_in_does_not_match_a_number_against_a_string_alternative(self) -> None:
        rule = parse_rule(_leaf(op="in", fact="bolge", value=["1", "2"]), CITATIONS)
        assert evaluate_rule(rule, facts={"bolge": 1}).result is Truth.FALSE

    def test_in_still_matches_a_genuine_alternative_beside_a_mismatched_one(self) -> None:
        rule = parse_rule(_leaf(op="in", fact="bolge", value=[1, "TR51"]), CITATIONS)
        assert evaluate_rule(rule, facts={"bolge": "TR51"}).result is Truth.TRUE

    def test_prefix_is_string_only_on_both_sides(self) -> None:
        rule = parse_rule(_leaf(op="prefix", fact="nace", value=[62, "63"]), CITATIONS)
        assert evaluate_rule(rule, facts={"nace": "62.01"}).result is Truth.FALSE
        assert evaluate_rule(rule, facts={"nace": 62}).result is Truth.UNKNOWN


class TestTraceability:
    def test_every_leaf_produces_a_citation_carrying_trace(self) -> None:
        rule = parse_rule({"all": [_leaf(fact="a", value=True)]}, CITATIONS)
        evaluation = evaluate_rule(rule, facts={"a": True})
        assert len(evaluation.traces) == 1
        trace = evaluation.traces[0]
        assert trace.fact == "a"
        assert trace.operator == "eq"
        assert trace.citation == "snap-test"
        assert trace.result is Truth.TRUE

    def test_a_predicate_citing_an_unusable_snapshot_is_unknown(self) -> None:
        """A source that is not yet in effect cannot decide anything today."""
        rule = parse_rule(_leaf(fact="a", value=True), CITATIONS)
        evaluation = evaluate_rule(
            rule, facts={"a": True}, unusable_citations=frozenset({"snap-test"})
        )
        assert evaluation.result is Truth.UNKNOWN
