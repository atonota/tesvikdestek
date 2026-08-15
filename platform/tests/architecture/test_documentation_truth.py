"""Claims the documentation makes about itself.

These are the cheapest tests in the package and they guard the most expensive
failure: a reader trusting a sentence that stopped being true. They assert the
*shape* of a claim, not its prose, so the documents can be rewritten freely as
long as they keep saying the true thing.
"""

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
README = REPO_ROOT / "README.md"
ADR = REPO_ROOT / "docs" / "architecture" / "ADR-0001-mvp-modular-monolith.md"
CONSENSUS = REPO_ROOT / "docs" / "reports" / "2026-08-14-consensus-mvp-development-report.md"
UNKNOWNS = REPO_ROOT / "docs" / "reports" / "2026-08-14-codex-unknown-unknowns.md"
EVIDENCE = REPO_ROOT / "docs" / "reports" / "2026-08-14-implementation-evidence.md"


def _text(path: Path) -> str:
    assert path.is_file(), f"{path} is missing"
    return path.read_text(encoding="utf-8")


class TestNoDriftingCounts:
    """m-3 - the README claimed the AI layer had 25 tests; it collects 33."""

    def test_the_readme_states_no_hard_coded_ai_test_count(self) -> None:
        readme = _text(README)
        start = readme.index("Yapay zekâ katmanının")
        # The claim lives in one block quote; stop where it stops.
        ai_paragraph = readme[start : readme.index("\n\n", start)]
        assert not re.search(r"\b\d+\s+test\b", ai_paragraph), (
            "a hard-coded test count drifts the moment a test is added; "
            f"found one in: {ai_paragraph[:300]!r}"
        )


class TestTheThreatModelIsStated:
    """MF-2 - RLS here is depth against our own mistakes, not a wall.

    The application role can set `app.current_tenant` itself. That is the whole
    mechanism. So RLS catches a forgotten `WHERE tenant_id = ...`; it does not
    contain an attacker who can already run arbitrary SQL as that role.
    """

    def test_the_readme_has_a_threat_model_section(self) -> None:
        assert "Tehdit modeli" in _text(README)

    def test_the_readme_names_sql_injection_as_a_remaining_boundary(self) -> None:
        readme = _text(README)
        assert "SQL injection" in readme
        assert "GUC" in readme

    def test_the_readme_says_the_app_layer_is_the_first_defence(self) -> None:
        readme = _text(README)
        threat = readme[readme.index("Tehdit modeli") :][:2500]
        assert "parametreli" in threat
        # Compared case-sensitively on purpose: Turkish "İ".lower() is "i" plus
        # a combining dot, so a lowercased match here would silently never fire.
        assert "İlk katman" in threat

    def test_the_readme_does_not_claim_rls_stops_a_compromised_process(self) -> None:
        readme = _text(README)
        threat = readme[readme.index("Tehdit modeli") :][:2500]
        for admission in ("çalınmış", "ele geçir"):
            assert admission in threat.lower(), (
                "the threat model must admit stolen credentials and process "
                "compromise are outside what RLS can contain"
            )


class TestTheAdrClaimIsScoped:
    def test_the_adr_no_longer_claims_immunity_to_application_error(self) -> None:
        adr = _text(ADR)
        assert "uygulama hatasıyla **delinemez**" not in adr

    def test_the_adr_scopes_the_claim_to_forgotten_tenant_predicates(self) -> None:
        adr = _text(ADR)
        assert "unutulmuş" in adr or "unutulan" in adr
        assert "SQL injection" in adr


class TestTheAcceptanceMatrixIsHonestAboutWhatRan:
    def test_a7_says_the_postgresql_half_is_unverified_locally(self) -> None:
        consensus = _text(CONSENSUS)
        a7 = [line for line in consensus.splitlines() if line.startswith("| A7 ")]
        assert a7, "acceptance criterion A7 disappeared"
        assert "UNVERIFIED" in a7[0], a7[0]

    def test_unknown_unknown_13_no_longer_claims_nothing_remains(self) -> None:
        unknowns = _text(UNKNOWNS)
        section = unknowns[unknowns.index("## 13 —") : unknowns.index("## 14 —")]
        assert "**Remaining validation:** Yok" not in section
        assert "UNVERIFIED" in section or "çalıştırılmadı" in section


class TestTheEvidenceExplainsTheFingerprint:
    def test_it_documents_the_canonical_mechanism(self) -> None:
        evidence = _text(EVIDENCE)
        assert "git ls-files -co --exclude-standard -z" in evidence
        assert "package-fingerprint.sh" in evidence

    def test_it_supersedes_the_old_find_pipeline_explicitly(self) -> None:
        evidence = _text(EVIDENCE)
        assert "b0670099099cad4ca8f5504f275cb246506e8f98bd466ee3edde5fe2e4099b06" in evidence
        assert "supersede" in evidence.lower()

    def test_it_does_not_embed_its_own_current_hash(self) -> None:
        """Storing the answer inside a hashed file changes the answer."""
        evidence = _text(EVIDENCE)
        assert "self-referential" in evidence.lower()


class TestTheEvidenceRecordsActionProvenance:
    def test_all_four_pinned_action_majors_have_an_official_source(self) -> None:
        evidence = _text(EVIDENCE)
        for action, source in (
            ("actions/checkout@v6", "https://github.com/actions/checkout"),
            ("actions/setup-python@v6", "https://github.com/actions/setup-python/releases"),
            (
                "docker/setup-buildx-action@v4",
                "https://github.com/docker/setup-buildx-action/releases",
            ),
            ("docker/build-push-action@v7", "https://github.com/docker/build-push-action/releases"),
        ):
            assert action in evidence, f"{action} has no recorded provenance"
            assert source in evidence, f"{action} has no official source URL"

    def test_it_does_not_claim_sha_pinning(self) -> None:
        evidence = _text(EVIDENCE)
        assert "moving tag" in evidence.lower()
