"""FastAPI application factory.

FastAPI is the delivery adapter and nothing more: it parses HTTP, calls a use
case and renders.  Swapping it out would not touch ``domain`` at all, which is
enforced by ``tests/architecture``.
"""

from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy import Engine

from destektesvik.adapters.catalog import Catalog, load_catalog
from destektesvik.adapters.db.session import create_app_engine, create_session_factory
from destektesvik.adapters.support import (
    Argon2Hasher,
    OpaqueTokenFactory,
    SystemClock,
    UuidFactory,
)
from destektesvik.application.errors import ApplicationError, CsrfError
from destektesvik.config import Settings, get_settings
from destektesvik.delivery.deps import build_ai_provider
from destektesvik.delivery.routers import api, health, pages

PACKAGE_ROOT = Path(__file__).resolve().parent.parent
TEMPLATE_DIR = PACKAGE_ROOT / "templates"
STATIC_DIR = PACKAGE_ROOT / "static"

API_DESCRIPTION = """
DestekTesvik MVP - deterministik destek programi on degerlendirmesi.

**Sinirlar:** Bu API resmi kuruma basvuru gondermez, hak edilmis tutar hesaplamaz ve
"resmen onaylandi" sonucu uretmez. Sonuclar `candidate_eligible`, `ineligible`,
`conditional` ve `insufficient_data` degerlerinden biridir ve baglayici degildir.
"""


def create_app(
    settings: Settings | None = None,
    engine: Engine | None = None,
    catalog: Catalog | None = None,
    clock=None,
    id_factory=None,
) -> FastAPI:
    settings = settings or get_settings()
    engine = engine or create_app_engine(settings.database_url)

    app = FastAPI(
        title=f"{settings.app_name} MVP",
        version="0.1.0",
        description=API_DESCRIPTION,
        docs_url="/api/dokuman",
        redoc_url=None,
    )

    app.state.settings = settings
    app.state.engine = engine
    app.state.session_factory = create_session_factory(engine)
    app.state.catalog = catalog or load_catalog()
    app.state.clock = clock or SystemClock()
    app.state.id_factory = id_factory or UuidFactory()
    app.state.password_hasher = Argon2Hasher()
    app.state.token_factory = OpaqueTokenFactory()
    app.state.ai_provider = build_ai_provider(settings)

    templates = Jinja2Templates(directory=str(TEMPLATE_DIR))
    templates.env.globals["app_name"] = settings.app_name
    app.state.templates = templates

    if STATIC_DIR.is_dir():
        app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

    app.include_router(health.router)
    app.include_router(pages.router)
    app.include_router(api.router)

    @app.exception_handler(CsrfError)
    def _csrf_handler(request: Request, exc: CsrfError):
        if request.url.path.startswith("/api"):
            return JSONResponse({"detail": str(exc)}, status_code=400)
        return HTMLResponse(
            f"<!doctype html><html lang='tr'><meta charset='utf-8'>"
            f"<title>Guvenlik dogrulamasi</title><main><h1>Islem tamamlanamadi</h1>"
            f"<p>{exc}</p><p><a href='/'>Ana sayfaya don</a></p></main></html>",
            status_code=400,
        )

    @app.exception_handler(ApplicationError)
    def _application_handler(request: Request, exc: ApplicationError):
        return JSONResponse({"detail": str(exc)}, status_code=400)

    return app


def build_default_app() -> FastAPI:
    """Entry point for ``uvicorn --factory destektesvik.delivery.app:build_default_app``."""
    return create_app()
