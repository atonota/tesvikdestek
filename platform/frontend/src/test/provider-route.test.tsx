/**
 * `/ayarlar/yapay-zeka` - the AI provider connection centre, mounted.
 *
 * Same story as the file library and a sharper edge. The subsystem was
 * complete - catalogue, comparison matrix, six-step wizard, ephemeral secret
 * field, inventory grid, routing policy builder, audit timeline - and no user
 * could reach any of it. The requirement was explicit: operators must be able
 * to connect Gemini, OpenAI/ChatGPT, Claude and OpenClaw accounts.
 *
 * The edge is that this is the surface where pretending would do real damage.
 * There is no credential store, no OAuth broker, no host session bridge, no
 * health prober. So the route's promise is *disclosure*, not connection: an
 * operator can read exactly which door each vendor publishes, which of those
 * doors this deployment could broker, and why the answer is currently "none of
 * them". Every assertion below defends one of three lines:
 *
 *   1. **No secret field may be live.** A key typed into a page with nowhere to
 *      send it is a key pasted into a text box, and it is the worst possible
 *      outcome of a well-meaning connection screen.
 *   2. **No connection may become connected.** Not optimistically, not after a
 *      spinner, not "pending" that quietly flips. Only a server can say a
 *      connection exists and there is no server to say it.
 *   3. **No request leaves the browser.** Not a verification probe, not a
 *      capability sniff, not a docs prefetch.
 */

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { server } from "@/mocks/server";
import { renderAppAt } from "./render-app";

const ROUTE = "/ayarlar/yapay-zeka";

/** The four the requirement names, in the order the catalogue declares them. */
const REQUIRED_PROVIDERS = ["Google Gemini", "OpenAI / ChatGPT", "Claude", "OpenClaw"] as const;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the provider centre is behind the session boundary", () => {
  it("asks an anonymous visitor to sign in, and shows them no private shell", async () => {
    server.use(http.get("/api/degerlendirmeler", () => new HttpResponse(null, { status: 401 })));
    await renderAppAt(ROUTE);

    expect(await screen.findByText("Oturum gerekli")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Çıkış" })).not.toBeInTheDocument();
    expect(screen.queryByText(/İstek başarısız \(401\)/u)).not.toBeInTheDocument();
  });
});

