/**
 * The v2 baseline report is a contract, not a paragraph.
 *
 * The program had numbers before this file existed. It had too many of them.
 * `docs/reports/2026-08-14-enterprise-frontend-implementation.md` counted 26
 * routes and 54 stories; `FRONTEND-TECHSTACK.md` counted 10 story files and 89
 * story exports; neither matches the other and neither matches the tree they
 * were supposed to describe. Nothing was lying on purpose - the documents were
 * simply written at different moments and no rule tied a number to the command
 * that produced it. A progress claim built on any of them starts from a base
 * nobody can reproduce.
 *
 * So this suite does not check that the product is a particular size. It checks
 * that the one canonical baseline report states its numbers in a form a second
 * person can re-derive:
 *
 *  - it names the exact commit it was measured at;
 *  - it carries all six measurement families, no more and no fewer;
 *  - every family declares a number, says in plain Turkish *what* is being
 *    counted, and shows the command and the command's real output;
 *  - the declared number actually appears in that output, so a figure cannot
 *    drift away from its own evidence;
 *  - v1's `M01`-`M68` appear only as superseded history, never as v2 progress;
 *  - the older, contradicting documents are named rather than quietly reworded.
 *
 * **What this suite deliberately does not do: compare the report against the
 * repository as it stands today.** The report is a snapshot of one commit. A
 * route added next month must not turn it red, because a historical measurement
 * that rewrites itself is no longer a measurement. The strength here is
 * structural instead: a number with no command, an empty output block, or a
 * number that does not occur in its own output all fail, and those are the three
 * ways a fabricated baseline gets written.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/** Vitest runs from `platform/frontend`; the report lives at the repo root. */
const REPO_ROOT = join(process.cwd(), "..", "..");
const REPORT_PATH = join(
  REPO_ROOT,
  "docs",
  "reports",
  "2026-08-15-v2-baseline-olcum-raporu.md",
);

/** The commit the baseline is measured at, and the only one it may claim. */
const BASE_COMMIT = "7cde09d79e127f62f959b4abc27bf9e7b09591ca";

/**
 * The six families, in the order the report must present them.
 *
 * Fixed here rather than read from the report, because a report that declares
 * its own required contents can always satisfy itself.
 */
const MEASUREMENTS = [
  "rota",
  "bilesen",
  "story",
  "test-dosyasi",
  "bundle",
  "a11y",
] as const;

/**
 * Missing file is a *finding*, not a crash.
 *
 * Reading eagerly at module scope would make the very first run fail with
 * ENOENT before a single assertion ran, and a stack trace is not a red test.
 */
const report = (): string | null =>
  existsSync(REPORT_PATH) ? readFileSync(REPORT_PATH, "utf8") : null;

const text = (): string => report() ?? "";

/* ------------------------------------------------------------- the parser */

interface Block {
  readonly id: string;
  readonly body: string;
}

/**
 * Blocks are delimited by an explicit marker rather than by heading text.
 *
 * A heading is prose and gets reworded; `<!-- olcum:rota -->` is a structural
 * claim that survives editing and cannot be produced by accident.
 */
function blocks(source: string): readonly Block[] {
  const found: Block[] = [];
  const marker = /<!--\s*olcum:([a-z0-9-]+)\s*-->/gu;
  const hits = [...source.matchAll(marker)];
  for (const [index, hit] of hits.entries()) {
    const start = (hit.index ?? 0) + hit[0].length;
    const end = index + 1 < hits.length ? (hits[index + 1]?.index ?? source.length) : source.length;
    found.push({ id: hit[1] ?? "", body: source.slice(start, end) });
  }
  return found;
}

const blockFor = (id: string): string =>
  blocks(text()).find((block) => block.id === id)?.body ?? "";

/** The `**Sayı:**` line, digits only - `155.084` and `155084` both give digits. */
function declaredDigits(body: string): string {
  const line = /\*\*Sayı:\*\*\s*([^\n]+)/u.exec(body)?.[1] ?? "";
  return line.replace(/[^\d]/gu, "");
}

/** Everything inside the ```console fence of one block. */
function consoleFence(body: string): string {
  return /```console\n([\s\S]*?)```/u.exec(body)?.[1] ?? "";
}

const commandLines = (fence: string): readonly string[] =>
  fence.split("\n").filter((line) => line.startsWith("$ "));

const outputLines = (fence: string): readonly string[] =>
  fence.split("\n").filter((line) => line.trim() !== "" && !line.startsWith("$ "));

