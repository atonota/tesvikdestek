"""The five money states a support amount can be in.

``published ceiling`` -> ``calculated scenario`` -> ``realistic planning`` ->
``awarded`` -> ``paid``.  They are different facts about the world and are
never summed together.  This MVP only ever *displays* the first one.
"""

from collections.abc import Iterable
from dataclasses import dataclass
from enum import StrEnum

from destektesvik.domain.errors import MoneyStateError
from destektesvik.domain.money import Money


class MoneyStateKind(StrEnum):
    PUBLISHED_CEILING = "published_ceiling"
    CALCULATED_SCENARIO = "calculated_scenario"
    REALISTIC_PLANNING = "realistic_planning"
    AWARDED = "awarded"
    PAID = "paid"


#: The only kind this MVP is allowed to originate.
MVP_ALLOWED_KINDS = frozenset({MoneyStateKind.PUBLISHED_CEILING})


@dataclass(frozen=True, slots=True)
class MoneyState:
    """An amount together with *what kind of fact* it is."""

    amount: Money
    kind: MoneyStateKind
    citation: str | None = None

    def as_kind(self, kind: MoneyStateKind) -> "MoneyState":
        """Reclassification is refused - that is the whole safety property."""
        if kind is self.kind:
            return self
        raise MoneyStateError(
            f"a {self.kind.value} amount cannot be reclassified as {kind.value}; "
            "these are different facts about the world"
        )

    def label(self) -> str:
        return {
            MoneyStateKind.PUBLISHED_CEILING: "Kaynakta yayinlanmis referans/ust limit",
            MoneyStateKind.CALCULATED_SCENARIO: "Hesaplanmis senaryo",
            MoneyStateKind.REALISTIC_PLANNING: "Gerceklci planlama",
            MoneyStateKind.AWARDED: "Hak edilmis",
            MoneyStateKind.PAID: "Tahsil edilmis",
        }[self.kind]


def total_awarded(states: Iterable[MoneyState], currency: str = "TRY") -> Money:
    """Sum awarded amounts only.  Anything else is a refusal, not a coercion."""
    total = Money.zero(currency)
    for state in states:
        if state.kind is not MoneyStateKind.AWARDED:
            raise MoneyStateError(
                f"cannot total a {state.kind.value} amount as awarded; "
                "a published ceiling is not money anyone has been granted"
            )
        total = total + state.amount
    return total
