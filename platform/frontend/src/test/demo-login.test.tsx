/**
 * The one-click demo entry on the login screen.
 *
 * What this feature is, stated once and enforced by everything below: a
 * **frontend** demo. The backend has no role model and no seeded demo account -
 * `domain/capabilities.ts` records `roles` as blocked for exactly that reason -
 * so a demo entry that claimed server authorisation would be the precise lie
 * this product exists to refuse. What is real here is a session held in module
 * memory and a data adapter that answers the reads, and the interface says so
 * on every screen it opens.
 *
 * Six properties are pinned, and each one failed before the feature existed:
 *
 *   1. two profiles, not one and not a generic "demoya gir" button - and they
 *      differ in *label and review context only*. Both open the same screens,
 *      the same navigation and the same example data. Saying anything stronger
 *      would be describing a role model nobody has built; an independent review
 *      caught exactly that claim in an earlier draft of this file, and there is
 *      now a test below that refuses to let it back in.
 *   2. one click enters, and the safe-return contract is the *same* one the
 *      credential form obeys - `safeReturnPath`, not a second implementation
 *      that a hostile `donus` could walk through.
 *   3. the running app says Demo and which role, in the shell, on every screen.
 *      A demo that looks identical to the real product is how demo data ends up
 *      quoted in a board pack.
 *   4. entry sends exactly one request, and it is a *real* `POST /cikis`. This
 *      is the correction to a defect an independent review found: a demo that
 *      sent nothing left any existing httpOnly session untouched, so leaving
 *      the demo handed the visitor back a live tenant session behind a screen
 *      that had just said "Demo". Nothing is faked - the browser is genuinely
 *      signed out before the demo opens, and the demo opens only if that
 *      succeeded. Exit then needs no request, because entry already did it.
 *   5. logout clears the demo and the query cache, and a manual login clears
 *      the demo *before* it posts - otherwise a real session would run with
 *      demo answers still in cache.
 *   6. no credential and no session marker reaches localStorage,
 *      sessionStorage, indexedDB or a cookie. `truth-guard.test.ts` already
 *      bans storage across `src/`; this file bans it again at runtime, because
 *      a source scan cannot see what a dependency writes.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, type RenderResult } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { queryKeys } from "@/api/queries";
import { createTestRouter } from "@/app/router";
import { decisionFixtures } from "@/demo";
import {
  decisionListSchema,
  programListSchema,
  readinessHealthSchema,
  snapshotListSchema,
} from "@/api/types";
import {
  DEMO_PROFILES,
  demoBadgeLabel,
  demoDecisions,
  demoPrograms,
  demoSnapshots,
  endDemoSession,
  getDemoSession,
  startDemoSession,
} from "@/demo";
import { server } from "@/mocks/server";

const SRC = join(process.cwd(), "src");

/** Every write the backend exposes. None of them may be reached in demo mode. */
const WRITE_PATHS = ["/giris", "/kayit", "/cikis", "/profil", "/api/degerlendir"] as const;

/**
 * Requests the interceptor saw, recorded per test.
 *
 * `server.events` is MSW's own request log, so this observes the real network
 * boundary rather than a stub somebody could forget to install.
 */
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
  // Module memory is the whole storage mechanism, so it outlives `cleanup()`.
  endDemoSession();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

/** The app, mounted like `render-app.tsx` but with the client kept in hand. */
async function renderApp(path: string): Promise<{
  readonly view: RenderResult;
  readonly client: QueryClient;
}> {
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
    { timeout: 5000 },
  );
  return { view, client };
}

function profile(id: string) {
  const found = DEMO_PROFILES.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`demo profili yok: ${id}`);
  return found;
}

/* ------------------------------------------------- 1. two explicit profiles */

