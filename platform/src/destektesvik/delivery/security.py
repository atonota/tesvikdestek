"""CSRF protection for browser forms.

Double-submit: a random value lives in an httpOnly cookie, and every form
carries a *signed* copy of it.  A POST is accepted only when the signature is
valid and the unsigned value matches the cookie.  A cross-site form cannot
read the cookie, so it cannot produce a matching pair.
"""

import secrets

from itsdangerous import BadSignature, URLSafeTimedSerializer

CSRF_COOKIE_NAME = "destektesvik_csrf"
CSRF_FIELD_NAME = "csrf_token"
#: The header the JSON API carries its signed token in.  A cross-site caller
#: cannot set a custom header on a simple form post, and cannot read the
#: httpOnly cookie to forge a matching pair.
CSRF_HEADER_NAME = "X-CSRF-Token"
CSRF_MAX_AGE_SECONDS = 60 * 60 * 12
_SALT = "destektesvik-csrf"


def new_csrf_secret() -> str:
    return secrets.token_urlsafe(32)


def sign_csrf(secret_key: str, csrf_secret: str) -> str:
    return URLSafeTimedSerializer(secret_key, salt=_SALT).dumps(csrf_secret)


def verify_csrf(secret_key: str, cookie_value: str | None, submitted: str | None) -> bool:
    """Both halves must be present, signed by us, and equal to each other."""
    if not cookie_value or not submitted:
        return False
    try:
        unsigned = URLSafeTimedSerializer(secret_key, salt=_SALT).loads(
            submitted, max_age=CSRF_MAX_AGE_SECONDS
        )
    except BadSignature:
        return False
    return secrets.compare_digest(str(unsigned), cookie_value)
