# Implementation Evidence — RED → GREEN

**Change package:** `destektesvik-mvp-fastapi-v1`
**Base SHA:** `2ad7561e6fa33eb384c8ce62402f9ac18dd2152d`
**Host:** macOS (Darwin 25.1.0), arm64, CPython 3.13.7, `uv` lockfile-driven

This file records **real command output**, not a description of it. Every RED block below was
produced *before* the corresponding implementation existed, and every GREEN block *after*.

A note on what counts as RED: a test that fails because its import is broken is **not**
evidence. Every RED cycle here was produced against importable modules with deliberately
wrong stub behaviour, so the failures are genuine assertions about domain behaviour.

---

## RED cycle 1 — domain core (rules, evaluation, money, sourcing, determinism)

**Stubs in place:** `canonical_json` used plain `json.dumps` (no float rejection, no key
ordering guarantee); `Money.from_decimal` accepted floats; `evaluate_rule` always returned
`Truth.TRUE`; `evaluate` always returned `CANDIDATE_ELIGIBLE` with `input_hash="stub"`;
`detect_double_financing` always returned `()`.

**Command**

```
$ cd platform
$ uv run --frozen pytest tests/unit tests/architecture --no-header --tb=no -rN
```

**Output (tail)**

```
FFFFFFFFFFFFFFFF.F.FFF..FFFFFFFFFF.F.FFF.EFFEFFFFFFFFF.F.FFFFFF......... [ 64%]
...............s........................                                 [100%]
52 failed, 57 passed, 1 skipped, 2 errors in 0.07s
```

**Exit code:** `1`

The single skip is pytest's empty-parameter-set skip for the application-layer import
boundary test: the `application` package had no modules yet at RED-1.

**Two representative failures — real domain assertions, not import errors**

```
$ uv run --frozen pytest \
    tests/unit/test_evaluation_outcomes.py::TestFourValuedOutcome::test_a_missing_fact_is_insufficient_data_not_ineligible \
    tests/unit/test_rule_dsl.py::TestThreeValuedLogic::test_missing_fact_is_unknown_not_false -q

_ TestFourValuedOutcome.test_a_missing_fact_is_insufficient_data_not_ineligible _

    def test_a_missing_fact_is_insufficient_data_not_ineligible(self) -> None:
        result = evaluate(_build(facts={"is_capital_company": True}))
>       assert result.outcome is EligibilityOutcome.INSUFFICIENT_DATA
E       AssertionError: assert <EligibilityOutcome.CANDIDATE_ELIGIBLE: 'candidate_eligible'>
E                          is <EligibilityOutcome.INSUFFICIENT_DATA: 'insufficient_data'>

tests/unit/test_evaluation_outcomes.py:69: AssertionError

_________ TestThreeValuedLogic.test_missing_fact_is_unknown_not_false __________

    def test_missing_fact_is_unknown_not_false(self) -> None:
        rule = parse_rule(_leaf(), CITATIONS)
        evaluation = evaluate_rule(rule, facts={})
>       assert evaluation.result is Truth.UNKNOWN
E       AssertionError: assert <Truth.TRUE: 'true'> is <Truth.UNKNOWN: 'unknown'>

tests/unit/test_rule_dsl.py:51: AssertionError
```

This is exactly the failure the product cares about most: the stub engine said
"candidate eligible" about a company whose NACE code it had never been told.

---

## GREEN cycle 1 — domain core

Stubs replaced with the real canonical serialiser, `Money`, `MoneyState`, rule parser and
three-valued evaluator, `SourceSnapshot.effective_state`, `CallWindow.state`, the evaluation
engine and double-financing detection.

```
$ uv run --frozen pytest tests/unit tests/architecture --no-header --tb=short -rN
........................................................................ [ 64%]
...............s........................                                 [100%]
111 passed, 1 skipped in 0.08s
```

**Exit code:** `0`

---

## RED cycle 2 — the AI authority boundary

**Stub in place:** `validate_ai_output` returned whatever the model sent, with no authority
check, no strict schema and no citation allowlist. The provider adapters did not exist yet.

```
$ uv run --frozen pytest tests/unit/test_ai_port.py --no-header --tb=line -rN
...
tests/unit/test_ai_port.py:116: Failed: DID NOT RAISE AiOutputRejected
E   ModuleNotFoundError: No module named 'destektesvik.adapters.ai.disabled'
...
22 failed, 3 passed in 0.02s
```

**Exit code:** `1`

19 of the 22 failures are behavioural (`DID NOT RAISE AiOutputRejected` for every forbidden
decision field, for every out-of-allowlist citation and for every schema violation). Three are
`ModuleNotFoundError` for the provider adapters, which did not exist at this point — those
three are *not* counted as behavioural evidence.

