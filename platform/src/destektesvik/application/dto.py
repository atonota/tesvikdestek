"""Small carriers between layers."""

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class UserRecord:
    id: str
    tenant_id: str
    email: str
    password_hash: str


@dataclass(frozen=True, slots=True)
class LoginResult:
    token: str
    user: UserRecord
