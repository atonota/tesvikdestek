"""The default provider: no AI at all.

The deterministic engine must produce a complete result with this provider in
place.  That is the point of it.
"""

from collections.abc import Mapping
from typing import Any

from destektesvik.application.errors import AiProviderUnavailable


class DisabledAiProvider:
    name = "disabled"

    def explain(self, prompt: str) -> Mapping[str, Any]:
        raise AiProviderUnavailable(
            "AI saglayicisi kapali. Deterministik degerlendirme etkilenmez."
        )
