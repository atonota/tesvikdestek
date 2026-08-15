import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";

import { server } from "@/mocks/server";
import { useUiStore } from "@/store/ui";

beforeAll(() => {
  // Any request the handlers do not cover is a test bug, not a fallback.
  server.listen({ onUnhandledRequest: "error" });

  // jsdom implements neither of these, and several components read them.
  if (!window.matchMedia) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  }
  if (!window.ResizeObserver) {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }

  /**
   * Pointer capture and scrolling, which jsdom does not implement.
   *
   * The custom select is a real popover: it captures the pointer while
   * dragging and scrolls the active option into view. Neither exists in jsdom,
   * so without these the control throws before a single assertion runs. These
   * are shims for a missing environment, not stubs for product behaviour - the
   * keyboard and ARIA contract they let us test is the real one.
   */
  const element = window.Element.prototype as unknown as Record<string, unknown>;
  element["hasPointerCapture"] ??= () => false;
  element["setPointerCapture"] ??= () => undefined;
  element["releasePointerCapture"] ??= () => undefined;
  element["scrollIntoView"] ??= () => undefined;
});

afterEach(() => {
  cleanup();
  server.resetHandlers();

  /**
   * Transient panel state is a module singleton and survives `cleanup()`.
   *
   * A test that opens the navigation sheet used to leave it open for every
   * later test in the same file - and because an open sheet is modal, it marks
   * the whole page `aria-hidden`, so the next test's perfectly correct query
   * found nothing. The failure looked like a bug in the component under test.
   * Appearance is left alone: it is what `applyAppearance` writes to <html> and
   * several tests assert on it directly.
   */
  useUiStore.setState({ navDrawerOpen: false, evidencePanelOpen: true });
});

afterAll(() => {
  server.close();
});
