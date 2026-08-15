"""Money as integer minor units.

There is no float anywhere in this module and there never will be.  A tenth of
a kurus that rounds differently on two hosts is a decision hash that differs on
two hosts.
"""

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any

from destektesvik.domain.errors import MoneyError

MINOR_UNIT_SCALE = 100


@dataclass(frozen=True, slots=True, order=True)
class Money:
    """An exact amount, stored as integer minor units (kurus for TRY)."""

    minor_units: int
    currency: str = "TRY"

    def __post_init__(self) -> None:
        if isinstance(self.minor_units, bool) or not isinstance(self.minor_units, int):
            raise MoneyError("minor_units must be an int")
        if not isinstance(self.currency, str) or len(self.currency) != 3:
            raise MoneyError("currency must be a three letter code")

    @classmethod
    def from_decimal(cls, amount: Any, currency: str = "TRY") -> "Money":
        """Build from ``Decimal``, ``str`` or ``int``.  ``float`` is refused."""
        if isinstance(amount, float):
            raise MoneyError("float amounts are not allowed; pass Decimal, str or int minor units")
        if isinstance(amount, bool):
            raise MoneyError("bool is not a monetary amount")
        try:
            decimal_amount = amount if isinstance(amount, Decimal) else Decimal(str(amount))
        except (InvalidOperation, ValueError) as exc:
            raise MoneyError(f"not a valid monetary amount: {amount!r}") from exc
        scaled = decimal_amount.scaleb(2)
        if scaled != scaled.to_integral_value():
            raise MoneyError(
                f"{decimal_amount} has sub-minor-unit precision; "
                "rounding must be an explicit decision, never a silent one"
            )
        return cls(int(scaled), currency)

    @classmethod
    def zero(cls, currency: str = "TRY") -> "Money":
        return cls(0, currency)

    def as_decimal(self) -> Decimal:
        return (Decimal(self.minor_units) / MINOR_UNIT_SCALE).quantize(Decimal("0.01"))

    def _require_same_currency(self, other: "Money") -> None:
        if self.currency != other.currency:
            raise MoneyError(
                f"cannot combine {self.currency} with {other.currency}; "
                "currency conversion is a product decision, not an arithmetic one"
            )

    def __add__(self, other: "Money") -> "Money":
        if not isinstance(other, Money):
            return NotImplemented
        self._require_same_currency(other)
        return Money(self.minor_units + other.minor_units, self.currency)

    def __sub__(self, other: "Money") -> "Money":
        if not isinstance(other, Money):
            return NotImplemented
        self._require_same_currency(other)
        return Money(self.minor_units - other.minor_units, self.currency)

    def formatted(self) -> str:
        """Human readable Turkish form, e.g. ``2.500.000,00 TRY``."""
        whole, _, fraction = format(self.as_decimal(), "f").partition(".")
        sign = "-" if whole.startswith("-") else ""
        digits = whole.lstrip("-")
        grouped = ""
        while len(digits) > 3:
            grouped = "." + digits[-3:] + grouped
            digits = digits[:-3]
        grouped = digits + grouped
        return f"{sign}{grouped},{fraction or '00'} {self.currency}"
