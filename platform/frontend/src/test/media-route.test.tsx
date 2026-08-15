/**
 * `/dosyalar` - the file library, mounted as a product surface.
 *
 * The media subsystem was finished, tested and unreachable: every component
 * existed, every state was covered, and the only way to see any of it was to
 * run Storybook. A capability that ships only to the people who build it is not
 * a capability the product has.
 *
 * What makes mounting it honest is the same thing that made leaving it out
 * defensible: there is no media backend. So the route's contract is not "files
 * work" - it is **"here is the library, here is exactly what it cannot do, and
 * here is why"**. Every assertion below is about that second half. Nothing on
 * this screen may claim a stored byte, a computed hash, a scan verdict or a
 * completed upload, because none of those things happened.
 *
 * The counterpart to that rule is that the *real* half must be real: the search
 * box, the filters, the sort, the column controls and the table/card switch are
 * genuine and operate on the rows the screen was given - which today is none of
 * them, and an empty library is still a library.
 */

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { server } from "@/mocks/server";
import { renderAppAt } from "./render-app";

const ROUTE = "/dosyalar";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the file library is behind the session boundary like every other private route", () => {
  it("asks an anonymous visitor to sign in, and shows them no private shell", async () => {
    server.use(http.get("/api/degerlendirmeler", () => new HttpResponse(null, { status: 401 })));
    await renderAppAt(ROUTE);

    expect(await screen.findByText("Oturum gerekli")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Çıkış" })).not.toBeInTheDocument();
    expect(screen.queryByText(/İstek başarısız \(401\)/u)).not.toBeInTheDocument();
  });
});

