"""Programme definitions.

``program`` is not ``call`` is not ``opportunity`` is not ``application``.
This module models the first two only; the other two are out of MVP scope.
"""

from dataclasses import dataclass, field
from datetime import date
from enum import StrEnum

from destektesvik.domain.amounts import MoneyState
from destektesvik.domain.rules import RuleNode


class SupportType(StrEnum):
    """Support types are never summed across kinds."""

    GRANT = "grant"
    TAX_OR_PREMIUM_EXEMPTION = "tax_or_premium_exemption"
    LOAN = "loan"
    GUARANTEE = "guarantee"
    EQUITY = "equity"
    IN_KIND_SERVICE = "in_kind_service"


class CallWindowState(StrEnum):
    OPEN = "open"
    CLOSED = "closed"
    UNKNOWN = "unknown"


@dataclass(frozen=True, slots=True)
class CallWindow:
    """A call window with genuinely optional bounds.

    If the official source did not publish the window, both bounds stay
    ``None`` and the state is ``UNKNOWN`` - never a guessed ``OPEN``.
    """

    opens_on: date | None = None
    closes_on: date | None = None

    def state(self, as_of: date) -> CallWindowState:
        if self.closes_on is not None and as_of > self.closes_on:
            return CallWindowState.CLOSED
        if self.opens_on is not None and as_of < self.opens_on:
            return CallWindowState.CLOSED
        if self.opens_on is not None and self.closes_on is not None:
            return CallWindowState.OPEN
        # One bound (or neither) published: we genuinely do not know.
        return CallWindowState.UNKNOWN


@dataclass(frozen=True, slots=True)
class ProgramVersion:
    id: str
    code: str
    name: str
    version: str
    support_type: SupportType
    official_url: str
    source_snapshot_ids: tuple[str, ...]
    call_window: CallWindow = field(default_factory=CallWindow)
    published_reference: MoneyState | None = None
    required_documents: tuple[str, ...] = ()
    notes: str = ""


@dataclass(frozen=True, slots=True)
class RuleSetVersion:
    """A versioned, data-defined rule set.  Rules are data, never code."""

    id: str
    program_code: str
    version: str
    rule: RuleNode
    required_facts: tuple[str, ...] = ()
