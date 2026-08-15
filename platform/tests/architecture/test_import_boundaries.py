"""Test 11 - architectural import boundaries, checked with the AST.

The domain core is the reason this codebase survives a framework change.  It
is only a core if nothing framework-shaped can reach it.
"""

import ast
from pathlib import Path

import pytest

SRC = Path(__file__).resolve().parents[2] / "src" / "destektesvik"
DOMAIN = SRC / "domain"
APPLICATION = SRC / "application"

FORBIDDEN_IN_DOMAIN = {
    "fastapi",
    "starlette",
    "sqlalchemy",
    "alembic",
    "psycopg",
    "pydantic",
    "pydantic_settings",
    "jinja2",
    "uvicorn",
    "httpx",
    "argon2",
    "itsdangerous",
}

FORBIDDEN_IN_APPLICATION = {
    "fastapi",
    "starlette",
    "sqlalchemy",
    "alembic",
    "psycopg",
    "jinja2",
    "uvicorn",
}


def _python_files(package: Path) -> list[Path]:
    return sorted(package.rglob("*.py"))


def _imported_roots(path: Path) -> set[str]:
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    roots: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            roots.update(alias.name.split(".")[0] for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
            roots.add(node.module.split(".")[0])
    return roots


@pytest.mark.parametrize("module_path", _python_files(DOMAIN), ids=lambda p: p.name)
def test_domain_imports_no_framework(module_path: Path) -> None:
    leaked = _imported_roots(module_path) & FORBIDDEN_IN_DOMAIN
    assert not leaked, f"{module_path.name} imports forbidden module(s): {sorted(leaked)}"


@pytest.mark.parametrize("module_path", _python_files(DOMAIN), ids=lambda p: p.name)
def test_domain_does_not_import_outer_layers(module_path: Path) -> None:
    source = module_path.read_text(encoding="utf-8")
    tree = ast.parse(source, filename=str(module_path))
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module:
            assert not node.module.startswith("destektesvik.adapters"), module_path.name
            assert not node.module.startswith("destektesvik.delivery"), module_path.name
            assert not node.module.startswith("destektesvik.application"), module_path.name


@pytest.mark.parametrize("module_path", _python_files(APPLICATION), ids=lambda p: p.name)
def test_application_imports_no_framework_or_orm(module_path: Path) -> None:
    leaked = _imported_roots(module_path) & FORBIDDEN_IN_APPLICATION
    assert not leaked, f"{module_path.name} imports forbidden module(s): {sorted(leaked)}"


def test_domain_contains_no_dynamic_execution() -> None:
    """No eval/exec/compile/__import__ anywhere in the rule engine."""
    banned = {"eval", "exec", "compile", "__import__"}
    offenders: list[str] = []
    for module_path in _python_files(DOMAIN):
        tree = ast.parse(module_path.read_text(encoding="utf-8"), filename=str(module_path))
        for node in ast.walk(tree):
            if (
                isinstance(node, ast.Call)
                and isinstance(node.func, ast.Name)
                and node.func.id in banned
            ):
                offenders.append(f"{module_path.name}:{node.lineno} {node.func.id}()")
    assert not offenders, f"dynamic execution found in the domain core: {offenders}"
