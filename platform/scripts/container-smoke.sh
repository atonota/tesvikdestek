#!/usr/bin/env bash
# Container smoke test.
#
# What this proves: the linux/amd64 image starts, migrates an empty database,
# seeds the catalogue idempotently, serves its health and readiness endpoints,
# renders the landing page, and - crucially - runs its web process as an
# unprivileged database role rather than the schema owner.
#
# Two URLs, never one: the owner/migration role owns the schema and runs
# `alembic upgrade`; the application role is what the web container connects
# with. Passing one URL for both is how a smoke test silently proves nothing
# about row level security, because a superuser bypasses it entirely.
#
# What this does NOT prove: that the same digest behaves identically on an AMD
# host and an Intel host. That needs two real hosts and is tracked as an open
# environment gate in docs/runbooks/hetzner-dual-host-acceptance.md.
set -euo pipefail

USAGE="usage: container-smoke.sh <image-ref> <migration-database-url> <app-database-url> [network]"
IMAGE="${1:?$USAGE}"
MIGRATION_DATABASE_URL="${2:?$USAGE}"
APP_DATABASE_URL="${3:?$USAGE}"
NETWORK="${4:-host}"
CONTAINER_NAME="destektesvik-smoke-$$"
PORT="${SMOKE_PORT:-8000}"

if [ "$MIGRATION_DATABASE_URL" = "$APP_DATABASE_URL" ]; then
  echo "FAIL: migration and application URLs are identical; role separation is not being tested"
  exit 1
fi

cleanup() {
  docker rm --force "$CONTAINER_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "==> image platform"
ARCH="$(docker image inspect --format '{{.Architecture}}' "$IMAGE")"
OS="$(docker image inspect --format '{{.Os}}' "$IMAGE")"
DIGEST="$(docker image inspect --format '{{.Id}}' "$IMAGE")"
echo "    os=$OS arch=$ARCH id=$DIGEST"
[ "$OS" = "linux" ] || { echo "FAIL: expected linux, got $OS"; exit 1; }
[ "$ARCH" = "amd64" ] || { echo "FAIL: expected amd64, got $ARCH"; exit 1; }

echo "==> user is not root"
IMAGE_USER="$(docker image inspect --format '{{.Config.User}}' "$IMAGE")"
echo "    user=$IMAGE_USER"
[ -n "$IMAGE_USER" ] && [ "$IMAGE_USER" != "root" ] \
  || { echo "FAIL: image runs as root"; exit 1; }

echo "==> migrate + seed"
docker run --rm --network "$NETWORK" \
  -e DESTEKTESVIK_MIGRATION_DATABASE_URL="$MIGRATION_DATABASE_URL" \
  -e DESTEKTESVIK_DATABASE_URL="$MIGRATION_DATABASE_URL" \
  "$IMAGE" sh -c "alembic upgrade head && python scripts/seed.py"

echo "==> seed is idempotent (second run must report no change)"
SECOND_RUN="$(docker run --rm --network "$NETWORK" \
  -e DESTEKTESVIK_DATABASE_URL="$MIGRATION_DATABASE_URL" \
  "$IMAGE" python scripts/seed.py)"
echo "    $SECOND_RUN"
case "$SECOND_RUN" in
  *"degisiklik yok"*) ;;
  *) echo "FAIL: seed was not idempotent"; exit 1 ;;
esac

echo "==> runtime database role is neither superuser nor BYPASSRLS"
ROLE_REPORT="$(docker run --rm --network "$NETWORK" \
  -e DESTEKTESVIK_DATABASE_URL="$APP_DATABASE_URL" \
  "$IMAGE" python -c '
import os
from sqlalchemy import create_engine, text

engine = create_engine(os.environ["DESTEKTESVIK_DATABASE_URL"], future=True)
with engine.connect() as connection:
    row = connection.execute(
        text("SELECT current_user, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user")
    ).one()
print(f"user={row[0]} rolsuper={row[1]} rolbypassrls={row[2]}")
')"
echo "    $ROLE_REPORT"
case "$ROLE_REPORT" in
  *"rolsuper=False"*) ;;
  *) echo "FAIL: the application role is a superuser; RLS would be bypassed"; exit 1 ;;
esac
case "$ROLE_REPORT" in
  *"rolbypassrls=False"*) ;;
  *) echo "FAIL: the application role holds BYPASSRLS; RLS would be bypassed"; exit 1 ;;
esac

echo "==> start container"
docker run --detach --name "$CONTAINER_NAME" --network "$NETWORK" \
  -e DESTEKTESVIK_DATABASE_URL="$APP_DATABASE_URL" \
  -e DESTEKTESVIK_SECRET_KEY="smoke-only-not-a-production-secret" \
  -e DESTEKTESVIK_AI_PROVIDER="disabled" \
  "$IMAGE" >/dev/null

echo "==> wait for /saglik"
for attempt in $(seq 1 60); do
  if curl --fail --silent "http://127.0.0.1:${PORT}/saglik" >/dev/null 2>&1; then
    echo "    up after ${attempt}s"
    break
  fi
  if [ "$attempt" -eq 60 ]; then
    echo "FAIL: container never became healthy"
    docker logs "$CONTAINER_NAME" || true
    exit 1
  fi
  sleep 1
done

echo "==> readiness"
READY="$(curl --fail --silent "http://127.0.0.1:${PORT}/hazir")"
echo "    $READY"
case "$READY" in
  *'"status":"ready"'*) ;;
  *) echo "FAIL: readiness did not report ready"; exit 1 ;;
esac
case "$READY" in
  *'"program_count":3'*) ;;
  *) echo "FAIL: expected 3 seed programmes"; exit 1 ;;
esac

echo "==> openapi"
curl --fail --silent "http://127.0.0.1:${PORT}/openapi.json" | grep -q '"openapi"' \
  || { echo "FAIL: openapi document missing"; exit 1; }

echo "==> landing page renders Turkish content"
curl --fail --silent "http://127.0.0.1:${PORT}/" | grep -q "Resmi kuruma basvuru gondermez" \
  || { echo "FAIL: landing page did not render"; exit 1; }

echo "==> public programme endpoint"
curl --fail --silent "http://127.0.0.1:${PORT}/api/programlar" | grep -q "TUBITAK-1501" \
  || { echo "FAIL: programme endpoint did not list the seed catalogue"; exit 1; }

echo "SMOKE OK  image=$DIGEST arch=$OS/$ARCH"