describe("the route is reachable from the settings section", () => {
  it("is listed in the persistent settings navigation on every settings screen", async () => {
    await renderAppAt("/ayarlar/gorunum");
    const subnav = await screen.findByRole("navigation", { name: "Ayarlar bölümleri" });
    const hrefs = [...subnav.querySelectorAll("a")].map((anchor) => anchor.getAttribute("href"));
    expect(hrefs).toContain(ROUTE);
  });

  it("carries that same navigation itself, so the section is never a dead end", async () => {
    await renderAppAt(ROUTE);
    expect(
      await screen.findByRole("navigation", { name: "Ayarlar bölümleri" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { level: 1, name: "Yapay zekâ sağlayıcıları" }),
    ).toBeInTheDocument();
  });
});

describe("the catalogue is exactly the four providers the requirement names", () => {
  it("lists all four and no fifth", async () => {
    await renderAppAt(ROUTE);
    const catalogue = await screen.findByRole("region", { name: "Sağlayıcı kataloğu" });

    // The top-level list only. Each card nests its own method list, so a
    // document-wide `listitem` query counts methods as providers.
    const list = catalogue.querySelector("ul");
    const cards = [...(list?.children ?? [])].filter((node) => node.tagName === "LI");
    expect(cards).toHaveLength(REQUIRED_PROVIDERS.length);
    for (const name of REQUIRED_PROVIDERS) {
      expect(within(catalogue).getByRole("heading", { name })).toBeInTheDocument();
    }
  });

  it("links each provider to its own published documentation", async () => {
    await renderAppAt(ROUTE);
    const catalogue = await screen.findByRole("region", { name: "Sağlayıcı kataloğu" });

    for (const name of REQUIRED_PROVIDERS) {
      const link = within(catalogue).getByRole("link", { name: new RegExp(`${name} belgeleri`, "u") });
      expect(link).toHaveAttribute("target", "_blank");
      expect(link.getAttribute("href")).toMatch(/^https:\/\//u);
    }
  });

  it("shows every published method, including the ones that are not available", async () => {
    const { PROVIDER_CATALOG } = await import("@/components/provider-connections");
    await renderAppAt(ROUTE);
    const catalogue = await screen.findByRole("region", { name: "Sağlayıcı kataloğu" });

    const declared = PROVIDER_CATALOG.flatMap((provider) => provider.methods);
    expect(within(catalogue).getAllByRole("link", { name: /Resmî belge/u })).toHaveLength(
      declared.length,
    );
  });

  it("discloses what each provider would receive", async () => {
    await renderAppAt(ROUTE);
    const catalogue = await screen.findByRole("region", { name: "Sağlayıcı kataloğu" });
    expect(
      within(catalogue).getAllByText(/Bu istemci sağlayıcının politikasını doğrulayamaz/u).length,
    ).toBe(REQUIRED_PROVIDERS.length);
  });
});

describe("nothing is offerable, and the reason is on screen", () => {
  it("marks every method unavailable because the backend declares nothing", async () => {
    await renderAppAt(ROUTE);
    const catalogue = await screen.findByRole("region", { name: "Sağlayıcı kataloğu" });

    expect(within(catalogue).queryByText("Kullanılabilir")).not.toBeInTheDocument();
    expect(within(catalogue).getAllByText("Kullanılamaz").length).toBeGreaterThan(0);
  });

  it("names the missing server capability rather than shrugging", async () => {
    await renderAppAt(ROUTE);
    const catalogue = await screen.findByRole("region", { name: "Sağlayıcı kataloğu" });
    expect(
      within(catalogue).getAllByText(/sunucu tarafında tanımlı değil/u).length,
    ).toBeGreaterThan(0);
  });

  it("lists the blocked provider capabilities with their reasons", async () => {
    const { blockedProviderCapabilities, PROVIDER_CAPABILITY_COUNTS } = await import(
      "@/components/provider-connections"
    );
    await renderAppAt(ROUTE);

    const ledger = await screen.findByRole("region", { name: "Sunucu gerektiren yetenekler" });
    expect(within(ledger).getAllByRole("listitem")).toHaveLength(
      PROVIDER_CAPABILITY_COUNTS.backendBlocked,
    );
    for (const capability of blockedProviderCapabilities()) {
      expect(within(ledger).getByText(capability.title)).toBeInTheDocument();
    }
  });
});

describe("the inventory is empty and says why it cannot know more", () => {
  it("renders no connection at all", async () => {
    await renderAppAt(ROUTE);
    const inventory = await screen.findByRole("region", { name: "Bağlantı envanteri" });

    expect(within(inventory).getByText("Bağlı sağlayıcı yok")).toBeInTheDocument();
    expect(within(inventory).queryAllByRole("row")).toHaveLength(0);
  });

  it("claims no knowledge of connections it never loaded", async () => {
    await renderAppAt(ROUTE);
    const inventory = await screen.findByRole("region", { name: "Bağlantı envanteri" });
    expect(
      within(inventory).getByText(/Sunucu genelinde bir seçim ya da eylem sunulmuyor/u),
    ).toBeInTheDocument();
  });
});

describe("the wizard cannot reach a secret, and cannot produce a connection", () => {
  it("lets an operator inspect a provider's methods", async () => {
    await renderAppAt(ROUTE);
    const wizard = await screen.findByRole("region", { name: "Sağlayıcı bağlantı sihirbazı" });

    // Choosing a provider *is* the step: the machine moves to the method list
    // on selection rather than making the operator confirm a radio they just
    // pressed.
    await userEvent.click(within(wizard).getByRole("radio", { name: "Claude" }));

    expect(
      await within(wizard).findByRole("group", { name: /Claude için bağlantı yöntemi/u }),
    ).toBeInTheDocument();
  });

  it("disables every method and refuses to advance past the choice", async () => {
    await renderAppAt(ROUTE);
    const wizard = await screen.findByRole("region", { name: "Sağlayıcı bağlantı sihirbazı" });

    await userEvent.click(within(wizard).getByRole("radio", { name: "Claude" }));
    await within(wizard).findByRole("group", { name: /Claude için bağlantı yöntemi/u });

    for (const radio of within(wizard).getAllByRole("radio")) {
      expect(radio).toBeDisabled();
    }
    expect(within(wizard).getByRole("button", { name: "Devam" })).toBeDisabled();
  });

  it("puts no secret input on the page at any reachable step", async () => {
    await renderAppAt(ROUTE);
    await screen.findByRole("region", { name: "Sağlayıcı bağlantı sihirbazı" });

    expect(document.querySelectorAll('input[type="password"]')).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /Bağlantı isteği oluştur/u })).not.toBeInTheDocument();
  });

  it("never reports a connection as established", async () => {
    await renderAppAt(ROUTE);
    await screen.findByRole("heading", { level: 1, name: "Yapay zekâ sağlayıcıları" });
    const text = document.body.textContent ?? "";

    expect(text).not.toMatch(/\bBağlandı\b/u);
    expect(text).not.toMatch(/\bDoğrulandı\b/u);
    expect(text).not.toMatch(/\bSağlıklı\b/u);
  });
});

