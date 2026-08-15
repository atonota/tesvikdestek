"""Tests 7, 9 and 13 - the guarantees only PostgreSQL can give.

These are skipped without ``DESTEKTESVIK_TEST_DATABASE_URL`` and run in CI
against a real PostgreSQL service.  They are deliberately *not* faked on
SQLite: row level security and append-only triggers are PostgreSQL features,
and a green SQLite run would be a false assurance about the exact property
that matters most.

Two connections are used throughout:

* ``owner`` - the migration/admin role;
* ``app`` - the application role, which must be neither superuser nor
  BYPASSRLS.  If the environment only provides one role, the RLS assertions
  are skipped with an explicit message rather than passing vacuously.
"""

import os
import uuid
from datetime import UTC, datetime

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.exc import DBAPIError

from destektesvik.adapters.db.models import Base
from destektesvik.adapters.db.seed import seed_catalog
from destektesvik.adapters.db.session import create_session_factory

pytestmark = pytest.mark.integration

APP_URL_ENV = "DESTEKTESVIK_TEST_APP_DATABASE_URL"


@pytest.fixture
def owner_engine(postgres_url):
    engine = create_engine(postgres_url, future=True, poolclass=None)
    with engine.begin() as connection:
        connection.execute(text("DROP SCHEMA public CASCADE"))
        connection.execute(text("CREATE SCHEMA public"))
    yield engine
    engine.dispose()


@pytest.fixture
def migrated(owner_engine, postgres_url):
    """Run the real Alembic migration against an empty database."""
    from alembic import command
    from alembic.config import Config

    config = Config("alembic.ini")
    config.set_main_option("script_location", "migrations")
    os.environ["DESTEKTESVIK_MIGRATION_DATABASE_URL"] = postgres_url
    command.upgrade(config, "head")
    return owner_engine


@pytest.fixture
def app_engine(migrated):
    url = os.environ.get(APP_URL_ENV, "")
    if not url:
        pytest.skip(
            f"{APP_URL_ENV} is not set; without a separate non-superuser "
            "application role, RLS cannot be honestly verified"
        )
    engine = create_engine(url, future=True)
    yield engine
    engine.dispose()


def _insert_decision(connection, tenant_id: str, decision_id: str) -> None:
    connection.execute(
        text(
            """
            INSERT INTO decisions (
                id, tenant_id, profile_id, program_code, program_version_id,
                rule_set_version_id, outcome, input_hash, decision_hash,
                source_snapshot_ids, reasons, missing_facts, traces,
                review_status, created_at
            ) VALUES (
                :id, :tenant_id, 'p1', 'TUBITAK-1501', 'TUBITAK-1501@2026.1',
                'TUBITAK-1501:2026.1', 'conditional', :h, :h,
                '[]', '[]', '[]', '[]', 'current', :created_at
            )
            """
        ),
        {
            "id": decision_id,
            "tenant_id": tenant_id,
            "h": "0" * 64,
            "created_at": datetime.now(UTC),
        },
    )


#: Every table whose rows belong to exactly one tenant.  ``tenants`` is in this
#: list on purpose: a tenant row is itself tenant data.
TENANT_TABLES = (
    "tenants",
    "users",
    "user_sessions",
    "company_profiles",
    "decisions",
    "approvals",
    "audit_events",
)

#: Versioned evidence the engine reads and must never be able to rewrite.
CATALOG_TABLES = ("source_snapshots", "program_versions", "rule_set_versions", "schema_flags")


def _has_privilege(connection, table: str, privilege: str) -> bool:
    return bool(
        connection.scalar(
            text("SELECT has_table_privilege(current_user, :table, :privilege)"),
            {"table": table, "privilege": privilege},
        )
    )


def _scope(connection, *, tenant: str = "", email: str = "", fingerprint: str = "") -> None:
    """Set the transaction-local scopes exactly as the application does."""
    connection.execute(
        text(
            "SELECT set_config('app.current_tenant', :tenant, true), "
            "set_config('app.lookup_email', :email, true), "
            "set_config('app.lookup_session_fingerprint', :fingerprint, true)"
        ),
        {"tenant": tenant, "email": email, "fingerprint": fingerprint},
    )


