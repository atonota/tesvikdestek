"""Double financing detection.

Charging the same expense to two programmes is not merely a user mistake; it
triggers institutional sanctions.  The check is intentionally simple and
deterministic so it can be shown to the user as a plain list.
"""

from collections.abc import Iterable
from dataclasses import dataclass

from destektesvik.domain.money import Money


@dataclass(frozen=True, slots=True)
class ExpenseAllocation:
    expense_id: str
    program_code: str
    amount: Money


@dataclass(frozen=True, slots=True)
class DoubleFinancingConflict:
    expense_id: str
    program_codes: tuple[str, ...]

    def message(self) -> str:
        programs = ", ".join(self.program_codes)
        return (
            f"'{self.expense_id}' gideri birden fazla programa yazilmis: {programs}. "
            "Ayni giderin iki programdan desteklenmesi kurum yaptirimi dogurabilir."
        )


def detect_double_financing(
    allocations: Iterable[ExpenseAllocation],
) -> tuple[DoubleFinancingConflict, ...]:
    by_expense: dict[str, set[str]] = {}
    for allocation in allocations:
        by_expense.setdefault(allocation.expense_id, set()).add(allocation.program_code)
    return tuple(
        DoubleFinancingConflict(expense_id=expense_id, program_codes=tuple(sorted(programs)))
        for expense_id, programs in sorted(by_expense.items())
        if len(programs) > 1
    )
