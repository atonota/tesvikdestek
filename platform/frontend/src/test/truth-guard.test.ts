/**
 * The truth guard, run over the real source tree.
 *
 * This is the test that would have caught a well-meaning copywriter turning
 * "Aday uygunluk" into "Onaylandı". It scans every shipped file rather than
 * trusting review.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { OUTCOME_LABELS } from "@/domain/outcomes";
import { findForbiddenClaims } from "@/domain/truth-guard";

// See the note in architecture.test.ts about `import.meta.url` under jsdom.
const SRC = join(process.cwd(), "src");

/**
 * Product source only.
 *
 * The guard's own rule table names what it forbids, and the tests that prove
 * the guard works must be able to write the forbidden strings. Neither ships to
 * a user. Stories are *not* excluded: they are component demos and their copy
 * is real copy.
 */
const EXCLUDED = new Set(["truth-guard.ts"]);
const isTestFile = (name: string) => /\.(test|spec)\.tsx?$/u.test(name);

function collectFiles(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) {
      found.push(...collectFiles(full));
      continue;
    }
    if (!/\.(ts|tsx|css)$/u.test(entry)) continue;
    if (EXCLUDED.has(entry)) continue;
    if (isTestFile(entry)) continue;
    found.push(full);
  }
  return found;
}

/** Source with comments removed, for checks that are about code, not prose. */
function codeOnly(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/^\s*\/\/.*$/gmu, "");
}

const files = collectFiles(SRC);

