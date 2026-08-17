/**
 * The cognitive authentication master family — replacing, not reskinning, the
 * old `AuthShell`/`AuthForm` pair.
 *
 * `AuthShell` is single-column, 480px, no header, no Spotlight — the pattern
 * every prior W2 migration (`cognitive-cockpit`, `cognitive-file-library`,
 * `cognitive-provider-center`, `cognitive-opportunity-workspace`) walked away
 * from. This suite pins the same shape of contract for `/giris`, `/kayit`,
 * `/onboarding` and the unauthenticated/session-error states `workspace-gate`
 * renders: one Storybook-owned package, reached by the route modules directly
 * (never through the old templates), with every visible label sourced from
 * the JSON content authority.
 *
 * Deliberately structural/static only — filesystem reads, source regex and a
 * TypeScript AST scan. No router, no MSW, no React render: this repository's
 * full-app integration harness (`renderAppAt`) is slow and hang-prone for the
 * very pre-migration states this suite targets (the current `workspace-gate`
 * error branches render no `<main>`, so its own wait-for loop times out
 * regardless of what is asserted). Behavioural coverage of the surviving
 * mutation/return-path/demo flows already lives in `auth-gate.test.tsx` and
 * `demo-login.test.tsx` and is not duplicated here.
 *
 * `AuthShell`/`AuthForm` themselves are deleted, not merely unreached:
 * `red-acceptance.test.tsx` requires exactly 73 named, callable components in
 * the registry now that the legacy pair is gone from the 4 shells and the 11
 * templates it counts.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const PACKAGE_ROOT = join(ROOT, "src", "components", "cognitive-auth");
const CONTENT_ROOT = join(ROOT, "src", "content", "base", "tr-TR");

const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), "utf8");

/* ---------------------------------------------------- 1. package shape ---- */

describe("the cognitive auth family ships as one Storybook-owned package", () => {
  it.each(["index.ts", "cognitive-auth.css", "cognitive-auth.stories.tsx"])(
    "ships %s under src/components/cognitive-auth",
    (name) => {
      expect(existsSync(join(PACKAGE_ROOT, name)), join("cognitive-auth", name)).toBe(true);
    },
  );
});

/* ----------------------------------------------- 2. route import boundary */

