"""A provider-agnostic, OpenAI-compatible HTTP adapter.

This exists as a *real configuration point*, not as a vendor choice.  Nothing
here is hardcoded: base URL, model name and API key all come from settings,
and the whole adapter stays unused until an operator configures it.

No network call in this repository's test suite goes through this class - the
tests use the fake providers.  External AI cost and secrets are not authorised
for this change package, so a live call is deliberately not a GREEN condition.
"""

import json
from collections.abc import Mapping
from typing import Any

import httpx

from destektesvik.application.errors import AiProviderUnavailable


class OpenAiCompatibleProvider:
    """Talks to any endpoint implementing ``POST /chat/completions``."""

    name = "openai-compatible"

    def __init__(
        self,
        base_url: str,
        api_key: str,
        model: str,
        timeout_seconds: float = 30.0,
        client: "httpx.Client | None" = None,
    ) -> None:
        if not base_url or not api_key or not model:
            raise AiProviderUnavailable(
                "base_url, api_key ve model konfigure edilmeden bu saglayici kullanilamaz"
            )
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._model = model
        self._timeout = timeout_seconds
        self._client = client

    def _post(self, payload: dict[str, Any]) -> httpx.Response:
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        url = f"{self._base_url}/chat/completions"
        if self._client is not None:
            return self._client.post(url, json=payload, headers=headers, timeout=self._timeout)
        with httpx.Client(timeout=self._timeout) as client:
            return client.post(url, json=payload, headers=headers)

    def explain(self, prompt: str) -> Mapping[str, Any]:
        payload = {
            "model": self._model,
            "messages": [{"role": "user", "content": prompt}],
            "response_format": {"type": "json_object"},
            "temperature": 0,
        }
        try:
            response = self._post(payload)
            response.raise_for_status()
            body = response.json()
            content = body["choices"][0]["message"]["content"]
            parsed = json.loads(content)
        except (httpx.HTTPError, KeyError, IndexError, ValueError) as exc:
            # Never leak the key or the raw body into the error path.
            raise AiProviderUnavailable(
                f"AI saglayicisindan gecerli yanit alinamadi ({type(exc).__name__})"
            ) from exc
        if not isinstance(parsed, Mapping):
            raise AiProviderUnavailable("AI saglayicisi bir nesne dondurmedi")
        return parsed
