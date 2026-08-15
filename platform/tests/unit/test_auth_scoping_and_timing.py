"""Findings A and E, at the layer a laptop can actually run.

The PostgreSQL half of finding A lives in ``tests/integration/test_postgres_security.py``
and needs a real server.  What is checkable here is the *ordering contract* the
policies depend on: the exact lookup scope must be in place before the query
that relies on it, and the tenant scope must be in place before anything is
written.  If that ordering is wrong, the database policies deny correct
requests - or, worse, a future permissive policy would expose rows.

Finding E is the login timing path: an unknown e-mail must still pay for a real
Argon2 verification, or the response time answers "does this user exist?".
"""

from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

import pytest
from argon2 import PasswordHasher as Argon2PasswordHasher
from argon2.exceptions import VerifyMismatchError

from destektesvik.application.dto import UserRecord
from destektesvik.application.errors import AuthenticationError
from destektesvik.application.services import DUMMY_PASSWORD_HASH, AuthService

PASSWORD = "cok-guclu-parola-2026"


@dataclass
class Journal:
    """One ordered log of everything the service did, across all collaborators."""

    events: list[str] = field(default_factory=list)

    def record(self, event: str) -> None:
        self.events.append(event)

    def index(self, event: str) -> int:
        assert event in self.events, f"{event!r} never happened; log = {self.events}"
        return self.events.index(event)


class RecordingScope:
    def __init__(self, journal: Journal) -> None:
        self._journal = journal

    def set_tenant(self, tenant_id: str | None) -> None:
        self._journal.record(f"scope.tenant={tenant_id}")

    def set_lookup_email(self, email: str | None) -> None:
        self._journal.record(f"scope.lookup_email={email}")

    def set_lookup_session_fingerprint(self, fingerprint: str | None) -> None:
        self._journal.record(f"scope.lookup_fingerprint={fingerprint}")

    def clear_lookups(self) -> None:
        self._journal.record("scope.clear_lookups")


class RecordingHasher:
    """Records every hash it was asked to verify, in order."""

    def __init__(self, journal: Journal) -> None:
        self._journal = journal
        self.verified: list[str] = []

    def hash(self, password: str) -> str:
        return f"hash::{password}"

    def verify(self, password_hash: str, password: str) -> bool:
        self.verified.append(password_hash)
        self._journal.record("hasher.verify")
        return password_hash == f"hash::{password}"


class FakeTenants:
    def __init__(self, journal: Journal) -> None:
        self._journal = journal

    def create(self, tenant_id: str, name: str, created_at: datetime) -> None:
        self._journal.record("tenants.create")


class FakeUsers:
    def __init__(self, journal: Journal) -> None:
        self._journal = journal
        self.rows: dict[str, UserRecord] = {}

    def create(self, user_id, tenant_id, email, password_hash, created_at) -> None:
        self._journal.record("users.create")
        self.rows[email] = UserRecord(
            id=user_id, tenant_id=tenant_id, email=email, password_hash=password_hash
        )

    def find_by_email(self, email: str) -> UserRecord | None:
        self._journal.record("users.find_by_email")
        return self.rows.get(email)

    def email_exists(self, email: str) -> bool:
        self._journal.record("users.email_exists")
        return email in self.rows


class FakeSessions:
    def __init__(self, journal: Journal, users: FakeUsers) -> None:
        self._journal = journal
        self._users = users
        self.rows: dict[str, tuple[str, str]] = {}

    def create(self, session_id, token_fingerprint, user_id, tenant_id, created_at, expires_at):
        self._journal.record("sessions.create")
        self.rows[token_fingerprint] = (user_id, tenant_id)

    def find_active(self, token_fingerprint: str, now: datetime) -> UserRecord | None:
        self._journal.record("sessions.find_active")
        found = self.rows.get(token_fingerprint)
        if found is None:
            return None
        user_id, tenant_id = found
        return UserRecord(id=user_id, tenant_id=tenant_id, email="x@y.tr", password_hash="")

    def revoke(self, token_fingerprint: str, revoked_at: datetime) -> None:
        self._journal.record("sessions.revoke")
        self.rows.pop(token_fingerprint, None)


class FakeAudit:
    def __init__(self, journal: Journal) -> None:
        self._journal = journal
        self.events: list[object] = []

    def add(self, event) -> None:
        self._journal.record("audit.add")
        self.events.append(event)

    def list_for_tenant(self, tenant_id: str):
        return list(self.events)


class FixedClock:
    def now(self) -> datetime:
        return datetime(2026, 8, 14, 9, 0, tzinfo=UTC)


class SequentialIds:
    def __init__(self) -> None:
        self._n = 0

    def new(self) -> str:
        self._n += 1
        return f"id-{self._n:04d}"