def _seed_two_tenants(connection) -> None:
    """Two complete tenants, written by the owner role (which bypasses RLS)."""
    now = datetime.now(UTC)
    for suffix in ("a", "b"):
        tenant_id = f"tenant-{suffix}"
        connection.execute(
            text("INSERT INTO tenants (id, name, created_at) VALUES (:id, :name, :at)"),
            {"id": tenant_id, "name": f"Sirket {suffix.upper()}", "at": now},
        )
        connection.execute(
            text(
                "INSERT INTO users (id, tenant_id, email, password_hash, created_at) "
                "VALUES (:id, :tenant_id, :email, :hash, :at)"
            ),
            {
                "id": f"user-{suffix}",
                "tenant_id": tenant_id,
                "email": f"{suffix}@ornek.com.tr",
                "hash": f"argon2-placeholder-{suffix}",
                "at": now,
            },
        )
        connection.execute(
            text(
                "INSERT INTO user_sessions (id, token_fingerprint, user_id, tenant_id, "
                "created_at, expires_at) VALUES (:id, :fp, :user_id, :tenant_id, :at, :exp)"
            ),
            {
                "id": f"session-{suffix}",
                "fp": f"fingerprint-{suffix}",
                "user_id": f"user-{suffix}",
                "tenant_id": tenant_id,
                "at": now,
                "exp": now.replace(year=now.year + 1),
            },
        )
        connection.execute(
            text(
                "INSERT INTO company_profiles (id, tenant_id, display_name, facts, "
                "created_at, updated_at) VALUES (:id, :tenant_id, :name, '{}', :at, :at)"
            ),
            {
                "id": f"profile-{suffix}",
                "tenant_id": tenant_id,
                "name": f"Sirket {suffix}",
                "at": now,
            },
        )
        connection.execute(
            text(
                "INSERT INTO audit_events (id, tenant_id, actor, action, subject, "
                "occurred_at, payload) VALUES (:id, :tenant_id, 'u', 'x', 's', :at, '{}')"
            ),
            {"id": f"audit-{suffix}", "tenant_id": tenant_id, "at": now},
        )
        _insert_decision(connection, tenant_id, f"decision-{suffix}")


class TestMigration:
    def test_migration_runs_on_an_empty_database(self, migrated) -> None:
        with migrated.connect() as connection:
            tables = set(
                connection.scalars(
                    text(
                        "SELECT table_name FROM information_schema.tables "
                        "WHERE table_schema = 'public'"
                    )
                )
            )
        assert set(Base.metadata.tables) <= tables

    def test_row_level_security_is_actually_enabled_and_forced(self, migrated) -> None:
        expected = set(TENANT_TABLES)
        with migrated.connect() as connection:
            rows = connection.execute(
                text(
                    "SELECT relname, relrowsecurity, relforcerowsecurity "
                    "FROM pg_class WHERE relname = ANY(:names)"
                ),
                {"names": list(expected)},
            ).all()
        found = {name: (enabled, forced) for name, enabled, forced in rows}
        assert set(found) == expected
        for name, (enabled, forced) in found.items():
            assert enabled, f"RLS is not enabled on {name}"
            assert forced, f"RLS is not FORCEd on {name}"

    def test_every_tenant_table_has_an_isolation_policy(self, migrated) -> None:
        with migrated.connect() as connection:
            policies = set(connection.scalars(text("SELECT tablename FROM pg_policies")))
        assert set(TENANT_TABLES) <= policies


