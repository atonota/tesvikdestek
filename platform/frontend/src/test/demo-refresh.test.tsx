/**
 * The demo has to survive a refresh on the static publication - and only there.
 *
 * **The defect this file exists for.** On GitHub Pages a visitor clicks
 * "Müşteri demosunu aç", lands on `/panel`, and presses reload. The demo
 * session lives in module memory, a reload discards module memory, so the
 * workspace gate falls back to its evidence read - `GET /api/degerlendirmeler`
 * - against a file server that has no such endpoint. The visitor gets
 * "Çalışma alanı açılamadı", the address bar still says `/panel`, and nothing
 * on screen explains what happened or how to get back. Opening the same URL
 * directly, or following a deep link into a workspace screen, fails the same
 * way. On the publication whose *only* working feature is the demo, that is
 * the demo being broken.
 *
 * **The scope this package froze, before a line was written.** Only that
 * regression, on the static build. No new product surface, no role model, no
 * change to the ordinary deployment's authentication.
 *
 * **The acceptance criteria, each one a test below or in
 * `e2e/pages-static-demo.spec.ts`.**
 *
 *   1. On the static build, a reload or a direct deep link re-establishes the
 *      demo for both profiles, and the role that was chosen is the role that
 *      comes back - a customer does not reload into a superadmin badge.
 *   2. The mechanism is the address bar and nothing else. Not localStorage,
 *      not sessionStorage, not indexedDB, not a cookie: a demo role written to
 *      storage outlives the tab and looks exactly like a session marker to
 *      anybody auditing the browser afterwards. `?demo=<rol>` is visible,
 *      copyable, and gone the moment the URL is.
 *   3. The static build sends *no* request to any backend or auth endpoint,
 *      whatever the URL says. A static page that reaches for `/giris` or
 *      `/api/...` is a page collecting things nobody will receive.
 *   4. An absent or unrecognised demo context is refused safely: the visitor
 *      is sent to the login screen, where the two profiles are, rather than
 *      shown a server error about a server that does not exist.
 *   5. Leaving the demo really leaves it. Returning to the same address in the
 *      same document does not walk back in.
 *   6. `VITE_STATIC_DEMO_ONLY=false` - the ordinary deployment behind FastAPI -
 *      is byte-for-byte unchanged: the URL parameter grants nothing there, the
 *      session boundary still asks the server, and a missing session is still
 *      "Oturum gerekli".
 *
 * What is deliberately *not* claimed: that a URL parameter is authentication.
 * It grants nothing. There is nothing to grant - the demo opens example data
 * that is compiled into the bundle every visitor already downloaded, and the
 * shell says "Demo" on every screen while it is open.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestRouter } from "@/app/router";
import {
  DEMO_PROFILES,
  demoBadgeLabel,
  getDemoSession,
  resetDemoSessionState,
  startDemoSession,
} from "@/demo";
import { server } from "@/mocks/server";

/** Recorded at MSW's own boundary, so this is the real network, not a stub. */
function recordRequests(): { readonly seen: string[] } {
  const seen: string[] = [];
  const listener = ({ request }: { request: Request }) => {
    seen.push(`${request.method} ${new URL(request.url).pathname}`);
  };
  server.events.on("request:start", listener);
  cleanups.push(() => server.events.removeListener("request:start", listener));
  return { seen };
}

let cleanups: Array<() => void> = [];

beforeEach(() => {
  cleanups = [];
});