## GREEN cycle 2

```
$ uv run --frozen pytest tests/unit/test_ai_port.py --no-header --tb=short -rN
.........................                                                [100%]
25 passed in 0.49s
```

**Exit code:** `0`

---

## RED cycle 3 — CSRF and cross-tenant access

Two deliberate weaknesses were planted in otherwise complete code, chosen because they are the
two failures that would actually hurt a customer:

1. `delivery/security.py::verify_csrf` returned `True` unconditionally.
2. `adapters/db/repositories.py::DecisionRepositoryImpl.get` accepted `tenant_id` and ignored it.

```
$ uv run --frozen pytest tests/integration --no-header --tb=line -rN
...
E   AssertionError: assert 200 == 400
     +  where 200 = <Response [200 OK]>.status_code
     +    where <Response [200 OK]> = post('/kayit', data={...})   # CSRF not enforced

E   AssertionError: assert 200 == 404
     +  where 200 = <Response [200 OK]>.status_code
     +    where <Response [200 OK]> = get('/api/degerlendirmeler/b6689589c125...')
                                     # tenant B read tenant A's decision
...
7 failed, 26 passed, 1 warning in 2.71s
```

**Exit code:** `1`

All seven failures are behavioural, and they map exactly onto the two planted weaknesses:
four CSRF tests and three cross-tenant tests. Every other integration test passed at RED
because the rest of the delivery layer was already correct — that is stated here rather than
dressed up as a broader RED.

## GREEN cycle 3

`verify_csrf` became a real double-submit check (signature valid **and** unsigned value equal to
the cookie, compared with `secrets.compare_digest`), and the decision lookup gained its
`tenant_id` predicate.

```
$ uv run --frozen pytest tests/integration --no-header --tb=short -rN
33 passed, 1 warning in 2.69s
```

**Exit code:** `0`

---

## A real bug found after GREEN — seeding was not idempotent

While exercising the application outside the test harness, seeding turned out to rewrite the
entire catalogue on every run. SQLite returns naive datetimes even for timezone-aware columns,
so `stored_captured_at != desired_captured_at` was true forever.

```
$ uv run --frozen python -c "... seed_catalog(...) twice ..."
seed1 SeedReport(snapshots=3, programs=3, rule_sets=3, changed=True)
seed2 idempotent: False        # <- the bug: the second run still reported changes
```

Fixed by comparing datetimes with a tz-normalising helper, and locked in by
`tests/integration/test_seed_idempotency.py`:

```
$ uv run --frozen python -c "... seed_catalog(...) three times ..."
run1 changed = True | run2 changed = False | run3 changed = False
```

This is reported because it happened, not because it was planned: the RED→GREEN cycles did not
catch it, a manual run did.

## A second real catch — the legacy guard did its job

Adding `README.md` at the repository root made the prototype guard fail:

```
E   AssertionError: legacy files missing from the manifest: ['README.md']
```

That is the guard working as designed. `README.md` is a file this change package owns, so it
was added to the small allowlist of package-owned root files rather than to the frozen-prototype
manifest.

---

## Final GREEN — full suite

```
$ cd platform
$ uv run --frozen ruff check .
All checks passed!

$ uv run --frozen ruff format --check .
68 files already formatted

$ uv run --frozen mypy
Success: no issues found in 65 source files

$ uv run --frozen pytest tests --no-header --tb=short -rN
197 passed, 14 skipped, 1 warning in 3.43s
```

**Exit codes:** `0`, `0`, `0`, `0`

The 14 skips are the PostgreSQL-only guarantees (row level security, append-only triggers,
migration on an empty database, PostgreSQL seed idempotency). Each skip prints its reason:

```
SKIPPED [1] tests/integration/test_postgres_security.py:186:
  DESTEKTESVIK_TEST_DATABASE_URL is not set; PostgreSQL-only guarantees (RLS,
  append-only triggers, migrations) cannot be verified on this host
```

CI runs them against a real PostgreSQL 17 service with a separate `NOSUPERUSER NOBYPASSRLS`
application role, and **fails the build if they skip** — a silently skipped security test is
worse than a failing one.

---

## Live run of the real server (not the test client)

`uvicorn` was started against a SQLite file and driven with `curl`.

