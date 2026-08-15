"""Seed the catalogue tables.  Safe to run repeatedly.

uv run python scripts/seed.py
"""

import os
import sys

from destektesvik.adapters.db.seed import resolve_seed_url, seed_catalog
from destektesvik.adapters.db.session import create_app_engine, create_session_factory
from destektesvik.config import get_settings


def main() -> int:
    settings = get_settings()
    engine = create_app_engine(resolve_seed_url(settings, os.environ))
    session_factory = create_session_factory(engine)
    with session_factory() as session:
        report = seed_catalog(session)
        session.commit()
    print(
        f"seed: {report.snapshots} snapshot, {report.programs} program, "
        f"{report.rule_sets} kural kumesi "
        f"({'degisiklik yazildi' if report.changed else 'degisiklik yok'})"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
