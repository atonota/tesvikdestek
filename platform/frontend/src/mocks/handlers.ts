import { http, HttpResponse } from "msw";

import {
  decisionFixtures,
  programFixtures,
  readinessFixture,
  snapshotFixtures,
} from "./fixtures";

/**
 * Redirect targets must be absolute and share the test document's origin, or
 * the interceptor cannot resolve them and the redirect is never followed.
 */
function ssr(path: string): string {
  const origin =
    typeof globalThis.location === "undefined" ? "http://localhost" : globalThis.location.origin;
  return new URL(path, origin).toString();
}

/** Mirrors the six real JSON endpoints and the five form endpoints. */
export const handlers = [
  http.get("/api/programlar", () => HttpResponse.json(programFixtures)),
  http.get("/api/kaynaklar", () => HttpResponse.json(snapshotFixtures)),
  http.get("/api/degerlendirmeler", () => HttpResponse.json(decisionFixtures)),
  http.get("/api/degerlendirmeler/:id", ({ params }) => {
    const found = decisionFixtures.find((decision) => decision.id === params["id"]);
    if (!found) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json(found);
  }),
  http.get("/hazir", () => HttpResponse.json(readinessFixture)),
  http.get("/api/csrf", () => HttpResponse.json({ csrf_token: "test-signed-token" })),

  // --- SSR page destinations -------------------------------------------
  // Every form endpoint answers `303` and `fetch` follows it, so these are the
  // documents the client actually ends up holding. They exist as handlers
  // because without the destination the redirect cannot be exercised at all.
  http.get("/giris", () => HttpResponse.text("<!doctype html><title>Giris</title>")),
  http.get("/profil", () => HttpResponse.text("<!doctype html><title>Profil</title>")),
  http.get("/", () => HttpResponse.text("<!doctype html><title>Ana sayfa</title>")),
  http.get("/degerlendirmeler/:id", () =>
    HttpResponse.text("<!doctype html><title>Karar</title>"),
  ),

  // --- write endpoints, with the redirect targets pages.py really returns ---
  // Previously these answered a flat `200`, which meant the whole redirect
  // contract - the thing the client has to reason about - was never exercised.
  http.post("/api/degerlendir", () => HttpResponse.json(decisionFixtures, { status: 201 })),
  http.post("/kayit", () => HttpResponse.redirect(ssr("/giris?kayit=tamam"), 303)),
  http.post("/giris", () => HttpResponse.redirect(ssr("/profil"), 303)),
  http.post("/cikis", () => HttpResponse.redirect(ssr("/"), 303)),
  http.post("/profil", () => HttpResponse.redirect(ssr("/profil?kayit=tamam"), 303)),
  http.post("/degerlendirmeler/:id/onay", ({ params }) =>
    HttpResponse.redirect(ssr(`/degerlendirmeler/${String(params["id"])}?onay=tamam`), 303),
  ),
];
