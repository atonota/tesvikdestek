/**
 * A write that did not happen must never be reported as if it had.
 *
 * When the session has expired, `_require_user` in the backend answers a form
 * POST with `303 → /giris?hata=oturum`. `fetch` follows redirects by default,
 * so the login page comes back as a perfectly ordinary `200 text/html` and
 * `response.ok` is `true`. Nothing was written, and without these tests the
 * interface says "kaydedildi".
 *
 * The detection signal is the *final URL*, which the browser already gives us.
 * No HTML is parsed, and not every redirect is an error: a successful login is
 * also a 303, and it must stay a success.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  ApiError,
  SessionExpiredError,
  AUTH_PATHS,
  describeError,
  isSessionExpiredRedirect,
  postEvaluation,
  postForm,
} from "@/api/client";
import { queryKeys, useRecordApproval, useRunEvaluation, useSaveProfile } from "@/api/queries";
import { server } from "@/mocks/server";
import { renderAppAt } from "./render-app";

/** jsdom serves from a port, so redirect targets must share that exact origin. */
function absolute(path: string): string {
  return new URL(path, window.location.origin).toString();
}

/**
 * The backend's own answer to an unauthenticated form POST: a real 303 to the
 * login page. `fetch` follows it, so the client sees `200 text/html` with
 * `redirected === true` and `url` pointing at `/giris` - exactly what a browser
 * would see, with no test-only header to cheat against.
 */
function respondWithLoginRedirect(path: string) {
  server.use(
    http.post(path, () => HttpResponse.redirect(absolute("/giris?hata=oturum"), 303)),
  );
}

describe("P0 - an expired session must not look like a successful write", () => {
  it.each([
    ["profil", "/profil"],
    ["onay", "/degerlendirmeler/decision-1501/onay"],
  ])("postForm to %s throws when it lands on the login page", async (_label, path) => {
    respondWithLoginRedirect(path);
    await expect(postForm(path, { display_name: "X" })).rejects.toBeInstanceOf(
      SessionExpiredError,
    );
  });

  it("a session-expired write never reports ok", async () => {
    respondWithLoginRedirect("/profil");
    const result = await postForm("/profil", {}).catch((error: unknown) => error);
    expect(result).not.toMatchObject({ ok: true });
  });

  it("the JSON evaluation endpoint refuses an anonymous caller with 401, not a redirect", async () => {
    // `routers/api.py::_require_user` raises HTTPException(401); the JSON API
    // never redirects to the login page. Asserting a redirect here would be
    // testing a contract the backend does not have, so the endpoint is
    // deliberately outside the session-expiry redirect rule.
    server.use(http.post("/api/degerlendir", () => new HttpResponse(null, { status: 401 })));
    const error = await postEvaluation().catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(401);
    expect(describeError(error)).toMatch(/tekrar giriş/i);
  });

  it("gives the user session-expired guidance, not a success message", () => {
    expect(describeError(new SessionExpiredError("/profil"))).toMatch(/oturum/i);
    expect(describeError(new SessionExpiredError("/profil"))).toMatch(
      /kaydedilmedi|yazılmadı|tekrar giriş/i,
    );
  });

  it("a successful login is a redirect too, and stays a success", async () => {
    server.use(
      http.post("/giris", () => HttpResponse.redirect(absolute("/profil"), 303)),
      http.get("/profil", () => HttpResponse.text("<!doctype html><title>Profil</title>")),
    );
    await expect(postForm("/giris", { eposta: "a@b.tr", parola: "x" })).resolves.toMatchObject({
      ok: true,
    });
  });

  it("a successful logout redirect to the landing page stays a success", async () => {
    server.use(
      http.post("/cikis", () => HttpResponse.redirect(absolute("/"), 303)),
      http.get("/", () => HttpResponse.text("<!doctype html><title>Ana</title>")),
    );
    await expect(postForm("/cikis", {})).resolves.toMatchObject({ ok: true });
  });
});