```
$ uvicorn --factory destektesvik.delivery.app:build_default_app --host 127.0.0.1 --port 8137
INFO:     Application startup complete.

$ curl -s /saglik
{"status":"ok"}

$ curl -s /hazir
{"database":"ok","catalog":"ok","program_count":3,"ai_provider":"disabled","status":"ready"}

kayit=303          # register
giris=303          # log in
profil=303         # save company profile
degerlendir=303    # run the deterministic evaluation

$ curl -s -b cookies /api/degerlendirmeler
  KOSGEB-GIRISIMCI     conditional  Kosullu  hash=a4f51c4f2a39  reasons=['source_effective_dates_unknown', 'call_window_unknown']
  TUBITAK-1501         conditional  Kosullu  hash=c1c872a502bc  reasons=['source_effective_dates_unknown', 'call_window_unknown']
  TUBITAK-1507         conditional  Kosullu  hash=f38fd25199f8  reasons=['source_effective_dates_unknown', 'call_window_unknown']
```

Note what the running system refuses to say: a fully qualifying company is **`conditional`**, not
`candidate_eligible`, because no seed programme publishes a call window. The system does not
guess "open".

Decision page, approval, and the two refusals:

```
page contains: Kural izi
page contains: baglayici degildir
page contains: Kullanici onayi
page contains: tubitak.gov.tr
page contains: pending_review
onay=303                  # user approval recorded
csrfsiz_profil=400        # POST without a CSRF token refused
anon_api=401              # anonymous API call refused
```

Log hygiene on the same run:

```
$ grep -ciE "parola|password|cok-guclu|4500000|destektesvik_session=..." /tmp/dt-uvicorn.log
0
```

No password, session token or turnover value reached the logs.

---

## Determinism fingerprint (authoring host)

```
$ uv run --frozen python scripts/decision-fingerprint.py
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

Produced on macOS arm64, outside a container. It is the baseline the dual-host runbook compares
against; on its own it proves nothing about AMD versus Intel.

---

## What was NOT verified — environment gates

These are stated plainly because a package that hides them is lying.

| Gate | Status | Why |
|---|---|---|
| PostgreSQL RLS, `FORCE RLS`, append-only triggers | **NOT RUN LOCALLY** | No PostgreSQL on this host (`psql` absent, port 5432 closed). Tests written, skipped with reasons, and wired into CI where a skip fails the build. |
| Alembic migration on an empty database | **NOT RUN LOCALLY** | Same reason. Runs in CI and in the container smoke. |
| `docker buildx` linux/amd64 build | **NOT RUN** | Docker daemon unavailable on this host: `Cannot connect to the Docker daemon at unix:///Users/karaca/.docker/run/docker.sock`. Re-checked at the end of the session; still unavailable. |
| `docker compose` smoke | **NOT RUN** | Same reason. |
| Same-digest smoke on an AMD **and** an Intel Hetzner host | **UNVERIFIED ENVIRONMENT GATE** | No hosts provided. Runbook complete: `docs/runbooks/hetzner-dual-host-acceptance.md`. |
| Real AI provider call | **NOT RUN, BY DESIGN** | External AI cost and secrets are not authorised for this package. Tests use fake providers; a live call is deliberately not a GREEN condition. |

The Dockerfile, `compose.yaml`, `scripts/container-smoke.sh` and the CI workflow are **written
but uncommitted** - like every file in this change package, they exist only in the working tree.
What is missing is the *execution evidence*, and no substitute evidence is offered in its place.

---

## Commands, collected

```bash
cd platform
uv sync --frozen                                   # exit 0
uv run --frozen ruff check .                       # exit 0
uv run --frozen ruff format --check .              # exit 0
uv run --frozen mypy                               # exit 0
uv run --frozen pytest tests                       # exit 0 — 197 passed, 14 skipped
uv run --frozen python scripts/decision-fingerprint.py   # exit 0
```

No `git commit`, `git push`, PR, merge, deploy, release or version bump was performed by this
session, and no destructive command was run.

---

# Acceptance fixes — RED → GREEN (second cycle)

An independent Claude review of snapshot
`7673c84f0e632419e52c35da4428f64e06cd51179b12d9c38edd1750d3537b73` returned findings that
MASTER accepted. This section records the corrections. The snapshot hash was re-verified as
**unchanged** before any edit, so the review applied to exactly the tree that was fixed.

Everything above this line describes the package **as reviewed**; nothing in it was rewritten
to look better in hindsight. The numbers in "Final GREEN — full suite" (197 passed, 14 skipped)
were correct then and are left as the historical record.

## What the findings were

