"""Structural contracts for the files a laptop cannot execute.

CI, Compose, the role-init script and the container smoke script only ever run
on a Linux runner with Docker and PostgreSQL.  None of that is available on the
authoring host, so the *executable* proof lives in CI.  What is provable here
is that these files still say what the security story claims they say - which
is exactly where findings B and C went wrong: the story and the file had
drifted apart, and nothing failed.

These are deliberately narrow text/structure assertions.  They are not a
substitute for running the pipeline, and the evidence report says so.
"""

import ast
import importlib.util
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
PLATFORM = REPO_ROOT / "platform"

CI = REPO_ROOT / ".github" / "workflows" / "ci.yml"
COMPOSE = PLATFORM / "compose.yaml"
ROLE_INIT = PLATFORM / "scripts" / "db-init" / "01-app-role.sh"
SMOKE = PLATFORM / "scripts" / "container-smoke.sh"
MIGRATION = PLATFORM / "migrations" / "versions" / "0001_initial_schema.py"
RUNBOOK = REPO_ROOT / "docs" / "runbooks" / "hetzner-dual-host-acceptance.md"
FINGERPRINT = PLATFORM / "scripts" / "package-fingerprint.sh"


def _text(path: Path) -> str:
    assert path.is_file(), f"{path} is referenced by the deployment story but does not exist"
    return path.read_text(encoding="utf-8")


def _job(name: str) -> str:
    """The slice of ci.yml belonging to one job."""
    text = _text(CI)
    start = text.index(f"\n  {name}:")
    remainder = text[start + 1 :]
    lines = remainder.splitlines(keepends=True)
    collected = [lines[0]]
    for line in lines[1:]:
        if line.strip() and not line.startswith("    ") and not line.startswith("  #"):
            break
        collected.append(line)
    return "".join(collected)


def _lookup_policy_source() -> str:
    """The exact CREATE POLICY template used for the pre-auth lookup tables."""
    migration = _text(MIGRATION)
    loop = migration.split("for table, (column, lookup_setting) in LOOKUP_TENANT_TABLES:")
    assert len(loop) == 2, "the lookup-policy loop is not where this test expects it"
    return loop[1].split("CREATE POLICY")[1].split('"""')[0]


def _statements(path: Path) -> str:
    """The file with its prose removed - comments, and a module docstring.

    These contracts are about what the file *executes*. Prose is allowed - and
    required - to name the very thing it is explaining not to do; the migration
    docstring says why `ALTER DEFAULT PRIVILEGES` is absent, and that sentence
    must not be mistaken for the statement itself.
    """
    text = _text(path)
    if path.suffix == ".py":
        docstring = ast.get_docstring(ast.parse(text), clean=False)
        if docstring:
            text = text.replace(docstring, "", 1)
    return "\n".join(line for line in text.splitlines() if not line.lstrip().startswith("#"))


