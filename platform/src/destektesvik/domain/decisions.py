"""Immutable decision, approval and audit records.

Nothing in this module mutates.  An approval is a *new* record, never an edit
of a decision.  The database enforces the same rule with triggers; this module
makes it impossible to express the mutation in the first place.
"""

from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from typing import Any

from destektesvik.domain.evaluation import EligibilityOutcome


class DecisionReviewStatus(StrEnum):
    CURRENT = "current"
    REVIEW_REQUIRED = "review_required"


@dataclass(frozen=True, slots=True)
class DecisionRecord:
    id: str
    tenant_id: str
    profile_id: str
    program_code: str
    program_version_id: str
    rule_set_version_id: str
    outcome: EligibilityOutcome
    input_hash: str
    decision_hash: str
    source_snapshot_ids: tuple[str, ...]
    created_at: datetime
    review_status: DecisionReviewStatus = DecisionReviewStatus.CURRENT
    reasons: tuple[str, ...] = ()
    missing_facts: tuple[str, ...] = ()
    #: Flattened predicate traces, kept as plain mappings so the record can be
    #: stored and replayed without importing the rule engine.
    traces: tuple[Mapping[str, Any], ...] = ()


@dataclass(frozen=True, slots=True)
class ApprovalEvent:
    """The *user's own* approval.  Never an official institution decision."""

    id: str
    tenant_id: str
    decision_id: str
    actor_user_id: str
    approved_at: datetime
    note: str = ""
    label: str = "Kullanici onayi"


@dataclass(frozen=True, slots=True)
class AuditEvent:
    id: str
    tenant_id: str
    actor: str
    action: str
    subject: str
    occurred_at: datetime
    payload: Mapping[str, Any] = field(default_factory=dict)
