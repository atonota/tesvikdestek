"""The deterministic evaluation engine.

This is the part of the product that is allowed to say something about a
company's eligibility, and it says it in four values, never in a boolean.

Three refusals are built in:

* no source snapshot, no decision (fail closed);
* an unknown call window is ``conditional``, never a guessed "open";
* a missing fact is ``insufficient_data``, never ``ineligible``.
"""

from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import date
from enum import StrEnum

from destektesvik.domain.canonical import canonical_hash
from destektesvik.domain.errors import SourceMissingError
from destektesvik.domain.profile import CompanyProfile
from destektesvik.domain.programs import CallWindowState, ProgramVersion, RuleSetVersion
from destektesvik.domain.rules import (
    PredicateTrace,
    Truth,
    evaluate_rule,
    rule_document,
)
from destektesvik.domain.sources import EffectiveState, SourceSnapshot

DISCLAIMER = (
    "Bu degerlendirme baglayici degildir ve resmi kurum karari yerine gecmez. "
    "Yalnizca yayinlanmis kaynaklara dayali bir on degerlendirmedir."
)


class EligibilityOutcome(StrEnum):
    """There is deliberately no "officially approved" outcome."""

    CANDIDATE_ELIGIBLE = "candidate_eligible"
    INELIGIBLE = "ineligible"
    CONDITIONAL = "conditional"
    INSUFFICIENT_DATA = "insufficient_data"


#: Turkish labels for the UI.  "Onaylandi" is not among them, on purpose.
OUTCOME_LABELS: dict[EligibilityOutcome, str] = {
    EligibilityOutcome.CANDIDATE_ELIGIBLE: "Aday uygunluk",
    EligibilityOutcome.INELIGIBLE: "Uygun degil",
    EligibilityOutcome.CONDITIONAL: "Kosullu",
    EligibilityOutcome.INSUFFICIENT_DATA: "Yetersiz veri",
}

REASON_LABELS: dict[str, str] = {
    "call_window_unknown": "Cagri penceresi kaynakta yayinlanmamis.",
    "call_window_closed": "Cagri penceresi bu tarihte kapali.",
    "source_not_yet_in_effect": "Kaynagin yururluk tarihi henuz baslamamis.",
    "source_expired": "Kaynagin yururlugu sona ermis.",
    "source_effective_dates_unknown": "Kaynagin yururluk tarihleri bilinmiyor.",
    "missing_facts": "Profilde eksik veri var.",
}


@dataclass(frozen=True, slots=True)
class EvaluationInput:
    profile: CompanyProfile
    program: ProgramVersion
    rule_set: RuleSetVersion
    snapshots: Mapping[str, SourceSnapshot]
    as_of: date


@dataclass(frozen=True, slots=True)
class EvaluationResult:
    outcome: EligibilityOutcome
    program_code: str
    program_version_id: str
    rule_set_version_id: str
    source_snapshot_ids: tuple[str, ...]
    traces: tuple[PredicateTrace, ...] = ()
    missing_facts: tuple[str, ...] = ()
    reasons: tuple[str, ...] = ()
    input_hash: str = ""
    decision_hash: str = ""
    disclaimer: str = DISCLAIMER
    citations: tuple[str, ...] = field(default_factory=tuple)

    @property
    def outcome_label(self) -> str:
        return OUTCOME_LABELS[self.outcome]

    def reason_labels(self) -> tuple[str, ...]:
        return tuple(REASON_LABELS.get(reason, reason) for reason in self.reasons)


def _snapshot_fingerprint(snapshot: SourceSnapshot) -> dict[str, object]:
    """Everything about a snapshot that must change the decision hash."""
    return {
        "id": snapshot.id,
        "url": snapshot.url,
        "content_hash": snapshot.content_hash,
        "captured_at": snapshot.captured_at,
        "effective_from": snapshot.effective_from,
        "effective_to": snapshot.effective_to,
        "review_status": snapshot.review_status,
    }


