"""Initial schema, row level security and append-only guarantees.

Revision ID: 0001_initial
Revises:
Create Date: 2026-08-14

Three things happen here that cannot happen in application code:

1. ``FORCE ROW LEVEL SECURITY`` on tenant tables, so a forgotten ``WHERE``
   clause is not a data leak.
2. ``BEFORE UPDATE OR DELETE`` triggers on the decision, approval and audit
   tables, so "append-only" is a property of the database rather than a habit
   of the developer.
3. Grants to the application role - which is explicitly *not* the role running
   this migration, and must not be a superuser or hold BYPASSRLS.

Grants are enumerated per table, not handed out wholesale.  `GRANT ... ON ALL
TABLES` plus `ALTER DEFAULT PRIVILEGES` used to give the web role full DML on
the versioned catalogue a decision cites as its evidence - and on every table
any future migration might add.  Least privilege here means a new table arrives
with no application access until a migration says otherwise.
"""

import os
import re
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

APP_ROLE = os.environ.get("DESTEKTESVIK_APP_DB_ROLE", "destektesvik_app")

#: Tenant tables that are only ever touched by an authenticated request.
#: Their policy has no escape hatch.
STRICT_TENANT_TABLES = ("company_profiles", "decisions", "approvals", "audit_events")

#: The tenant registry itself.  Its tenant column is the primary key, so it
#: needs its own policy rather than the generic ``tenant_id`` one.
TENANT_REGISTRY_TABLE = "tenants"

#: Pre-auth tables and the exact-match column/GUC pair that may expose a single
#: row while no tenant is established.
#:
#: This is the whole of the pre-auth window.  A request with no tenant sees a
#: row only when it already knows that row's e-mail address or session token
#: fingerprint - which is exactly what registration, login and session
#: authentication legitimately supply.  ``WITH CHECK`` stays tenant-scoped on
#: both tables: a lookup may reveal one row, never authorise a write.
LOOKUP_TENANT_TABLES = (
    ("users", ("email", "app.lookup_email")),
    ("user_sessions", ("token_fingerprint", "app.lookup_session_fingerprint")),
)

APPEND_ONLY_TABLES = ("decisions", "approvals", "audit_events")

CATALOG_TABLES = ("source_snapshots", "program_versions", "rule_set_versions", "schema_flags")

#: The catalogue is versioned evidence.  The engine reads it to decide, and a
#: decision is defensible because it names the snapshot it rested on.  A web
#: role that can rewrite it can rewrite the past.
RUNTIME_READ_ONLY_TABLES = CATALOG_TABLES

#: Exactly what the running application does with each table, and nothing more.
#: Anything absent here the application role simply cannot do.
RUNTIME_TABLE_PRIVILEGES: dict[str, tuple[str, ...]] = {
    # Registration inserts one tenant and one user.
    "tenants": ("SELECT", "INSERT"),
    "users": ("SELECT", "INSERT"),
    # Sessions are created on login and revoked - an UPDATE - on logout.
    "user_sessions": ("SELECT", "INSERT", "UPDATE"),
    # The company profile is an upsert.
    "company_profiles": ("SELECT", "INSERT", "UPDATE"),
    # Append-only.  The absent UPDATE/DELETE grant is the first layer; the
    # trigger below is the second.  Neither is load bearing alone.
    "decisions": ("SELECT", "INSERT"),
    "approvals": ("SELECT", "INSERT"),
    "audit_events": ("SELECT", "INSERT"),
    # Read-only catalogue.
    **dict.fromkeys(RUNTIME_READ_ONLY_TABLES, ("SELECT",)),
}

#: Nothing in this application deletes a row, so nothing is granted DELETE.
#: Migration bookkeeping (`alembic_version`) is likewise never granted: it
#: belongs to the migration role, and the runtime never reads it.


def validate_app_role(role: str) -> str:
    """The role name comes from deployment configuration, never from a request."""
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", role):
        raise ValueError(f"DESTEKTESVIK_APP_DB_ROLE is not a valid identifier: {role!r}")
    return role


def _is_postgres() -> bool:
    return op.get_bind().dialect.name == "postgresql"