afterEach(() => {
  for (const undo of cleanups) undo();
  /*
   * Unmount *before* clearing module memory, and this order is load-bearing.
   *
   * The gate under test subscribes to the demo session, so clearing it while
   * the tree is still mounted is a state change the tree reacts to: it sees a
   * document with `?demo=…` in the address and no session, and does exactly
   * what this package built it to do - it opens the demo again. The next test
   * then starts inside a session it never asked for. Unmounting first removes
   * the reader before the state it reads goes away.
   */
  cleanup();
  // Module memory *and* the exit latch: both outlive `cleanup()`, and a test
  // that pressed Çıkış must not hand the next one a document that already left.
  resetDemoSessionState();
  vi.unstubAllEnvs();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

/** The one build flag that separates the two deployments. */
function buildStaticDemoOnly(): void {
  vi.stubEnv("VITE_STATIC_DEMO_ONLY", "true");
}

/**
 * A fresh document, as far as this application can tell.
 *
 * The router is returned as well as the view: the address is the storage under
 * test, so the assertions have to be able to read it and to navigate without
 * going through a link that happens to exist on the current screen.
 */
async function openApp(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const router = createTestRouter(path);
  const view = render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await waitFor(
    () => {
      expect(view.container.querySelector("main")).not.toBeNull();
      expect(view.container.querySelector(".dt-skeleton")).toBeNull();
    },
    /*
     * Same patience, and the same reason, as `render-app.tsx`: this waits on a
     * dynamic route import that now pulls the design system and the icon set,
     * on one of forty-seven files running in parallel. 5000 was also Vitest's
     * per-test default, so this wait could consume the whole test budget.
     * The assertion is unchanged - a `<main>` and no skeleton left.
     */
    { timeout: 15_000 },
  );
  return { view, client, router };
}

function currentUrl(router: { state: { location: { pathname: string; search: string } } }): string {
  return `${router.state.location.pathname}${router.state.location.search}`;
}

function profile(id: string) {
  const found = DEMO_PROFILES.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`demo profili yok: ${id}`);
  return found;
}

/* ------------------------------------ 1. the reload the defect was about */

describe("the static publication rebuilds the demo from the address bar", () => {
  it.each(DEMO_PROFILES.map((entry) => [entry.id, demoBadgeLabel(entry.id)] as const))(
    "%s: reopening /panel?demo=… gives the workspace back, with that role's badge",
    async (role, badge) => {
      buildStaticDemoOnly();
      const requests = recordRequests();

      // No module memory: this is what a reload leaves behind.
      expect(getDemoSession()).toBeNull();
      await openApp(`/panel?demo=${role}`);

      expect(await screen.findByRole("heading", { level: 1, name: "Kokpit" })).toBeInTheDocument();
      expect(await screen.findByText(badge)).toBeInTheDocument();
      expect(getDemoSession()?.role).toBe(role);
      expect(requests.seen).toEqual([]);
    },
  );

  it("opens a workspace deep link directly, not just the dashboard", async () => {
    buildStaticDemoOnly();
    const requests = recordRequests();

    await openApp("/organizasyon/hazirlik?demo=customer");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Organizasyon hazırlığı" }),
    ).toBeInTheDocument();
    expect(await screen.findByText(demoBadgeLabel("customer"))).toBeInTheDocument();
    expect(requests.seen).toEqual([]);
  });

  it("never shows the server-failure screen for a demo that only lost its memory", async () => {
    buildStaticDemoOnly();
    await openApp("/panel?demo=superadmin");
    expect(screen.queryByText("Çalışma alanı açılamadı")).not.toBeInTheDocument();
    expect(screen.queryByText(/Kayıt bulunamadı/u)).not.toBeInTheDocument();
  });

  it("restores the demo rows too, so the workspace is not an empty shell", async () => {
    buildStaticDemoOnly();
    await openApp("/degerlendirmeler?demo=customer");
    expect((await screen.findAllByText(/TUBITAK-1501/u)).length).toBeGreaterThan(0);
  });
});

/* ---------------------------- 2. the address is written, and kept written */

describe("entering the demo puts the role in the address, where a reload can find it", () => {
  it("carries ?demo=… after a one-click entry", async () => {
    buildStaticDemoOnly();
    const { router } = await openApp("/giris");

    await userEvent.click(
      await screen.findByRole("button", { name: profile("superadmin").actionLabel }),
    );
    await screen.findByRole("heading", { level: 1, name: "Kokpit" });

    await waitFor(() => expect(currentUrl(router)).toBe("/panel?demo=superadmin"));
  });

  it("keeps it across in-app navigation, so any screen can be reloaded", async () => {
    buildStaticDemoOnly();
    const { router } = await openApp("/panel?demo=customer");
    await screen.findByText(demoBadgeLabel("customer"));

    await act(async () => {
      await router.navigate("/olgunluk");
    });
    await screen.findByRole("heading", { level: 1, name: "Olgunluk" });

    await waitFor(() => expect(currentUrl(router)).toBe("/olgunluk?demo=customer"));
  });

  /**
   * The fragment survives the rewrite.
   *
   * The address is corrected underneath a reader who is already somewhere
   * inside a long screen. Dropping `#…` while doing it would move them back to
   * the top - a scroll position lost to a mechanism they never asked about.
   */
  it("keeps the fragment when it writes the role into the address", async () => {
    buildStaticDemoOnly();
    startDemoSession("customer");
    const { router } = await openApp("/panel#kanit-3");

    await screen.findByText(demoBadgeLabel("customer"));
    await waitFor(() => expect(currentUrl(router)).toBe("/panel?demo=customer"));
    expect(router.state.location.hash).toBe("#kanit-3");
  });

  it("carries the fragment into the login return path when it refuses", async () => {
    buildStaticDemoOnly();
    const { router } = await openApp("/panel#kanit-3");

    await screen.findByRole("heading", { level: 1, name: "Giriş" });
    await waitFor(() =>
      expect(router.state.location.search).toContain(encodeURIComponent("/panel#kanit-3")),
    );
  });

  it("keeps the session's own role when the address disagrees with it", async () => {
    buildStaticDemoOnly();
    // A stale link from before the visitor switched profiles must not relabel
    // the running demo; the open session is the fact, the address follows it.
    startDemoSession("customer");
    const { router } = await openApp("/panel?demo=superadmin");

    expect(await screen.findByText(demoBadgeLabel("customer"))).toBeInTheDocument();
    await waitFor(() => expect(currentUrl(router)).toBe("/panel?demo=customer"));
    expect(getDemoSession()?.role).toBe("customer");
  });
});

/* ------------------------------------- 3./4. an absent or invalid context */

