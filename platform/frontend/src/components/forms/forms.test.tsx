/**
 * The form layer: one select that looks the same everywhere, and forms that
 * are actually validated.
 *
 * Two promises are pinned here.
 *
 * **The select is not the platform's.** A native `<select>` renders as a
 * different control on iOS, macOS, Windows, Linux and Android - different
 * height, different type-ahead, a full-screen wheel on one of them - and none
 * of that is themeable. An enterprise surface that shows a filter control which
 * changes shape per operating system is not one product. So the control here is
 * a custom listbox, and these tests assert the accessibility contract that a
 * custom control has to earn back: a real accessible name, `combobox`
 * semantics, keyboard operation, and a value that only changes when the user
 * changes it.
 *
 * **Forms use react-hook-form.** It was already a dependency and had no callers
 * at all - every form in the product was hand-rolled state. These tests pin the
 * two things a hand-rolled form usually gets wrong: a submit that fires with
 * invalid values, and an error that is shown in colour but never announced.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AppForm, SelectField, TextField } from "./fields";
import { Select, type SelectOption } from "./Select";

const OPTIONS: readonly SelectOption[] = [
  { value: "tumu", label: "Tümü" },
  { value: "aday", label: "Aday uygunluk" },
  { value: "kosullu", label: "Koşullu" },
  { value: "yetersiz", label: "Yetersiz veri", disabled: true },
];

function ControlledSelect({ onChange }: { onChange?: (value: string) => void }) {
  return (
    <Select
      label="Sonuç filtresi"
      value="tumu"
      options={OPTIONS}
      onValueChange={(value) => onChange?.(value)}
    />
  );
}

/* ---------------------------------------------------------------- select */

