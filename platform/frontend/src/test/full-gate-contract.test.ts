/**
 * The full acceptance gate, pinned as a contract rather than as a habit.
 *
 * V2-P0-02 asks for one command that runs lint, type check, tests, coverage,
 * build, Storybook build and the browser suite, and exits 0 when the tree is
 * healthy. The cheap way to "pass" that is a script whose name says `gate` and
 * whose body is whatever the last person needed; the expensive failure is a
 * gate that quietly stops covering one of the seven, or that covers them twice.
 *
 * So this file asserts three separable things, and deliberately not the same
 * one three times:
 *
 *   1. **Coverage.** The plan the runner would execute carries all seven
 *      concerns, in an order that fails cheap before it fails expensive.
 *   2. **Non-duplication.** Nothing in the plan does work another step already
 *      did: the compiler runs once, `vite build` runs once, the artifact
 *      guards run once, and the browser suite serves the build the gate has
 *      already produced instead of building a third one.
 *   3. **Behaviour.** The runner really is fail-fast, and it really does
 *      separate a missing environment prerequisite from a failed assertion -
 *      proved by running it, not by reading its comments.
 *
 * The behavioural groups spawn `scripts/full-gate.mjs` with `--dry-run`, so a
 * test of the gate never runs the gate's own multi-minute steps. `--dry-run`
 * with `--simulate-failure` / `--simulate-missing` exists for exactly these
 * assertions and is named so in the runner's header: a fail-fast claim that no
 * test can make fail is not a claim.
 *
 * What this file cannot prove, said plainly so a green run is not over-read:
 * that `pnpm gate` passes. It proves the gate is defined, complete, singular
 * and fail-fast. The run itself is the evidence, and it is the MASTER's to
 * collect.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const REPO_ROOT = resolve(ROOT, "..", "..");
const RUNNER_RELATIVE = "scripts/full-gate.mjs";
const RUNNER = join(ROOT, RUNNER_RELATIVE);
const WORKFLOW = join(REPO_ROOT, ".github", "workflows", "frontend-ci.yml");

/**
 * The seven concerns, in the order a gate should spend money in.
 *
 * Lint and types are seconds and catch the majority of a bad push; the browser
 * suite is minutes and needs a build first. An order that runs Playwright
 * before ESLint is not wrong in what it proves, it is wrong in what it costs.
 */
const CONCERNS = [
  "lint",
  "typecheck",
  "test",
  "coverage",
  "build",
  "storybook",
  "e2e",
] as const;

/** The two artifact guards the build must run against the `dist/` it made. */
const ARTIFACT_GUARD_FILES = [
  "src/test/build-contract.test.ts",
  "src/test/no-mock-artifacts.test.ts",
] as const;

type Step = {
  readonly id: string;
  readonly concerns: readonly string[];
  readonly commands: readonly (readonly string[])[];
  /** Variables this step's commands receive, for this selection. */
  readonly env?: Readonly<Record<string, string>>;
  /** Variables cleared from the inherited environment before they run. */
  readonly unsetEnv?: readonly string[];
};

type Plan = { readonly steps: readonly Step[] };

function manifest(): { scripts: Record<string, string> } {
  return JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
    scripts: Record<string, string>;
  };
}

/** Run the runner. Never without `--dry-run` from a test. */
function runGate(args: readonly string[], callerEnv: Record<string, string> = {}) {
  return spawnSync(process.execPath, [RUNNER, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, ...callerEnv },
  });
}

function plan(args: readonly string[] = [], callerEnv: Record<string, string> = {}): Plan {
  const result = runGate(["--print-plan", ...args], callerEnv);
  expect(result.status, `--print-plan başarısız: ${result.stderr}`).toBe(0);
  return JSON.parse(result.stdout) as Plan;
}

/** Every command of every step, flattened to strings, in execution order. */
function commandLines(steps: readonly Step[]): string[] {
  return steps.flatMap((step) => step.commands.map((command) => command.join(" ")));
}

