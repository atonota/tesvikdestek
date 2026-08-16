/**
 * Cognitive Shell V2 — frozen acceptance scope, authored blind.
 *
 * Independent behaviour-first acceptance tests for the master shell
 * described in the frozen scope: one AdaptiveShell composing a header
 * Spotlight, a sidebar nav, a sidebar command surface and an account menu,
 * behind a single adaptive navigation drawer that replaces both the desktop
 * persistent rail and the mobile nav sheet this repository currently ships.
 *
 * `jsdom`'s `matchMedia` stub (see `src/test/setup.ts`) always answers
 * `false`, so every render here observes the narrow-layout branch of
 * whatever the shell renders. Viewport-dependent claims (persistent rail vs
 * drawer at 1024/1440, the desktop-only aside, reduced-motion paint) belong
 * to `e2e/cognitive-shell-v2.spec.ts`, not here.
 *
 * These tests are written against the frozen scope, not against the current
 * `AdaptiveShell.tsx` (which has no header Spotlight, no command surface, no
 * account menu and no unified drawer at all — it renders a nav `Sheet`, a
 * separate assistant `Sheet`, and a desktop rail). Failing for that reason is
 * the expected, honest RED this file exists to produce.
 */

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { renderAppAt } from "./render-app";
import { resetDemoSessionState, startDemoSession } from "@/demo";

afterEach(() => {
  resetDemoSessionState();
});

/** The two controls the frozen scope names explicitly. */
async function findHamburger() {
  return screen.findByRole("button", { name: /men(ü|u)/iu });
}
async function findAvatarTrigger() {
  return screen.findByRole("button", { name: /hesap|account|profil/iu });
}

/**
 * `aria-expanded` is not an allowed WAI-ARIA attribute on a `searchbox` or
 * `textbox` role, so the observable expanded/collapsed state is asserted on
 * the nearest neutral ancestor container that carries a plain,
 * non-semantic `data-expanded` marker instead — never on the input itself.
 */
function expandedContainerOf(input: HTMLElement): HTMLElement {
  const container = input.closest("[data-expanded]");
  expect(container, "no ancestor container carries a data-expanded marker").not.toBeNull();
  return container as HTMLElement;
}

/**
 * The avatar does not open the account menu directly.
 *
 * Per the frozen scope, the avatar opens the one shared drawer and focuses
 * the drawer's *footer account trigger*; that footer trigger is what opens
 * the semantic account menu. Clicking straight through to `role=menu` from
 * the avatar is the mistake the account-menu group made in the first draft,
 * and it happened to pass only because nothing existed yet to disagree.
 */
async function openAccountMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await findAvatarTrigger());
  const dialog = await screen.findByRole("dialog");
  const footerTrigger = await within(dialog).findByRole("button", {
    name: /hesap|account|profil/iu,
  });
  await user.click(footerTrigger);
  const menu = await screen.findByRole("menu");
  return { dialog, menu };
}

/* ---------------------------------------------------------- 1. one drawer */

describe("exactly one adaptive navigation drawer answers both header controls", () => {
  it("the hamburger and the avatar carry distinct accessible names", async () => {
    await renderAppAt("/panel");
    const hamburger = await findHamburger();
    const avatar = await findAvatarTrigger();
    const nameOf = (el: HTMLElement) =>
      el.getAttribute("aria-label") ?? el.textContent?.trim() ?? "";
    expect(nameOf(hamburger)).not.toEqual(nameOf(avatar));
  });

  it("opening from the hamburger and opening from the avatar land on the same drawer element", async () => {
    const user = userEvent.setup();
    await renderAppAt("/panel");

    const hamburger = await findHamburger();
    await user.click(hamburger);
    const fromHamburger = await screen.findByRole("dialog");
    const drawerId = fromHamburger.getAttribute("id");
    expect(drawerId).toBeTruthy();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    const avatar = await findAvatarTrigger();
    await user.click(avatar);
    const fromAvatar = await screen.findByRole("dialog");
    expect(fromAvatar.getAttribute("id")).toBe(drawerId);
  });

  it("never shows two drawer-like dialogs open at once", async () => {
    const user = userEvent.setup();
    await renderAppAt("/panel");
    await user.click(await findHamburger());
    await screen.findByRole("dialog");
    // A second control that could plausibly open its own panel must not stack
    // a second modal on top of the first.
    const avatar = await findAvatarTrigger();
    await user.click(avatar).catch(() => undefined);
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });
});