describe("forbidden claim scan over the source tree", () => {
  it("finds source files to scan at all", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it.each(files.map((file) => [file.replace(SRC, "src/"), file] as const))(
    "%s carries no entitlement or approval language",
    (_label, file) => {
      const claims = findForbiddenClaims(readFileSync(file, "utf8"));
      expect(claims).toEqual([]);
    },
  );
});

describe("outcome vocabulary", () => {
  it("uses only the four backend labels", () => {
    expect(Object.values(OUTCOME_LABELS).sort()).toEqual([
      "Aday uygunluk",
      "Koşullu",
      "Uygun değil",
      "Yetersiz veri",
    ]);
  });

  it("never introduces a fifth outcome anywhere in the source", () => {
    const forbiddenOutcomes = /"(resmen onaylandı|kabul edildi|kesin uygun)"/iu;
    const offenders = files.filter((file) => forbiddenOutcomes.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });
});

describe("security guards over the source tree", () => {
  it("never uses dangerouslySetInnerHTML", () => {
    const offenders = files.filter((file) =>
      readFileSync(file, "utf8").includes("dangerouslySetInnerHTML"),
    );
    expect(offenders).toEqual([]);
  });

  it("never stores credentials or company facts in browser storage", () => {
    // Two modules may touch browser storage, both presentation-only and both
    // named here rather than exempted by pattern. Everything else is banned
    // outright, and each of these is checked field by field further down.
    const STORAGE_ALLOWED = ["store/ui.ts", "data-grid/saved-views.ts"];
    const offenders = files
      .filter((file) => !STORAGE_ALLOWED.some((allowed) => file.endsWith(allowed)))
      .filter((file) =>
        /\b(localStorage|sessionStorage|indexedDB)\b/u.test(codeOnly(readFileSync(file, "utf8"))),
      );
    expect(offenders).toEqual([]);
  });

  it("only the named module touches browser storage directly", () => {
    // Growing this list is a decision, not an accident: the test fails until
    // someone writes the new module down here. The appearance store is absent
    // on purpose - it persists through zustand's middleware and is checked by
    // the partialize block below, not by a storage-token scan.
    const usingStorage = files
      .filter((file) =>
        /\b(localStorage|sessionStorage|indexedDB)\b/u.test(codeOnly(readFileSync(file, "utf8"))),
      )
      .map((file) => file.replace(SRC, "src"))
      .sort();
    expect(usingStorage).toEqual(["src/components/data-grid/saved-views.ts"]);
  });

  it("saved grid views never persist a selection or an identity field", () => {
    const source = readFileSync(join(SRC, "components", "data-grid", "saved-views.ts"), "utf8");
    // Selection refers to rows loaded in one session and is stripped on save.
    expect(source).toMatch(/selectedRowIds:\s*\[\]/u);
    // Nothing about the user or the tenant is written.
    expect(codeOnly(source)).not.toMatch(/email|eposta|parola|token|tenant|kiraci/iu);
  });

  it("the guard itself still catches a plain claim", () => {
    // Guards that only ever pass are decorative. This proves it can fail.
    expect(findForbiddenClaims("Başvurunuz onaylandı.")).not.toEqual([]);
    expect(findForbiddenClaims("Bu tutarı almanız garanti.")).not.toEqual([]);
  });

  it("makes no request to an external origin", () => {
    // Every fetch in the client is a same-origin path beginning with "/".
    const offenders = files.filter((file) => {
      const text = readFileSync(file, "utf8");
      return /fetch\(\s*["'`]https?:/u.test(text);
    });
    expect(offenders).toEqual([]);
  });

  it("sends credentials on the API boundary", () => {
    const client = readFileSync(join(SRC, "api", "client.ts"), "utf8");
    expect(client).toContain('credentials: "include"');
  });
});

/**
 * What may be written to the browser, field by field.
 *
 * The previous version exempted `store/ui.ts` wholesale and looked for the word
 * `localStorage`, which this codebase never uses: persistence goes through
 * zustand's `persist` middleware. The guard was therefore searching for a token
 * the source does not contain, while the one file that actually persists
 * anything was exempt. Adding an e-mail address to `partialize` would have
 * passed silently.
 */
describe("browser persistence is limited to appearance", () => {
  const ALLOWED_PERSISTED_KEYS = ["density", "theme", "fontScale", "reducedMotion"] as const;

  /** Anything that identifies a person, a tenant, or a commercial fact. */
  const FORBIDDEN_KEY_PATTERN =
    /user|email|eposta|parola|password|token|session|oturum|tenant|kiraci|organisation|organization|organizasyon|profile|profil|company|sirket|fact|olgu|revenue|ciro|employee|personel|nace|decision|karar|approval|onay/iu;

  const persistingFiles = files.filter((file) =>
    /\bpersist\s*\(/u.test(codeOnly(readFileSync(file, "utf8"))),
  );

  it("finds the persistence layer at all", () => {
    // If this ever returns nothing, the guard below is vacuous and must be
    // rewritten rather than quietly passing.
    expect(persistingFiles.length).toBeGreaterThan(0);
  });

  it.each(persistingFiles.map((file) => [file.replace(SRC, "src/"), file] as const))(
    "%s declares a partialize allowlist",
    (_label, file) => {
      expect(readFileSync(file, "utf8")).toMatch(/partialize\s*:/u);
    },
  );

  it.each(persistingFiles.map((file) => [file.replace(SRC, "src/"), file] as const))(
    "%s persists only appearance keys",
    (_label, file) => {
      const source = readFileSync(file, "utf8");
      const block = source.slice(source.indexOf("partialize"));
      const body = block.slice(block.indexOf("("), block.indexOf("}),") + 1);
      const persistedKeys = [...body.matchAll(/(\w+)\s*:\s*state\./gu)].map((match) => match[1]);

      expect(persistedKeys.length).toBeGreaterThan(0);
      for (const key of persistedKeys) {
        expect(
          (ALLOWED_PERSISTED_KEYS as readonly string[]).includes(key ?? ""),
          `"${key}" tarayıcıya yazılıyor ama görünüm ayarı değil`,
        ).toBe(true);
        expect(key ?? "").not.toMatch(FORBIDDEN_KEY_PATTERN);
      }
    },
  );

  it("the forbidden-key pattern really would catch identity fields", () => {
    // A guard that can only pass is decorative.
    for (const key of ["email", "tenantId", "companyFacts", "profileValues", "sessionToken"]) {
      expect(key).toMatch(FORBIDDEN_KEY_PATTERN);
    }
    for (const key of ALLOWED_PERSISTED_KEYS) {
      expect(key).not.toMatch(FORBIDDEN_KEY_PATTERN);
    }
  });
});