describe("no request leaves the browser", () => {
  it("issues nothing while the catalogue and the wizard are driven", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    await renderAppAt(ROUTE);
    const wizard = await screen.findByRole("region", { name: "Sağlayıcı bağlantı sihirbazı" });
    const before = spy.mock.calls.length;

    await userEvent.click(within(wizard).getByRole("radio", { name: "OpenClaw" }));
    await within(wizard).findByRole("group", { name: /OpenClaw için bağlantı yöntemi/u });
    await userEvent.click(within(wizard).getByRole("button", { name: "Geri" }));

    expect(spy.mock.calls.length).toBe(before);
  });
});

describe("the wizard is operable from the keyboard alone", () => {
  it("reaches and selects a provider without a pointer", async () => {
    await renderAppAt(ROUTE);
    const wizard = await screen.findByRole("region", { name: "Sağlayıcı bağlantı sihirbazı" });

    const first = within(wizard).getByRole("radio", { name: "Google Gemini" });
    first.focus();
    await userEvent.keyboard("{ArrowDown}");

    // Arrow keys move within the radio group and selecting is choosing, so the
    // keyboard alone reaches the method list - no pointer, no confirm button.
    expect(
      await within(wizard).findByRole("group", { name: /OpenAI \/ ChatGPT için bağlantı yöntemi/u }),
    ).toBeInTheDocument();
  });
});

describe("the route module keeps the subsystem lazy and the test tree out", () => {
  const source = () =>
    readFileSync(join(process.cwd(), "src", "routes", "providers.tsx"), "utf8");

  it("imports nothing from the test or mock trees", () => {
    const imports = [...source().matchAll(/from\s+["']([^"']+)["']/gu)].map((match) => match[1]!);
    expect(imports.filter((path) => /(?:^|\/)(?:test|mocks)\//u.test(path))).toEqual([]);
    expect(imports.filter((path) => /fixtures/u.test(path))).toEqual([]);
  });

  it("owns the provider stylesheet", () => {
    expect(source()).toMatch(/import\s+["'][^"']*provider-connections\.css["']/u);
  });

  it("reaches the subsystem by its own path rather than through the shared barrel", () => {
    // The barrel is imported by every route, so a re-export from it would put
    // this whole subsystem in the chunk every signed-in visitor downloads.
    const barrel = readFileSync(
      join(process.cwd(), "src", "components", "index.ts"),
      "utf8",
    );
    expect(barrel).not.toMatch(/export\s+\*\s+from\s+["']\.\/provider-connections["']/u);
    expect(source()).toMatch(/from\s+["']@\/components\/provider-connections["']/u);
  });
});
