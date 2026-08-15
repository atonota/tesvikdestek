"""A small JSON API alongside the pages.

API-first in the sense that matters: the same use cases back both surfaces,
and the OpenAPI document describes the real four-valued outcome.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from destektesvik.application.errors import TenantIsolationError
from destektesvik.delivery.deps import Services, current_user, get_services
from destektesvik.delivery.schemas import (
    CsrfTokenOut,
    DecisionOut,
    ProgramOut,
    SnapshotOut,
    TraceOut,
)
from destektesvik.delivery.security import (
    CSRF_COOKIE_NAME,
    CSRF_HEADER_NAME,
    new_csrf_secret,
    sign_csrf,
    verify_csrf,
)
from destektesvik.domain.evaluation import DISCLAIMER, OUTCOME_LABELS, EligibilityOutcome

router = APIRouter(prefix="/api", tags=["api"])


def _require_user(user):
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Kimlik dogrulanmadi.")
    return user


def _require_api_csrf(request: Request, services: Services) -> None:
    """The JSON write path proves same-origin the same way the forms do.

    ``SameSite=lax`` is a useful second layer, but it is the browser's promise,
    not ours: it varies by browser and by request shape.  A signed token that
    must match an httpOnly cookie does not depend on any of that.
    """
    submitted = request.headers.get(CSRF_HEADER_NAME)
    if not verify_csrf(
        services.settings.secret_key, request.cookies.get(CSRF_COOKIE_NAME), submitted
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Guvenlik dogrulamasi basarisiz. Once GET /api/csrf ile "
                f"jeton alip {CSRF_HEADER_NAME} basliginda gonderin."
            ),
        )


def _decision_out(decision) -> DecisionOut:
    outcome = (
        decision.outcome
        if isinstance(decision.outcome, EligibilityOutcome)
        else EligibilityOutcome(decision.outcome)
    )
    return DecisionOut(
        id=decision.id,
        program_code=decision.program_code,
        program_version_id=decision.program_version_id,
        rule_set_version_id=decision.rule_set_version_id,
        outcome=outcome.value,
        outcome_label=OUTCOME_LABELS[outcome],
        input_hash=decision.input_hash,
        decision_hash=decision.decision_hash,
        source_snapshot_ids=list(decision.source_snapshot_ids),
        reasons=list(decision.reasons),
        missing_facts=list(decision.missing_facts),
        traces=[TraceOut(**dict(trace)) for trace in decision.traces],
        review_status=decision.review_status.value,
        created_at=decision.created_at.isoformat(),
        disclaimer=DISCLAIMER,
    )


@router.get("/csrf", response_model=CsrfTokenOut)
def issue_csrf_token(
    request: Request,
    response: Response,
    services: Services = Depends(get_services),
) -> CsrfTokenOut:
    """Issue a signed CSRF token and refresh its httpOnly cookie.

    Same-origin by construction: the token is only useful together with the
    cookie set on this response, which a cross-site caller cannot read.  It
    carries no user data, so an anonymous caller may take one and still be
    refused at the write endpoint.
    """
    settings = services.settings
    csrf_secret = request.cookies.get(CSRF_COOKIE_NAME) or new_csrf_secret()
    response.set_cookie(
        CSRF_COOKIE_NAME,
        csrf_secret,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite=settings.session_cookie_samesite,
        max_age=settings.session_ttl_seconds,
        path="/",
    )
    return CsrfTokenOut(csrf_token=sign_csrf(settings.secret_key, csrf_secret))


@router.get("/programlar", response_model=list[ProgramOut])
def list_programs(services: Services = Depends(get_services)) -> list[ProgramOut]:
    from datetime import UTC, datetime

    today = datetime.now(UTC).date()
    return [
        ProgramOut(
            code=program.code,
            name=program.name,
            version=program.version,
            support_type=program.support_type.value,
            official_url=program.official_url,
            call_window_state=program.call_window.state(today).value,
            source_snapshot_ids=list(program.source_snapshot_ids),
            required_documents=list(program.required_documents),
            published_reference=(
                program.published_reference.amount.formatted()
                if program.published_reference
                else None
            ),
            notes=program.notes,
        )
        for program in services.catalog.programs
    ]


@router.get("/kaynaklar", response_model=list[SnapshotOut])
def list_snapshots(services: Services = Depends(get_services)) -> list[SnapshotOut]:
    return [
        SnapshotOut(
            id=snapshot.id,
            url=snapshot.url,
            publisher=snapshot.publisher,
            title=snapshot.title,
            captured_at=snapshot.captured_at.isoformat(),
            content_hash=snapshot.content_hash,
            content_hash_short=snapshot.short_hash(),
            effective_from=(
                snapshot.effective_from.isoformat() if snapshot.effective_from else None
            ),
            effective_to=snapshot.effective_to.isoformat() if snapshot.effective_to else None,
            review_status=snapshot.review_status.value,
        )
        for snapshot in services.catalog.snapshots.values()
    ]


@router.get("/degerlendirmeler", response_model=list[DecisionOut])
def list_decisions(
    services: Services = Depends(get_services), user=Depends(current_user)
) -> list[DecisionOut]:
    user = _require_user(user)
    return [
        _decision_out(decision)
        for decision in services.evaluation.decisions.list_for_tenant(user.tenant_id)
    ]


@router.get("/degerlendirmeler/{decision_id}", response_model=DecisionOut)
def get_decision(
    decision_id: str,
    services: Services = Depends(get_services),
    user=Depends(current_user),
) -> DecisionOut:
    user = _require_user(user)
    decision = services.evaluation.decisions.get(user.tenant_id, decision_id)
    if decision is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Karar bulunamadi.")
    return _decision_out(decision)


@router.post("/degerlendir", response_model=list[DecisionOut], status_code=201)
def evaluate_now(
    request: Request,
    services: Services = Depends(get_services),
    user=Depends(current_user),
) -> list[DecisionOut]:
    # Authentication first, deliberately: an anonymous caller gets the same 401
    # whatever their token looks like, so this endpoint never becomes an oracle
    # for whether a CSRF token is valid.
    user = _require_user(user)
    _require_api_csrf(request, services)
    try:
        produced = services.evaluation.evaluate_all(user)
    except TenantIsolationError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return [_decision_out(record) for record, _ in produced]