describe("the select is a custom control, not the platform's", () => {
  it("renders no native select element", () => {
    // The whole point: a native control cannot be made to look the same on
    // five operating systems, and this product ships to all of them.
    const { container } = render(<ControlledSelect />);
    expect(container.querySelector("select")).toBeNull();
  });

  it("exposes combobox semantics with an accessible name", () => {
    render(<ControlledSelect />);
    const trigger = screen.getByRole("combobox", { name: /Sonuç filtresi/u });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("shows the current value rather than a placeholder", () => {
    render(<ControlledSelect />);
    expect(screen.getByRole("combobox", { name: /Sonuç filtresi/u })).toHaveTextContent("Tümü");
  });

  it("opens on keyboard alone and lists its options", async () => {
    render(<ControlledSelect />);
    const trigger = screen.getByRole("combobox", { name: /Sonuç filtresi/u });
    await userEvent.tab();
    expect(trigger).toHaveFocus();

    await userEvent.keyboard("{Enter}");
    const listbox = await screen.findByRole("listbox");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(within(listbox).getAllByRole("option").length).toBe(OPTIONS.length);
  });

  it("marks the selected option and the disabled one", async () => {
    render(<ControlledSelect />);
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    const listbox = await screen.findByRole("listbox");
    expect(within(listbox).getByRole("option", { name: /Tümü/u })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(within(listbox).getByRole("option", { name: /Yetersiz veri/u })).toHaveAttribute(
      "data-disabled",
    );
  });

  it("commits a choice made with the keyboard", async () => {
    const onChange = vi.fn();
    render(<ControlledSelect onChange={onChange} />);
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    await screen.findByRole("listbox");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("aday"));
  });

  it("closes on Escape without changing the value", async () => {
    const onChange = vi.fn();
    render(<ControlledSelect onChange={onChange} />);
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    await screen.findByRole("listbox");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    expect(onChange).not.toHaveBeenCalled();
  });

  it("is controlled: it does not move on its own", async () => {
    // A select that updates its own display before the caller accepts the
    // change will happily show a filter that was never applied.
    render(<ControlledSelect />);
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    await screen.findByRole("listbox");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    expect(screen.getByRole("combobox", { name: /Sonuç filtresi/u })).toHaveTextContent("Tümü");
  });

  it("reports invalid state to assistive technology", () => {
    render(
      <Select
        label="Sonuç filtresi"
        value=""
        options={OPTIONS}
        onValueChange={vi.fn()}
        invalid
        placeholder="Seçin"
      />,
    );
    expect(screen.getByRole("combobox", { name: /Sonuç filtresi/u })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });
});

/* ------------------------------------------------------------------ forms */

interface ApprovalValues extends Record<string, unknown> {
  readonly note: string;
  readonly scope: string;
}

function TestForm({ onValid }: { onValid: (values: ApprovalValues) => void }) {
  return (
    <AppForm<ApprovalValues>
      label="Kullanıcı onayı"
      submitLabel="Kaydet"
      defaultValues={{ note: "", scope: "" }}
      onValid={onValid}
    >
      <TextField name="note" label="Not" required minLength={5} multiline />
      <SelectField
        name="scope"
        label="Kapsam"
        required
        placeholder="Seçin"
        options={[
          { value: "tam", label: "Tam" },
          { value: "kismi", label: "Kısmi" },
        ]}
      />
    </AppForm>
  );
}

describe("forms are validated by react-hook-form", () => {
  it("uses react-hook-form rather than hand-rolled state", () => {
    // Named directly: the dependency was installed and had no callers at all,
    // and "we should use it" is not something a behaviour test can check.
    const source = readFileSync(
      join(process.cwd(), "src", "components", "forms", "fields.tsx"),
      "utf8",
    );
    expect(source).toMatch(/from "react-hook-form"/u);
    expect(source).toMatch(/\buseForm\b/u);
    expect(source).toMatch(/\bhandleSubmit\b/u);
    // Comments stripped: the docstring explains what hand-rolled `useState`
    // forms get wrong, and a guard that banned the word would ban the
    // explanation along with the practice.
    const code = source.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/(^|[^:])\/\/.*$/gmu, "$1");
    expect(code).not.toMatch(/\buseState\b/u);
  });

  it("refuses to submit an empty required field and says why", async () => {
    const onValid = vi.fn();
    render(<TestForm onValid={onValid} />);
    await userEvent.click(screen.getByRole("button", { name: /Kaydet/u }));

    expect(onValid).not.toHaveBeenCalled();
    const alerts = await screen.findAllByRole("alert");
    expect(alerts.length).toBeGreaterThan(0);
  });

  it("links the error to its field so a screen reader reads them together", async () => {
    render(<TestForm onValid={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /Kaydet/u }));

    const note = await screen.findByLabelText(/Not/u);
    await waitFor(() => expect(note).toHaveAttribute("aria-invalid", "true"));
    const describedBy = note.getAttribute("aria-describedby") ?? "";
    expect(describedBy.length).toBeGreaterThan(0);
    const described = describedBy
      .split(/\s+/u)
      .map((id) => document.getElementById(id)?.textContent ?? "")
      .join(" ");
    expect(described.trim().length).toBeGreaterThan(0);
  });

  it("enforces a minimum length rather than accepting one character", async () => {
    const onValid = vi.fn();
    render(<TestForm onValid={onValid} />);
    await userEvent.type(screen.getByLabelText(/Not/u), "kısa");
    await userEvent.click(screen.getByRole("button", { name: /Kaydet/u }));
    expect(onValid).not.toHaveBeenCalled();
  });

  it("submits the typed values once every field is valid", async () => {
    const onValid = vi.fn();
    render(<TestForm onValid={onValid} />);

    await userEvent.type(screen.getByLabelText(/Not/u), "Yönetim kurulu kararı alındı.");
    await userEvent.click(screen.getByRole("combobox", { name: /Kapsam/u }));
    await screen.findByRole("listbox");
    await userEvent.click(screen.getByRole("option", { name: /Kısmi/u }));
    await userEvent.click(screen.getByRole("button", { name: /Kaydet/u }));

    await waitFor(() => expect(onValid).toHaveBeenCalledTimes(1));
    expect(onValid.mock.calls[0]?.[0]).toMatchObject({
      note: "Yönetim kurulu kararı alındı.",
      scope: "kismi",
    });
  });

  it("does not submit the defaults when the user typed something else", async () => {
    // The stub this replaced handed `defaultValues` straight back, which looks
    // identical in a happy-path test and is completely wrong.
    const onValid = vi.fn();
    render(<TestForm onValid={onValid} />);
    await userEvent.type(screen.getByLabelText(/Not/u), "Gerçek metin girildi.");
    await userEvent.click(screen.getByRole("combobox", { name: /Kapsam/u }));
    await screen.findByRole("listbox");
    await userEvent.click(screen.getByRole("option", { name: /Tam/u }));
    await userEvent.click(screen.getByRole("button", { name: /Kaydet/u }));

    await waitFor(() => expect(onValid).toHaveBeenCalled());
    expect(onValid.mock.calls[0]?.[0]).not.toMatchObject({ note: "" });
  });

  /**
   * The whole object, not a subset.
   *
   * `toMatchObject` above passes even if the form hands back a value the user
   * never entered, or drops a field that was left at its default. The thing a
   * caller is entitled to rely on is that `onValid`'s argument *is* the form's
   * validated state - so it is asserted as an equality, once.
   */
  it("hands over exactly the validated object, untouched defaults included", async () => {
    const onValid = vi.fn();
    render(<TestForm onValid={onValid} />);

    await userEvent.type(screen.getByLabelText(/Not/u), "Yalnızca not girildi.");
    await userEvent.click(screen.getByRole("combobox", { name: /Kapsam/u }));
    await screen.findByRole("listbox");
    await userEvent.click(screen.getByRole("option", { name: /Tam/u }));
    await userEvent.click(screen.getByRole("button", { name: /Kaydet/u }));

    await waitFor(() => expect(onValid).toHaveBeenCalledTimes(1));
    expect(onValid.mock.calls[0]?.[0]).toEqual({
      note: "Yalnızca not girildi.",
      scope: "tam",
    });
  });
});

/* ------------------------------------------------------------- field names */

/**
 * The accessible name of a field is the label the person can see.
 *
 * The select field used to hand the Radix trigger an `aria-label` carrying the
 * same words as its visible `<label>`. Two names for one control is not
 * belt-and-braces: `aria-label` *wins*, so the visible text stops being the
 * name, and the day someone edits the label the announced name silently stays
 * behind. Worse, the field also pointed `aria-describedby` at a hint id that
 * no element in the document carried - a screen reader following that
 * reference finds nothing at all.
 */
describe("a field is named by its visible label and describes itself with real text", () => {
  const SCOPE_OPTIONS = [
    { value: "tam", label: "Tam" },
    { value: "kismi", label: "Kısmi" },
  ] as const;

  interface HintedValues extends Record<string, unknown> {
    readonly scope: string;
    readonly note: string;
  }

  function HintedForm() {
    return (
      <AppForm<HintedValues>
        label="Şirket profili"
        defaultValues={{ scope: "", note: "" }}
        onValid={vi.fn()}
      >
        <SelectField
          name="scope"
          label="Kapsam"
          hint="Emin değilseniz boş bırakın."
          options={[...SCOPE_OPTIONS]}
        />
        <TextField name="note" label="Not" hint="Yalnızca sizin kaydınızdır." />
      </AppForm>
    );
  }

  /** Every id in an `aria-describedby`, resolved to the text it points at. */
  function describedTexts(control: Element): string[] {
    const ids = (control.getAttribute("aria-describedby") ?? "").split(/\s+/u).filter(Boolean);
    expect(ids.length, "the control describes itself with no ids at all").toBeGreaterThan(0);
    return ids.map((id) => {
      const target = document.getElementById(id);
      expect(target, `aria-describedby points at "${id}", which is not in the document`).not.toBeNull();
      return (target?.textContent ?? "").trim();
    });
  }

  it("gives the select trigger no aria-label to compete with the label element", () => {
    render(<HintedForm />);
    const trigger = screen.getByRole("combobox", { name: "Kapsam" });
    expect(trigger).not.toHaveAttribute("aria-label");
  });

  it("names the select trigger from the visible label text itself", () => {
    render(<HintedForm />);
    const trigger = screen.getByRole("combobox", { name: "Kapsam" });
    const labelledBy = trigger.getAttribute("aria-labelledby");
    expect(labelledBy, "the trigger is named by nothing in the document").toBeTruthy();
    for (const id of (labelledBy ?? "").split(/\s+/u).filter(Boolean)) {
      const target = document.getElementById(id);
      expect(target, `aria-labelledby points at "${id}", which is not in the document`).not.toBeNull();
      expect((target?.textContent ?? "").trim().length).toBeGreaterThan(0);
    }
    // The named element is the one the person reads, not a duplicate.
    expect(trigger).toHaveAccessibleName("Kapsam");
  });

  it("resolves every id the select describes itself with, and each carries the hint", () => {
    render(<HintedForm />);
    const trigger = screen.getByRole("combobox", { name: "Kapsam" });
    expect(describedTexts(trigger)).toEqual(["Emin değilseniz boş bırakın."]);
  });

  it("resolves every id the text field describes itself with", () => {
    // Matched loosely on purpose: a text input is named by its whole `<label>`,
    // and this one legitimately contains the hint as well as the label text.
    // The claim under test is the description, and the description has to
    // resolve to an element that exists - which is what it did not do.
    render(<HintedForm />);
    expect(describedTexts(screen.getByLabelText(/Not/u))).toEqual([
      "Yalnızca sizin kaydınızdır.",
    ]);
  });

  it("adds the error to the description without breaking the hint reference", async () => {
    render(
      <AppForm<{ scope: string }>
        label="Şirket profili"
        defaultValues={{ scope: "" }}
        onValid={vi.fn()}
      >
        <SelectField
          name="scope"
          label="Kapsam"
          required
          hint="Emin değilseniz boş bırakın."
          options={[...SCOPE_OPTIONS]}
        />
      </AppForm>,
    );
    await userEvent.click(screen.getByRole("button", { name: /Kaydet/u }));

    const trigger = screen.getByRole("combobox", { name: "Kapsam" });
    await waitFor(() => expect(trigger).toHaveAttribute("aria-invalid", "true"));
    const texts = describedTexts(trigger);
    expect(texts).toHaveLength(2);
    expect(texts[0]).toBe("Emin değilseniz boş bırakın.");
    expect(texts[1]?.length ?? 0).toBeGreaterThan(0);
  });
});
