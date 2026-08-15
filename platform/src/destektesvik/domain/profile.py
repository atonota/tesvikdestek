"""The company profile - v0 of the "digital twin".

A fact that is not present is *unknown*, never ``False``.
"""

from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal

FactValue = str | int | bool | Decimal | date


@dataclass(frozen=True, slots=True)
class CompanyProfile:
    id: str
    tenant_id: str
    display_name: str
    facts: Mapping[str, FactValue] = field(default_factory=dict)

    def get(self, fact: str) -> FactValue | None:
        return self.facts.get(fact)

    def has(self, fact: str) -> bool:
        return fact in self.facts and self.facts[fact] is not None
