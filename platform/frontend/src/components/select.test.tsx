/**
 * The platform-identical select, and the one bug that made it lie.
 *
 * `Select` omitted the `value` prop whenever the value was the empty string,
 * on the reasoning that Radix treats an absent value as "nothing selected".
 * That is true - and it also makes the control **uncontrolled**. Radix then
 * owns the displayed value, so a caller that *rejects* a change (a filter that
 * fails to apply, a value the store refuses) still sees the new label on the
 * trigger. The whole point of the control being controlled is that the screen
 * never shows a selection the application did not accept.
 *
 * Radix's own `shouldShowPlaceholder` returns true for `""` as well as for
 * `undefined`, so passing `""` through keeps the placeholder *and* keeps the
 * control controlled. Both halves are asserted below.
 *
 * The second contract here is the empty-valued option. `""` is a real, wire
 * level choice in this product - `Bilinmiyor` for a tri-state fact, `Tümü` for
 * a filter - but Radix refuses an `Item` whose value is `""`. So the component
 * encodes it internally and decodes it on the way out, and the caller never
 * sees the encoding.
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Select, type SelectOption } from "./select";

const OPTIONS: readonly SelectOption[] = [
  { value: "aday", label: "Aday uygunluk" },
  { value: "kosullu", label: "Koşullu" },
];

const WITH_EMPTY: readonly SelectOption[] = [
  { value: "", label: "Bilinmiyor" },
  { value: "true", label: "Evet" },
  { value: "false", label: "Hayır" },
];

describe("an empty value keeps the control controlled and shows the placeholder", () => {
  it("shows the placeholder at the empty value", () => {
    render(
      <Select label="Sonuç" value="" options={OPTIONS} placeholder="Seçin" onValueChange={vi.fn()} />,
    );
    expect(screen.getByRole("combobox", { name: /Sonuç/u })).toHaveTextContent("Seçin");
  });

  it("does not move its own display when the caller rejects the change", async () => {
    // The exact regression: start empty, the caller refuses the attempted
    // change, and the trigger must still read as the placeholder rather than
    // as a choice nothing accepted.
    const rejected = vi.fn();
    render(
      <Select
        label="Sonuç"
        value=""
        options={OPTIONS}
        placeholder="Seçin"
        onValueChange={rejected}
      />,
    );

    const trigger = screen.getByRole("combobox", { name: /Sonuç/u });
    await userEvent.click(trigger);
    await screen.findByRole("listbox");
    await userEvent.click(screen.getByRole("option", { name: /Koşullu/u }));

    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    expect(rejected).toHaveBeenCalledWith("kosullu");
    expect(trigger).toHaveTextContent("Seçin");
    expect(trigger).not.toHaveTextContent("Koşullu");
  });

  it("shows the accepted value once the caller does pass it back", () => {
    const { rerender } = render(
      <Select label="Sonuç" value="" options={OPTIONS} placeholder="Seçin" onValueChange={vi.fn()} />,
    );
    rerender(
      <Select
        label="Sonuç"
        value="kosullu"
        options={OPTIONS}
        placeholder="Seçin"
        onValueChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("combobox", { name: /Sonuç/u })).toHaveTextContent("Koşullu");
  });
});

describe("an empty string can also be a real choice, not only 'nothing'", () => {
  it("renders the empty-valued option's own label instead of the placeholder", () => {
    render(
      <Select
        label="KOBİ"
        value=""
        options={WITH_EMPTY}
        placeholder="Seçin"
        onValueChange={vi.fn()}
      />,
    );
    const trigger = screen.getByRole("combobox", { name: /KOBİ/u });
    expect(trigger).toHaveTextContent("Bilinmiyor");
    expect(trigger).not.toHaveTextContent("Seçin");
  });

  it("hands the caller back the empty wire value, never a sentinel", async () => {
    const onValueChange = vi.fn();
    render(
      <Select label="KOBİ" value="true" options={WITH_EMPTY} onValueChange={onValueChange} />,
    );
    await userEvent.click(screen.getByRole("combobox", { name: /KOBİ/u }));
    await screen.findByRole("listbox");
    await userEvent.click(screen.getByRole("option", { name: "Bilinmiyor" }));

    await waitFor(() => expect(onValueChange).toHaveBeenCalledWith(""));
    expect(onValueChange).not.toHaveBeenCalledWith("false");
  });

  it("lists every option exactly once, including the empty one", async () => {
    render(<Select label="KOBİ" value="" options={WITH_EMPTY} onValueChange={vi.fn()} />);
    await userEvent.click(screen.getByRole("combobox", { name: /KOBİ/u }));
    const listbox = await screen.findByRole("listbox");
    expect(within(listbox).getAllByRole("option")).toHaveLength(3);
  });
});

describe("the accessible name comes from wherever the caller put it", () => {
  it("uses an external <label for=…> when no aria-label is given", () => {
    render(
      <>
        <label htmlFor="kobi">KOBİ beyanı</label>
        <Select id="kobi" value="" options={WITH_EMPTY} onValueChange={vi.fn()} />
      </>,
    );
    expect(screen.getByLabelText("KOBİ beyanı")).toHaveAttribute("role", "combobox");
  });
});
