/**
 * Architecture guards.
 *
 * The frontend mirrors the backend's dependency discipline: the domain layer
 * is plain TypeScript and must not import React, the router, or the network.
 * If that ever stops being true, the eligibility vocabulary becomes coupled to
 * a rendering library and can no longer be reasoned about on its own.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Vitest runs with the project root as cwd; `import.meta.url` is an http URL
// under the jsdom environment, so it cannot be used to find files on disk.
const SRC = join(process.cwd(), "src");

function filesIn(relative: string, extensions = /\.(ts|tsx)$/u): string[] {
  const root = join(SRC, relative);
  const found: string[] = [];
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory)) {
      const full = join(directory, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (extensions.test(entry)) found.push(full);
    }
  };
  walk(root);
  return found;
}

const FRAMEWORK_IMPORTS = [
  /from ["']react["']/u,
  /from ["']react-dom/u,
  /from ["']react-router/u,
  /from ["']@tanstack\/react-query["']/u,
];

describe("domain layer stays framework-free", () => {
  const domainFiles = filesIn("domain");

  it("has domain modules to check", () => {
    expect(domainFiles.length).toBeGreaterThanOrEqual(5);
  });

  it.each(domainFiles.map((file) => [file.replace(SRC, "src/"), file] as const))(
    "%s imports no rendering framework",
    (_label, file) => {
      const text = readFileSync(file, "utf8");
      const offending = FRAMEWORK_IMPORTS.filter((pattern) => pattern.test(text));
      expect(offending).toEqual([]);
    },
  );

  it("domain never performs network calls", () => {
    for (const file of domainFiles) {
      expect(readFileSync(file, "utf8")).not.toMatch(/\bfetch\(/u);
    }
  });
});

describe("components do not reach past the API boundary", () => {
  it("no component calls fetch directly", () => {
    for (const file of filesIn("components")) {
      expect(readFileSync(file, "utf8")).not.toMatch(/\bfetch\(/u);
    }
  });

  it("no eligibility rule is evaluated in the browser", () => {
    // The engine is the server's. A client-side rule evaluator would produce a
    // second, unverifiable answer with no decision_hash behind it.
    const banned = /\bevaluateRule\b|\bparseRule\b|\bapplyRuleSet\b/u;
    for (const file of [...filesIn("components"), ...filesIn("routes"), ...filesIn("domain")]) {
      expect(readFileSync(file, "utf8")).not.toMatch(banned);
    }
  });
});

describe("the package stays inside its allowed location", () => {
  it("lives under platform/frontend", () => {
    expect(existsSync(SRC)).toBe(true);
    expect(SRC).toContain(join("platform", "frontend"));
  });
});
