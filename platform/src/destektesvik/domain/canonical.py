"""Canonical serialisation and hashing.

Two machines must agree on the bytes before they can agree on a decision hash.
That is the whole point of this module, so it is deliberately strict:

* mapping keys are sorted and must be strings;
* ``Decimal`` is written as its exact string form, never through ``float``;
* ``float`` is refused outright - it is the one type that can silently make
  two hosts disagree about money;
* datetimes are normalised to UTC and written as ISO-8601;
* the output is ASCII-escaped so no locale or filesystem encoding can change
  the bytes.
"""

import hashlib
import json
from datetime import UTC, date, datetime
from decimal import Decimal
from enum import Enum
from typing import Any

from destektesvik.domain.errors import MoneyError


def _normalise(value: Any) -> Any:
    if isinstance(value, float):
        raise MoneyError(
            "float is not allowed in canonical serialisation; use Decimal or integer minor units"
        )
    if value is None or isinstance(value, bool | int | str):
        return value
    if isinstance(value, Enum):
        return _normalise(value.value)
    if isinstance(value, Decimal):
        return format(value, "f")
    if isinstance(value, datetime):
        moment = value if value.tzinfo is not None else value.replace(tzinfo=UTC)
        return moment.astimezone(UTC).isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, dict):
        normalised: dict[str, Any] = {}
        for key, item in value.items():
            if not isinstance(key, str):
                raise MoneyError(f"canonical mapping keys must be strings, got {type(key)!r}")
            normalised[key] = _normalise(item)
        return normalised
    if isinstance(value, list | tuple | set | frozenset):
        items = [_normalise(item) for item in value]
        if isinstance(value, set | frozenset):
            items.sort(key=repr)
        return items
    raise MoneyError(f"value of type {type(value)!r} has no canonical form")


def canonical_json(value: Any) -> str:
    """Return the one and only JSON text for ``value``."""
    return json.dumps(
        _normalise(value),
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=True,
    )


def sha256_hex(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def canonical_hash(value: Any) -> str:
    return sha256_hex(canonical_json(value))
