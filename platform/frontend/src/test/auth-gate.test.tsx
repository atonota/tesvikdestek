/**
 * The workspace session boundary.
 *
 * Everything in this file is about one question: what does an anonymous person
 * see when they open a private URL, and what does the product say when the
 * server is simply down?
 *
 * Before this boundary existed the answer to both was the same generic card -
 * "Bir şeyler ters gitti / İstek başarısız (401) / Tekrar dene" - rendered
 * *inside the signed-in shell*, complete with the private navigation and a
 * "Çıkış" button offered to someone who was never in. That surface is wrong
 * three times over: it names a status code instead of a cause, it offers a
 * retry for a condition retrying cannot change, and it shows the private
 * information architecture to a visitor.
 *
 * The second half is the mirror image and matters just as much: a 502 is *not*
 * an expired session and must not be answered with a login screen, must not be
 * dressed up as "çevrimdışı" when the browser is plainly online, and must never
 * be flattened into empty tenant data that reads as "you have nothing".
 */

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { server } from "@/mocks/server";
import { renderAppAt } from "./render-app";

/**
 * Every private destination the router published before the media and provider
 * centres existed.
 *
 * Those two are not listed here and that is not an omission: each arrives with
 * its own route module, and each brings this same anonymous-visitor assertion
 * with it, in the file that introduces it. A route asserted before it exists
 * would be a test that fails for the boring reason.
 */
const WORKSPACE_ROUTES = [
  "/panel",
  "/uygunluk",
  "/degerlendirmeler",
  "/degerlendirmeler/karsilastir",
  "/organizasyon/hazirlik",
  "/organizasyon/profil",
  "/olgunluk",
  "/operasyon/saglik",
  "/yetenekler",
] as const;

/** The session-scoped read the backend really answers with 401 when signed out. */
function anonymousBackend(): void {
  server.use(
    http.get("/api/degerlendirmeler", () => new HttpResponse(null, { status: 401 })),
    http.get("/api/degerlendirmeler/:id", () => new HttpResponse(null, { status: 401 })),
  );
}

function brokenBackend(status = 502): void {
  server.use(
    http.get("/api/degerlendirmeler", () => new HttpResponse(null, { status })),
    http.get("/api/degerlendirmeler/:id", () => new HttpResponse(null, { status })),
    http.get("/api/programlar", () => new HttpResponse(null, { status })),
    http.get("/api/kaynaklar", () => new HttpResponse(null, { status })),
    http.get("/hazir", () => new HttpResponse(null, { status })),
  );
}

describe("an anonymous visitor is told to sign in, not shown a status code", () => {
  it.each(WORKSPACE_ROUTES)("%s asks for a session instead of failing", async (path) => {
    anonymousBackend();
    await renderAppAt(path);

    expect(await screen.findByText("Oturum gerekli")).toBeInTheDocument();
  });

  it.each(WORKSPACE_ROUTES)("%s never shows the raw 401 or a retry", async (path) => {
    anonymousBackend();
    await renderAppAt(path);
    await screen.findByText("Oturum gerekli");

    expect(screen.queryByText(/İstek başarısız \(401\)/u)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tekrar dene" })).not.toBeInTheDocument();
  });

  it.each(WORKSPACE_ROUTES)("%s hides the private shell entirely", async (path) => {
    anonymousBackend();
    await renderAppAt(path);
    await screen.findByText("Oturum gerekli");

    expect(screen.queryByRole("button", { name: "Çıkış" })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Ana gezinme" })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Hızlı gezinme" })).not.toBeInTheDocument();
  });

  it("offers an in-app link to the login route carrying a safe return path", async () => {
    anonymousBackend();
    await renderAppAt("/organizasyon/hazirlik");

    const link = await screen.findByRole("link", { name: "Giriş yap" });
    // A router link, not a full page load: the href is the app path itself.
    expect(link).toHaveAttribute(
      "href",
      `/giris?donus=${encodeURIComponent("/organizasyon/hazirlik")}`,
    );
  });

  it("carries the query string of the private URL into the return path", async () => {
    anonymousBackend();
    await renderAppAt("/degerlendirmeler/karsilastir?ids=decision-1501,decision-1507");

    const link = await screen.findByRole("link", { name: "Giriş yap" });
    expect(link.getAttribute("href")).toContain(
      encodeURIComponent("/degerlendirmeler/karsilastir?ids=decision-1501,decision-1507"),
    );
  });

  it("invents no tenant facts while the session is missing", async () => {
    anonymousBackend();
    await renderAppAt("/panel");
    await screen.findByText("Oturum gerekli");

    expect(screen.queryByRole("heading", { name: "Kokpit" })).not.toBeInTheDocument();
    expect(screen.queryByText("Sonuç dağılımı")).not.toBeInTheDocument();
  });
});

