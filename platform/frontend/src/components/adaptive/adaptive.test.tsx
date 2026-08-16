/**
 * The adaptive enterprise surface: shell and assistant.
 *
 * Two promises are pinned here, and both are the kind that a screenshot review
 * would pass.
 *
 * **The shell is navigable, not just arranged.** A three-column enterprise
 * layout is easy to build as a pile of `div`s that looks right and is
 * unusable with a keyboard or a screen reader. So the assertions are on
 * landmarks, on the layered header being genuinely layered, on the right rail
 * being a real complementary region, and on the 320px controls - drawer, bottom
 * navigation and the sticky conversion action - existing and being wired to
 * each other.
 *
 * **The assistant never fabricates.** There is no AI provider in this
 * deployment. The surface is still useful: it runs deterministic rules over
 * records already on screen, shows what it read, and names the next action. But
 * it must say plainly that nothing was generated, and it must *drop* any
 * provider-based suggestion rather than render it greyed out - a greyed-out
 * answer is still an answer on the screen. UNKNOWN facts are shown as unknown,
 * never as "no".
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";

import { AdaptiveAssistant } from "./AdaptiveAssistant";
import { AdaptiveShell } from "./AdaptiveShell";
import {
  NO_ASSISTANT_PROVIDER,
  renderableSuggestions,
  suppressedSuggestionCount,
  type AssistantCapabilities,
  type AssistantDataStatus,
  type AssistantSuggestion,
} from "./types";

const NAV = [
  { to: "/panel", label: "Kokpit", shortLabel: "Kokpit", icon: "◧" },
  { to: "/degerlendirmeler", label: "Kararlar", shortLabel: "Kararlar", icon: "▤" },
  { to: "/firsatlar", label: "Fırsatlar", shortLabel: "Fırsat", icon: "◎" },
];

const SUGGESTIONS: readonly AssistantSuggestion[] = [
  {
    id: "s-1",
    title: "Üç kararda kaynak anlık görüntüsü eksik",
    why: "Yüklenmiş 12 kararın 3'ünde snapshot kimliği boş. Bu, ekrandaki verilerden sayıldı.",
    basis: "loaded-data",
    readFrom: ["degerlendirmeler"],
    nextAction: { label: "Kaynakları aç", to: "/kaynaklar" },
  },
  {
    id: "s-2",
    title: "Profilinizi özetleyeyim",
    why: "Bir dil modeline sorulması gerekir.",
    basis: "provider",
    readFrom: [],
    nextAction: { label: "Özet iste" },
  },
];

const DATA_STATUS: AssistantDataStatus = {
  label: "Karar listesi",
  lastLoadedAt: "2026-08-15T09:00:00Z",
  missing: ["Çalışan sayısı", "NACE kodu"],
  partial: true,
};

/** Overrides are explicitly nullable so a story can remove a slot entirely. */
interface ShellOverrides {
  readonly conversionAction?: Parameters<typeof AdaptiveShell>[0]["conversionAction"] | undefined;
  readonly contextRail?: React.ReactNode | undefined;
}

