/**
 * The 320px shell: two sheets, not two inline appendices.
 *
 * What a live browser at 320x568 actually showed, and what these tests pin:
 *
 *  - the left navigation was an inline accordion. It pushed the page down
 *    instead of covering it, had no backdrop, ignored Escape, and let Tab walk
 *    straight out of the open menu into the page behind it. A menu you can tab
 *    out of without closing is a menu a keyboard user loses.
 *  - the right assistant became an ~810px appendix glued to the bottom of the
 *    document. It was not reachable from any header control, and on a phone it
 *    was simply a very long scroll nobody asked for.
 *
 * Both are now real dialogs: modal, backdropped, Escape-closable, focus-trapped
 * while open and focus-restoring on close. That behaviour is not decoration -
 * it is the difference between a panel and a trap.
 *
 * jsdom reports `matches: false` for every media query (see `test/setup.ts`),
 * so this file is the *mobile* state by construction. The desktop state is
 * asserted in the Playwright suite, which has a layout engine.
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { AdaptiveShell } from "./AdaptiveShell";

/**
 * Short labels differ from full ones on purpose: the thumb bar legitimately
 * repeats the same destinations, so a query for the *full* label is the only
 * one that can tell "the sheet is open" from "the bottom bar exists".
 */
const NAV = [
  { to: "/panel", label: "Kokpit", shortLabel: "Kkpt", icon: "◧" },
  { to: "/degerlendirmeler", label: "Kararlar", shortLabel: "Krlr", icon: "▤" },
];

/**
 * `contextRail` is passed explicitly rather than through a default parameter:
 * `undefined` is a meaningful value here - it is how a route says "this page
 * has no context to offer" - and a default would silently swallow it.
 */
function shell({
  contextRail,
}: { contextRail?: React.ReactNode } = { contextRail: <p>Yardımcı gövdesi</p> }) {
  return render(
    <MemoryRouter>
      <AdaptiveShell navItems={NAV} title="Kokpit" contextRail={contextRail}>
        <h1>Kokpit</h1>
        <a href="#sonra">Sayfadaki bağlantı</a>
      </AdaptiveShell>
    </MemoryRouter>,
  );
}

/** True when the shell sits inside an `aria-hidden` subtree - i.e. behind a modal. */
function hiddenBehindSheet(): boolean {
  const shellRoot = document.querySelector(".dt-shell");
  expect(shellRoot, "the shell did not render").not.toBeNull();
  return shellRoot?.closest('[aria-hidden="true"]') !== null;
}

/* ------------------------------------------------------------- navigation */

describe("the mobile navigation is a sheet, not an inline accordion", () => {
  it("shows no navigation links until the sheet is opened", () => {
    shell();
    expect(screen.queryByRole("link", { name: "Kararlar" })).toBeNull();
  });

  it("opens a modal dialog with a backdrop from the header control", async () => {
    shell();
    await userEvent.click(screen.getByRole("button", { name: /Menüyü aç/u }));

    const sheet = await screen.findByRole("dialog", { name: /Ana gezinme/u });
    expect(within(sheet).getByRole("link", { name: "Kararlar" })).toBeInTheDocument();
    expect(document.querySelector(".dt-sheet__overlay")).not.toBeNull();
    // Modality asserted as the effect that matters rather than as one
    // attribute: while the sheet is open, the page behind it is out of the
    // accessibility tree entirely, so nothing there can be read or reached.
    expect(hiddenBehindSheet()).toBe(true);
  });

  it("puts the page back in the accessibility tree once the sheet closes", async () => {
    shell();
    await userEvent.click(screen.getByRole("button", { name: /Menüyü aç/u }));
    await screen.findByRole("dialog", { name: /Ana gezinme/u });
    expect(hiddenBehindSheet()).toBe(true);

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(hiddenBehindSheet()).toBe(false);
  });

  it("closes on Escape and hands focus back to the control that opened it", async () => {
    shell();
    const toggle = screen.getByRole("button", { name: /Menüyü aç/u });
    await userEvent.click(toggle);
    await screen.findByRole("dialog", { name: /Ana gezinme/u });

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Menüyü aç/u })).toHaveFocus(),
    );
  });

  it("contains focus while open: the page behind it is not reachable by Tab", async () => {
    shell();
    await userEvent.click(screen.getByRole("button", { name: /Menüyü aç/u }));
    const sheet = await screen.findByRole("dialog", { name: /Ana gezinme/u });

    for (let step = 0; step < 8; step += 1) {
      await userEvent.tab();
      expect(sheet.contains(document.activeElement)).toBe(true);
    }
  });

  it("keeps the navigation landmark in the document in both states", () => {
    // The landmark is what a screen reader walks to; the sheet is what the
    // button opens. They are different elements and only one of them is the
    // control's `aria-controls` target - see `adaptive-responsive.test.tsx`.
    shell();
    const toggle = screen.getByRole("button", { name: /Menüyü aç/u });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("navigation", { name: /Ana gezinme/u })).toContainElement(toggle);
    const controls = toggle.getAttribute("aria-controls");
    if (controls !== null) {
      expect(document.getElementById(controls), `${controls} is dangling`).not.toBeNull();
    }
  });

  it("closes when a destination is chosen", async () => {
    shell();
    await userEvent.click(screen.getByRole("button", { name: /Menüyü aç/u }));
    const sheet = await screen.findByRole("dialog", { name: /Ana gezinme/u });
    await userEvent.click(within(sheet).getByRole("link", { name: "Kararlar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

/* -------------------------------------------------------------- assistant */

describe("the mobile assistant is a sheet reached from the header", () => {
  it("keeps the assistant body out of the document until it is asked for", () => {
    shell();
    expect(screen.queryByText("Yardımcı gövdesi")).toBeNull();
    expect(screen.getByRole("button", { name: /Yardımcı/u })).toBeInTheDocument();
  });

  it("opens a modal dialog carrying exactly one copy of the assistant", async () => {
    shell();
    await userEvent.click(screen.getByRole("button", { name: /Yardımcı/u }));

    await screen.findByRole("dialog", { name: /Bağlam ve yardımcı/u });
    expect(hiddenBehindSheet()).toBe(true);
    // Exactly one copy of the assistant exists, in the sheet. Rendering both a
    // sheet and an inline column and hiding one with CSS would put the whole
    // panel in the document twice.
    expect(screen.getAllByText("Yardımcı gövdesi")).toHaveLength(1);
  });

  it("closes on Escape and restores focus to the header control", async () => {
    shell();
    await userEvent.click(screen.getByRole("button", { name: /Yardımcı/u }));
    await screen.findByRole("dialog", { name: /Bağlam ve yardımcı/u });

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(screen.getByRole("button", { name: /Yardımcı/u })).toHaveFocus());
  });

  it("contains focus while open", async () => {
    shell();
    await userEvent.click(screen.getByRole("button", { name: /Yardımcı/u }));
    const sheet = await screen.findByRole("dialog", { name: /Bağlam ve yardımcı/u });

    for (let step = 0; step < 6; step += 1) {
      await userEvent.tab();
      expect(sheet.contains(document.activeElement)).toBe(true);
    }
  });

  it("offers no assistant control at all when the route has no context to show", () => {
    shell({});
    expect(screen.queryByRole("button", { name: /Yardımcı/u })).toBeNull();
    expect(screen.queryByRole("complementary")).toBeNull();
  });
});
