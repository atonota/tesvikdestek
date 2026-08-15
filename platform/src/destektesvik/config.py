"""Runtime configuration.

Everything that differs between a laptop, CI and a server lives here and
nowhere else.  No secret has a default value that would work in production.
"""

from functools import lru_cache
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

#: Values that are convenient on a laptop and unacceptable anywhere else.
DEFAULT_SECRET_KEY = "development-only-not-a-production-secret"  # noqa: S105
DEFAULT_DATABASE_URL = "postgresql+psycopg://destektesvik_app:change-me@localhost:5432/destektesvik"


class InsecureConfigurationError(Exception):
    """Raised at construction when a non-development environment is unsafe."""


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="DESTEKTESVIK_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    #: SQLAlchemy URL.  PostgreSQL in every real deployment; SQLite is used by
    #: the host-runnable part of the test suite only.
    database_url: str = DEFAULT_DATABASE_URL

    #: Used to sign the CSRF token.  Must be overridden outside development.
    #: Not a credential for anything: it signs, it does not authenticate.
    secret_key: str = DEFAULT_SECRET_KEY

    session_cookie_name: str = "destektesvik_session"
    #: Off by default so plain-HTTP local development works; MUST be true
    #: wherever TLS terminates in front of the app.
    session_cookie_secure: bool = False
    session_cookie_samesite: Literal["lax", "strict", "none"] = "lax"
    session_ttl_seconds: int = 60 * 60 * 12

    #: "disabled" | "fake" | "openai_compatible".  Disabled is the default and
    #: the deterministic engine never depends on this being anything else.
    ai_provider: Literal["disabled", "fake", "openai_compatible"] = "disabled"
    ai_base_url: str = ""
    ai_api_key: str = ""
    ai_model: str = ""
    ai_timeout_seconds: float = 30.0

    app_name: str = "DestekTesvik"
    environment: str = Field(default="development")

    @property
    def is_postgres(self) -> bool:
        return self.database_url.startswith("postgresql")

    @model_validator(mode="after")
    def _refuse_development_defaults_outside_development(self) -> "Settings":
        """Fail closed: refuse to boot rather than boot insecurely.

        This only refuses; it never generates a secret, provisions TLS or
        rewrites a URL.  Supplying those is deployment's job, and quietly
        inventing them would replace a loud failure with a silent one.
        """
        if self.environment.strip().lower() == "development":
            return self

        problems: list[str] = []
        if self.secret_key == DEFAULT_SECRET_KEY:
            problems.append(
                "DESTEKTESVIK_SECRET_KEY is still the development default; "
                "set a fresh random value per environment"
            )
        if not self.session_cookie_secure:
            problems.append(
                "DESTEKTESVIK_SESSION_COOKIE_SECURE is false; session and CSRF "
                "cookies would travel over plain HTTP"
            )
        if self.database_url == DEFAULT_DATABASE_URL or "change-me" in self.database_url:
            problems.append("DESTEKTESVIK_DATABASE_URL is still the placeholder 'change-me' URL")
        if problems:
            joined = "\n  - ".join(problems)
            raise InsecureConfigurationError(
                f"environment={self.environment!r} refuses insecure configuration:\n  - {joined}"
            )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
