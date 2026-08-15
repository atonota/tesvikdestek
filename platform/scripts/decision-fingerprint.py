"""Print a canonical fingerprint of the deterministic engine's output.

Used by the dual-host acceptance runbook: run this inside the *same image
digest* on an AMD host and on an Intel host and compare the two outputs. If a
single character differs, determinism is broken and the release is not
portable.

It touches no database and needs no configuration, so it can run anywhere the
image can.
"""

import json
import sys
from datetime import date

from destektesvik.adapters.catalog import load_catalog
from destektesvik.domain.evaluation import EvaluationInput, evaluate
from destektesvik.domain.profile import CompanyProfile

#: A fixed profile and a fixed date: the whole point is that nothing varies.
REFERENCE_AS_OF = date(2026, 8, 14)
REFERENCE_FACTS = {
    "is_capital_company": True,
    "is_resident_in_turkey": True,
    "sme_declaration": True,
    "has_previous_tubitak_project": False,
    "company_age_years": 2,
    "employee_count": 8,
    "annual_revenue_try": 4_500_000,
    "nace_code": "62.01",
    "nace_section": "J",
    "region_code": "TR51",
    "kosgeb_db_registered": True,
    "kosgeb_declaration_current": True,
}


def main() -> int:
    catalog = load_catalog()
    profile = CompanyProfile(
        id="reference-profile",
        tenant_id="reference-tenant",
        display_name="Referans A.S.",
        facts=REFERENCE_FACTS,
    )
    fingerprint = {}
    for program in sorted(catalog.programs, key=lambda p: p.code):
        result = evaluate(
            EvaluationInput(
                profile=profile,
                program=program,
                rule_set=catalog.rule_set_for(program.code),
                snapshots=catalog.snapshots,
                as_of=REFERENCE_AS_OF,
            )
        )
        fingerprint[program.code] = {
            "outcome": result.outcome.value,
            "input_hash": result.input_hash,
            "decision_hash": result.decision_hash,
        }
    print(json.dumps(fingerprint, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
