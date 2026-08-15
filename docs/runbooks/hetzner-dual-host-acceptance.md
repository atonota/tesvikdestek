# Runbook — Dual-host (AMD + Intel) acceptance on Hetzner

**Status: UNVERIFIED ENVIRONMENT GATE.**
No Hetzner host was provided to this change package, so **none of the steps below have been
executed**. The runbook is complete and ready; the result is missing, and this document does
not pretend otherwise.

---

## What this gate is actually about

It is *not* about AMD versus Intel as brands. Both Hetzner lines
([hetzner.com/cloud](https://www.hetzner.com/cloud/regular-performance/)) are `x86_64`,
`linux/amd64`, System V AMD64 ABI, glibc. The real questions are:

1. Does the **same image digest** run on both, without a per-host build?
2. Does the deterministic engine produce a **byte-identical `decision_hash`** on both?

If either answer is no, the release is not portable and the audit story is broken — a decision
that hashes differently on two hosts cannot be reproduced or defended.

**Not in scope, deliberately:** narrowing the target to `x86-64-v2`. That would be an unmeasured
constraint dressed up as a guarantee. See
[unknown-unknowns #16](../reports/2026-08-14-codex-unknown-unknowns.md#16--donanım-amd-epyc-vs-intel).

**Also not proof:** a green CI run. GitHub-hosted x64 runners do not guarantee a CPU vendor
([runner docs](https://docs.github.com/en/actions/how-tos/write-workflows/choose-where-workflows-run/choose-the-runner-for-a-job)),
so CI is evidence about *one* x86_64 host.

---

## Prerequisites

- Two Hetzner Cloud servers, one on an **AMD** line and one on an **Intel** line, both
  `linux/amd64`, both with Docker installed.
- One image, built once, for `linux/amd64`
  ([multi-platform docs](https://docs.docker.com/build/building/multi-platform/)).
- A PostgreSQL 17 instance reachable from each host (or one per host for the smoke).

Provisioning these servers costs money and is an **owner decision**. Nothing in this package
provisions, deploys to, or mutates any Hetzner resource.

---

## Step 1 — Build once, record the digest

```bash
cd platform
docker buildx build --platform linux/amd64 -t destektesvik:acceptance --load .
docker image inspect --format '{{.Id}}' destektesvik:acceptance | tee /tmp/digest-build.txt
```

Record the value. Everything after this compares against it.

## Step 2 — Move the *same* image to both hosts

Do **not** rebuild on either host — a rebuild would test the Dockerfile, not the artefact.
Transfer the identical image (`docker save`/`docker load`, or pull the same digest from a
registry once one is authorised).

```bash
docker save destektesvik:acceptance | ssh <amd-host>   'docker load'
docker save destektesvik:acceptance | ssh <intel-host> 'docker load'
```

## Step 3 — Assert the digest matches on both hosts

```bash
ssh <amd-host>   "docker image inspect --format '{{.Id}}' destektesvik:acceptance"
ssh <intel-host> "docker image inspect --format '{{.Id}}' destektesvik:acceptance"
```

**PASS:** both equal `/tmp/digest-build.txt`.
**FAIL:** any difference — stop; the artefact is not what was built.

## Step 4 — Container smoke on each host

```bash
./scripts/container-smoke.sh \
  destektesvik:acceptance \
  "<migration-database-url>" \
  "<app-database-url>" \
  host
```

Two URLs, and they must be different roles. The first owns the schema and runs the migration
and seed; the second is what the web container connects with. The script refuses to start if
they are identical.

This checks os/arch, that the runtime user is not root, migration on an empty database, seed
idempotency, **that the runtime database role is neither a superuser nor holds BYPASSRLS**,
`/saglik`, `/hazir` (3 programmes), the OpenAPI document, the landing page and the public
programme endpoint.

The role assertion is not decoration. With a superuser or a `BYPASSRLS` role, every row level
security policy is skipped and the smoke test goes green while proving nothing at all about
tenant isolation.

**PASS:** `SMOKE OK` on both hosts.

## Step 5 — The determinism comparison (the one that matters)

```bash
ssh <amd-host>   "docker run --rm destektesvik:acceptance python scripts/decision-fingerprint.py" \
  > /tmp/fingerprint-amd.json
ssh <intel-host> "docker run --rm destektesvik:acceptance python scripts/decision-fingerprint.py" \
  > /tmp/fingerprint-intel.json
diff -u /tmp/fingerprint-amd.json /tmp/fingerprint-intel.json && echo "DETERMINISM OK"
```

`scripts/decision-fingerprint.py` evaluates a fixed reference profile against all three seed
programmes on a fixed date, touching no database and reading no configuration.

**PASS:** `diff` is empty.
**FAIL:** any byte difference — determinism is broken; do not release.

### Reference fingerprint produced on the authoring host

Produced on macOS arm64 (CPython 3.13.7) on 2026-08-14, **outside** a container. It is recorded
as a baseline for the comparison above, not as evidence of the gate:

```json
{
  "KOSGEB-GIRISIMCI": {
    "decision_hash": "a05931221104117d162455d91be96aa3bc0dd4bbce005ed7f2566a70801a0f3a",
    "input_hash": "e9d959eac2b391d4623acdc02901816256518d61df7b02573b6c04092ed8d4d3",
    "outcome": "conditional"
  },
  "TUBITAK-1501": {
    "decision_hash": "071aa48141c4ce88e1bb436e336550519c4fc5beab1a8428d6b6bbf7e7bd77fe",
    "input_hash": "e68824e31a1f8f877d5c45ce2cfaa10d8fe8a7829ee8514df0bf93fe828d1920",
    "outcome": "conditional"
  },
  "TUBITAK-1507": {
    "decision_hash": "a7cda1a793d0cfc34de5d3b86e1c4c550088e8fc25996c7624b863bd4a9cb06d",
    "input_hash": "cca52ba45fbdb4d2afbf2edc191f59d226ec4bf0e449fdfb27502a892cbe79b0",
    "outcome": "conditional"
  }
}
```

Note that this arm64 baseline matching the amd64 hosts would be a *bonus* observation, not the
gate: the gate is AMD versus Intel, both amd64.

## Step 6 — Rollback rehearsal

Every release must have rolled back at least once before it is trusted:

```bash
docker run --rm -e DESTEKTESVIK_MIGRATION_DATABASE_URL="<url>" \
  destektesvik:acceptance alembic downgrade -1
docker run --rm -e DESTEKTESVIK_MIGRATION_DATABASE_URL="<url>" \
  destektesvik:acceptance alembic upgrade head
```

---

## Acceptance record (to be filled in by whoever runs it)

| # | Check | AMD host | Intel host |
|---|---|---|---|
| 1 | Image id equals build digest | ☐ | ☐ |
| 2 | `SMOKE OK` | ☐ | ☐ |
| 3 | Runtime user is not root | ☐ | ☐ |
| 4 | Migration on empty DB | ☐ | ☐ |
| 5 | Seed idempotent | ☐ | ☐ |
| 6 | `decision_hash` identical across hosts | ☐ (single shared result) | |
| 7 | Rollback rehearsed | ☐ | ☐ |

Until every box is ticked on real hardware, the correct status statement is exactly:
**"dual-host acceptance: UNVERIFIED ENVIRONMENT GATE."**

---

## Out of scope for this runbook

Backup/restore, TLS termination, secret management, rate limiting, email verification,
observability, SLOs and disaster recovery are **production-readiness gates** and are not
addressed by this package
([unknown-unknowns #19](../reports/2026-08-14-codex-unknown-unknowns.md#19--production-readiness--mvp)).
