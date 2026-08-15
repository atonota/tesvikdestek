# syntax=docker/dockerfile:1

# Target: a generic linux/amd64 baseline.
#
# Deliberately NOT narrowed to x86-64-v2 and deliberately free of
# -march=native or AVX flags: AMD EPYC and Intel Xeon share the same ISA and
# ABI here, and pinning a microarchitecture level would be a claim this
# repository has not measured. Determinism comes from canonical JSON, SHA-256
# and Decimal money, not from the CPU.

FROM python:3.13-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/opt/venv

# Pinned to the uv version that produced and verified uv.lock on the authoring
# host, so the container resolves exactly the same dependency graph.
COPY --from=ghcr.io/astral-sh/uv:0.11.1 /uv /usr/local/bin/uv

WORKDIR /build

# Dependencies first, so a source-only change does not re-resolve the world.
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project

COPY src ./src
COPY migrations ./migrations
COPY alembic.ini ./
COPY scripts ./scripts
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev


FROM python:3.13-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:${PATH}"

# curl is used by the container HEALTHCHECK below and nothing else.
RUN apt-get update \
    && apt-get install --no-install-recommends -y curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 10001 destektesvik \
    && useradd --system --uid 10001 --gid destektesvik --no-create-home destektesvik

WORKDIR /app

COPY --from=builder /opt/venv /opt/venv
COPY --from=builder /build/src /app/src
COPY --from=builder /build/migrations /app/migrations
COPY --from=builder /build/alembic.ini /app/alembic.ini
COPY --from=builder /build/scripts /app/scripts

USER destektesvik

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD ["curl", "--fail", "--silent", "http://127.0.0.1:8000/saglik"]

# Exec form: uvicorn becomes PID 1 and receives SIGTERM directly.
CMD ["uvicorn", "--factory", "destektesvik.delivery.app:build_default_app", \
     "--host", "0.0.0.0", "--port", "8000"]