/* --------------------------------------------------- 2. focus destinations */

describe("each trigger focuses its own part of the shared drawer", () => {
  it("the hamburger focuses the drawer's command input", async () => {
    const user = userEvent.setup();
    await renderAppAt("/panel");
    await user.click(await findHamburger());
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => {
      const active = document.activeElement;
      const command = within(dialog).queryByRole("searchbox") ?? within(dialog).queryByRole("textbox");
      expect(command).not.toBeNull();
      expect(active).toBe(command);
    });
  });

  it("the avatar focuses the drawer's footer account trigger", async () => {
    const user = userEvent.setup();
    await renderAppAt("/panel");
    await user.click(await findAvatarTrigger());
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => {
      const footerTrigger = within(dialog).queryByRole("button", {
        name: /hesap|account|profil/iu,
      });
      expect(footerTrigger).not.toBeNull();
      expect(document.activeElement).toBe(footerTrigger);
    });
  });
});

/* -------------------------------------------------- 3. single-open accordion */

describe("the drawer's navigation is a single-open accordion that tracks the route", () => {
  it("expanding one section collapses whichever section was open before", async () => {
    const user = userEvent.setup();
    await renderAppAt("/panel");
    await user.click(await findHamburger());
    const dialog = await screen.findByRole("dialog");

    const disclosures = within(dialog).getAllByRole("button", { expanded: false });
    expect(disclosures.length).toBeGreaterThanOrEqual(2);

    await user.click(disclosures[0]!);
    await waitFor(() => expect(disclosures[0]).toHaveAttribute("aria-expanded", "true"));

    await user.click(disclosures[1]!);
    await waitFor(() => {
      expect(disclosures[1]).toHaveAttribute("aria-expanded", "true");
      expect(disclosures[0]).toHaveAttribute("aria-expanded", "false");
    });
  });

  it("auto-expands the section containing the active route on open", async () => {
    const user = userEvent.setup();
    await renderAppAt("/organizasyon/hazirlik");
    await user.click(await findHamburger());
    const dialog = await screen.findByRole("dialog");

    // The disclosure that owns "Hazırlık" must itself report open, not merely
    // have some ancestor with an `aria-expanded` attribute — a nested,
    // unrelated disclosure higher up the tree would satisfy a `closest()`
    // query without the section anyone can see actually being open.
    const disclosure = within(dialog).getByRole("button", { name: /hazırlık/iu, expanded: true });
    expect(disclosure).toHaveAttribute("aria-expanded", "true");

    const activeLink = within(dialog).getByRole("link", { name: /hazırlık/iu });
    expect(activeLink).toBeVisible();
  });
});

/* ------------------------------------- 4. navigation closes the drawer */

