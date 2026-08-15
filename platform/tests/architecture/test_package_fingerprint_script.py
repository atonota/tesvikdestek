"""The canonical package fingerprint must be reproducible by anyone.

The previous snapshot hashes were produced by an ad hoc `find` pipeline typed
into a shell. That command excluded four cache directories by name, which meant
any *other* ignored runtime artefact - a stray `.env`, a `.pytest_cache`, a
coverage file - silently changed the "immutable" hash. A reviewer recomputing
it on a different machine could get a different answer for reasons that have
nothing to do with the package.

This replaces it with a script that asks git which files are actually part of
the package, honouring `.gitignore` rather than a hand-maintained deny list.
"""

import re
import shutil
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
SCRIPT = REPO_ROOT / "platform" / "scripts" / "package-fingerprint.sh"
EVIDENCE = REPO_ROOT / "docs" / "reports" / "2026-08-14-implementation-evidence.md"

#: The package surface, and nothing else.
EXPECTED_ALLOWLIST = (".github", "docs", "platform", "README.md", ".gitignore")

#: A PATH with the POSIX basics and nothing else - no Homebrew, no /sbin, no
#: developer shell profile. This is what a CI container or a reviewer's clean
#: machine actually looks like.
CLEAN_PATH = "/usr/bin:/bin"

#: Resolved once, with the real PATH, so a restricted test environment exercises
#: the *script's* tool lookup rather than failing to find the interpreter.
BASH = shutil.which("bash") or "/bin/bash"


def _text() -> str:
    assert SCRIPT.is_file(), f"{SCRIPT} does not exist"
    return SCRIPT.read_text(encoding="utf-8")


def _statements() -> str:
    """The script with `#` comment lines removed.

    These contracts are about what the script *runs*. Its comments have to name
    the broken construct in order to explain why it is not used, and that
    explanation must not be mistaken for the construct itself.
    """
    return "\n".join(line for line in _text().splitlines() if not line.lstrip().startswith("#"))


def _run(cwd: Path, env: dict[str, str] | None = None) -> str:
    result = subprocess.run(  # noqa: S603
        [BASH, str(SCRIPT)],
        cwd=cwd,
        capture_output=True,
        text=True,
        check=True,
        env=env,
    )
    return result.stdout.strip()


