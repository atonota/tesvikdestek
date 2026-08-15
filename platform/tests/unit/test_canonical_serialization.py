"""Determinism foundation: canonical JSON and hashing.

If two machines can disagree about the bytes, they can disagree about the
decision hash, and the whole audit story collapses.
"""

from datetime import UTC, date, datetime
from decimal import Decimal

import pytest

from destektesvik.domain.canonical import canonical_hash, canonical_json, sha256_hex
from destektesvik.domain.errors import MoneyError


def test_mapping_key_order_does_not_change_the_bytes() -> None:
    first = canonical_json({"b": 1, "a": 2})
    second = canonical_json({"a": 2, "b": 1})
    assert first == second


def test_decimal_is_serialised_exactly_not_as_float() -> None:
    encoded = canonical_json({"amount": Decimal("2500000.00")})
    assert "2500000.00" in encoded
    assert "2500000.0," not in encoded


def test_float_is_refused_outright() -> None:
    with pytest.raises(MoneyError):
        canonical_json({"amount": 1.1})


def test_datetime_is_normalised_to_utc_iso8601() -> None:
    encoded = canonical_json({"at": datetime(2026, 8, 14, 9, 0, tzinfo=UTC)})
    assert "2026-08-14T09:00:00+00:00" in encoded


def test_date_is_serialised_as_iso_date() -> None:
    assert "2026-08-14" in canonical_json({"day": date(2026, 8, 14)})


def test_sha256_hex_is_a_real_digest() -> None:
    digest = sha256_hex("destektesvik")
    assert len(digest) == 64
    assert digest == sha256_hex("destektesvik")
    assert digest != sha256_hex("destektesvik ")


def test_canonical_hash_is_stable_across_equivalent_inputs() -> None:
    left = canonical_hash({"b": [1, 2], "a": Decimal("3.00")})
    right = canonical_hash({"a": Decimal("3.00"), "b": [1, 2]})
    assert left == right
    assert len(left) == 64