class TestAppendOnlyIsEnforcedByTheDatabase:
    @pytest.mark.parametrize("table", ["decisions", "approvals", "audit_events"])
    def test_the_append_only_trigger_exists(self, migrated, table) -> None:
        with migrated.connect() as connection:
            triggers = set(
                connection.scalars(text("SELECT tgname FROM pg_trigger WHERE NOT tgisinternal"))
            )
        assert f"{table}_append_only" in triggers

    def test_updating_a_decision_is_refused_by_the_database(self, migrated) -> None:
        decision_id = uuid.uuid4().hex
        with migrated.begin() as connection:
            _insert_decision(connection, "tenant-a", decision_id)
        with pytest.raises(Exception, match="append-only"), migrated.begin() as connection:
            connection.execute(
                text("UPDATE decisions SET outcome = 'candidate_eligible' WHERE id = :id"),
                {"id": decision_id},
            )

    def test_deleting_a_decision_is_refused_by_the_database(self, migrated) -> None:
        decision_id = uuid.uuid4().hex
        with migrated.begin() as connection:
            _insert_decision(connection, "tenant-a", decision_id)
        with pytest.raises(Exception, match="append-only"), migrated.begin() as connection:
            connection.execute(text("DELETE FROM decisions WHERE id = :id"), {"id": decision_id})

    def test_deleting_an_audit_event_is_refused_by_the_database(self, migrated) -> None:
        with migrated.begin() as connection:
            connection.execute(
                text(
                    "INSERT INTO audit_events (id, tenant_id, actor, action, subject, "
                    "occurred_at, payload) VALUES (:id, 'tenant-a', 'u1', 'x', 's', "
                    ":at, '{}')"
                ),
                {"id": uuid.uuid4().hex, "at": datetime.now(UTC)},
            )
        with pytest.raises(Exception, match="append-only"), migrated.begin() as connection:
            connection.execute(text("DELETE FROM audit_events"))


class TestRowLevelSecurityUnderTheApplicationRole:
    def test_the_application_role_is_not_a_superuser_and_lacks_bypassrls(self, app_engine) -> None:
        with app_engine.connect() as connection:
            role = connection.execute(
                text("SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user")
            ).one()
        assert role.rolsuper is False, "the application role must not be a superuser"
        assert role.rolbypassrls is False, "the application role must not hold BYPASSRLS"

    def test_tenant_a_cannot_read_tenant_b_rows(self, migrated, app_engine) -> None:
        with migrated.begin() as connection:
            _insert_decision(connection, "tenant-a", uuid.uuid4().hex)
            _insert_decision(connection, "tenant-b", uuid.uuid4().hex)

        with app_engine.begin() as connection:
            connection.execute(text("SELECT set_config('app.current_tenant', 'tenant-a', true)"))
            visible = set(connection.scalars(text("SELECT tenant_id FROM decisions")))
        assert visible == {"tenant-a"}

    def test_tenant_a_cannot_write_a_row_for_tenant_b(self, migrated, app_engine) -> None:
        with pytest.raises(DBAPIError), app_engine.begin() as connection:
            connection.execute(text("SELECT set_config('app.current_tenant', 'tenant-a', true)"))
            _insert_decision(connection, "tenant-b", uuid.uuid4().hex)

    def test_the_tenant_setting_does_not_leak_between_transactions(
        self, migrated, app_engine
    ) -> None:
        """``set_config(..., true)`` is transaction local; a pooled connection
        must not carry one tenant's identity into the next request."""
        with migrated.begin() as connection:
            _insert_decision(connection, "tenant-a", uuid.uuid4().hex)

        with app_engine.connect() as connection:
            with connection.begin():
                connection.execute(
                    text("SELECT set_config('app.current_tenant', 'tenant-a', true)")
                )
                assert connection.scalar(text("SELECT count(*) FROM decisions")) == 1
            with connection.begin():
                # No tenant set in this transaction: the strict policy hides everything.
                assert connection.scalar(text("SELECT count(*) FROM decisions")) == 0


@pytest.fixture
def seeded(migrated):
    """Two fully populated tenants, inserted by the owner role."""
    with migrated.begin() as connection:
        _seed_two_tenants(connection)
    return migrated


