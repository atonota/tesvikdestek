"""Loads the curated programme catalogue from disk.

The single non-obvious thing here: ``content_hash`` is computed from the
snapshot file's bytes at load time rather than read from the JSON.  A hash
written by hand into a config file is a claim; a hash computed from the
artefact is a fact.
"""

import hashlib
import json
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

from destektesvik.domain.amounts import MoneyState, MoneyStateKind
from destektesvik.domain.money import Money
from destektesvik.domain.programs import (
    CallWindow,
    ProgramVersion,
    RuleSetVersion,
    SupportType,
)
from destektesvik.domain.rules import parse_rule
from destektesvik.domain.sources import ReviewStatus, SourceSnapshot

DATA_ROOT = Path(__file__).resolve().parent.parent / "data"
PROGRAM_DIR = DATA_ROOT / "programs"
SNAPSHOT_DIR = DATA_ROOT / "source_snapshots"


@dataclass(frozen=True, slots=True)
class Catalog:
    programs: tuple[ProgramVersion, ...]
    rule_sets: dict[str, RuleSetVersion]
    snapshots: dict[str, SourceSnapshot]
    snapshot_texts: dict[str, str]

    def rule_set_for(self, program_code: str) -> RuleSetVersion:
        return self.rule_sets[program_code]


def _parse_optional_date(value: str | None) -> date | None:
    return date.fromisoformat(value) if value else None


def _parse_optional_datetime(value: str | None) -> datetime | None:
    return datetime.fromisoformat(value) if value else None


def _load_snapshot(entry: dict, snapshot_dir: Path) -> tuple[SourceSnapshot, str]:
    path = snapshot_dir / entry["file"]
    raw = path.read_bytes()
    snapshot = SourceSnapshot(
        id=entry["id"],
        url=entry["url"],
        publisher=entry["publisher"],
        title=entry["title"],
        captured_at=datetime.fromisoformat(entry["captured_at"]),
        content_hash=hashlib.sha256(raw).hexdigest(),
        effective_from=_parse_optional_date(entry.get("effective_from")),
        effective_to=_parse_optional_date(entry.get("effective_to")),
        reviewed_at=_parse_optional_datetime(entry.get("reviewed_at")),
        review_status=ReviewStatus(entry.get("review_status", "pending_review")),
    )
    return snapshot, raw.decode("utf-8")


def _load_published_reference(entry: dict | None) -> MoneyState | None:
    """Only ever a published ceiling.  ``null`` stays ``None`` - never guessed."""
    if not entry:
        return None
    return MoneyState(
        amount=Money.from_decimal(Decimal(str(entry["amount"])), entry.get("currency", "TRY")),
        kind=MoneyStateKind.PUBLISHED_CEILING,
        citation=entry.get("citation"),
    )


def load_catalog(program_dir: Path = PROGRAM_DIR, snapshot_dir: Path = SNAPSHOT_DIR) -> Catalog:
    programs: list[ProgramVersion] = []
    rule_sets: dict[str, RuleSetVersion] = {}
    snapshots: dict[str, SourceSnapshot] = {}
    snapshot_texts: dict[str, str] = {}

    for path in sorted(program_dir.glob("*.json")):
        document = json.loads(path.read_text(encoding="utf-8"))

        for entry in document["snapshots"]:
            snapshot, text = _load_snapshot(entry, snapshot_dir)
            snapshots[snapshot.id] = snapshot
            snapshot_texts[snapshot.id] = text

        program_document = document["program"]
        window = program_document.get("call_window") or {}
        program = ProgramVersion(
            id=program_document["id"],
            code=program_document["code"],
            name=program_document["name"],
            version=program_document["version"],
            support_type=SupportType(program_document["support_type"]),
            official_url=program_document["official_url"],
            source_snapshot_ids=tuple(program_document["source_snapshot_ids"]),
            call_window=CallWindow(
                opens_on=_parse_optional_date(window.get("opens_on")),
                closes_on=_parse_optional_date(window.get("closes_on")),
            ),
            published_reference=_load_published_reference(
                program_document.get("published_reference")
            ),
            required_documents=tuple(program_document.get("required_documents", ())),
            notes=program_document.get("notes", ""),
        )
        programs.append(program)

        rule_document = document["rule_set"]
        rule_sets[program.code] = RuleSetVersion(
            id=rule_document["id"],
            program_code=program.code,
            version=rule_document["version"],
            # Parsing against the programme's own snapshot ids is what makes an
            # unsourced predicate a load-time failure rather than a runtime one.
            rule=parse_rule(rule_document["rule"], frozenset(program.source_snapshot_ids)),
        )

    return Catalog(
        programs=tuple(programs),
        rule_sets=rule_sets,
        snapshots=snapshots,
        snapshot_texts=snapshot_texts,
    )
