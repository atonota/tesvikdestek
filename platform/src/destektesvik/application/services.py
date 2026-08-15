"""Use cases.

Every state change that matters writes an audit event in the same call that
performs it, so "it happened but nobody recorded it" is not a reachable state.
"""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any

from destektesvik.application.ai import AiExplanation, build_prompt, validate_ai_output
from destektesvik.application.dto import LoginResult, UserRecord
from destektesvik.application.errors import (
    AiOutputRejected,
    AiProviderUnavailable,
    AuthenticationError,
    TenantIsolationError,
)
from destektesvik.application.ports import (
    AiExplainerPort,
    ApprovalRepository,
    AuditRepository,
    Clock,
    DecisionRepository,
    IdFactory,
    NullRequestScope,
    PasswordHasher,
    ProfileRepository,
    ProgramCatalog,
    RequestScope,
    SessionRepository,
    TenantRepository,
    TokenFactory,
    UserRepository,
)
from destektesvik.domain.decisions import (
    ApprovalEvent,
    AuditEvent,
    DecisionRecord,
    DecisionReviewStatus,
)
from destektesvik.domain.evaluation import EvaluationInput, EvaluationResult, evaluate
from destektesvik.domain.profile import CompanyProfile

MIN_PASSWORD_LENGTH = 12

#: A real Argon2id hash of a throwaway random password, generated once and
#: pinned here.  It exists so that "this e-mail does not exist" costs the same
#: as "this password is wrong": the unknown-user branch runs a genuine
#: verification against this hash instead of returning early.  It is not a
#: credential - no password produces it, and it grants nothing.
DUMMY_PASSWORD_HASH = (
    "$argon2id$v=19$m=65536,t=3,p=4$6K8Au+D9x+ALqSamsZAGew$"  # noqa: S105
    "/IAKQyV0t4eBO7nWJRLnMxd2TDCZLvGHDOJhGxJvIdg"
)


def normalise_email(email: str) -> str:
    return email.strip().lower()


