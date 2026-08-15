"""The three seed programmes must load, and must load honestly."""

from datetime import date

import pytest

from destektesvik.adapters.catalog import load_catalog
from destektesvik.domain.evaluation import EligibilityOutcome, EvaluationInput, evaluate
from destektesvik.domain.profile import CompanyProfile
from destektesvik.domain.programs import CallWindowState, SupportType
from destektesvik.domain.sources import ReviewStatus

TODAY = date(2026, 8, 14)
EXPECTED_CODES = {"KOSGEB-GIRISIMCI", "TUBITAK-1501", "TUBITAK-1507"}


@pytest.fixture(scope="module")
def catalog():
    return load_catalog()


def test_exactly_the_three_seed_programmes_load(catalog) -> None:
    assert {program.code for program in catalog.programs} == EXPECTED_CODES


def test_every_programme_is_a_grant_in_this_mvp(catalog) -> None:
    assert all(p.support_type is SupportType.GRANT for p in catalog.programs)


def test_every_programme_cites_at_least_one_snapshot(catalog) -> None:
    for program in catalog.programs:
        assert program.source_snapshot_ids
        for snapshot_id in program.source_snapshot_ids:
            assert snapshot_id in catalog.snapshots


def test_content_hash_is_computed_from_the_stored_artefact(catalog) -> None:
    import hashlib

    for snapshot_id, snapshot in catalog.snapshots.items():
        text = catalog.snapshot_texts[snapshot_id]
        assert snapshot.content_hash == hashlib.sha256(text.encode("utf-8")).hexdigest()
        assert len(snapshot.content_hash) == 64


def test_no_snapshot_claims_expert_verification(catalog) -> None:
    """None of these has been checked by a domain expert, and it says so."""
    assert all(s.review_status is ReviewStatus.PENDING_REVIEW for s in catalog.snapshots.values())


def test_no_effective_dates_are_invented(catalog) -> None:
    for snapshot in catalog.snapshots.values():
        assert snapshot.effective_from is None
        assert snapshot.effective_to is None


def test_no_call_window_is_invented(catalog) -> None:
    for program in catalog.programs:
        assert program.call_window.state(TODAY) is CallWindowState.UNKNOWN


def test_no_published_amount_is_invented(catalog) -> None:
    assert all(program.published_reference is None for program in catalog.programs)


def test_a_fully_qualifying_company_gets_conditional_not_eligible(catalog) -> None:
    """Because no call window is published, nothing can be candidate_eligible yet."""
    profile = CompanyProfile(
        id="p1",
        tenant_id="t1",
        display_name="Ornek Yazilim A.S.",
        facts={
            "is_capital_company": True,
            "is_resident_in_turkey": True,
            "sme_declaration": True,
            "has_previous_tubitak_project": False,
            "company_age_years": 2,
            "nace_code": "62.01",
            "nace_section": "J",
            "kosgeb_db_registered": True,
            "kosgeb_declaration_current": True,
        },
    )
    for program in catalog.programs:
        result = evaluate(
            EvaluationInput(
                profile=profile,
                program=program,
                rule_set=catalog.rule_set_for(program.code),
                snapshots=catalog.snapshots,
                as_of=TODAY,
            )
        )
        assert result.outcome is EligibilityOutcome.CONDITIONAL
        assert "call_window_unknown" in result.reasons


def test_an_empty_profile_yields_insufficient_data_everywhere(catalog) -> None:
    profile = CompanyProfile(id="p2", tenant_id="t1", display_name="Bos", facts={})
    for program in catalog.programs:
        result = evaluate(
            EvaluationInput(
                profile=profile,
                program=program,
                rule_set=catalog.rule_set_for(program.code),
                snapshots=catalog.snapshots,
                as_of=TODAY,
            )
        )
        assert result.outcome is EligibilityOutcome.INSUFFICIENT_DATA
        assert result.missing_facts


def test_a_disqualifying_fact_yields_ineligible(catalog) -> None:
    profile = CompanyProfile(
        id="p3",
        tenant_id="t1",
        display_name="Eski Sirket",
        facts={
            "company_age_years": 11,
            "nace_code": "62.01",
            "nace_section": "J",
            "kosgeb_db_registered": True,
            "kosgeb_declaration_current": True,
        },
    )
    kosgeb = next(p for p in catalog.programs if p.code == "KOSGEB-GIRISIMCI")
    result = evaluate(
        EvaluationInput(
            profile=profile,
            program=kosgeb,
            rule_set=catalog.rule_set_for("KOSGEB-GIRISIMCI"),
            snapshots=catalog.snapshots,
            as_of=TODAY,
        )
    )
    assert result.outcome is EligibilityOutcome.INELIGIBLE
