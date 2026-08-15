"""Turkish profile form parsing.

The tri-state selects are the whole reason this module exists: a fact the user
has not answered must arrive at the domain as *absent*, not as ``False``.
"""

from collections.abc import Mapping
from datetime import date
from typing import Any

BOOLEAN_FACTS = (
    "is_capital_company",
    "is_resident_in_turkey",
    "sme_declaration",
    "has_previous_tubitak_project",
    "kosgeb_db_registered",
    "kosgeb_declaration_current",
)

INTEGER_FACTS = ("employee_count", "annual_revenue_try", "founded_year")

TEXT_FACTS = ("nace_code", "nace_section", "region_code")

FACT_LABELS: dict[str, str] = {
    "is_capital_company": "Sermaye sirketi mi?",
    "is_resident_in_turkey": "Turkiye'de yerlesik mi?",
    "sme_declaration": "KOBI olceginde mi? (beyan)",
    "has_previous_tubitak_project": "Daha once TUBITAK destekli projesi oldu mu?",
    "kosgeb_db_registered": "KOSGEB Veri Tabaninda kayitli ve aktif mi?",
    "kosgeb_declaration_current": "KOSGEB beyani guncel mi?",
    "employee_count": "Personel sayisi",
    "annual_revenue_try": "Yillik ciro (tam TL)",
    "founded_year": "Kurulus yili",
    "company_age_years": "Isletme yasi (yil)",
    "nace_code": "NACE kodu (orn. 62.01)",
    "nace_section": "NACE kisim harfi (orn. C)",
    "region_code": "Bolge kodu (orn. TR51)",
}

TRISTATE_CHOICES = (("", "Bilinmiyor"), ("true", "Evet"), ("false", "Hayir"))


def parse_profile_form(raw: Mapping[str, Any], today: date) -> dict[str, Any]:
    """Turn form values into domain facts, leaving unknowns genuinely absent."""
    facts: dict[str, Any] = {}

    for name in BOOLEAN_FACTS:
        value = str(raw.get(name, "") or "").strip().lower()
        if value == "true":
            facts[name] = True
        elif value == "false":
            facts[name] = False
        # anything else: the user did not answer, so we do not pretend to know

    for name in INTEGER_FACTS:
        value = str(raw.get(name, "") or "").strip().replace(".", "").replace(" ", "")
        if not value:
            continue
        try:
            facts[name] = int(value)
        except ValueError:
            continue

    for name in TEXT_FACTS:
        value = str(raw.get(name, "") or "").strip()
        if value:
            facts[name] = value

    founded_year = facts.get("founded_year")
    if isinstance(founded_year, int) and 1800 < founded_year <= today.year:
        facts["company_age_years"] = today.year - founded_year

    return facts
