import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");

const cleanFiles = [
  "src/components/cognitive-file-library/CognitiveFileLibrary.tsx",
  "src/components/cognitive-file-library/cognitive-file-library.css",
  "src/components/cognitive-file-library/cognitive-file-library.stories.tsx",
  "src/components/cognitive-provider-center/CognitiveProviderCenter.tsx",
  "src/components/cognitive-provider-center/cognitive-provider-center.css",
  "src/components/cognitive-provider-center/cognitive-provider-center.stories.tsx",
  "src/routes/files.tsx",
  "src/routes/ai-providers.tsx",
] as const;

const forbiddenLegacyFiles = [
  "src/routes/media.tsx",
  "src/routes/providers.tsx",
  "src/design/media.css",
  "src/design/provider-connections.css",
  "src/components/media/MediaDetails.tsx",
  "src/components/media/MediaGovernancePanel.tsx",
  "src/components/media/MediaLibrary.tsx",
  "src/components/media/MediaOrganizer.tsx",
  "src/components/media/MediaStoragePanel.tsx",
  "src/components/media/MediaUploadPanel.tsx",
  "src/components/media/configs.tsx",
  "src/components/provider-connections/ConnectionHealthPanel.tsx",
  "src/components/provider-connections/ConnectionInventory.tsx",
  "src/components/provider-connections/ConnectionWizard.tsx",
  "src/components/provider-connections/DataRoutingDisclosure.tsx",
  "src/components/provider-connections/ProviderAuditTimeline.tsx",
  "src/components/provider-connections/ProviderCatalogView.tsx",
  "src/components/provider-connections/RoutingPolicyBuilder.tsx",
  "src/components/provider-connections/SecretField.tsx",
  "src/components/provider-connections/configs.tsx",
] as const;

describe("W2 clean file and provider routes", () => {
  it("creates clean-room master components, stories, routes and JSON bundles", () => {
    for (const path of cleanFiles) expect(existsSync(join(root, path)), path).toBe(true);
    for (const path of [
      "src/content/base/tr-TR/file-library.json",
      "src/content/base/tr-TR/ai-provider-center.json",
    ]) {
      expect(() => JSON.parse(source(path)), path).not.toThrow();
    }
  });

  it("removes the rejected media and provider visual implementation", () => {
    for (const path of forbiddenLegacyFiles) expect(existsSync(join(root, path)), path).toBe(false);
  });

  it("keeps the surviving media and provider barrels logic-only", () => {
    const barrels = [
      source("src/components/media/index.ts"),
      source("src/components/provider-connections/index.ts"),
    ].join("\n");
    expect(barrels).not.toMatch(/\.\/(?:configs|Media|Connection|Provider|DataRouting|Routing|Secret)/u);
    expect(source("src/components/index.ts")).not.toContain('export * from "./media"');
  });

  it("routes both journeys directly through the clean modules", () => {
    const router = source("src/app/router.tsx");
    expect(router).toContain('import("@/routes/files")');
    expect(router).toContain('import("@/routes/ai-providers")');
    expect(router).not.toMatch(/@\/routes\/(?:media|providers)/u);
  });

  it("does not carry old CSS, old barrels, raw SVG or hard-coded Turkish product copy", () => {
    const cleanGraph = cleanFiles.map(source).join("\n");
    expect(cleanGraph).not.toMatch(/\bdt-[a-z0-9-]+/u);
    expect(cleanGraph).not.toMatch(/@\/components(?:\/ui|["'])/u);
    expect(cleanGraph).not.toMatch(/<svg\b|<path\b/u);
    expect(cleanGraph).not.toMatch(/["'`](?:Dosya|Yapay zekâ|Sağlayıcı|Yükle|Bağlantı)[^"'`]*["'`]/u);
    expect(cleanGraph).toContain("resolveContent(");
  });

  it("ships skeleton-first state coverage and adaptive-fluid component CSS", () => {
    const stories = [
      source("src/components/cognitive-file-library/cognitive-file-library.stories.tsx"),
      source("src/components/cognitive-provider-center/cognitive-provider-center.stories.tsx"),
    ].join("\n");
    for (const state of ["Loading", "Empty", "Error", "Offline", "Permission", "Success"]) {
      expect(stories, state).toMatch(new RegExp(`export const ${state}\\b`, "u"));
    }

    const css = [
      source("src/components/cognitive-file-library/cognitive-file-library.css"),
      source("src/components/cognitive-provider-center/cognitive-provider-center.css"),
    ].join("\n");
    expect(css).toContain("container-type:");
    expect(css).toMatch(/@container\b/u);
    expect(css).toMatch(/prefers-reduced-motion/u);
    expect(css).not.toMatch(/border-radius:\s*(?:1[3-9]|[2-9]\d)px/u);
  });
});
