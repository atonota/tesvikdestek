"""Small infrastructure adapters: clock, ids, tokens, password hashing."""

import hashlib
import secrets
import uuid
from datetime import UTC, datetime

from argon2 import PasswordHasher as Argon2PasswordHasher
from argon2.exceptions import VerificationError, VerifyMismatchError


class SystemClock:
    def now(self) -> datetime:
        return datetime.now(UTC)


class FrozenClock:
    """Used by tests so decision timestamps are reproducible."""

    def __init__(self, moment: datetime) -> None:
        self._moment = moment

    def now(self) -> datetime:
        return self._moment


class UuidFactory:
    def new(self) -> str:
        return uuid.uuid4().hex


class SequentialIdFactory:
    """Deterministic ids for tests."""

    def __init__(self, prefix: str = "id") -> None:
        self._prefix = prefix
        self._counter = 0

    def new(self) -> str:
        self._counter += 1
        return f"{self._prefix}-{self._counter:06d}"


class Argon2Hasher:
    """Argon2id via ``argon2-cffi`` defaults."""

    def __init__(self) -> None:
        self._hasher = Argon2PasswordHasher()

    def hash(self, password: str) -> str:
        return self._hasher.hash(password)

    def verify(self, password_hash: str, password: str) -> bool:
        try:
            return self._hasher.verify(password_hash, password)
        except (VerifyMismatchError, VerificationError, ValueError):
            return False


class OpaqueTokenFactory:
    """Random opaque session tokens; only the fingerprint is ever stored.

    There is no JWT here and none in localStorage: this is a server-rendered
    app, so an opaque cookie-backed session is both simpler and revocable.
    """

    def __init__(self, entropy_bytes: int = 32) -> None:
        self._entropy_bytes = entropy_bytes

    def new_token(self) -> str:
        return secrets.token_urlsafe(self._entropy_bytes)

    def fingerprint(self, token: str) -> str:
        return hashlib.sha256(token.encode("utf-8")).hexdigest()
