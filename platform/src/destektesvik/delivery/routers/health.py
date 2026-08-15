"""Liveness and readiness.

``/saglik`` answers "the process is up".  ``/hazir`` answers "the database
answers and the catalogue loaded" - a different question, and the one a load
balancer should ask.
"""

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from destektesvik.delivery.deps import get_session

router = APIRouter(tags=["health"])


@router.get("/saglik")
def liveness() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/hazir")
def readiness(
    request: Request, response: Response, session: Session = Depends(get_session)
) -> dict[str, object]:
    checks: dict[str, object] = {"database": "unknown", "catalog": "unknown"}
    healthy = True
    try:
        session.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception:
        checks["database"] = "unavailable"
        healthy = False

    programs = getattr(request.app.state.catalog, "programs", ())
    if programs:
        checks["catalog"] = "ok"
        checks["program_count"] = len(programs)
    else:
        checks["catalog"] = "empty"
        healthy = False

    checks["ai_provider"] = request.app.state.ai_provider.name
    checks["status"] = "ready" if healthy else "not_ready"
    if not healthy:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return checks
