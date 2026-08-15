#!/usr/bin/env node
/**
 * The full acceptance gate: one command, seven concerns, one exit code.
 *
 * `pnpm gate` runs lint, type check, the unit/component/guard suite with its
 * coverage thresholds, the production build with its artifact guards, the
 * Storybook build and the browser suite - in that order, stopping at the first
 * failure. A healthy tree exits 0. Nothing else in this package composes those
 * steps, and `src/test/full-gate-contract.test.ts` fails if something starts to.
 *
 * Why a file rather than a chain of `&&` in package.json:
 *
 *   - **it can be asserted on.** A shell string is only checkable as a string;
 *     `--print-plan` emits the plan as JSON, so the contract test checks what
 *     will actually run rather than what a regex thinks it read.
 *   - **it can tell two reds apart.** A missing browser or a missing
 *     `node_modules` is not a defect in the code under test. Those exit 3 with
 *     the command that fixes them; a real failure exits 1. A CI log that
 *     conflates the two sends people to debug the wrong tree.
 *   - **it can be sliced without being duplicated.** `--only=` lets Frontend
 *     CI run the quality steps and the browser step as two parallel jobs while
 *     both consume *these* definitions. The workflow holds no second copy of
 *     the gate, and the contract test checks that the two jobs' selections
 *     cover every concern exactly once.
 *
 * What the gate deliberately does NOT do:
 *
 *   - **install anything.** Dependencies and the Playwright browser are
 *     prerequisites, not gate steps: a gate that installs its own environment
 *     hides how long it really takes and what it really needs. `pnpm install`
 *     and `pnpm e2e:install` are named in the error, and CI installs the
 *     browser in its own step.
 *   - **run the Pages publication suite.** `playwright.pages.config.ts` gates
 *     a different artifact (`dist-pages`, built for the published base) and is
 *     owned by `.github/workflows/pages.yml`, which builds it once and serves
 *     those exact bytes. Pulling it in here would add a second build to every
 *     local run for an artifact this gate never publishes.
 *
 * Duplication is the thing this file is most careful about. `pnpm build` is
 * `tsc && vite build && the artifact guards`, so calling it after the type
 * check step would compile twice; the gate runs the build's own two commands
 * instead, and the contract test pins the type-check step plus the build step
 * to be exactly the `build` script so the two cannot drift. For the same
 * reason the browser step sets `DT_GATE_PREBUILT=1`: `pnpm e2e` builds its own
 * bundle on purpose when run alone, and `playwright.config.ts` skips that
 * build when the gate has just produced the same bytes.
 *
 * Flags:
 *   --print-plan                 print the selected plan as JSON and exit
 *   --dry-run                    print the steps without executing them
 *   --only=a,b,c                 run only the named concerns (all or nothing
 *                                per step, so a step can never half-run)
 *   --simulate-failure=<id>      dry-run only; makes that step "fail"
 *   --simulate-missing=<what>    dry-run only; browser | dependencies
 *
 * The two `--simulate-*` flags exist for `full-gate-contract.test.ts`: a
 * fail-fast claim no test can make fail is not a claim. They are refused
 * outside `--dry-run`, so they cannot mask a real run.
 *
 * Exit codes: 0 pass, 1 a step failed, 2 the invocation was wrong,
 * 3 an environment prerequisite is missing.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Runs from anywhere: the gate belongs to the package, not to a cwd. */
const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const EXIT_OK = 0;
const EXIT_FAILED = 1;
const EXIT_USAGE = 2;
const EXIT_PREREQUISITE = 3;

/**
 * The two artifact guards, named exactly rather than globbed.
 *
 * `build-contract.test.ts` explains why they run after `vite build` and not
 * before: they return early when `dist/` is absent, so run first they abstain
 * and report green about an artifact that does not exist yet.
 */
const ARTIFACT_GUARDS = [
  "src/test/build-contract.test.ts",
  "src/test/no-mock-artifacts.test.ts",
];

/**
 * The gate, in the order it should spend money.
 *
 * Lint and types are seconds and catch most of a bad push; the browser suite
 * is minutes and needs a build first. `concerns` is what the roadmap named;
 * `id` is what a person types into `--only`. The suite step carries two
 * concerns because one `vitest run --coverage` settles both - running the
 * suite again to "do coverage" would be the duplication this gate refuses.
 */
