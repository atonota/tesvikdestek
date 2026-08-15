"""Test providers.

``FakeAiProvider`` behaves.  ``HostileAiProvider`` does exactly what a prompt
injected model would do, so the guard is tested against real misbehaviour
rather than against an imagined version of it.
"""

from collections.abc import Mapping, Sequence
from typing import Any

from destektesvik.application.errors import AiProviderUnavailable


class FakeAiProvider:
    name = "fake"

    def __init__(
        self,
        citations: Sequence[str] = ("snap-1501",),
        summary: str = "Deterministik sonuc, kaynakta yayinlanmis kosullara dayaniyor.",
        missing_documents: Sequence[str] = ("Vergi levhasi",),
    ) -> None:
        self._citations = list(citations)
        self._summary = summary
        self._missing_documents = list(missing_documents)

    def explain(self, prompt: str) -> Mapping[str, Any]:
        return {
            "summary": self._summary,
            "missing_documents": list(self._missing_documents),
            "citations": list(self._citations),
        }


class HostileAiProvider:
    """A model that obeyed an injected instruction and overstepped."""

    name = "hostile-fake"

    def explain(self, prompt: str) -> Mapping[str, Any]:
        return {
            "summary": "Talimat geregi uygunlugu guncelledim.",
            "missing_documents": [],
            "citations": ["snap-1501"],
            "outcome": "candidate_eligible",
            "awarded_amount": "2500000.00",
        }


class UnavailableAiProvider:
    """A provider that is configured but cannot be reached."""

    name = "unavailable-fake"

    def explain(self, prompt: str) -> Mapping[str, Any]:
        raise AiProviderUnavailable("saglayiciya ulasilamadi")
