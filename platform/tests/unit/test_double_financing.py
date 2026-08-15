"""Test 6 - the same expense charged to two programmes is a conflict.

This is not merely a user mistake; it triggers institutional sanctions.
"""

from destektesvik.domain.financing import ExpenseAllocation, detect_double_financing
from destektesvik.domain.money import Money


def _allocation(expense_id: str, program_code: str) -> ExpenseAllocation:
    return ExpenseAllocation(
        expense_id=expense_id,
        program_code=program_code,
        amount=Money.from_decimal("1000.00"),
    )


def test_same_expense_in_two_programs_is_reported() -> None:
    conflicts = detect_double_financing(
        [_allocation("makine-1", "TUBITAK-1501"), _allocation("makine-1", "KOSGEB-GIRISIMCI")]
    )
    assert len(conflicts) == 1
    assert conflicts[0].expense_id == "makine-1"
    assert conflicts[0].program_codes == ("KOSGEB-GIRISIMCI", "TUBITAK-1501")


def test_same_expense_in_one_program_is_not_a_conflict() -> None:
    assert detect_double_financing([_allocation("makine-1", "TUBITAK-1501")]) == ()


def test_distinct_expenses_are_not_a_conflict() -> None:
    conflicts = detect_double_financing(
        [_allocation("makine-1", "TUBITAK-1501"), _allocation("makine-2", "KOSGEB-GIRISIMCI")]
    )
    assert conflicts == ()


def test_duplicate_allocation_to_the_same_program_is_not_cross_program_conflict() -> None:
    conflicts = detect_double_financing(
        [_allocation("makine-1", "TUBITAK-1501"), _allocation("makine-1", "TUBITAK-1501")]
    )
    assert conflicts == ()


def test_conflicts_are_reported_deterministically() -> None:
    allocations = [
        _allocation("b", "P2"),
        _allocation("a", "P1"),
        _allocation("b", "P1"),
        _allocation("a", "P2"),
    ]
    conflicts = detect_double_financing(allocations)
    assert [c.expense_id for c in conflicts] == ["a", "b"]