class TestPreAuthLookupScopes:
    """Finding A - the pre-auth window must be one row wide, not one table wide.

    Registration, login and session lookup genuinely happen before a tenant is
    known.  The old policy answered that by exposing *every* row of ``users``,
    ``user_sessions`` and ``audit_events`` whenever ``app.current_tenant`` was
    unset.  A single missed ``apply_tenant_scope`` was therefore a full
    cross-tenant credential and session read.  The replacement exposes exactly
    the row whose e-mail or token fingerprint the caller already knows.
    """

    def test_no_tenant_and_no_lookup_sees_nothing_at_all(self, seeded, app_engine) -> None:
        with app_engine.begin() as connection:
            counts = {
                table: connection.scalar(text(f"SELECT count(*) FROM {table}"))  # noqa: S608
                for table in TENANT_TABLES
            }
        assert counts == dict.fromkeys(TENANT_TABLES, 0)

    def test_an_exact_email_lookup_exposes_only_that_user(self, seeded, app_engine) -> None:
        with app_engine.begin() as connection:
            _scope(connection, email="a@ornek.com.tr")
            visible = set(connection.scalars(text("SELECT email FROM users")))
        assert visible == {"a@ornek.com.tr"}

    def test_an_email_lookup_does_not_open_any_other_table(self, seeded, app_engine) -> None:
        with app_engine.begin() as connection:
            _scope(connection, email="a@ornek.com.tr")
            counts = {
                table: connection.scalar(text(f"SELECT count(*) FROM {table}"))  # noqa: S608
                for table in TENANT_TABLES
                if table != "users"
            }
        assert set(counts.values()) == {0}

    def test_a_partial_or_wildcard_email_matches_nothing(self, seeded, app_engine) -> None:
        """Exact equality only: no prefix, no LIKE, no empty-string catch-all."""
        for probe in ("a@ornek", "%", "", "A@ORNEK.COM.TR"):
            with app_engine.begin() as connection:
                _scope(connection, email=probe)
                assert connection.scalar(text("SELECT count(*) FROM users")) == 0

    def test_an_exact_fingerprint_lookup_exposes_only_that_session(
        self, seeded, app_engine
    ) -> None:
        with app_engine.begin() as connection:
            _scope(connection, fingerprint="fingerprint-b")
            visible = set(connection.scalars(text("SELECT tenant_id FROM user_sessions")))
        assert visible == {"tenant-b"}

    def test_a_fingerprint_lookup_does_not_expose_users(self, seeded, app_engine) -> None:
        with app_engine.begin() as connection:
            _scope(connection, fingerprint="fingerprint-b")
            assert connection.scalar(text("SELECT count(*) FROM users")) == 0

    def test_audit_events_have_no_pre_auth_window_at_all(self, seeded, app_engine) -> None:
        with app_engine.begin() as connection:
            _scope(connection, email="a@ornek.com.tr", fingerprint="fingerprint-a")
            assert connection.scalar(text("SELECT count(*) FROM audit_events")) == 0

    def test_a_current_tenant_sees_only_its_own_rows_everywhere(self, seeded, app_engine) -> None:
        with app_engine.begin() as connection:
            _scope(connection, tenant="tenant-a")
            counts = {
                table: connection.scalar(text(f"SELECT count(*) FROM {table}"))  # noqa: S608
                for table in TENANT_TABLES
            }
            tenants = set(connection.scalars(text("SELECT id FROM tenants")))
            users = set(connection.scalars(text("SELECT tenant_id FROM users")))
            sessions = set(connection.scalars(text("SELECT tenant_id FROM user_sessions")))
            audits = set(connection.scalars(text("SELECT tenant_id FROM audit_events")))
        assert counts == dict.fromkeys(TENANT_TABLES, 1)
        assert tenants == {"tenant-a"}
        assert users == sessions == audits == {"tenant-a"}

    def test_the_lookup_scopes_do_not_leak_between_transactions(self, seeded, app_engine) -> None:
        with app_engine.connect() as connection:
            with connection.begin():
                _scope(connection, email="a@ornek.com.tr", fingerprint="fingerprint-a")
                assert connection.scalar(text("SELECT count(*) FROM users")) == 1
                assert connection.scalar(text("SELECT count(*) FROM user_sessions")) == 1
            with connection.begin():
                assert connection.scalar(text("SELECT count(*) FROM users")) == 0
                assert connection.scalar(text("SELECT count(*) FROM user_sessions")) == 0

    def test_the_tenant_scope_does_not_leak_between_transactions(self, seeded, app_engine) -> None:
        with app_engine.connect() as connection:
            with connection.begin():
                _scope(connection, tenant="tenant-a")
                assert connection.scalar(text("SELECT count(*) FROM tenants")) == 1
            with connection.begin():
                assert connection.scalar(text("SELECT count(*) FROM tenants")) == 0


