/**
 * The HTTP boundary.
 *
 * Three things are load-bearing here and none of them are style choices:
 *
 * 1. `credentials: "include"` on every call. Authentication is an httpOnly
 *    cookie set by the backend; the client never sees, stores or manages a
 *    token. There is deliberately no localStorage anywhere in this file.
 * 2. Same-origin paths only. The backend has no CORS middleware, so a
 *    cross-origin call cannot work - the dev proxy and the production reverse
 *    proxy are what make these paths resolve.
 * 3. Every response is parsed through its Zod schema before it reaches the UI.
 */

import type { ZodType } from "zod";

import {
  approvalSchema,
  csrfTokenSchema,
  decisionListSchema,
  decisionSchema,
  programListSchema,
  readinessHealthSchema,
  snapshotListSchema,
  type Decision,
  type Program,
  type ReadinessHealth,
  type Snapshot,
} from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class ContractError extends Error {
  constructor(
    message: string,
    readonly path: string,
  ) {
    super(message);
    this.name = "ContractError";
  }
}

export class OfflineError extends Error {
  constructor(readonly path: string) {
    super("Ağ bağlantısı kurulamadı.");
    this.name = "OfflineError";
  }
}

/**
 * The write did not happen because the session was gone.
 *
 * The backend answers an unauthenticated form POST with `303 -> /giris`.
 * `fetch` follows redirects, so the login page arrives as an ordinary
 * `200 text/html` and `response.ok` is `true`. Without this distinction the
 * interface reports a save that never occurred - the exact failure this
 * product exists to refuse.
 */
export class SessionExpiredError extends Error {
  constructor(readonly path: string) {
    super("Oturum sona erdiği için istek gerçekleşmedi.");
    this.name = "SessionExpiredError";
  }
}

/** Turkish, user-facing, and never inventing a request id we do not have. */
export function describeError(error: unknown): string {
  if (error instanceof OfflineError) {
    return "Sunucuya ulaşılamıyor. Bağlantınızı kontrol edip tekrar deneyin.";
  }
  if (error instanceof SessionExpiredError) {
    return "Oturumunuz sona ermiş; bu işlem kaydedilmedi. Tekrar giriş yapıp yeniden deneyin.";
  }
  if (error instanceof ApiError) {
    // Endpoint-aware first: the same status means different things to a user
    // on the login screen, on the registration screen, and inside the app.
    if (error.path === AUTH_PATHS.login && error.status === 401) {
      // One message for both halves, deliberately: an attacker must not learn
      // which of the two was wrong.
      return "E-posta veya parola hatalı.";
    }
    if (error.path === AUTH_PATHS.register && error.status === 400) {
      // Says what to fix without confirming whether the address is registered.
      return (
        "Kayıt tamamlanamadı. Parolanız en az 12 karakter olmalı ve e-posta adresiniz " +
        "geçerli ve kullanılabilir olmalıdır. Bilgileri kontrol edip tekrar deneyin."
      );
    }
    if (error.status === 401) return "Oturumunuz doğrulanmadı. Lütfen tekrar giriş yapın.";
    if (error.status === 403) return "Bu işlem için yetkiniz yok.";
    if (error.status === 404) return "Kayıt bulunamadı.";
    if (error.status === 409) return "İşlem şu anki durumla çakışıyor.";
    if (error.status >= 500) return "Sunucu tarafında bir hata oluştu.";
    return error.message;
  }
  if (error instanceof ContractError) {
    return "Sunucu yanıtı beklenen sözleşmeye uymuyor. Bu bir uygulama hatasıdır.";
  }
  return "Beklenmeyen bir hata oluştu.";
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      credentials: "include",
      headers: { Accept: "application/json", ...(init.headers ?? {}) },
    });
  } catch {
    throw new OfflineError(path);
  }
  // Checked before `ok`, because this failure arrives wearing a 200.
  if (landedOnLoginPage(response, path)) {
    throw new SessionExpiredError(path);
  }
  if (!response.ok) {
    throw new ApiError(`İstek başarısız (${response.status})`, response.status, path);
  }
  return response;
}

/**
 * Did the request end up on the login page after following a redirect?
 *
 * Uses only what the browser already reports - `redirected` and the final
 * `url`. No HTML is parsed, and a redirect on its own is not an error: a
 * successful login is also a 303, and it lands on `/profil`.
 */
/**
 * The form writes that cannot happen without a session.
 *
 * Only these are answered with `303 -> /giris?hata=oturum` when the session has
 * gone. Registration, login and logout also touch `/giris`, but for them
 * arriving there is the *successful* outcome, not a failure - `pages.py:109`
 * answers a good `POST /kayit` with `303 -> /giris?kayit=tamam`.
 *
 * Keeping this list explicit is the point. The previous version inferred intent
 * from the destination alone and got it backwards in both directions: first it
 * called a failed write a success, then it called a successful registration a
 * failure. The destination alone never carried enough information.
 */
const SESSION_REQUIRED_FORM_WRITES: readonly RegExp[] = [
  /^\/profil$/u,
  /^\/degerlendirmeler\/[^/]+\/onay$/u,
];

/** Does this path require an established session to succeed? */
export function isSessionRequiredFormWrite(path: string): boolean {
  return SESSION_REQUIRED_FORM_WRITES.some((pattern) => pattern.test(path));
}

/**
 * Pure predicate: did a session-required write get bounced to the login page?
 *
 * Both arguments are already-known strings - the request path and the final URL
 * the browser reports. No HTML is read and no response body is inspected.
 */