@pytest.fixture(scope="module")
def migration_module():
    spec = importlib.util.spec_from_file_location("dt_migration_0001", MIGRATION)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class TestPreAuthPoliciesUseExactLookups:
    """Finding A, as far as static inspection can go."""

    def test_the_lookup_gucs_are_named_by_the_db_adapter_and_the_migration(self) -> None:
        from destektesvik.adapters.db.session import (
            LOOKUP_EMAIL_SETTING,
            LOOKUP_SESSION_FINGERPRINT_SETTING,
            TENANT_SETTING,
        )

        migration = _text(MIGRATION)
        assert TENANT_SETTING == "app.current_tenant"
        assert LOOKUP_EMAIL_SETTING in migration
        assert LOOKUP_SESSION_FINGERPRINT_SETTING in migration

    def test_no_policy_is_permissive_merely_because_no_tenant_is_set(self) -> None:
        """The old escape hatch: an unset tenant exposed every pre-auth row."""
        migration = _text(MIGRATION)
        assert "coalesce(current_setting('app.current_tenant', true), '') = ''" not in migration

    def test_audit_events_are_strictly_tenant_scoped(self, migration_module) -> None:
        assert "audit_events" in migration_module.STRICT_TENANT_TABLES
        assert "audit_events" not in dict(migration_module.LOOKUP_TENANT_TABLES)

    def test_tenants_is_under_row_level_security_too(self, migration_module) -> None:
        assert migration_module.TENANT_REGISTRY_TABLE == "tenants"
        migration = _text(MIGRATION)
        assert "ALTER TABLE {TENANT_REGISTRY_TABLE} ENABLE ROW LEVEL SECURITY" in migration
        assert "ALTER TABLE {TENANT_REGISTRY_TABLE} FORCE ROW LEVEL SECURITY" in migration
        # A tenant row's scope column is its primary key, not `tenant_id`.
        assert "USING (id = current_setting('app.current_tenant', true))" in migration

    def test_the_lookup_policies_cover_exactly_users_and_sessions(self, migration_module) -> None:
        assert dict(migration_module.LOOKUP_TENANT_TABLES) == {
            "users": ("email", "app.lookup_email"),
            "user_sessions": ("token_fingerprint", "app.lookup_session_fingerprint"),
        }

    def test_the_lookup_policies_still_write_check_on_the_tenant_only(self) -> None:
        """A lookup may reveal one row; it must never authorise a write."""
        policy = _lookup_policy_source()
        using_clause, with_check_clause = policy.split("WITH CHECK")
        assert "{lookup_setting}" in using_clause, "the read window does not use the lookup GUC"
        assert "lookup" not in with_check_clause, (
            f"a lookup GUC leaked into the WITH CHECK clause: {with_check_clause!r}"
        )
        assert "tenant_id = current_setting('app.current_tenant', true)" in with_check_clause

    def test_the_lookup_read_window_requires_a_non_empty_setting(self) -> None:
        """An unset GUC must match nothing, not every row with a blank column."""
        assert "nullif(current_setting('{lookup_setting}', true), '')" in _lookup_policy_source()


class TestContainerJobSeparatesTheDatabaseRoles:
    """Finding B - the smoke test used to run the app as the schema owner."""

    def test_the_container_job_creates_an_unprivileged_application_role(self) -> None:
        job = _job("container-build-and-smoke")
        assert "CREATE ROLE destektesvik_app" in job
        assert "NOSUPERUSER" in job
        assert "NOBYPASSRLS" in job

    def test_the_role_is_created_before_the_smoke_step_runs(self) -> None:
        job = _job("container-build-and-smoke")
        assert job.index("CREATE ROLE destektesvik_app") < job.index("container-smoke.sh")

    def test_the_smoke_step_passes_the_owner_and_app_urls_separately(self) -> None:
        job = _job("container-build-and-smoke")
        assert "destektesvik_owner:ci-owner-password" in job
        assert "destektesvik_app:ci-app-password" in job

    def test_the_image_is_still_amd64_and_never_pushed(self) -> None:
        job = _job("container-build-and-smoke")
        assert "platforms: linux/amd64" in job
        assert "push: false" in job

    def test_the_pinned_action_majors_are_unchanged(self) -> None:
        ci = _text(CI)
        assert "docker/setup-buildx-action@v4" in ci
        assert "docker/build-push-action@v7" in ci


class TestTheSkipGuardCannotPassOnFailure:
    """Finding B5 - `pytest | tee` reported tee's exit code, not pytest's."""

    def test_the_postgres_security_guard_propagates_the_pytest_exit_code(self) -> None:
        job = _job("postgres-integration")
        assert "set -o pipefail" in job or "PIPESTATUS" in job

    def test_the_guard_still_fails_on_a_skip(self) -> None:
        job = _job("postgres-integration")
        assert 'grep -qi "skipped"' in job


class TestContainerSmokeInterface:
    def test_the_script_takes_a_separate_application_url(self) -> None:
        smoke = _text(SMOKE)
        assert "APP_DATABASE_URL" in smoke
        assert "MIGRATION_DATABASE_URL" in smoke

    def test_the_script_verifies_the_runtime_role_is_unprivileged(self) -> None:
        smoke = _text(SMOKE)
        assert "rolsuper" in smoke
        assert "rolbypassrls" in smoke

    def test_the_web_container_is_started_with_the_application_url(self) -> None:
        smoke = _text(SMOKE)
        start = smoke.index("==> start container")
        assert 'DESTEKTESVIK_DATABASE_URL="$APP_DATABASE_URL"' in smoke[start:]

    def test_the_image_platform_and_non_root_checks_survive(self) -> None:
        smoke = _text(SMOKE)
        assert "expected amd64" in smoke
        assert "image runs as root" in smoke


