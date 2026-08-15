"""Application level errors."""


class ApplicationError(Exception):
    """Base class for refusals raised by use cases."""


class AiOutputRejected(ApplicationError):
    """The AI returned something outside its authority or its schema.

    Rejection is always total.  There is no partial application of a
    malformed or overreaching AI response.
    """

    def __init__(self, reason: str, detail: str = "") -> None:
        super().__init__(f"{reason}: {detail}" if detail else reason)
        self.reason = reason
        self.detail = detail


class AiProviderUnavailable(ApplicationError):
    """The AI provider is disabled, unreachable or misconfigured.

    This must never stop a deterministic decision from being produced.
    """


class AuthenticationError(ApplicationError):
    """Bad credentials, or no session."""


class TenantIsolationError(ApplicationError):
    """A caller reached for something belonging to another tenant."""


class CsrfError(ApplicationError):
    """A state changing request arrived without a valid CSRF token."""
