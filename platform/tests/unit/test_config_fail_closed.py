"""Finding G - configuration must fail closed outside development.

A development default that silently survives into production is the quiet
version of having no security at all: the app boots, looks healthy, and signs
its CSRF tokens with a secret that is printed in this repository.
"""

import pytest

from destektesvik.config import (
    DEFAULT_DATABASE_URL,
    DEFAULT_SECRET_KEY,
    InsecureConfigurationError,
    Settings,
)

SAFE_SECRET = "a-real-random-per-environment-signing-secret"
SAFE_DATABASE_URL = "postgresql+psycopg://destektesvik_app:real-password@db:5432/destektesvik"


def _settings(
    *,
    environment: str = "production",
    secret_key: str = SAFE_SECRET,
    database_url: str = SAFE_DATABASE_URL,
    session_cookie_secure: bool = True,
) -> Settings:
    """A deployment that is safe apart from whatever the caller breaks."""
    return Settings(
        environment=environment,
        secret_key=secret_key,
        database_url=database_url,
        session_cookie_secure=session_cookie_secure,
    )


class TestDevelopmentKeepsItsConveniences:
    def test_the_defaults_are_accepted_in_development(self) -> None:
        settings = Settings(environment="development")
        assert settings.secret_key == DEFAULT_SECRET_KEY
        assert settings.session_cookie_secure is False


class TestProductionFailsClosed:
    def test_a_correctly_configured_production_environment_is_accepted(self) -> None:
        assert _settings().environment == "production"

    def test_the_default_signing_secret_is_refused(self) -> None:
        with pytest.raises(InsecureConfigurationError, match="DESTEKTESVIK_SECRET_KEY"):
            _settings(secret_key=DEFAULT_SECRET_KEY)

    def test_an_insecure_session_cookie_is_refused(self) -> None:
        with pytest.raises(InsecureConfigurationError, match="DESTEKTESVIK_SESSION_COOKIE_SECURE"):
            _settings(session_cookie_secure=False)

    def test_the_change_me_default_database_url_is_refused(self) -> None:
        with pytest.raises(InsecureConfigurationError, match="DESTEKTESVIK_DATABASE_URL"):
            _settings(database_url=DEFAULT_DATABASE_URL)

    @pytest.mark.parametrize("environment", ["staging", "production", "prod", "uat"])
    def test_every_non_development_environment_is_guarded(self, environment) -> None:
        with pytest.raises(InsecureConfigurationError):
            _settings(environment=environment, secret_key=DEFAULT_SECRET_KEY)

    def test_the_error_reports_every_problem_at_once(self) -> None:
        """One boot, one complete list - not a game of whack-a-mole."""
        with pytest.raises(InsecureConfigurationError) as raised:
            _settings(
                secret_key=DEFAULT_SECRET_KEY,
                session_cookie_secure=False,
                database_url=DEFAULT_DATABASE_URL,
            )
        message = str(raised.value)
        assert "DESTEKTESVIK_SECRET_KEY" in message
        assert "DESTEKTESVIK_SESSION_COOKIE_SECURE" in message
        assert "DESTEKTESVIK_DATABASE_URL" in message

    def test_the_guard_does_not_generate_or_invent_a_secret(self) -> None:
        """Fail closed means refuse, never quietly substitute something."""
        with pytest.raises(InsecureConfigurationError):
            _settings(secret_key=DEFAULT_SECRET_KEY)
