"""Test 14 - the legacy static prototype must remain byte-identical.

The rollback story of this change package is "delete the new files and the old
prototype is still there, untouched".  That claim is only worth anything if it
is checked.
"""

import hashlib
import json
import os
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
MANIFEST = Path(__file__).with_name("legacy_prototype_manifest.json")

#: Directories this change package owns outright.  Everything else at the
#: repository root belongs to the frozen prototype and must be accounted for.
PACKAGE_DIRECTORIES = frozenset({".github", "docs", "platform"})

#: The root *files* this package owns.  ".gitignore" pre-existed and may be
#: appended to; the rest are root documents this package writes.
PACKAGE_OWNED_ROOT_FILES = frozenset(
    {
        ".gitignore",
        "README.md",
        "ENTERPRISE-FRONTEND-TALEP-VE-GAP-RAPORU.md",
        "FRONTEND-TECHSTACK.md",
        "MULTI-AGENT-GELISTIRME-POLITIKASI-VE-YOL-HARITASI.md",
    }
)

#: Not content: git's own storage, the two artefacts macOS and Python leave
#: behind, and "node_modules" - a dependency/cache tree generated at whatever
#: depth a package.json sits, never prototype evidence.  Naming them explicitly
#: keeps the walk fail-closed for everything else - an unexpected file is a
#: finding, not something to quietly skip.
#:
#: ".git" is listed as a *name* rather than a directory because in a git
#: worktree it is a file, not a directory - which is exactly how it slipped
#: past the first version of this walk.
SKIPPED_NAMES = frozenset({".git", "__pycache__", "node_modules"})
SKIPPED_FILENAMES = frozenset({".DS_Store"})


def legacy_candidate_files(root: Path) -> set[str]:
    """Every file on disk that the prototype manifest is expected to cover.

    Recursive on purpose.  The previous version listed the repository root only,
    so a file added *inside* an existing route directory - `takvim/extra.html`,
    an editor's backup copy, a second page - was invisible to the guard while it
    still reported the prototype as unchanged.
    """
    found: set[str] = set()
    for directory, subdirectories, filenames in os.walk(root):
        here = Path(directory)
        depth = here.relative_to(root).parts
        # Prune rather than filter, so git's object store is never walked.
        subdirectories[:] = [
            name
            for name in subdirectories
            if name not in SKIPPED_NAMES and not (not depth and name in PACKAGE_DIRECTORIES)
        ]
        for filename in filenames:
            if filename in SKIPPED_FILENAMES or filename in SKIPPED_NAMES:
                continue
            if not depth and filename in PACKAGE_OWNED_ROOT_FILES:
                continue
            found.add((here / filename).relative_to(root).as_posix())
    return found


def _manifest() -> dict[str, str]:
    return json.loads(MANIFEST.read_text(encoding="utf-8"))["files"]


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


@pytest.mark.parametrize("relative_path", sorted(_manifest()))
def test_legacy_file_is_unchanged(relative_path: str) -> None:
    expected = _manifest()[relative_path]
    target = REPO_ROOT / relative_path
    assert target.is_file(), f"legacy prototype file disappeared: {relative_path}"
    assert _sha256(target) == expected, (
        f"legacy prototype file was modified: {relative_path}. "
        "This change package is not allowed to touch it."
    )


def test_manifest_covers_every_legacy_tracked_file() -> None:
    """A file added to the prototype must be added to the manifest too."""
    covered = set(_manifest())
    missing = legacy_candidate_files(REPO_ROOT) - covered
    assert not missing, f"legacy files missing from the manifest: {sorted(missing)}"


class TestTheGuardLooksInsideRouteDirectories:
    """m-2 - the guard only ever listed the repository root.

    Every prototype page lives in its own directory (`takvim/index.html`,
    `sozluk/index.html`, ...). A file added *inside* one of those - a second
    page, a stray script, an edited copy left behind - was invisible to the
    guard, so "the prototype is untouched" was only checked one level deep.
    """

    def _prototype(self, root: Path) -> None:
        (root / "takvim").mkdir()
        (root / "takvim" / "index.html").write_text("<!doctype html>", encoding="utf-8")
        (root / "index.html").write_text("<!doctype html>", encoding="utf-8")

    def test_a_new_file_inside_a_route_directory_is_detected(self, tmp_path) -> None:
        self._prototype(tmp_path)
        (tmp_path / "takvim" / "yeni-sayfa.html").write_text("x", encoding="utf-8")
        assert "takvim/yeni-sayfa.html" in legacy_candidate_files(tmp_path)

    def test_a_nested_subdirectory_is_also_reached(self, tmp_path) -> None:
        self._prototype(tmp_path)
        nested = tmp_path / "takvim" / "assets"
        nested.mkdir()
        (nested / "extra.mjs").write_text("x", encoding="utf-8")
        assert "takvim/assets/extra.mjs" in legacy_candidate_files(tmp_path)

    def test_a_brand_new_top_level_directory_is_detected(self, tmp_path) -> None:
        self._prototype(tmp_path)
        (tmp_path / "yeni-rota").mkdir()
        (tmp_path / "yeni-rota" / "index.html").write_text("x", encoding="utf-8")
        assert "yeni-rota/index.html" in legacy_candidate_files(tmp_path)

    def test_the_package_directories_are_excluded(self, tmp_path) -> None:
        self._prototype(tmp_path)
        for package_directory in ("platform", "docs", ".github"):
            target = tmp_path / package_directory / "deep"
            target.mkdir(parents=True)
            (target / "file.md").write_text("x", encoding="utf-8")
        found = legacy_candidate_files(tmp_path)
        assert not [path for path in found if path.split("/")[0] in PACKAGE_DIRECTORIES]

    def test_the_package_owned_root_files_are_excluded(self, tmp_path) -> None:
        self._prototype(tmp_path)
        for name in PACKAGE_OWNED_ROOT_FILES:
            (tmp_path / name).write_text("x", encoding="utf-8")
        found = legacy_candidate_files(tmp_path)
        assert not (found & PACKAGE_OWNED_ROOT_FILES)

    def test_a_root_node_modules_tree_is_pruned(self, tmp_path) -> None:
        self._prototype(tmp_path)
        cache = tmp_path / "node_modules" / ".vite" / "vitest"
        cache.mkdir(parents=True)
        (cache / "results.json").write_text("{}", encoding="utf-8")
        assert not [p for p in legacy_candidate_files(tmp_path) if "node_modules" in p]

    def test_a_nested_node_modules_tree_is_pruned(self, tmp_path) -> None:
        self._prototype(tmp_path)
        cache = tmp_path / "takvim" / "app" / "node_modules" / ".vite" / "vitest"
        cache.mkdir(parents=True)
        (cache / "results.json").write_text("{}", encoding="utf-8")
        found = legacy_candidate_files(tmp_path)
        assert not [p for p in found if "node_modules" in p]
        assert "takvim/index.html" in found

    def test_git_internals_are_never_walked(self, tmp_path) -> None:
        self._prototype(tmp_path)
        git_directory = tmp_path / ".git" / "objects"
        git_directory.mkdir(parents=True)
        (git_directory / "abcdef").write_text("x", encoding="utf-8")
        assert not [p for p in legacy_candidate_files(tmp_path) if p.startswith(".git/")]

    def test_the_real_repository_is_still_fully_covered(self) -> None:
        """The recursive guard must not be failing right now for unrelated reasons."""
        assert legacy_candidate_files(REPO_ROOT) <= set(_manifest())
