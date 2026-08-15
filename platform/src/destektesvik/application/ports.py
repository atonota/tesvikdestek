"""Ports: what the application needs from the outside world.

These are Protocols, not base classes.  Adapters satisfy them structurally,
which keeps the dependency arrow pointing inwards: adapters know about the
application, never the other way round.
"""

from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import Any, Protocol

from destektesvik.application.dto import UserRecord
from destektesvik.domain.decisions import ApprovalEvent, AuditEvent, DecisionRecord
from destektesvik.domain.profile import CompanyProfile
from destektesvik.domain.programs import ProgramVersion, RuleSetVersion
from destektesvik.domain.sources import SourceSnapshot


class Clock(Protocol):
    def now(self) -> datetime: ...


class IdFactory(Protocol):
    def new(self) -> str: ...


class PasswordHasher(Protocol):
    def hash(self, password: str) -> str: ...

    def verify(self, password_hash: str, password: str) -> bool: ...


class TokenFactory(Protocol):
    def new_token(self) -> str: ...

    def fingerprint(self, token: str) -> str: ...


class RequestScope(Protocol):
    """Transaction-local scoping the storage layer enforces for us.

    On PostgreSQL these become ``set_config(..., true)`` settings that the row
    level security policies read.  On SQLite they are no-ops, which is why the
    explicit ``tenant_id`` filters in the repositories are not optional.
    """

    def set_tenant(self, tenant_id: str | None) -> None: ...

    def set_lookup_email(self, email: str | None) -> None: ...

    def set_lookup_session_fingerprint(self, fingerprint: str | None) -> None: ...

    def clear_lookups(self) -> None: ...


class NullRequestScope:
    """A scope that scopes nothing - for stores with no policy engine."""

    def set_tenant(self, tenant_id: str | None) -> None:
        return None

    def set_lookup_email(self, email: str | None) -> None:
        return None

    def set_lookup_session_fingerprint(self, fingerprint: str | None) -> None:
        return None

    def clear_lookups(self) -> None:
        return None


class ProgramCatalog(Protocol):
    @property
    def programs(self) -> tuple[ProgramVersion, ...]: ...

    @property
    def snapshots(self) -> dict[str, SourceSnapshot]: ...

    @property
    def snapshot_texts(self) -> dict[str, str]: ...

    def rule_set_for(self, program_code: str) -> RuleSetVersion: ...


class TenantRepository(Protocol):
    def create(self, tenant_id: str, name: str, created_at: datetime) -> None: ...


class UserRepository(Protocol):
    def create(
        self,
        user_id: str,
        tenant_id: str,
        email: str,
        password_hash: str,
        created_at: datetime,
    ) -> None: ...

    def find_by_email(self, email: str) -> UserRecord | None: ...

    def email_exists(self, email: str) -> bool: ...


class SessionRepository(Protocol):
    def create(
        self,
        session_id: str,
        token_fingerprint: str,
        user_id: str,
        tenant_id: str,
        created_at: datetime,
        expires_at: datetime,
    ) -> None: ...

    def find_active(self, token_fingerprint: str, now: datetime) -> UserRecord | None: ...

    def revoke(self, token_fingerprint: str, revoked_at: datetime) -> None: ...


class ProfileRepository(Protocol):
    def upsert(self, profile: CompanyProfile, updated_at: datetime) -> None: ...

    def get(self, tenant_id: str) -> CompanyProfile | None: ...

    def get_by_id(self, tenant_id: str, profile_id: str) -> CompanyProfile | None: ...


class DecisionRepository(Protocol):
    def add(self, decision: DecisionRecord) -> None: ...

    def list_for_tenant(self, tenant_id: str) -> Sequence[DecisionRecord]: ...

    def get(self, tenant_id: str, decision_id: str) -> DecisionRecord | None: ...


class ApprovalRepository(Protocol):
    def add(self, approval: ApprovalEvent) -> None: ...

    def list_for_decision(self, tenant_id: str, decision_id: str) -> Sequence[ApprovalEvent]: ...


class AuditRepository(Protocol):
    def add(self, event: AuditEvent) -> None: ...

    def list_for_tenant(self, tenant_id: str) -> Sequence[AuditEvent]: ...


class AiExplainerPort(Protocol):
    name: str

    def explain(self, prompt: str) -> Mapping[str, Any]: ...