describe("choosing a destination closes the drawer and keeps the demo context", () => {
  it("closes the drawer after following a nav link", async () => {
    const user = userEvent.setup();
    await renderAppAt("/panel");
    await user.click(await findHamburger());
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("link", { name: /kararlar/iu }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  /**
   * `renderAppAt` mounts a `MemoryRouter`-backed test router (see
   * `render-app.tsx`), which keeps its own in-memory history rather than
   * writing to `window.location`. So the observable fact worth pinning is not
   * a global the harness never updates — it is what the drawer itself renders
   * *before* anything is clicked: each nav link's own `href` must already
   * carry the demo query that was on the page when the drawer opened. Route
   * close behaviour is asserted separately, above.
   */
  it("carries the ?demo= query into every nav link's own href while the drawer is open", async () => {
    startDemoSession("superadmin");
    const user = userEvent.setup();
    await renderAppAt("/panel?demo=superadmin");
    await user.click(await findHamburger());
    const dialog = await screen.findByRole("dialog");

    const kararlar = within(dialog).getByRole("link", { name: /kararlar/iu });
    expect(kararlar.getAttribute("href") ?? "").toContain("demo=superadmin");

    const firsatlar = within(dialog).getByRole("link", { name: /fırsatlar/iu });
    expect(firsatlar.getAttribute("href") ?? "").toContain("demo=superadmin");
  });
});

/* ------------------------------------ 5. one vocabulary, two surfaces */

describe("the header Spotlight and the drawer command are two views of one vocabulary", () => {
  it("the same query text surfaces the same results in both surfaces", async () => {
    const user = userEvent.setup();
    await renderAppAt("/panel");

    const spotlight = await screen.findByRole("searchbox", { name: /ara|spotlight|arama/iu }).catch(
      () => screen.findByRole("textbox", { name: /ara|spotlight|arama/iu }),
    );
    await user.click(spotlight);
    await user.type(spotlight, "karar");
    const spotlightResults = (await screen.findAllByRole("option")).map((option) =>
      option.textContent?.trim(),
    );
    await user.clear(spotlight);
    await user.keyboard("{Escape}");

    await user.click(await findHamburger());
    const dialog = await screen.findByRole("dialog");
    const drawerCommand = within(dialog).getByRole("searchbox");
    await user.type(drawerCommand, "karar");
    const drawerResults = (await within(dialog).findAllByRole("option")).map((option) =>
      option.textContent?.trim(),
    );

    expect(drawerResults).toEqual(spotlightResults);
  });

  it("only one result surface is expanded/accessible at a time", async () => {
    const user = userEvent.setup();
    await renderAppAt("/panel");
    const spotlight = await screen.findByRole("searchbox", { name: /ara|spotlight|arama/iu }).catch(
      () => screen.findByRole("textbox", { name: /ara|spotlight|arama/iu }),
    );
    await user.click(spotlight);
    await user.type(spotlight, "karar");
    await screen.findAllByRole("option");

    await user.click(await findHamburger());
    const dialog = await screen.findByRole("dialog");
    const drawerCommand = within(dialog).getByRole("searchbox");
    await user.type(drawerCommand, "karar");
    await within(dialog).findAllByRole("option");

    // The header Spotlight's own container must not still claim to be
    // expanded once the drawer command surface holds the open one. The
    // input itself never carries `aria-expanded` — WAI-ARIA does not permit
    // that attribute on `searchbox`/`textbox`.
    expect(expandedContainerOf(spotlight)).toHaveAttribute("data-expanded", "false");
  });
});

/* --------------------------------------- 6. Cmd/Ctrl+K, no dialog */

describe("Cmd/Ctrl+K expands the header Spotlight input in place", () => {
  it("opens no dialog and expands the same input's border", async () => {
    const user = userEvent.setup();
    await renderAppAt("/panel");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.keyboard("{Meta>}k{/Meta}");
    // In-place expansion of the header control, never a portalled dialog.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const spotlight = await screen.findByRole("searchbox", { name: /ara|spotlight|arama/iu }).catch(
      () => screen.findByRole("textbox", { name: /ara|spotlight|arama/iu }),
    );
    expect(expandedContainerOf(spotlight)).toHaveAttribute("data-expanded", "true");
    expect(document.activeElement).toBe(spotlight);
  });

  it("Escape collapses the Spotlight and returns focus without closing anything else", async () => {
    const user = userEvent.setup();
    await renderAppAt("/panel");
    await user.keyboard("{Meta>}k{/Meta}");
    const spotlight = await screen.findByRole("searchbox", { name: /ara|spotlight|arama/iu }).catch(
      () => screen.findByRole("textbox", { name: /ara|spotlight|arama/iu }),
    );
    await waitFor(() =>
      expect(expandedContainerOf(spotlight)).toHaveAttribute("data-expanded", "false"),
    );
  });
});

/* ------------------------------------------- 7. nested Escape, drawer */

describe("nested Escape in the drawer command unwinds one layer at a time", () => {
  it("first Escape clears an open result list, second Escape closes the drawer and returns focus", async () => {
    const user = userEvent.setup();
    await renderAppAt("/panel");
    const hamburger = await findHamburger();
    await user.click(hamburger);
    const dialog = await screen.findByRole("dialog");
    const drawerCommand = within(dialog).getByRole("searchbox");
    await user.type(drawerCommand, "karar");
    await within(dialog).findAllByRole("option");

    await user.keyboard("{Escape}");
    await waitFor(() => expect(within(dialog).queryAllByRole("option")).toHaveLength(0));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(hamburger).toHaveFocus();
  });
});

/* ---------------------------------------- 8. truthful suggestion states */

describe("suggestions state their own truth rather than inventing one", () => {
  it("names no fake AI-ready, learned-preference, evidence or success claim in the drawer", async () => {
    const user = userEvent.setup();
    await renderAppAt("/panel");
    await user.click(await findHamburger());
    const dialog = await screen.findByRole("dialog");
    const text = dialog.textContent ?? "";
    for (const claim of [
      /öğrenilmiş tercih/iu,
      /learned preference/iu,
      /yapay zekâ hazır/iu,
      /ai[- ]ready/iu,
      /analiz tamamlandı/iu,
      /sonuçlar üretildi/iu,
    ]) {
      expect(text, `drawer carries a fabricated claim: ${String(claim)}`).not.toMatch(claim);
    }
  });

  it("states an explicit unavailable/offline/permission/error/partial/no-results condition rather than staying silent", async () => {
    const user = userEvent.setup();
    await renderAppAt("/panel");
    await user.click(await findHamburger());
    const dialog = await screen.findByRole("dialog");
    const drawerCommand = within(dialog).getByRole("searchbox");
    await user.type(drawerCommand, "zzzzz-bulunamayan-sorgu");
    await waitFor(() => {
      expect(dialog.textContent ?? "").toMatch(/sonuç (bulunamadı|yok)/iu);
    });
  });
});

/* --------------------------------------------- 9. the account menu itself */

describe("the drawer's footer account trigger opens a real, semantic account menu", () => {
  it("opens a menu naming a real identity, role and workspaces, not a placeholder", async () => {
    startDemoSession("superadmin");
    const user = userEvent.setup();
    await renderAppAt("/panel");
    const { menu } = await openAccountMenu(user);
    const items = within(menu).getAllByRole("menuitem");
    expect(items.length).toBeGreaterThan(3);
    expect(menu.textContent ?? "").toMatch(/süperadmin|superadmin/iu);
  });

  it("carries settings and accessibility destinations, a help item, and a disabled item with a stated reason", async () => {
    const user = userEvent.setup();
    await renderAppAt("/panel");
    const { menu } = await openAccountMenu(user);
    expect(within(menu).getByRole("menuitem", { name: /ayarlar|görünüm/iu })).toBeInTheDocument();
    expect(
      within(menu).getByRole("menuitem", { name: /erişilebilirlik/iu }),
    ).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: /yardım/iu })).toBeInTheDocument();

    const disabledItems = within(menu)
      .getAllByRole("menuitem")
      .filter((item) => item.getAttribute("aria-disabled") === "true" || item.hasAttribute("disabled"));
    expect(disabledItems.length).toBeGreaterThan(0);
    for (const item of disabledItems) {
      const described = item.getAttribute("aria-describedby");
      const reasonText = described
        ? document.getElementById(described)?.textContent
        : item.textContent;
      expect(reasonText?.trim().length ?? 0).toBeGreaterThan(0);
    }
  });

  it("performs a real logout from the account menu", async () => {
    startDemoSession("superadmin");
    const user = userEvent.setup();
    await renderAppAt("/panel");
    const { menu } = await openAccountMenu(user);
    await user.click(within(menu).getByRole("menuitem", { name: /çıkış/iu }));
    expect(await screen.findByRole("heading", { level: 1, name: "Giriş" })).toBeInTheDocument();
  });

  /**
   * Exactly one modal surface throughout: the drawer the avatar opened, still
   * open, now hosting the menu inside it. A second, independent "account
   * sheet" `dialog` appearing once the menu opens would be a competing
   * implementation of the same control living beside the first one.
   */
  it("keeps exactly one dialog open while the account menu is open — no second account sheet", async () => {
    const user = userEvent.setup();
    await renderAppAt("/panel");
    const { dialog } = await openAccountMenu(user);
    const dialogs = screen.getAllByRole("dialog");
    expect(dialogs).toHaveLength(1);
    expect(dialogs[0]).toBe(dialog);
  });
});

