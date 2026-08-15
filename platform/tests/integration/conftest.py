"""Integration fixtures.

Two tiers on purpose:

* the app-layer tier runs on SQLite so the whole journey is testable on any
  machine, including an arm64 laptop with no Docker;
* the database-security tier (RLS, append-only triggers, migrations) only runs
  against a real PostgreSQL, because those guarantees are PostgreSQL's, and
  pretending SQLite can stand in for them would be the exact kind of false
  assurance this product is built to avoid.
"""

import os
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from destektesvik.adapters.catalog import load_catalog
from destektesvik.adapters.db.models import Base
from destektesvik.adapters.db.session import create_app_engine
from destektesvik.config import Settings
from destektesvik.delivery.app import create_app
from destektesvik.delivery.security import CSRF_FIELD_NAME

POSTGRES_URL_ENV = "DESTEKTESVIK_TEST_DATABASE_URL"

PASSWORD = "cok-guclu-parola-2026"


@pytest.fixture(scope="session")
def catalog():
    return load_catalog()


@pytest.fixture
def app(tmp_path, catalog):
    settings = Settings(
        database_url=f"sqlite+pysqlite:///{tmp_path / 'test.db'}",
        secret_key="test-secret-key-not-for-production",
        session_cookie_secure=False,
        ai_provider="disabled",
    )
    engine = create_app_engine(settings.database_url)
    Base.metadata.create_all(engine)
    return create_app(settings=settings, engine=engine, catalog=catalog)


@pytest.fixture
def client(app) -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client


def csrf_token_from(html: str) -> str:
    """Pull the hidden CSRF field out of a rendered form."""
    marker = f'name="{CSRF_FIELD_NAME}" value="'
    start = html.index(marker) + len(marker)
    return html[start : html.index('"', start)]


def register_and_login(client: TestClient, email: str, organisation: str) -> None:
    page = client.get("/kayit")
    client.post(
        "/kayit",
        data={
            "eposta": email,
            "parola": PASSWORD,
            "organizasyon": organisation,
            CSRF_FIELD_NAME: csrf_token_from(page.text),
        },
        follow_redirects=False,
    )
    login_page = client.get("/giris")
    client.post(
        "/giris",
        data={
            "eposta": email,
            "parola": PASSWORD,
            CSRF_FIELD_NAME: csrf_token_from(login_page.text),
        },
        follow_redirects=False,
    )


def save_profile(client: TestClient, **overrides) -> None:
    page = client.get("/profil")
    payload = {
        "display_name": "Ornek Yazilim A.S.",
        "is_capital_company": "true",
        "is_resident_in_turkey": "true",
        "sme_declaration": "true",
        "has_previous_tubitak_project": "false",
        "kosgeb_db_registered": "true",
        "kosgeb_declaration_current": "true",
        "employee_count": "8",
        "annual_revenue_try": "4500000",
        "founded_year": "2024",
        "nace_code": "62.01",
        "nace_section": "J",
        "region_code": "TR51",
        CSRF_FIELD_NAME: csrf_token_from(page.text),
    }
    payload.update(overrides)
    client.post("/profil", data=payload, follow_redirects=False)


def run_evaluation(client: TestClient) -> None:
    page = client.get("/profil")
    client.post(
        "/degerlendir",
        data={CSRF_FIELD_NAME: csrf_token_from(page.text)},
        follow_redirects=False,
    )


@pytest.fixture
def postgres_url() -> str:
    url = os.environ.get(POSTGRES_URL_ENV, "")
    if not url:
        pytest.skip(
            f"{POSTGRES_URL_ENV} is not set; PostgreSQL-only guarantees (RLS, "
            "append-only triggers, migrations) cannot be verified on this host"
        )
    return url