/**
 * The numbers an output actually contains, as whole tokens.
 *
 * The first version of this rule stripped every non-digit from the output and
 * asked whether the declared figure appeared anywhere in what was left. That
 * reads across boundaries: `23 rota x 2 viewport = 46` collapses to `23246`,
 * which "contains" 24, 32, 324, 246 and a dozen other numbers that were never
 * printed. A guard that accepts numbers nobody measured is worse than no guard,
 * because it looks like proof.
 *
 * So each digit run is kept as its own token and compared whole. Grouping
 * separators inside a run are dropped (`202.512` and `202,512` are both the one
 * number 202512); a separator *between* two runs is a boundary and is honoured.
 */
const numericTokens = (fence: string): readonly string[] =>
  outputLines(fence).flatMap((line) =>
    [...line.matchAll(/\d[\d.,]*/gu)].map((match) => match[0].replace(/[^\d]/gu, "")),
  );

/* -------------------------------------------------------------- existence */

describe("the canonical v2 baseline report exists", () => {
  it("is present at the one path the program treats as canonical", () => {
    expect(
      report(),
      `beklenen baseline raporu yok: docs/reports/2026-08-15-v2-baseline-olcum-raporu.md`,
    ).not.toBeNull();
  });

  it("says which commit it was measured at, in full", () => {
    // A short sha is a different claim: two trees can share a prefix, and a
    // baseline that cannot be checked out is not a baseline.
    expect(text(), "baseline raporu ölçüldüğü commit'i tam olarak yazmıyor").toContain(
      BASE_COMMIT,
    );
  });
});

/* ----------------------------------------------------------- completeness */

describe("all six measurement families are present, and only those six", () => {
  it("declares exactly the six required families", () => {
    expect(blocks(text()).map((block) => block.id)).toEqual([...MEASUREMENTS]);
  });

  it.each([...MEASUREMENTS])("%s carries a declared number", (id) => {
    expect(declaredDigits(blockFor(id)), `${id} ölçümünün sayısı yok`).not.toBe("");
  });

  it.each([...MEASUREMENTS])("%s says in plain Turkish what is being counted", (id) => {
    // The whole point of this line is to keep "test dosyası" and "test case"
    // from being read as the same number. A stub word cannot do that, so the
    // definition has to be a sentence.
    const definition = /\*\*Ne sayılıyor:\*\*\s*([^\n]+)/u.exec(blockFor(id))?.[1] ?? "";
    expect(definition.trim().length, `${id} ölçümü ne saydığını tanımlamıyor`).toBeGreaterThan(
      40,
    );
  });
});

/* -------------------------------------------------------------- evidence */

describe("every number is shown with the command that produced it", () => {
  it.each([...MEASUREMENTS])("%s shows a runnable command", (id) => {
    const fence = consoleFence(blockFor(id));
    expect(fence, `${id} ölçümünde komut bloğu yok`).not.toBe("");
    expect(commandLines(fence).length, `${id} ölçümünde çalıştırılabilir komut yok`)
      .toBeGreaterThan(0);
  });

  it.each([...MEASUREMENTS])("%s shows that command's real output", (id) => {
    const fence = consoleFence(blockFor(id));
    expect(outputLines(fence).length, `${id} ölçümünde komut çıktısı yok`).toBeGreaterThan(0);
  });

  /**
   * The rule that makes the other three worth having.
   *
   * A number in a table and a command in a code block are two independent
   * claims until something ties them together. This ties them: whatever the
   * report says the figure is, that figure has to occur in the output it
   * printed. It is what a stale or invented number cannot survive.
   */
  it.each([...MEASUREMENTS])("%s's number occurs in its own output", (id) => {
    const body = blockFor(id);
    const digits = declaredDigits(body);
    expect(
      numericTokens(consoleFence(body)),
      `${id}: raporun yazdığı ${digits} sayısı kendi komut çıktısında geçmiyor`,
    ).toContain(digits);
  });
});

/* ------------------------------------------------------ v1 stays history */

