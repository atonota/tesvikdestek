"""Use cases and ports.

This layer may know about Pydantic (it validates untrusted output at the
boundary) but never about FastAPI, SQLAlchemy or Jinja2.
"""
