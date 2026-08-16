import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const COMPONENT_ROOT = join(ROOT, "src", "components", "cognitive-cockpit");
const DESIGN_SHA = "23c3729ad1856d056699d68503e2d92a0f996ba57f531fe1edc7e00bb85fd146";

const read = (...parts: string[]) => {
  const path = join(ROOT, ...parts);
  return existsSync(path) ? readFileSync(path, "utf8") : "";
};

describe("00aa cognitive cockpit is the canonical Storybook and application surface", () => {
  const requiredModules = [
    "CognitiveCockpitDashboard.tsx",
    "CognitiveCockpitSkeleton.tsx",
    "CognitiveSpotlightHeader.tsx",
    "CognitiveCommandDrawer.tsx",
    "CognitiveAccountMenu.tsx",
    "cognitive-cockpit.css",
    "cognitive-cockpit.stories.tsx",
    "index.ts",
  ] as const;

  it.each(requiredModules)("ships the clean-room %s module", (name) => {
    expect(existsSync(join(COMPONENT_ROOT, name))).toBe(true);
  });

  it("pins the visual authority without importing the standalone prototype", () => {
    const index = read("src", "components", "cognitive-cockpit", "index.ts");
    const dashboard = read(
      "src",
      "components",
      "cognitive-cockpit",
      "CognitiveCockpitDashboard.tsx",
    );
    expect(index + dashboard).toContain(DESIGN_SHA);
    expect(index + dashboard).not.toMatch(/Downloads\/00aa|standalone\.html/u);
  });

  it("renders Storybook and /panel from the same canonical dashboard component", () => {
    const story = read(
      "src",
      "components",
      "cognitive-cockpit",
      "cognitive-cockpit.stories.tsx",
    );
    const app = read("src", "routes", "app.tsx");
    expect(story).toMatch(/import\s+\{?\s*CognitiveCockpitDashboard/u);
    expect(app).toMatch(
      /import\s+\{[^}]*CognitiveCockpitDashboard[^}]*\}\s+from\s+["']@\/components\/cognitive-cockpit["']/su,
    );
    expect(story).toMatch(/component:\s*CognitiveCockpitDashboard/u);
  });

  it("removes the rejected AdaptiveShell from the active dashboard route only", () => {
    const app = read("src", "routes", "app.tsx");
    const dashboardRoute =
      /export function DashboardRoute\(\)[\s\S]*?(?=\/\*\s*-+\s*discovery)/u.exec(app)?.[0] ?? "";
    expect(dashboardRoute).toContain("<CognitiveCockpitDashboard");
    expect(dashboardRoute).not.toContain("<Shell");
    expect(dashboardRoute).not.toContain("<AdaptiveShell");
  });
});

describe("adaptive-fluid and skeleton-first contracts", () => {
  it("adapts at component-container level instead of branching on viewport width", () => {
    const css = read("src", "components", "cognitive-cockpit", "cognitive-cockpit.css");
    const dashboard = read(
      "src",
      "components",
      "cognitive-cockpit",
      "CognitiveCockpitDashboard.tsx",
    );
    expect(css).toMatch(/container-type:\s*inline-size/u);
    expect(css).toMatch(/@container/u);
    expect(css).toMatch(/clamp\(/u);
    expect(css).toMatch(/minmax\(/u);
    expect(dashboard).not.toMatch(/window\.innerWidth|matchMedia|useMediaQuery/u);
  });

  it("declares real theme and density state hooks whose tokens can change computed styles", () => {
    const dashboard = read(
      "src",
      "components",
      "cognitive-cockpit",
      "CognitiveCockpitDashboard.tsx",
    );
    const css = read("src", "components", "cognitive-cockpit", "cognitive-cockpit.css");
    expect(dashboard).toMatch(/data-theme=/u);
    expect(dashboard).toMatch(/data-density=/u);
    expect(css).toMatch(/\[data-theme=["']dark["']\]/u);
    expect(css).toMatch(/\[data-density=["']compact["']\]/u);
  });

  it("defines every enterprise read state rather than treating failures as empty data", () => {
    const source = read(
      "src",
      "components",
      "cognitive-cockpit",
      "CognitiveCockpitDashboard.tsx",
    );
    for (const state of [
      "loading",
      "empty",
      "no-result",
      "error",
      "partial",
      "success",
      "permission",
      "offline",
      "stale",
    ]) {
      expect(source, `${state} durumu eksik`).toContain(`"${state}"`);
    }
  });

  it("registers the dashboard and its shape-matched skeleton before integration", () => {
    const registry = read("src", "components", "registry.ts");
    const skeletonMap = read("src", "components", "ui", "skeleton-map.ts");
    const skeleton = read(
      "src",
      "components",
      "cognitive-cockpit",
      "CognitiveCockpitSkeleton.tsx",
    );
    expect(registry).toContain("CognitiveCockpitDashboard");
    expect(skeletonMap).toContain("CognitiveCockpitDashboard");
    expect(skeleton).toMatch(/aria-busy|role=["']status["']/u);
  });
});