describe("v1 is frozen as superseded history", () => {
  it("names the v1 identity space it retires", () => {
    const source = text();
    expect(source).toContain("M01");
    expect(source).toContain("M68");
  });

  it("marks that space superseded and frozen rather than merely old", () => {
    expect(text(), "M01-M68 aşılmış ve dondurulmuş olarak işaretlenmemiş").toMatch(
      /aşılmış[\s\S]{0,400}dondurul|dondurul[\s\S]{0,400}aşılmış/u,
    );
  });

  it("states v2 progress as zero against the fixed denominator", () => {
    // The counter rule: one denominator, monotonic, never inverted. A baseline
    // is measured before any v2 milestone closes, so the only honest figure
    // here is 0/147 - and writing it down is what stops v1's delivered work
    // from being re-presented as v2 progress.
    expect(text(), "v2 ilerlemesi 0/147 olarak yazılmamış").toMatch(
      /\*\*v2 ilerleme:\*\*\s*0\/147/u,
    );
  });

  it("claims no v2 milestone as GREEN", () => {
    const claims = [...text().matchAll(/\bV2-P\d-\d{2}\b[^\n]*\bGREEN\b/gu)].map((m) => m[0]);
    expect(claims, "baseline raporu bir v2 milestone'unu GREEN ilan ediyor").toEqual([]);
  });
});

/* ------------------------------------------------- the contradiction owned */

describe("the older, contradicting numbers are named rather than reworded", () => {
  it("names both documents whose counts disagree with it", () => {
    const source = text();
    expect(source).toContain("2026-08-14-enterprise-frontend-implementation.md");
    expect(source).toContain("FRONTEND-TECHSTACK.md");
  });

  it("quotes the superseded figures instead of silently replacing them", () => {
    // 26 routes and 54 stories are the two figures a reader is most likely to
    // arrive carrying. If this report does not say what happened to them, it
    // becomes the third number in the argument rather than the end of it.
    const source = text();
    expect(source, "eski 26 rota sayısı bağlamıyla anılmıyor").toMatch(/\b26\b/u);
    expect(source, "eski 54 story sayısı bağlamıyla anılmıyor").toMatch(/\b54\b/u);
  });
});

/* ------------------------------------------------------ kB is not KiB */

/**
 * The bundle figure is the one number in this report with two right answers.
 *
 * 202512 bytes is 202,512 kB if a kilobyte is 1000 bytes, and 197,8 KiB if it
 * is 1024. Both are true; writing one of them with the other's unit is not. The
 * first draft of this report did exactly that - it printed `~197,8 kB`, which
 * silently mixes the binary quantity with the decimal unit, and then subtracted
 * it from a budget written in kB to produce a `~17,8 kB` overage that belongs to
 * neither reading.
 *
 * `FRONTEND-TECHSTACK.md` §13 writes its budget as **kB**, so the canonical
 * comparison is the decimal one: 202,512 - 180 = **22,512 kB over**. The binary
 * reading is a legitimate second interpretation and is kept - but it must be
 * labelled as its own comparison against 180 KiB, not blended into the first.
 *
 * These assertions exist so neither wrong string can come back.
 */
describe("the bundle figure keeps kB and KiB apart", () => {
  it("states the measurement in bytes, which is the unit that is not ambiguous", () => {
    expect(blockFor("bundle")).toMatch(/\*\*Sayı:\*\*\s*202512/u);
  });

  it("gives the decimal conversion with the decimal unit", () => {
    expect(text(), "202512 bayt'ın ondalık karşılığı 202,512 kB yazılmamış").toMatch(
      /202,512\s*kB/u,
    );
  });

  it("gives the binary conversion with the binary unit", () => {
    expect(text(), "202512 bayt'ın ikili karşılığı 197,8 KiB yazılmamış").toMatch(
      /197,8\s*KiB/u,
    );
  });

  it("compares against the kB budget the techstack actually wrote", () => {
    // 202,512 - 180 = 22,512. This is the canonical overage.
    expect(text(), "kanonik bütçe aşımı 22,512 kB olarak yazılmamış").toMatch(
      /22,512\s*kB/u,
    );
  });

  it("keeps the KiB reading as its own comparison rather than blending it in", () => {
    const source = text();
    expect(source, "180 KiB alternatif okuması ayrı olarak adlandırılmamış").toMatch(
      /180\s*KiB/u,
    );
    expect(source, "17,8 KiB aşımı alternatif okuma olarak yazılmamış").toMatch(
      /17,8\s*KiB/u,
    );
  });

  it("never labels the binary quantity with the decimal unit", () => {
    // Case matters: `KiB` is correct here and `kB` is the defect.
    const offenders = [...text().matchAll(/197,8\s*kB/gu)].map((match) => match[0]);
    expect(offenders, "ikili değer ondalık birimle etiketlenmiş (197,8 kB)").toEqual([]);
  });

  it("never restates the old, unit-mixed overage", () => {
    const offenders = [...text().matchAll(/17,8\s*kB/gu)].map((match) => match[0]);
    expect(offenders, "birim karıştıran eski aşım iddiası geri gelmiş (17,8 kB)").toEqual([]);
  });
});