describe("the route is reachable rather than merely addressable", () => {
  it("is on the persistent workspace navigation", async () => {
    const { APP_NAV } = await import("@/routes/app");
    expect(APP_NAV.map((item) => item.to)).toContain(ROUTE);
  });

  it("renders inside the signed-in shell with its own heading", async () => {
    await renderAppAt(ROUTE);
    expect(
      await screen.findByRole("heading", { level: 1, name: "Dosya kütüphanesi" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Ana gezinme" })).toBeInTheDocument();
  });
});

describe("the library is real, and it is empty", () => {
  it("shows the empty library rather than a plausible list", async () => {
    await renderAppAt(ROUTE);
    const library = await screen.findByRole("region", { name: "Dosya kütüphanesi" });

    expect(within(library).getByText("Kütüphanede dosya yok")).toBeInTheDocument();
    // No table at all: an empty grid renders its empty state, not a header row
    // over nothing.
    expect(within(library).queryAllByRole("row")).toHaveLength(0);
  });

  it("offers search, filter, sort, column and view controls on the empty library", async () => {
    await renderAppAt(ROUTE);
    const library = await screen.findByRole("region", { name: "Dosya kütüphanesi" });

    expect(within(library).getByLabelText("Ara")).toBeInTheDocument();
    const controls = within(library).getByRole("group", { name: "Tablo denetimleri" });
    // Anchored patterns rather than exact strings: the filter and sort controls
    // append their active count to the label, and the count is the toolbar's
    // business rather than this test's.
    for (const name of [/^Sütunlar$/u, /^Filtre/u, /^Sırala/u, /^Grupla$/u, /^Daha fazla$/u]) {
      expect(within(controls).getByRole("button", { name })).toBeInTheDocument();
    }
    expect(within(controls).getByRole("button", { name: "Tablo görünümü" })).toBeInTheDocument();
    expect(within(controls).getByRole("button", { name: "Kart görünümü" })).toBeInTheDocument();
  });

  it("actually operates those controls instead of rendering them inert", async () => {
    await renderAppAt(ROUTE);
    const library = await screen.findByRole("region", { name: "Dosya kütüphanesi" });

    const filter = within(library).getByRole("button", { name: "Filtre" });
    expect(filter).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(filter);
    expect(filter).toHaveAttribute("aria-expanded", "true");
    expect(within(library).getByLabelText("Filtreler")).toBeInTheDocument();
  });

  it("says plainly that nothing is stored", async () => {
    await renderAppAt(ROUTE);
    const library = await screen.findByRole("region", { name: "Dosya kütüphanesi" });
    expect(
      within(library).getByText(/hiçbir dosyayı kalıcı olarak saklamıyor/u),
    ).toBeInTheDocument();
  });
});

describe("uploading is refused, visibly, with the reason", () => {
  it("disables the picker because there is no transport", async () => {
    await renderAppAt(ROUTE);
    const upload = await screen.findByRole("region", { name: "Dosya yükleme" });

    expect(within(upload).getByLabelText("Dosya seç")).toBeDisabled();
    expect(within(upload).getByText(/Yükleme ucu yok/u)).toBeInTheDocument();
  });

  it("shows no queue, no progress and no completed upload", async () => {
    await renderAppAt(ROUTE);
    const upload = await screen.findByRole("region", { name: "Dosya yükleme" });

    expect(within(upload).queryByRole("list", { name: "Yükleme kuyruğu" })).not.toBeInTheDocument();
    expect(within(upload).queryByRole("progressbar")).not.toBeInTheDocument();
    expect(within(upload).queryByText(/Tamamlandı/u)).not.toBeInTheDocument();
  });
});

describe("storage is local by default and S3 is optional and absent", () => {
  it("names the local disk as the default target", async () => {
    await renderAppAt(ROUTE);
    const storage = await screen.findByRole("region", { name: "Depolama durumu" });

    const targets = within(storage).getByRole("list", { name: "Depolama hedefleri" });
    const items = within(targets).getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent("Yerel disk");
    expect(items[0]).toHaveTextContent("Varsayılan");
  });

  it("renders no S3 surface, because no host declared one", async () => {
    await renderAppAt(ROUTE);
    const storage = await screen.findByRole("region", { name: "Depolama durumu" });

    expect(within(storage).queryByText("S3 uyumlu depolama")).not.toBeInTheDocument();
    expect(within(storage).queryByText(/Sağlıklı bildirildi/u)).not.toBeInTheDocument();
  });

  it("reports every capacity figure as unknown rather than as zero", async () => {
    await renderAppAt(ROUTE);
    const storage = await screen.findByRole("region", { name: "Depolama durumu" });

    // An em dash is what "nobody measured this" looks like here.
    expect(within(storage).getAllByText("—").length).toBeGreaterThanOrEqual(3);
    expect(within(storage).getByText("Tanımsız")).toBeInTheDocument();
    expect(within(storage).queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("explains that S3 is optional and that this package does not talk to it", async () => {
    await renderAppAt(ROUTE);
    expect(await screen.findByText(/S3 kasıtlı olarak isteğe bağlıdır/u)).toBeInTheDocument();
  });
});

/**
 * The organiser, mounted with nothing in it.
 *
 * `MediaOrganizer` and the `FolderTree` inside it were the last finished part
 * of this subsystem that only Storybook could reach, and the honest way to
 * mount them is the same way the rest of this screen is mounted: with the real
 * empty state rather than a folder anybody invented. No folders, the local-only
 * capability ledger, and no draft or write callback - which is what makes the
 * metadata editor render as refused, with its reason, instead of as an editor
 * whose edits go nowhere.
 */
describe("folders and metadata are mounted, empty and honest", () => {
  it("renders the folder tree's empty state rather than an invented folder", async () => {
    await renderAppAt(ROUTE);
    const folders = (await screen.findByText("Klasörler")).closest(".dt-card") as HTMLElement;

    expect(within(folders).getByText("Klasör tanımlı değil.")).toBeInTheDocument();
    expect(within(folders).queryByRole("tree")).not.toBeInTheDocument();
    expect(within(folders).queryAllByRole("treeitem")).toHaveLength(0);
  });

  it("says metadata editing is off and that nothing written here is kept", async () => {
    await renderAppAt(ROUTE);
    const metadata = (await screen.findByText("Üstveri ve etiketler")).closest(
      ".dt-card",
    ) as HTMLElement;

    expect(within(metadata).getByText("Üstveri düzenleme kapalı")).toBeInTheDocument();
    expect(within(metadata).getByText(/yalnızca bu sekmede yaşar/u)).toBeInTheDocument();
    // No editor, no tag, no draft: a disabled capability offers no controls.
    expect(within(metadata).queryByRole("textbox")).not.toBeInTheDocument();
    expect(within(metadata).queryByRole("button")).not.toBeInTheDocument();
  });

  it("issues no request to mount either of them", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    await renderAppAt(ROUTE);
    await screen.findByText("Klasör tanımlı değil.");

    expect(
      spy.mock.calls.filter(([input]) => String(input).includes("dosya")),
      "dosya ucu yokken istek gönderildi",
    ).toEqual([]);
  });
});

describe("every blocked capability is named with its reason", () => {
  it("lists exactly the blocked entries the ledger declares", async () => {
    const { blockedMediaCapabilities, MEDIA_CAPABILITY_COUNTS } = await import(
      "@/components/media"
    );
    await renderAppAt(ROUTE);

    const ledger = await screen.findByRole("region", { name: "Sunucu gerektiren yetenekler" });
    const rows = within(ledger).getAllByRole("listitem");
    expect(rows).toHaveLength(MEDIA_CAPABILITY_COUNTS.backendBlocked);

    for (const capability of blockedMediaCapabilities()) {
      expect(within(ledger).getByText(capability.title)).toBeInTheDocument();
      expect(within(ledger).getByText(capability.reason)).toBeInTheDocument();
    }
  });

  it("offers no enabled control for anything the backend cannot do", async () => {
    const { MEDIA_CAPABILITY_COUNTS } = await import("@/components/media");
    // The ledger's own arithmetic: nothing is both ready and available.
    expect(MEDIA_CAPABILITY_COUNTS.enabled).toBeLessThan(MEDIA_CAPABILITY_COUNTS.uiReady);
  });
});

describe("nothing on this screen was invented", () => {
  it("shows no size, no hash, no scan verdict and no audit row", async () => {
    await renderAppAt(ROUTE);
    await screen.findByRole("heading", { level: 1, name: "Dosya kütüphanesi" });
    const text = document.body.textContent ?? "";

    // A byte figure, a hex digest and a clean verdict are the three fabrications
    // a document surface reaches for first.
    expect(text).not.toMatch(/\d+(?:[.,]\d+)?\s?(?:B|KiB|MiB|GiB|TiB)\b/u);
    expect(text).not.toMatch(/\b[0-9a-f]{12,}\b/u);
    expect(text).not.toMatch(/\bTemiz\b/u);
  });

  it("issues no request while its controls are operated", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    await renderAppAt(ROUTE);
    const library = await screen.findByRole("region", { name: "Dosya kütüphanesi" });
    const before = spy.mock.calls.length;

    await userEvent.type(within(library).getByLabelText("Ara"), "sozlesme");
    await userEvent.click(within(library).getByRole("button", { name: "Kart görünümü" }));
    await userEvent.click(within(library).getByRole("button", { name: "Sütunlar" }));

    expect(spy.mock.calls.length).toBe(before);
  });
});

describe("the route module keeps test scaffolding out of the product", () => {
  const source = () =>
    readFileSync(join(process.cwd(), "src", "routes", "media.tsx"), "utf8");

  /**
   * An *import*, not a mention.
   *
   * The route module has to be able to say in prose why the fixtures are not
   * imported - that sentence is the guard rail a future reader will actually
   * read - and a rule that forbade the words would forbid the explanation.
   */
  it("imports nothing from the test or mock trees", () => {
    const imports = [...source().matchAll(/from\s+["']([^"']+)["']/gu)].map((match) => match[1]!);
    expect(imports.filter((path) => /(?:^|\/)(?:test|mocks)\//u.test(path))).toEqual([]);
    expect(imports.filter((path) => /fixtures/u.test(path))).toEqual([]);
  });

  it("owns the media stylesheet, so it travels with this route and no other", () => {
    expect(source()).toMatch(/import\s+["'][^"']*media\.css["']/u);
  });
});