const STEPS = [
  {
    id: "lint",
    concerns: ["lint"],
    title: "ESLint",
    commands: [["pnpm", "exec", "eslint", "."]],
  },
  {
    id: "typecheck",
    concerns: ["typecheck"],
    title: "TypeScript",
    commands: [["pnpm", "exec", "tsc", "-b", "--noEmit"]],
  },
  {
    id: "test",
    concerns: ["test", "coverage"],
    title: "Vitest + kapsam eşikleri",
    commands: [["pnpm", "exec", "vitest", "run", "--coverage"]],
  },
  {
    id: "build",
    concerns: ["build"],
    title: "Üretim derlemesi + artefakt muhafızları",
    commands: [
      ["pnpm", "exec", "vite", "build"],
      ["pnpm", "exec", "vitest", "run", ...ARTIFACT_GUARDS],
    ],
  },
  {
    id: "storybook",
    concerns: ["storybook"],
    title: "Storybook derlemesi",
    commands: [["pnpm", "exec", "storybook", "build"]],
  },
  {
    id: "e2e",
    concerns: ["e2e"],
    title: "Playwright (mock backend)",
    commands: [["pnpm", "exec", "playwright", "test"]],
    // Asserted only when this invocation also built the bundle, and cleared
    // otherwise; see `stepEnvironment`.
    env: { DT_GATE_PREBUILT: "1" },
    needsBrowser: true,
  },
];

/**
 * The environment a step's commands run in, and what was taken away from it.
 *
 * `DT_GATE_PREBUILT` is a claim about *this* invocation - "the bundle you are
 * about to serve was produced by the step before you" - and Playwright acts on
 * it by skipping its own build. A claim that is merely *set* when the gate
 * builds is not enough: an inherited one is just as convincing to the child,
 * so `DT_GATE_PREBUILT=1 pnpm gate --only=e2e`, or a CI runner that exported it
 * for an earlier job, would have the browser suite pass against a stale `dist/`.
 * A stale bundle passing 314 tests is precisely the unearned green this package
 * exists to prevent.
 *
 * So every step's variables are *cleared first and re-asserted second*, and
 * only a run that selected the build step may re-assert them. The returned
 * `unset` list is what the runner prints and what `--print-plan` publishes, so
 * the removal is visible evidence rather than a promise in a comment.
 */
function stepEnvironment(step, builtInThisRun) {
  const declared = step.env ?? {};
  const set = builtInThisRun ? declared : {};
  const unset = Object.keys(declared).filter((key) => !(key in set));
  return { set, unset };
}

/** The very object handed to `spawnSync`, built from the delta above. */
function childEnvironment(step, builtInThisRun) {
  const { set, unset } = stepEnvironment(step, builtInThisRun);
  const environment = { ...process.env };
  for (const key of unset) delete environment[key];
  return { ...environment, ...set };
}

function fail(message, code) {
  process.stderr.write(`full-gate: ${message}\n`);
  process.exit(code);
}

function parseArguments(argv) {
  const options = {
    printPlan: false,
    dryRun: false,
    only: null,
    simulateFailure: null,
    simulateMissing: null,
  };
  for (const argument of argv) {
    if (argument === "--print-plan") options.printPlan = true;
    else if (argument === "--dry-run") options.dryRun = true;
    else if (argument.startsWith("--only=")) {
      options.only = argument.slice("--only=".length).split(",").filter(Boolean);
    } else if (argument.startsWith("--simulate-failure=")) {
      options.simulateFailure = argument.slice("--simulate-failure=".length);
    } else if (argument.startsWith("--simulate-missing=")) {
      options.simulateMissing = argument.slice("--simulate-missing=".length);
    } else fail(`bilinmeyen argüman: ${argument}`, EXIT_USAGE);
  }
  if ((options.simulateFailure || options.simulateMissing) && !options.dryRun) {
    fail("--simulate-* yalnızca --dry-run ile kullanılabilir", EXIT_USAGE);
  }
  return options;
}

/**
 * Steps whose concerns were asked for - all of a step's concerns or none.
 *
 * `--only=test` without `coverage` would run the suite and report the step
 * green while the thresholds never applied, which is exactly the shape of
 * unearned green this gate exists to prevent. So a partial selection is a
 * usage error rather than a smaller gate.
 */
