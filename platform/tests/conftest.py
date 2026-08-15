"""Shared test fixtures.

The builders here are deliberately explicit: every test states the exact facts,
snapshots and rule version it depends on, because "which source, which rule
version" is the product's core claim.
"""

from datetime import UTC, date, datetime
from typing import Any

import pytest

from destektesvik.domain.amounts import MoneyState, MoneyStateKind
from destektesvik.domain.money import Money
from destektesvik.domain.profile import CompanyProfile
from destektesvik.domain.programs import (
    CallWindow,
    ProgramVersion,
    RuleSetVersion,
    SupportType,
)
from destektesvik.domain.sources import ReviewStatus, SourceSnapshot

TODAY = date(2026, 8, 14)
CAPTURED_AT = datetime(2026, 8, 14, 9, 0, tzinfo=UTC)

SNAPSHOT_HASH_A = "a" * 64
SNAPSHOT_HASH_B = "b" * 64


def make_snapshot(
    snapshot_id: str = "snap-test",
    *,
    content_hash: str = SNAPSHOT_HASH_A,
    effective_from: date | None = None,
    effective_to: date | None = None,
    review_status: ReviewStatus = ReviewStatus.VERIFIED,
) -> SourceSnapshot:
    return SourceSnapshot(
        id=snapshot_id,
        url="https://tubitak.gov.tr/tr/destekler/sanayi/ulusal-destek-programlari",
        publisher="TUBITAK",
        title="Test kaynak sayfasi",
        captured_at=CAPTURED_AT,
        content_hash=content_hash,
        effective_from=effective_from,
        effective_to=effective_to,
        reviewed_at=CAPTURED_AT,
        review_status=review_status,
    )


def make_program(
    *,
    code: str = "TEST-1",
    version: str = "2026.1",
    snapshot_ids: tuple[str, ...] = ("snap-test",),
    call_window: CallWindow | None = None,
    published_reference: MoneyState | None = None,
) -> ProgramVersion:
    return ProgramVersion(
        id=f"{code}@{version}",
        code=code,
        name="Test Destek Programi",
        version=version,
        support_type=SupportType.GRANT,
        official_url="https://tubitak.gov.tr/tr/destekler",
        source_snapshot_ids=snapshot_ids,
        call_window=call_window if call_window is not None else CallWindow(),
        published_reference=published_reference,
        required_documents=("Vergi levhasi",),
    )


def make_rule_set(
    rule: Any,
    *,
    program_code: str = "TEST-1",
    version: str = "r1",
    required_facts: tuple[str, ...] = (),
) -> RuleSetVersion:
    return RuleSetVersion(
        id=f"{program_code}:{version}",
        program_code=program_code,
        version=version,
        rule=rule,
        required_facts=required_facts,
    )


def make_profile(**facts: Any) -> CompanyProfile:
    return CompanyProfile(
        id="profile-1",
        tenant_id="tenant-a",
        display_name="Ornek Yazilim A.S.",
        facts=dict(facts),
    )


@pytest.fixture
def published_ceiling() -> MoneyState:
    return MoneyState(
        amount=Money.from_decimal("2500000.00"),
        kind=MoneyStateKind.PUBLISHED_CEILING,
        citation="snap-test",
    )