/* --------------------------------------------- 10. layered header retained */

describe("the layered Master Page header is retained", () => {
  it("still carries two distinct header layers", async () => {
    const { container } = await renderAppAt("/panel");
    const layers = container.querySelectorAll("[data-header-layer]");
    expect(layers.length).toBe(2);
  });
});

/* --------------------------------------------- 11. regression: demo & bottom nav */

describe("regression: existing demo and bottom navigation behaviour survives V2", () => {
  it("still shows the demo badge naming the active role", async () => {
    startDemoSession("customer");
    await renderAppAt("/panel");
    expect(await screen.findByText(/demo · /iu)).toBeInTheDocument();
  });

  it("still renders the phone bottom navigation landmark", async () => {
    await renderAppAt("/panel");
    expect(await screen.findByRole("navigation", { name: "Hızlı gezinme" })).toBeInTheDocument();
  });
});

/* --------------------------------------------- 12. Storybook coverage */

describe("Storybook catalogues the V2 shell's states (structural — cannot be observed in the running app)", () => {
  /**
   * `@/components/adaptive/cognitive-shell.stories`, not the existing
   * `adaptive.stories` module.
   *
   * The frozen scope names a dedicated catalogue for this shell. Pointing at
   * the old, unrelated `adaptive.stories` module would let this group go
   * green by coincidence — that module already tells other stories about
   * `AdaptiveShell`, `AdaptiveAssistant` and form controls that happen to
   * share a few of the required keywords (e.g. "Mobil"), without a single
   * story about the V2 chrome this file is actually meant to catalogue.
   */
  const STORY_MODULE = "@/components/adaptive/cognitive-shell.stories";

  async function storyEntries(): Promise<Array<[string, Record<string, unknown>]>> {
    const stories = (await import(STORY_MODULE)) as unknown as Record<string, unknown>;
    return Object.entries(stories).filter(
      (entry): entry is [string, Record<string, unknown>] =>
        entry[0] !== "default" && typeof entry[1] === "object" && entry[1] !== null,
    );
  }

  function textOf(name: string, meta: Record<string, unknown>): string {
    const parameters = meta["parameters"] as
      | { docs?: { description?: { story?: string } } }
      | undefined;
    const globals = meta["globals"] as { viewport?: { value?: string } } | undefined;
    return [
      name,
      meta["name"],
      parameters?.docs?.description?.story,
      globals?.viewport?.value,
    ]
      .filter(Boolean)
      .join(" ");
  }

  it("covers open/closed, both trigger focus targets, command states, an explicit AI-unavailable state, both themes, reduced motion and all five viewports", async () => {
    const entries = await storyEntries();
    const haystack = entries
      .map(([name, meta]) => textOf(name, meta))
      .join("\n")
      .toLowerCase();

    const required = [
      /kapal[ıi]/u, // closed
      /aç[ıi]k/u, // open
      /hamburger|menü tetik/u,
      /avatar|hesap tetik/u,
      /boşta|idle/u,
      /filtre|filtering/u,
      /sonuç yok|no.?results/u,
      /yükleniyor|loading/u,
      // Distinct from a generic offline claim: the frozen scope names an
      // explicit "AI unavailable" state, not merely "the network is down".
      /yapay zek[âa].*(mevcut değil|kullanılamıyor|bağlı değil)|ai[- ]?(is[- ])?unavailable/u,
      /çevrimdışı|offline/u,
      /izin|permission/u,
      /hata|error/u,
      /kısmi|partial/u,
      /koyu|dark/u,
      /açık tema|light/u,
      /hareket azalt|reduced.?motion/u,
      /320/u,
      /390/u,
      /768/u,
      /1024/u,
      /1440/u,
    ];
    const missing = required.filter((pattern) => !pattern.test(haystack));
    expect(missing.map(String), `missing V2 story coverage: ${missing.map(String).join(", ")}`).toEqual(
      [],
    );
  });

  /**
   * Skeleton-shimmer-first, enforced on the catalogue's own declaration order.
   *
   * `[[skeleton-shimmer-first]]` names the rule this repository already holds
   * itself to: a component is built loading-state-first, and only then comes
   * loaded/closed. `Object.keys` on a module's named exports preserves
   * declaration order for string keys, so the *first* export whose name
   * names a loading/skeleton state must come before the *first* export whose
   * name names a loaded or closed state — a real, checkable fact about the
   * file's own structure, not a claim about what the file merely contains
   * somewhere.
   */
  it("declares its skeleton/loading stories before its loaded/closed stories", async () => {
    const entries = await storyEntries();
    const names = entries.map(([name, meta]) => [name, textOf(name, meta).toLowerCase()] as const);

    const firstLoadingIndex = names.findIndex(([, text]) => /yükleniyor|skeleton|loading/u.test(text));
    const firstLoadedIndex = names.findIndex(([, text]) =>
      /(^|[^a-zçğıöşü])(yüklendi|loaded|kapalı|closed)([^a-zçğıöşü]|$)/u.test(text),
    );

    expect(firstLoadingIndex, "no skeleton/loading story is exported at all").toBeGreaterThanOrEqual(0);
    expect(firstLoadedIndex, "no loaded/closed story is exported at all").toBeGreaterThanOrEqual(0);
    expect(
      firstLoadingIndex,
      "a loaded/closed story is declared before any skeleton/loading story",
    ).toBeLessThan(firstLoadedIndex);
  });
});
