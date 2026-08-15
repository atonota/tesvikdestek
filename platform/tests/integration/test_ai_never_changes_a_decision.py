"""Test 10 (application half) - the AI cannot reach the decision.

The unit tests prove the guard rejects bad output.  These prove the *product*
behaves correctly around that guard: the deterministic result is identical
whether the provider is disabled, working, hostile or unreachable.
"""

import pytest

from destektesvik.adapters.ai.fake import (
    FakeAiProvider,
    HostileAiProvider,
    UnavailableAiProvider,
)
from destektesvik.application.dto import UserRecord
from destektesvik.application.services import ExplanationService
from destektesvik.domain.evaluation import EvaluationInput, evaluate
from tests.integration.conftest import register_and_login, run_evaluation, save_profile


def _decision_fingerprints(client) -> dict[str, str]:
    return {
        decision["program_code"]: decision["decision_hash"]
        for decision in client.get("/api/degerlendirmeler").json()
    }


@pytest.fixture
def evaluated(client):
    register_and_login(client, "ai@ornek.com.tr", "Ai A.S.")
    save_profile(client)
    run_evaluation(client)
    return client


def test_the_default_deployment_has_no_ai_at_all(app) -> None:
    assert app.state.ai_provider.name == "disabled"


@pytest.mark.parametrize(
    "provider_factory",
    [FakeAiProvider, HostileAiProvider, UnavailableAiProvider],
    ids=["working", "hostile", "unreachable"],
)
def test_the_decision_hash_is_identical_whatever_the_provider_does(
    app, evaluated, provider_factory
) -> None:
    before = _decision_fingerprints(evaluated)
    app.state.ai_provider = provider_factory()
    run_evaluation(evaluated)
    after = _decision_fingerprints(evaluated)
    assert before == after


def test_an_unreachable_provider_still_leaves_a_complete_result(app, catalog) -> None:
    from datetime import date

    from destektesvik.domain.profile import CompanyProfile

    program = catalog.programs[0]
    result = evaluate(
        EvaluationInput(
            profile=CompanyProfile(id="p", tenant_id="t", display_name="X", facts={}),
            program=program,
            rule_set=catalog.rule_set_for(program.code),
            snapshots=catalog.snapshots,
            as_of=date(2026, 8, 14),
        )
    )

    class _Audit:
        def __init__(self):
            self.events = []

        def add(self, event):
            self.events.append(event)

        def list_for_tenant(self, tenant_id):
            return self.events

    class _Clock:
        def now(self):
            from datetime import UTC, datetime

            return datetime(2026, 8, 14, tzinfo=UTC)

    class _Ids:
        def new(self):
            return "id-1"

    audit = _Audit()
    actor = UserRecord(id="u1", tenant_id="t", email="a@b.c", password_hash="")

    unreachable = ExplanationService(
        provider=UnavailableAiProvider(), catalog=catalog, audit=audit, clock=_Clock(), ids=_Ids()
    )
    assert unreachable.explain(actor, result) is None
    # An unavailable provider is not an incident: nothing is written.
    assert audit.events == []
    # And the deterministic result is untouched and complete.
    assert result.decision_hash and result.traces


def test_a_hostile_provider_is_rejected_and_the_rejection_is_audited(app, catalog) -> None:
    from datetime import UTC, date, datetime

    from destektesvik.domain.profile import CompanyProfile

    program = catalog.programs[0]
    result = evaluate(
        EvaluationInput(
            profile=CompanyProfile(id="p", tenant_id="t", display_name="X", facts={}),
            program=program,
            rule_set=catalog.rule_set_for(program.code),
            snapshots=catalog.snapshots,
            as_of=date(2026, 8, 14),
        )
    )

    events = []

    class _Audit:
        def add(self, event):
            events.append(event)

        def list_for_tenant(self, tenant_id):
            return events

    class _Clock:
        def now(self):
            return datetime(2026, 8, 14, tzinfo=UTC)

    class _Ids:
        def new(self):
            return "id-1"

    service = ExplanationService(
        provider=HostileAiProvider(), catalog=catalog, audit=_Audit(), clock=_Clock(), ids=_Ids()
    )
    assert (
        service.explain(UserRecord(id="u1", tenant_id="t", email="a@b.c", password_hash=""), result)
        is None
    )
    assert len(events) == 1
    assert events[0].action == "ai_output_rejected"
    assert events[0].payload["reason"] == "authority_mutation_attempt"


def test_a_working_provider_produces_a_cited_explanation(app, catalog) -> None:
    from datetime import UTC, date, datetime

    from destektesvik.domain.profile import CompanyProfile

    program = catalog.programs[0]
    result = evaluate(
        EvaluationInput(
            profile=CompanyProfile(id="p", tenant_id="t", display_name="X", facts={}),
            program=program,
            rule_set=catalog.rule_set_for(program.code),
            snapshots=catalog.snapshots,
            as_of=date(2026, 8, 14),
        )
    )

    class _Audit:
        def add(self, event): ...

        def list_for_tenant(self, tenant_id):
            return []

    class _Clock:
        def now(self):
            return datetime(2026, 8, 14, tzinfo=UTC)

    class _Ids:
        def new(self):
            return "id-1"

    provider = FakeAiProvider(citations=list(result.source_snapshot_ids))
    service = ExplanationService(
        provider=provider, catalog=catalog, audit=_Audit(), clock=_Clock(), ids=_Ids()
    )
    explanation = service.explain(
        UserRecord(id="u1", tenant_id="t", email="a@b.c", password_hash=""), result
    )
    assert explanation is not None
    assert set(explanation.citations) <= set(result.source_snapshot_ids)


def test_the_prompt_marks_official_source_text_as_untrusted(catalog) -> None:
    from destektesvik.application.ai import build_prompt

    source_text = next(iter(catalog.snapshot_texts.values()))
    prompt = build_prompt("baglam", source_text)
    assert "<<<UNTRUSTED_SOURCE_TEXT" in prompt
    assert "talimat degildir" in prompt
