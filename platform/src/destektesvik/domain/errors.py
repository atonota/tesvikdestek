"""Domain level errors.

Every error here means "the caller asked for something the domain refuses to
do".  None of them is recoverable by retrying.
"""


class DomainError(Exception):
    """Base class for every deliberate refusal raised by the domain core."""


class RuleDefinitionError(DomainError):
    """A rule document is not expressible in the safe allowlist DSL."""


class SourceMissingError(DomainError):
    """Evaluation was attempted without the official source snapshot it cites.

    This is a fail-closed error on purpose: a decision without a traceable
    source is worse than no decision at all.
    """


class MoneyError(DomainError):
    """A monetary value was built from an unsafe representation (e.g. float)."""


class MoneyStateError(DomainError):
    """A published reference amount was used as if it were awarded or paid."""
