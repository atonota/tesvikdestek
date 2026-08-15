"""Test 5 (part 1) - money is Decimal/integer minor units, never float."""

from decimal import Decimal

import pytest

from destektesvik.domain.errors import MoneyError
from destektesvik.domain.money import Money


def test_float_input_is_refused() -> None:
    with pytest.raises(MoneyError):
        Money.from_decimal(2500000.55)


def test_decimal_input_is_exact() -> None:
    money = Money.from_decimal(Decimal("2500000.55"))
    assert money.minor_units == 250000055
    assert money.as_decimal() == Decimal("2500000.55")


def test_string_input_is_accepted_and_exact() -> None:
    assert Money.from_decimal("0.07").minor_units == 7


def test_sub_minor_unit_precision_is_refused_not_rounded_silently() -> None:
    with pytest.raises(MoneyError):
        Money.from_decimal(Decimal("0.005"))


def test_currencies_do_not_mix() -> None:
    with pytest.raises(MoneyError):
        Money(100, "TRY") + Money(100, "EUR")


def test_addition_stays_in_minor_units() -> None:
    total = Money(100, "TRY") + Money(250, "TRY")
    assert total == Money(350, "TRY")
