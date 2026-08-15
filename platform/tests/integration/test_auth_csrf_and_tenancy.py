"""Tests 7 and 8 - authentication, CSRF and tenant isolation at the app layer.

The database half of tenant isolation lives in ``test_postgres_security.py``.
Neither half is trusted on its own.
"""

import pytest

from tests.integration.conftest import (
    PASSWORD,
    csrf_token_from,
    register_and_login,
    run_evaluation,
    save_profile,
)

PROTECTED_PAGES = ["/profil", "/degerlendirmeler"]


class TestAuthentication:
    @pytest.mark.parametrize("path", PROTECTED_PAGES)
    def test_an_anonymous_visitor_is_sent_to_the_login_page(self, client, path) -> None:
        response = client.get(path, follow_redirects=False)
        assert response.status_code == 303
        assert response.headers["location"].startswith("/giris")

    @pytest.mark.parametrize("path", ["/api/degerlendirmeler", "/api/degerlendirmeler/herhangi"])
    def test_the_json_api_refuses_anonymous_callers(self, client, path) -> None:
        assert client.get(path).status_code == 401

    def test_anonymous_evaluation_is_refused(self, client) -> None:
        assert client.post("/api/degerlendir").status_code == 401

    def test_a_wrong_password_is_refused_with_the_same_message_as_a_wrong_email(
        self, client
    ) -> None:
        register_and_login(client, "biri@ornek.com.tr", "Biri A.S.")
        client.cookies.clear()

        page = client.get("/giris")
        wrong_password = client.post(
            "/giris",
            data={
                "eposta": "biri@ornek.com.tr",
                "parola": "yanlis-parola-123456",
                "csrf_token": csrf_token_from(page.text),
            },
        )
        page = client.get("/giris")
        wrong_email = client.post(
            "/giris",
            data={
                "eposta": "yok@ornek.com.tr",
                "parola": PASSWORD,
                "csrf_token": csrf_token_from(page.text),
            },
        )
        assert wrong_password.status_code == wrong_email.status_code == 401
        assert "E-posta veya parola hatali." in wrong_password.text
        assert "E-posta veya parola hatali." in wrong_email.text

    def test_the_session_cookie_is_httponly_and_not_a_jwt(self, client) -> None:
        page = client.get("/kayit")
        client.post(
            "/kayit",
            data={
                "eposta": "cerez@ornek.com.tr",
                "parola": PASSWORD,
                "organizasyon": "Cerez A.S.",
                "csrf_token": csrf_token_from(page.text),
            },
            follow_redirects=False,
        )
        login_page = client.get("/giris")
        login = client.post(
            "/giris",
            data={
                "eposta": "cerez@ornek.com.tr",
                "parola": PASSWORD,
                "csrf_token": csrf_token_from(login_page.text),
            },
            follow_redirects=False,
        )
        set_cookie = login.headers.get("set-cookie", "")
        assert "destektesvik_session=" in set_cookie
        assert "HttpOnly" in set_cookie
        assert "SameSite=lax" in set_cookie
        token = client.cookies.get("destektesvik_session")
        # Three dot-separated segments would mean a JWT; this must not be one.
        assert token and token.count(".") != 2

    def test_logout_revokes_the_session_server_side(self, client) -> None:
        register_and_login(client, "cikis@ornek.com.tr", "Cikis A.S.")
        page = client.get("/profil")
        token = client.cookies.get("destektesvik_session")
        client.post(
            "/cikis", data={"csrf_token": csrf_token_from(page.text)}, follow_redirects=False
        )
        # Even replaying the old cookie must not work: revocation is server side.
        client.cookies.set("destektesvik_session", token)
        assert client.get("/profil", follow_redirects=False).status_code == 303


class TestCsrf:
    def test_a_post_without_a_csrf_token_is_refused(self, client) -> None:
        register_and_login(client, "csrf@ornek.com.tr", "Csrf A.S.")
        response = client.post("/profil", data={"display_name": "Saldiri"}, follow_redirects=False)
        assert response.status_code == 400

    def test_a_post_with_a_forged_csrf_token_is_refused(self, client) -> None:
        register_and_login(client, "sahte@ornek.com.tr", "Sahte A.S.")
        response = client.post(
            "/profil",
            data={"display_name": "Saldiri", "csrf_token": "uydurma-token"},
            follow_redirects=False,
        )
        assert response.status_code == 400

    def test_a_token_signed_for_a_different_cookie_is_refused(self, client) -> None:
        """A stolen-but-mismatched token must not pass the double-submit check."""
        register_and_login(client, "eslesmez@ornek.com.tr", "Eslesmez A.S.")
        page = client.get("/profil")
        stolen = csrf_token_from(page.text)
        client.cookies.set("destektesvik_csrf", "baska-bir-deger")
        response = client.post(
            "/profil",
            data={"display_name": "Saldiri", "csrf_token": stolen},
            follow_redirects=False,
        )
        assert response.status_code == 400

    def test_registration_and_login_are_csrf_protected_too(self, client) -> None:
        assert (
            client.post(
                "/kayit",
                data={"eposta": "a@b.com", "parola": PASSWORD, "organizasyon": "X"},
            ).status_code
            == 400
        )
        assert (
            client.post("/giris", data={"eposta": "a@b.com", "parola": PASSWORD}).status_code == 400
        )

    def test_a_valid_token_is_accepted(self, client) -> None:
        register_and_login(client, "gecerli@ornek.com.tr", "Gecerli A.S.")
        save_profile(client)
        assert "Ornek Yazilim" in client.get("/profil").text


