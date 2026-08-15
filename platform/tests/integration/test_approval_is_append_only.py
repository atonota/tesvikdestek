"""Test 9 (application half) - approval appends, it never mutates.

The database half - UPDATE/DELETE refused by a trigger - is in
``test_postgres_security.py`` and only runs against PostgreSQL.
"""

from sqlalchemy import select

from destektesvik.adapters.db.models import ApprovalRow, AuditEventRow, DecisionRow
from tests.integration.conftest import (
    csrf_token_from,
    register_and_login,
    run_evaluation,
    save_profile,
)


def _approve_first_decision(client, app):
    decision_id = client.get("/api/degerlendirmeler").json()[0]["id"]
    detail = client.get(f"/degerlendirmeler/{decision_id}")
    client.post(
        f"/degerlendirmeler/{decision_id}/onay",
        data={"not": "Onaylandi kaydim icin.", "csrf_token": csrf_token_from(detail.text)},
        follow_redirects=False,
    )
    return decision_id


def _rows(app, model):
    with app.state.session_factory() as session:
        return session.scalars(select(model)).all()


def test_approval_does_not_change_the_decision_row(client, app) -> None:
    register_and_login(client, "append@ornek.com.tr", "Append A.S.")
    save_profile(client)
    run_evaluation(client)

    before = {row.id: (row.outcome, row.decision_hash) for row in _rows(app, DecisionRow)}
    decision_id = _approve_first_decision(client, app)
    after = {row.id: (row.outcome, row.decision_hash) for row in _rows(app, DecisionRow)}

    assert before == after
    approvals = [row for row in _rows(app, ApprovalRow) if row.decision_id == decision_id]
    assert len(approvals) == 1


def test_an_approval_records_the_actor_and_the_time(client, app) -> None:
    register_and_login(client, "aktor@ornek.com.tr", "Aktor A.S.")
    save_profile(client)
    run_evaluation(client)
    _approve_first_decision(client, app)

    approval = _rows(app, ApprovalRow)[0]
    assert approval.actor_user_id
    assert approval.approved_at is not None
    assert approval.label == "Kullanici onayi"


def test_approving_twice_appends_a_second_event(client, app) -> None:
    register_and_login(client, "ikikez@ornek.com.tr", "Iki Kez A.S.")
    save_profile(client)
    run_evaluation(client)
    _approve_first_decision(client, app)
    _approve_first_decision(client, app)
    assert len(_rows(app, ApprovalRow)) == 2


def test_the_audit_trail_covers_the_whole_journey(client, app) -> None:
    register_and_login(client, "iz@ornek.com.tr", "Iz A.S.")
    save_profile(client)
    run_evaluation(client)
    _approve_first_decision(client, app)

    actions = [row.action for row in _rows(app, AuditEventRow)]
    assert "tenant_and_user_registered" in actions
    assert "session_started" in actions
    assert "company_profile_saved" in actions
    assert actions.count("decision_recorded") == 3
    assert "user_approval_recorded" in actions


def test_the_audit_payload_carries_no_commercially_sensitive_values(client, app) -> None:
    """Fact *names* are auditable; turnover and headcount values are not."""
    register_and_login(client, "gizli@ornek.com.tr", "Gizli A.S.")
    save_profile(client, annual_revenue_try="98765432")
    run_evaluation(client)

    for row in _rows(app, AuditEventRow):
        assert "98765432" not in str(row.payload)
