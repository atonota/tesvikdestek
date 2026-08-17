import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const PACKAGE_ROOT = join(ROOT, "src", "components", "cognitive-opportunity-workspace");
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), "utf8");

describe("the cognitive opportunity workspace is the canonical opportunities surface", () => {
  it.each([
    "CognitiveOpportunityList.tsx",
    "CognitiveOpportunityDetail.tsx",
    "CognitiveOpportunityWorkspaceSkeleton.tsx",
    "cognitive-opportunity-workspace.css",
    "cognitive-opportunity-workspace.stories.tsx",
    "index.ts",
  ])("ships %s in one Storybook-owned package", (name) => {
    expect(existsSync(join(PACKAGE_ROOT, name))).toBe(true);
  });

  it("routes production through the package without re-exporting the rejected templates", () => {
    const route = read("src", "routes", "opportunities.tsx");
    const barrel = read("src", "components", "cognitive-opportunity-workspace", "index.ts");

    expect(route).toContain("@/components/cognitive-opportunity-workspace");
    expect(route).toContain("useProgramsQuery");
    expect(route).toContain("useSnapshotsQuery");
    expect(barrel).toContain("CognitiveOpportunityList");
    expect(barrel).toContain("CognitiveOpportunityDetail");
    expect(barrel).not.toMatch(/CatalogList|OpportunityDetail\s+from\s+["']\.\.\//u);
  });

  it("keeps every visible product label in the JSON content authority", () => {
    const bundlePath = join(ROOT, "src", "content", "base", "tr-TR", "opportunity-workspace.json");
    expect(existsSync(bundlePath)).toBe(true);
    const bundle = JSON.parse(readFileSync(bundlePath, "utf8")) as {
      readonly entries?: readonly { readonly id?: string }[];
    };
    const ids = (bundle.entries ?? []).map((entry) => entry.id ?? "");
    expect(ids.some((id) => id.startsWith("opportunity.list."))).toBe(true);
    expect(ids.some((id) => id.startsWith("opportunity.detail."))).toBe(true);
    expect(ids.some((id) => id.startsWith("opportunity.state."))).toBe(true);
    expect(ids.some((id) => id.startsWith("opportunity.story."))).toBe(true);
  });

  it("documents enterprise read states and a shape-matched skeleton in Storybook", () => {
    const stories = read(
      "src",
      "components",
      "cognitive-opportunity-workspace",
      "cognitive-opportunity-workspace.stories.tsx",
    );
    for (const state of [
      "Loading",
      "Empty",
      "FilteredEmpty",
      "Success",
      "SessionError",
      "GenericError",
      "WithSources",
      "WithoutSources",
      "UnreadRegistry",
      "NotFound",
      "AtPhone320",
    ]) {
      expect(stories, `${state} story eksik`).toContain(`export const ${state}`);
    }
    expect(stories).toContain("CognitiveOpportunityWorkspaceSkeleton");
    expect(stories).toContain("resolveContent");
    for (const rejectedLiteral of [
      "KOBİ Dijital Dönüşüm Desteği",
      "Sanayi Ar-Ge Projeleri Destekleme Programı",
      "Vergi levhası",
      "Faaliyet belgesi",
      "Giriş yap",
      "İstek başarısız (500)",
      "KOSGEB Dijital Dönüşüm Destek Programı Uygulama Esasları",
      "Resmî Gazete Yayımı",
    ]) {
      expect(stories, `Storybook görünür metni JSON dışında: ${rejectedLiteral}`).not.toContain(
        rejectedLiteral,
      );
    }
  });
});