describe("there is exactly one entry point", () => {
  it("package.json exposes `gate`, and it runs the committed runner", () => {
    const gate = manifest().scripts["gate"] ?? "";
    expect(gate, "package.json'da `gate` betiği yok").not.toBe("");
    expect(gate).toContain(RUNNER_RELATIVE);
  });

  it("the runner is a committed file, not an inline shell chain", () => {
    expect(
      existsSync(RUNNER),
      `${RUNNER_RELATIVE} yok; kapı tek bir dosyada tanımlı değil`,
    ).toBe(true);
  });

  it("no rival script chains the same gate", () => {
    // A second near-complete chain is how a gate drifts: one of them gets a
    // step added and the other keeps reporting green without it.
    const MARKERS = ["eslint", "tsc", "vite build", "storybook build", "playwright test"];
    const rivals = Object.entries(manifest().scripts)
      .filter(([name]) => name !== "gate")
      .filter(([, body]) => MARKERS.filter((marker) => body.includes(marker)).length >= 4)
      .map(([name]) => name);
    expect(rivals).toEqual([]);
  });
});

describe("the plan covers all seven concerns, cheapest first", () => {
  const steps = plan().steps;

  it("carries every concern exactly once, in order", () => {
    expect(steps.flatMap((step) => step.concerns)).toEqual([...CONCERNS]);
  });

  it("gives every step at least one real command", () => {
    for (const step of steps) {
      expect(step.commands.length, `${step.id} adımı komutsuz`).toBeGreaterThan(0);
      for (const command of step.commands) expect(command.length).toBeGreaterThan(0);
    }
  });

  it("runs the tools the concerns name", () => {
    const byConcern = (concern: string) =>
      commandLines(steps.filter((step) => step.concerns.includes(concern))).join(" ; ");

    expect(byConcern("lint")).toContain("eslint");
    expect(byConcern("typecheck")).toMatch(/tsc\b.*--noEmit/u);
    expect(byConcern("test")).toContain("vitest");
    expect(byConcern("coverage")).toContain("--coverage");
    expect(byConcern("build")).toContain("vite build");
    expect(byConcern("storybook")).toContain("storybook build");
    expect(byConcern("e2e")).toContain("playwright test");
  });

  it("checks the artifact it just built, in the build step", () => {
    const build = steps.find((step) => step.concerns.includes("build"));
    const lines = commandLines(build ? [build] : []);
    const built = lines.findIndex((line) => line.includes("vite build"));
    const guarded = lines.findIndex((line) =>
      ARTIFACT_GUARD_FILES.every((file) => line.includes(file)),
    );
    expect(built).toBeGreaterThanOrEqual(0);
    expect(guarded).toBeGreaterThan(built);
  });

  it("runs the browser suite against the application config, not the Pages one", () => {
    const e2e = commandLines(steps.filter((step) => step.concerns.includes("e2e"))).join(" ");
    expect(e2e).not.toContain("playwright.pages.config.ts");
  });
});