describe("P0 - a failed write must not reach onSuccess or invalidate anything", () => {
  /**
   * Asserted at the mutation layer rather than through a rendered error region:
   * "did not succeed" and "did not invalidate" are properties of the mutation,
   * and this remediation is not authorised to change route or template files.
   * Surfacing the message in the profile and approval screens is recorded as a
   * follow-up in the implementation report.
   */
  function harness() {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    return { client, invalidate, wrapper };
  }

  it("saving a profile with an expired session fails and invalidates nothing", async () => {
    respondWithLoginRedirect("/profil");
    const { invalidate, wrapper } = harness();
    const { result } = renderHook(() => useSaveProfile(), { wrapper });

    result.current.mutate({ display_name: "Ornek A.S." });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(SessionExpiredError);
    expect(result.current.isSuccess).toBe(false);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("recording an approval with an expired session fails and invalidates nothing", async () => {
    respondWithLoginRedirect("/degerlendirmeler/decision-1501/onay");
    const { invalidate, wrapper } = harness();
    const { result } = renderHook(() => useRecordApproval("decision-1501"), { wrapper });

    result.current.mutate("Iç değerlendirmede uygun bulundu.");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(SessionExpiredError);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("running an evaluation with an expired session fails and invalidates nothing", async () => {
    server.use(
      http.post("/api/degerlendir", () =>
        HttpResponse.redirect(absolute("/giris?hata=oturum"), 303),
      ),
    );
    const { invalidate, wrapper } = harness();
    const { result } = renderHook(() => useRunEvaluation(), { wrapper });

    result.current.mutate();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("a genuine save still succeeds and does invalidate the decisions", async () => {
    // The negative tests above are only meaningful if the positive path works.
    const { invalidate, wrapper } = harness();
    const { result } = renderHook(() => useSaveProfile(), { wrapper });

    result.current.mutate({ display_name: "Ornek A.S." });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.decisions });
  });
});

describe("P1 - authentication errors say what actually went wrong", () => {
  it("a wrong password on /giris reads as a credentials error, not a session error", async () => {
    server.use(http.post("/giris", () => new HttpResponse(null, { status: 401 })));
    await renderAppAt("/giris");

    await userEvent.type(await screen.findByLabelText(/E-posta/), "biri@ornek.com.tr");
    await userEvent.type(screen.getByLabelText(/Parola/), "yanlis-parola-123456");
    await userEvent.click(screen.getByRole("button", { name: "Giriş yap" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("E-posta veya parola hatalı.");
    expect(alert).not.toHaveTextContent(/tekrar giriş yapın/i);
  });

  it("a rejected registration reads as a validation message, not a raw status", async () => {
    server.use(http.post("/kayit", () => new HttpResponse(null, { status: 400 })));
    await renderAppAt("/kayit");

    await userEvent.type(await screen.findByLabelText(/E-posta/), "biri@ornek.com.tr");
    await userEvent.type(screen.getByLabelText(/Parola/), "kisa");
    await userEvent.click(screen.getByRole("button", { name: "Hesap oluştur" }));

    const alert = await screen.findByRole("alert");
    expect(alert).not.toHaveTextContent(/İstek başarısız/);
    expect(alert).toHaveTextContent(/kayıt tamamlanamadı/i);
  });

  it("the registration message does not confirm whether an account exists", async () => {
    const message = describeError(new ApiError("x", 400, "/kayit"));
    expect(message.toLocaleLowerCase("tr")).not.toMatch(/zaten kayıtlı|kullanılıyor|mevcut/);
  });

  it("a 401 on an authenticated read still means the session expired", () => {
    expect(describeError(new ApiError("x", 401, "/api/degerlendirmeler"))).toMatch(
      /tekrar giriş/i,
    );
  });

  it("a 400 outside registration is not dressed up as a registration problem", () => {
    expect(describeError(new ApiError("x", 400, "/api/degerlendir"))).not.toMatch(
      /kayıt tamamlanamadı/i,
    );
  });
});

/**
 * The user-visible half of P0.
 *
 * The adapter already refuses to report a phantom write, and the mutation
 * already declines to invalidate anything. What was missing is the part the
 * person in front of the screen experiences: on the profile, approval and
 * wizard screens the failure was silent - the form simply sat there.
 *
 * These are rendered flow tests, not prop injection. Each drives the real
 * route, lets MSW answer the way the backend answers an expired session, and
 * asserts on what a screen reader would announce.
 */
describe("P0 user-visible - an expired session is announced on every write screen", () => {
  it("A. the profile screen announces the failure and claims no success", async () => {
    respondWithLoginRedirect("/profil");
    await renderAppAt("/organizasyon/profil");

    await userEvent.click(await screen.findByRole("button", { name: "Profili kaydet" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/oturumunuz sona ermiş/i);
    expect(alert).toHaveTextContent(/kaydedilmedi/i);
    expect(screen.queryByText(/kaydedildi/i)).not.toBeInTheDocument();
  });

  it("A2. the profile screen shows nothing alarming before a submission", async () => {
    await renderAppAt("/organizasyon/profil");
    await screen.findByRole("button", { name: "Profili kaydet" });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("B. the approval screen announces the failure and records no approval", async () => {
    respondWithLoginRedirect("/degerlendirmeler/decision-1501/onay");
    await renderAppAt("/degerlendirmeler/decision-1501");
    await screen.findByRole("heading", { level: 1 });

    await userEvent.click(screen.getByRole("tab", { name: "Kullanıcı onayı" }));
    await userEvent.type(await screen.findByLabelText(/kullanıcı onayı notu/i), "uygun");
    await userEvent.click(screen.getByRole("button", { name: /olarak kaydet/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/oturumunuz sona ermiş/i);
    // The "recorded" card must not appear: nothing was recorded.
    expect(screen.queryByText(/bu oturumdaki kullanıcı/i)).not.toBeInTheDocument();
  });

  it("C. the wizard announces the failure and does not advance to evaluation", async () => {
    respondWithLoginRedirect("/profil");
    let evaluationAttempted = false;
    server.use(
      http.post("/api/degerlendir", () => {
        evaluationAttempted = true;
        return HttpResponse.json([], { status: 201 });
      }),
    );

    await renderAppAt("/uygunluk/sihirbaz");
    await screen.findByRole("heading", { level: 1, name: "Uygunluk sihirbazı" });
    for (let step = 0; step < 3; step += 1) {
      await userEvent.click(screen.getByRole("button", { name: "İleri" }));
    }
    await userEvent.click(await screen.findByRole("button", { name: "Kaydet ve değerlendir" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/oturumunuz sona ermiş/i);
    expect(evaluationAttempted, "profil kaydı başarısızken değerlendirme çalıştırıldı").toBe(
      false,
    );
    // Still on the wizard; no navigation happened.
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Uygunluk sihirbazı");
  });

  it("D1. a genuine profile save still succeeds and shows no error", async () => {
    await renderAppAt("/organizasyon/profil");
    await userEvent.click(await screen.findByRole("button", { name: "Profili kaydet" }));
    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  it("D2. a genuine approval still records the note through the success path", async () => {
    await renderAppAt("/degerlendirmeler/decision-1501");
    await screen.findByRole("heading", { level: 1 });

    await userEvent.click(screen.getByRole("tab", { name: "Kullanıcı onayı" }));
    await userEvent.type(await screen.findByLabelText(/kullanıcı onayı notu/i), "uygun");
    await userEvent.click(screen.getByRole("button", { name: /olarak kaydet/i }));

    expect(await screen.findByText(/bu oturumdaki kullanıcı/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("D3. a genuine wizard finish reaches the decision list", async () => {
    await renderAppAt("/uygunluk/sihirbaz");
    await screen.findByRole("heading", { level: 1, name: "Uygunluk sihirbazı" });
    for (let step = 0; step < 3; step += 1) {
      await userEvent.click(screen.getByRole("button", { name: "İleri" }));
    }
    await userEvent.click(await screen.findByRole("button", { name: "Kaydet ve değerlendir" }));

    // Asserted as "the wizard is gone" rather than "one heading now reads X":
    // the decision workspace legitimately renders more than one h1 today, which
    // is recorded as a separate finding rather than silently changed here.
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Uygunluk sihirbazı" })).not.toBeInTheDocument();
    });
  });
});

/**
 * The redirect contract, in both directions.
 *
 * Fixing the silent-false-success bug introduced its mirror image: the detector
 * treated *any* request landing on `/giris` as an expired session, but a
 * successful registration legitimately ends there - `pages.py:109` answers
 * `POST /kayit` with `303 -> /giris?kayit=tamam`. The account was created and
 * the interface reported that it was not.
 *
 * Both failures share one root cause: guessing intent from the destination
 * alone. The destination only means "your session is gone" for the writes that
 * *require* a session. Registration, login and logout are not among them.
 */
describe("successful form redirects are not expiry", () => {
  /** Exactly the targets `pages.py` returns today. */
  const SUCCESS_REDIRECTS = [
    ["/kayit", "/giris?kayit=tamam"],
    ["/giris", "/profil"],
    ["/cikis", "/"],
    ["/profil", "/profil?kayit=tamam"],
    ["/degerlendirmeler/decision-1501/onay", "/degerlendirmeler/decision-1501?onay=tamam"],
  ] as const;

  it.each(SUCCESS_REDIRECTS)("POST %s -> %s stays a success", async (path, target) => {
    const result = await postForm(path, {});
    expect(result.ok).toBe(true);
    expect(new URL(result.finalUrl).pathname + new URL(result.finalUrl).search).toBe(target);
  });

  it("registration succeeding on the login page is never an expired session", async () => {
    await expect(postForm(AUTH_PATHS.register, { eposta: "a@b.tr" })).resolves.toMatchObject({
      ok: true,
    });
  });

  it("the registration route lands the user on the login page without an alert", async () => {
    await renderAppAt("/kayit");
    await userEvent.type(await screen.findByLabelText(/E-posta/), "yeni@ornek.com.tr");
    await userEvent.type(screen.getByLabelText(/Parola/), "cok-guclu-parola-2026");
    await userEvent.click(screen.getByRole("button", { name: "Hesap oluştur" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Giriş" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("the expiry predicate is explicit about which writes need a session", () => {
  const LOGIN = "http://localhost/giris?hata=oturum";

  it("treats the two protected form writes as session-required", () => {
    expect(isSessionExpiredRedirect(AUTH_PATHS.profile, LOGIN)).toBe(true);
    expect(isSessionExpiredRedirect(AUTH_PATHS.approve("decision-1501"), LOGIN)).toBe(true);
  });

  it("treats the public auth endpoints as not session-required", () => {
    expect(isSessionExpiredRedirect(AUTH_PATHS.register, LOGIN)).toBe(false);
    expect(isSessionExpiredRedirect(AUTH_PATHS.login, LOGIN)).toBe(false);
    expect(isSessionExpiredRedirect(AUTH_PATHS.logout, LOGIN)).toBe(false);
  });

  it("is false whenever the destination is not the login page", () => {
    expect(isSessionExpiredRedirect(AUTH_PATHS.profile, "http://localhost/profil?kayit=tamam")).toBe(
      false,
    );
    expect(
      isSessionExpiredRedirect(
        AUTH_PATHS.approve("d1"),
        "http://localhost/degerlendirmeler/d1?onay=tamam",
      ),
    ).toBe(false);
  });

  it("matches any decision id in the approval path, not a hard-coded one", () => {
    for (const id of ["decision-1501", "abc123", "a-b_c"]) {
      expect(isSessionExpiredRedirect(AUTH_PATHS.approve(id), LOGIN)).toBe(true);
    }
  });

  it("does not treat an unrelated path as protected", () => {
    expect(isSessionExpiredRedirect("/api/programlar", LOGIN)).toBe(false);
    expect(isSessionExpiredRedirect("/degerlendirmeler", LOGIN)).toBe(false);
  });
});
