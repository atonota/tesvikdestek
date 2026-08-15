import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";

import {
  Card,
  CopyableHash,
  DataTable,
  DefinitionList,
  Dialog,
  Fieldset,
  FilterBar,
  FormField,
  Pagination,
  Popover,
  SearchInput,
  Stepper,
  Tabs,
  Timeline,
  Toast,
  Tooltip,
} from "./composites";
import { Button, Input } from "./primitives";

function routed(element: React.ReactElement) {
  const router = createMemoryRouter([{ path: "/", element }], { initialEntries: ["/"] });
  return render(<RouterProvider router={router} />);
}

describe("FormField", () => {
  it("wires label, hint and error to the control", () => {
    render(
      <FormField id="eposta" label="E-posta" hint="Kurumsal adres" error="Geçersiz" required>
        {(aria) => <Input {...aria} />}
      </FormField>,
    );
    const field = screen.getByLabelText(/E-posta/);
    expect(field).toHaveAccessibleDescription(/Kurumsal adres/);
    expect(screen.getByRole("alert")).toHaveTextContent("Geçersiz");
  });

  it("omits the error region when valid", () => {
    render(
      <FormField id="ad" label="Ad">
        {(aria) => <Input {...aria} />}
      </FormField>,
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("Fieldset and Card", () => {
  it("groups fields under a legend with a description", () => {
    render(
      <Fieldset legend="Nitelik" description="Bilinmiyor hayır demek değildir." columns={2}>
        <Input aria-label="x" />
      </Fieldset>,
    );
    const group = screen.getByRole("group", { name: "Nitelik" });
    expect(group).toHaveAccessibleDescription(/Bilinmiyor hayır demek değildir/);
  });

  it("renders a card heading at the requested level", () => {
    render(
      <Card title="Künye" headingLevel={3} actions={<Button size="sm">Yenile</Button>}>
        içerik
      </Card>,
    );
    expect(screen.getByRole("heading", { level: 3, name: "Künye" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yenile" })).toBeInTheDocument();
  });

  it("renders a footer when given one", () => {
    render(<Card footer={<span>alt bilgi</span>}>gövde</Card>);
    expect(screen.getByText("alt bilgi")).toBeInTheDocument();
  });
});

describe("DataTable", () => {
  const rows = [
    { id: "a", program: "TUBITAK-1501", missing: 0 },
    { id: "b", program: "KOSGEB-GIRISIMCI", missing: 2 },
  ];
  const columns = [
    { id: "program", header: "Program", accessorFn: (r: (typeof rows)[number]) => r.program },
    { id: "missing", header: "Eksik", accessorFn: (r: (typeof rows)[number]) => r.missing },
  ];

  it("has a caption and scoped column headers", () => {
    render(<DataTable caption="Kararlar" columns={columns} data={rows} />);
    const table = screen.getByRole("table");
    expect(within(table).getByText("Kararlar")).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader")).toHaveLength(2);
  });

  it("exposes sort state through aria-sort and sorts on click", async () => {
    render(<DataTable caption="Kararlar" columns={columns} data={rows} />);
    const header = screen.getAllByRole("columnheader")[0]!;
    expect(header).toHaveAttribute("aria-sort", "none");
    await userEvent.click(within(header).getByRole("button"));
    expect(header).toHaveAttribute("aria-sort", "ascending");
    await userEvent.click(within(header).getByRole("button"));
    expect(header).toHaveAttribute("aria-sort", "descending");
  });

  it("shows an empty message instead of an empty table", () => {
    render(<DataTable caption="Kararlar" columns={columns} data={[]} emptyMessage="Kayıt yok." />);
    expect(screen.getByText("Kayıt yok.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("also renders a card list when one is supplied", () => {
    render(
      <DataTable
        caption="Kararlar"
        columns={columns}
        data={rows}
        renderCard={(row) => <span>kart: {row.program}</span>}
      />,
    );
    expect(screen.getByText(/kart: TUBITAK-1501/)).toBeInTheDocument();
  });
});

describe("DefinitionList", () => {
  it("renders a dash rather than a blank for an absent value", () => {
    render(<DefinitionList items={[{ term: "Yürürlük", description: "" }]} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});

describe("Tabs, Dialog, Popover, Tooltip", () => {
  it("shows one tab panel at a time", async () => {
    render(
      <Tabs
        label="Ayrıntı"
        items={[
          { value: "a", label: "Gerekçe", content: <p>gerekçe içeriği</p> },
          { value: "b", label: "Kanıt", content: <p>kanıt içeriği</p> },
        ]}
      />,
    );
    expect(screen.getByText("gerekçe içeriği")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Kanıt" }));
    expect(await screen.findByText("kanıt içeriği")).toBeInTheDocument();
  });

  it("opens a dialog with an accessible name and closes it", async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <Button onClick={() => setOpen(true)}>Aç</Button>
          <Dialog open={open} onOpenChange={setOpen} title="Emin misiniz?" description="Geri alınamaz.">
            <p>gövde</p>
          </Dialog>
        </>
      );
    }
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Aç" }));
    const dialog = await screen.findByRole("dialog", { name: "Emin misiniz?" });
    expect(within(dialog).getByText("gövde")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Kapat" }));
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens a popover from its trigger", async () => {
    render(
      <Popover label="Açıklama" trigger={<Button>Detay</Button>}>
        <p>popover içeriği</p>
      </Popover>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Detay" }));
    expect(await screen.findByText("popover içeriği")).toBeInTheDocument();
  });

  it("renders a tooltip trigger that is still reachable without hover", () => {
    render(
      <Tooltip content="Yardım metni">
        <Button>Bilgi</Button>
      </Tooltip>,
    );
    expect(screen.getByRole("button", { name: "Bilgi" })).toBeInTheDocument();
  });
});

describe("Toast", () => {
  it("announces politely and can be dismissed", async () => {
    const onDismiss = vi.fn();
    render(<Toast message="Kaydedildi" tone="success" onDismiss={onDismiss} />);
    expect(screen.getByRole("status")).toHaveTextContent("Kaydedildi");
    await userEvent.click(screen.getByRole("button", { name: "Bildirimi kapat" }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});

describe("Pagination", () => {
  it("hides itself for a single page", () => {
    const { container } = render(
      <Pagination page={1} pageCount={1} onPageChange={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("says out loud that paging happens in the browser", async () => {
    const onPageChange = vi.fn();
    render(<Pagination page={1} pageCount={3} totalItems={30} onPageChange={onPageChange} />);
    expect(screen.getByText(/sayfalama tarayıcıda yapılır/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Önceki" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Sonraki" }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});

describe("FilterBar and SearchInput", () => {
  it("reports the result count and resets", async () => {
    const onChange = vi.fn();
    const onReset = vi.fn();
    render(
      <FilterBar
        resultCount={2}
        onChange={onChange}
        onReset={onReset}
        filters={[
          {
            id: "support",
            label: "Destek türü",
            value: "grant",
            options: [{ value: "grant", label: "Hibe" }],
          },
        ]}
      />,
    );
    expect(screen.getByText("2 sonuç")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Filtreleri temizle" }));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it("announces the result count of a search", async () => {
    const onValueChange = vi.fn();
    render(<SearchInput value="" onValueChange={onValueChange} resultCount={3} />);
    await userEvent.type(screen.getByLabelText("Ara"), "a");
    expect(onValueChange).toHaveBeenCalled();
    expect(screen.getByText("3 sonuç bulundu")).toBeInTheDocument();
  });
});

describe("Stepper and Timeline", () => {
  it("marks the current step for assistive technology", () => {
    render(
      <Stepper
        currentIndex={1}
        steps={[
          { id: "a", label: "Nitelik" },
          { id: "b", label: "Ölçek" },
          { id: "c", label: "Özet" },
        ]}
      />,
    );
    expect(screen.getByText("(şu anki adım)")).toBeInTheDocument();
    expect(screen.getByText("(tamamlandı)")).toBeInTheDocument();
  });

  /**
   * The step list is a horizontal scroller, so it has to be reachable.
   *
   * Measured in Chromium at 320x568 on `/uygunluk/sihirbaz`: the `<ol>` reported
   * `scrollWidth` 362 against a `clientWidth` of 288 - 74 pixels of steps only a
   * pointer could reach. It carried no `tabindex` and contained no focusable
   * child, which is exactly the shape axe reports as `scrollable-region-focusable`
   * (serious): a region that scrolls, with no way to scroll it from a keyboard.
   *
   * The fix is the region itself taking focus. That costs an explicit `role`:
   * a `tabindex` on an `<ol>` whose `list-style` is `none` is the combination
   * that drops list semantics in WebKit, and the steps are an ordered list
   * before they are a scroller.
   */
  it("lets a keyboard reach the step list that scrolls sideways", () => {
    render(
      <Stepper
        currentIndex={1}
        steps={[
          { id: "a", label: "Nitelik" },
          { id: "b", label: "Ölçek" },
          { id: "c", label: "Özet" },
        ]}
      />,
    );

    const list = screen.getByRole("list", { name: /Adımlar/u });
    expect(list.tagName, "the steps stopped being an ordered list").toBe("OL");
    expect(list).toHaveClass("dt-stepper__list");
    // Focusable, and in the natural tab order rather than reachable only by script.
    expect(list.getAttribute("tabindex"), "the scrolling region takes no focus").toBe("0");
    // A name of its own: "Adımlar" on the surrounding <nav> names the landmark,
    // not the box that scrolls.
    expect(list).toHaveAccessibleName();
    // And it says how to drive it, because "focusable" without instructions is
    // a focus stop that appears to do nothing.
    expect(list).toHaveAccessibleDescription(/ok tuş/iu);
  });

  it("shows an empty timeline message", () => {
    render(<Timeline entries={[]} emptyMessage="Kayıt yok." />);
    expect(screen.getByText("Kayıt yok.")).toBeInTheDocument();
  });

  it("lists timeline entries with their timestamps", () => {
    render(
      <Timeline
        entries={[{ id: "1", title: "Karar üretildi", timestamp: "14.08.2026", detail: <span>ek</span> }]}
      />,
    );
    expect(screen.getByText("Karar üretildi")).toBeInTheDocument();
    expect(screen.getByText("14.08.2026")).toBeInTheDocument();
  });
});

describe("CopyableHash", () => {
  it("shows a short form but copies the whole value", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const full = "a".repeat(64);
    routed(<CopyableHash label="Karar özeti" value={full} />);
    expect(screen.getByText(`${"a".repeat(12)}…`)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Karar özeti değerini kopyala/ }));
    expect(writeText).toHaveBeenCalledWith(full);
  });
});
