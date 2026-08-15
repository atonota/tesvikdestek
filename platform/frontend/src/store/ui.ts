/**
 * UI state only - never server state, never anything about the user.
 *
 * What may live here: density, theme, motion, font scale, which panel is open.
 * What may never live here: session tokens, e-mail, company facts, decisions.
 * The persisted key is namespaced and holds appearance preferences alone, which
 * is why persisting it is safe.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Density = "comfortable" | "compact" | "dense";
export type ThemeChoice = "system" | "light" | "dark";
export type FontScale = "normal" | "large";

export interface UiState {
  density: Density;
  theme: ThemeChoice;
  fontScale: FontScale;
  reducedMotion: boolean;
  navDrawerOpen: boolean;
  evidencePanelOpen: boolean;
  setDensity: (density: Density) => void;
  setTheme: (theme: ThemeChoice) => void;
  setFontScale: (scale: FontScale) => void;
  setReducedMotion: (reduced: boolean) => void;
  toggleNavDrawer: (open?: boolean) => void;
  toggleEvidencePanel: (open?: boolean) => void;
}

export const UI_STORAGE_KEY = "destektesvik.appearance";

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      density: "comfortable",
      theme: "system",
      fontScale: "normal",
      reducedMotion: false,
      navDrawerOpen: false,
      evidencePanelOpen: true,
      setDensity: (density) => set({ density }),
      setTheme: (theme) => set({ theme }),
      setFontScale: (fontScale) => set({ fontScale }),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
      toggleNavDrawer: (open) =>
        set((state) => ({ navDrawerOpen: open ?? !state.navDrawerOpen })),
      toggleEvidencePanel: (open) =>
        set((state) => ({ evidencePanelOpen: open ?? !state.evidencePanelOpen })),
    }),
    {
      name: UI_STORAGE_KEY,
      // Only appearance is persisted. Transient panel state is not.
      partialize: (state) => ({
        density: state.density,
        theme: state.theme,
        fontScale: state.fontScale,
        reducedMotion: state.reducedMotion,
      }),
    },
  ),
);

/** Apply appearance to the document root; called once by the shell. */
export function applyAppearance(state: Pick<
  UiState,
  "density" | "theme" | "fontScale" | "reducedMotion"
>): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset["density"] = state.density;
  root.dataset["fontScale"] = state.fontScale;
  root.dataset["reducedMotion"] = String(state.reducedMotion);
  if (state.theme === "system") {
    delete root.dataset["theme"];
  } else {
    root.dataset["theme"] = state.theme;
  }
}