@dataclass(slots=True)
class AuthService:
    tenants: TenantRepository
    users: UserRepository
    sessions: SessionRepository
    hasher: PasswordHasher
    tokens: TokenFactory
    clock: Clock
    ids: IdFactory
    audit: AuditRepository
    scope: RequestScope = field(default_factory=NullRequestScope)
    session_ttl_seconds: int = 60 * 60 * 12

    def register(self, email: str, password: str, organisation_name: str) -> UserRecord:
        """One registration creates one tenant and one user.

        The MVP's reversible assumption: one organisation, one authorised
        person.  Multi-user hierarchies are a later package.
        """
        email = normalise_email(email)
        if not email or "@" not in email:
            raise AuthenticationError("Gecerli bir e-posta adresi girin.")
        if len(password) < MIN_PASSWORD_LENGTH:
            raise AuthenticationError(f"Parola en az {MIN_PASSWORD_LENGTH} karakter olmalidir.")
        # The uniqueness check is the one query that legitimately runs before a
        # tenant exists.  It is allowed to see exactly one row: this e-mail's.
        self.scope.set_lookup_email(email)
        try:
            if self.users.email_exists(email):
                raise AuthenticationError("Bu e-posta adresi zaten kayitli.")
        finally:
            # Closed on the way out either way.  The window is transaction-local
            # so nothing escapes the request, but leaving it open means the rest
            # of this transaction runs under an exception it no longer needs.
            self.scope.clear_lookups()

        now = self.clock.now()
        tenant_id = self.ids.new()
        user_id = self.ids.new()
        # Every row below belongs to this brand-new tenant, so the tenant scope
        # goes in first: the policies' WITH CHECK clauses are what accept them.
        self.scope.set_tenant(tenant_id)
        self.tenants.create(tenant_id, organisation_name.strip() or "Organizasyon", now)
        self.users.create(user_id, tenant_id, email, self.hasher.hash(password), now)
        self.audit.add(
            AuditEvent(
                id=self.ids.new(),
                tenant_id=tenant_id,
                actor=user_id,
                action="tenant_and_user_registered",
                subject=user_id,
                occurred_at=now,
                payload={"organisation_name": organisation_name.strip()},
            )
        )
        return UserRecord(id=user_id, tenant_id=tenant_id, email=email, password_hash="")

    def login(self, email: str, password: str) -> LoginResult:
        email = normalise_email(email)
        self.scope.set_lookup_email(email)
        try:
            user = self.users.find_by_email(email)
        except Exception:
            self.scope.clear_lookups()
            raise
        now = self.clock.now()
        # Same message either way, and the same *work* either way: an unknown
        # e-mail is verified against a fixed real Argon2 hash so the expensive
        # path still runs.  Without this, response time answers "does this
        # account exist?" - which is exactly what the uniform message hides.
        # This equalises the hashing work, not the whole request; it is not a
        # constant-time guarantee.
        password_hash = user.password_hash if user is not None else DUMMY_PASSWORD_HASH
        password_matches = self.hasher.verify(password_hash, password)
        if user is None or not password_matches:
            self.scope.clear_lookups()
            raise AuthenticationError("E-posta veya parola hatali.")

        # The user is known: close the pre-auth window and scope everything
        # that follows to their tenant.
        self.scope.clear_lookups()
        self.scope.set_tenant(user.tenant_id)

        token = self.tokens.new_token()
        self.sessions.create(
            session_id=self.ids.new(),
            token_fingerprint=self.tokens.fingerprint(token),
            user_id=user.id,
            tenant_id=user.tenant_id,
            created_at=now,
            expires_at=now + timedelta(seconds=self.session_ttl_seconds),
        )
        self.audit.add(
            AuditEvent(
                id=self.ids.new(),
                tenant_id=user.tenant_id,
                actor=user.id,
                action="session_started",
                subject=user.id,
                occurred_at=now,
            )
        )
        return LoginResult(
            token=token,
            user=UserRecord(
                id=user.id, tenant_id=user.tenant_id, email=user.email, password_hash=""
            ),
        )

    def authenticate(self, token: str | None) -> UserRecord | None:
        if not token:
            return None
        fingerprint = self.tokens.fingerprint(token)
        # The session row is the only thing this request may see until it is
        # found; the fingerprint is already in the caller's cookie.
        self.scope.set_lookup_session_fingerprint(fingerprint)
        try:
            found = self.sessions.find_active(fingerprint, self.clock.now())
        except Exception:
            self.scope.clear_lookups()
            raise
        if found is None:
            # Unknown, expired or revoked: the window closes with the attempt.
            self.scope.clear_lookups()
            return None
        self.scope.clear_lookups()
        self.scope.set_tenant(found.tenant_id)
        return UserRecord(
            id=found.id,
            tenant_id=found.tenant_id,
            email=found.email,
            password_hash="",
        )

    def logout(self, token: str | None, actor: UserRecord | None) -> None:
        if not token:
            return
        now = self.clock.now()
        fingerprint = self.tokens.fingerprint(token)
        self.scope.set_lookup_session_fingerprint(fingerprint)
        if actor is not None:
            self.scope.set_tenant(actor.tenant_id)
        self.sessions.revoke(fingerprint, now)
        self.scope.clear_lookups()
        if actor is not None:
            self.audit.add(
                AuditEvent(
                    id=self.ids.new(),
                    tenant_id=actor.tenant_id,
                    actor=actor.id,
                    action="session_revoked",
                    subject=actor.id,
                    occurred_at=now,
                )
            )


@dataclass(slots=True)
class ProfileService:
    profiles: ProfileRepository
    audit: AuditRepository
    clock: Clock
    ids: IdFactory

    def get(self, tenant_id: str) -> CompanyProfile | None:
        return self.profiles.get(tenant_id)

    def save(
        self, actor: UserRecord, display_name: str, facts: Mapping[str, Any]
    ) -> CompanyProfile:
        existing = self.profiles.get(actor.tenant_id)
        now = self.clock.now()
        profile = CompanyProfile(
            id=existing.id if existing else self.ids.new(),
            tenant_id=actor.tenant_id,
            display_name=display_name.strip() or "Isimsiz sirket",
            facts=dict(facts),
        )
        self.profiles.upsert(profile, now)
        self.audit.add(
            AuditEvent(
                id=self.ids.new(),
                tenant_id=actor.tenant_id,
                actor=actor.id,
                action="company_profile_saved",
                subject=profile.id,
                occurred_at=now,
                # Fact *names* only.  Turnover and headcount are commercially
                # sensitive and never go into the audit payload or the logs.
                payload={"fact_names": sorted(facts)},
            )
        )
        return profile