class TestTenantACannotWriteTenantBRows:
    def test_an_email_lookup_never_authorises_an_insert(self, seeded, app_engine) -> None:
        """A read window is not a write window: WITH CHECK stays tenant-scoped."""
        with pytest.raises(DBAPIError), app_engine.begin() as connection:
            _scope(connection, email="a@ornek.com.tr")
            connection.execute(
                text(
                    "INSERT INTO users (id, tenant_id, email, password_hash, created_at) "
                    "VALUES ('intruder', 'tenant-a', 'kotu@ornek.com.tr', 'h', :at)"
                ),
                {"at": datetime.now(UTC)},
            )

    def test_inserting_a_profile_for_another_tenant_is_refused(self, seeded, app_engine) -> None:
        with pytest.raises(DBAPIError), app_engine.begin() as connection:
            _scope(connection, tenant="tenant-a")
            connection.execute(
                text(
                    "INSERT INTO company_profiles (id, tenant_id, display_name, facts, "
                    "created_at, updated_at) VALUES ('x', 'tenant-b', 'Calinti', '{}', :at, :at)"
                ),
                {"at": datetime.now(UTC)},
            )

    def test_updating_another_tenants_profile_changes_nothing(self, seeded, app_engine) -> None:
        with app_engine.begin() as connection:
            _scope(connection, tenant="tenant-a")
            result = connection.execute(
                text("UPDATE company_profiles SET display_name = 'Ele gecirildi'")
            )
            assert result.rowcount == 1
        with seeded.begin() as connection:
            names = dict(
                connection.execute(text("SELECT tenant_id, display_name FROM company_profiles"))
            )
        assert names["tenant-b"] == "Sirket b"

    def test_the_application_role_cannot_delete_any_row_at_all(self, seeded, app_engine) -> None:
        """Nothing in this application deletes; the grant says so too.

        RLS would already have limited a DELETE to the caller's own tenant.
        Withholding the privilege outright means a cross-tenant delete is not
        merely scoped away - it is not expressible.
        """
        with pytest.raises(DBAPIError, match="permission denied"), app_engine.begin() as connection:
            _scope(connection, tenant="tenant-a")
            connection.execute(text("DELETE FROM company_profiles"))

    def test_inserting_a_tenant_row_for_another_tenant_is_refused(self, seeded, app_engine) -> None:
        with pytest.raises(DBAPIError), app_engine.begin() as connection:
            _scope(connection, tenant="tenant-a")
            connection.execute(
                text("INSERT INTO tenants (id, name, created_at) VALUES ('tenant-c', 'C', :at)"),
                {"at": datetime.now(UTC)},
            )


class TestSeeding:
    def test_seeding_is_idempotent(self, migrated) -> None:
        session_factory = create_session_factory(migrated)
        with session_factory() as session:
            first = seed_catalog(session)
            session.commit()
        with session_factory() as session:
            second = seed_catalog(session)
            session.commit()
            counts = {
                "snapshots": session.scalar(text("SELECT count(*) FROM source_snapshots")),
                "programs": session.scalar(text("SELECT count(*) FROM program_versions")),
                "rules": session.scalar(text("SELECT count(*) FROM rule_set_versions")),
            }
        assert first.changed is True
        assert second.changed is False
        assert counts == {"snapshots": 3, "programs": 3, "rules": 3}


