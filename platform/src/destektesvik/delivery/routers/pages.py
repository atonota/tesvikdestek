"""Server-rendered Turkish pages - the whole MVP journey.

Routers stay thin on purpose: parse the request, call one use case, render.
No eligibility logic lives in this file.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Form, HTTPException, Request, status
from fastapi.responses import HTMLResponse, RedirectResponse

from destektesvik.application.errors import (
    ApplicationError,
    AuthenticationError,
    CsrfError,
    TenantIsolationError,
)
from destektesvik.delivery.deps import Services, current_user, get_services, get_session
from destektesvik.delivery.forms import (
    BOOLEAN_FACTS,
    FACT_LABELS,
    INTEGER_FACTS,
    TEXT_FACTS,
    TRISTATE_CHOICES,
    parse_profile_form,
)
from destektesvik.delivery.security import (
    CSRF_COOKIE_NAME,
    CSRF_FIELD_NAME,
    new_csrf_secret,
    sign_csrf,
    verify_csrf,
)
from destektesvik.domain.evaluation import OUTCOME_LABELS, REASON_LABELS

router = APIRouter(tags=["pages"])


def _templates(request: Request):
    return request.app.state.templates


def _render(request: Request, template: str, context: dict, status_code: int = 200):
    csrf_secret = request.cookies.get(CSRF_COOKIE_NAME) or new_csrf_secret()
    settings = request.app.state.settings
    context = {
        "request": request,
        "csrf_field": CSRF_FIELD_NAME,
        "csrf_token": sign_csrf(settings.secret_key, csrf_secret),
        "app_name": settings.app_name,
        "outcome_labels": OUTCOME_LABELS,
        "reason_labels": REASON_LABELS,
        **context,
    }
    response = _templates(request).TemplateResponse(
        request, template, context, status_code=status_code
    )
    response.set_cookie(
        CSRF_COOKIE_NAME,
        csrf_secret,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite=settings.session_cookie_samesite,
        max_age=settings.session_ttl_seconds,
        path="/",
    )
    return response


def _require_csrf(request: Request, submitted: str | None) -> None:
    settings = request.app.state.settings
    if not verify_csrf(settings.secret_key, request.cookies.get(CSRF_COOKIE_NAME), submitted):
        raise CsrfError("Form guvenlik dogrulamasi basarisiz. Sayfayi yenileyip tekrar deneyin.")


def _require_user(user):
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_303_SEE_OTHER,
            headers={"Location": "/giris?hata=oturum"},
        )
    return user


@router.get("/", response_class=HTMLResponse)
def landing(request: Request, user=Depends(current_user)):
    return _render(request, "index.html", {"user": user})


@router.get("/kayit", response_class=HTMLResponse)
def register_form(request: Request, hata: str = ""):
    return _render(request, "kayit.html", {"error": hata})


@router.post("/kayit")
def register_submit(
    request: Request,
    eposta: Annotated[str, Form()],
    parola: Annotated[str, Form()],
    organizasyon: Annotated[str, Form()] = "",
    csrf_token: Annotated[str, Form()] = "",
    services: Services = Depends(get_services),
):
    _require_csrf(request, csrf_token)
    try:
        services.auth.register(eposta, parola, organizasyon)
    except AuthenticationError as exc:
        return _render(request, "kayit.html", {"error": str(exc)}, status_code=400)
    return RedirectResponse("/giris?kayit=tamam", status_code=status.HTTP_303_SEE_OTHER)


@router.get("/giris", response_class=HTMLResponse)
def login_form(request: Request, hata: str = "", kayit: str = ""):
    return _render(request, "giris.html", {"error": hata, "registered": kayit == "tamam"})


@router.post("/giris")
def login_submit(
    request: Request,
    eposta: Annotated[str, Form()],
    parola: Annotated[str, Form()],
    csrf_token: Annotated[str, Form()] = "",
    services: Services = Depends(get_services),
):
    _require_csrf(request, csrf_token)
    try:
        result = services.auth.login(eposta, parola)
    except AuthenticationError as exc:
        return _render(request, "giris.html", {"error": str(exc)}, status_code=401)

    settings = services.settings
    response = RedirectResponse("/profil", status_code=status.HTTP_303_SEE_OTHER)
    response.set_cookie(
        settings.session_cookie_name,
        result.token,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite=settings.session_cookie_samesite,
        max_age=settings.session_ttl_seconds,
        path="/",
    )
    return response


@router.post("/cikis")
def logout(
    request: Request,
    csrf_token: Annotated[str, Form()] = "",
    services: Services = Depends(get_services),
    user=Depends(current_user),
):
    _require_csrf(request, csrf_token)
    token = request.cookies.get(services.settings.session_cookie_name)
    services.auth.logout(token, user)
    response = RedirectResponse("/", status_code=status.HTTP_303_SEE_OTHER)
    response.delete_cookie(services.settings.session_cookie_name, path="/")
    return response


@router.get("/profil", response_class=HTMLResponse)
def profile_form(
    request: Request,
    services: Services = Depends(get_services),
    user=Depends(current_user),
):
    user = _require_user(user)
    profile = services.profiles.get(user.tenant_id)
    return _render(
        request,
        "profil.html",
        {
            "user": user,
            "profile": profile,
            "facts": dict(profile.facts) if profile else {},
            "boolean_facts": BOOLEAN_FACTS,
            "integer_facts": INTEGER_FACTS,
            "text_facts": TEXT_FACTS,
            "fact_labels": FACT_LABELS,
            "tristate_choices": TRISTATE_CHOICES,
            "saved": request.query_params.get("kayit") == "tamam",
        },
    )


@router.post("/profil")
async def profile_submit(
    request: Request,
    services: Services = Depends(get_services),
    user=Depends(current_user),
):
    user = _require_user(user)
    form = await request.form()
    _require_csrf(request, str(form.get(CSRF_FIELD_NAME, "")))
    facts = parse_profile_form(form, services.evaluation.clock.now().date())
    services.profiles.save(user, str(form.get("display_name", "")), facts)
    return RedirectResponse("/profil?kayit=tamam", status_code=status.HTTP_303_SEE_OTHER)


@router.post("/degerlendir")
def run_evaluation(
    request: Request,
    csrf_token: Annotated[str, Form()] = "",
    services: Services = Depends(get_services),
    user=Depends(current_user),
):
    user = _require_user(user)
    _require_csrf(request, csrf_token)
    try:
        services.evaluation.evaluate_all(user)
    except TenantIsolationError:
        return RedirectResponse("/profil?hata=profil", status_code=status.HTTP_303_SEE_OTHER)
    return RedirectResponse("/degerlendirmeler", status_code=status.HTTP_303_SEE_OTHER)


@router.get("/degerlendirmeler", response_class=HTMLResponse)
def decision_list(
    request: Request,
    services: Services = Depends(get_services),
    user=Depends(current_user),
):
    user = _require_user(user)
    decisions = services.evaluation.decisions.list_for_tenant(user.tenant_id)
    programs = {program.code: program for program in services.catalog.programs}
    return _render(
        request,
        "degerlendirmeler.html",
        {"user": user, "decisions": decisions, "programs": programs},
    )


@router.get("/degerlendirmeler/{decision_id}", response_class=HTMLResponse)
def decision_detail(
    decision_id: str,
    request: Request,
    services: Services = Depends(get_services),
    user=Depends(current_user),
):
    user = _require_user(user)
    decision = services.evaluation.decisions.get(user.tenant_id, decision_id)
    if decision is None:
        return _render(request, "bulunamadi.html", {"user": user}, status_code=404)

    programs = {program.code: program for program in services.catalog.programs}
    program = programs.get(decision.program_code)
    snapshots = [
        services.catalog.snapshots[snapshot_id]
        for snapshot_id in decision.source_snapshot_ids
        if snapshot_id in services.catalog.snapshots
    ]
    return _render(
        request,
        "karar.html",
        {
            "user": user,
            "decision": decision,
            "program": program,
            "snapshots": snapshots,
            "approvals": services.approvals.approvals_for(user.tenant_id, decision.id),
            "fact_labels": FACT_LABELS,
        },
    )


@router.post("/degerlendirmeler/{decision_id}/onay")
def approve_decision(
    decision_id: str,
    request: Request,
    not_: Annotated[str, Form(alias="not")] = "",
    csrf_token: Annotated[str, Form()] = "",
    services: Services = Depends(get_services),
    user=Depends(current_user),
):
    user = _require_user(user)
    _require_csrf(request, csrf_token)
    try:
        services.approvals.approve(user, decision_id, not_)
    except TenantIsolationError:
        return _render(request, "bulunamadi.html", {"user": user}, status_code=404)
    return RedirectResponse(
        f"/degerlendirmeler/{decision_id}?onay=tamam", status_code=status.HTTP_303_SEE_OTHER
    )


@router.get("/kaynaklar", response_class=HTMLResponse)
def sources_page(
    request: Request,
    services: Services = Depends(get_services),
    user=Depends(current_user),
):
    return _render(
        request,
        "kaynaklar.html",
        {
            "user": user,
            "programs": services.catalog.programs,
            "snapshots": services.catalog.snapshots,
        },
    )


__all__ = ["router", "ApplicationError", "get_session"]
