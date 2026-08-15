"""Request scoped wiring.

Everything the routers need is assembled here so the routers themselves stay
thin: parse, call a use case, render.
"""

from collections.abc import Iterator
from dataclasses import dataclass

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from destektesvik.adapters.ai.disabled import DisabledAiProvider
from destektesvik.adapters.ai.fake import FakeAiProvider
from destektesvik.adapters.ai.openai_compatible import OpenAiCompatibleProvider
from destektesvik.adapters.catalog import Catalog
from destektesvik.adapters.db.repositories import (
    ApprovalRepositoryImpl,
    AuditRepositoryImpl,
    DecisionRepositoryImpl,
    ProfileRepositoryImpl,
    SessionRepositoryImpl,
    TenantRepositoryImpl,
    UserRepositoryImpl,
)
from destektesvik.adapters.db.session import SqlRequestScope, apply_tenant_scope
from destektesvik.adapters.support import Argon2Hasher, OpaqueTokenFactory, UuidFactory
from destektesvik.application.dto import UserRecord
from destektesvik.application.ports import AiExplainerPort
from destektesvik.application.services import (
    ApprovalService,
    AuthService,
    EvaluationService,
    ExplanationService,
    ProfileService,
)
from destektesvik.config import Settings


def build_ai_provider(settings: Settings) -> AiExplainerPort:
    """Disabled unless an operator explicitly turned something on."""
    if settings.ai_provider == "fake":
        return FakeAiProvider()
    if settings.ai_provider == "openai_compatible":
        try:
            return OpenAiCompatibleProvider(
                base_url=settings.ai_base_url,
                api_key=settings.ai_api_key,
                model=settings.ai_model,
                timeout_seconds=settings.ai_timeout_seconds,
            )
        except Exception:
            # Misconfiguration must never take the deterministic engine down.
            return DisabledAiProvider()
    return DisabledAiProvider()


def get_settings_dep(request: Request) -> Settings:
    return request.app.state.settings


def get_catalog(request: Request) -> Catalog:
    return request.app.state.catalog


def get_session(request: Request) -> Iterator[Session]:
    session_factory = request.app.state.session_factory
    session = session_factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


@dataclass(slots=True)
class Services:
    auth: AuthService
    profiles: ProfileService
    evaluation: EvaluationService
    approvals: ApprovalService
    explanations: ExplanationService
    settings: Settings
    catalog: Catalog


def get_services(
    request: Request,
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings_dep),
    catalog: Catalog = Depends(get_catalog),
) -> Services:
    clock = request.app.state.clock
    ids = request.app.state.id_factory
    audit = AuditRepositoryImpl(session)
    decisions = DecisionRepositoryImpl(session)
    profiles_repo = ProfileRepositoryImpl(session)

    auth = AuthService(
        tenants=TenantRepositoryImpl(session),
        users=UserRepositoryImpl(session),
        sessions=SessionRepositoryImpl(session),
        hasher=request.app.state.password_hasher,
        tokens=request.app.state.token_factory,
        clock=clock,
        ids=ids,
        audit=audit,
        scope=SqlRequestScope(session),
        session_ttl_seconds=settings.session_ttl_seconds,
    )
    return Services(
        auth=auth,
        profiles=ProfileService(profiles=profiles_repo, audit=audit, clock=clock, ids=ids),
        evaluation=EvaluationService(
            catalog=catalog,
            profiles=profiles_repo,
            decisions=decisions,
            audit=audit,
            clock=clock,
            ids=ids,
        ),
        approvals=ApprovalService(
            decisions=decisions,
            approvals=ApprovalRepositoryImpl(session),
            audit=audit,
            clock=clock,
            ids=ids,
        ),
        explanations=ExplanationService(
            provider=request.app.state.ai_provider,
            catalog=catalog,
            audit=audit,
            clock=clock,
            ids=ids,
        ),
        settings=settings,
        catalog=catalog,
    )


def current_user(
    request: Request,
    services: Services = Depends(get_services),
    session: Session = Depends(get_session),
) -> UserRecord | None:
    token = request.cookies.get(services.settings.session_cookie_name)
    user = services.auth.authenticate(token)
    if user is not None:
        # Every subsequent statement in this transaction is now scoped to the
        # authenticated tenant at the database level as well.
        apply_tenant_scope(session, user.tenant_id)
    return user


def default_ids() -> UuidFactory:
    return UuidFactory()


def default_hasher() -> Argon2Hasher:
    return Argon2Hasher()


def default_tokens() -> OpaqueTokenFactory:
    return OpaqueTokenFactory()
