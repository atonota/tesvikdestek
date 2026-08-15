"""Pydantic schemas for the JSON API.

These are transport shapes only.  They never carry an "eligible: true/false"
field, because the domain does not have one.
"""

from pydantic import BaseModel, ConfigDict, Field


class CsrfTokenOut(BaseModel):
    """A signed CSRF token.  Deliberately carries nothing else."""

    model_config = ConfigDict(extra="forbid")

    csrf_token: str


class SnapshotOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    url: str
    publisher: str
    title: str
    captured_at: str
    content_hash: str
    content_hash_short: str
    effective_from: str | None = None
    effective_to: str | None = None
    review_status: str


class ProgramOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str
    name: str
    version: str
    support_type: str
    official_url: str
    call_window_state: str
    source_snapshot_ids: list[str]
    required_documents: list[str]
    published_reference: str | None = Field(
        default=None,
        description=(
            "Kaynakta yayinlanmis referans/ust limit. Hak edilmis veya hesaplanmis "
            "tutar DEGILDIR. Bu MVP'de hicbir programda doldurulmamistir."
        ),
    )
    notes: str = ""


class TraceOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    fact: str
    operator: str
    expected: object
    actual: object
    citation: str
    result: str
    label: str = ""


class DecisionOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    program_code: str
    program_version_id: str
    rule_set_version_id: str
    outcome: str = Field(
        description=(
            "candidate_eligible | ineligible | conditional | insufficient_data. "
            "'Resmen onaylandi' diye bir deger yoktur."
        )
    )
    outcome_label: str
    input_hash: str
    decision_hash: str
    source_snapshot_ids: list[str]
    reasons: list[str]
    missing_facts: list[str]
    traces: list[TraceOut]
    review_status: str
    created_at: str
    disclaimer: str


class ApprovalOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    decision_id: str
    actor_user_id: str
    approved_at: str
    note: str
    label: str = Field(
        default="Kullanici onayi",
        description="Kullanicinin kendi onayidir; resmi kurum karari degildir.",
    )