class TestLeastPrivilegeUnderTheApplicationRole:
    """MF-1 - the role that serves web requests could rewrite the evidence.

    A decision is defensible because it names the rule set version and source
    snapshot it rested on. If the web role can `UPDATE source_snapshots`, that
    defence is only as strong as the web process, which is the one part of the
    system exposed to the internet.
    """

    @pytest.mark.parametrize("table", CATALOG_TABLES)
    def test_the_catalogue_is_readable(self, migrated, app_engine, table) -> None:
        with app_engine.begin() as connection:
            assert _has_privilege(connection, table, "SELECT")
            connection.execute(text(f"SELECT count(*) FROM {table}"))  # noqa: S608

    @pytest.mark.parametrize("table", CATALOG_TABLES)
    @pytest.mark.parametrize("privilege", ["INSERT", "UPDATE", "DELETE", "TRUNCATE"])
    def test_the_catalogue_is_not_writable(self, migrated, app_engine, table, privilege) -> None:
        with app_engine.begin() as connection:
            assert not _has_privilege(connection, table, privilege), (
                f"the application role holds {privilege} on {table}"
            )

    def test_truncating_the_catalogue_is_refused_in_practice(self, migrated, app_engine) -> None:
        with pytest.raises(DBAPIError, match="permission denied"), app_engine.begin() as connection:
            connection.execute(text("TRUNCATE source_snapshots"))

    def test_rewriting_a_source_snapshot_is_refused_in_practice(self, migrated, app_engine) -> None:
        with pytest.raises(DBAPIError, match="permission denied"), app_engine.begin() as connection:
            connection.execute(text("UPDATE source_snapshots SET body = 'uydurma'"))

    @pytest.mark.parametrize("privilege", ["SELECT", "INSERT", "UPDATE", "DELETE"])
    def test_alembic_version_is_untouchable(self, migrated, app_engine, privilege) -> None:
        """Migration bookkeeping is the migration role's business alone."""
        with app_engine.begin() as connection:
            assert not _has_privilege(connection, "alembic_version", privilege), (
                f"the application role holds {privilege} on alembic_version"
            )

    @pytest.mark.parametrize("table", TENANT_TABLES)
    def test_tenant_tables_keep_the_access_the_app_actually_uses(
        self, migrated, app_engine, table
    ) -> None:
        with app_engine.begin() as connection:
            assert _has_privilege(connection, table, "SELECT")
            assert _has_privilege(connection, table, "INSERT")

    @pytest.mark.parametrize("table", ["user_sessions", "company_profiles"])
    def test_the_two_tables_the_app_updates_are_updatable(
        self, migrated, app_engine, table
    ) -> None:
        with app_engine.begin() as connection:
            assert _has_privilege(connection, table, "UPDATE")

    @pytest.mark.parametrize("table", ["decisions", "approvals", "audit_events"])
    def test_append_only_tables_are_not_even_grantable_for_mutation(
        self, migrated, app_engine, table
    ) -> None:
        """The trigger is the second layer. The missing grant is the first."""
        with app_engine.begin() as connection:
            assert not _has_privilege(connection, table, "UPDATE")
            assert not _has_privilege(connection, table, "DELETE")

    def test_a_future_table_arrives_with_no_privileges(self, migrated, app_engine) -> None:
        """No `ALTER DEFAULT PRIVILEGES` means the next migration must be explicit."""
        with migrated.begin() as connection:
            connection.execute(text("CREATE TABLE gelecek_tablo (id text PRIMARY KEY)"))
        try:
            with app_engine.begin() as connection:
                for privilege in ("SELECT", "INSERT", "UPDATE", "DELETE"):
                    assert not _has_privilege(connection, "gelecek_tablo", privilege), (
                        f"a newly created table already grants {privilege} to the app role"
                    )
        finally:
            with migrated.begin() as connection:
                connection.execute(text("DROP TABLE gelecek_tablo"))