| # | Finding | Why it mattered |
|---|---|---|
| A | Pre-auth RLS was permissive whenever `app.current_tenant` was unset | One missed `apply_tenant_scope` exposed **every** tenant's `users`, `user_sessions` and `audit_events` rows - credentials and live session fingerprints included |
| B | Container smoke ran the web container as the schema owner (a superuser) | Every RLS policy was bypassed, so the smoke test proved nothing about tenant isolation. The skip guard's `pytest \| tee` also reported *tee's* exit code, so a failing security test would have passed the gate |
| C | Compose never forwarded `DESTEKTESVIK_APP_DB_ROLE`, `..._SAMESITE`, `..._TTL_SECONDS`; migration skipped grants silently when the app role was absent | A database that looked migrated and refused every real request |
| D | The JSON write endpoint relied on `SameSite` alone | `SameSite` is the browser's promise, not the application's |
| E | Login returned early for an unknown e-mail | Response time answered "does this account exist?", which the uniform error message was there to hide |
| F | Evidence said container/CI files were "committed"; AI surface and tenant-isolation claims overstated | Documentation that is wrong about itself is the failure this product exists to prevent |
| G | `in` lacked the cross-type shape guard `eq` had; no production config validation | `1` compared equal to `True`; development defaults could reach production |

## RED — before any implementation

New tests were written first. Two of them could not import their target symbols, which by this
package's own standard is **not** evidence, so the missing symbols were introduced as
deliberately inert stubs (`DUMMY_PASSWORD_HASH`, `InsecureConfigurationError`, the lookup GUC
constants, `LOOKUP_TENANT_TABLES`, `validate_app_role`) with the old behaviour left in place.
The RED below is therefore behavioural throughout.

```
$ cd platform
$ uv run --frozen pytest tests --no-header --tb=line -rN
41 failed, 218 passed, 29 skipped, 1 warning in 4.77s
```

**Exit code:** `1`

Representative failures, one per finding:

```
# A - the service never established a scope the policies could read
E   AssertionError: 'scope.lookup_email=biri@ornek.com.tr' never happened;
      log = ['users.find_by_email', 'hasher.verify', 'sessions.create', 'audit.add']
tests/unit/test_auth_scoping_and_timing.py:38

E   AssertionError: authentication never set a tenant scope; log = ['sessions.find_active']
tests/unit/test_auth_scoping_and_timing.py:294

# A - the permissive branch was still in the migration
FAILED TestPreAuthPoliciesUseExactLookups::test_no_policy_is_permissive_merely_because_no_tenant_is_set
FAILED TestPreAuthPoliciesUseExactLookups::test_audit_events_are_strictly_tenant_scoped
FAILED TestPreAuthPoliciesUseExactLookups::test_tenants_is_under_row_level_security_too

# B - no application role was created for the container job
FAILED TestContainerJobSeparatesTheDatabaseRoles::test_the_container_job_creates_an_unprivileged_application_role
FAILED TestContainerSmokeInterface::test_the_web_container_is_started_with_the_application_url
FAILED TestTheSkipGuardCannotPassOnFailure::test_the_postgres_security_guard_propagates_the_pytest_exit_code

# C - Compose did not forward what its own services read
FAILED TestComposeForwardsWhatItReferences::test_the_db_service_receives_the_application_role_name
FAILED TestComposeForwardsWhatItReferences::test_the_web_service_receives_the_cookie_and_session_settings
FAILED TestMigrationRefusesToSkipGrantsSilently::test_a_missing_application_role_is_an_error_not_a_shrug

# D - the API write path had no CSRF at all, and GET /api/csrf did not exist
FAILED TestApiCsrf::test_the_token_endpoint_issues_a_signed_token_and_refreshes_the_cookie
FAILED TestApiCsrf::test_a_write_without_a_csrf_header_is_refused
FAILED TestApiCsrf::test_a_write_with_a_forged_csrf_header_is_refused
FAILED TestApiCsrf::test_a_token_signed_for_a_different_cookie_is_refused
FAILED TestApiCsrf::test_no_decision_is_written_when_the_token_is_missing

# E - the unknown-user branch returned before reaching the hasher
FAILED TestLoginTimingIsEqualised::test_an_unknown_user_still_pays_for_a_real_verification
FAILED TestLoginTimingIsEqualised::test_both_branches_perform_exactly_one_verification

# G - `in` treated a boolean fact as equal to a numeric alternative
E   AssertionError: assert <Truth.TRUE: 'true'> is <Truth.FALSE: 'false'>
     actual=True matched expected=[1, 2]
tests/unit/test_rule_dsl.py:108

# G - production configuration was accepted with every development default
E   Failed: DID NOT RAISE InsecureConfigurationError
tests/unit/test_config_fail_closed.py:43, :47, :51, :56, :61, :74   (9 failing tests)
```

The full failing-test inventory was captured with
`uv run --frozen pytest tests --no-header --tb=no -rf`; the node ids above are copied from it
verbatim. Where an assertion message is quoted, it is quoted from the `--tb=line` run; where
only a node id is given, that is because the message was not captured in full, and it is not
reconstructed here from memory.

