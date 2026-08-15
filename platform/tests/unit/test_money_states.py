"""Test 5 (part 2) - a published ceiling is never an awarded or paid amount."""

import pytest

from destektesvik.domain.amounts import MoneyState, MoneyStateKind, total_awarded
from destektesvik.domain.errors import MoneyStateError
from destektesvik.domain.money import Money


def test_published_ceiling_cannot_be_summed_as_awarded(published_ceiling: MoneyState) -> None:
    with pytest.raises(MoneyStateError):
        total_awarded([published_ceiling])


def test_calculated_scenario_cannot_be_summed_as_awarded() -> None:
    scenario = MoneyState(
        amount=Money.from_decimal("100.00"),
        kind=MoneyStateKind.CALCULATED_SCENARIO,
    )
    with pytest.raises(MoneyStateError):
        total_awarded([scenario])


def test_awarded_amounts_may_be_summed() -> None:
    awarded = [
        MoneyState(amount=Money.from_decimal("100.00"), kind=MoneyStateKind.AWARDED),
        MoneyState(amount=Money.from_decimal("50.50"), kind=MoneyStateKind.AWARDED),
    ]
    assert total_awarded(awarded) == Money.from_decimal("150.50")


def test_mvp_never_produces_a_calculated_or_awarded_state_from_a_ceiling(
    published_ceiling: MoneyState,
) -> None:
    """The MVP may display a ceiling; it may never reclassify one."""
    assert published_ceiling.kind is MoneyStateKind.PUBLISHED_CEILING
    with pytest.raises(MoneyStateError):
        published_ceiling.as_kind(MoneyStateKind.AWARDED)
