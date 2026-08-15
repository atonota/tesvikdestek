"""Test 12 - the whole MVP journey, plus the OpenAPI smoke.

Register -> log in -> fill the profile -> evaluate -> read the reasoning ->
approve.  If this file passes, the product does the one thing it claims to do.
"""

from tests.integration.conftest import (
    csrf_token_from,
    register_and_login,
    run_evaluation,
    save_profile,
)


def test_landing_page_states_what_the_system_will_not_do(client) -> None:
    response = client.get("/")
    assert response.status_code == 200
    assert "Resmi kuruma basvuru gondermez" in response.text
    assert "Alacaginiz tutari hesaplamaz" in response.text


def test_full_journey_from_registration_to_approval(client) -> None:
    register_and_login(client, "kobi@ornek.com.tr", "Ornek Yazilim A.S.")

    profile_page = client.get("/profil")
    assert profile_page.status_code == 200
    assert "Bilinmiyor" in profile_page.text

    save_profile(client)
    run_evaluation(client)

    listing = client.get("/degerlendirmeler")
    assert listing.status_code == 200
    assert "TUBITAK 1501" in listing.text

    decisions = client.get("/api/degerlendirmeler").json()
    assert len(decisions) == 3
    # No call window is published for any seed programme, so nothing can be
    # candidate_eligible yet - and the UI must not pretend otherwise.
    assert {decision["outcome"] for decision in decisions} == {"conditional"}

    decision_id = decisions[0]["id"]
    detail = client.get(f"/degerlendirmeler/{decision_id}")
    assert detail.status_code == 200
    assert "Kural izi" in detail.text
    assert "baglayici degildir" in detail.text
    assert decisions[0]["decision_hash"][:12] in detail.text
    assert "tubitak.gov.tr" in detail.text or "kosgeb.gov.tr" in detail.text

    approve = client.post(
        f"/degerlendirmeler/{decision_id}/onay",
        data={"not": "Basvuruya hazirlanacagiz.", "csrf_token": csrf_token_from(detail.text)},
        follow_redirects=False,
    )
    assert approve.status_code == 303

    after = client.get(f"/degerlendirmeler/{decision_id}?onay=tamam")
    assert "Kullanici onayi" in after.text
    assert "onaylandi" not in after.text.lower().replace("kullanici onayi", "")


def test_an_empty_profile_produces_insufficient_data_and_names_the_gaps(client) -> None:
    register_and_login(client, "bos@ornek.com.tr", "Bos Profil A.S.")
    save_profile(
        client,
        is_capital_company="",
        is_resident_in_turkey="",
        sme_declaration="",
        has_previous_tubitak_project="",
        kosgeb_db_registered="",
        kosgeb_declaration_current="",
        founded_year="",
        nace_code="",
        nace_section="",
    )
    run_evaluation(client)

    decisions = client.get("/api/degerlendirmeler").json()
    assert {decision["outcome"] for decision in decisions} == {"insufficient_data"}
    for decision in decisions:
        assert decision["missing_facts"]


def test_evaluating_without_a_profile_is_refused(client) -> None:
    register_and_login(client, "profilsiz@ornek.com.tr", "Profilsiz A.S.")
    # A genuine, CSRF-valid write: the refusal must come from the missing
    # profile, not from the new API CSRF guard.
    token = client.get("/api/csrf").json()["csrf_token"]
    response = client.post("/api/degerlendir", headers={"X-CSRF-Token": token})
    assert response.status_code == 409


def test_decisions_are_reproducible_across_runs(client) -> None:
    register_and_login(client, "tekrar@ornek.com.tr", "Tekrar A.S.")
    save_profile(client)
    run_evaluation(client)
    first = {
        d["program_code"]: d["decision_hash"] for d in client.get("/api/degerlendirmeler").json()
    }
    run_evaluation(client)
    everything = client.get("/api/degerlendirmeler").json()
    second = {d["program_code"]: d["decision_hash"] for d in everything}
    assert first == second
    # Re-running appends new records; it never overwrites the old ones.
    assert len(everything) == 6


class TestOpenApiSmoke:
    def test_the_openapi_document_is_served_and_valid(self, client) -> None:
        document = client.get("/openapi.json").json()
        assert document["openapi"].startswith("3.")
        assert "/api/degerlendirmeler" in document["paths"]
        assert "/api/programlar" in document["paths"]
        assert "/saglik" in document["paths"]

    def test_the_api_documents_the_four_valued_outcome(self, client) -> None:
        document = client.get("/openapi.json").json()
        outcome = document["components"]["schemas"]["DecisionOut"]["properties"]["outcome"]
        assert "candidate_eligible" in outcome["description"]
        assert "insufficient_data" in outcome["description"]
        assert "Resmen onaylandi" in outcome["description"]

    def test_the_public_programme_endpoint_lists_the_three_seed_programmes(self, client) -> None:
        programs = client.get("/api/programlar").json()
        assert {program["code"] for program in programs} == {
            "TUBITAK-1501",
            "TUBITAK-1507",
            "KOSGEB-GIRISIMCI",
        }
        assert all(program["published_reference"] is None for program in programs)
        assert all(program["call_window_state"] == "unknown" for program in programs)


class TestHealth:
    def test_liveness(self, client) -> None:
        assert client.get("/saglik").json() == {"status": "ok"}

    def test_readiness_reports_the_database_and_the_catalogue(self, client) -> None:
        body = client.get("/hazir").json()
        assert body["status"] == "ready"
        assert body["database"] == "ok"
        assert body["program_count"] == 3
        assert body["ai_provider"] == "disabled"