@dataclass(slots=True)
class EvaluationService:
    catalog: ProgramCatalog
    profiles: ProfileRepository
    decisions: DecisionRepository
    audit: AuditRepository
    clock: Clock
    ids: IdFactory

    def evaluate_all(
        self, actor: UserRecord, as_of: date | None = None
    ) -> list[tuple[DecisionRecord, EvaluationResult]]:
        profile = self.profiles.get(actor.tenant_id)
        if profile is None:
            raise TenantIsolationError("Once sirket profilini doldurun.")

        now = self.clock.now()
        today = as_of or now.date()
        produced: list[tuple[DecisionRecord, EvaluationResult]] = []

        for program in self.catalog.programs:
            result = evaluate(
                EvaluationInput(
                    profile=profile,
                    program=program,
                    rule_set=self.catalog.rule_set_for(program.code),
                    snapshots=self.catalog.snapshots,
                    as_of=today,
                )
            )
            record = DecisionRecord(
                id=self.ids.new(),
                tenant_id=actor.tenant_id,
                profile_id=profile.id,
                program_code=result.program_code,
                program_version_id=result.program_version_id,
                rule_set_version_id=result.rule_set_version_id,
                outcome=result.outcome,
                input_hash=result.input_hash,
                decision_hash=result.decision_hash,
                source_snapshot_ids=result.source_snapshot_ids,
                created_at=now,
                review_status=DecisionReviewStatus.CURRENT,
                reasons=result.reasons,
                missing_facts=result.missing_facts,
                traces=tuple(
                    {
                        "fact": trace.fact,
                        "operator": trace.operator,
                        "expected": trace.expected,
                        "actual": trace.actual,
                        "citation": trace.citation,
                        "result": trace.result.value,
                        "label": trace.label,
                    }
                    for trace in result.traces
                ),
            )
            self.decisions.add(record)
            self.audit.add(
                AuditEvent(
                    id=self.ids.new(),
                    tenant_id=actor.tenant_id,
                    actor=actor.id,
                    action="decision_recorded",
                    subject=record.id,
                    occurred_at=now,
                    payload={
                        "program_code": record.program_code,
                        "outcome": record.outcome.value,
                        "decision_hash": record.decision_hash,
                        "rule_set_version_id": record.rule_set_version_id,
                    },
                )
            )
            produced.append((record, result))
        return produced


@dataclass(slots=True)
class ApprovalService:
    decisions: DecisionRepository
    approvals: ApprovalRepository
    audit: AuditRepository
    clock: Clock
    ids: IdFactory

    def approve(self, actor: UserRecord, decision_id: str, note: str = "") -> ApprovalEvent:
        """Record the *user's own* approval as a new event.

        This never touches the decision row.  An approval is a fact about the
        user, not a change to the evaluation.
        """
        decision = self.decisions.get(actor.tenant_id, decision_id)
        if decision is None:
            raise TenantIsolationError("Karar bulunamadi.")

        now = self.clock.now()
        approval = ApprovalEvent(
            id=self.ids.new(),
            tenant_id=actor.tenant_id,
            decision_id=decision.id,
            actor_user_id=actor.id,
            approved_at=now,
            note=note.strip(),
        )
        self.approvals.add(approval)
        self.audit.add(
            AuditEvent(
                id=self.ids.new(),
                tenant_id=actor.tenant_id,
                actor=actor.id,
                action="user_approval_recorded",
                subject=decision.id,
                occurred_at=now,
                payload={"approval_id": approval.id, "label": approval.label},
            )
        )
        return approval

    def approvals_for(self, tenant_id: str, decision_id: str) -> Sequence[ApprovalEvent]:
        return self.approvals.list_for_decision(tenant_id, decision_id)


@dataclass(slots=True)
class ExplanationService:
    """Optional AI layer.  Never required, never authoritative."""

    provider: AiExplainerPort
    catalog: ProgramCatalog
    audit: AuditRepository
    clock: Clock
    ids: IdFactory

    def explain(self, actor: UserRecord, result: EvaluationResult) -> AiExplanation | None:
        """Return a validated explanation, or ``None`` if anything went wrong.

        A ``None`` here never degrades the deterministic decision - the caller
        already has it.
        """
        allowed = frozenset(result.source_snapshot_ids)
        source_text = "\n\n".join(
            self.catalog.snapshot_texts.get(snapshot_id, "")
            for snapshot_id in result.source_snapshot_ids
        )
        context = (
            f"Program: {result.program_code}\n"
            f"Deterministik sonuc: {result.outcome.value}\n"
            f"Gerekceler: {', '.join(result.reasons) or 'yok'}\n"
            f"Eksik veri: {', '.join(result.missing_facts) or 'yok'}\n"
            f"Izin verilen kaynak kimlikleri: {', '.join(sorted(allowed))}"
        )
        prompt = build_prompt(context, source_text)

        try:
            raw = self.provider.explain(prompt)
        except AiProviderUnavailable:
            return None

        try:
            return validate_ai_output(raw, allowed)
        except AiOutputRejected as rejection:
            self.audit.add(
                AuditEvent(
                    id=self.ids.new(),
                    tenant_id=actor.tenant_id,
                    actor=f"ai:{self.provider.name}",
                    action="ai_output_rejected",
                    subject=result.program_code,
                    occurred_at=self.clock.now(),
                    payload={"reason": rejection.reason, "detail": rejection.detail},
                )
            )
            return None
