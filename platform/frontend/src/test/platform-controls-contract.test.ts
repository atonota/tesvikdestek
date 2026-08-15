/**
 * One product, one control - and one form layer.
 *
 * Two claims were made in prose and were not true of the code.
 *
 * **"The select is not the platform's."** `forms/Select.tsx` says so, and the
 * form layer honoured it. Six other runtime call sites did not: the tri-state
 * primitive, the filter bar, three grid toolbar controls and the media version
 * pickers were all native `<select>` elements. A native select is drawn by the
 * operating system - a popover on macOS, a drop list on Windows, a full-screen
 * wheel on iOS and Android, at a font size below this product's 1rem floor on
 * at least two of them - so an enterprise surface that mixes the two shows the
 * same filter as two different controls on two machines.
 *
 * **"Forms use react-hook-form."** The forms barrel said real routes used the
 * layer. They did not: every runtime form - registration, login, the company
 * profile, the eligibility wizard and the approval note - was hand-rolled
 * `useState` with a bare `<form onSubmit>`.
 *
 * Both are asserted here against the source, because both are claims about
 * *which code exists*, and neither is visible in a rendered assertion about any
 * single screen. Tests, stories and mocks are excluded: a test may legitimately
 * render a native select to prove something about one, and the guard would
 * otherwise ban its own counter-example.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");

/** Directories that are not shipped runtime code. */
const NON_RUNTIME_DIRECTORIES = ["test", "mocks"];

/** Files that are not shipped runtime code. */
const NON_RUNTIME_FILE = /\.(test|spec|stories)\.tsx?$/u;

function runtimeSources(): string[] {
  const found: string[] = [];
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory)) {
      const full = join(directory, entry);
      if (statSync(full).isDirectory()) {
        if (directory === SRC && NON_RUNTIME_DIRECTORIES.includes(entry)) continue;
        walk(full);
      } else if (/\.tsx?$/u.test(entry) && !NON_RUNTIME_FILE.test(entry)) {
        found.push(full);
      }
    }
  };
  walk(SRC);
  return found;
}

/**
 * Code with comments and string/template literals removed.
 *
 * A guard that matched raw text would fire on the docstrings that explain why
 * the native control is banned, and on any Turkish sentence containing the
 * word. Only real JSX survives this.
 */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//gu, " ")
    .replace(/(^|[^:"'`\\])\/\/.*$/gmu, "$1")
    .replace(/"(?:[^"\\\n]|\\.)*"/gu, '""')
    .replace(/'(?:[^'\\\n]|\\.)*'/gu, "''")
    .replace(/`(?:[^`\\]|\\.)*`/gu, "``");
}

const SOURCES = runtimeSources().map((file) => ({
  path: relative(ROOT, file),
  code: code(readFileSync(file, "utf8")),
}));

describe("the guard itself sees the code it is supposed to see", () => {
  it("finds the runtime modules", () => {
    expect(SOURCES.length).toBeGreaterThan(30);
    expect(SOURCES.map((s) => s.path)).toContain(join("src", "components", "primitives.tsx"));
  });

  it("excludes tests, stories and mocks", () => {
    const paths = SOURCES.map((s) => s.path);
    expect(paths.filter((path) => NON_RUNTIME_FILE.test(path))).toEqual([]);
    expect(paths.filter((path) => path.startsWith(join("src", "test")))).toEqual([]);
    expect(paths.filter((path) => path.startsWith(join("src", "mocks")))).toEqual([]);
  });

  it("strips comments and strings rather than raw text", () => {
    expect(code('const a = "<select>"; // <select>\n/* <select> */')).not.toMatch(/<select/u);
    expect(code("return <select id={x}>")).toMatch(/<select/u);
  });
});

describe("no runtime module renders a native select", () => {
  it("uses the shared custom control everywhere instead", () => {
    const offenders = SOURCES.filter((source) => /<select[\s/>]/u.test(source.code)).map(
      (source) => source.path,
    );
    expect(offenders).toEqual([]);
  });
});

describe("every runtime form goes through the react-hook-form layer", () => {
  const templates = () =>
    readFileSync(join(SRC, "components", "templates.tsx"), "utf8");

  it("no template hand-rolls a <form> element", () => {
    // `AppForm` owns the element, the submit button, the busy state and the
    // validation gate. A second `<form>` in a template is a second, unguarded
    // submission path.
    const offenders = SOURCES.filter(
      (source) =>
        /<form[\s/>]/u.test(source.code) &&
        source.path !== join("src", "components", "forms", "fields.tsx"),
    ).map((source) => source.path);
    expect(offenders).toEqual([]);
  });

  it("the templates reach the layer by name", () => {
    const source = templates();
    expect(source).toMatch(/\bAppForm\b/u);
    expect(source).toMatch(/\bTextField\b/u);
    expect(source).toMatch(/\bSelectField\b/u);
  });

  /**
   * The four templates that are forms, and the body of each.
   *
   * Scoped rather than file-wide on purpose: `CatalogList` legitimately holds
   * search and filter state in `useState`, and it is not a form - it submits
   * nothing and validates nothing. A guard that banned the hook across the file
   * would be banning the wrong thing and would be routed around rather than
   * obeyed.
   */
  const FORM_TEMPLATES = [
    "AuthForm",
    "ProfileWorkspace",
    "EligibilityWizard",
    "ApprovalForm",
  ] as const;

  const bodyOf = (name: string): string => {
    const source = code(templates());
    const start = source.indexOf(`export function ${name}(`);
    expect(start, `${name} is not exported from templates.tsx`).toBeGreaterThanOrEqual(0);
    const rest = source.slice(start + 1);
    const next = rest.indexOf("\nexport function ");
    return next < 0 ? rest : rest.slice(0, next);
  };

  it.each(FORM_TEMPLATES)("%s keeps no form values in hand-rolled state", (name) => {
    // The failure mode this replaces: a submit that fires with an empty
    // required field, and an error rendered in colour but never announced.
    const body = bodyOf(name);
    expect(body).not.toMatch(/\buseState\b/u);
    expect(body).not.toMatch(/\bpreventDefault\b/u);
  });

  it.each(FORM_TEMPLATES)("%s renders the shared form element", (name) => {
    expect(bodyOf(name)).toMatch(/<AppForm\b/u);
  });

  it("the forms barrel does not claim more than the code does", () => {
    const barrel = readFileSync(join(SRC, "components", "forms", "index.ts"), "utf8");
    expect(barrel).toMatch(/react-hook-form/u);
    // The claim is only allowed to stand because the guard above holds.
    expect(barrel).toMatch(/rota|route/iu);
  });
});
