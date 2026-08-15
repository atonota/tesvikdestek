"""SQLAlchemy repositories.

Every tenant-scoped query filters on ``tenant_id`` explicitly.  PostgreSQL RLS
is the second line of defence, not a reason to skip the first: on SQLite there
is no RLS at all, and in production a policy can be misconfigured.
"""

from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from destektesvik.application.dto import UserRecord
from destektesvik.domain.decisions import (
    ApprovalEvent,
    AuditEvent,
    DecisionRecord,
    DecisionReviewStatus,
)
from destektesvik.domain.evaluation import EligibilityOutcome
from destektesvik.domain.profile import CompanyProfile

from .models import (
    ApprovalRow,
    AuditEventRow,
    CompanyProfileRow,
    DecisionRow,
    Tenant,
    User,
    UserSession,
)
from .session import apply_tenant_scope


class TenantRepositoryImpl:
    def __init__(self, session: Session) -> None:
        self._session = session

    def create(self, tenant_id: str, name: str, created_at: datetime) -> None:
        self._session.add(Tenant(id=tenant_id, name=name, created_at=created_at))
        self._session.flush()


class UserRepositoryImpl:
    def __init__(self, session: Session) -> None:
        self._session = session

    def create(
        self,
        user_id: str,
        tenant_id: str,
        email: str,
        password_hash: str,
        created_at: datetime,
    ) -> None:
        self._session.add(
            User(
                id=user_id,
                tenant_id=tenant_id,
                email=email,
                password_hash=password_hash,
                created_at=created_at,
            )
        )
        self._session.flush()

    def find_by_email(self, email: str) -> UserRecord | None:
        row = self._session.scalar(select(User).where(User.email == email))
        if row is None:
            return None
        return UserRecord(
            id=row.id,
            tenant_id=row.tenant_id,
            email=row.email,
            password_hash=row.password_hash,
        )

    def email_exists(self, email: str) -> bool:
        return self._session.scalar(select(User.id).where(User.email == email)) is not None


class SessionRepositoryImpl:
    def __init__(self, session: Session) -> None:
        self._session = session

    def create(
        self,
        session_id: str,
        token_fingerprint: str,
        user_id: str,
        tenant_id: str,
        created_at: datetime,
        expires_at: datetime,
    ) -> None:
        self._session.add(
            UserSession(
                id=session_id,
                token_fingerprint=token_fingerprint,
                user_id=user_id,
                tenant_id=tenant_id,
                created_at=created_at,
                expires_at=expires_at,
            )
        )
        self._session.flush()

    def find_active(self, token_fingerprint: str, now: datetime) -> UserRecord | None:
        row = self._session.scalar(
            select(UserSession).where(UserSession.token_fingerprint == token_fingerprint)
        )
        if row is None or row.revoked_at is not None:
            return None
        expires_at = row.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=now.tzinfo)
        if expires_at <= now:
            return None
        # The session row identifies its tenant, so the tenant scope can be
        # narrowed *before* the user is read.  Without this the user lookup
        # would have no scope at all, and the `users` policy would - correctly -
        # return nothing.
        apply_tenant_scope(self._session, row.tenant_id)
        user = self._session.get(User, row.user_id)
        if user is None:
            return None
        if user.tenant_id != row.tenant_id:
            # Belt and braces: a session may only ever resolve a user inside its
            # own tenant, whatever the database returned.
            return None
        return UserRecord(id=user.id, tenant_id=user.tenant_id, email=user.email, password_hash="")

    def revoke(self, token_fingerprint: str, revoked_at: datetime) -> None:
        row = self._session.scalar(
            select(UserSession).where(UserSession.token_fingerprint == token_fingerprint)
        )
        if row is not None:
            # Logging out an already-expired or already-revoked session reaches
            # here with no authenticated tenant, and the UPDATE's WITH CHECK is
            # tenant-scoped.  The row itself says which tenant it belongs to.
            apply_tenant_scope(self._session, row.tenant_id)
            row.revoked_at = revoked_at
            self._session.flush()


class ProfileRepositoryImpl:
    def __init__(self, session: Session) -> None:
        self._session = session

    def upsert(self, profile: CompanyProfile, updated_at: datetime) -> None:
        row = self._session.scalar(
            select(CompanyProfileRow).where(CompanyProfileRow.tenant_id == profile.tenant_id)
        )
        if row is None:
            self._session.add(
                CompanyProfileRow(
                    id=profile.id,
                    tenant_id=profile.tenant_id,
                    display_name=profile.display_name,
                    facts=dict(profile.facts),
                    created_at=updated_at,
                    updated_at=updated_at,
                )
            )
        else:
            row.display_name = profile.display_name
            row.facts = dict(profile.facts)
            row.updated_at = updated_at
        self._session.flush()

    def _to_domain(self, row: CompanyProfileRow) -> CompanyProfile:
        return CompanyProfile(
            id=row.id,
            tenant_id=row.tenant_id,
            display_name=row.display_name,
            facts=dict(row.facts or {}),
        )

    def get(self, tenant_id: str) -> CompanyProfile | None:
        row = self._session.scalar(
            select(CompanyProfileRow).where(CompanyProfileRow.tenant_id == tenant_id)
        )
        return self._to_domain(row) if row else None

    def get_by_id(self, tenant_id: str, profile_id: str) -> CompanyProfile | None:
        row = self._session.scalar(
            select(CompanyProfileRow).where(
                CompanyProfileRow.tenant_id == tenant_id,
                CompanyProfileRow.id == profile_id,
            )
        )
        return self._to_domain(row) if row else None