/* ------------------------------------------------------- frozen, not live */

describe("the report declares itself a snapshot rather than a dashboard", () => {
  it("carries the frozen-snapshot marker", () => {
    expect(text(), "rapor dondurulmuş snapshot olduğunu yapısal olarak beyan etmiyor").toMatch(
      /<!--\s*dondurulmus-snapshot\s*-->/u,
    );
  });

  it("says in prose that it is not regenerated as the tree changes", () => {
    expect(text()).toMatch(/yeniden üretilmez/u);
  });
});

/* ------------------------------------------------------------ self-checks */

/**
 * A guard that cannot fail is decoration, and every rule above is a regex over
 * someone else's prose. These run the rules against fixtures written to break
 * them, so a parser that quietly matches nothing is caught here instead of in
 * six months.
 */
describe("the contract can still tell a good report from a bad one", () => {
  it("finds no block when the marker is missing", () => {
    expect(blocks("### Rota\n**Sayı:** 29\n")).toEqual([]);
  });

  it("splits adjacent blocks at the marker rather than running them together", () => {
    const parsed = blocks("<!-- olcum:rota -->\nA\n<!-- olcum:bundle -->\nB\n");
    expect(parsed.map((block) => block.id)).toEqual(["rota", "bundle"]);
    expect(parsed[0]?.body).not.toContain("B");
  });

  it("reads a thousands separator as one number", () => {
    expect(declaredDigits("**Sayı:** 155.084 bayt")).toBe("155084");
  });

  it("sees an empty fence as no evidence at all", () => {
    const fence = consoleFence("```console\n$ komut\n```");
    expect(commandLines(fence)).toHaveLength(1);
    expect(outputLines(fence)).toEqual([]);
  });

  it("tells the decimal unit from the binary one", () => {
    // The whole kB/KiB rule rests on this being case-sensitive. If `kB` also
    // matched inside `KiB`, the correct sentence would fail and the defective
    // one would pass - the exact inversion the rule is written to prevent.
    expect(/197,8\s*kB/u.test("197,8 KiB")).toBe(false);
    expect(/197,8\s*kB/u.test("~197,8 kB")).toBe(true);
    expect(/17,8\s*kB/u.test("17,8 KiB")).toBe(false);
  });

  it("the conversions themselves are right", () => {
    // A unit rule that never checks the arithmetic is decoration.
    expect(Number((202512 / 1000).toFixed(3))).toBe(202.512);
    expect(Number((202512 / 1024).toFixed(1))).toBe(197.8);
    expect(Number((202512 / 1000 - 180).toFixed(3))).toBe(22.512);
    expect(Number((202512 / 1024 - 180).toFixed(1))).toBe(17.8);
  });

  it("does not read a number across the boundary between two output numbers", () => {
    // The concatenating rule this replaced turned this line into `23246` and
    // then happily found 24 in it. Nothing printed 24.
    const fence = consoleFence("```console\n$ komut\n23 rota x 2 viewport = 46 axe\n```");
    expect(numericTokens(fence)).toEqual(["23", "2", "46"]);
    expect(numericTokens(fence), "sınır ötesi yanlış-pozitif").not.toContain("24");
    expect(numericTokens(fence)).toContain("46");
  });

  it("reads a grouped number inside one token as that one number", () => {
    // A separator *inside* a run is grouping; a separator *between* runs is a
    // boundary. Both appear in these outputs and they must not be confused.
    expect(numericTokens(consoleFence("```console\n$ k\n202.512 bayt\n```"))).toEqual([
      "202512",
    ]);
    expect(numericTokens(consoleFence("```console\n$ k\n43 vitest, 9 spec\n```"))).toEqual([
      "43",
      "9",
    ]);
  });

  it("matches a declared figure only as a whole token", () => {
    const fence = consoleFence("```console\n$ komut\n54\n```");
    expect(numericTokens(fence)).toContain("54");
    expect(numericTokens(fence)).not.toContain("89");
    // A prefix of a printed number is not that number.
    expect(numericTokens(consoleFence("```console\n$ k\n126\n```"))).not.toContain("12");
  });
});