export function isSessionExpiredRedirect(path: string, finalUrl: string): boolean {
  if (!isSessionRequiredFormWrite(path)) return false;
  try {
    const destination = new URL(finalUrl, globalThis.location?.origin ?? "http://localhost");
    return destination.pathname === AUTH_PATHS.login;
  } catch {
    return false;
  }
}

function landedOnLoginPage(response: Response, path: string): boolean {
  if (!response.redirected) return false;
  return isSessionExpiredRedirect(path, response.url);
}

async function getJson<T>(path: string, schema: ZodType<T>): Promise<T> {
  const response = await request(path);
  const payload: unknown = await response.json();
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ContractError(parsed.error.message, path);
  }
  return parsed.data;
}

// ---------------------------------------------------------------- read paths

export function fetchPrograms(): Promise<Program[]> {
  return getJson("/api/programlar", programListSchema);
}

export function fetchSnapshots(): Promise<Snapshot[]> {
  return getJson("/api/kaynaklar", snapshotListSchema);
}

export function fetchDecisions(): Promise<Decision[]> {
  return getJson("/api/degerlendirmeler", decisionListSchema);
}

export function fetchDecision(id: string): Promise<Decision> {
  return getJson(`/api/degerlendirmeler/${encodeURIComponent(id)}`, decisionSchema);
}

export function fetchReadiness(): Promise<ReadinessHealth> {
  return getJson("/hazir", readinessHealthSchema);
}

// ---------------------------------------------------------------- CSRF

/**
 * One token serves both surfaces. `GET /api/csrf` and the SSR `_render` helper
 * call the *same* `sign_csrf`, so a token taken here is valid in an SSR form
 * field and in the `X-CSRF-Token` header. That is code equality, not an
 * assumption - and it is what lets this SPA drive the form endpoints.
 */
export async function fetchCsrfToken(): Promise<string> {
  const token = await getJson("/api/csrf", csrfTokenSchema);
  return token.csrf_token;
}

export const CSRF_HEADER = "X-CSRF-Token";
export const CSRF_FIELD = "csrf_token";

// --------------------------------------------------------------- write paths

/**
 * Drive one of the backend's `application/x-www-form-urlencoded` endpoints.
 *
 * These return `303 See Other` and a redirect to an HTML page. We follow it
 * (the browser will anyway), ignore the body entirely, and never parse HTML -
 * scraping the SSR response would couple this client to markup that is free to
 * change. Success is `response.ok`; the caller then invalidates its queries.
 */
async function submitForm(path: string, fields: Record<string, string>): Promise<Response> {
  const token = await fetchCsrfToken();
  const body = new URLSearchParams({ ...fields, [CSRF_FIELD]: token });

  return request(path, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
}

export async function postForm(
  path: string,
  fields: Record<string, string>,
): Promise<{ ok: true; finalUrl: string }> {
  const response = await submitForm(path, fields);
  return { ok: true, finalUrl: response.url };
}

/**
 * Where a recorded approval's timestamp came from.
 *
 * `server` is `ApprovalOut.approved_at` - the canonical audit value. `client`
 * is the moment this browser sent the write, used only when the server answers
 * with the SSR redirect and no audit body at all. The distinction is carried
 * all the way to the screen rather than being flattened here: an audit line
 * that does not say whose clock it is showing is an audit line that claims more
 * than it knows.
 */
export interface ApprovalRecord {
  readonly approvedAt: string;
  readonly source: "server" | "client";
  readonly note: string;
}

/**
 * Record a user approval and keep the server's own audit timestamp.
 *
 * The write itself is unchanged - the same form POST, the same CSRF token, the
 * same session-expiry detection. What is new is that the response is *read*
 * when it is JSON: `ApprovalOut` is the contract, and when the backend sends it
 * the interface shows the server's minute rather than the browser's.
 *
 * HTML is still never parsed. A `303` to an SSR page carries no audit record,
 * and a body that is not JSON is simply not one.
 */
export async function postApproval(
  decisionId: string,
  note: string,
): Promise<ApprovalRecord> {
  const path = AUTH_PATHS.approve(decisionId);
  // Taken before the request, so the fallback is "when this browser sent it"
  // rather than "when the answer happened to arrive".
  const sentAt = new Date().toISOString();
  const response = await submitForm(path, { not: note });

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const payload: unknown = await response.json().catch(() => null);
    const parsed = approvalSchema.safeParse(payload);
    if (!parsed.success) {
      throw new ContractError(parsed.error.message, path);
    }
    return { approvedAt: parsed.data.approved_at, source: "server", note: parsed.data.note };
  }

  return { approvedAt: sentAt, source: "client", note };
}

/** The one JSON write the backend exposes. Needs the signed header token. */
export async function postEvaluation(): Promise<Decision[]> {
  const token = await fetchCsrfToken();
  const response = await request("/api/degerlendir", {
    method: "POST",
    headers: { [CSRF_HEADER]: token },
  });
  const payload: unknown = await response.json();
  const parsed = decisionListSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ContractError(parsed.error.message, "/api/degerlendir");
  }
  return parsed.data;
}

export const AUTH_PATHS = {
  register: "/kayit",
  login: "/giris",
  logout: "/cikis",
  profile: "/profil",
  approve: (decisionId: string) =>
    `/degerlendirmeler/${encodeURIComponent(decisionId)}/onay`,
} as const;