function selectSteps(only) {
  if (!only) return STEPS;

  const known = new Set(STEPS.flatMap((step) => step.concerns));
  const unknown = only.filter((concern) => !known.has(concern));
  if (unknown.length > 0) fail(`bilinmeyen kapı adımı: ${unknown.join(", ")}`, EXIT_USAGE);

  const wanted = new Set(only);
  const selected = [];
  for (const step of STEPS) {
    const asked = step.concerns.filter((concern) => wanted.has(concern));
    if (asked.length === 0) continue;
    if (asked.length !== step.concerns.length) {
      fail(
        `\`${step.id}\` adımı bölünemez; ${step.concerns.join(" + ")} birlikte seçilmeli`,
        EXIT_USAGE,
      );
    }
    selected.push(step);
  }
  if (selected.length === 0) fail("seçim boş", EXIT_USAGE);
  return selected;
}

/**
 * The environment the selected steps need, checked before any of them runs.
 *
 * Up front rather than lazily: finding out after eight minutes of build and
 * Storybook that no browser was ever installed wastes the eight minutes.
 */
async function checkPrerequisites(steps, options) {
  const { dryRun, simulateMissing } = options;
  // A dry run executes nothing, so it needs nothing installed. Checking anyway
  // would make `--dry-run` - the one mode the contract test can afford to call -
  // depend on whether a browser happens to be on the machine running it.
  if (dryRun && !simulateMissing) return;

  if (simulateMissing === "dependencies" || !existsSync(join(PACKAGE_ROOT, "node_modules"))) {
    fail("bağımlılıklar kurulu değil; önce `pnpm install --frozen-lockfile`", EXIT_PREREQUISITE);
  }
  if (!steps.some((step) => step.needsBrowser)) return;

  if (simulateMissing === "browser") {
    fail("Playwright tarayıcısı yok; önce `pnpm e2e:install`", EXIT_PREREQUISITE);
  }
  if (simulateMissing) return;

  let executable = "";
  try {
    const { chromium } = await import("@playwright/test");
    executable = chromium.executablePath();
  } catch {
    executable = "";
  }
  if (!executable || !existsSync(executable)) {
    fail("Playwright tarayıcısı yok; önce `pnpm e2e:install`", EXIT_PREREQUISITE);
  }
}

function runStep(step, options, builtInThisRun) {
  const label = `${step.id} (${step.concerns.join(", ")}) — ${step.title}`;
  process.stdout.write(`\n▶ ${label}\n`);

  // Computed once, printed, then handed to the child unchanged: what the log
  // says about the environment is the environment.
  const { set, unset } = stepEnvironment(step, builtInThisRun);
  const environment = childEnvironment(step, builtInThisRun);
  for (const [key, value] of Object.entries(set)) {
    process.stdout.write(`  env ${key}=${value}\n`);
  }
  for (const key of unset) {
    process.stdout.write(`  env ${key} kaldırıldı (bu koşu derlemedi)\n`);
  }

  for (const command of step.commands) {
    process.stdout.write(`  $ ${command.join(" ")}\n`);
    if (options.dryRun) continue;

    const [program, ...rest] = command;
    const result = spawnSync(program, rest, {
      cwd: PACKAGE_ROOT,
      stdio: "inherit",
      env: environment,
    });
    if (result.status !== 0) return false;
  }
  if (options.dryRun && options.simulateFailure === step.id) return false;
  return true;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const steps = selectSteps(options.only);

  // A property of this invocation, not of the machine: whether *these* steps
  // include the one that produces `dist/`.
  const builtInThisRun = steps.some((step) => step.id === "build");

  if (options.printPlan) {
    process.stdout.write(
      `${JSON.stringify(
        {
          steps: steps.map((step) => {
            const { set, unset } = stepEnvironment(step, builtInThisRun);
            return {
              id: step.id,
              concerns: step.concerns,
              commands: step.commands,
              // The effective environment for *this* selection, so a plan can
              // never advertise a prebuilt bundle a plan-less run would not get.
              ...(Object.keys(set).length > 0 ? { env: set } : {}),
              ...(unset.length > 0 ? { unsetEnv: unset } : {}),
            };
          }),
        },
        null,
        2,
      )}\n`,
    );
    return EXIT_OK;
  }

  await checkPrerequisites(steps, options);

  const started = Date.now();

  for (const step of steps) {
    if (!runStep(step, options, builtInThisRun)) {
      process.stdout.write(`\n✖ kapı kırmızı: ${step.id}\n`);
      return EXIT_FAILED;
    }
  }

  const seconds = Math.round((Date.now() - started) / 1000);
  process.stdout.write(
    `\n✔ kapı yeşil${options.dryRun ? " (dry-run)" : ""} — ${steps.length} adım, ${seconds} sn\n`,
  );
  return EXIT_OK;
}

process.exit(await main());