class TestComposeForwardsWhatItReferences:
    """Finding C - variables the services read but Compose never passed."""

    def test_the_db_service_receives_the_application_role_name(self) -> None:
        compose = _text(COMPOSE)
        db = compose[compose.index("  db:") : compose.index("  web:")]
        assert "DESTEKTESVIK_APP_DB_ROLE" in db

    def test_the_web_service_receives_the_cookie_and_session_settings(self) -> None:
        compose = _text(COMPOSE)
        web = compose[compose.index("  web:") : compose.index("  migrate:")]
        assert "DESTEKTESVIK_SESSION_COOKIE_SAMESITE" in web
        assert "DESTEKTESVIK_SESSION_TTL_SECONDS" in web

    def test_the_role_init_script_is_mounted_and_present(self) -> None:
        assert "./scripts/db-init:/docker-entrypoint-initdb.d:ro" in _text(COMPOSE)
        assert ROLE_INIT.is_file()


class TestTheWebServiceNeverSeesOwnerCredentials:
    """YF-2 - the web container was handed the migration role's URL.

    It never used it: `create_app()` reads `DESTEKTESVIK_DATABASE_URL` only. But
    the owner password sat in the web process's environment anyway, readable by
    anything that could read `/proc/self/environ`, a crash dump, or a debug
    endpoint. The whole point of two roles is that compromising the web tier
    does not hand over the schema owner.
    """

    def _service(self, name: str) -> dict:
        import yaml

        compose = yaml.safe_load(_text(COMPOSE))
        assert name in compose["services"], f"compose has no {name} service"
        return compose["services"][name]

    def _environment(self, name: str) -> dict[str, str]:
        environment = self._service(name).get("environment", {})
        if isinstance(environment, list):
            return dict(entry.split("=", 1) for entry in environment)
        return {key: str(value) for key, value in environment.items()}

    def test_the_web_service_has_no_migration_url(self) -> None:
        assert "DESTEKTESVIK_MIGRATION_DATABASE_URL" not in self._environment("web")

    def test_no_web_variable_carries_the_owner_url(self) -> None:
        """Renaming the variable would defeat a name-only check."""
        for key, value in self._environment("web").items():
            assert "MIGRATION_DATABASE_URL" not in value, (
                f"web.{key} interpolates the migration URL: {value}"
            )

    def test_the_migrate_service_still_has_it(self) -> None:
        """Credential minimisation must not break the thing that needs it."""
        assert "DESTEKTESVIK_MIGRATION_DATABASE_URL" in self._environment("migrate")

    def test_the_web_service_still_has_its_own_database_url(self) -> None:
        assert "DESTEKTESVIK_DATABASE_URL" in self._environment("web")


class TestRoleInitFailsClosed:
    def test_the_role_name_is_validated_before_it_reaches_sql(self) -> None:
        role_init = _text(ROLE_INIT)
        assert "[A-Za-z_][A-Za-z0-9_]*" in role_init

    def test_a_configured_password_is_quoted_rather_than_interpolated_raw(self) -> None:
        role_init = _text(ROLE_INIT)
        assert "quote_literal" in role_init or "format(" in role_init

    def test_the_script_still_demands_nosuperuser_and_nobypassrls(self) -> None:
        role_init = _text(ROLE_INIT)
        assert "NOSUPERUSER" in role_init
        assert "NOBYPASSRLS" in role_init


class TestMigrationRefusesToSkipGrantsSilently:
    def test_a_missing_application_role_is_an_error_not_a_shrug(self) -> None:
        migration = _text(MIGRATION)
        assert "IF NOT EXISTS (SELECT 1 FROM pg_roles" in migration
        assert "RAISE EXCEPTION" in migration.split("GRANT USAGE ON SCHEMA")[0]

    def test_the_role_identifier_is_still_validated(self, migration_module) -> None:
        with pytest.raises(ValueError, match="not a valid identifier"):
            migration_module.validate_app_role("app; DROP TABLE users")