## GREEN — after the corrections

```
$ uv run --frozen ruff check .
All checks passed!

$ uv run --frozen ruff format --check .
73 files already formatted

$ uv run --frozen mypy
Success: no issues found in 68 source files

$ uv run --frozen pytest tests --no-header --tb=short -rN
260 passed, 29 skipped, 1 warning in 4.27s
```

**Exit codes:** `0`, `0`, `0`, `0`

Skips rose from 14 to 29 because the new PostgreSQL security tests are also PostgreSQL-only.
They are **not** silently skipped in CI: the guard fails the build on a skip, and now on a
failure too.

## Determinism fingerprint — unchanged

```
$ uv run --frozen python scripts/decision-fingerprint.py
  KOSGEB-GIRISIMCI  decision_hash a05931221104117d162455d91be96aa3bc0dd4bbce005ed7f2566a70801a0f3a
  TUBITAK-1501      decision_hash 071aa48141c4ce88e1bb436e336550519c4fc5beab1a8428d6b6bbf7e7bd77fe
  TUBITAK-1507      decision_hash a7cda1a793d0cfc34de5d3b86e1c4c550088e8fc25996c7624b863bd4a9cb06d
```

Byte-identical to the reviewed package. The `in` operator fix changed no seed decision, which
is the point: the guard only rejects comparisons the rule author never wrote.

## What the pre-auth window is now

Exactly two policies have a non-tenant branch, and each opens exactly one row:

| Table | Read without a tenant when | Write |
|---|---|---|
| `users` | `email = nullif(current_setting('app.lookup_email', true), '')` | `WITH CHECK` tenant-scoped |
| `user_sessions` | `token_fingerprint = nullif(current_setting('app.lookup_session_fingerprint', true), '')` | `WITH CHECK` tenant-scoped |

`tenants` (keyed on `id`), `company_profiles`, `decisions`, `approvals` and `audit_events` have
**no** pre-auth branch at all. `audit_events` in particular was moved out of the pre-auth set.
All settings are `set_config(..., true)`, so they die with the transaction.

## Third-party action versions — official evidence

MASTER live-verified every pinned major on 2026-08-14 against its official source:

| Pinned reference | Official source | What was seen |
|---|---|---|
| `actions/checkout@v6` | <https://github.com/actions/checkout> | the official README documents v6 |
| `actions/setup-python@v6` | <https://github.com/actions/setup-python/releases> | v6 releases exist; v6.2.0 visible |
| `docker/setup-buildx-action@v4` | <https://github.com/docker/setup-buildx-action/releases> | v4.1.0 visible |
| `docker/build-push-action@v7` | <https://github.com/docker/build-push-action/releases> | v7.2.0 visible |

All four majors exist and none is changed by this package.

**These are moving tags, not pinned digests.** `@v6` today and `@v6` next month can be
different code. This package makes no supply-chain claim beyond "the major exists and is the
current one"; SHA pinning with an update process is a later, separate gate and is deliberately
not asserted here.

## Environment gates — still open, still unexecuted

| Gate | Status | Why |
|---|---|---|
| PostgreSQL RLS incl. the new exact-lookup policies | **NOT RUN LOCALLY** | No PostgreSQL on this host. 27 tests written and skipped with reasons; CI fails the build if they skip *or* fail |
| Alembic migration incl. the new `RAISE EXCEPTION` on a missing app role | **NOT RUN LOCALLY** | Same reason |
| `docker buildx` linux/amd64 build and container smoke | **NOT RUN** | Docker daemon unavailable on this host; re-checked at the end of this session and still unavailable. The smoke script's new role-separation assertions have therefore never executed |
| `docker compose` incl. the hardened `01-app-role.sh` | **NOT RUN** | Same reason |
| GitHub Actions workflow itself | **NOT RUN** | Nothing was pushed; the workflow has never been executed by GitHub |
| Same-digest smoke on an AMD **and** an Intel Hetzner host | **UNVERIFIED ENVIRONMENT GATE** | No hosts provided |
| Real AI provider call | **NOT RUN, BY DESIGN** | External AI cost and secrets not authorised |

The PostgreSQL and container corrections are the ones with the least executable local evidence
and the highest security weight. That combination is stated here rather than smoothed over:
they are reviewed, tested and unexecuted.

## Commands, collected — acceptance fixes

```bash
cd platform
uv run --frozen ruff check .                             # exit 0
uv run --frozen ruff format --check .                    # exit 0 — 73 files
uv run --frozen mypy                                     # exit 0 — 68 source files
uv run --frozen pytest tests --no-header --tb=short -rN  # exit 0 — 260 passed, 29 skipped
uv run --frozen python scripts/decision-fingerprint.py   # exit 0 — unchanged
```