describe("the plan does no work twice", () => {
  const lines = commandLines(plan().steps);

  it("type checks once", () => {
    expect(lines.filter((line) => line.includes("tsc "))).toHaveLength(1);
  });

  it("builds the application bundle once", () => {
    expect(lines.filter((line) => line.includes("vite build"))).toHaveLength(1);
  });

  it("runs the suite once and the artifact guards once", () => {
    expect(lines.filter((line) => line.includes("--coverage"))).toHaveLength(1);
    expect(
      lines.filter((line) => line.includes(ARTIFACT_GUARD_FILES[0])),
    ).toHaveLength(1);
  });

  it("tells Playwright the bundle already exists", () => {
    // Without this the browser step builds a *third* bundle: `pnpm e2e` is
    // self-contained on purpose, and self-contained is waste inside a chain
    // whose previous step just produced the same bytes.
    const e2e = plan().steps.find((step) => step.concerns.includes("e2e"));
    expect(e2e?.env?.["DT_GATE_PREBUILT"]).toBe("1");
  });

  it("and Playwright honours it by serving instead of rebuilding", () => {
    const config = readFileSync(join(ROOT, "playwright.config.ts"), "utf8");
    expect(config).toContain("DT_GATE_PREBUILT");
    const tail = config.slice(config.indexOf("DT_GATE_PREBUILT"));
    expect(tail.indexOf("vite preview")).toBeGreaterThanOrEqual(0);
    expect(tail.indexOf("vite preview")).toBeLessThan(tail.indexOf("vite build"));
  });

  it("keeps `pnpm build` and the gate from drifting apart", () => {
    // The gate does not call `pnpm build`, because that would type check a
    // second time. The price of skipping it is drift, so the two definitions
    // are pinned to each other here: type check + build step *is* the build
    // script, spelled the same way.
    const steps = plan().steps;
    const typecheck = steps.filter((step) => step.concerns.includes("typecheck"));
    const build = steps.filter((step) => step.concerns.includes("build"));
    const composed = commandLines([...typecheck, ...build])
      .map((line) => line.replace(/^pnpm exec /u, ""))
      .join(" && ");
    expect(manifest().scripts["build"]).toBe(composed);
  });
});

/**
 * `DT_GATE_PREBUILT` is a claim about *this* invocation: "the bundle the
 * browser step is about to serve was produced minutes ago, by the step before
 * it". Playwright acts on that claim by skipping its own build.
 *
 * So the claim has to be unforgeable from outside. A variable that is merely
 * *set* when the gate builds, but inherited when it does not, is a claim
 * anybody's shell can make: `DT_GATE_PREBUILT=1 pnpm gate --only=e2e` - or a CI
 * runner that exported it once for an earlier job - would have Playwright serve
 * whatever `dist/` happened to be lying around, and a stale bundle passing 314
 * tests is exactly the unearned green this package exists to prevent.
 *
 * The assertions below are about the environment the runner *computes*, which
 * is the same object it hands to `spawnSync`, printed by `--print-plan` and by
 * `--dry-run`. They are deliberately not a regex over the runner's comments.
 */
describe("the prebuilt claim cannot be spoofed by the caller", () => {
  const PREBUILT = "DT_GATE_PREBUILT";

  it("is made when this run also builds", () => {
    const e2e = plan().steps.find((step) => step.id === "e2e");
    expect(e2e?.env?.[PREBUILT]).toBe("1");
    expect(e2e?.unsetEnv ?? []).not.toContain(PREBUILT);
  });

  it("is not made when only the browser step was selected", () => {
    // CI's browser job. It did not build, so Playwright must build for itself,
    // exactly as a bare `pnpm e2e` does.
    const e2e = plan(["--only=e2e"]).steps.find((step) => step.id === "e2e");
    expect(e2e?.env?.[PREBUILT]).toBeUndefined();
  });

  it("is cleared, not merely left unset, when this run does not build", () => {
    // The difference is the whole finding: "not set by me" still inherits.
    const e2e = plan(["--only=e2e"]).steps.find((step) => step.id === "e2e");
    expect(e2e?.unsetEnv ?? []).toContain(PREBUILT);
  });

  it("ignores a caller that exported the variable itself", () => {
    const spoofed = plan(["--only=e2e"], { [PREBUILT]: "1" });
    const e2e = spoofed.steps.find((step) => step.id === "e2e");
    expect(e2e?.env?.[PREBUILT]).toBeUndefined();
    expect(e2e?.unsetEnv ?? []).toContain(PREBUILT);
  });

  it("reports the child environment it will really pass", () => {
    // `--dry-run` prints the environment computed for each step - the same
    // object the real run gives `spawnSync` - so this is a behavioural check
    // on the run, not a reading of the source.
    const spoofed = runGate(["--dry-run", "--only=e2e"], { [PREBUILT]: "1" });
    expect(spoofed.status, spoofed.stderr).toBe(0);
    expect(spoofed.stdout).toContain(`${PREBUILT} kaldırıldı`);
    expect(spoofed.stdout).not.toContain(`${PREBUILT}=1`);

    const whole = runGate(["--dry-run"], { [PREBUILT]: "1" });
    expect(whole.status, whole.stderr).toBe(0);
    expect(whole.stdout).toContain(`${PREBUILT}=1`);
  });
});