class TestLeastPrivilegeGrants:
    """MF-1 - the web role could mutate the catalogue it is supposed to trust.

    `GRANT ... ON ALL TABLES` plus `ALTER DEFAULT PRIVILEGES` handed the
    application role INSERT/UPDATE/DELETE on `source_snapshots`,
    `program_versions`, `rule_set_versions` and `schema_flags` - the evidence a
    decision cites - and on every table any future migration might add.
    """

    def test_the_migration_never_grants_on_all_tables(self) -> None:
        assert "ON ALL TABLES IN SCHEMA" not in _statements(MIGRATION)

    def test_no_default_privileges_are_granted_anywhere(self) -> None:
        """A future table must arrive with no application privileges at all."""
        for path in (ROLE_INIT, CI, MIGRATION):
            assert "ALTER DEFAULT PRIVILEGES" not in _statements(path), (
                f"{path.name} still grants blanket default privileges"
            )

    def test_role_setup_only_creates_the_role_and_grants_connect_and_usage(self) -> None:
        """Role creation provisions identity; migrations provision access."""
        for path in (ROLE_INIT, CI):
            text = _statements(path)
            assert "GRANT CONNECT ON DATABASE" in text
            assert "GRANT USAGE ON SCHEMA public" in text
            assert "GRANT SELECT, INSERT, UPDATE, DELETE" not in text

    def test_catalog_tables_are_granted_select_only(self, migration_module) -> None:
        migration = _text(MIGRATION)
        assert "RUNTIME_READ_ONLY_TABLES" in migration
        assert set(migration_module.RUNTIME_READ_ONLY_TABLES) == set(
            migration_module.CATALOG_TABLES
        )
        for table, privileges in migration_module.RUNTIME_TABLE_PRIVILEGES.items():
            if table in migration_module.CATALOG_TABLES:
                assert privileges == ("SELECT",), f"{table} is catalogue data, not app state"

    def test_append_only_tables_never_receive_update_or_delete(self, migration_module) -> None:
        """The trigger is the second layer; the grant is the first."""
        for table in migration_module.APPEND_ONLY_TABLES:
            privileges = migration_module.RUNTIME_TABLE_PRIVILEGES[table]
            assert "UPDATE" not in privileges
            assert "DELETE" not in privileges

    def test_no_table_is_granted_delete(self, migration_module) -> None:
        """Nothing in this application deletes a row. Ever."""
        for table, privileges in migration_module.RUNTIME_TABLE_PRIVILEGES.items():
            assert "DELETE" not in privileges, f"{table} was granted DELETE"

    def test_alembic_version_is_never_granted_to_the_application_role(self) -> None:
        """Migration bookkeeping belongs to the migration role alone."""
        # Prose may discuss it; no GRANT may name it.
        for path in (MIGRATION, ROLE_INIT, CI):
            granting = [
                line
                for line in _text(path).splitlines()
                if "GRANT" in line and "alembic_version" in line
            ]
            assert not granting, f"{path.name} grants on alembic_version: {granting}"

    def test_every_tenant_table_the_app_writes_is_covered(self, migration_module) -> None:
        covered = set(migration_module.RUNTIME_TABLE_PRIVILEGES)
        expected = set(migration_module.STRICT_TENANT_TABLES)
        expected.add(migration_module.TENANT_REGISTRY_TABLE)
        expected.update(table for table, _ in migration_module.LOOKUP_TENANT_TABLES)
        expected.update(migration_module.CATALOG_TABLES)
        assert covered == expected

    def test_the_tables_the_app_updates_have_update(self, migration_module) -> None:
        for table in ("user_sessions", "company_profiles"):
            assert "UPDATE" in migration_module.RUNTIME_TABLE_PRIVILEGES[table]


class TestRunbookMatchesTheSmokeScript:
    """A runbook that cannot be pasted into a shell is not a runbook."""

    def _invocation(self) -> str:
        runbook = _text(RUNBOOK)
        start = runbook.index("./scripts/container-smoke.sh")
        return runbook[start : runbook.index("\n```", start)]

    def test_the_invocation_passes_two_distinct_urls_in_the_right_order(self) -> None:
        invocation = self._invocation()
        migration_marker = "<migration-database-url>"
        app_marker = "<app-database-url>"
        assert migration_marker in invocation, invocation
        assert app_marker in invocation, invocation
        assert invocation.index(migration_marker) < invocation.index(app_marker)

    def test_the_invocation_still_names_the_image_and_the_network(self) -> None:
        invocation = self._invocation()
        assert "destektesvik:acceptance" in invocation
        assert invocation.rstrip().endswith("host")

    def test_the_runbook_states_the_runtime_role_assertion(self) -> None:
        runbook = _text(RUNBOOK).lower()
        assert "bypassrls" in runbook
        assert "superuser" in runbook
