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
import { cleanup, render, screen, waitFor, type RenderResult } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { MemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  isStaticDemoOnly,
  matchDemoProfile,
  normalizeDemoEmail,
  resetDemoSessionState,
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
  /*
   * Unmounted before module memory is cleared, and the order matters now.
   *
   * On the static publication the workspace gate rebuilds a demo from
   * `?demo=…` in the address. Clearing the session while that tree is still
   * mounted is a state change it reacts to - it sees the address, sees no
   * session, and correctly opens the demo again - so the next test would start
   * inside a session it never created.
   */
  cleanup();
  // Module memory is the whole storage mechanism, so it outlives `cleanup()`.
  // `resetDemoSessionState` rather than `endDemoSession`, because leaving a
  // demo also latches "a demo was ended in this document" - see
  // `demo/session.ts` - and that latch has to be cleared for the next test too.
  resetDemoSessionState();
  // The static-demo flag is build-time configuration, so a test that stubs it
  // must hand it back or every later file in the run inherits a deployment it
  // never asked for.
  vi.unstubAllEnvs();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

/**
 * Fill the real credential form and submit it, as a reviewer would.
 *
 * On `/giris` the form is behind the workbench's secondary "Gerçek hesapla
 * gir" control - the console defaults to the demo role switch, not the
 * credential fields - so this opens that control first when it is present.
 * `/kayit` has no demo to default to, so its form is already open and the
 * toggle does not exist; the query is a `queryByRole` for exactly that case.
 */
async function signInWith(eposta: string, parola: string): Promise<void> {
  const toggle = screen.queryByRole("button", { name: "Gerçek hesapla gir" });
  if (toggle) await userEvent.click(toggle);
  await userEvent.type(await screen.findByLabelText(/E-posta/u), eposta);
  await userEvent.type(screen.getByLabelText(/Parola/u), parola);
  await userEvent.click(screen.getByRole("button", { name: "Giriş yap" }));
}

/** Switch the login console's compact role switch to the named profile. */
async function selectDemoRole(roleLabel: string): Promise<void> {
  await userEvent.click(await screen.findByRole("button", { name: roleLabel }));
}

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
      expect(router.state.navigation.state).toBe("idle");
      expect(view.container.querySelector('[aria-busy="true"]')).toBeNull();
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
  return { view, client };
}

async function expectDemoIdentity(label: string): Promise<void> {
  expect((await screen.findAllByText(label)).length).toBeGreaterThan(0);
}

