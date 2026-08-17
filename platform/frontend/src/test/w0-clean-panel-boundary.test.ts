import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

const SRC = join(process.cwd(), "src");
const ROUTER = join(SRC, "app", "router.tsx");

function read(file: string): string {
  return readFileSync(file, "utf8");
}

function resolveLocal(specifier: string, owner: string): string | null {
  const stem = specifier.startsWith("@/")
    ? join(SRC, specifier.slice(2))
    : specifier.startsWith(".")
      ? join(dirname(owner), specifier)
      : null;
  if (stem === null) return null;

  const candidates = [
    `${stem}.ts`,
    `${stem}.tsx`,
    join(stem, "index.ts"),
    join(stem, "index.tsx"),
    stem,
  ];
  return candidates.find((file) => existsSync(file) && statSync(file).isFile()) ?? null;
}

function importsOf(file: string): readonly string[] {
  const source = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];
  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      found.push(node.moduleSpecifier.text);
    }
    if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      found.push(node.moduleSpecifier.text);
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0]!)
    ) {
      found.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return found;
}

function routeModule(routePath: string): { readonly specifier: string; readonly file: string } {
  const sourceText = read(ROUTER);
  const source = ts.createSourceFile(ROUTER, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const initializers = new Map<string, ts.Expression>();

  source.forEachChild((node) => {
    if (!ts.isVariableStatement(node)) return;
    for (const declaration of node.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.initializer) {
        initializers.set(declaration.name.text, declaration.initializer);
      }
    }
  });

  let wrapperName: string | null = null;
  function findRoute(node: ts.Node): void {
    if (wrapperName !== null || !ts.isObjectLiteralExpression(node)) {
      ts.forEachChild(node, findRoute);
      return;
    }
    const path = node.properties.find(
      (property): property is ts.PropertyAssignment =>
        ts.isPropertyAssignment(property) &&
        property.name.getText(source) === "path" &&
        ts.isStringLiteral(property.initializer) &&
        property.initializer.text === routePath,
    );
    const lazy = node.properties.find(
      (property): property is ts.PropertyAssignment =>
        ts.isPropertyAssignment(property) && property.name.getText(source) === "lazy",
    );
    if (path && lazy && ts.isCallExpression(lazy.initializer) && ts.isIdentifier(lazy.initializer.expression)) {
      wrapperName = lazy.initializer.expression.text;
      return;
    }
    ts.forEachChild(node, findRoute);
  }
  findRoute(source);
  if (wrapperName === null) throw new Error(`No lazy loader for route ${routePath}`);

  const wrapper = initializers.get(wrapperName);
  if (!wrapper) throw new Error(`No wrapper declaration for ${wrapperName}`);
  let loaderName: string | null = null;
  function findAwaitedLoader(node: ts.Node): void {
    if (
      loaderName === null &&
      ts.isAwaitExpression(node) &&
      ts.isCallExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression)
    ) {
      loaderName = node.expression.expression.text;
    }
    ts.forEachChild(node, findAwaitedLoader);
  }
  findAwaitedLoader(wrapper);
  if (loaderName === null) throw new Error(`No module loader behind ${wrapperName}`);

  const loader = initializers.get(loaderName);
  if (!loader) throw new Error(`No module declaration for ${loaderName}`);
  let specifier: string | null = null;
  function findImport(node: ts.Node): void {
    if (
      specifier === null &&
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0]!)
    ) {
      specifier = node.arguments[0].text;
    }
    ts.forEachChild(node, findImport);
  }
  findImport(loader);
  if (specifier === null) throw new Error(`No dynamic import behind ${loaderName}`);
  const file = resolveLocal(specifier, ROUTER);
  if (file === null) throw new Error(`Cannot resolve ${specifier}`);
  return { specifier, file };
}

function graphFrom(entry: string): { readonly files: Set<string>; readonly specifiers: Set<string> } {
  const files = new Set<string>();
  const specifiers = new Set<string>();
  const pending = [entry];
  while (pending.length > 0) {
    const file = pending.pop() as string;
    if (files.has(file)) continue;
    files.add(file);
    for (const specifier of importsOf(file)) {
      specifiers.add(specifier);
      const resolved = resolveLocal(specifier, file);
      if (resolved && !files.has(resolved)) pending.push(resolved);
    }
  }
  return { files, specifiers };
}

