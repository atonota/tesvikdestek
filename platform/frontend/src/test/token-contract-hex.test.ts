/**
 * P1C token contract, part 1: no raw hex colour in `.tsx` source, no
 * exception.
 *
 * A prior version of this rule let a hex literal through when it was the
 * fallback argument of a `token("--dt-color-x", "#hex")` read - the shape
 * `EChart.tsx` used because a `<canvas>` cannot read a CSS custom property
 * before draw time. That exception was removed: a fallback that repeats a
 * token's value by hand is still a hex literal spelled in `.tsx` source, and
 * `EChart.tsx` now throws a named error instead of guessing when a token is
 * missing (`EChart.test.tsx` proves that half). So this file proves the
 * unconditional rule, two layers deep:
 *
 *  1. `RuleTester` proves the rule itself flags every hex literal, including
 *     the exact shape the old exception used to let through.
 *  2. Running the real rule, through the real flat config, against every
 *     `.tsx` file actually in `src/` proves the gate is GREEN on this
 *     package today - not just in a fixture.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { ESLint, RuleTester } from "eslint";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import rule from "../../eslint-rules/no-raw-hex-color.mjs";

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ROOT = process.cwd();

describe("no-raw-hex-color (rule unit tests)", () => {
  const tester = new RuleTester({
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  });

  tester.run("no-raw-hex-color", rule, {
    valid: [
      // Reads a token; no literal colour anywhere.
      "const el = <div style={{ color: 'var(--dt-color-fg)' }} />;",
      // A short string that merely starts with "#" but is not a hex triplet.
      "const anchor = '#top';",
    ],
    invalid: [
      {
        code: "const el = <div style={{ color: '#123abc' }} />;",
        errors: [{ messageId: "noHex" }],
      },
      {
        code: "const bg = '#fff';",
        errors: [{ messageId: "noHex" }],
      },
      {
        code: "const bg = '#ffffffaa';",
        errors: [{ messageId: "noHex" }],
      },
      {
        code: 'const bg = pick("background", "#fff");',
        errors: [{ messageId: "noHex" }],
      },
      {
        // The shape the old exception used to let through - a fallback
        // argument mirroring a named CSS custom property. No longer valid:
        // `EChart.tsx` no longer needs it and no other caller earns it.
        code: 'const fg = token("--dt-color-fg", "#14181f");',
        errors: [{ messageId: "noHex" }],
      },
      {
        code: 'const bg = token("brand", "#123a6b");',
        errors: [{ messageId: "noHex" }],
      },
      {
        code: "const css = `background: #ffffff;`;",
        errors: [{ messageId: "noHex" }],
      },
    ],
  });
});

describe("no-raw-hex-color (repo-wide gate)", () => {
  const originalCwd = process.cwd();

  beforeAll(() => {
    process.chdir(join(ROOT));
  });

  afterAll(() => {
    process.chdir(originalCwd);
  });

  const tsxFiles = (): string[] => {
    const found: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules") continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith(".tsx")) found.push(full);
      }
    };
    walk(join(ROOT, "src"));
    return found;
  };

  it("finds .tsx source to actually check", () => {
    expect(tsxFiles().length).toBeGreaterThan(10);
  });

  it("the real flat config wires the rule to .tsx files", () => {
    const config = readFileSync(join(ROOT, "eslint.config.js"), "utf8");
    expect(config).toMatch(/no-raw-hex-color/u);
  });

  it("every .tsx file in src/ is clean under the real ESLint config", async () => {
    const eslint = new ESLint({ cwd: ROOT });
    const results = await eslint.lintFiles(tsxFiles());
    const hexMessages = results.flatMap((result) =>
      result.messages
        .filter((message) => message.ruleId === "local/no-raw-hex-color")
        .map((message) => `${result.filePath}:${message.line} ${message.message}`),
    );
    expect(hexMessages).toEqual([]);
  }, 30_000);

  it("the gate is not decorative: it still catches a hex literal when one exists", async () => {
    const eslint = new ESLint({ cwd: ROOT });
    const [result] = await eslint.lintText(
      "export const Bad = () => <div style={{ color: '#ff00ff' }} />;\n",
      { filePath: join(ROOT, "src", "__hex_probe__.tsx") },
    );
    const hexMessages = result?.messages.filter(
      (message) => message.ruleId === "local/no-raw-hex-color",
    );
    expect(hexMessages?.length).toBe(1);
  });
});
