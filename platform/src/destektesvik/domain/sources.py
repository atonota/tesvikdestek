"""Official source snapshots.

A URL on its own proves nothing.  What proves something is *which content* was
seen, *when*, and *with which hash*.  Unknown dates stay ``None`` - they are
never guessed.
"""

from dataclasses import dataclass
from datetime import date, datetime
from enum import StrEnum


class ReviewStatus(StrEnum):
    VERIFIED = "verified"
    PENDING_REVIEW = "pending_review"
    STALE = "stale"


class EffectiveState(StrEnum):
    """Whether a snapshot applies to a given day."""

    IN_EFFECT = "in_effect"
    NOT_YET_IN_EFFECT = "not_yet_in_effect"
    EXPIRED = "expired"
    UNKNOWN = "unknown"


@dataclass(frozen=True, slots=True)
class SourceSnapshot:
    """One captured reading of one official page."""

    id: str
    url: str
    publisher: str
    title: str
    captured_at: datetime
    content_hash: str
    effective_from: date | None = None
    effective_to: date | None = None
    reviewed_at: datetime | None = None
    review_status: ReviewStatus = ReviewStatus.PENDING_REVIEW

    def short_hash(self) -> str:
        return self.content_hash[:12]

    def effective_state(self, as_of: date) -> EffectiveState:
        """Does this snapshot apply on ``as_of``?

        Unknown bounds stay unknown.  A missing effective date is never read
        as "applies forever".
        """
        if self.effective_from is None and self.effective_to is None:
            return EffectiveState.UNKNOWN
        if self.effective_from is not None and as_of < self.effective_from:
            return EffectiveState.NOT_YET_IN_EFFECT
        if self.effective_to is not None and as_of > self.effective_to:
            return EffectiveState.EXPIRED
        return EffectiveState.IN_EFFECT