def _run_allowing_failure(
    cwd: Path, env: dict[str, str] | None = None
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(  # noqa: S603
        [BASH, str(SCRIPT)],
        cwd=cwd,
        capture_output=True,
        text=True,
        check=False,
        env=env,
    )


class TestTheScriptIsCanonical:
    def test_it_exists_and_is_executable(self) -> None:
        assert SCRIPT.is_file()
        assert SCRIPT.stat().st_mode & 0o111, "the fingerprint script is not executable"

    def test_it_enumerates_files_with_git_rather_than_find(self) -> None:
        script = _text()
        assert "git ls-files -co --exclude-standard -z" in script
        assert "find " not in script, "an ad hoc find pipeline is what this replaces"

    def test_it_sorts_bytewise_and_nul_delimited(self) -> None:
        assert "LC_ALL=C sort -z" in _text()

    def test_it_hashes_with_sha256(self) -> None:
        script = _text()
        assert "sha256sum" in script or "shasum -a 256" in script

    def test_it_resolves_the_repository_root_itself(self) -> None:
        """It must give the same answer from any working directory."""
        assert "rev-parse --show-toplevel" in _text()

    def test_it_covers_exactly_the_package_allowlist(self) -> None:
        script = _text()
        for entry in EXPECTED_ALLOWLIST:
            assert entry in script, f"{entry} is missing from the fingerprint allowlist"

    def test_it_does_not_hand_maintain_a_cache_deny_list(self) -> None:
        """`.gitignore` is the single source of truth for what is not package."""
        script = _text()
        for cache in (".mypy_cache", ".ruff_cache", ".pytest_cache", ".venv"):
            assert cache not in script, (
                f"{cache} is named explicitly; ignored files must come from git, not a deny list"
            )


class TestTheHashingToolIsChosenNotGuessed:
    """YF-1 - `xargs` runs a *program*, never a shell function.

    The first version defined a `sha256()` helper and then wrote
    `xargs -0 sha256`. On this macOS host that silently executed `/sbin/sha256`,
    whose output is `SHA256 (path) = hash` rather than GNU's `hash  path`, so
    the aggregate was macOS-specific. On a machine without `/sbin/sha256` the
    stage failed with 127 - and the *next* stage cheerfully hashed the empty
    stream, printing `e3b0c442...` to stdout. A confident wrong answer is worse
    than a crash.
    """

    def test_no_bare_sha256_token_is_ever_used_as_a_command(self) -> None:
        assert not re.search(r"(?<![\w./-])sha256(?![\w-])", _statements()), (
            "a bare `sha256` resolves to /sbin/sha256 on macOS and to nothing on Linux"
        )

    def test_the_bsd_sbin_tool_is_never_referenced(self) -> None:
        assert "/sbin/sha256" not in _statements()

    def test_xargs_is_not_used_to_hash(self) -> None:
        script = _statements()
        hashing_via_xargs = [
            line for line in script.splitlines() if "xargs" in line and "sha" in line
        ]
        assert not hashing_via_xargs, hashing_via_xargs

    def test_both_supported_tools_are_named_explicitly(self) -> None:
        script = _text()
        assert "sha256sum" in script, "GNU/Linux tool missing"
        assert "shasum -a 256" in script, "macOS/BSD tool missing"


class TestTheAggregateIsNormalisedNotRawToolOutput:
    """GNU and BSD disagree about how to print a digest, so print neither."""

    def test_each_file_becomes_a_nul_terminated_record(self) -> None:
        script = _text()
        assert re.search(r"printf\s+'[^']*\\0'", script), (
            "per-file records must be NUL-terminated, not newline-separated"
        )

    def test_the_digest_is_normalised_to_lowercase_hex(self) -> None:
        script = _text()
        assert "cut" in script or "awk" in script, "the tool's trailing filename must be stripped"
        assert re.search(r"tr\s+'?A-F'?\s+'?a-f'?", script) or "tr 'A-F' 'a-f'" in script

    def test_the_result_is_validated_before_anything_is_printed(self) -> None:
        script = _text()
        assert re.search(r"\[0-9a-f\]\{64\}", script), (
            "the script must refuse to print anything that is not a 64-char hex digest"
        )


class TestTheScriptBehaves:
    def test_it_prints_a_single_sha256_hex_digest(self) -> None:
        output = _run(REPO_ROOT)
        assert len(output) == 64, output
        assert all(character in "0123456789abcdef" for character in output), output

    def test_it_gives_the_same_answer_from_any_working_directory(self) -> None:
        from_root = _run(REPO_ROOT)
        from_platform = _run(REPO_ROOT / "platform")
        from_deeper = _run(REPO_ROOT / "platform" / "scripts")
        assert from_root == from_platform == from_deeper

    def test_it_is_stable_across_repeated_runs(self) -> None:
        assert _run(REPO_ROOT) == _run(REPO_ROOT)

    def test_an_ignored_artefact_does_not_change_the_fingerprint(self) -> None:
        """The exact failure mode of the old `find` pipeline."""
        probe_directory = REPO_ROOT / "platform" / ".pytest_cache"
        if not probe_directory.is_dir():
            pytest.skip("no .pytest_cache directory on this host to probe with")
        before = _run(REPO_ROOT)
        artefact = probe_directory / "fingerprint-probe.tmp"
        artefact.write_text("probe", encoding="utf-8")
        try:
            assert _run(REPO_ROOT) == before
        finally:
            artefact.unlink()


class TestItIsPortable:
    """The fingerprint must not depend on which laptop computed it."""

    def test_a_clean_path_gives_the_identical_digest(self) -> None:
        rich = _run(REPO_ROOT)
        clean = _run(REPO_ROOT, env={"PATH": CLEAN_PATH, "HOME": str(Path.home())})
        assert clean == rich, (
            f"clean PATH produced {clean!r} but a developer shell produced {rich!r}"
        )

    def test_a_clean_path_still_agrees_across_working_directories(self) -> None:
        env = {"PATH": CLEAN_PATH, "HOME": str(Path.home())}
        from_root = _run(REPO_ROOT, env=env)
        from_platform = _run(REPO_ROOT / "platform", env=env)
        assert from_root == from_platform

    def test_it_never_prints_the_digest_of_an_empty_stream(self) -> None:
        """`e3b0c442...` is SHA-256 of nothing, and it looks entirely plausible."""
        empty_stream_digest = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        assert _run(REPO_ROOT) != empty_stream_digest
        clean = _run(REPO_ROOT, env={"PATH": CLEAN_PATH, "HOME": str(Path.home())})
        assert clean != empty_stream_digest

    def test_when_hashing_is_impossible_it_fails_loudly_and_prints_nothing(self) -> None:
        """No tools at all: exit non-zero with empty stdout, never a digest."""
        result = _run_allowing_failure(REPO_ROOT, env={"PATH": "/var/empty-no-such-directory"})
        assert result.returncode != 0
        assert result.stdout.strip() == "", (
            f"a broken environment still emitted something on stdout: {result.stdout!r}"
        )


class TestTheEvidenceDescribesTheRealMechanism:
    """A documented algorithm that is not the implemented one is worse than none.

    Contract-level on purpose: the report must not still show the broken
    pipeline, and must name the parts a reviewer would need to reproduce the
    number by hand. It is not pinned to one exact wording.
    """

    def _text(self) -> str:
        assert EVIDENCE.is_file()
        return EVIDENCE.read_text(encoding="utf-8")

    def test_it_no_longer_shows_the_broken_xargs_pipeline(self) -> None:
        """The broken pipeline may be quoted as history, never as the mechanism."""
        evidence = self._text()
        start = evidence.index("The canonical package fingerprint")
        mechanism = evidence[start : evidence.index("## What the second reviewer found", start)]
        assert "xargs" not in mechanism, (
            f"the current-mechanism section still shows an xargs stage: {mechanism[-400:]!r}"
        )

    def test_it_still_documents_the_file_enumeration(self) -> None:
        evidence = self._text()
        assert "git ls-files -co --exclude-standard -z" in evidence
        assert "LC_ALL=C sort -z" in evidence

    def test_it_documents_the_per_file_record_normalisation(self) -> None:
        evidence = self._text()
        assert "package-fingerprint.sh" in evidence
        lowered = evidence.lower()
        assert "record" in lowered
        assert "shasum -a 256" in evidence and "sha256sum" in evidence

    def test_it_marks_the_previous_fingerprint_as_superseded(self) -> None:
        evidence = self._text()
        assert "5e59d640826f06923e2a737c6ef6ca68fea6b9a0e4792e87fa7f851760b4b64d" in evidence
        superseded = evidence[evidence.index("5e59d640") - 600 : evidence.index("5e59d640") + 600]
        assert "supersede" in superseded.lower()