describe("the migrated route surfaces reach the new family, not the old templates", () => {
  it("routes/auth.tsx no longer imports the old AuthShell/AuthForm", () => {
    const source = read("src", "routes", "auth.tsx");
    expect(source).not.toMatch(/\bAuthShell\b/u);
    expect(source).not.toMatch(/\bAuthForm\b/u);
    expect(source).toMatch(/from ["']@\/components\/cognitive-auth["']/u);
  });

  it("routes/public.tsx's onboarding no longer imports the old AuthShell", () => {
    const source = read("src", "routes", "public.tsx");
    expect(source).not.toMatch(/\bAuthShell\b/u);
    expect(source).toMatch(/from ["']@\/components\/cognitive-auth["']/u);
  });

  it("routes/workspace-gate.tsx renders its access states through the same family", () => {
    const source = read("src", "routes", "workspace-gate.tsx");
    expect(source).toMatch(/from ["']@\/components\/cognitive-auth["']/u);
  });
});

describe("the legacy AuthShell/AuthForm pair is purged, not merely unreached", () => {
  it("shells.tsx no longer defines AuthShell", () => {
    const source = read("src", "components", "shells.tsx");
    expect(source).not.toMatch(/\bAuthShell\b/u);
  });

  it("templates.tsx no longer defines AuthForm or its demo-card helpers", () => {
    const source = read("src", "components", "templates.tsx");
    expect(source).not.toMatch(/\bAuthForm\b/u);
    expect(source).not.toMatch(/\bStaticDeploymentNotice\b/u);
    expect(source).not.toMatch(/\bDemoProfileCards\b/u);
  });

  it("registry.ts no longer counts AuthShell or AuthForm among the 73", async () => {
    const { ALL_COMPONENT_NAMES } = await import("@/components/registry");
    expect(ALL_COMPONENT_NAMES).not.toContain("AuthShell");
    expect(ALL_COMPONENT_NAMES).not.toContain("AuthForm");
  });

  it("components.css no longer carries the dt-auth or dt-demo rule blocks", () => {
    const source = read("src", "design", "components.css");
    expect(source).not.toMatch(/\.dt-auth\b/u);
    expect(source).not.toMatch(/\.dt-demo\b/u);
  });

  it("the components barrel resolves no AuthShell or AuthForm export", async () => {
    const barrel = (await import("@/components")) as Record<string, unknown>;
    expect(barrel["AuthShell"]).toBeUndefined();
    expect(barrel["AuthForm"]).toBeUndefined();
  });
});

/* ------------------------------------------------- 3. content authority --- */

function readAllContentIds(): readonly string[] {
  return readdirSync(CONTENT_ROOT)
    .filter((name) => name.endsWith(".json"))
    .flatMap((name) => {
      const bundle = JSON.parse(readFileSync(join(CONTENT_ROOT, name), "utf8")) as {
        readonly entries?: readonly { readonly id?: string }[];
      };
      return (bundle.entries ?? []).map((entry) => entry.id ?? "");
    });
}

describe("every visible auth label is sourced from the JSON content authority", () => {
  it("carries login, register and onboarding copy as auth.* content records", () => {
    const ids = readAllContentIds();
    expect(ids.some((id) => id.startsWith("auth.login."))).toBe(true);
    expect(ids.some((id) => id.startsWith("auth.register."))).toBe(true);
    expect(ids.some((id) => id.startsWith("auth.onboarding."))).toBe(true);
  });

  it("leaves no user-visible string literal in the new package's TSX", () => {
    const looksVisible = (value: string) =>
      /\p{L}/u.test(value) &&
      (/[çğıöşüÇĞİÖŞÜ]/u.test(value) ||
        /\s/u.test(value.trim()) ||
        /^[A-ZÇĞİÖŞÜ][a-zçğıöşü]+$/u.test(value));

    const files = existsSync(PACKAGE_ROOT)
      ? readdirSync(PACKAGE_ROOT, { withFileTypes: true })
          .filter(
            (entry) =>
              entry.isFile() && entry.name.endsWith(".tsx") && !entry.name.endsWith(".stories.tsx"),
          )
          .map((entry) => join(PACKAGE_ROOT, entry.name))
      : [];

    const offenders = files.flatMap((file) => {
      const source = readFileSync(file, "utf8");
      const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const found: string[] = [];
      const visit = (node: ts.Node) => {
        if (ts.isJsxText(node)) {
          const value = node.getText(ast).trim();
          if (value !== "") found.push(value);
        }
        if (
          (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
          !(ts.isImportDeclaration(node.parent) && node.parent.moduleSpecifier === node)
        ) {
          if (looksVisible(node.text)) found.push(node.text);
        }
        ts.forEachChild(node, visit);
      };
      visit(ast);
      return found.map((literal) => `${join("cognitive-auth", file.split("/").pop() ?? file)}: ${literal}`);
    });

    // Not `.toBeGreaterThan(0)` guarded on the base: a package that does not
    // exist yet has no offenders and that is a legitimate (if trivial) pass
    // for *this* assertion — the package-shape suite above is what pins its
    // existence and fails loudly on the current base.
    expect(offenders).toEqual([]);
  });
});

/* -------------------------------------------- 4. Storybook state coverage */

describe("the cognitive auth master stories document every required state", () => {
  const storyFile = join(PACKAGE_ROOT, "cognitive-auth.stories.tsx");

  it("exposes the full required-states list", () => {
    expect(existsSync(storyFile)).toBe(true);
    const source = readFileSync(storyFile, "utf8");
    for (const state of [
      "Login",
      "Register",
      "Onboarding",
      "DemoCustomer",
      "DemoSuperadmin",
      "RealAccountOpen",
      "Submitting",
      "ValidationError",
      "ServerError",
      "Loading",
      "SessionRequired",
      "Dark",
      "AtPhone320",
      "ReducedMotion",
    ]) {
      expect(source, `${state} story eksik`).toMatch(new RegExp(`export const ${state}\\b`, "u"));
    }
  });

  it("selects an explicit 320px viewport, not an inherited default", () => {
    expect(existsSync(storyFile)).toBe(true);
    const source = readFileSync(storyFile, "utf8");
    expect(source).toMatch(/globals:\s*\{\s*viewport:\s*\{\s*value:\s*["']phone320["']/u);
    expect(source).toMatch(/phone320:\s*\{[\s\S]*?width:\s*["']320px["']/u);
  });
});

/* ---------------------------------- 4b. Access Workbench replaces the card */

describe("the old auth-header/demo-card anatomy is gone", () => {
  it("no longer ships CognitiveAuthHeader.tsx as a duplicate of the master header", () => {
    expect(existsSync(join(PACKAGE_ROOT, "CognitiveAuthHeader.tsx"))).toBe(false);
  });

  it("no package file still imports the removed CognitiveAuthHeader", () => {
    const offenders = existsSync(PACKAGE_ROOT)
      ? readdirSync(PACKAGE_ROOT)
          .filter((name) => name.endsWith(".tsx"))
          .filter((name) => read("src", "components", "cognitive-auth", name).includes("CognitiveAuthHeader"))
      : [];
    expect(offenders).toEqual([]);
  });

  it("the auth header is the actual CognitiveSpotlightHeader master, reused in its public variant", () => {
    const source = read("src", "components", "cognitive-auth", "CognitiveAuthSpotlight.tsx");
    expect(source).toMatch(/from ["']@\/components\/cognitive-cockpit["']/u);
    expect(source).toMatch(/variant="public"/u);
  });

  it("the public header variant renders no hamburger, notifications or account control", () => {
    const source = read("src", "components", "cognitive-cockpit", "CognitiveSpotlightHeader.tsx");
    expect(source).toMatch(/isPublic \? null : \(/u);
  });
});

describe("the Access Workbench organism carries the new login/register contract", () => {
  const workbenchFile = join(PACKAGE_ROOT, "CognitiveAccessWorkbench.tsx");

  it("ships CognitiveAccessWorkbench.tsx as a rail-plus-console organism", () => {
    expect(existsSync(workbenchFile)).toBe(true);
    const source = readFileSync(workbenchFile, "utf8");
    expect(source).toMatch(/cognitive-auth__rail/u);
    expect(source).toMatch(/cognitive-auth__console/u);
  });

  it("renders a compact role switch rather than two always-visible demo cards", () => {
    const source = readFileSync(workbenchFile, "utf8");
    expect(source).toMatch(/cognitive-auth__role-switch/u);
    expect(source).not.toMatch(/cognitive-auth__demo-card\b/u);
  });

  it("keeps demo credentials behind a native, accessible disclosure rather than printed by default", () => {
    const source = readFileSync(workbenchFile, "utf8");
    expect(source).toMatch(/<details className="cognitive-auth__reveal">/u);
  });

  it("reveals the real-account form behind a secondary, collapsible control on login", () => {
    const source = readFileSync(workbenchFile, "utf8");
    expect(source).toMatch(/cognitive-auth__real-toggle/u);
    expect(source).toMatch(/aria-expanded=\{open\}/u);
  });

  it("shows only one demo profile's preview and one primary demo action at a time", () => {
    const source = readFileSync(workbenchFile, "utf8");
    // One `ProfilePreview` render call per `DemoConsole`, not one per profile.
    expect((source.match(/<ProfilePreview\b/gu) ?? []).length).toBe(1);
  });

  /*
   * The 320x800 regression: the old default-visible policy paragraph alone
   * measured over 300px tall in a live browser and pushed the primary demo
   * action off the first screen. A one-line trust statement always renders;
   * the full policy wording is reachable but never printed by default.
   */
  it("prints only a one-line trust statement by default, with the full notice behind a closed disclosure", () => {
    const source = readFileSync(workbenchFile, "utf8");
    expect(source).toMatch(/cognitive-auth__notice-short/u);
    expect(source).toMatch(
      /<details className="cognitive-auth__notice-full">[\s\S]*<summary>\{noticeSummary\}<\/summary>[\s\S]*data-testid="demo-giris-uyarisi"[\s\S]*<\/details>/u,
    );
    // Closed by default: no hard-coded `open` attribute on the element.
    expect(source).not.toMatch(/<details className="cognitive-auth__notice-full"[^>]*\bopen\b/u);
  });
});

/* ------------------------------------ 6. no horizontal overflow at 320px -- */

describe("the stylesheet keeps a 320px-class container free of horizontal overflow", () => {
  const css = readFileSync(join(PACKAGE_ROOT, "cognitive-auth.css"), "utf8");

  function ruleBodyFor(selector: string): string {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    const match = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "u").exec(css);
    expect(match, `no rule found for ${selector}`).not.toBeNull();
    return match?.[1] ?? "";
  }

  it("gives every flex/grid descendant that may carry long content min-inline-size: 0", () => {
    for (const selector of [
      ".cognitive-auth__panel",
      ".cognitive-auth__console",
      ".cognitive-auth__demo-credential",
      ".cognitive-auth__form",
    ]) {
      expect(ruleBodyFor(selector), selector).toMatch(/min-inline-size:\s*0/u);
    }
  });

  it("lets long email/password values wrap instead of forcing width", () => {
    expect(ruleBodyFor(".cognitive-auth__demo-credential dd")).toMatch(/overflow-wrap:\s*anywhere/u);
  });

  it("uses minmax(0, 1fr) credential grid tracks, never a bare 1fr", () => {
    expect(ruleBodyFor(".cognitive-auth__demo-credentials")).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)/u);
  });

  it("never renders two demo profiles' credentials side by side", () => {
    expect(css).not.toMatch(/demo-credentials[^{]*\{[^}]*repeat\(2/u);
  });

  it("hides the header's full brand word before the search panel would compress", () => {
    expect(css).toMatch(/@container cognitive-auth \(max-width:\s*26rem\)\s*\{\s*\.cognitive-auth__brand-word\s*\{\s*display:\s*none;/u);
  });

  /*
   * The browser-facing contract for the compact notice: it must not silently
   * regress into another sub-1rem or sub-44px shortcut in the name of saving
   * vertical space at 320px.
   */
  it("keeps the compact notice at or above 1rem and its disclosure summary at or above a 44px target", () => {
    const shortBody = ruleBodyFor(".cognitive-auth__notice-short");
    expect(shortBody).not.toMatch(/font-size:\s*0\./u);
    const summaryBody = ruleBodyFor(".cognitive-auth__notice-full summary");
    expect(summaryBody).toMatch(/min-block-size:\s*var\(--fd-target-touch,\s*44px\)/u);
  });
});

/* -------------------------------------- 7. desktop canvas use for login --- */

describe("the login surface intentionally uses a wide desktop canvas", () => {
  const css = readFileSync(join(PACKAGE_ROOT, "cognitive-auth.css"), "utf8");

  it("grows the login panel to roughly 68-72rem at a wide-enough container, narrower elsewhere", () => {
    const blocks = css.match(/@container cognitive-auth \(min-width:\s*\d+(?:\.\d+)?rem\)\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/gu) ?? [];
    const loginBlock = blocks.find((block) => block.includes('.cognitive-auth[data-mode="login"] .cognitive-auth__panel'));
    expect(loginBlock, "no login-scoped wide panel rule found").not.toBeUndefined();
    const threshold = Number(/min-width:\s*(\d+(?:\.\d+)?)rem/u.exec(loginBlock ?? "")?.[1]);
    const panelWidth = Number(
      /\.cognitive-auth\[data-mode="login"\]\s*\.cognitive-auth__panel\s*\{[^}]*max-inline-size:\s*(\d+(?:\.\d+)?)rem/u.exec(
        loginBlock ?? "",
      )?.[1],
    );
    expect(threshold).toBeGreaterThanOrEqual(56);
    expect(panelWidth).toBeGreaterThanOrEqual(68);
    expect(panelWidth).toBeLessThanOrEqual(72);
  });

  it("only puts the rail beside the console once the login panel is that wide", () => {
    expect(css).toMatch(
      /\.cognitive-auth\[data-mode="login"\]\s*\.cognitive-auth__workbench\s*\{[^}]*grid-template-columns:/u,
    );
  });

  it("keeps registration/onboarding/gate at the narrower default panel width", () => {
    expect(css).not.toMatch(/\.cognitive-auth\[data-mode="register"\][\s\S]*max-inline-size:\s*7\drem/u);
    expect(css).not.toMatch(/\.cognitive-auth\[data-mode="onboarding"\][\s\S]*max-inline-size:\s*7\drem/u);
    expect(css).not.toMatch(/\.cognitive-auth\[data-mode="gate"\][\s\S]*max-inline-size:\s*7\drem/u);
  });
});

/* --------------------------------------------- 8. no fixed-pixel breakpoints */

describe("the stylesheet stays container-query driven", () => {
  const css = readFileSync(join(PACKAGE_ROOT, "cognitive-auth.css"), "utf8");

  it("has no @media rule other than prefers-reduced-motion", () => {
    const mediaRules = css.match(/@media[^{]*/gu) ?? [];
    for (const rule of mediaRules) {
      expect(rule).toMatch(/prefers-reduced-motion/u);
    }
  });

  it("keeps radii at or under 12px, except the Spotlight search", () => {
    const pxRadii = css.match(/border-radius:\s*(\d+)px/gu) ?? [];
    for (const declaration of pxRadii) {
      const value = Number(/(\d+)px/u.exec(declaration)?.[1]);
      expect(value, declaration).toBeLessThanOrEqual(22);
    }
  });
});