No `git add`, `git commit`, `git push`, PR, merge, deploy, release, secret use or paid external
AI call was performed in this session either. Tracked-file changes remain limited to the
authorised `.gitignore` addition; everything else is untracked working-tree content.

---

# Final fixes — second independent review (RED → GREEN)

A second independent Claude reviewer read snapshot
`b0670099099cad4ca8f5504f275cb246506e8f98bd466ee3edde5fe2e4099b06` and returned
**CONDITIONAL**. The tree did not change during that review. This section records the final
bounded package that answers it.

## The canonical package fingerprint — mechanism, and what it supersedes

Both earlier snapshot hashes, including `b0670099099cad4ca8f5504f275cb246506e8f98bd466ee3edde5fe2e4099b06`,
were produced by an ad hoc `find` pipeline typed into a shell. That command excluded four cache
directories **by name**. Any other ignored artefact a local run happened to leave behind - a
`.env`, a coverage file, a `.pytest_cache` entry, a new tool's cache - would have silently
changed the "immutable" hash. Two honest people could compute two different answers for the
same package, and neither would know why.

That mechanism is **superseded**. The canonical fingerprint is
`platform/scripts/package-fingerprint.sh`, which asks git what belongs to the package instead
of maintaining a deny list. The algorithm as implemented — see the portability section at the
end of this report for why it looks like this rather than like a one-line pipeline:

1. Enumerate with `git ls-files -co --exclude-standard -z` over the allowlist
   `.github docs platform README.md .gitignore`, then `LC_ALL=C sort -z`.
   `-c` tracked, `-o` untracked (this package is intentionally uncommitted),
   `--exclude-standard` honours `.gitignore`, so ignored artefacts can never contribute.
   `-z` / `sort -z` keep it NUL-delimited: a newline in a filename cannot forge an entry.
2. Select **one** hashing tool up front: `sha256sum` where it exists (Linux), otherwise
   `shasum -a 256` (macOS). If neither is present the script exits non-zero.
3. Hash each file's **content** by feeding it on stdin, so the tool never prints a filename,
   then keep only the digest and lowercase it. GNU and BSD agree on the digest and disagree
   about everything printed around it, so nothing around it is kept.
4. Emit one byte-stable record per file, `"<lowercase digest>  <relative path>\0"`, and hash
   that whole normalised stream to produce the aggregate.
5. Capture the aggregate in full before printing, and refuse to print anything that is not
   `[0-9a-f]{64}`.

It resolves the repository root itself, so it prints the same digest from any working
directory. `tests/architecture/test_package_fingerprint_script.py` asserts all of that,
including that an artefact dropped into `.pytest_cache` does not move the number.

**The resulting hash is deliberately not stored in this repository.** Every file in the
allowlist is hashed, so writing the answer into one of them would change the answer - the
claim would be self-referential and wrong the moment it was written. The canonical hash is
computed after the final edit and reported in the handoff.

## What the second reviewer found

| # | Finding | Why it mattered |
|---|---|---|
| MF-1 | `GRANT ... ON ALL TABLES` + `ALTER DEFAULT PRIVILEGES` gave the web role full DML | The role serving the internet could `UPDATE source_snapshots` - the evidence a decision cites - and would silently inherit DML on every future table |
| MF-2 | Documentation implied RLS was a general boundary | It is a second layer against *our own* forgotten `WHERE`. The app role sets `app.current_tenant` itself, so anyone running arbitrary SQL as that role can move the scope |
| m-1 | Lookup scopes stayed open on duplicate registration, failed login and invalid/expired authenticate | Transaction-local, so nothing escaped the request - but the rest of the transaction ran under a window it no longer needed |
| m-2 | The legacy guard listed the repository root only | A file added *inside* an existing route directory was invisible while the guard still reported "prototype unchanged" |
| m-3 | README claimed the AI layer had 25 tests; the suites collect 33 | Removed rather than re-pinned; a hard-coded count drifts again on the next test |
| MASTER | Runbook step 4 still used the one-URL smoke signature | A runbook that cannot be pasted into a shell is not a runbook |
| MASTER | Snapshot hash mechanism was ad hoc | See above |
| MASTER | Only two of four pinned action majors had recorded provenance | All four now recorded, with the moving-tag caveat stated |

## RED

```
$ cd platform
$ uv run --frozen pytest tests --no-header --tb=no -rf
48 failed, 263 passed, 68 skipped, 1 warning in 4.37s
```