def _decision_to_domain(row: DecisionRow) -> DecisionRecord:
    return DecisionRecord(
        id=row.id,
        tenant_id=row.tenant_id,
        profile_id=row.profile_id,
        program_code=row.program_code,
        program_version_id=row.program_version_id,
        rule_set_version_id=row.rule_set_version_id,
        outcome=EligibilityOutcome(row.outcome),
        input_hash=row.input_hash,
        decision_hash=row.decision_hash,
        source_snapshot_ids=tuple(row.source_snapshot_ids or ()),
        created_at=row.created_at,
        review_status=DecisionReviewStatus(row.review_status),
        reasons=tuple(row.reasons or ()),
        missing_facts=tuple(row.missing_facts or ()),
        traces=tuple(row.traces or ()),
    )


class DecisionRepositoryImpl:
    def __init__(self, session: Session) -> None:
        self._session = session

    def add(self, decision: DecisionRecord) -> None:
        self._session.add(
            DecisionRow(
                id=decision.id,
                tenant_id=decision.tenant_id,
                profile_id=decision.profile_id,
                program_code=decision.program_code,
                program_version_id=decision.program_version_id,
                rule_set_version_id=decision.rule_set_version_id,
                outcome=decision.outcome.value,
                input_hash=decision.input_hash,
                decision_hash=decision.decision_hash,
                source_snapshot_ids=list(decision.source_snapshot_ids),
                reasons=list(decision.reasons),
                missing_facts=list(decision.missing_facts),
                traces=[dict(trace) for trace in decision.traces],
                review_status=decision.review_status.value,
                created_at=decision.created_at,
            )
        )
        self._session.flush()

    def list_for_tenant(self, tenant_id: str) -> Sequence[DecisionRecord]:
        rows = self._session.scalars(
            select(DecisionRow)
            .where(DecisionRow.tenant_id == tenant_id)
            .order_by(DecisionRow.created_at.desc(), DecisionRow.program_code)
        ).all()
        return [_decision_to_domain(row) for row in rows]

    def get(self, tenant_id: str, decision_id: str) -> DecisionRecord | None:
        row = self._session.scalar(
            select(DecisionRow).where(
                DecisionRow.id == decision_id,
                DecisionRow.tenant_id == tenant_id,
            )
        )
        return _decision_to_domain(row) if row else None


class ApprovalRepositoryImpl:
    def __init__(self, session: Session) -> None:
        self._session = session

    def add(self, approval: ApprovalEvent) -> None:
        self._session.add(
            ApprovalRow(
                id=approval.id,
                tenant_id=approval.tenant_id,
                decision_id=approval.decision_id,
                actor_user_id=approval.actor_user_id,
                approved_at=approval.approved_at,
                note=approval.note,
                label=approval.label,
            )
        )
        self._session.flush()

    def list_for_decision(self, tenant_id: str, decision_id: str) -> Sequence[ApprovalEvent]:
        rows = self._session.scalars(
            select(ApprovalRow)
            .where(ApprovalRow.tenant_id == tenant_id, ApprovalRow.decision_id == decision_id)
            .order_by(ApprovalRow.approved_at)
        ).all()
        return [
            ApprovalEvent(
                id=row.id,
                tenant_id=row.tenant_id,
                decision_id=row.decision_id,
                actor_user_id=row.actor_user_id,
                approved_at=row.approved_at,
                note=row.note,
                label=row.label,
            )
            for row in rows
        ]


class AuditRepositoryImpl:
    def __init__(self, session: Session) -> None:
        self._session = session

    def add(self, event: AuditEvent) -> None:
        self._session.add(
            AuditEventRow(
                id=event.id,
                tenant_id=event.tenant_id,
                actor=event.actor,
                action=event.action,
                subject=event.subject,
                occurred_at=event.occurred_at,
                payload=dict(event.payload),
            )
        )
        self._session.flush()

    def list_for_tenant(self, tenant_id: str) -> Sequence[AuditEvent]:
        rows = self._session.scalars(
            select(AuditEventRow)
            .where(AuditEventRow.tenant_id == tenant_id)
            .order_by(AuditEventRow.occurred_at)
        ).all()
        return [
            AuditEvent(
                id=row.id,
                tenant_id=row.tenant_id,
                actor=row.actor,
                action=row.action,
                subject=row.subject,
                occurred_at=row.occurred_at,
                payload=dict(row.payload or {}),
            )
            for row in rows
        ]