async function signOutFromAccountMenu(): Promise<void> {
  await userEvent.click(screen.getByRole("button", { name: /^Hesap menüsü,/u }));
  await userEvent.click(await screen.findByRole("menuitem", { name: "Çıkış yap" }));
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

  it("offers a compact role switch naming both roles, not two always-open cards", async () => {
    await renderApp("/giris");
    for (const entry of DEMO_PROFILES) {
      expect(await screen.findByRole("button", { name: entry.roleLabel })).toBeInTheDocument();
    }
    // The old anatomy - a heading-per-card - is gone; there is exactly one
    // profile preview mounted at a time.
    expect(screen.queryAllByText(DEMO_PROFILES[1]!.title).length).toBeLessThanOrEqual(1);
  });

  it("previews only the selected profile, and switches when the role switch is used", async () => {
    await renderApp("/giris");
    // Superadmin is first in DEMO_PROFILES and is the default selection.
    expect(await screen.findByRole("heading", { name: profile("superadmin").title })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: profile("customer").title })).not.toBeInTheDocument();

    await selectDemoRole(profile("customer").roleLabel);

    expect(await screen.findByRole("heading", { name: profile("customer").title })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: profile("superadmin").title })).not.toBeInTheDocument();
  });

  it("does not show either profile's e-mail or password by default", async () => {
    await renderApp("/giris");
    // `<details>` keeps its content in the DOM so it can be revealed without a
    // remount; the browser hides it visually until opened, which is the claim
    // under test here - not whether the text exists in the tree at all.
    for (const entry of DEMO_PROFILES) {
      await selectDemoRole(entry.roleLabel);
      expect(await screen.findByText(entry.email)).not.toBeVisible();
      expect(screen.getByText(entry.password)).not.toBeVisible();
    }
  });

  it("reveals the selected profile's e-mail and password behind an explicit disclosure", async () => {
    await renderApp("/giris");
    const superadmin = profile("superadmin");
    await userEvent.click(await screen.findByText("Demo bilgilerini göster"));
    expect(await screen.findByText(superadmin.email)).toBeVisible();
    expect(screen.getByText(superadmin.password)).toBeVisible();
    // The other profile is not even mounted - only one preview at a time.
    expect(screen.queryByText(profile("customer").email)).not.toBeInTheDocument();
  });

  it("gives the selected profile one full-width demo action, not one button per profile", async () => {
    await renderApp("/giris");
    const superadminAction = await screen.findByRole("button", { name: profile("superadmin").actionLabel });
    expect(superadminAction.className).toContain("cognitive-auth__demo-action");
    // Only one demo action button exists at a time.
    expect(screen.queryByRole("button", { name: profile("customer").actionLabel })).not.toBeInTheDocument();

    await selectDemoRole(profile("customer").roleLabel);

    expect(await screen.findByRole("button", { name: profile("customer").actionLabel })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: profile("superadmin").actionLabel })).not.toBeInTheDocument();
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

  it("keeps the manual credential form reachable, behind the real-account control", async () => {
    await renderApp("/giris");
    expect(screen.queryByLabelText(/E-posta/u)).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: "Gerçek hesapla gir" }));
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
    await selectDemoRole(profile("customer").roleLabel);
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
      await expectDemoIdentity(label);
    },
  );

  it("carries the badge onto another screen, not just the landing one", async () => {
    startDemoSession("superadmin");
    await renderApp("/olgunluk");
    await expectDemoIdentity(demoBadgeLabel("superadmin"));
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
    await selectDemoRole(profile("customer").roleLabel);
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
   * Three assertions, deliberately split, because they are three different
   * safety claims about the same pending state.
   *
   * The first is that the *active* action is disabled, not merely marked
   * busy - a second click on a request already in flight would fire a second
   * mutation racing the first, and `aria-busy` alone never stopped a click.
   *
   * The second is that the role switch itself is disabled while a demo is
   * opening - the selected role must not be able to change mid-flight, which
   * would otherwise leave the in-flight mutation racing a UI that has since
   * moved on to a different profile.
   *
   * The third proves the second has teeth: with the switch disabled, a click
   * on the customer role does not reach it, so the customer action never
   * becomes visible while superadmin's demo is opening.
   *
   * Driving this through the whole application would mean holding a request
   * open inside a shared MSW server while the rest of the suite runs beside
   * it - which is slow, and worse, non-deterministic for every other file. A
   * component claim gets a component test; the route's wiring of
   * `demoStarting` to the real mutation's pending state is a separate claim,
   * checked below by reading the wiring.
   */
  it("disables the active demo action and the role switch while a demo is opening", async () => {
    const { CognitiveAuthCard } = await import("@/components/cognitive-auth/CognitiveAuthCard");
    render(
      <MemoryRouter>
        <CognitiveAuthCard
          mode="login"
          onSubmit={() => {}}
          demoProfiles={DEMO_PROFILES}
          onDemoStart={() => {}}
          demoStarting="superadmin"
        />
      </MemoryRouter>,
    );

    // The active demo action: busy *and* disabled, so a duplicate click
    // cannot fire a second mutation.
    const chosen = screen.getByRole("button", { name: /Demo açılıyor/u });
    expect(chosen).toHaveAttribute("aria-busy", "true");
    expect(chosen).toBeDisabled();

    // The role switch: every option disabled while a demo is mid-flight.
    const customerRoleOption = screen.getByRole("button", {
      name: profile("customer").roleLabel,
    });
    expect(customerRoleOption).toBeDisabled();
    expect(
      screen.getByRole("button", { name: profile("superadmin").roleLabel }),
    ).toBeDisabled();

    // The switch has teeth: clicking the disabled role option does not
    // select it, so its demo action never becomes reachable.
    await userEvent.click(customerRoleOption);
    expect(
      screen.queryByRole("button", { name: profile("customer").actionLabel }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Demo açılıyor/u })).toBeInTheDocument();
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
    await signOutFromAccountMenu();
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
    await signOutFromAccountMenu();
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

    await signOutFromAccountMenu();

    expect(await screen.findByRole("heading", { level: 1, name: "Giriş" })).toBeInTheDocument();
    expect(getDemoSession()).toBeNull();
  });

  it("empties the query cache so demo rows cannot outlive the demo", async () => {
    startDemoSession("superadmin");
    const { client } = await renderApp("/panel");
    await screen.findByRole("heading", { level: 1, name: "Kokpit" });
    expect(client.getQueryCache().getAll().length).toBeGreaterThan(0);

    await signOutFromAccountMenu();
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

    await signInWith("biri@ornek.com.tr", "cok-guclu-parola-2026");

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

/* --------------------------- 9. the printed credentials are usable as typed */

/**
 * The regression this group exists for, and why it is not a nicety.
 *
 * The login screen prints two e-mail addresses and two passwords in a card
 * headed "Tek tıkla demo". A reviewer who has ever used a demo before does the
 * obvious thing with printed credentials: types them into the form directly
 * below them. Before this change that submission went to `POST /giris`, where
 * a backend that has never heard of `@demo.destektesvik.local` answered 401,
 * and the screen said "E-posta veya parola hatalı." about credentials the same
 * screen had just printed as correct.
 *
 * That is worse than a broken button. The interface contradicted itself in the
 * one place a first-time visitor has no way to adjudicate, and the wrong half
 * was the half that looked authoritative. So both doors now open the same
 * room: the card and the form run the *same* `useStartDemo` mutation, through
 * the *same* safe-return contract, and the credentials are matched against the
 * *same* `DEMO_PROFILES` the card renders - not a second copy that can drift.
 */
describe("typing the printed credentials opens the same demo the card opens", () => {
  it.each(DEMO_PROFILES.map((entry) => [entry.id, entry.email, entry.password] as const))(
    "%s signs in from the form and lands on the dashboard",
    async (id, email, password) => {
      await renderApp("/giris");
      await signInWith(email, password);

      expect(await screen.findByRole("heading", { level: 1, name: "Kokpit" })).toBeInTheDocument();
      expect(getDemoSession()?.role).toBe(id);
    },
  );

  it.each(DEMO_PROFILES.map((entry) => [entry.id, entry.email, entry.password] as const))(
    "%s gets the shell badge naming its own role, not the other one",
    async (id, email, password) => {
      await renderApp("/giris");
      await signInWith(email, password);

      await expectDemoIdentity(demoBadgeLabel(id));
      const other = DEMO_PROFILES.find((entry) => entry.id !== id);
      expect(screen.queryByText(demoBadgeLabel(other!.id))).not.toBeInTheDocument();
    },
  );

  it("honours the same safe return path the one-click card honours", async () => {
    await renderApp(`/giris?donus=${encodeURIComponent("/organizasyon/hazirlik")}`);
    const customer = profile("customer");
    await signInWith(customer.email, customer.password);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Organizasyon hazırlığı" }),
    ).toBeInTheDocument();
  });

  it.each([
    "https://evil.example/panel",
    "//evil.example/panel",
    "javascript:alert(1)",
    "/\\evil.example",
  ])("refuses the hostile return path %s on the typed route too", async (hostile) => {
    await renderApp(`/giris?donus=${encodeURIComponent(hostile)}`);
    const superadmin = profile("superadmin");
    await signInWith(superadmin.email, superadmin.password);

    expect(await screen.findByRole("heading", { level: 1, name: "Kokpit" })).toBeInTheDocument();
  });

  /**
   * The assertion the whole regression reduces to.
   *
   * A demo credential must never reach the sign-in endpoint - not because the
   * request would fail, but because it would *succeed at being answered*, and
   * the answer would be a refusal of credentials this application printed.
   */
  it("never posts a printed demo credential to the sign-in endpoint", async () => {
    const requests = recordRequests();
    await renderApp("/giris");
    const superadmin = profile("superadmin");
    await signInWith(superadmin.email, superadmin.password);
    await screen.findByRole("heading", { level: 1, name: "Kokpit" });

    expect(requests.seen).not.toContain("POST /giris");
    // Entry still signs the browser out for real, exactly as the card does.
    expect(requests.seen.filter((entry) => entry.startsWith("POST"))).toEqual(["POST /cikis"]);
  });

  it("does not open the demo from the form either when the logout fails", async () => {
    server.use(http.post("/cikis", () => new HttpResponse(null, { status: 500 })));
    await renderApp("/giris");
    const customer = profile("customer");
    await signInWith(customer.email, customer.password);

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(getDemoSession()).toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: "Giriş" })).toBeInTheDocument();
  });

  /**
   * A demo address with the wrong password is not a demo.
   *
   * The match is on the pair, never on the address alone. Matching the address
   * would mean any password at all opened the demo, which turns a printed
   * e-mail into a skeleton key for a screen that is about to say "Demo" - and
   * it would also swallow a genuine typo instead of letting the server answer.
   */
  it("sends a demo address with the wrong password to the real sign-in", async () => {
    const requests = recordRequests();
    await renderApp("/giris");
    await signInWith(profile("superadmin").email, "bu-parola-yanlis-2026");

    await waitFor(() => expect(requests.seen).toContain("POST /giris"));
    expect(getDemoSession()).toBeNull();
  });

  it("leaves an ordinary sign-in on the real backend path, untouched", async () => {
    const requests = recordRequests();
    await renderApp("/giris");
    await signInWith("biri@ornek.com.tr", "cok-guclu-parola-2026");

    await screen.findByRole("heading", { level: 1, name: "Kokpit" });
    expect(requests.seen).toContain("POST /giris");
    expect(getDemoSession()).toBeNull();
  });

  /**
   * Normalisation, bounded on purpose.
   *
   * A reviewer copying an address out of a card picks up a trailing space, and
   * a phone keyboard capitalises the first letter. Neither is a different
   * account, so neither should be a refusal. What is *not* done is as
   * deliberate: the password is compared byte for byte, because trimming a
   * password silently accepts one the user did not type, and the lowercasing
   * is ASCII-only, because Turkish `I` lowercases to `ı` under a tr-TR locale
   * and `MUSTERI@…` would then stop matching `musteri@…`.
   */
  it("accepts the address with surrounding space and shifted capitals", async () => {
    await renderApp("/giris");
    const superadmin = profile("superadmin");
    await signInWith(`  ${superadmin.email.toUpperCase()}  `, superadmin.password);

    expect(await screen.findByRole("heading", { level: 1, name: "Kokpit" })).toBeInTheDocument();
    expect(getDemoSession()?.role).toBe("superadmin");
  });

  it("lowercases only ASCII letters, so a Turkish capital I is not folded to ı", () => {
    expect(normalizeDemoEmail("  MUSTERI@Demo.DestekTesvik.LOCAL  ")).toBe(
      "musteri@demo.destektesvik.local",
    );
    // The dotless ı is a different character and must survive untouched.
    expect(normalizeDemoEmail("mIrasçı@ornek.tr")).toBe("mirasçı@ornek.tr");
  });

  it("refuses a password that differs only by surrounding whitespace", () => {
    const superadmin = profile("superadmin");
    expect(matchDemoProfile(superadmin.email, ` ${superadmin.password} `)).toBeNull();
    expect(matchDemoProfile(superadmin.email, superadmin.password)?.id).toBe("superadmin");
  });

  it("matches every printed pair, and no pair that was not printed", () => {
    for (const entry of DEMO_PROFILES) {
      expect(matchDemoProfile(entry.email, entry.password)?.id).toBe(entry.id);
    }
    // The two profiles' halves may not be mixed into a third identity.
    const [first, second] = DEMO_PROFILES;
    expect(matchDemoProfile(first!.email, second!.password)).toBeNull();
    expect(matchDemoProfile("", "")).toBeNull();
    expect(matchDemoProfile("biri@ornek.com.tr", "cok-guclu-parola-2026")).toBeNull();
  });

  /**
   * One list, not two.
   *
   * The card renders `DEMO_PROFILES` and the form matches against it. If a
   * credential literal ever appears in the route or the template, the two have
   * been forked, and the failure that follows is the worst kind: the card
   * prints one password while the form accepts another.
   */
  it("keeps the credentials in exactly one module", () => {
    for (const file of [
      join(SRC, "routes", "auth.tsx"),
      join(SRC, "components", "templates.tsx"),
      join(SRC, "api", "queries.ts"),
    ]) {
      const source = readFileSync(file, "utf8");
      for (const entry of DEMO_PROFILES) {
        expect(source, `${file} demo e-postasını kopyalamış`).not.toContain(entry.email);
        expect(source, `${file} demo parolasını kopyalamış`).not.toContain(entry.password);
      }
    }
  });

  it("enters the demo through the shared mutation rather than a second path", () => {
    const route = readFileSync(join(SRC, "routes", "auth.tsx"), "utf8");
    expect(route).toMatch(/matchDemoProfile\(/u);
    // Still the mutation, still never the raw session setter.
    expect(route).toMatch(/startDemo\.mutate\(/u);
    expect(route).not.toMatch(/startDemoSession\(/u);
  });

  it("says, once revealed, that the printed credentials can be typed into the form", async () => {
    await renderApp("/giris");
    for (const entry of DEMO_PROFILES) {
      await selectDemoRole(entry.roleLabel);
      await userEvent.click(await screen.findByText("Demo bilgilerini göster"));
      const note = await screen.findByTestId("demo-kimlik-notu");
      expect(note.textContent).toMatch(/forma|form alanlarına|aşağıdaki forma/iu);
      expect(note.textContent).toMatch(/yazabilir|girebilir|kopyalayabilir/iu);
      // The sentence this replaces said the opposite, and it was wrong.
      expect(note.textContent).not.toMatch(/yalnızca .*göstermek için yazılıdır/iu);
    }
  });

  it("no longer claims anywhere that the demo pair would be refused by a server", () => {
    const source = readFileSync(join(SRC, "demo", "profiles.ts"), "utf8");
    for (const claim of [
      /must find them refused by the server/iu,
      /refused by the server rather than/iu,
      /sunucu(da)? (tarafından )?reddedil/iu,
    ]) {
      expect(source, `profiles.ts artık doğru olmayan bir iddia taşıyor: ${String(claim)}`).not.toMatch(
        claim,
      );
    }
  });
});

/* ----------------------------------- 10. the static, backend-free deployment */

/**
 * What `VITE_STATIC_DEMO_ONLY=true` means, and what it must not be allowed to
 * mean.
 *
 * The GitHub Pages publication is a bundle on a file server. There is no
 * FastAPI process behind it: `POST /cikis` would 404, `POST /giris` would 404,
 * and neither failure is recoverable by the visitor. So the flag changes two
 * things and only two:
 *
 *   1. demo entry stops sending the sign-out. Not because sending it is
 *      undesirable - it is the correct thing in a real deployment and stays
 *      there - but because on Pages there is provably no server session to
 *      close, and a request that cannot succeed would make demo entry fail for
 *      a reason the reviewer cannot act on.
 *   2. a real sign-in or registration is refused *before* it reaches the
 *      network, and refused out loud. The alternative is a form that collects
 *      an address and a password and drops them into a 404 - which is the
 *      single most dishonest thing this screen could do.
 *
 * The flag is read at call time rather than captured at module load, so these
 * two deployments can be exercised in one process; a module-level constant
 * would make the second describe block silently test the first one's build.
 */
describe("the static Pages build has no backend and says so", () => {
  function buildStaticDemoOnly(): void {
    vi.stubEnv("VITE_STATIC_DEMO_ONLY", "true");
  }

  it("is off unless the build explicitly turned it on", () => {
    expect(isStaticDemoOnly()).toBe(false);
    buildStaticDemoOnly();
    expect(isStaticDemoOnly()).toBe(true);
  });

  it("treats any value other than true as off, so a typo cannot disable the backend", () => {
    for (const value of ["false", "1", "yes", "TRUE", ""]) {
      vi.stubEnv("VITE_STATIC_DEMO_ONLY", value);
      expect(isStaticDemoOnly(), `"${value}" statik yayın sayıldı`).toBe(false);
    }
  });

  it("opens the demo from the card with no request at all", async () => {
    buildStaticDemoOnly();
    const requests = recordRequests();
    await renderApp("/giris");
    await userEvent.click(
      await screen.findByRole("button", { name: profile("superadmin").actionLabel }),
    );

    expect(await screen.findByRole("heading", { level: 1, name: "Kokpit" })).toBeInTheDocument();
    await expectDemoIdentity(demoBadgeLabel("superadmin"));
    expect(requests.seen).toEqual([]);
  });

  it("opens the demo from the typed form with no request at all", async () => {
    buildStaticDemoOnly();
    const requests = recordRequests();
    await renderApp("/giris");
    const customer = profile("customer");
    await signInWith(customer.email, customer.password);

    expect(await screen.findByRole("heading", { level: 1, name: "Kokpit" })).toBeInTheDocument();
    await expectDemoIdentity(demoBadgeLabel("customer"));
    expect(requests.seen).toEqual([]);
  });

  it("refuses a real sign-in without sending it, and explains the deployment", async () => {
    buildStaticDemoOnly();
    const requests = recordRequests();
    await renderApp("/giris");
    await signInWith("biri@ornek.com.tr", "cok-guclu-parola-2026");

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/statik|sunucu yok|backend/iu);
    expect(alert.textContent).toMatch(/demo/iu);
    expect(requests.seen).toEqual([]);
    expect(getDemoSession()).toBeNull();
    // And the visitor is still on the login screen rather than a broken one.
    expect(screen.getByRole("heading", { level: 1, name: "Giriş" })).toBeInTheDocument();
  });

  it("refuses registration the same way, rather than posting into a 404", async () => {
    buildStaticDemoOnly();
    const requests = recordRequests();
    await renderApp("/kayit");

    await userEvent.type(await screen.findByLabelText(/E-posta/u), "biri@ornek.com.tr");
    await userEvent.type(screen.getByLabelText(/Parola/u), "cok-guclu-parola-2026");
    await userEvent.click(screen.getByRole("button", { name: "Hesap oluştur" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/statik|sunucu yok|backend/iu);
    expect(requests.seen).toEqual([]);
  });

  it("tells the visitor on the login screen that only the demo works here", async () => {
    buildStaticDemoOnly();
    await renderApp("/giris");

    const notice = await screen.findByTestId("statik-yayin-uyarisi");
    expect(notice.textContent).toMatch(/statik/iu);
    expect(notice.textContent).toMatch(/demo/iu);
    expect(notice.textContent).toMatch(/giriş|kayıt/iu);
  });

  it("shows that notice on the registration screen too", async () => {
    buildStaticDemoOnly();
    await renderApp("/kayit");
    expect(await screen.findByTestId("statik-yayin-uyarisi")).toBeInTheDocument();
  });

  it("shows no such notice in the normal deployment", async () => {
    await renderApp("/giris");
    await screen.findByRole("heading", { level: 1, name: "Giriş" });
    expect(screen.queryByTestId("statik-yayin-uyarisi")).not.toBeInTheDocument();
  });

  /**
   * The normal deployment is not weakened by any of the above.
   *
   * Re-asserted here rather than left to the earlier group, because the risk
   * this flag introduces is precisely that its branch leaks into the default
   * build - and the failure would be silent: a demo that no longer signs the
   * browser out, in a deployment where a live tenant session exists.
   */
  it("still sends the real logout when the flag is absent", async () => {
    const requests = recordRequests();
    await renderApp("/giris");
    const customer = profile("customer");
    await signInWith(customer.email, customer.password);
    await screen.findByRole("heading", { level: 1, name: "Kokpit" });

    expect(requests.seen.filter((entry) => entry.startsWith("POST"))).toEqual(["POST /cikis"]);
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