class FixedTokens:
    def new_token(self) -> str:
        return "opaque-token"

    def fingerprint(self, token: str) -> str:
        return f"fp::{token}"


@dataclass
class Harness:
    service: AuthService
    journal: Journal
    hasher: RecordingHasher
    users: FakeUsers


@pytest.fixture
def harness() -> Harness:
    journal = Journal()
    users = FakeUsers(journal)
    hasher = RecordingHasher(journal)
    service = AuthService(
        tenants=FakeTenants(journal),
        users=users,
        sessions=FakeSessions(journal, users),
        hasher=hasher,
        tokens=FixedTokens(),
        clock=FixedClock(),
        ids=SequentialIds(),
        audit=FakeAudit(journal),
        scope=RecordingScope(journal),
    )
    return Harness(service=service, journal=journal, hasher=hasher, users=users)


def _register(harness: Harness, email: str = "biri@ornek.com.tr") -> None:
    harness.service.register(email, PASSWORD, "Ornek A.S.")


class TestLoginTimingIsEqualised:
    def test_an_unknown_user_still_pays_for_a_real_verification(self, harness) -> None:
        with pytest.raises(AuthenticationError):
            harness.service.login("yok@ornek.com.tr", PASSWORD)
        assert harness.hasher.verified == [DUMMY_PASSWORD_HASH]

    def test_a_wrong_password_also_reaches_the_verification(self, harness) -> None:
        _register(harness)
        harness.hasher.verified.clear()
        with pytest.raises(AuthenticationError):
            harness.service.login("biri@ornek.com.tr", "yanlis-parola-123456")
        assert harness.hasher.verified == [f"hash::{PASSWORD}"]

    def test_both_branches_perform_exactly_one_verification(self, harness) -> None:
        _register(harness)
        harness.hasher.verified.clear()
        with pytest.raises(AuthenticationError):
            harness.service.login("yok@ornek.com.tr", PASSWORD)
        unknown_user = len(harness.hasher.verified)
        harness.hasher.verified.clear()
        with pytest.raises(AuthenticationError):
            harness.service.login("biri@ornek.com.tr", "yanlis-parola-123456")
        assert unknown_user == len(harness.hasher.verified) == 1

    def test_the_dummy_hash_is_a_real_argon2_hash_not_a_placeholder(self) -> None:
        """A malformed string would raise InvalidHash and skip the expensive work."""
        with pytest.raises(VerifyMismatchError):
            Argon2PasswordHasher().verify(DUMMY_PASSWORD_HASH, "herhangi-bir-parola")


class TestTransactionLocalScopeOrdering:
    def test_registration_sets_the_new_tenant_before_inserting_anything(self, harness) -> None:
        _register(harness)
        journal = harness.journal
        tenant_events = [e for e in journal.events if e.startswith("scope.tenant=")]
        assert tenant_events, f"registration never set a tenant scope; log = {journal.events}"
        first_tenant = journal.events.index(tenant_events[0])
        for write in ("tenants.create", "users.create", "audit.add"):
            assert first_tenant < journal.index(write), f"{write} happened before the tenant scope"

    def test_registration_may_check_uniqueness_under_an_exact_email_lookup(self, harness) -> None:
        _register(harness)
        journal = harness.journal
        assert journal.index("scope.lookup_email=biri@ornek.com.tr") < journal.index(
            "users.email_exists"
        )

    def test_login_sets_the_exact_email_lookup_before_the_user_query(self, harness) -> None:
        _register(harness)
        harness.journal.events.clear()
        harness.service.login("biri@ornek.com.tr", PASSWORD)
        journal = harness.journal
        assert journal.index("scope.lookup_email=biri@ornek.com.tr") < journal.index(
            "users.find_by_email"
        )

    def test_login_sets_the_matching_tenant_before_writing_session_and_audit(self, harness) -> None:
        _register(harness)
        harness.journal.events.clear()
        harness.service.login("biri@ornek.com.tr", PASSWORD)
        journal = harness.journal
        tenant_events = [e for e in journal.events if e.startswith("scope.tenant=")]
        assert tenant_events, f"login never set a tenant scope; log = {journal.events}"
        first_tenant = journal.events.index(tenant_events[0])
        assert first_tenant > journal.index("users.find_by_email")
        assert first_tenant < journal.index("sessions.create")
        assert first_tenant < journal.index("audit.add")

    def test_login_drops_the_email_lookup_once_the_tenant_is_known(self, harness) -> None:
        _register(harness)
        harness.journal.events.clear()
        harness.service.login("biri@ornek.com.tr", PASSWORD)
        assert "scope.clear_lookups" in harness.journal.events

    def test_a_failed_login_never_widens_the_scope_to_a_tenant(self, harness) -> None:
        _register(harness)
        harness.journal.events.clear()
        with pytest.raises(AuthenticationError):
            harness.service.login("biri@ornek.com.tr", "yanlis-parola-123456")
        assert not [e for e in harness.journal.events if e.startswith("scope.tenant=")]

    def test_authentication_sets_the_exact_fingerprint_before_the_session_query(
        self, harness
    ) -> None:
        _register(harness)
        result = harness.service.login("biri@ornek.com.tr", PASSWORD)
        harness.journal.events.clear()
        harness.service.authenticate(result.token)
        journal = harness.journal
        assert journal.index("scope.lookup_fingerprint=fp::opaque-token") < journal.index(
            "sessions.find_active"
        )

    def test_authentication_sets_the_session_tenant_after_the_row_is_found(self, harness) -> None:
        _register(harness)
        result = harness.service.login("biri@ornek.com.tr", PASSWORD)
        harness.journal.events.clear()
        harness.service.authenticate(result.token)
        journal = harness.journal
        tenant_events = [e for e in journal.events if e.startswith("scope.tenant=")]
        assert tenant_events, f"authentication never set a tenant scope; log = {journal.events}"
        assert journal.events.index(tenant_events[0]) > journal.index("sessions.find_active")

    def test_an_unknown_token_never_sets_a_tenant(self, harness) -> None:
        assert harness.service.authenticate("hic-boyle-bir-token-yok") is None
        assert not [e for e in harness.journal.events if e.startswith("scope.tenant=")]