**Exit code:** `1`

Representative failures, quoted from the run:

```
E   AssertionError: 01-app-role.sh still grants blanket default privileges
tests/architecture/test_deployment_contracts.py:243

E   AssertionError: assert 'scope.lookup...@ornek.com.tr' == 'scope.clear_lookups'
tests/unit/test_auth_scoping_and_timing.py:329

E   AssertionError: legacy files missing from the manifest: ['.git']
tests/architecture/test_legacy_prototype_unchanged.py:85
```

That third one is worth keeping. It is the *new recursive guard* failing on its first run,
because in a git **worktree** `.git` is a file rather than a directory and the first prune
missed it. The guard was fixed, not the assertion.

One test - `resolve_seed_url` - could only fail on import at first, which is not evidence, so
an inert stub returning the application URL was added and the behavioural RED captured against
that.

## GREEN

```
$ uv run --frozen ruff check .
All checks passed!

$ uv run --frozen ruff format --check .
76 files already formatted

$ uv run --frozen mypy
Success: no issues found in 71 source files

$ uv run --frozen pytest tests --no-header --tb=short -rN
315 passed, 68 skipped, 1 warning in 4.51s
```

**Exit codes:** `0`, `0`, `0`, `0`

Supporting checks, all exit 0:

```
$ docker compose --env-file .env.example -f compose.yaml config --quiet   # parses; does not run
$ bash -n scripts/container-smoke.sh
$ sh   -n scripts/db-init/01-app-role.sh
$ bash -n scripts/package-fingerprint.sh
$ git diff --check
```

Skips rose from 29 to 68: the new least-privilege assertions are PostgreSQL-only and heavily
parameterised. They are not silently skipped in CI - the guard fails the build on a skip and,
since the previous package, on a failure too.

## Runtime privileges, exactly

| Table | Application role holds |
|---|---|
| `tenants`, `users` | `SELECT, INSERT` |
| `user_sessions`, `company_profiles` | `SELECT, INSERT, UPDATE` |
| `decisions`, `approvals`, `audit_events` | `SELECT, INSERT` (append-only; the trigger is the second layer) |
| `source_snapshots`, `program_versions`, `rule_set_versions`, `schema_flags` | `SELECT` |
| `alembic_version` | nothing at all |
| any future table | nothing, until a migration says otherwise |

No table is granted `DELETE`. Role creation now grants `CONNECT` and `USAGE` and stops;
`ALTER DEFAULT PRIVILEGES` is gone from the role-init script and from both CI jobs.

A consequence worth stating: `scripts/seed.py` provisions the catalogue, and the application
role can no longer write it. Seeding now resolves `DESTEKTESVIK_MIGRATION_DATABASE_URL` first,
matching `migrations/env.py`. Without that, the first `docker compose --profile migrate up`
would have failed with "permission denied" - least privilege that breaks provisioning is not
least privilege, it is an outage.

## Determinism fingerprint — still unchanged

```
KOSGEB-GIRISIMCI  a05931221104117d162455d91be96aa3bc0dd4bbce005ed7f2566a70801a0f3a
TUBITAK-1501      071aa48141c4ce88e1bb436e336550519c4fc5beab1a8428d6b6bbf7e7bd77fe
TUBITAK-1507      a7cda1a793d0cfc34de5d3b86e1c4c550088e8fc25996c7624b863bd4a9cb06d
```

Byte-identical across all three packages.

## Environment gates — unchanged, still unexecuted

| Gate | Status |
|---|---|
| PostgreSQL RLS, least privilege, append-only triggers, migration | **UNVERIFIED** — no PostgreSQL on this host; 68 tests written and skipped with reasons |
| `docker buildx` build and container smoke | **UNVERIFIED** — Docker daemon unreachable; re-checked at the end of this session |
| `docker compose` up, including the hardened role-init | **UNVERIFIED** — same reason. `compose config` parses, which is not the same as running |
| GitHub Actions workflow | **UNVERIFIED** — nothing pushed; the workflow has never executed |
| AMD **and** Intel Hetzner same-digest smoke | **UNVERIFIED** — no hosts provided |
| Real AI provider call | **NOT RUN, BY DESIGN** |

Nothing above was simulated, and no substitute evidence is offered for any of it.

---

# Portability fixes — third independent review (RED → GREEN)

An independent read-only reviewer read the package and returned **CONDITIONAL** with two
must-fixes and one test-hardening item. Both must-fixes were real, and the first one was worse
in practice than the review described.

## YF-1 — the "canonical" fingerprint was not canonical

The script defined a `sha256()` shell function and then wrote `xargs -0 sha256`. `xargs`
executes a **program**; it cannot see a shell function. What actually ran, measured on the
authoring host:

```
$ /sbin/sha256 README.md
SHA256 (README.md) = afd7aaef02562c07901cff60a998ab9f98f411f3e90eda5acc4a8dd67c963ed4

$ shasum -a 256 README.md
afd7aaef02562c07901cff60a998ab9f98f411f3e90eda5acc4a8dd67c963ed4  README.md
```

So the per-file stage ran BSD `/sbin/sha256` with a completely different output format, while
the final stage — a plain command, not under `xargs` — did resolve the function and ran
`shasum`. The aggregate was therefore macOS-specific. On Linux, where `/sbin/sha256` does not
exist, the same script produces something else entirely.

Worse, on a clean PATH:

```
$ env PATH=/usr/bin:/bin bash platform/scripts/package-fingerprint.sh
xargs: sha256: No such file or directory
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
exit=127

$ printf '' | shasum -a 256
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  -
```

That is the SHA-256 of **nothing**, printed on stdout, looking exactly like a real answer.
Anyone capturing stdout — a reviewer, a script, a future CI step — would have recorded a
confident wrong number. The non-zero exit code is the only thing that gave it away, and only
if someone checked.

**The previously reported `5e59d640826f06923e2a737c6ef6ca68fea6b9a0e4792e87fa7f851760b4b64d`
is therefore superseded**: it was produced by a platform-dependent algorithm and is not
reproducible on Linux. It is recorded here as history, not as a claim.

The corrected algorithm is documented in full in the fingerprint section above.

## YF-2 — the web container held the schema owner's credentials

`compose.yaml` passed `DESTEKTESVIK_MIGRATION_DATABASE_URL` to the **web** service. The
application never reads it — `create_app()` uses `DESTEKTESVIK_DATABASE_URL` only — so this was
not a functional bug. It was a credential one: the owner password sat in the environment of the
single process exposed to the network, readable from `/proc/self/environ`, a crash dump or any
accidental environment echo. Two database roles only help if compromising the web tier does not
hand over the other one. Removed from `web`, kept on `migrate`, which is the service that
actually migrates.

## RED

```
$ cd platform
$ uv run --frozen pytest tests/architecture/test_package_fingerprint_script.py \
    tests/architecture/test_deployment_contracts.py --no-header --tb=no -rf
14 failed, 54 passed in 0.58s
```

**Exit code:** `1`. Quoted from the run:

```
E   subprocess.CalledProcessError: Command '[... package-fingerprint.sh]'
      returned non-zero exit status 127.          # clean-PATH runs, three of them

E   AssertionError: assert 'DESTEKTESVIK_MIGRATION_DATABASE_URL' not in
      {'DESTEKTESVIK_DATABASE_URL': ..., 'DESTEKTESVIK_MIGRATION_DATABASE_URL': ...}

E   AssertionError: web.DESTEKTESVIK_MIGRATION_DATABASE_URL interpolates the migration URL:
      ${DESTEKTESVIK_MIGRATION_DATABASE_URL:?set it in .env}
```

The remaining failures were the structural contracts: no bare `sha256` token, no `xargs`
hashing stage, NUL-terminated per-file records, lowercase-normalised digests, a `[0-9a-f]{64}`
gate before printing, and the evidence description matching the implemented mechanism.

One RED was a flaw in the new test rather than in the script: with `PATH=/var/empty` the test
runner could not find `bash` itself, so the assertion never reached the script. The helper now
resolves the interpreter absolutely and the restricted PATH exercises the script's own tool
lookup.

## GREEN

```
$ bash -n scripts/package-fingerprint.sh                     # exit 0

$ bash scripts/package-fingerprint.sh                        # repo root
$ (cd platform  && bash scripts/package-fingerprint.sh)
$ (cd platform/scripts && bash package-fingerprint.sh)
$ env PATH=/usr/bin:/bin bash scripts/package-fingerprint.sh # clean PATH
  -> all five runs identical

$ env PATH=/var/empty-no-such-directory /bin/bash scripts/package-fingerprint.sh
  exit=127   stdout=[]        # fails loudly, prints no digest at all

$ docker compose --env-file .env.example -f compose.yaml config --quiet   # exit 0, parse only
```

The current fingerprint is **not recorded here**: every file in the allowlist is hashed, so
writing the answer into this report would change the answer. It is computed after the final
edit and reported in the handoff.

## Environment gates — unchanged

PostgreSQL, Docker (daemon unreachable), GitHub Actions and the Hetzner AMD/Intel comparison all
remain **UNVERIFIED**. `docker compose config` parses the file; it does not start anything.
Nothing in this cycle was simulated.
