"""Seed the catalogue tables from the curated files on disk.

Idempotent by construction: every row is keyed by an id that comes from the
catalogue file, so running this twice changes nothing.  It is safe to run on
every deployment.
"""

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from destektesvik.adapters.catalog import Catalog, load_catalog
from destektesvik.config import Settings
from destektesvik.domain.rules import rule_document

from .models import ProgramVersionRow, RuleSetVersionRow, SourceSnapshotRow


def resolve_seed_url(settings: Settings, environ: Mapping[str, str]) -> str:
    """Which database URL the seeder should use.

    Seeding writes the versioned catalogue, which the *application* role is
    deliberately not allowed to write: it holds SELECT only, so a decision's
    cited evidence cannot be rewritten by the web process.  Seeding is
    provisioning, so it runs as the migration role when one is configured -
    the same precedence ``migrations/env.py`` uses, so the two cannot disagree
    about which database is being provisioned.

    Falls back to the application URL for the laptop case, where SQLite has one
    role and no privileges to separate.
    """
    return environ.get("DESTEKTESVIK_MIGRATION_DATABASE_URL") or settings.database_url


@dataclass(frozen=True, slots=True)
class SeedReport:
    snapshots: int
    programs: int
    rule_sets: int
    changed: bool


def _unchanged(current: object, expected: object) -> bool:
    """Compare a stored value with the desired one.

    Backends differ in what they hand back: SQLite returns naive datetimes even
    for timezone-aware columns.  Comparing those directly would mark every row
    as changed on every run, which would quietly make seeding non-idempotent.
    """
    if isinstance(current, datetime) and isinstance(expected, datetime):
        left = current if current.tzinfo else current.replace(tzinfo=UTC)
        right = expected if expected.tzinfo else expected.replace(tzinfo=UTC)
        return left == right
    return current == expected


def seed_catalog(session: Session, catalog: Catalog | None = None) -> SeedReport:
    catalog = catalog or load_catalog()
    changed = False

    for snapshot_id, snapshot in catalog.snapshots.items():
        body = catalog.snapshot_texts.get(snapshot_id, "")
        snapshot_row = session.get(SourceSnapshotRow, snapshot_id)
        snapshot_values: dict[str, object] = {
            "url": snapshot.url,
            "publisher": snapshot.publisher,
            "title": snapshot.title,
            "captured_at": snapshot.captured_at,
            "content_hash": snapshot.content_hash,
            "effective_from": (
                snapshot.effective_from.isoformat() if snapshot.effective_from else None
            ),
            "effective_to": (snapshot.effective_to.isoformat() if snapshot.effective_to else None),
            "reviewed_at": snapshot.reviewed_at,
            "review_status": snapshot.review_status.value,
            "body": body,
        }
        if snapshot_row is None:
            session.add(SourceSnapshotRow(id=snapshot_id, **snapshot_values))
            changed = True
        else:
            for key, value in snapshot_values.items():
                if not _unchanged(getattr(snapshot_row, key), value):
                    setattr(snapshot_row, key, value)
                    changed = True

    for program in catalog.programs:
        reference = program.published_reference
        program_values: dict[str, object] = {
            "code": program.code,
            "name": program.name,
            "version": program.version,
            "support_type": program.support_type.value,
            "official_url": program.official_url,
            "source_snapshot_ids": list(program.source_snapshot_ids),
            "opens_on": (
                program.call_window.opens_on.isoformat() if program.call_window.opens_on else None
            ),
            "closes_on": (
                program.call_window.closes_on.isoformat() if program.call_window.closes_on else None
            ),
            "published_reference_minor_units": (
                reference.amount.minor_units if reference else None
            ),
            "published_reference_currency": (reference.amount.currency if reference else None),
            "required_documents": list(program.required_documents),
            "notes": program.notes,
        }
        program_row = session.get(ProgramVersionRow, program.id)
        if program_row is None:
            session.add(ProgramVersionRow(id=program.id, **program_values))
            changed = True
        else:
            for key, value in program_values.items():
                if not _unchanged(getattr(program_row, key), value):
                    setattr(program_row, key, value)
                    changed = True

    for program_code, rule_set in catalog.rule_sets.items():
        rule_values: dict[str, object] = {
            "program_code": program_code,
            "version": rule_set.version,
            "rule": rule_document(rule_set.rule),
        }
        rule_row = session.get(RuleSetVersionRow, rule_set.id)
        if rule_row is None:
            session.add(RuleSetVersionRow(id=rule_set.id, **rule_values))
            changed = True
        else:
            for key, value in rule_values.items():
                if not _unchanged(getattr(rule_row, key), value):
                    setattr(rule_row, key, value)
                    changed = True

    session.flush()
    return SeedReport(
        snapshots=len(catalog.snapshots),
        programs=len(catalog.programs),
        rule_sets=len(catalog.rule_sets),
        changed=changed,
    )