def evaluate(evaluation_input: EvaluationInput) -> EvaluationResult:
    program = evaluation_input.program
    rule_set = evaluation_input.rule_set
    as_of = evaluation_input.as_of

    # --- fail closed on sourcing -----------------------------------------
    if not program.source_snapshot_ids:
        raise SourceMissingError(
            f"programme {program.code} has no source snapshot; "
            "a decision without a traceable source is worse than no decision"
        )
    missing_snapshots = [
        snapshot_id
        for snapshot_id in program.source_snapshot_ids
        if snapshot_id not in evaluation_input.snapshots
    ]
    if missing_snapshots:
        raise SourceMissingError(
            f"programme {program.code} cites snapshots that were not supplied: "
            f"{sorted(missing_snapshots)}"
        )

    snapshots = [evaluation_input.snapshots[sid] for sid in program.source_snapshot_ids]

    # --- which sources can decide anything today? ------------------------
    reasons: list[str] = []
    unusable: set[str] = set()
    for snapshot in snapshots:
        state = snapshot.effective_state(as_of)
        if state is EffectiveState.NOT_YET_IN_EFFECT:
            unusable.add(snapshot.id)
            if "source_not_yet_in_effect" not in reasons:
                reasons.append("source_not_yet_in_effect")
        elif state is EffectiveState.EXPIRED:
            if "source_expired" not in reasons:
                reasons.append("source_expired")
        elif state is EffectiveState.UNKNOWN and ("source_effective_dates_unknown" not in reasons):
            reasons.append("source_effective_dates_unknown")

    # --- deterministic rule evaluation -----------------------------------
    rule_evaluation = evaluate_rule(
        rule_set.rule, evaluation_input.profile.facts, frozenset(unusable)
    )

    outcome = {
        Truth.TRUE: EligibilityOutcome.CANDIDATE_ELIGIBLE,
        Truth.FALSE: EligibilityOutcome.INELIGIBLE,
        Truth.UNKNOWN: EligibilityOutcome.INSUFFICIENT_DATA,
    }[rule_evaluation.result]

    if rule_evaluation.missing_facts and "missing_facts" not in reasons:
        reasons.append("missing_facts")

    # --- the call window can only ever downgrade -------------------------
    window_state = program.call_window.state(as_of)
    if window_state is CallWindowState.UNKNOWN:
        reasons.append("call_window_unknown")
    elif window_state is CallWindowState.CLOSED:
        reasons.append("call_window_closed")

    if outcome is EligibilityOutcome.CANDIDATE_ELIGIBLE and window_state is not (
        CallWindowState.OPEN
    ):
        outcome = EligibilityOutcome.CONDITIONAL

    citations = tuple(sorted({trace.citation for trace in rule_evaluation.traces}))

    input_hash = canonical_hash(
        {
            "as_of": as_of,
            "profile": {
                "id": evaluation_input.profile.id,
                "facts": dict(evaluation_input.profile.facts),
            },
            "program": {
                "id": program.id,
                "code": program.code,
                "version": program.version,
                "support_type": program.support_type,
                "call_window": {
                    "opens_on": program.call_window.opens_on,
                    "closes_on": program.call_window.closes_on,
                },
            },
            "rule_set": {
                "id": rule_set.id,
                "version": rule_set.version,
                "rule": rule_document(rule_set.rule),
            },
            "snapshots": [_snapshot_fingerprint(snapshot) for snapshot in snapshots],
        }
    )

    decision_hash = canonical_hash(
        {
            "input_hash": input_hash,
            "outcome": outcome,
            "reasons": sorted(reasons),
            "missing_facts": sorted(rule_evaluation.missing_facts),
            "traces": [
                {
                    "fact": trace.fact,
                    "operator": trace.operator,
                    "expected": trace.expected,
                    "result": trace.result,
                    "citation": trace.citation,
                }
                for trace in rule_evaluation.traces
            ],
        }
    )

    return EvaluationResult(
        outcome=outcome,
        program_code=program.code,
        program_version_id=program.id,
        rule_set_version_id=rule_set.id,
        source_snapshot_ids=program.source_snapshot_ids,
        traces=rule_evaluation.traces,
        missing_facts=rule_evaluation.missing_facts,
        reasons=tuple(reasons),
        input_hash=input_hash,
        decision_hash=decision_hash,
        citations=citations,
    )