class TestApiCsrf:
    """Finding D - the JSON API writes, so it needs the same proof of origin.

    ``SameSite=lax`` is a browser default, not a guarantee: it is per-browser,
    it does not cover every request shape, and it is not something this
    application can assert.  The write path therefore carries its own signed
    token.
    """

    def _authenticated(self, client):
        register_and_login(client, "apicsrf@ornek.com.tr", "Api A.S.")
        save_profile(client)
        return client

    def test_the_token_endpoint_issues_a_signed_token_and_refreshes_the_cookie(
        self, client
    ) -> None:
        self._authenticated(client)
        response = client.get("/api/csrf")
        assert response.status_code == 200
        token = response.json()["csrf_token"]
        assert token
        set_cookie = response.headers.get("set-cookie", "")
        assert "destektesvik_csrf=" in set_cookie
        assert "HttpOnly" in set_cookie

    def test_a_write_without_a_csrf_header_is_refused(self, client) -> None:
        self._authenticated(client)
        assert client.post("/api/degerlendir").status_code == 400

    def test_a_write_with_a_forged_csrf_header_is_refused(self, client) -> None:
        self._authenticated(client)
        response = client.post("/api/degerlendir", headers={"X-CSRF-Token": "uydurma-token"})
        assert response.status_code == 400

    def test_a_token_signed_for_a_different_cookie_is_refused(self, client) -> None:
        self._authenticated(client)
        stolen = client.get("/api/csrf").json()["csrf_token"]
        client.cookies.set("destektesvik_csrf", "baska-bir-deger")
        response = client.post("/api/degerlendir", headers={"X-CSRF-Token": stolen})
        assert response.status_code == 400

    def test_a_valid_token_is_accepted_and_writes(self, client) -> None:
        self._authenticated(client)
        token = client.get("/api/csrf").json()["csrf_token"]
        response = client.post("/api/degerlendir", headers={"X-CSRF-Token": token})
        assert response.status_code == 201
        assert len(response.json()) == 3

    def test_no_decision_is_written_when_the_token_is_missing(self, client) -> None:
        """A refused write must be refused *before* it writes anything."""
        self._authenticated(client)
        assert client.post("/api/degerlendir").status_code == 400
        assert client.get("/api/degerlendirmeler").json() == []

    def test_an_anonymous_caller_is_still_401_and_learns_nothing(self, client) -> None:
        """Authentication is checked first: CSRF must not become an oracle."""
        anonymous = client.post("/api/degerlendir", headers={"X-CSRF-Token": "her-neyse"})
        assert anonymous.status_code == 401
        assert "csrf" not in anonymous.text.lower()

    def test_the_token_endpoint_does_not_leak_data_to_anonymous_callers(self, client) -> None:
        response = client.get("/api/csrf")
        assert response.status_code == 200
        assert set(response.json()) == {"csrf_token"}


class TestTenantIsolationAtTheApplicationLayer:
    def _two_tenants(self, app):
        from fastapi.testclient import TestClient

        alice = TestClient(app)
        bob = TestClient(app)
        register_and_login(alice, "alice@ornek.com.tr", "Alice A.S.")
        save_profile(alice, display_name="Alice A.S.")
        run_evaluation(alice)
        register_and_login(bob, "bob@ornek.com.tr", "Bob A.S.")
        save_profile(bob, display_name="Bob A.S.")
        run_evaluation(bob)
        return alice, bob

    def test_a_tenant_only_sees_its_own_decisions(self, app) -> None:
        alice, bob = self._two_tenants(app)
        alice_ids = {d["id"] for d in alice.get("/api/degerlendirmeler").json()}
        bob_ids = {d["id"] for d in bob.get("/api/degerlendirmeler").json()}
        assert alice_ids and bob_ids
        assert alice_ids.isdisjoint(bob_ids)

    def test_a_tenant_cannot_read_another_tenants_decision_by_id(self, app) -> None:
        alice, bob = self._two_tenants(app)
        alice_decision_id = alice.get("/api/degerlendirmeler").json()[0]["id"]
        assert bob.get(f"/api/degerlendirmeler/{alice_decision_id}").status_code == 404

    def test_a_tenant_cannot_open_another_tenants_decision_page(self, app) -> None:
        alice, bob = self._two_tenants(app)
        alice_decision_id = alice.get("/api/degerlendirmeler").json()[0]["id"]
        assert bob.get(f"/degerlendirmeler/{alice_decision_id}").status_code == 404

    def test_a_tenant_cannot_approve_another_tenants_decision(self, app) -> None:
        alice, bob = self._two_tenants(app)
        alice_decision_id = alice.get("/api/degerlendirmeler").json()[0]["id"]
        page = bob.get("/profil")
        response = bob.post(
            f"/degerlendirmeler/{alice_decision_id}/onay",
            data={"not": "", "csrf_token": csrf_token_from(page.text)},
            follow_redirects=False,
        )
        assert response.status_code == 404

    def test_a_tenant_does_not_see_another_tenants_profile(self, app) -> None:
        alice, bob = self._two_tenants(app)
        assert "Alice A.S." not in bob.get("/profil").text
