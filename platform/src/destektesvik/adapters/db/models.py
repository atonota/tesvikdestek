"""ORM models.

Deliberately dialect-portable: JSON rather than JSONB, string ids rather than
native UUID.  PostgreSQL-specific security - row level security and the
append-only triggers - lives in the migration, not here, so the host-runnable
part of the test suite can use SQLite while the real deployment keeps its
database-enforced guarantees.

``tenant_id`` on every tenant-scoped table is the application half of the
isolation story.  RLS is the other half; neither is trusted alone.
"""

from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


#: Tables carrying tenant data.  The migration puts RLS on exactly these.
TENANT_SCOPED_TABLES = (
    "users",
    "user_sessions",
    "company_profiles",
    "decisions",
    "approvals",
    "audit_events",
)

#: Tables the database refuses to UPDATE or DELETE.
APPEND_ONLY_TABLES = ("decisions", "approvals", "audit_events")


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("tenants.id"), nullable=False, index=True
    )
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(512), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (UniqueConstraint("email", name="uq_users_email"),)


class UserSession(Base):
    __tablename__ = "user_sessions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    #: Only the fingerprint is stored.  A database dump does not hand anyone a
    #: usable session.
    token_fingerprint: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    user_id: Mapped[str] = mapped_column(String(64), ForeignKey("users.id"), nullable=False)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class CompanyProfileRow(Base):
    __tablename__ = "company_profiles"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(300), nullable=False)
    facts: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (UniqueConstraint("tenant_id", name="uq_company_profiles_tenant"),)


class SourceSnapshotRow(Base):
    """Catalogue data, shared by every tenant.  Not tenant scoped, not RLS'd."""

    __tablename__ = "source_snapshots"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    url: Mapped[str] = mapped_column(String(1000), nullable=False)
    publisher: Mapped[str] = mapped_column(String(200), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    effective_from: Mapped[str | None] = mapped_column(String(10), nullable=True)
    effective_to: Mapped[str | None] = mapped_column(String(10), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    review_status: Mapped[str] = mapped_column(String(32), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")


class ProgramVersionRow(Base):
    __tablename__ = "program_versions"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    version: Mapped[str] = mapped_column(String(32), nullable=False)
    support_type: Mapped[str] = mapped_column(String(48), nullable=False)
    official_url: Mapped[str] = mapped_column(String(1000), nullable=False)
    source_snapshot_ids: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    opens_on: Mapped[str | None] = mapped_column(String(10), nullable=True)
    closes_on: Mapped[str | None] = mapped_column(String(10), nullable=True)
    #: Minor units.  Nullable because "the source did not publish one" is a
    #: real and common answer.
    published_reference_minor_units: Mapped[int | None] = mapped_column(Integer, nullable=True)
    published_reference_currency: Mapped[str | None] = mapped_column(String(3), nullable=True)
    required_documents: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")


class RuleSetVersionRow(Base):
    __tablename__ = "rule_set_versions"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    program_code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    version: Mapped[str] = mapped_column(String(32), nullable=False)
    #: Rules are data.  This column is the whole point of that decision.
    rule: Mapped[dict] = mapped_column(JSON, nullable=False)


class DecisionRow(Base):
    """Append-only.  UPDATE and DELETE are refused by a database trigger."""

    __tablename__ = "decisions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    profile_id: Mapped[str] = mapped_column(String(64), nullable=False)
    program_code: Mapped[str] = mapped_column(String(64), nullable=False)
    program_version_id: Mapped[str] = mapped_column(String(128), nullable=False)
    rule_set_version_id: Mapped[str] = mapped_column(String(128), nullable=False)
    outcome: Mapped[str] = mapped_column(String(32), nullable=False)
    input_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    decision_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    source_snapshot_ids: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    reasons: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    missing_facts: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    traces: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    review_status: Mapped[str] = mapped_column(String(32), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (Index("ix_decisions_tenant_created", "tenant_id", "created_at"),)


class ApprovalRow(Base):
    """The user's own approval.  Append-only, never an institution's decision."""

    __tablename__ = "approvals"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    decision_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    actor_user_id: Mapped[str] = mapped_column(String(64), nullable=False)
    approved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    note: Mapped[str] = mapped_column(Text, nullable=False, default="")
    label: Mapped[str] = mapped_column(String(64), nullable=False, default="Kullanici onayi")


class AuditEventRow(Base):
    __tablename__ = "audit_events"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    actor: Mapped[str] = mapped_column(String(128), nullable=False)
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    subject: Mapped[str] = mapped_column(String(128), nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)


class SchemaFlag(Base):
    """Used by the seed script to stay idempotent."""

    __tablename__ = "schema_flags"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[str] = mapped_column(String(200), nullable=False)
    is_set: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
