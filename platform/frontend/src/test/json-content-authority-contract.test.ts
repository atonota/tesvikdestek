/**
 * Canonical JSON content authority contract.
 *
 * This suite intentionally defines the seam before production code exists:
 * content is data, rendering is TypeScript, and a later PostgreSQL adapter can
 * replace the JSON adapter without changing component call sites.
 */

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import {
  ContentRenderer,
  JsonContentAdapter,
  applyContentRules,
  compileSafePattern,
  type ContentBundle,
  type ContentRule,
} from "@/content";

const CONTENT_ROOT = path.resolve(process.cwd(), "src/content");
const COCKPIT_ROOT = path.resolve(process.cwd(), "src/components/cognitive-cockpit");

const REQUIRED_FILES = [
  "types.ts",
  "ports/ContentPort.ts",
  "adapters/JsonContentAdapter.ts",
  "loaders/json-content-loader.ts",
  "renderer.tsx",
  "rules/eca.ts",
  "rules/safe-regex.ts",
  "schema/content-bundle.schema.json",
  "base/tr-TR/cognitive-cockpit.json",
  "rules/cognitive-cockpit.rules.json",
  "index.ts",
] as const;

const REQUIRED_COCKPIT_IDS = [
  "cockpit.page.title",
  "cockpit.header.menu.open",
  "cockpit.header.search.label",
  "cockpit.header.notifications.label",
  "cockpit.action.run_evaluation",
  "cockpit.analytics.title",
  "cockpit.evidence.title",
  "cockpit.audit.title",
  "cockpit.catalog.title",
  "cockpit.context.title",
  "cockpit.access.title",
  "cockpit.state.loading.title",
  "cockpit.state.empty.title",
  "cockpit.state.no_result.title",
  "cockpit.state.error.title",
  "cockpit.state.partial.title",
  "cockpit.state.permission.title",
  "cockpit.state.offline.title",
  "cockpit.state.stale.title",
] as const;

function fixtureBundle(value = "Merhaba {{name}}", revision = 1): ContentBundle {
  return {
    schemaVersion: 1,
    namespace: "contract",
    locale: "tr-TR",
    revision,
    status: "published",
    source: { kind: "repository-json", ref: "contract-fixture" },
    entries: [
      {
        id: "contract.greeting",
        namespace: "contract",
        locale: "tr-TR",
        revision,
        status: "published",
        kind: "text",
        value,
        variables: ["name"],
        source: { kind: "repository-json", ref: "contract-fixture" },
      },
    ],
  };
}

function readCockpitBundle(): ContentBundle {
  return JSON.parse(
    readFileSync(path.join(CONTENT_ROOT, "base/tr-TR/cognitive-cockpit.json"), "utf8"),
  ) as ContentBundle;
}

function sourceFiles(root: string): readonly string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolute);
    return entry.isFile() && absolute.endsWith(".tsx") ? [absolute] : [];
  });
}

