/**
 * One source of truth for what a form submits.
 *
 * The form layer validated the profile and the wizard, and then both templates
 * threw the result away: `onValid={() => onSubmit()}` ignored the argument, and
 * the route kept its own `useState` copy of the answers - fed by a per-field
 * `onValueChange` notification - which is what was actually POSTed. Two stores
 * for one set of answers is not redundancy, it is a race: react-hook-form
 * decides *whether* the values are valid while a different object decides
 * *what* is sent. Any field the notification missed, any transform the form
 * applied, any value the form reset - the server got the other one.
 *
 * These tests are deliberately about data, not about markup. The contract in
 * `platform-controls-contract.test.ts` can only see that a template has no
 * `useState` in its body; it cannot see that the object leaving the template is
 * the object the form validated. That is what is asserted here, at the template
 * boundary and again at the route boundary - the second one against the bytes
 * that reach the network, which is the only place the claim finally settles.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { useState, type ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { EligibilityWizard, ProfileWorkspace } from "@/components";
import { emptyProfileValues } from "@/domain/facts";
import { server } from "@/mocks/server";
import { renderAppAt } from "./render-app";

const routed = (ui: ReactNode) => render(<MemoryRouter>{ui}</MemoryRouter>);

/** Choose an option from the custom select, which has no native options. */
async function choose(fieldName: RegExp, option: string): Promise<void> {
  await userEvent.click(screen.getByRole("combobox", { name: fieldName }));
  await screen.findByRole("listbox");
  await userEvent.click(screen.getByRole("option", { name: option }));
}

/**
 * Put a value in a text field in one dispatch instead of one per character.
 *
 * `userEvent.type` sends a keydown/keypress/input/keyup cycle per character and
 * awaits between them, so `"Beta Yazılım A.Ş."` is seventeen awaited round
 * trips through a twenty-field react-hook-form. Each `await` yields the event
 * loop, and under `--coverage` with all 35 test files running in parallel a
 * yield waits for a CPU rather than a microtask: this file measured 402ms on
 * its own and was killed at the 5000ms budget in the full run.
 *
 * `fireEvent.change` delivers exactly the `change` React dispatches for
 * `onChange`, which is the one react-hook-form registers, and leaves the field
 * holding the same final value. It is used *only* to set the form up. Every
 * submission below is still a real `userEvent.click` on the visible button, and
 * not one assertion about the validated object or the posted body is relaxed -
 * they are compared with `toEqual` against the same literals as before.
 *
 * What this deliberately does *not* do: type through the tri-state selects.
 * Those are `choose()` above, still a real click on the trigger and a real
 * click on the option, because which value a select ends up holding is part of
 * what these tests exist to prove.
 */
function fill(field: HTMLElement, value: string): void {
  fireEvent.change(field, { target: { value } });
}

/* ------------------------------------------------------------- the profile */

