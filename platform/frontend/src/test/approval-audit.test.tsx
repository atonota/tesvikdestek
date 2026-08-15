/**
 * An audit record's time is a fact about the write, not about the paint.
 *
 * `ApprovalForm` used to build the timestamp it displayed with
 * `new Date().toISOString()` *inside its own render*. Every re-render therefore
 * produced a different "Zaman" for the same approval: a background refetch, a
 * theme change, a parent state update - any of them silently moved the recorded
 * moment forward. An audit line that changes when nothing was audited is worse
 * than no audit line, because it looks authoritative.
 *
 * Two claims are pinned here.
 *
 *  - **The time comes from the write, once.** It is captured when the approval
 *    succeeds and never recomputed, so re-rendering and refetching leave it
 *    exactly where it was.
 *  - **The server's own timestamp wins whenever the server sends one.**
 *    `ApprovalOut.approved_at` is the canonical value. Today the only approval
 *    endpoint the backend exposes is the form POST, which answers `303` with an
 *    HTML page and no audit body at all - so the client falls back to the
 *    moment it sent the write and *says so on screen* rather than passing a
 *    browser clock off as a server record.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { ApprovalForm } from "@/components";
import { approvalSchema } from "@/api/types";
import { decisionFixtures } from "@/mocks/fixtures";
import { server } from "@/mocks/server";
import { renderAppAt } from "./render-app";

const APPROVAL_PATH = "/degerlendirmeler/decision-1501/onay";

/** The audit line the card renders, as text. */
function recordedTimeText(): string {
  const term = screen.getByText("Zaman", { selector: "dt" });
  const value = term.nextElementSibling;
  expect(value, "the audit row has a term with no value").not.toBeNull();
  return (value?.textContent ?? "").trim();
}

/** A canonical `ApprovalOut`, exactly as `delivery/schemas.py` declares it. */
const SERVER_APPROVAL = {
  id: "approval-1",
  decision_id: "decision-1501",
  actor_user_id: "user-1",
  approved_at: "2026-08-01T07:30:00+00:00",
  note: "uygun",
  label: "Kullanici onayi",
};

describe("the approval contract is parsed, not assumed", () => {
  it("accepts the shape the backend declares and rejects a foreign one", () => {
    expect(approvalSchema.safeParse(SERVER_APPROVAL).success).toBe(true);
    expect(approvalSchema.safeParse({ ...SERVER_APPROVAL, approved_at: 3 }).success).toBe(false);
    // `extra="forbid"` on the Python side; strict here for the same reason.
    expect(approvalSchema.safeParse({ ...SERVER_APPROVAL, surprise: 1 }).success).toBe(false);
  });
});