function visibleLiterals(sourcePath: string, functionName?: string): readonly string[] {
  const source = readFileSync(sourcePath, "utf8");
  const ast = ts.createSourceFile(sourcePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];
  const looksVisible = (value: string) =>
    /\p{L}/u.test(value) &&
    (/[çğıöşüÇĞİÖŞÜ]/u.test(value) || /\s/u.test(value.trim()) || /^[A-ZÇĞİÖŞÜ][a-zçğıöşü]+$/u.test(value));
  const looksLikeVisiblePunctuation = (value: string) => /^[·—–…]$/u.test(value.trim());
  const isTechnicalLiteral = (value: string) =>
    /^(?:Escape|Enter|Tab|Arrow(?:Up|Down|Left|Right))$/u.test(value) ||
    value === "noreferrer noopener" ||
    /^\(prefers-[^)]+\)$/u.test(value) ||
    value.startsWith(".") ||
    value.startsWith("#");
  const jsxAttributeAncestor = (node: ts.Node): string | null => {
    let current: ts.Node | undefined = node.parent;
    while (current && !ts.isSourceFile(current)) {
      if (ts.isJsxAttribute(current)) return current.name.getText(ast);
      if (ts.isJsxElement(current) || ts.isJsxSelfClosingElement(current)) return null;
      current = current.parent;
    }
    return null;
  };

  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) {
      const value = node.getText(ast).trim();
      if (value !== "") found.push(value);
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (
        (ts.isImportDeclaration(node.parent) || ts.isExportDeclaration(node.parent)) &&
        node.parent.moduleSpecifier === node
      ) {
        return;
      }
      const attribute = jsxAttributeAncestor(node);
      if (
        attribute &&
        ["className", "id", "type", "to", "href", "name", "rel", "target"].includes(attribute)
      ) {
        return;
      }
      if (looksVisible(node.text) && !isTechnicalLiteral(node.text)) found.push(node.text);
    }
    if (ts.isTemplateExpression(node)) {
      const staticSegments = [node.head.text, ...node.templateSpans.map((span) => span.literal.text)];
      for (const segment of staticSegments) {
        if ((looksVisible(segment) || looksLikeVisiblePunctuation(segment)) && !isTechnicalLiteral(segment)) {
          found.push(segment.trim());
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  const root = functionName
    ? ast.statements.find(
        (statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === functionName,
      )
    : ast;
  if (!root) return [`<missing function ${functionName}>`];
  visit(root);
  return found;
}

describe("JSON content is the canonical frontend content authority", () => {
  it("ships the schema, adapter, renderer, loader and deterministic rule surfaces", () => {
    for (const relative of REQUIRED_FILES) {
      expect(readFileSync(path.join(CONTENT_ROOT, relative), "utf8").length, relative).toBeGreaterThan(0);
    }
  });

  it("stores every cognitive cockpit copy contract as migration-ready records", () => {
    const bundle = readCockpitBundle();
    expect(bundle.schemaVersion).toBe(1);
    expect(bundle.namespace).toBe("cognitive-cockpit");
    expect(bundle.locale).toBe("tr-TR");
    expect(bundle.status).toBe("published");
    expect(bundle.source).toEqual(expect.objectContaining({ kind: expect.any(String), ref: expect.any(String) }));

    const ids = bundle.entries.map((entry) => entry.id);
    expect(ids).toEqual(expect.arrayContaining([...REQUIRED_COCKPIT_IDS]));
    for (const entry of bundle.entries) {
      expect(entry).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          namespace: "cognitive-cockpit",
          locale: "tr-TR",
          revision: expect.any(Number),
          status: "published",
          kind: expect.any(String),
          value: expect.any(String),
          source: expect.objectContaining({ kind: expect.any(String), ref: expect.any(String) }),
        }),
      );
    }
  });

  it("resolves, interpolates and hot-replaces JSON without changing consumers", () => {
    const adapter = new JsonContentAdapter([fixtureBundle()]);
    expect(adapter.resolve({ id: "contract.greeting", locale: "tr-TR", values: { name: "Ada" } }).text).toBe(
      "Merhaba Ada",
    );

    adapter.replaceBundles([fixtureBundle("Selam {{name}}", 2)]);
    expect(adapter.resolve({ id: "contract.greeting", locale: "tr-TR", values: { name: "Ada" } })).toEqual(
      expect.objectContaining({ text: "Selam Ada", revision: 2 }),
    );
  });

  it("selects the most specific locale, role, state and component context deterministically", () => {
    const base = fixtureBundle();
    const baseEntry = base.entries[0]!;
    const bundle: ContentBundle = {
      ...base,
      entries: [
        ...base.entries,
      {
        ...baseEntry,
        value: "Müşteri {{name}}",
        context: { role: "customer" },
      },
      {
        ...baseEntry,
        value: "Güncel değil {{name}}",
        context: { role: "customer", state: "stale", component: "cognitive-cockpit" },
      },
      ],
    };
    const adapter = new JsonContentAdapter([bundle]);

    expect(
      adapter.resolve({
        id: "contract.greeting",
        locale: "tr-TR",
        values: { name: "Ada" },
        context: { role: "customer", state: "stale", component: "cognitive-cockpit" },
      }).text,
    ).toBe("Güncel değil Ada");
    expect(
      adapter.resolve({
        id: "contract.greeting",
        locale: "tr-TR",
        values: { name: "Ada" },
        context: { role: "customer" },
      }).text,
    ).toBe("Müşteri Ada");
  });

  it("renders through the ContentPort rather than importing JSON in a component", () => {
    const adapter = new JsonContentAdapter([fixtureBundle()]);
    render(
      createElement(ContentRenderer, {
        port: adapter,
        id: "contract.greeting",
        locale: "tr-TR",
        values: { name: "Ada" },
      }),
    );
    expect(screen.getByText("Merhaba Ada")).toBeInTheDocument();
  });

  it("loads JSON dynamically and installs an HMR invalidation path", () => {
    const loader = readFileSync(path.join(CONTENT_ROOT, "loaders/json-content-loader.ts"), "utf8");
    expect(loader).toMatch(/import\.meta\.glob/u);
    expect(loader).toMatch(/import\.meta\.hot/u);
    expect(loader).toMatch(/replaceBundles/u);
  });

  it("rejects unsafe regular expressions before an ECA action can use them", () => {
    expect(() => compileSafePattern("(a+)+$", "g")).toThrow(/unsafe|güvenli|nested|repeat/iu);
    expect(() => compileSafePattern("(a+){20,}$", "g")).toThrow(/unsafe|güvenli|nested|repeat/iu);
    expect(() => compileSafePattern("(a)\\1", "g")).toThrow(/unsafe|güvenli|backreference/iu);
    expect(() => compileSafePattern("a".repeat(257), "g")).toThrow(/length|uzun|256/iu);
    expect(compileSafePattern("\\bhibe\\b", "giu")).toBeInstanceOf(RegExp);
  });

  it("fails closed on ambiguous ECA priority and applies a deterministic replacement", () => {
    const rule = (id: string): ContentRule => ({
      id,
      contentId: "contract.greeting",
      event: "content.loaded",
      priority: 100,
      conditions: [{ path: "role", operator: "eq", value: "customer" }],
      actions: [{ type: "replacePattern", pattern: "Merhaba", flags: "gu", replacement: "Selam" }],
    });

    expect(() =>
      applyContentRules({
        text: "Merhaba Ada",
        contentId: "contract.greeting",
        event: "content.loaded",
        context: { role: "customer" },
        rules: [rule("r-1"), rule("r-2")],
      }),
    ).toThrow(/duplicate|priority|çakış/iu);

    expect(
      applyContentRules({
        text: "Merhaba Ada",
        contentId: "contract.greeting",
        event: "content.loaded",
        context: { role: "customer" },
        rules: [rule("r-1")],
      }),
    ).toBe("Selam Ada");
  });

  it("does not execute raw HTML or arbitrary JavaScript from content", () => {
    const sources = REQUIRED_FILES.filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"))
      .map((file) => readFileSync(path.join(CONTENT_ROOT, file), "utf8"))
      .join("\n");
    expect(sources).not.toMatch(/dangerouslySetInnerHTML|\beval\s*\(|new Function/u);
  });

  it("leaves no user-visible literal in the new cockpit TypeScript components", () => {
    const offenders = sourceFiles(COCKPIT_ROOT).filter((file) => !file.endsWith(".stories.tsx")).flatMap((file) =>
      visibleLiterals(file).map((literal) => `${path.relative(COCKPIT_ROOT, file)}: ${literal}`),
    );
    expect(offenders).toEqual([]);
  });

  it("keeps the clean panel route and workspace gate fully JSON-authored", () => {
    const surfaces = [
      "src/routes/panel.tsx",
      "src/routes/workspace-gate.tsx",
      "src/domain/assistant.ts",
      "src/foundation/link.tsx",
      "src/foundation/states.tsx",
    ];
    const offenders = surfaces.flatMap((surface) => {
      const file = path.resolve(process.cwd(), surface);
      return visibleLiterals(file).map((literal) => `${surface}: ${literal}`);
    });
    expect(offenders).toEqual([]);
  });
});