describe("the login screen offers two named demo profiles", () => {
  it("declares exactly two, and they are superadmin and customer", () => {
    expect(DEMO_PROFILES.map((entry) => entry.id)).toEqual(["superadmin", "customer"]);
  });

  it("shows a card for each, with its role named in words", async () => {
    await renderApp("/giris");
    for (const entry of DEMO_PROFILES) {
      const heading = await screen.findByRole("heading", { name: entry.title });
      // Scoped to the card: the role name legitimately appears in the summary
      // prose too, and a document-wide query cannot tell the two apart.
      const card = heading.closest(".dt-demo__card");
      expect(card).not.toBeNull();
      expect(card?.textContent).toContain(entry.roleLabel);
    }
  });

  it("shows the demo e-mail and password on screen rather than hiding them", async () => {
    await renderApp("/giris");
    for (const entry of DEMO_PROFILES) {
      expect(await screen.findByText(entry.email)).toBeInTheDocument();
      expect(screen.getByText(entry.password)).toBeInTheDocument();
    }
  });

  it("gives each profile one distinct, full-width action", async () => {
    await renderApp("/giris");
    const actions = await Promise.all(
      DEMO_PROFILES.map((entry) => screen.findByRole("button", { name: entry.actionLabel })),
    );
    // Distinct: two buttons with the same name are two buttons nobody can tell
    // apart, on the one screen where picking the wrong one is the whole risk.
    expect(new Set(actions.map((button) => button.textContent))).toHaveProperty("size", 2);
    for (const button of actions) {
      expect(button.className).toContain("dt-btn--block");
    }
  });

  /**
   * The two profiles differ in *label*, not in product.
   *
   * The first version of this feature said, in prose and in a card, that a
   * superadmin and a customer "see different products" and different data. No
   * such thing was built and none exists: there is no role model, no
   * permission check, no per-role navigation and no second data set. Both
   * profiles open the same surfaces with the same demo rows. Writing a product
   * hypothesis into a demo card is how an invented capability gets quoted back
   * as a delivered one, so the claim is now banned by test rather than by
   * having been edited once.
   */
  it("claims no per-role product, data or navigation difference", async () => {
    const source = readFileSync(join(SRC, "demo", "profiles.ts"), "utf8");
    for (const claim of [
      // Turkish, as the card copy would phrase it.
      /farklı (ürün|veri|yüzey|ekran|menü)/iu,
      /ayrı (ürün|veri seti|yüzey)/iu,
      /yalnızca .* rolünün göreceği/iu,
      /yetki verir|yetkilendirir/iu,
      // English, as the module prose phrased it - which is where it actually was.
      /not the same product/iu,
      /different (product|data|surface|navigation|screens)/iu,
      /the surface their own organisation gets/iu,
      /being shown the operational surface/iu,
    ]) {
      expect(source, `profiles.ts gerçek olmayan bir rol iddiası taşıyor: ${String(claim)}`).not.toMatch(
        claim,
      );
    }
    // The one thing that legitimately differs between the two profiles.
    const [first, second] = DEMO_PROFILES;
    expect(first?.emphasis).not.toEqual(second?.emphasis);
  });

  /**
   * The adapter answers the same rows whichever profile is open.
   *
   * Sampled under each session in turn and compared across them, rather than
   * compared with itself - a self-comparison is true of any function and would
   * have gone on passing beside a role-aware adapter. This is the assertion
   * that fails the day someone gives one profile its own data, which is the
   * moment the "same example data" wording on the card and in `profiles.ts`
   * stops being true and has to be rewritten with it.
   */
  it("serves identical demo data to both profiles", () => {
    startDemoSession("superadmin");
    const superadmin = {
      programs: demoPrograms(),
      snapshots: demoSnapshots(),
      decisions: demoDecisions(),
    };

    startDemoSession("customer");
    const customer = {
      programs: demoPrograms(),
      snapshots: demoSnapshots(),
      decisions: demoDecisions(),
    };

    expect(customer, "demo verisi role göre ayrışıyor; kartlardaki 'aynı örnek veri' ifadesi artık doğru değil").toEqual(
      superadmin,
    );
    // And the sample is not vacuously empty in either session.
    expect(superadmin.programs.length).toBeGreaterThan(0);
    expect(superadmin.decisions.length).toBeGreaterThan(0);
  });

  it("says plainly that this is a frontend demo, not a real authorisation", async () => {
    await renderApp("/giris");
    const notice = await screen.findByTestId("demo-giris-uyarisi");
    expect(notice.textContent).toMatch(/demo/iu);
    expect(notice.textContent).toMatch(/yetkilendirme|rol modeli|backend/iu);
  });

  it("leaves the manual credential form exactly where it was", async () => {
    await renderApp("/giris");
    expect(await screen.findByLabelText(/E-posta/u)).toBeInTheDocument();
    expect(screen.getByLabelText(/Parola/u)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Giriş yap" })).toBeInTheDocument();
  });
});

/* ------------------------------------------------------- 2. the one click */

describe("one click opens the application", () => {
  it("lands the superadmin on the dashboard when there is nothing to return to", async () => {
    await renderApp("/giris");
    await userEvent.click(
      await screen.findByRole("button", { name: profile("superadmin").actionLabel }),
    );
    expect(await screen.findByRole("heading", { level: 1, name: "Kokpit" })).toBeInTheDocument();
  });

  it("returns the customer to the safe path they were bounced from", async () => {
    await renderApp(`/giris?donus=${encodeURIComponent("/organizasyon/hazirlik")}`);
    await userEvent.click(
      await screen.findByRole("button", { name: profile("customer").actionLabel }),
    );
    expect(
      await screen.findByRole("heading", { level: 1, name: "Organizasyon hazırlığı" }),
    ).toBeInTheDocument();
  });

  it.each([
    "https://evil.example/panel",
    "//evil.example/panel",
    "javascript:alert(1)",
    "/\\evil.example",
  ])("refuses %s exactly as the credential form does", async (hostile) => {
    await renderApp(`/giris?donus=${encodeURIComponent(hostile)}`);
    await userEvent.click(
      await screen.findByRole("button", { name: profile("superadmin").actionLabel }),
    );
    expect(await screen.findByRole("heading", { level: 1, name: "Kokpit" })).toBeInTheDocument();
  });

  it("opens a workspace with real rows in it, not an empty shell", async () => {
    startDemoSession("customer");
    await renderApp("/degerlendirmeler");
    // The demo adapter answered the read the session boundary depends on.
    // The code appears in more than one cell of the decision workspace, which
    // is itself evidence the rows rendered rather than a single stray label.
    expect((await screen.findAllByText(/TUBITAK-1501/u)).length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------- 3. the shell says demo */

describe("the running application never hides that it is a demo", () => {
  it.each(DEMO_PROFILES.map((entry) => [entry.id, demoBadgeLabel(entry.id)] as const))(
    "%s sees the demo badge naming its role",
    async (id, label) => {
      startDemoSession(id);
      await renderApp("/panel");
      expect(await screen.findByText(label)).toBeInTheDocument();
    },
  );

  it("carries the badge onto another screen, not just the landing one", async () => {
    startDemoSession("superadmin");
    await renderApp("/olgunluk");
    expect(await screen.findByText(demoBadgeLabel("superadmin"))).toBeInTheDocument();
  });

  it("shows no demo badge in a real session", async () => {
    await renderApp("/panel");
    await screen.findByRole("heading", { level: 1, name: "Kokpit" });
    expect(screen.queryByText(/^Demo · /u)).not.toBeInTheDocument();
  });
});

/* --------------------------------------------------- 4. nothing is posted */

describe("a demo session is not a server session and sends no request pretending to be one", () => {
  /*
   * The correction this group exists for.
   *
   * The first version of this feature sent *nothing* on demo entry, which read
   * as the honest choice and was the opposite. Authentication here is an
   * httpOnly cookie: the browser holds it, this code cannot see it, and
   * nothing about opening a demo removes it. So a real operator who signed in,
   * walked to `/giris`, clicked a demo card and later left the demo still had a
   * live server session - and `/panel` opened their real tenant's data behind a
   * badge that had said "Demo" a moment earlier. Two identities in one tab,
   * with the interface confident about the wrong one.
   *
   * The fix is not to fake anything. It is to *really* end the server session
   * first: a genuine `POST /cikis`, the same one the exit button sends, and the
   * demo starts only if it succeeded. That is a security action, not an auth
   * simulation - the browser really is signed out afterwards.
   */
  it("posts exactly one real logout, and nothing else, when the demo is started", async () => {
    const requests = recordRequests();
    await renderApp("/giris");
    await userEvent.click(
      await screen.findByRole("button", { name: profile("superadmin").actionLabel }),
    );
    await screen.findByRole("heading", { level: 1, name: "Kokpit" });

    expect(requests.seen.filter((entry) => entry.startsWith("POST"))).toEqual(["POST /cikis"]);
    // The one thing a demo must never do is drive the sign-in endpoint.
    expect(requests.seen).not.toContain("POST /giris");
  });

  it("has not started the demo yet at the moment the logout leaves", async () => {
    // The ordering *is* the fix: a demo that starts before the logout resolves
    // is a window in which both sessions are open.
    let sessionAtLogout: unknown = "hiç istek görülmedi";
    const listener = ({ request }: { request: Request }) => {
      if (new URL(request.url).pathname === "/cikis") {
        sessionAtLogout = getDemoSession();
      }
    };
    server.events.on("request:start", listener);
    cleanups.push(() => server.events.removeListener("request:start", listener));

    await renderApp("/giris");
    await userEvent.click(
      await screen.findByRole("button", { name: profile("customer").actionLabel }),
    );
    await screen.findByRole("heading", { level: 1, name: "Kokpit" });

    expect(sessionAtLogout).toBeNull();
    // And it is running by the time the workspace painted.
    expect(getDemoSession()?.role).toBe("customer");
  });

  it("does not open the demo at all when the logout fails", async () => {
    server.use(http.post("/cikis", () => new HttpResponse(null, { status: 500 })));

    await renderApp("/giris");
    await userEvent.click(
      await screen.findByRole("button", { name: profile("superadmin").actionLabel }),
    );

    // The failure is shown, not swallowed, and the visitor stays put.
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(getDemoSession()).toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: "Giriş" })).toBeInTheDocument();
  });

  /*
   * Two assertions, deliberately split, because they are two different claims.
   *
   * The first is about the template and is checked directly on it: given a
   * profile mid-entry, the *other* action must be disabled rather than merely
   * un-busy. Driving this through the whole application would mean holding a
   * request open inside a shared MSW server while the rest of the suite runs
   * beside it - which is slow, and worse, non-deterministic for every other
   * file. A component claim gets a component test.
   *
   * The second is about the route: that `demoStarting` is fed by the real
   * mutation's pending state rather than by a decorative local flag. That is a
   * wiring claim, and it is checked by reading the wiring.
   */
  it("disables the other role's action while one is being opened", async () => {
    const { AuthForm } = await import("@/components");
    render(
      <AuthForm
        mode="login"
        onSubmit={() => {}}
        demoProfiles={DEMO_PROFILES}
        onDemoStart={() => {}}
        demoStarting="superadmin"
      />,
    );

    // A busy Button renders its `loadingLabel` in place of its children, so
    // the chosen card is found by that name rather than by its idle one -
    // which is itself the announcement the loading state is there to make.
    const chosen = screen.getByRole("button", { name: /Demo açılıyor/u });
    const other = screen.getByRole("button", { name: profile("customer").actionLabel });

    expect(chosen).toHaveAttribute("aria-busy", "true");
    expect(chosen).toBeDisabled();
    expect(other).toBeDisabled();
    expect(other).not.toHaveAttribute("aria-busy");
  });

  it("feeds that busy state from the real mutation, not a cosmetic flag", () => {
    const route = readFileSync(join(SRC, "routes", "auth.tsx"), "utf8");
    // The pending state and the role in flight both come from the mutation.
    expect(route).toMatch(/demoStarting=\{startDemo\.isPending \? startDemo\.variables : null\}/u);
    // And the demo is entered through the mutation rather than inline.
    expect(route).toMatch(/startDemo\.mutate\(/u);
    expect(route).not.toMatch(/startDemoSession\(/u);
  });

  /**
   * The probe that proves the server really let go.
   *
   * Every other assertion here is about what this client does. This one is
   * about what the *server* thinks afterwards, which is the only question the
   * reviewer's finding was actually about. The handler set below holds a
   * server-side flag: the session read succeeds while it is open, `POST /cikis`
   * closes it, and a closed session answers 401. So if demo entry ever stopped
   * sending a real logout, this test would find `/panel` still serving tenant
   * data after the demo was left - which is the defect, reproduced.
   */
  it("leaves the server session genuinely closed, so /panel needs a login again", async () => {
    let serverSessionOpen = true;
    server.use(
      http.get("/api/degerlendirmeler", () =>
        serverSessionOpen
          ? HttpResponse.json(decisionFixtures)
          : new HttpResponse(null, { status: 401 }),
      ),
      http.post("/cikis", () => {
        serverSessionOpen = false;
        return HttpResponse.redirect(new URL("/", globalThis.location.origin).toString(), 303);
      }),
    );

    await renderApp("/giris");
    await userEvent.click(
      await screen.findByRole("button", { name: profile("superadmin").actionLabel }),
    );
    await screen.findByRole("heading", { level: 1, name: "Kokpit" });
    expect(serverSessionOpen, "demo açıldı ama sunucu oturumu hâlâ açık").toBe(false);

    // Leave the demo, then ask the workspace directly.
    await userEvent.click(screen.getByRole("button", { name: "Çıkış" }));
    await screen.findByRole("heading", { level: 1, name: "Giriş" });

    endDemoSession();
    await renderApp("/panel");
    expect(await screen.findByText("Oturum gerekli")).toBeInTheDocument();
  });

  it("reads nothing from the backend either - the adapter answers", async () => {
    const requests = recordRequests();
    startDemoSession("customer");
    await renderApp("/panel");
    await screen.findByRole("heading", { level: 1, name: "Kokpit" });

    const backendReads = requests.seen.filter((entry) =>
      /\/(api|hazir)/u.test(entry),
    );
    expect(backendReads).toEqual([]);
  });

  /**
   * Leaving a demo needs no request, and that is now a *derived* fact.
   *
   * It is not "a demo never talks to the server" - entry proved otherwise. It
   * is that the server session was already closed on the way in, so there is
   * nothing left to close on the way out. Sending a second `POST /cikis` would
   * be a request that cannot change anything, which this codebase treats as a
   * defect rather than as harmless belt-and-braces.
   */
  it("needs no further request when the demo is ended from the shell", async () => {
    startDemoSession("superadmin");
    const requests = recordRequests();
    await renderApp("/panel");
    await screen.findByRole("heading", { level: 1, name: "Kokpit" });
    await userEvent.click(screen.getByRole("button", { name: "Çıkış" }));
    await screen.findByRole("heading", { level: 1, name: "Giriş" });

    for (const path of WRITE_PATHS) {
      expect(requests.seen).not.toContain(`POST ${path}`);
    }
  });
});

/* ---------------------------------------------- 5. exit and hand-over paths */

describe("leaving the demo really leaves it", () => {
  it("clears the session and returns to the login screen", async () => {
    startDemoSession("superadmin");
    await renderApp("/panel");
    await screen.findByRole("heading", { level: 1, name: "Kokpit" });

    await userEvent.click(screen.getByRole("button", { name: "Çıkış" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Giriş" })).toBeInTheDocument();
    expect(getDemoSession()).toBeNull();
  });

  it("empties the query cache so demo rows cannot outlive the demo", async () => {
    startDemoSession("superadmin");
    const { client } = await renderApp("/panel");
    await screen.findByRole("heading", { level: 1, name: "Kokpit" });
    expect(client.getQueryCache().getAll().length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole("button", { name: "Çıkış" }));
    await screen.findByRole("heading", { level: 1, name: "Giriş" });

    expect(client.getQueryCache().getAll()).toEqual([]);
  });

  /**
   * "Before, not after" measured at the instant the request leaves.
   *
   * The previous version of this test asserted the end state - demo null once
   * the dashboard had painted - and that is satisfied by an implementation
   * which ends the demo in `onSuccess`, i.e. *after* the POST. The window that
   * version leaves open is small and real: between the request leaving and the
   * response arriving, a demo session is live, and every read in that window is
   * answered from demo data while a genuine sign-in is in flight.
   *
   * So the state is sampled inside MSW's `request:start`, which fires as the
   * interceptor receives the outgoing request. The cache is primed first, or
   * "the cache was empty" would be true for reasons that have nothing to do
   * with `clear()` having run.
   */
  it("has already dropped the demo and emptied the cache when the login POST leaves", async () => {
    startDemoSession("customer");
    const { client } = await renderApp("/giris");
    client.setQueryData(queryKeys.decisions, decisionFixtures);
    expect(client.getQueryCache().getAll().length).toBeGreaterThan(0);

    let sessionAtPost: unknown = "hiç istek görülmedi";
    let cachedAtPost = -1;
    const listener = ({ request }: { request: Request }) => {
      if (request.method === "POST" && new URL(request.url).pathname === "/giris") {
        sessionAtPost = getDemoSession();
        cachedAtPost = client.getQueryCache().getAll().length;
      }
    };
    server.events.on("request:start", listener);
    cleanups.push(() => server.events.removeListener("request:start", listener));

    await userEvent.type(await screen.findByLabelText(/E-posta/u), "biri@ornek.com.tr");
    await userEvent.type(screen.getByLabelText(/Parola/u), "cok-guclu-parola-2026");
    await userEvent.click(screen.getByRole("button", { name: "Giriş yap" }));

    await screen.findByRole("heading", { level: 1, name: "Kokpit" });
    expect(sessionAtPost, "demo oturumu gerçek girişten sonra kapatılıyor").toBeNull();
    expect(cachedAtPost, "demo verisi gerçek giriş isteği sırasında hâlâ önbellekte").toBe(0);
    expect(getDemoSession()).toBeNull();
  });
});

/* ------------------------------------------------- 6. nothing is persisted */

describe("the demo session lives in module memory and nowhere else", () => {
  it("writes no demo key to localStorage or sessionStorage", async () => {
    await renderApp("/giris");
    await userEvent.click(
      await screen.findByRole("button", { name: profile("superadmin").actionLabel }),
    );
    await screen.findByRole("heading", { level: 1, name: "Kokpit" });

    const written = [
      ...Object.keys(window.localStorage),
      ...Object.keys(window.sessionStorage),
    ];
    expect(written.filter((key) => /demo|rol|role|oturum|session/iu.test(key))).toEqual([]);
    // The appearance store is the one legitimate writer, and it is not this.
    for (const key of written) {
      expect(JSON.stringify(window.localStorage.getItem(key) ?? "")).not.toMatch(
        /superadmin|customer|@demo\./iu,
      );
    }
  });

  it("sets no cookie", async () => {
    const before = document.cookie;
    startDemoSession("superadmin");
    await renderApp("/panel");
    await screen.findByRole("heading", { level: 1, name: "Kokpit" });

    expect(document.cookie).toBe(before);
    expect(document.cookie).not.toMatch(/demo/iu);
  });

  it("forgets everything when the module state is reset", () => {
    startDemoSession("customer");
    expect(getDemoSession()?.role).toBe("customer");
    endDemoSession();
    expect(getDemoSession()).toBeNull();
  });

  it("the demo module names no browser storage API at all", () => {
    const files: string[] = [];
    const walk = (directory: string) => {
      for (const entry of readdirSync(directory)) {
        const full = join(directory, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.tsx?$/u.test(entry)) files.push(full);
      }
    };
    walk(join(SRC, "demo"));

    expect(files.length).toBeGreaterThan(0);
    /*
     * Comments stripped first, exactly as `truth-guard.test.ts` does it.
     *
     * `session.ts` has to be able to explain *why* it refuses browser storage -
     * that explanation is the most useful thing in the file - and a guard that
     * banned the words would ban its own justification. What is forbidden is
     * the call, not the sentence about the call.
     */
    const codeOnly = (text: string): string =>
      text.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/^\s*\/\/.*$/gmu, "");
    const offenders = files.filter((file) =>
      /\b(localStorage|sessionStorage|indexedDB|document\.cookie)\b/u.test(
        codeOnly(readFileSync(file, "utf8")),
      ),
    );
    expect(offenders.map((file) => file.replace(SRC, "src"))).toEqual([]);

    // The stripper must not be so eager that the guard becomes vacuous.
    expect(codeOnly('const a = 1;\nwindow.localStorage.setItem("x", "y");')).toMatch(
      /localStorage/u,
    );
  });
});

/* -------------------------------------------------- 7. the write refusal */

describe("a demo write is refused in words rather than faked", () => {
  it("refuses the profile save and says why", async () => {
    const requests = recordRequests();
    startDemoSession("customer");
    await renderApp("/organizasyon/profil");

    await userEvent.click(await screen.findByRole("button", { name: "Profili kaydet" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/demo/iu);
    expect(alert.textContent).toMatch(/kaydedilmez|kaydedilmedi/u);
    expect(requests.seen).not.toContain("POST /profil");
  });

  it("never reports a demo write as saved", async () => {
    startDemoSession("customer");
    await renderApp("/organizasyon/profil");
    await userEvent.click(await screen.findByRole("button", { name: "Profili kaydet" }));
    await screen.findByRole("alert");

    expect(screen.queryByText(/kaydedildi|başarıyla/iu)).not.toBeInTheDocument();
  });
});

/* ------------------------------------------- 8. the data adapter is real */

describe("the demo data adapter answers with the API's own shapes", () => {
  it("catalogue, sources, decisions and readiness all parse against the schemas", async () => {
    const demo = await import("@/demo");
    expect(programListSchema.safeParse(demo.demoPrograms()).success).toBe(true);
    expect(snapshotListSchema.safeParse(demo.demoSnapshots()).success).toBe(true);
    expect(decisionListSchema.safeParse(demo.demoDecisions()).success).toBe(true);
    expect(readinessHealthSchema.safeParse(demo.demoReadiness()).success).toBe(true);
  });

  it("carries enough rows for a review to be worth doing", async () => {
    const demo = await import("@/demo");
    expect(demo.demoPrograms().length).toBeGreaterThanOrEqual(3);
    expect(demo.demoDecisions().length).toBeGreaterThanOrEqual(2);
  });

  it("no production module imports the mock fixtures", () => {
    const files: string[] = [];
    const walk = (directory: string) => {
      for (const entry of readdirSync(directory)) {
        const full = join(directory, entry);
        if (statSync(full).isDirectory()) {
          if (entry === "mocks" || entry === "test") continue;
          walk(full);
        } else if (/\.tsx?$/u.test(entry) && !/\.(test|stories)\.tsx?$/u.test(entry)) {
          files.push(full);
        }
      }
    };
    walk(SRC);

    const offenders = files.filter((file) => /from ["']@\/mocks/u.test(readFileSync(file, "utf8")));
    expect(offenders.map((file) => file.replace(SRC, "src"))).toEqual([]);
  });

  it("the mock fixtures are the demo data, not a second copy of it", () => {
    const fixtures = readFileSync(join(SRC, "mocks", "fixtures.ts"), "utf8");
    expect(fixtures).toMatch(/from ["']@\/demo/u);
  });
});