describe("a server failure stays a server failure", () => {
  it("names it as a server-side error and offers a retry", async () => {
    brokenBackend(502);
    await renderAppAt("/panel");

    expect(await screen.findByText("Sunucu tarafında bir hata oluştu.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tekrar dene" })).toBeInTheDocument();
  });

  it("does not call an online browser offline", async () => {
    brokenBackend(502);
    await renderAppAt("/panel");
    await screen.findByText("Sunucu tarafında bir hata oluştu.");

    expect(screen.queryByText(/Çevrimdışı/u)).not.toBeInTheDocument();
  });

  it("does not send the operator to the login page", async () => {
    brokenBackend(502);
    await renderAppAt("/panel");
    await screen.findByText("Sunucu tarafında bir hata oluştu.");

    expect(screen.queryByText("Oturum gerekli")).not.toBeInTheDocument();
  });

  it("renders no zeroed tenant summary behind the failure", async () => {
    brokenBackend(502);
    await renderAppAt("/panel");
    await screen.findByText("Sunucu tarafında bir hata oluştu.");

    expect(screen.queryByText("Katalog ve kaynak")).not.toBeInTheDocument();
  });
});

describe("a partial read is never rounded down to zero", () => {
  it("says the catalogue count could not be read rather than showing 0", async () => {
    server.use(
      http.get("/api/programlar", () => new HttpResponse(null, { status: 502 })),
      http.get("/api/kaynaklar", () => new HttpResponse(null, { status: 502 })),
    );
    await renderAppAt("/panel");
    await screen.findByRole("heading", { name: "Kokpit" });

    const catalogue = (await screen.findByText("Katalog ve kaynak")).closest(".dt-card");
    expect(catalogue).not.toBeNull();
    expect(catalogue?.textContent).toContain("okunamadı");
    expect(catalogue?.textContent).not.toMatch(/\b0\b/u);
  });

  it("refuses to score maturity from reads that failed", async () => {
    server.use(
      http.get("/api/programlar", () => new HttpResponse(null, { status: 502 })),
      http.get("/api/kaynaklar", () => new HttpResponse(null, { status: 502 })),
    );
    await renderAppAt("/olgunluk");

    expect(
      await screen.findByRole("heading", { name: "Olgunluk hesaplanmadı" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/okunamadığı için hesaplama yapılmadı/u)).toBeInTheDocument();
    // The radar is the thing that would have carried the invented score.
    expect(screen.queryByText(/boyut bugün ölçülemiyor/u)).not.toBeInTheDocument();
  });
});

describe("an expired session on a write offers the way back in", () => {
  it("gives the profile form a login link when the write was bounced", async () => {
    server.use(
      http.post("/profil", () =>
        HttpResponse.redirect(new URL("/giris", globalThis.location.origin).toString(), 303),
      ),
    );
    await renderAppAt("/organizasyon/profil");

    await userEvent.click(await screen.findByRole("button", { name: "Profili kaydet" }));

    const link = await screen.findByRole("link", { name: "Tekrar giriş yapın" });
    expect(link.getAttribute("href")).toContain("/giris?donus=");
  });
});

describe("the login route honours a return path it can trust", () => {
  it("returns the operator to the private page they asked for", async () => {
    await renderAppAt(`/giris?donus=${encodeURIComponent("/organizasyon/hazirlik")}`);
    await userEvent.type(await screen.findByLabelText(/E-posta/), "biri@ornek.com.tr");
    await userEvent.type(screen.getByLabelText(/Parola/), "cok-guclu-parola-2026");
    await userEvent.click(screen.getByRole("button", { name: "Giriş yap" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Organizasyon hazırlığı" }),
    ).toBeInTheDocument();
  });

  it.each([
    "https://evil.example/panel",
    "//evil.example/panel",
    "http://evil.example",
    "javascript:alert(1)",
    "/\\evil.example",
  ])("refuses %s and lands on the dashboard instead", async (hostile) => {
    await renderAppAt(`/giris?donus=${encodeURIComponent(hostile)}`);
    await userEvent.type(await screen.findByLabelText(/E-posta/), "biri@ornek.com.tr");
    await userEvent.type(screen.getByLabelText(/Parola/), "cok-guclu-parola-2026");
    await userEvent.click(screen.getByRole("button", { name: "Giriş yap" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Kokpit" })).toBeInTheDocument();
  });
});

describe("safeReturnPath is the one place that decides", () => {
  it("accepts an internal absolute path with its query and fragment", async () => {
    const { safeReturnPath } = await import("@/routes/auth");
    expect(safeReturnPath("/panel")).toBe("/panel");
    expect(safeReturnPath("/degerlendirmeler/karsilastir?ids=a,b")).toBe(
      "/degerlendirmeler/karsilastir?ids=a,b",
    );
  });

  it("rejects everything that could leave this origin", async () => {
    const { safeReturnPath } = await import("@/routes/auth");
    for (const hostile of [
      null,
      "",
      "panel",
      "//evil.example",
      "/\\evil.example",
      "https://evil.example",
      "http://evil.example",
      "javascript:alert(1)",
      "\t//evil.example",
    ]) {
      expect(safeReturnPath(hostile), `${String(hostile)} kabul edildi`).toBeNull();
    }
  });
});

describe("the information architecture has no orphans and no traps", () => {
  it("keeps anonymous visitors out of the private capability matrix", async () => {
    const { PUBLIC_NAV } = await import("@/routes/public");
    expect(PUBLIC_NAV.map((item) => item.to)).not.toContain("/yetenekler");
  });

  /**
   * The 404 page is a public surface, and it was pointing into the private one.
   *
   * `PUBLIC_NAV` had `/yetenekler` removed for exactly this reason - it is a
   * workspace route behind the session boundary - and the not-found page kept
   * offering it as one of its two ways out. A visitor who mistypes an address
   * is the least oriented person in the product, and the recovery link handed
   * them a login wall. `/nasil-calisir` is the public account of what this
   * product does, and it is where that link belongs.
   */
  it("offers a mistyped address no route it cannot open", async () => {
    await renderAppAt("/boyle-bir-sayfa-yok");
    const heading = await screen.findByRole("heading", { level: 1, name: "Sayfa bulunamadı" });
    const page = heading.closest(".dt-stack") as HTMLElement;
    const hrefs = [...page.querySelectorAll("a")].map((anchor) => anchor.getAttribute("href"));

    expect(hrefs, "404 sayfası oturum duvarına bağlantı veriyor").not.toContain("/yetenekler");
    expect(hrefs).toContain("/nasil-calisir");
    expect(hrefs).toContain("/");
  });

  it("redirects the bare organisation path to the profile", async () => {
    await renderAppAt("/organizasyon");
    expect(await screen.findByRole("heading", { level: 1, name: /profil/iu })).toBeInTheDocument();
  });

  it("redirects the bare settings path to appearance", async () => {
    await renderAppAt("/ayarlar");
    expect(await screen.findByRole("heading", { level: 1, name: "Görünüm" })).toBeInTheDocument();
  });

  it("links the settings sections to one another", async () => {
    await renderAppAt("/ayarlar/gorunum");
    const subnav = await screen.findByRole("navigation", { name: "Ayarlar bölümleri" });
    const hrefs = [...subnav.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    // The AI provider section joins this list in the phase that creates its
    // route; asserting it here would be asserting a link to nowhere.
    expect(hrefs).toEqual(
      expect.arrayContaining([
        "/ayarlar/gorunum",
        "/ayarlar/erisilebilirlik",
        "/ayarlar/guvenlik",
      ]),
    );
  });

  it("links the organisation sections to one another", async () => {
    await renderAppAt("/organizasyon/profil");
    const subnav = await screen.findByRole("navigation", { name: "Organizasyon bölümleri" });
    const hrefs = [...subnav.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(
      expect.arrayContaining(["/organizasyon/profil", "/organizasyon/hazirlik"]),
    );
  });
});

describe("the denied pattern navigates instead of reloading the document", () => {
  it("renders a real link rather than driving window.location", async () => {
    const { PermissionDenied } = await import("@/components");
    const { createMemoryRouter, RouterProvider } = await import("react-router");
    const { render } = await import("@testing-library/react");

    const router = createMemoryRouter(
      [{ path: "*", element: <PermissionDenied loginHref="/giris?donus=%2Fpanel" /> }],
      { initialEntries: ["/panel"] },
    );
    render(<RouterProvider router={router} />);

    const link = await screen.findByRole("link", { name: "Giriş yap" });
    expect(link).toHaveAttribute("href", "/giris?donus=%2Fpanel");
    await waitFor(() => expect(screen.queryByRole("button", { name: "Giriş yap" })).toBeNull());
  });
});
