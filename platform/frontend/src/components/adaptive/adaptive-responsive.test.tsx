/**
 * What happens at the moment the layout changes, and what `aria-controls`
 * actually points at.
 *
 * Two defects live here, and neither is visible in a test that only ever
 * renders one viewport.
 *
 * **The drawer outlived the layout that had one.** `navDrawerOpen` is global
 * store state, and only the 320px branch renders a control for it. Opening the
 * menu on a phone, widening to a desktop and narrowing back left the store
 * saying `true` the whole time - so the navigation sheet reappeared, modal and
 * focus-trapping, with the person having asked for nothing. The shell now closes
 * what it is about to stop rendering, exactly once, on the crossing.
 *
 * **`aria-controls` pointed at the wrong element.** The trigger claimed to
 * control the `<nav>` landmark that *contains it*, while the thing it opens is a
 * portalled `Dialog.Content` somewhere else in the document. A control that
 * says it controls its own ancestor tells a screen reader user to go looking in
 * the place they already are. The id belongs on the dialog.
 *
 * jsdom answers `false` for every media query by default (`test/setup.ts`), so
 * a controllable `matchMedia` is installed here - a real subscription with real
 * change events, not a re-render with a different prop.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import { useUiStore } from "@/store/ui";
import { AdaptiveShell } from "./AdaptiveShell";

const NAV = [
  { to: "/panel", label: "Kokpit", shortLabel: "Kkpt", icon: "◧" },
  { to: "/degerlendirmeler", label: "Kararlar", shortLabel: "Krlr", icon: "▤" },
];

/**
 * A `matchMedia` that can actually change its mind.
 *
 * The hook under test subscribes with `addEventListener("change", …)` and reads
 * `.matches` on every snapshot, so the fake has to honour both - a stub that
 * only answers a fixed boolean can never exercise a crossing.
 */
function installMatchMedia(initial: boolean) {
  const listeners = new Set<() => void>();
  let matches = initial;
  const original = window.matchMedia;

  window.matchMedia = ((query: string) => ({
    get matches() {
      return matches;
    },
    media: query,
    onchange: null,
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
    addListener: (listener: () => void) => listeners.add(listener),
    removeListener: (listener: () => void) => listeners.delete(listener),
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;

  return {
    set(next: boolean) {
      matches = next;
      act(() => {
        for (const listener of [...listeners]) listener();
      });
    },
    restore() {
      window.matchMedia = original;
      listeners.clear();
    },
  };
}

let media: ReturnType<typeof installMatchMedia> | null = null;

afterEach(() => {
  media?.restore();
  media = null;
});

function shell() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AdaptiveShell navItems={NAV} title="Kokpit" contextRail={<p>Yardımcı gövdesi</p>}>
          <h1>Kokpit</h1>
        </AdaptiveShell>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/* ------------------------------------------------- crossing the breakpoint */

describe("a panel opened on a phone does not survive a trip to the desktop", () => {
  /**
   * Cognitive Shell V2 retired the layout branch this test used to guard.
   *
   * There is no longer a desktop-only rail for navigation to become on the
   * way past 64rem - the shared adaptive drawer *is* navigation at every
   * width, per `cognitive-shell-v2.spec.ts`'s "the drawer replaces the
   * desktop persistent rail entirely". So a drawer a phone-width visitor
   * opened and then widened past the breakpoint is not a stale mobile panel
   * outliving its layout; it is the same control, open, on a wider screen -
   * which is the honest thing for it to keep being. The assistant sheet
   * below is a different mechanism (a layout-local `useState`, unmounted with
   * its own conditional column) and still behaves exactly as this file always
   * pinned.
   */
  it("keeps the adaptive drawer open across a crossing, the same drawer either width", async () => {
    media = installMatchMedia(false);
    shell();

    await userEvent.click(screen.getByRole("button", { name: /men(ü|u)/iu }));
    const dialog = await screen.findByRole("dialog");
    const dialogId = dialog.getAttribute("id");
    expect(useUiStore.getState().navDrawerOpen).toBe(true);

    media.set(true);
    // No effect fires on the crossing: the drawer is not layout-scoped, so
    // there is nothing here for a crossing to close.
    await waitFor(() => expect(screen.getByRole("dialog")).toHaveAttribute("id", dialogId));
    expect(useUiStore.getState().navDrawerOpen).toBe(true);
  });

  it("closes the assistant sheet on the same crossing", async () => {
    media = installMatchMedia(false);
    shell();

    await userEvent.click(screen.getByRole("button", { name: /Yardımcı/u }));
    await screen.findByRole("dialog", { name: /Bağlam ve yardımcı/u });

    media.set(true);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    media.set(false);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Yardımcı/u })).toBeInTheDocument(),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: /Yardımcı/u })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("writes no drawer state at all on a crossing - there is no layout-scoped effect left to loop", async () => {
    media = installMatchMedia(false);
    shell();
    await userEvent.click(screen.getByRole("button", { name: /men(ü|u)/iu }));
    await screen.findByRole("dialog");

    let writes = 0;
    const unsubscribe = useUiStore.subscribe(() => {
      writes += 1;
    });
    media.set(true);
    // Give any stray effect a turn to fire before asserting silence.
    await Promise.resolve();
    await Promise.resolve();
    unsubscribe();

    expect(writes).toBe(0);
    expect(useUiStore.getState().navDrawerOpen).toBe(true);
  });

  it("leaves a closed drawer alone when the desktop layout mounts", async () => {
    media = installMatchMedia(true);
    let writes = 0;
    const unsubscribe = useUiStore.subscribe(() => {
      writes += 1;
    });
    shell();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /men(ü|u)/iu })).toBeInTheDocument(),
    );
    unsubscribe();

    expect(writes).toBe(0);
    expect(useUiStore.getState().navDrawerOpen).toBe(false);
  });
});