describe("W0 clean-room panel boundary", () => {
  const panel = routeModule("panel");
  const opportunity = routeModule("firsatlar");
  const graph = graphFrom(panel.file);
  const opportunityGraph = graphFrom(opportunity.file);

  it("gives /panel a separate route module from legacy workspace pages", () => {
    expect(panel.specifier).not.toBe(opportunity.specifier);
    expect(relative(SRC, panel.file)).not.toBe("routes/app.tsx");
  });

  it("moves /firsatlar to its own cognitive route boundary", () => {
    expect(relative(SRC, opportunity.file)).toBe("routes/opportunities.tsx");
    expect(
      [...opportunityGraph.files].some((file) =>
        file.includes("/components/cognitive-opportunity-workspace/"),
      ),
    ).toBe(true);
  });

  it("removes the opportunity route implementations from the rejected route module", () => {
    const legacyRoutes = read(join(SRC, "routes", "app.tsx"));
    expect(legacyRoutes).not.toMatch(/export function Opportunit(?:ies|yDetail)Route/u);
  });

  it("reaches the production cognitive cockpit master", () => {
    expect([...graph.files].some((file) => file.endsWith("CognitiveCockpitDashboard.tsx"))).toBe(true);
  });

  it("does not transitively reach the old visual component system", () => {
    const forbidden = [...graph.specifiers].filter(
      (specifier) =>
        specifier === "@/components" ||
        specifier.startsWith("@/components/ui") ||
        specifier.startsWith("@/components/icons") ||
        specifier.startsWith("@/components/analytics"),
    );
    expect(forbidden).toEqual([]);
    expect([...graph.files].some((file) => file.endsWith("/routes/app.tsx"))).toBe(false);
  });

  it("keeps Storybook on the same production master component", () => {
    const story = join(SRC, "components", "cognitive-cockpit", "cognitive-cockpit.stories.tsx");
    const master = [...graph.files].find((file) => file.endsWith("CognitiveCockpitDashboard.tsx"));
    expect(master).toBeDefined();
    expect(master ? graphFrom(story).files.has(master) : false).toBe(true);
  });

  it("uses the installed Phosphor vocabulary instead of custom or typographic glyphs", () => {
    const iconsPath = join(SRC, "foundation", "icons.tsx");
    const icons = read(iconsPath);
    const source = ts.createSourceFile(
      iconsPath,
      icons,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const rawSvgElements: string[] = [];
    function visit(node: ts.Node): void {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const tag = node.tagName.getText(source);
        if (["svg", "path", "line", "circle", "polyline"].includes(tag)) {
          rawSvgElements.push(tag);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);

    expect(icons).toContain("@phosphor-icons/react");
    expect(rawSvgElements).toEqual([]);
  });

  it("owns clean foundation tokens instead of inheriting the legacy design semantics", () => {
    const foundationDir = join(SRC, "foundation");
    const cssFiles = readdirSync(foundationDir).filter((file) => file.endsWith(".css"));
    expect(cssFiles.length).toBeGreaterThan(0);

    const foundationCss = cssFiles.map((file) => read(join(foundationDir, file))).join("\n");
    const foundationIndex = read(join(foundationDir, "index.ts"));
    const cockpitCss = read(join(SRC, "components", "cognitive-cockpit", "cognitive-cockpit.css"));

    expect(cssFiles.some((file) => foundationIndex.includes(`./${file}`))).toBe(true);
    expect(foundationCss).toMatch(/--(?:fd|foundation)-color-primary:\s*#123a6b/iu);
    expect(foundationCss).toMatch(/--(?:fd|foundation)-color-secondary:\s*#f2e14c/iu);
    expect(foundationCss).toMatch(/Roboto/iu);
    expect(`${foundationCss}\n${cockpitCss}`).toMatch(/prefers-reduced-motion|data-reduced-motion/iu);
    expect(foundationCss).not.toContain("--dt-");
    expect(cockpitCss).not.toContain("--dt-");

    const cockpitDir = join(SRC, "components", "cognitive-cockpit");
    const cleanTsxFiles = [
      ...[foundationDir, cockpitDir].flatMap((directory) =>
        readdirSync(directory)
          .filter((file) => file.endsWith(".tsx"))
          .map((file) => join(directory, file)),
      ),
      join(SRC, "routes", "panel.tsx"),
      join(SRC, "routes", "workspace-gate.tsx"),
    ];
    const legacySemanticReferences: string[] = [];
    for (const file of cleanTsxFiles) {
      const source = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      function visit(node: ts.Node): void {
        if (
          (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
          node.text.includes("dt-")
        ) {
          legacySemanticReferences.push(`${relative(SRC, file)}: ${node.text}`);
        }
        if (ts.isTemplateExpression(node)) {
          const segments = [node.head.text, ...node.templateSpans.map((span) => span.literal.text)];
          if (segments.some((segment) => segment.includes("dt-"))) {
            legacySemanticReferences.push(`${relative(SRC, file)}: template`);
          }
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
    expect(legacySemanticReferences).toEqual([]);

    const legacyTailwind = read(join(SRC, "design", "tailwind.css"));
    const mappedThemeTokens = [
      ...legacyTailwind.matchAll(
        /--(color|radius|font|text|shadow|duration|ease|spacing|blur)-([\w-]+):\s*var\(--dt-/gu,
      ),
    ].map((match) => ({ namespace: match[1] ?? "", name: match[2] ?? "" }));
    const forbiddenUtilities = new Set<string>();
    for (const { namespace, name } of mappedThemeTokens) {
      if (namespace === "color") {
        for (const prefix of ["bg", "text", "border", "outline", "ring", "from", "via", "to", "fill", "stroke"]) {
          forbiddenUtilities.add(`${prefix}-${name}`);
        }
      } else if (namespace === "radius") {
        for (const prefix of ["rounded", "rounded-t", "rounded-e", "rounded-b", "rounded-s", "rounded-tl", "rounded-tr", "rounded-br", "rounded-bl", "rounded-ss", "rounded-se", "rounded-ee", "rounded-es"]) {
          forbiddenUtilities.add(`${prefix}-${name}`);
        }
      }
      else if (namespace === "font") forbiddenUtilities.add(`font-${name}`);
      else if (namespace === "text") forbiddenUtilities.add(`text-${name}`);
      else if (namespace === "shadow") forbiddenUtilities.add(`shadow-${name}`);
      else if (namespace === "duration") forbiddenUtilities.add(`duration-${name}`);
      else if (namespace === "ease") forbiddenUtilities.add(`ease-${name}`);
      else if (namespace === "blur") forbiddenUtilities.add(`blur-${name}`);
      else if (namespace === "spacing") {
        for (const prefix of ["h", "min-h", "max-h", "w", "min-w", "max-w", "size", "p", "px", "py", "pt", "pe", "pb", "ps", "m", "mx", "my", "mt", "me", "mb", "ms", "gap"]) {
          forbiddenUtilities.add(`${prefix}-${name}`);
        }
      }
    }

    const legacyTailwindReferences: string[] = [];
    const rawPalette =
      /^(?:bg|text|border|outline|ring|from|via|to|fill|stroke)-(?:black|white|slate|gray|zinc|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-|$)/u;
    for (const file of cleanTsxFiles) {
      const source = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      function visit(node: ts.Node): void {
        if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
          for (const token of node.text.split(/\s+/u)) {
            const utility = token.split(":").at(-1)?.replace(/^!/u, "").replace(/\/.*$/u, "") ?? "";
            if (forbiddenUtilities.has(utility) || rawPalette.test(utility)) {
              legacyTailwindReferences.push(`${relative(SRC, file)}: ${utility}`);
            }
          }
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
    expect(legacyTailwindReferences).toEqual([]);

    expect(foundationCss).toMatch(
      /\.fd-btn--sm\s*\{[^}]*min-block-size:\s*var\(--fd-target-touch\)/su,
    );

    const panelSource = read(join(SRC, "routes", "panel.tsx"));
    expect(panelSource).toMatch(/renderableSuggestions\s*\(/u);
  });

  it("keeps skeleton-first and 320px adaptive-fluid evidence", () => {
    const skeleton = read(join(SRC, "components", "cognitive-cockpit", "CognitiveCockpitSkeleton.tsx"));
    const css = read(join(SRC, "components", "cognitive-cockpit", "cognitive-cockpit.css"));
    expect(skeleton).toMatch(/aria-busy|role=["']status["']/u);
    expect(css).toMatch(/container-type:\s*inline-size/u);
    expect(css).toMatch(/@container/u);
    expect(css).toMatch(/clamp\(/u);
    expect(css).toMatch(/320px/u);
  });
});