describe("a demo context that is missing or unreadable is refused safely", () => {
  it("sends a bare workspace URL to the login screen instead of the network", async () => {
    buildStaticDemoOnly();
    const requests = recordRequests();

    await openApp("/panel");

    expect(await screen.findByRole("heading", { level: 1, name: "Giriş" })).toBeInTheDocument();
    expect(getDemoSession()).toBeNull();
    expect(requests.seen).toEqual([]);
  });

  it.each(["root", "SUPERADMIN", "", "customer,superadmin", "<script>"])(
    "refuses ?demo=%s without starting anything",
    async (value) => {
      buildStaticDemoOnly();
      const requests = recordRequests();

      await openApp(`/panel?demo=${encodeURIComponent(value)}`);

      expect(await screen.findByRole("heading", { level: 1, name: "Giriş" })).toBeInTheDocument();
      expect(getDemoSession()).toBeNull();
      expect(requests.seen).toEqual([]);
    },
  );

  it("does not carry an unreadable value forward into the login address", async () => {
    buildStaticDemoOnly();
    const { router } = await openApp("/panel?demo=root");
    await screen.findByRole("heading", { level: 1, name: "Giriş" });
    await waitFor(() => expect(currentUrl(router)).not.toMatch(/demo=root/u));
  });
});

/* --------------------------------------- 3. no backend request, ever, here */

describe("the static build reaches no backend or auth endpoint at all", () => {
  it("answers a public screen without a request, and says why", async () => {
    buildStaticDemoOnly();
    const requests = recordRequests();

    await openApp("/programlar");

    // The refusal is rendered twice by `ErrorState` - as the message and as
    // its technical detail - so this counts rather than expecting one node.
    expect((await screen.findAllByText(/statik/iu)).length).toBeGreaterThan(0);
    expect(requests.seen).toEqual([]);
  });

  it("makes no request while the demo is being rebuilt from the address", async () => {
    buildStaticDemoOnly();
    const requests = recordRequests();
    await openApp("/kaynaklar?demo=superadmin");
    await screen.findByText(demoBadgeLabel("superadmin"));
    expect(requests.seen).toEqual([]);
  });
});

/* ------------------------------------------------ 5. leaving really leaves */

describe("leaving the demo cannot be undone by going back to the address", () => {
  it("does not reopen the demo when the same URL is revisited afterwards", async () => {
    buildStaticDemoOnly();
    const { router } = await openApp("/panel?demo=customer");
    await screen.findByText(demoBadgeLabel("customer"));

    await userEvent.click(screen.getByRole("button", { name: "Çıkış" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Giriş" })).toBeInTheDocument();

    await act(async () => {
      await router.navigate("/panel?demo=customer");
    });

    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1, name: "Giriş" })).toBeInTheDocument(),
    );
    expect(getDemoSession()).toBeNull();
    expect(screen.queryByText(demoBadgeLabel("customer"))).not.toBeInTheDocument();
  });
});

/* ------------------------------------------- 2. nothing is persisted, still */

describe("rebuilding the demo persists nothing", () => {
  it("writes no demo trace to storage and sets no cookie", async () => {
    buildStaticDemoOnly();
    await openApp("/panel?demo=superadmin");
    await screen.findByText(demoBadgeLabel("superadmin"));

    expect(document.cookie).toBe("");
    expect(Object.entries({ ...window.sessionStorage })).toEqual([]);
    for (const [key, value] of Object.entries({ ...window.localStorage })) {
      expect(`${key} ${String(value)}`).not.toMatch(/superadmin|customer|@demo\.|oturum|demo=/iu);
    }
  });

  it("names no browser storage API in the module that reads the address", () => {
    const codeOnly = (text: string): string =>
      text.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/^\s*\/\/.*$/gmu, "");
    const source = codeOnly(readFileSync(join(process.cwd(), "src", "demo", "url.ts"), "utf8"));
    expect(source).not.toMatch(/\b(localStorage|sessionStorage|indexedDB|document\.cookie)\b/u);
  });
});

/* ---------------------------------- 6. the ordinary deployment is untouched */

describe("the deployment with a server behind it behaves exactly as it did", () => {
  it("grants nothing for ?demo=… and still asks the backend", async () => {
    const requests = recordRequests();

    await openApp("/panel?demo=superadmin");

    await screen.findByRole("heading", { level: 1, name: "Kokpit" });
    expect(getDemoSession()).toBeNull();
    expect(screen.queryByText(/^Demo · /u)).not.toBeInTheDocument();
    expect(requests.seen).toContain("GET /api/degerlendirmeler");
  });

  it("still answers a missing session with the session screen, not a demo", async () => {
    server.use(
      http.get("/api/degerlendirmeler", () =>
        HttpResponse.json({ detail: "Yetkisiz." }, { status: 401 }),
      ),
    );

    await openApp("/panel?demo=customer");

    expect(await screen.findByRole("heading", { name: "Oturum gerekli" })).toBeInTheDocument();
    expect(getDemoSession()).toBeNull();
  });

  it("leaves the address alone when there is no static demo to keep", async () => {
    const { router } = await openApp("/panel");
    await screen.findByRole("heading", { level: 1, name: "Kokpit" });
    expect(currentUrl(router)).toBe("/panel");
  });
});
