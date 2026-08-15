import { beforeEach, describe, expect, it } from "vitest";

import { applyAppearance, UI_STORAGE_KEY, useUiStore } from "./ui";

beforeEach(() => {
  useUiStore.setState({
    density: "comfortable",
    theme: "system",
    fontScale: "normal",
    reducedMotion: false,
    navDrawerOpen: false,
    evidencePanelOpen: true,
  });
});

describe("UI store", () => {
  it("updates each appearance setting", () => {
    useUiStore.getState().setDensity("dense");
    useUiStore.getState().setTheme("dark");
    useUiStore.getState().setFontScale("large");
    useUiStore.getState().setReducedMotion(true);
    const state = useUiStore.getState();
    expect(state).toMatchObject({
      density: "dense",
      theme: "dark",
      fontScale: "large",
      reducedMotion: true,
    });
  });

  it("toggles panels explicitly and implicitly", () => {
    useUiStore.getState().toggleNavDrawer();
    expect(useUiStore.getState().navDrawerOpen).toBe(true);
    useUiStore.getState().toggleNavDrawer(false);
    expect(useUiStore.getState().navDrawerOpen).toBe(false);
    useUiStore.getState().toggleEvidencePanel(false);
    expect(useUiStore.getState().evidencePanelOpen).toBe(false);
  });

  it("persists appearance only, never anything about the user", () => {
    useUiStore.getState().setDensity("compact");
    const raw = window.localStorage.getItem(UI_STORAGE_KEY);
    expect(raw).toBeTruthy();
    const persisted = JSON.parse(raw ?? "{}") as { state: Record<string, unknown> };
    expect(Object.keys(persisted.state).sort()).toEqual([
      "density",
      "fontScale",
      "reducedMotion",
      "theme",
    ]);
    // Nothing identifying may be written under any key.
    expect(raw).not.toMatch(/eposta|parola|token|tenant|@/iu);
  });

  it("writes appearance onto the document root", () => {
    applyAppearance({
      density: "compact",
      theme: "light",
      fontScale: "normal",
      reducedMotion: false,
    });
    expect(document.documentElement.dataset["density"]).toBe("compact");
    expect(document.documentElement.dataset["theme"]).toBe("light");
  });
});