/* --------------------------------------------------------- aria-controls */

describe("a sheet trigger controls the dialog it opens, not its own ancestor", () => {
  it("points the navigation trigger at the dialog once it is open", async () => {
    media = installMatchMedia(false);
    shell();
    const toggle = screen.getByRole("button", { name: /men(ü|u)/iu });
    await userEvent.click(toggle);

    const sheet = await screen.findByRole("dialog");
    // The same node, held rather than re-queried: while the sheet is open the
    // page behind it is out of the accessibility tree, so a role query for the
    // trigger correctly finds nothing. That is the modality, not a defect.
    const controls = toggle.getAttribute("aria-controls");
    expect(controls, "the open trigger controls nothing").toBeTruthy();
    expect(document.getElementById(controls as string)).toBe(sheet);
    // The target is the panel, and the panel does not contain its own control.
    expect(sheet.contains(toggle)).toBe(false);
    expect(within(sheet).getByRole("link", { name: "Kararlar" })).toBeInTheDocument();
  });

  it("points the assistant trigger at its own dialog, not at the header aside", async () => {
    media = installMatchMedia(false);
    shell();
    const trigger = screen.getByRole("button", { name: /Yardımcı/u });
    await userEvent.click(trigger);

    const sheet = await screen.findByRole("dialog", { name: /Bağlam ve yardımcı/u });
    const controls = trigger.getAttribute("aria-controls");
    expect(controls).toBeTruthy();
    expect(document.getElementById(controls as string)).toBe(sheet);
    expect(sheet.contains(trigger)).toBe(false);
  });

  it("never leaves a dangling reference behind while the sheets are closed", () => {
    media = installMatchMedia(false);
    shell();
    for (const name of [/men(ü|u)/iu, /Yardımcı/u]) {
      const control = screen.getByRole("button", { name });
      expect(control).toHaveAttribute("aria-expanded", "false");
      const controls = control.getAttribute("aria-controls");
      // Either it names something real, or it names nothing at all. What it
      // must never do is point at an id that is not in the document.
      if (controls !== null) {
        expect(document.getElementById(controls), `${controls} is dangling`).not.toBeNull();
      }
    }
  });
});