const shell = (props: ShellOverrides = {}) => {
  // The shared drawer always composes `ShellAccountMenu`, which calls the
  // real `useLogout()` mutation once the drawer's content mounts - so any
  // test that opens the drawer needs a `QueryClient` in context, whether or
  // not that particular test cares about logout itself.
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AdaptiveShell
          navItems={NAV}
          title="Kokpit"
          conversionAction={{ label: "Uygunluk sihirbazını başlat", to: "/uygunluk/sihirbaz" }}
          contextRail={<p>Bağlam</p>}
          headerUtilities={<button type="button">Tema</button>}
          breadcrumbs={<span>Kokpit</span>}
          {...props}
        >
          <h1>Kokpit</h1>
        </AdaptiveShell>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

/* ------------------------------------------------------------------ shell */

describe("the adaptive shell is navigable, not just arranged", () => {
  it("declares the document landmarks", () => {
    shell();
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    // Cognitive Shell V2: "Ana gezinme" is the drawer's own landmark now, and
    // the drawer - like every Radix dialog here - does not exist in the
    // document until it is open. A standing navigation landmark before that
    // is exactly what `cognitive-shell-v2.spec.ts`'s "no persistent
    // navigation rail is visible until the drawer is opened" refuses.
    expect(screen.queryByRole("navigation", { name: /Ana gezinme/u })).toBeNull();
    expect(screen.getByRole("complementary", { name: /Bağlam/u })).toBeInTheDocument();
  });

  it("has a genuinely layered header, not one row pretending", () => {
    // Brand and utilities on one layer, context and breadcrumbs on another.
    const { container } = shell();
    const layers = container.querySelectorAll("[data-header-layer]");
    expect(layers.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps a skip link ahead of everything else", () => {
    shell();
    const skip = screen.getByRole("link", { name: /İçeriğe geç/u });
    expect(skip).toHaveAttribute("href", "#ana-icerik");
  });

  it("wires the drawer toggle to the sheet it controls", async () => {
    shell();
    const toggle = screen.getByRole("button", { name: /men(ü|u)/iu });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    /**
     * Closed, it controls nothing - and says nothing.
     *
     * The earlier version pointed `aria-controls` at the `<nav>` landmark that
     * *contains* the button, because that element exists in both states. It
     * does exist; it is simply not what the button opens. A reference to the
     * ancestor a screen-reader user is already standing in is worse than no
     * reference at all, so the id now lives on the portalled dialog and the
     * attribute appears exactly when the dialog does.
     */
    const closedTarget = toggle.getAttribute("aria-controls");
    if (closedTarget !== null) {
      expect(document.getElementById(closedTarget)).not.toBeNull();
    }

    await userEvent.click(toggle);
    /**
     * The same node, held rather than re-queried.
     *
     * The drawer is a modal sheet now, so while it is open the whole page
     * behind it is `aria-hidden` - a role query would correctly find nothing,
     * and that is the point of a modal rather than a defect. The assertion is
     * unchanged in substance: the control that opened the sheet reports itself
     * expanded, and renames itself to the action it now offers.
     */
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const sheet = await screen.findByRole("dialog");
    expect(sheet).toBeInTheDocument();
    expect(document.getElementById(toggle.getAttribute("aria-controls") ?? "")).toBe(sheet);
  });

  it("offers bottom navigation for the thumb at 320px", () => {
    shell();
    const bottom = screen.getByRole("navigation", { name: /Hızlı gezinme/u });
    expect(within(bottom).getAllByRole("link").length).toBeGreaterThan(1);
  });

  it("keeps one sticky conversion action, and only one", async () => {
    const onRun = vi.fn();
    shell({ conversionAction: { label: "Uygunluk sihirbazını başlat", onRun } });
    const actions = screen.getAllByRole("button", { name: /Uygunluk sihirbazını başlat/u });
    expect(actions).toHaveLength(1);
    await userEvent.click(actions[0] as HTMLElement);
    expect(onRun).toHaveBeenCalledTimes(1);
  });

  it("renders no conversion action when the caller gives none", () => {
    shell({ conversionAction: undefined });
    expect(screen.queryByRole("button", { name: /Uygunluk sihirbazını başlat/u })).toBeNull();
  });

  it("drops the right rail entirely when there is no context to show", () => {
    // An empty complementary landmark is furniture a screen-reader user has to
    // walk past on every page.
    shell({ contextRail: undefined });
    expect(screen.queryByRole("complementary", { name: /Bağlam/u })).toBeNull();
  });
});

describe("the shell's own stylesheet obeys the layout contract", () => {
  const css = () =>
    readFileSync(join(process.cwd(), "src", "design", "adaptive.css"), "utf8").replace(
      /\/\*[\s\S]*?\*\//gu,
      "",
    );

  it("is single-column first and only becomes three columns with room", () => {
    const sheet = css();
    const shellRule = /\.dt-shell\s*\{([^}]*)\}/u.exec(sheet)?.[1] ?? "";
    expect(shellRule).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)/u);
    // The three-column arrangement exists, and exists inside a min-width query.
    expect(sheet).toMatch(/@media \(min-width: \d+rem\)/u);
    expect(sheet).toMatch(/dt-shell__rail[\s\S]*?dt-shell__aside|grid-template-areas/u);
  });

  it("gives every grid a zero-minimum track so 320px cannot overflow", () => {
    const sheet = css();
    const offenders: string[] = [];
    for (const [, selector, body] of sheet.matchAll(/([^{}]+)\{([^{}]*)\}/gu)) {
      if (!/display:\s*grid/u.test(body ?? "")) continue;
      if (!/grid-template-columns:\s*[^;]*minmax\(0/u.test(body ?? "")) {
        offenders.push((selector ?? "").trim());
      }
    }
    expect(offenders).toEqual([]);
  });

  it("animates only through the motion token, so reduced motion really stops it", () => {
    // A hard-coded `200ms` ignores the token that `prefers-reduced-motion` and
    // the appearance store both drive to 0ms.
    const sheet = css();
    const durations = [...sheet.matchAll(/(?:transition|animation)[^;]*?(\d+m?s)/gu)].map(
      (match) => match[1],
    );
    expect(durations).toEqual([]);
    expect(sheet).toMatch(/var\(--dt-motion-duration\)/u);
  });

  it("hides no overflow and declares no pill", () => {
    const sheet = css();
    expect(sheet).not.toMatch(/overflow(-[xy])?:\s*hidden/u);
    expect(sheet).not.toMatch(/border-radius:[^;]*(999px|50%)/u);
  });
});

