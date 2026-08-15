"""Seeding is provisioning, so it must not run as the web role.

A consequence of MF-1: the application role now holds SELECT only on the
catalogue tables. Compose's `migrate` service runs `alembic upgrade head &&
python scripts/seed.py`, and `seed.py` used the *application* URL - so the
moment the catalogue became read-only for that role, seeding would have failed
with "permission denied" the first time anyone ran Compose.

Least privilege that breaks provisioning is not least privilege, it is an
outage. The seeder uses the migration role when one is configured.
"""

from destektesvik.adapters.db.seed import resolve_seed_url
from destektesvik.config import Settings

APP_URL = "postgresql+psycopg://destektesvik_app:app-pw@db:5432/destektesvik"
OWNER_URL = "postgresql+psycopg://destektesvik_owner:owner-pw@db:5432/destektesvik"


def _settings() -> Settings:
    return Settings(environment="development", database_url=APP_URL)


class TestSeedUrlResolution:
    def test_the_migration_url_wins_when_configured(self) -> None:
        url = resolve_seed_url(_settings(), {"DESTEKTESVIK_MIGRATION_DATABASE_URL": OWNER_URL})
        assert url == OWNER_URL

    def test_it_falls_back_to_the_application_url(self) -> None:
        """A laptop running SQLite has no separate migration role."""
        assert resolve_seed_url(_settings(), {}) == APP_URL

    def test_an_empty_migration_url_is_not_used(self) -> None:
        assert resolve_seed_url(_settings(), {"DESTEKTESVIK_MIGRATION_DATABASE_URL": ""}) == APP_URL

    def test_it_matches_how_alembic_resolves_the_same_variable(self) -> None:
        """Same precedence as migrations/env.py, so they cannot disagree."""
        environ = {"DESTEKTESVIK_MIGRATION_DATABASE_URL": OWNER_URL}
        assert resolve_seed_url(_settings(), environ) == OWNER_URL