describe("the runner stops at the first failure", () => {
  it("lists all seven steps when nothing fails", () => {
    const result = runGate(["--dry-run"]);
    expect(result.status, result.stderr).toBe(0);
    for (const concern of CONCERNS) expect(result.stdout).toContain(concern);
  });

  it("does not reach later steps once a step fails", () => {
    const result = runGate(["--dry-run", "--simulate-failure=test"]);
    expect(result.status).toBe(1);
    const ran = result.stdout;
    expect(ran).toContain("lint");
    expect(ran).toContain("typecheck");
    expect(ran).toContain("test");
    expect(ran).not.toContain("storybook");
    expect(ran).not.toContain("e2e");
  });
});

describe("a missing prerequisite is not a failed assertion", () => {
  it("reports the browser prerequisite with its own exit code and a fix", () => {
    const result = runGate(["--dry-run", "--simulate-missing=browser"]);
    expect(result.status).toBe(3);
    expect(`${result.stdout}${result.stderr}`).toContain("e2e:install");
  });

  it("reports missing dependencies the same way", () => {
    const result = runGate(["--dry-run", "--simulate-missing=dependencies"]);
    expect(result.status).toBe(3);
    expect(`${result.stdout}${result.stderr}`).toContain("pnpm install");
  });

  it("uses a different exit code from an assertion failure", () => {
    // Both are red. Only one of them means "your code is wrong", and a CI log
    // that cannot tell them apart sends people to debug the wrong tree.
    const missing = runGate(["--dry-run", "--simulate-missing=browser"]).status;
    const failed = runGate(["--dry-run", "--simulate-failure=lint"]).status;
    expect(missing).not.toBe(failed);
    expect(failed).toBe(1);
  });

  it("refuses a partial selection rather than silently dropping a concern", () => {
    // `--only=test` without `coverage` would run the suite and report a gate
    // step green while the thresholds never applied.
    const result = runGate(["--dry-run", "--only=test"]);
    expect(result.status).toBe(2);
  });
});

describe("Frontend CI consumes this gate rather than a copy of it", () => {
  const workflow = (): string => {
    expect(existsSync(WORKFLOW), ".github/workflows/frontend-ci.yml yok").toBe(true);
    return readFileSync(WORKFLOW, "utf8");
  };

  /** The `--only=` selections the workflow asks the runner for. */
  const selections = (): string[][] =>
    [...workflow().matchAll(/pnpm (?:run )?gate --only=([\w,]+)/gu)].map((match) =>
      (match[1] as string).split(","),
    );

  it("invokes the runner at all", () => {
    expect(selections().length).toBeGreaterThan(0);
  });

  it("selects every concern exactly once across its jobs", () => {
    // Two jobs are allowed - the browser suite is slow and deserves its own
    // runner - but the union has to be the whole gate and the intersection has
    // to be empty, or CI is either weaker than the gate or paying twice.
    const selected = selections().flat();
    expect([...selected].sort()).toEqual([...CONCERNS].sort());
  });

  it("does not bypass the runner with a hand-rolled step", () => {
    const commands = workflow()
      .split("\n")
      .filter((line) => /^\s*(run:|-\s*run:)/u.test(line))
      .join("\n");
    for (const bypass of ["pnpm lint", "pnpm typecheck", "pnpm test", "pnpm build", "pnpm storybook:build"]) {
      expect(commands, `${bypass} kapıyı atlıyor`).not.toContain(bypass);
    }
  });

  it("installs the browser outside the gate, because installing is not a gate", () => {
    expect(workflow()).toContain("playwright install --with-deps chromium");
  });
});
