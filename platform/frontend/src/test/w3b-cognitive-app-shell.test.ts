import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), "utf8");

describe("the supplied cognitive master shell is the only active workspace chrome", () => {
  it.each([
    "CognitiveAppShell.tsx",
    "ModalLayerHost.tsx",
    "NavigationSheet.tsx",
  ])("ships %s in the canonical cognitive-cockpit package", (name) => {
    expect(existsSync(join(ROOT, "src", "components", "cognitive-cockpit", name))).toBe(true);
  });

  it("composes header, navigation sheet and modal layers in one Storybook-owned master", () => {
    const shell = read("src", "components", "cognitive-cockpit", "CognitiveAppShell.tsx");
    const stories = read("src", "components", "cognitive-cockpit", "cognitive-cockpit.stories.tsx");

    expect(shell).toContain("CognitiveSpotlightHeader");
    expect(shell).toContain("NavigationSheet");
    expect(shell).toContain("ModalLayerHost");
    expect(stories).toContain("CognitiveAppShell");
  });

  it("wraps the complete private route tree once instead of rendering AdaptiveShell per page", () => {
    const router = read("src", "app", "router.tsx");
    const workspaceShell = read("src", "routes", "workspace-shell.tsx");
    const legacyRoutes = read("src", "routes", "app.tsx");

    expect(router).toContain("workspace-shell");
    expect(workspaceShell).toContain("CognitiveAppShell");
    expect(workspaceShell).toContain("<Outlet");
    expect(legacyRoutes).not.toMatch(/\bAdaptiveShell\b/u);
  });

  it("keeps scrim and blur ownership inside ModalLayerHost", () => {
    const layers = read("src", "components", "cognitive-cockpit", "ModalLayerHost.tsx");
    const navigation = read("src", "components", "cognitive-cockpit", "NavigationSheet.tsx");
    const shell = read("src", "components", "cognitive-cockpit", "CognitiveAppShell.tsx");

    expect(layers).toMatch(/page/u);
    expect(layers).toMatch(/nested/u);
    expect(layers).toMatch(/scrim|overlay/u);
    expect(navigation).not.toContain("SheetOverlay");
    expect(shell).not.toContain("SheetOverlay");
  });

  it("removes the superseded drawer and its second overlay implementation", () => {
    const componentRoot = join(ROOT, "src", "components", "cognitive-cockpit");
    const index = read("src", "components", "cognitive-cockpit", "index.ts");

    expect(existsSync(join(componentRoot, "CognitiveCommandDrawer.tsx"))).toBe(false);
    expect(index).not.toContain("CognitiveCommandDrawer");
  });
});
