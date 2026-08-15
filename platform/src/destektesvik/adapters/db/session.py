"""Engine and session wiring, including the per-transaction tenant setting."""

from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import Engine, create_engine, text
from sqlalchemy.orm import Session, sessionmaker

#: The GUC the RLS policies read.  Set per transaction, never per connection,
#: so a pooled connection can never carry one tenant's identity into another
#: tenant's request.
TENANT_SETTING = "app.current_tenant"

#: Exact-match lookup scopes for the three moments where a request legitimately
#: has no tenant yet: registration, login and session authentication.  Each one
#: widens visibility by exactly one row - the row whose e-mail or token
#: fingerprint the caller already supplied.
LOOKUP_EMAIL_SETTING = "app.lookup_email"
LOOKUP_SESSION_FINGERPRINT_SETTING = "app.lookup_session_fingerprint"


def create_app_engine(database_url: str, echo: bool = False) -> Engine:
    connect_args = {}
    if database_url.startswith("sqlite"):
        connect_args["check_same_thread"] = False
    return create_engine(
        database_url,
        echo=echo,
        future=True,
        pool_pre_ping=not database_url.startswith("sqlite"),
        connect_args=connect_args,
    )


def create_session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, expire_on_commit=False, future=True)


def _is_postgres(session: Session) -> bool:
    return session.bind is not None and session.bind.dialect.name == "postgresql"


def _set_local(session: Session, setting: str, value: str | None) -> None:
    """Set one transaction-local GUC.

    ``setting`` is always one of the module constants above - never anything
    derived from a request - and the *value* is bound as a parameter, so no
    caller-supplied text ever reaches the SQL text.
    """
    if not _is_postgres(session):
        return
    session.execute(
        text(f"SELECT set_config('{setting}', :value, true)"),  # noqa: S608
        {"value": value or ""},
    )


def apply_tenant_scope(session: Session, tenant_id: str | None) -> None:
    """Tell PostgreSQL which tenant this transaction belongs to.

    A no-op on SQLite, which is why the application-layer ``tenant_id`` filter
    is not optional: it is the only isolation the host-runnable test suite has,
    and it is the first line of defence in production too.
    """
    _set_local(session, TENANT_SETTING, tenant_id)


def apply_lookup_email(session: Session, email: str | None) -> None:
    """Open a one-row window on ``users`` for an exact e-mail match."""
    _set_local(session, LOOKUP_EMAIL_SETTING, email)


def apply_lookup_session_fingerprint(session: Session, fingerprint: str | None) -> None:
    """Open a one-row window on ``user_sessions`` for an exact fingerprint."""
    _set_local(session, LOOKUP_SESSION_FINGERPRINT_SETTING, fingerprint)


def clear_lookup_scopes(session: Session) -> None:
    """Close both pre-auth windows.  The tenant scope is left untouched."""
    _set_local(session, LOOKUP_EMAIL_SETTING, None)
    _set_local(session, LOOKUP_SESSION_FINGERPRINT_SETTING, None)


class SqlRequestScope:
    """The ``RequestScope`` port, backed by transaction-local PostgreSQL GUCs.

    Every setter uses ``set_config(..., true)``: the value dies with the
    transaction, so a pooled connection cannot carry one request's identity -
    or one request's lookup window - into the next.
    """

    def __init__(self, session: Session) -> None:
        self._session = session

    def set_tenant(self, tenant_id: str | None) -> None:
        apply_tenant_scope(self._session, tenant_id)

    def set_lookup_email(self, email: str | None) -> None:
        apply_lookup_email(self._session, email)

    def set_lookup_session_fingerprint(self, fingerprint: str | None) -> None:
        apply_lookup_session_fingerprint(self._session, fingerprint)

    def clear_lookups(self) -> None:
        clear_lookup_scopes(self._session)


@contextmanager
def session_scope(
    session_factory: sessionmaker[Session], tenant_id: str | None = None
) -> Iterator[Session]:
    session = session_factory()
    try:
        apply_tenant_scope(session, tenant_id)
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