/* -------------------------------------------------------------- assistant */

const assistant = (capabilities: AssistantCapabilities = NO_ASSISTANT_PROVIDER) =>
  render(
    <MemoryRouter>
      <AdaptiveAssistant
        capabilities={capabilities}
        suggestions={SUGGESTIONS}
        dataStatus={DATA_STATUS}
      />
    </MemoryRouter>,
  );

describe("the assistant never fabricates a result", () => {
  it("says plainly that no provider is connected", () => {
    assistant();
    expect(screen.getByText(/bağlı bir yapay zekâ sağlayıcısı yok/iu)).toBeInTheDocument();
  });

  it("claims no analysis and no generated output", () => {
    assistant();
    // Named, because the partial-data notice is a complementary region too.
    const text = screen.getByRole("region", { name: /Sıradaki adımlar/u }).textContent ?? "";
    expect(text).not.toMatch(/analiz tamamlandı|sonuçlar üretildi|model yanıtı/iu);
  });

  it("drops a provider-based suggestion instead of greying it out", () => {
    assistant();
    expect(screen.queryByText(/Profilinizi özetleyeyim/u)).toBeNull();
    expect(screen.getByText(/Üç kararda kaynak anlık görüntüsü eksik/u)).toBeInTheDocument();
  });

  it("counts what it withheld rather than hiding the fact", () => {
    assistant();
    expect(suppressedSuggestionCount(SUGGESTIONS, NO_ASSISTANT_PROVIDER)).toBe(1);
    expect(screen.getByText(/1 öneri/u)).toBeInTheDocument();
  });

  it("shows every suggestion's reason and what it read", () => {
    assistant();
    expect(screen.getByText(/Bu, ekrandaki verilerden sayıldı/u)).toBeInTheDocument();
    expect(screen.getByText(/degerlendirmeler/u)).toBeInTheDocument();
  });

  it("offers the next action as a real control", () => {
    assistant();
    expect(screen.getByRole("link", { name: /Kaynakları aç/u })).toHaveAttribute(
      "href",
      "/kaynaklar",
    );
  });

  it("renders unanswered facts as unknown, never as no", () => {
    assistant();
    const rail = screen.getByRole("region", { name: /Sıradaki adımlar/u });
    expect(within(rail).getByText(/Çalışan sayısı/u)).toBeInTheDocument();
    // One badge per unanswered fact. Anchored, so the sentence explaining that
    // the engine treats absence as unknown is not counted as a badge.
    expect(within(rail).getAllByText(/^Bilinmiyor$/u)).toHaveLength(DATA_STATUS.missing.length);
    expect(within(rail).getByText(/bilinmiyor olarak işler/u)).toBeInTheDocument();
    expect(rail.textContent ?? "").not.toMatch(/\bHayır\b/u);
  });

  it("renders a provider suggestion once a provider is genuinely connected", () => {
    assistant({ providerState: "connected", providerReason: "" });
    expect(screen.getByText(/Profilinizi özetleyeyim/u)).toBeInTheDocument();
  });

  it("the filter is not vacuous", () => {
    expect(renderableSuggestions(SUGGESTIONS, NO_ASSISTANT_PROVIDER)).toHaveLength(1);
    expect(
      renderableSuggestions(SUGGESTIONS, { providerState: "connected", providerReason: "" }),
    ).toHaveLength(2);
    // An unexplained suggestion is never rendered, whatever its basis.
    expect(
      renderableSuggestions(
        [{ ...(SUGGESTIONS[0] as AssistantSuggestion), why: "   " }],
        NO_ASSISTANT_PROVIDER,
      ),
    ).toHaveLength(0);
  });

  it("lets the operator dismiss a suggestion", async () => {
    const onDismiss = vi.fn();
    render(
      <MemoryRouter>
        <AdaptiveAssistant
          capabilities={NO_ASSISTANT_PROVIDER}
          suggestions={SUGGESTIONS}
          dataStatus={DATA_STATUS}
          onDismiss={onDismiss}
        />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole("button", { name: /Kapat/u }));
    expect(onDismiss).toHaveBeenCalledWith("s-1");
  });
});
