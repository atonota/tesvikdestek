"""Test 13 (host-runnable half) - seeding must be idempotent.

This exists because it was not. The first implementation compared a stored
datetime with an aware one; SQLite hands back naive datetimes, so every row
looked changed and every deployment would have rewritten the whole catalogue.
The PostgreSQL half of this check lives in ``test_postgres_security.py``.
"""

from sqlalchemy import select

from destektesvik.adapters.db.models import ProgramVersionRow, RuleSetVersionRow, SourceSnapshotRow
from destektesvik.adapters.db.seed import seed_catalog


def test_seeding_twice_changes_nothing_the_second_time(app) -> None:
    session_factory = app.state.session_factory
    with session_factory() as session:
        first = seed_catalog(session, app.state.catalog)
        session.commit()
    with session_factory() as session:
        second = seed_catalog(session, app.state.catalog)
        session.commit()
    with session_factory() as session:
        third = seed_catalog(session, app.state.catalog)
        session.commit()

    assert first.changed is True
    assert second.changed is False, "seeding is not idempotent"
    assert third.changed is False


def test_seeding_writes_exactly_the_curated_catalogue(app) -> None:
    session_factory = app.state.session_factory
    with session_factory() as session:
        seed_catalog(session, app.state.catalog)
        session.commit()
    with session_factory() as session:
        snapshots = session.scalars(select(SourceSnapshotRow)).all()
        programs = session.scalars(select(ProgramVersionRow)).all()
        rule_sets = session.scalars(select(RuleSetVersionRow)).all()

    assert len(snapshots) == len(programs) == len(rule_sets) == 3
    assert all(row.review_status == "pending_review" for row in snapshots)
    assert all(row.body for row in snapshots), "the curated text must be stored, not just its hash"
    assert all(row.published_reference_minor_units is None for row in programs)
    assert all(row.opens_on is None and row.closes_on is None for row in programs)


def test_the_stored_rule_is_data_not_code(app) -> None:
    """A rule round-trips to plain JSON: that is what makes it versionable."""
    session_factory = app.state.session_factory
    with session_factory() as session:
        seed_catalog(session, app.state.catalog)
        session.commit()
        row = session.scalar(
            select(RuleSetVersionRow).where(RuleSetVersionRow.program_code == "TUBITAK-1501")
        )

    assert isinstance(row.rule, dict)
    assert "all" in row.rule
    for predicate in row.rule["all"]:
        assert predicate["citation"] == "snap-tubitak-1501-2026-08-14"
        assert predicate["op"] in {"eq", "in", "gte", "lte", "prefix"}