def upgrade() -> None:
    op.create_table(
        "tenants",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "users",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("password_hash", sa.String(512), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_tenant_id", "users", ["tenant_id"])

    op.create_table(
        "user_sessions",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("token_fingerprint", sa.String(128), nullable=False, unique=True),
        sa.Column("user_id", sa.String(64), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("tenant_id", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_user_sessions_tenant_id", "user_sessions", ["tenant_id"])

    op.create_table(
        "company_profiles",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False),
        sa.Column("display_name", sa.String(300), nullable=False),
        sa.Column("facts", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("tenant_id", name="uq_company_profiles_tenant"),
    )
    op.create_index("ix_company_profiles_tenant_id", "company_profiles", ["tenant_id"])

    op.create_table(
        "source_snapshots",
        sa.Column("id", sa.String(128), primary_key=True),
        sa.Column("url", sa.String(1000), nullable=False),
        sa.Column("publisher", sa.String(200), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("captured_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("content_hash", sa.String(64), nullable=False),
        sa.Column("effective_from", sa.String(10), nullable=True),
        sa.Column("effective_to", sa.String(10), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("review_status", sa.String(32), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
    )
    op.create_table(
        "program_versions",
        sa.Column("id", sa.String(128), primary_key=True),
        sa.Column("code", sa.String(64), nullable=False),
        sa.Column("name", sa.String(300), nullable=False),
        sa.Column("version", sa.String(32), nullable=False),
        sa.Column("support_type", sa.String(48), nullable=False),
        sa.Column("official_url", sa.String(1000), nullable=False),
        sa.Column("source_snapshot_ids", sa.JSON(), nullable=False),
        sa.Column("opens_on", sa.String(10), nullable=True),
        sa.Column("closes_on", sa.String(10), nullable=True),
        sa.Column("published_reference_minor_units", sa.Integer(), nullable=True),
        sa.Column("published_reference_currency", sa.String(3), nullable=True),
        sa.Column("required_documents", sa.JSON(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=False),
    )
    op.create_index("ix_program_versions_code", "program_versions", ["code"])

    op.create_table(
        "rule_set_versions",
        sa.Column("id", sa.String(128), primary_key=True),
        sa.Column("program_code", sa.String(64), nullable=False),
        sa.Column("version", sa.String(32), nullable=False),
        sa.Column("rule", sa.JSON(), nullable=False),
    )
    op.create_index("ix_rule_set_versions_program_code", "rule_set_versions", ["program_code"])

    op.create_table(
        "decisions",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False),
        sa.Column("profile_id", sa.String(64), nullable=False),
        sa.Column("program_code", sa.String(64), nullable=False),
        sa.Column("program_version_id", sa.String(128), nullable=False),
        sa.Column("rule_set_version_id", sa.String(128), nullable=False),
        sa.Column("outcome", sa.String(32), nullable=False),
        sa.Column("input_hash", sa.String(64), nullable=False),
        sa.Column("decision_hash", sa.String(64), nullable=False),
        sa.Column("source_snapshot_ids", sa.JSON(), nullable=False),
        sa.Column("reasons", sa.JSON(), nullable=False),
        sa.Column("missing_facts", sa.JSON(), nullable=False),
        sa.Column("traces", sa.JSON(), nullable=False),
        sa.Column("review_status", sa.String(32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_decisions_tenant_id", "decisions", ["tenant_id"])
    op.create_index("ix_decisions_tenant_created", "decisions", ["tenant_id", "created_at"])

    op.create_table(
        "approvals",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False),
        sa.Column("decision_id", sa.String(64), nullable=False),
        sa.Column("actor_user_id", sa.String(64), nullable=False),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("note", sa.Text(), nullable=False),
        sa.Column("label", sa.String(64), nullable=False),
    )
    op.create_index("ix_approvals_tenant_id", "approvals", ["tenant_id"])
    op.create_index("ix_approvals_decision_id", "approvals", ["decision_id"])

    op.create_table(
        "audit_events",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False),
        sa.Column("actor", sa.String(128), nullable=False),
        sa.Column("action", sa.String(64), nullable=False),
        sa.Column("subject", sa.String(128), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
    )
    op.create_index("ix_audit_events_tenant_id", "audit_events", ["tenant_id"])

    op.create_table(
        "schema_flags",
        sa.Column("key", sa.String(64), primary_key=True),
        sa.Column("value", sa.String(200), nullable=False),
        sa.Column("is_set", sa.Boolean(), nullable=False),
    )

    if not _is_postgres():
        # SQLite has neither RLS nor PL/pgSQL.  The host-runnable test suite
        # therefore exercises the application-layer guards only, and says so.
        return

    op.execute(
        """
        CREATE OR REPLACE FUNCTION destektesvik_reject_mutation()
        RETURNS trigger AS $$
        BEGIN
            RAISE EXCEPTION
                'append-only table %: % is not permitted. A correction is a new row.',
                TG_TABLE_NAME, TG_OP;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    for table in APPEND_ONLY_TABLES:
        op.execute(
            f"""
            CREATE TRIGGER {table}_append_only
            BEFORE UPDATE OR DELETE ON {table}
            FOR EACH ROW EXECUTE FUNCTION destektesvik_reject_mutation();
            """
        )

    for table in STRICT_TENANT_TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(
            f"""
            CREATE POLICY {table}_tenant_isolation ON {table}
            USING (tenant_id = current_setting('app.current_tenant', true))
            WITH CHECK (tenant_id = current_setting('app.current_tenant', true));
            """
        )

    # A tenant row is tenant data too.  Its scope column is the primary key.
    op.execute(f"ALTER TABLE {TENANT_REGISTRY_TABLE} ENABLE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {TENANT_REGISTRY_TABLE} FORCE ROW LEVEL SECURITY")
    op.execute(
        f"""
        CREATE POLICY {TENANT_REGISTRY_TABLE}_tenant_isolation ON {TENANT_REGISTRY_TABLE}
        USING (id = current_setting('app.current_tenant', true))
        WITH CHECK (id = current_setting('app.current_tenant', true));
        """
    )

    for table, (column, lookup_setting) in LOOKUP_TENANT_TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        # Readable when the tenant matches, OR when the caller already knows
        # this exact row's identifier.  `nullif(..., '')` is load bearing: an
        # unset or blank lookup must match nothing, not everything.
        op.execute(
            f"""
            CREATE POLICY {table}_tenant_isolation ON {table}
            USING (
                tenant_id = current_setting('app.current_tenant', true)
                OR {column} = nullif(current_setting('{lookup_setting}', true), '')
            )
            WITH CHECK (tenant_id = current_setting('app.current_tenant', true));
            """
        )

    # The role name comes from deployment configuration, never from a request,
    # and is validated below before it reaches SQL.
    validate_app_role(APP_ROLE)
    # A missing application role used to mean "skip the grants quietly", which
    # produced a database that looked migrated and refused every real request.
    # It is an error now.
    op.execute(
        "DO $$ BEGIN "
        f"IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{APP_ROLE}') THEN "  # noqa: S608
        "RAISE EXCEPTION "
        f"'application role {APP_ROLE} does not exist; create it (NOSUPERUSER, "
        "NOBYPASSRLS) before migrating, or row level security will not be "
        "enforced for the application'; "
        "END IF; END $$;"
    )
    op.execute(f"GRANT USAGE ON SCHEMA public TO {APP_ROLE}")
    # One statement per table, listing the verbs that table actually needs.
    for table, privileges in RUNTIME_TABLE_PRIVILEGES.items():
        op.execute(f"GRANT {', '.join(privileges)} ON {table} TO {APP_ROLE}")


def downgrade() -> None:
    if _is_postgres():
        for table in APPEND_ONLY_TABLES:
            op.execute(f"DROP TRIGGER IF EXISTS {table}_append_only ON {table}")
        op.execute("DROP FUNCTION IF EXISTS destektesvik_reject_mutation()")
        lookup_tables = tuple(table for table, _ in LOOKUP_TENANT_TABLES)
        for table in STRICT_TENANT_TABLES + (TENANT_REGISTRY_TABLE,) + lookup_tables:
            op.execute(f"DROP POLICY IF EXISTS {table}_tenant_isolation ON {table}")
            op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")

    for table in (
        "schema_flags",
        "audit_events",
        "approvals",
        "decisions",
        "rule_set_versions",
        "program_versions",
        "source_snapshots",
        "company_profiles",
        "user_sessions",
        "users",
        "tenants",
    ):
        op.drop_table(table)