describe("the recorded approval time never comes from the render clock", () => {
  it("stays put across a re-render of the same recorded approval", () => {
    const view = render(
      <MemoryRouter>
        <ApprovalForm onSubmit={() => {}} recordedNote="uygun" recordedAt={SERVER_APPROVAL.approved_at} />
      </MemoryRouter>,
    );
    const first = recordedTimeText();
    expect(first.length).toBeGreaterThan(0);

    view.rerender(
      <MemoryRouter>
        <ApprovalForm onSubmit={() => {}} recordedNote="uygun" recordedAt={SERVER_APPROVAL.approved_at} />
      </MemoryRouter>,
    );
    expect(recordedTimeText()).toBe(first);
  });

  it("renders nothing recorded when no approval was made in this session", () => {
    render(
      <MemoryRouter>
        <ApprovalForm onSubmit={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.queryByText("Zaman", { selector: "dt" })).toBeNull();
    expect(screen.getByText(/bu oturumda kayıt yapılmadı/iu)).toBeInTheDocument();
  });
});

describe("the decision screen records the approval time from the write", () => {
  it("uses the server's own approved_at when the server returns one", async () => {
    server.use(
      http.post(APPROVAL_PATH, () => HttpResponse.json(SERVER_APPROVAL, { status: 201 })),
    );

    await renderAppAt("/degerlendirmeler/decision-1501");
    await screen.findByRole("heading", { level: 1 });
    await userEvent.click(screen.getByRole("tab", { name: "Kullanıcı onayı" }));
    await userEvent.type(await screen.findByLabelText(/kullanıcı onayı notu/iu), "uygun");
    await userEvent.click(screen.getByRole("button", { name: /olarak kaydet/iu }));

    await screen.findByText(/bu oturumdaki kullanıcı/iu);
    // 1 August 2026, 07:30 UTC - the server's minute, not this browser's.
    expect(recordedTimeText()).toMatch(/2026/u);
    expect(recordedTimeText()).toMatch(/1 Ağustos|01\.08\.2026/u);
    expect(screen.queryByText(/tarayıcıdan kaydedildi/iu)).toBeNull();
  });

  it("says plainly when the time is this browser's, because the server sent none", async () => {
    // The real endpoint: 303 to an HTML page, no audit body. The card must not
    // dress the fallback up as a server audit timestamp.
    await renderAppAt("/degerlendirmeler/decision-1501");
    await screen.findByRole("heading", { level: 1 });
    await userEvent.click(screen.getByRole("tab", { name: "Kullanıcı onayı" }));
    await userEvent.type(await screen.findByLabelText(/kullanıcı onayı notu/iu), "uygun");
    await userEvent.click(screen.getByRole("button", { name: /olarak kaydet/iu }));

    await screen.findByText(/bu oturumdaki kullanıcı/iu);
    expect(screen.getByText(/tarayıcıdan kaydedildi/iu)).toBeInTheDocument();
  });

  /**
   * The refetch has to be *proved*, not assumed.
   *
   * This assertion used to be `await waitFor(() => expect(recordedTimeText())
   * .toBe(recorded))`, which is true the instant it is entered - `recorded` was
   * read from the same DOM one line earlier. `waitFor` returns on the first
   * successful call, so it resolved immediately, before `invalidateQueries`
   * had scheduled anything. It would have passed against a build where the
   * mutation never invalidated at all, which is precisely the regression the
   * test is named after.
   *
   * So the refetch is counted at the transport. `useRecordApproval` invalidates
   * `queryKeys.decision(id)`, whose query function is a GET of
   * `/api/degerlendirmeler/:id`; the test waits for that GET to happen a second
   * time and only then asks whether the audit line moved.
   */
  it("does not move the recorded time when the decision is refetched", async () => {
    let decisionReads = 0;
    server.use(
      http.get("/api/degerlendirmeler/:id", ({ params }) => {
        const found = decisionFixtures.find((decision) => decision.id === params["id"]);
        if (!found) return HttpResponse.json({ detail: "Karar bulunamadi." }, { status: 404 });
        decisionReads += 1;
        return HttpResponse.json(found);
      }),
      http.post(APPROVAL_PATH, () => HttpResponse.json(SERVER_APPROVAL, { status: 201 })),
    );

    await renderAppAt("/degerlendirmeler/decision-1501");
    await screen.findByRole("heading", { level: 1 });
    await waitFor(() => expect(decisionReads).toBe(1));
    const readsBeforeWrite = decisionReads;

    await userEvent.click(screen.getByRole("tab", { name: "Kullanıcı onayı" }));
    await userEvent.type(await screen.findByLabelText(/kullanıcı onayı notu/iu), "uygun");
    await userEvent.click(screen.getByRole("button", { name: /olarak kaydet/iu }));

    await screen.findByText(/bu oturumdaki kullanıcı/iu);
    const recorded = recordedTimeText();
    expect(recorded.length).toBeGreaterThan(0);

    // The invalidation actually reached the network: the decision was read
    // again after the write. Without this the rest of the test is vacuous.
    await waitFor(() =>
      expect(
        decisionReads,
        "the approval never invalidated the decision, so no refetch was proved",
      ).toBeGreaterThan(readsBeforeWrite),
    );

    // And the repaint that refetch caused left the audit line where it was.
    expect(recordedTimeText()).toBe(recorded);
    await userEvent.click(screen.getByRole("tab", { name: "Gerekçe" }));
    await userEvent.click(screen.getByRole("tab", { name: "Kullanıcı onayı" }));
    expect(recordedTimeText()).toBe(recorded);
  });
});