describe("the profile submits exactly what the form validated", () => {
  it("passes the whole validated object, not a second copy of it", async () => {
    const onSubmit = vi.fn();
    routed(<ProfileWorkspace defaultValues={emptyProfileValues()} onSubmit={onSubmit} />);

    fill(screen.getByLabelText(/Görünen ad/u), "Beta Yazılım A.Ş.");
    await choose(/Sermaye şirketi mi/u, "Evet");
    fill(screen.getByLabelText(/Çalışan sayısı/u), "42");
    await userEvent.click(screen.getByRole("button", { name: "Profili kaydet" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({
      ...emptyProfileValues(),
      display_name: "Beta Yazılım A.Ş.",
      is_capital_company: "true",
      employee_count: "42",
    });
  });

  it("never collapses an unanswered tri-state into a no", async () => {
    const onSubmit = vi.fn();
    routed(<ProfileWorkspace defaultValues={emptyProfileValues()} onSubmit={onSubmit} />);

    await choose(/Sermaye şirketi mi/u, "Evet");
    await userEvent.click(screen.getByRole("button", { name: "Profili kaydet" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const submitted = onSubmit.mock.calls[0]?.[0] as Record<string, string>;
    expect(submitted["is_capital_company"]).toBe("true");
    // Every other declaration was left alone, and "left alone" is the empty
    // wire value the engine reads as UNKNOWN - never "false".
    expect(submitted["sme_declaration"]).toBe("");
    expect(Object.values(submitted)).not.toContain("false");
  });
});

/* -------------------------------------------------------------- the wizard */

describe("the wizard submits exactly what the form validated", () => {
  it("carries answers from earlier steps into the finished object", async () => {
    const onFinish = vi.fn();
    function Harness() {
      const [step, setStep] = useState(0);
      return (
        <EligibilityWizard
          step={step}
          defaultValues={emptyProfileValues()}
          onStepChange={setStep}
          onFinish={onFinish}
        />
      );
    }
    routed(<Harness />);

    await choose(/Sermaye şirketi mi/u, "Evet");
    await userEvent.click(screen.getByRole("button", { name: "İleri" }));
    fill(await screen.findByLabelText(/Çalışan sayısı/u), "7");
    await userEvent.click(screen.getByRole("button", { name: "İleri" }));
    fill(await screen.findByLabelText(/NACE kodu/u), "62.01");
    await userEvent.click(screen.getByRole("button", { name: "İleri" }));
    await userEvent.click(await screen.findByRole("button", { name: "Kaydet ve değerlendir" }));

    await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
    expect(onFinish.mock.calls[0]?.[0]).toEqual({
      ...emptyProfileValues(),
      is_capital_company: "true",
      employee_count: "7",
      nace_code: "62.01",
    });
  });

  it("counts the answers on its summary step from the form itself", async () => {
    function Harness() {
      const [step, setStep] = useState(0);
      return (
        <EligibilityWizard
          step={step}
          defaultValues={emptyProfileValues()}
          onStepChange={setStep}
          onFinish={vi.fn()}
        />
      );
    }
    routed(<Harness />);

    await choose(/Sermaye şirketi mi/u, "Evet");
    for (let step = 0; step < 3; step += 1) {
      await userEvent.click(screen.getByRole("button", { name: "İleri" }));
    }

    // The summary reads the live form state; with no second store there is
    // nothing left that could disagree with it.
    expect(await screen.findByText(/1 \/ 12 olgu yanıtlandı/u)).toBeInTheDocument();
  });
});

/* -------------------------------------------------- the route, on the wire */

/** The form-encoded body the route actually posted. */
function bodyFields(body: string): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(body)) parsed[key] = value;
  return parsed;
}

describe("/organizasyon/profil posts the validated object and nothing else", () => {
  it("sends what the person typed, field for field", async () => {
    let posted: Record<string, string> | null = null;
    server.use(
      http.post("/profil", async ({ request }) => {
        posted = bodyFields(await request.text());
        return HttpResponse.redirect(
          new URL("/profil?kayit=tamam", window.location.origin).toString(),
          303,
        );
      }),
    );

    await renderAppAt("/organizasyon/profil");
    fill(await screen.findByLabelText(/Görünen ad/u), "Beta Yazılım A.Ş.");
    await choose(/Sermaye şirketi mi/u, "Evet");
    await userEvent.click(screen.getByRole("button", { name: "Profili kaydet" }));

    await waitFor(() => expect(posted).not.toBeNull());
    const sent = posted as unknown as Record<string, string>;
    expect(sent["display_name"]).toBe("Beta Yazılım A.Ş.");
    expect(sent["is_capital_company"]).toBe("true");
    expect(sent["sme_declaration"]).toBe("");
  });

  it("names its selects from the visible label and describes them with real text", async () => {
    // The route-level regression for the field contract: the same select, in
    // the shell, with the real stylesheet and the real form around it.
    await renderAppAt("/organizasyon/profil");
    const trigger = await screen.findByRole("combobox", { name: /Sermaye şirketi mi/u });
    expect(trigger).not.toHaveAttribute("aria-label");

    const named = (trigger.getAttribute("aria-labelledby") ?? "").split(/\s+/u).filter(Boolean);
    expect(named.length).toBeGreaterThan(0);
    for (const id of named) {
      expect(document.getElementById(id), `aria-labelledby "${id}" is dangling`).not.toBeNull();
    }

    const described = (trigger.getAttribute("aria-describedby") ?? "")
      .split(/\s+/u)
      .filter(Boolean);
    expect(described.length, "the hinted select describes itself with nothing").toBeGreaterThan(0);
    for (const id of described) {
      const target = document.getElementById(id);
      expect(target, `aria-describedby "${id}" is dangling`).not.toBeNull();
      expect((target?.textContent ?? "").trim().length).toBeGreaterThan(0);
    }
  });
});
