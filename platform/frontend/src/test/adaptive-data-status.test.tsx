/**
 * What the dashboard's assistant is allowed to say about its own data.
 *
 * Three untrue things were hard-coded into the panel.
 *
 *  - `missing: []`. The decisions on screen carry `missing_facts`, and the
 *    panel exists precisely to render them as *unanswered*. Passing an empty
 *    list meant a company with four unanswered facts saw none of them.
 *  - `partial: true`, always. It is a constant, so it says nothing about this
 *    load. Worse, the notice it triggers claimed "sunucudaki tüm kayıtları
 *    gören bir uç yok" - `/api/degerlendirmeler` returns every decision for the
 *    tenant, so the interface was inventing a backend limitation to excuse a
 *    hedge.
 *  - `lastLoadedAt` was rendered as though it were the moment the data was
 *    true. It is `dataUpdatedAt`: the moment *this browser* fetched it.
 *
 * The replacement derives all three from real query state, and says plainly
 * that the timestamp is a client fetch time.
 */

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { server } from "@/mocks/server";
import { decisionFixtures } from "@/mocks/fixtures";
import { renderAppAt } from "./render-app";

/**
 * The assistant lives behind a control at 320px, which is jsdom's width.
 *
 * `userEvent` is imported at the top like every other test file rather than
 * with `await import(...)` inside this helper. The dynamic form resolved,
 * loaded and instrumented the module during the *first* test that called it,
 * inside that test's own 5s budget - which is why the first test in this file
 * cost 324ms while its four identical siblings cost 78-102ms. Under
 * `--coverage` with all 35 files running in parallel that head start is the
 * difference between finishing and being killed at the budget. Nothing about
 * what this helper does has changed.
 */
async function openAssistant() {
  await userEvent.click(await screen.findByRole("button", { name: /Yardımcı/u }));
  return screen.findByRole("dialog", { name: /Bağlam ve yardımcı/u });
}

describe("the dashboard assistant reports the facts the decisions actually report", () => {
  it("lists every unanswered fact once, from the loaded decisions", async () => {
    const expected = [
      ...new Set(decisionFixtures.flatMap((decision) => decision.missing_facts)),
    ];
    expect(expected.length).toBeGreaterThan(0);

    await renderAppAt("/panel");
    const panel = await openAssistant();

    for (const fact of expected) {
      expect(within(panel).getAllByText(fact)).toHaveLength(1);
    }
  });

  it("renders them as unknown, never as a negative", async () => {
    await renderAppAt("/panel");
    const panel = await openAssistant();
    expect(within(panel).getAllByText(/^Bilinmiyor$/u).length).toBeGreaterThan(0);
    expect(panel.textContent ?? "").not.toMatch(/\bHayır\b/u);
  });
});

describe("the data status is honest about this load", () => {
  it("claims no partial data once every query has answered", async () => {
    await renderAppAt("/panel");
    const panel = await openAssistant();
    expect(within(panel).queryByText(/tüm kayıtları gören bir uç yok/iu)).toBeNull();
    expect(within(panel).queryByTestId("partial-data")).toBeNull();
  });

  it("says the timestamp is when this browser fetched, not when the data was true", async () => {
    await renderAppAt("/panel");
    const panel = await openAssistant();
    expect(within(panel).getByText(/bu tarayıcıya/iu)).toBeInTheDocument();
  });

  it("declares itself partial, and says why, when a query genuinely failed", async () => {
    server.use(http.get("/api/kaynaklar", () => new HttpResponse(null, { status: 500 })));
    await renderAppAt("/panel");
    const panel = await openAssistant();

    await waitFor(() => {
      expect(within(panel).getByTestId("partial-data")).toBeInTheDocument();
    });
    expect(within(panel).getByRole("alert").textContent ?? "").toMatch(/sunucu|yüklenemedi/iu);
  });
});