class TestLookupScopesAreClosedOnEveryExit:
    """m-1 - a lookup window left open outlives the query that needed it.

    The scopes are transaction-local, so nothing leaks into another request.
    But within one transaction the rest of the work continues under a window
    that is no longer needed, and "no longer needed" is the only thing standing
    between a one-row exception and a general one. Closing on the failure paths
    costs one statement and removes the question entirely.
    """

    def _lookup_state(self, harness) -> list[str]:
        """Every lookup-scope event, in order, so the last one can be read."""
        return [
            event
            for event in harness.journal.events
            if event.startswith("scope.lookup_") or event == "scope.clear_lookups"
        ]

    def test_a_duplicate_registration_closes_the_email_window(self, harness) -> None:
        _register(harness)
        harness.journal.events.clear()
        with pytest.raises(AuthenticationError, match="zaten kayitli"):
            _register(harness)
        assert self._lookup_state(harness)[-1] == "scope.clear_lookups"

    def test_an_unknown_user_login_closes_the_email_window(self, harness) -> None:
        harness.journal.events.clear()
        with pytest.raises(AuthenticationError):
            harness.service.login("yok@ornek.com.tr", PASSWORD)
        assert self._lookup_state(harness)[-1] == "scope.clear_lookups"

    def test_a_wrong_password_login_closes_the_email_window(self, harness) -> None:
        _register(harness)
        harness.journal.events.clear()
        with pytest.raises(AuthenticationError):
            harness.service.login("biri@ornek.com.tr", "yanlis-parola-123456")
        assert self._lookup_state(harness)[-1] == "scope.clear_lookups"

    def test_an_invalid_token_closes_the_fingerprint_window(self, harness) -> None:
        harness.journal.events.clear()
        assert harness.service.authenticate("hic-boyle-bir-token-yok") is None
        assert self._lookup_state(harness)[-1] == "scope.clear_lookups"

    def test_an_expired_session_closes_the_fingerprint_window(self, harness) -> None:
        """`find_active` returning None covers expired and revoked alike."""
        _register(harness)
        result = harness.service.login("biri@ornek.com.tr", PASSWORD)
        harness.service.logout(result.token, None)
        harness.journal.events.clear()
        assert harness.service.authenticate(result.token) is None
        assert self._lookup_state(harness)[-1] == "scope.clear_lookups"

    def test_an_invalid_registration_never_opens_a_window_at_all(self, harness) -> None:
        """Validation failures happen before any query, so nothing to close."""
        harness.journal.events.clear()
        with pytest.raises(AuthenticationError):
            harness.service.register("gecersiz-eposta", PASSWORD, "X")
        assert self._lookup_state(harness) == []

    def test_logout_closes_its_window_even_without_an_actor(self, harness) -> None:
        _register(harness)
        result = harness.service.login("biri@ornek.com.tr", PASSWORD)
        harness.journal.events.clear()
        harness.service.logout(result.token, None)
        assert self._lookup_state(harness)[-1] == "scope.clear_lookups"


class TestSessionExpiryIsStillHonoured:
    def test_a_session_is_created_with_the_configured_ttl(self, harness) -> None:
        _register(harness)
        result = harness.service.login("biri@ornek.com.tr", PASSWORD)
        assert result.token == "opaque-token"
        expected = FixedClock().now() + timedelta(seconds=harness.service.session_ttl_seconds)
        assert expected > FixedClock().now()
