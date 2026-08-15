/**
 * Acceptance tests for the enterprise data grid.
 *
 * Written before the implementation. Each one names a capability the product
 * claims, so a capability cannot be announced in a matrix and missing from the
 * component. The disabled capabilities are asserted too - a grid that quietly
 * grew server-wide selection would fail here.
 */

import { readFileSync } from "node:fs";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DataGrid,
  DISABLED_CAPABILITIES,
  IMPLEMENTED_CAPABILITIES,
  decodeGridState,
  deleteView,
  encodeGridState,
  initialGridState,
  listSavedViews,
  orderedVisibleColumns,
  runPipeline,
  saveView,
  toCsv,
  type GridConfig,
} from ".";

interface Row {
  id: string;
  ad: string;
  tur: string;
  adet: number;
  tarih: string;
  aktif: boolean;
}

const ROWS: Row[] = [
  { id: "1", ad: "Ankara", tur: "hibe", adet: 12, tarih: "2026-03-01", aktif: true },
  { id: "2", ad: "İzmir", tur: "kredi", adet: 3, tarih: "2026-01-15", aktif: false },
  { id: "3", ad: "Bursa", tur: "hibe", adet: 7, tarih: "2026-05-20", aktif: true },
  { id: "4", ad: "Adana", tur: "garanti", adet: 21, tarih: "2026-02-02", aktif: true },
];

function config(overrides: Partial<GridConfig<Row>> = {}): GridConfig<Row> {
  return {
    id: "test-grid",
    schemaVersion: 1,
    caption: "Test tablosu",
    getRowId: (row) => row.id,
    viewModes: ["table", "card"],
    renderCard: (row) => <span>kart: {row.ad}</span>,
    selectable: true,
    defaultPageSize: 25,
    columns: [
      { id: "ad", header: "Ad", accessor: (r) => r.ad, kind: "text", sortable: true, filterable: true, hideable: true, pinnable: true },
      {
        id: "tur",
        header: "Tür",
        accessor: (r) => r.tur,
        kind: "enum",
        options: [
          { value: "hibe", label: "Hibe" },
          { value: "kredi", label: "Kredi" },
          { value: "garanti", label: "Garanti" },
        ],
        sortable: true,
        filterable: true,
        groupable: true,
        hideable: true,
      },
      { id: "adet", header: "Adet", accessor: (r) => r.adet, kind: "number", sortable: true, filterable: true, hideable: true },
      { id: "tarih", header: "Tarih", accessor: (r) => r.tarih, kind: "date", sortable: true, filterable: true, hideable: true },
      { id: "aktif", header: "Aktif", accessor: (r) => r.aktif, kind: "boolean", filterable: true, hideable: true },
    ],
    ...overrides,
  };
}

function renderGrid(props: Partial<React.ComponentProps<typeof DataGrid<Row>>> = {}) {
  return render(<DataGrid config={config()} rows={ROWS} {...props} />);
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("semantic table markup", () => {
  it("renders a captioned table with scoped column headers", () => {
    renderGrid();
    const table = screen.getByRole("table");
    expect(within(table).getByText("Test tablosu")).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader").length).toBeGreaterThanOrEqual(5);
    for (const header of screen.getAllByRole("columnheader")) {
      expect(header).toHaveAttribute("scope", "col");
    }
  });

  it("renders one row per loaded record", () => {
    renderGrid();
    expect(screen.getAllByRole("row").length).toBeGreaterThanOrEqual(ROWS.length);
    expect(screen.getByText("Ankara")).toBeInTheDocument();
  });
});

describe("search", () => {
  it("narrows the visible rows and announces the count", async () => {
    renderGrid();
    await userEvent.type(screen.getByRole("searchbox"), "ankara");
    expect(screen.getByText("Ankara")).toBeInTheDocument();
    expect(screen.queryByText("İzmir")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/1/);
  });

  it("shows a distinct no-results state rather than an empty table", async () => {
    renderGrid();
    await userEvent.type(screen.getByRole("searchbox"), "böyle-bir-kayıt-yok");
    expect(screen.getByText(/sonuç bulunamadı/i)).toBeInTheDocument();
  });
});

describe("columns menu", () => {
  it("hides and restores a column", async () => {
    renderGrid();
    await userEvent.click(screen.getByRole("button", { name: "Sütunlar" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Adet" }));
    expect(screen.queryByRole("columnheader", { name: /Adet/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: "Adet" }));
    expect(screen.getByRole("columnheader", { name: /Adet/ })).toBeInTheDocument();
  });

  it("reorders a column", async () => {
    renderGrid();
    await userEvent.click(screen.getByRole("button", { name: "Sütunlar" }));
    await userEvent.click(screen.getByRole("button", { name: "Tür sütununu yukarı taşı" }));
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent ?? "");
    expect(headers.findIndex((h) => h.includes("Tür"))).toBeLessThan(
      headers.findIndex((h) => h.includes("Ad")),
    );
  });

  it("pins a column to the start", async () => {
    renderGrid();
    await userEvent.click(screen.getByRole("button", { name: "Sütunlar" }));
    await userEvent.click(screen.getByRole("button", { name: "Ad sütununu sabitle" }));
    // The selection column is always first and carries its own hidden label,
    // so the pinned column is identified by name rather than by position.
    const pinned = screen.getByRole("columnheader", { name: /^Ad\b/ });
    expect(pinned).toHaveAttribute("data-pinned", "start");

    // And it now leads the other data columns.
    const headers = screen.getAllByRole("columnheader");
    expect(headers.indexOf(pinned)).toBeLessThan(
      headers.indexOf(screen.getByRole("columnheader", { name: /^Tür\b/ })),
    );
  });
});

describe("sorting", () => {
  it("exposes aria-sort and cycles through directions", async () => {
    renderGrid();
    // Anchored: an unanchored /Ad/ also matches "Adet".
    const header = screen.getByRole("columnheader", { name: /^Ad\b/ });
    expect(header).toHaveAttribute("aria-sort", "none");
    await userEvent.click(within(header).getByRole("button"));
    expect(header).toHaveAttribute("aria-sort", "ascending");
    await userEvent.click(within(header).getByRole("button"));
    expect(header).toHaveAttribute("aria-sort", "descending");
  });

  it("sorts rows by the accessor value", async () => {
    renderGrid();
    await userEvent.click(
      within(screen.getByRole("columnheader", { name: /^Adet\b/ })).getByRole("button"),
    );
    const cells = screen.getAllByRole("cell").map((cell) => cell.textContent ?? "");
    expect(cells.indexOf("3")).toBeLessThan(cells.indexOf("21"));
  });

  it("supports multi-column sort", async () => {
    renderGrid();
    await userEvent.click(screen.getByRole("button", { name: "Sırala" }));
    await userEvent.click(screen.getByRole("button", { name: "Sıralama ölçütü ekle" }));
    expect(screen.getAllByRole("combobox", { name: /Sıralama sütunu/ })).toHaveLength(2);
  });
});

describe("typed filters", () => {
  it("filters an enum column to a chosen option", async () => {
    renderGrid();
    await userEvent.click(screen.getByRole("button", { name: "Filtre" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Hibe" }));
    expect(screen.getByText("Ankara")).toBeInTheDocument();
    expect(screen.queryByText("İzmir")).not.toBeInTheDocument();
  });

  it("filters a number column by range", async () => {
    renderGrid();
    await userEvent.click(screen.getByRole("button", { name: "Filtre" }));
    await userEvent.type(screen.getByRole("spinbutton", { name: /Adet en az/ }), "10");
    expect(screen.queryByText("İzmir")).not.toBeInTheDocument();
    expect(screen.getByText("Ankara")).toBeInTheDocument();
  });

  it("reports how many filters are active", async () => {
    renderGrid();
    await userEvent.click(screen.getByRole("button", { name: "Filtre" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Hibe" }));
    // Anchored: "Filtreleri temizle" also contains "Filtre".
    expect(screen.getByRole("button", { name: /^Filtre\b/ })).toHaveTextContent("1");
  });
});

describe("grouping", () => {
  it("groups rows and lets a group collapse", async () => {
    renderGrid();
    await userEvent.click(screen.getByRole("button", { name: "Grupla" }));
    await userEvent.click(screen.getByRole("radio", { name: "Tür" }));

    const groupHeader = screen.getByRole("button", { name: /Hibe grubu/ });
    expect(groupHeader).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(groupHeader);
    expect(screen.getByRole("button", { name: /Hibe grubu/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByText("Ankara")).not.toBeInTheDocument();
  });
});

describe("selection and bulk actions", () => {
  it("marks selected rows with aria-selected", async () => {
    renderGrid();
    const checkbox = screen.getByRole("checkbox", { name: /Ankara satırını seç/ });
    await userEvent.click(checkbox);
    expect(screen.getByRole("row", { name: /Ankara/ })).toHaveAttribute("aria-selected", "true");
  });

  it("shows a bulk bar that names the loaded scope", async () => {
    renderGrid();
    await userEvent.click(screen.getByRole("checkbox", { name: /Ankara satırını seç/ }));
    const bar = screen.getByRole("region", { name: /Toplu eylem/ });
    expect(bar).toHaveTextContent(/1 satır seçildi/);
    expect(bar).toHaveTextContent(/yüklenmiş/i);
  });

  it("runs a bulk action against the selected loaded rows only", async () => {
    const run = vi.fn();
    renderGrid({
      config: config({ bulkActions: [{ id: "x", label: "Dışa aktar", run }] }),
    });
    await userEvent.click(screen.getByRole("checkbox", { name: /Ankara satırını seç/ }));
    await userEvent.click(screen.getByRole("button", { name: "Dışa aktar" }));
    expect(run).toHaveBeenCalledWith([ROWS[0]]);
  });

  it("renders a forbidden bulk action as disabled with its reason", async () => {
    renderGrid({
      config: config({
        bulkActions: [
          { id: "y", label: "Sil", run: vi.fn(), allowed: false, reason: "Yetkiniz yok." },
        ],
      }),
    });
    await userEvent.click(screen.getByRole("checkbox", { name: /Ankara satırını seç/ }));
    expect(screen.getByRole("button", { name: "Sil" })).toBeDisabled();
    expect(screen.getByText("Yetkiniz yok.")).toBeInTheDocument();
  });

  it("select-all covers the loaded rows and says so", async () => {
    renderGrid();
    await userEvent.click(screen.getByRole("checkbox", { name: /Yüklenmiş tüm satırları seç/ }));
    expect(screen.getByRole("region", { name: /Toplu eylem/ })).toHaveTextContent(
      /4 satır seçildi/,
    );
  });
});

describe("pagination", () => {
  it("pages the loaded rows and labels the mechanism", async () => {
    renderGrid({ config: config({ defaultPageSize: 2 }) });
    const nav = screen.getByRole("navigation", { name: "Sayfalama" });
    expect(nav).toHaveTextContent(/1 \/ 2/);
    expect(nav).toHaveTextContent(/tarayıcıda/i);
    await userEvent.click(within(nav).getByRole("button", { name: "Sonraki" }));
    expect(screen.getByText("Bursa")).toBeInTheDocument();
  });
});

describe("view modes", () => {
  it("switches to cards when the consumer declares that mode", async () => {
    renderGrid();
    await userEvent.click(screen.getByRole("button", { name: "Kart görünümü" }));
    expect(screen.getByText("kart: Ankara")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("offers no card control when the consumer declares only a table", () => {
    renderGrid({ config: config({ viewModes: ["table"] }) });
    expect(screen.queryByRole("button", { name: "Kart görünümü" })).not.toBeInTheDocument();
  });
});

describe("states", () => {
  it("announces loading", () => {
    renderGrid({ rows: [], status: "loading" });
    expect(screen.getByRole("status")).toHaveTextContent(/yükleniyor/i);
  });

  it("announces refreshing while keeping the rows visible", () => {
    renderGrid({ status: "refreshing" });
    expect(screen.getByText("Ankara")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/yenileniyor/i);
  });

  it("shows an error with a retry", async () => {
    const onRefresh = vi.fn();
    renderGrid({ rows: [], status: "error", errorMessage: "Sunucu hatası", onRefresh });
    expect(screen.getByRole("alert")).toHaveTextContent("Sunucu hatası");
    await userEvent.click(screen.getByRole("button", { name: "Tekrar dene" }));
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("distinguishes empty from no-results", () => {
    renderGrid({ rows: [] });
    expect(screen.getByText(/kayıt yok/i)).toBeInTheDocument();
  });
});

describe("URL state", () => {
  it("round-trips a non-default state", () => {
    const initial = initialGridState(config());
    const state = { ...initial, search: "ankara", page: 2, sort: [{ columnId: "adet", direction: "desc" as const }] };
    const encoded = encodeGridState(state, initial);
    expect(encoded).not.toBe("");
    expect(decodeGridState(encoded, initial)).toMatchObject({
      search: "ankara",
      page: 2,
      sort: [{ columnId: "adet", direction: "desc" }],
    });
  });

  it("encodes nothing when the state is the default", () => {
    const initial = initialGridState(config());
    expect(encodeGridState(initial, initial)).toBe("");
  });
});

describe("saved views", () => {
  it("saves, lists and deletes a named view scoped by grid and schema", () => {
    const initial = initialGridState(config());
    saveView("test-grid", 1, "Yalnız hibeler", { ...initial, search: "hibe" });
    expect(listSavedViews("test-grid", 1).map((view) => view.name)).toEqual(["Yalnız hibeler"]);

    // A different grid, and a different schema version, must not see it.
    expect(listSavedViews("other-grid", 1)).toEqual([]);
    expect(listSavedViews("test-grid", 2)).toEqual([]);

    deleteView("test-grid", 1, "Yalnız hibeler");
    expect(listSavedViews("test-grid", 1)).toEqual([]);
  });
});

describe("CSV export", () => {
  it("exports the visible columns of the given loaded rows", () => {
    const csv = toCsv(config().columns, ROWS.slice(0, 2));
    const lines = csv.trim().split("\n");
    expect(lines[0]).toContain("Ad");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain("Ankara");
  });

  it("quotes separators and quotes so a cell cannot break the file", () => {
    const csv = toCsv(
      [{ id: "ad", header: "Ad", accessor: (r: Row) => r.ad }],
      [{ ...ROWS[0]!, ad: 'Ankara, "merkez"' }],
    );
    expect(csv).toContain('"Ankara, ""merkez"""');
  });
});

/**
 * A CSV cell is data, but a spreadsheet reads a cell that begins with `=`, `+`,
 * `-`, `@`, a tab or a carriage return as a *formula* and executes it on open.
 * Every string cell here comes from a company profile, an approval note or a
 * program name - user input - so the export is a delivery mechanism unless the
 * prefix is neutralised. RFC 4180 quoting does not help: quotes are stripped
 * before the cell is interpreted.
 */
describe("CSV spreadsheet formula neutralisation", () => {
  const adColumn = [{ id: "ad", header: "Ad", accessor: (r: Row) => r.ad }];

  function exportedCell(value: string): string {
    const csv = toCsv(adColumn, [{ ...ROWS[0]!, ad: value }]);
    return csv.split("\n")[1]!;
  }

  /** The cell as a spreadsheet sees it: RFC 4180 quoting undone. */
  function asSpreadsheetSees(field: string): string {
    return field.startsWith('"') && field.endsWith('"')
      ? field.slice(1, -1).replace(/""/gu, '"')
      : field;
  }

  const dangerous: readonly (readonly [string, string])[] = [
    ["equals", "=1+1"],
    ["plus", "+1+1"],
    ["minus", "-1+1"],
    ["at", "@SUM(1)"],
    ["tab", "\t=1+1"],
    ["carriage return", "\r=1+1"],
  ];

  for (const [label, payload] of dangerous) {
    it(`neutralises a user cell beginning with a ${label}`, () => {
      const seen = asSpreadsheetSees(exportedCell(payload));
      expect(seen.startsWith("'")).toBe(true);
      expect(seen).toBe(`'${payload}`);
    });
  }

  it("neutralises the classic command-execution payload", () => {
    const payload = '=cmd|\' /C calc\'!A0';
    const seen = asSpreadsheetSees(exportedCell(payload));
    expect(seen).toBe(`'${payload}`);
  });

  it("leaves an ordinary value exactly as it was", () => {
    expect(exportedCell("Ankara")).toBe("Ankara");
    expect(exportedCell("İzmir Ç Ş Ğ Ü Ö")).toBe("İzmir Ç Ş Ğ Ü Ö");
  });

  it("does not prefix a negative number produced by the grid itself", () => {
    const csv = toCsv([{ id: "adet", header: "Adet", accessor: () => -12 }], [ROWS[0]!]);
    expect(csv.split("\n")[1]).toBe("-12");
  });

  it("still quotes a neutralised cell that also carries a separator", () => {
    expect(exportedCell('=1,2 "x"')).toBe('"\'=1,2 ""x"""');
  });

  it("neutralises a dangerous header as well", () => {
    const csv = toCsv([{ id: "ad", header: "=1+1", accessor: (r: Row) => r.ad }], []);
    expect(csv.split("\n")[0]).toBe("'=1+1");
  });

  it("declares the neutralisation as a capability rather than leaving it silent", () => {
    expect(IMPLEMENTED_CAPABILITIES.map((capability) => capability.id)).toContain(
      "csv-formula-neutralization",
    );
  });

  it("writes the byte order mark as a visible escape in the source", () => {
    const source = readFileSync("src/components/data-grid/csv.ts", "utf8");
    expect(source).toContain("\\uFEFF");
    expect(source).not.toContain(String.fromCharCode(0xfeff));
  });
});

describe("pipeline", () => {
  it("returns render rows for the current page", () => {
    const state = { ...initialGridState(config()), pageSize: 2 };
    const result = runPipeline(config(), state, ROWS);
    expect(result.totalLoaded).toBe(4);
    expect(result.pageCount).toBe(2);
    expect(result.rendered.filter((row) => row.type === "row")).toHaveLength(2);
  });
});

describe("capability honesty", () => {
  it("declares the client-side capabilities it implements", () => {
    const ids = IMPLEMENTED_CAPABILITIES.map((capability) => capability.id);
    for (const required of [
      "search",
      "column-visibility",
      "column-reorder",
      "column-pin",
      "multi-sort",
      "typed-filters",
      "grouping",
      "selection",
      "client-pagination",
      "url-state",
      "saved-views",
      "csv-export",
    ]) {
      expect(ids).toContain(required);
    }
  });

  it("declares server-dependent capabilities as disabled with reasons", () => {
    const disabled = Object.fromEntries(
      DISABLED_CAPABILITIES.map((capability) => [capability.id, capability.reason]),
    );
    for (const required of [
      "server-wide-selection",
      "server-pagination",
      "full-dataset-export",
      "cross-device-views",
      "audit-persistence",
      "backend-mutations",
      "virtualization",
    ]) {
      expect(disabled[required], `${required} gerekçesiz`).toBeTruthy();
    }
  });

  it("never offers a control for a disabled capability", async () => {
    renderGrid();
    await userEvent.click(screen.getByRole("checkbox", { name: /Yüklenmiş tüm satırları seç/ }));
    expect(
      screen.queryByRole("button", { name: /eşleşen tüm satırları seç/i }),
    ).not.toBeInTheDocument();
  });
});

describe("every filter kind narrows its own column", () => {
  it("text filter matches a substring", async () => {
    renderGrid();
    await userEvent.click(screen.getByRole("button", { name: "Filtre" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Ad içerir" }), "bur");
    expect(screen.getByText("Bursa")).toBeInTheDocument();
    expect(screen.queryByText("Ankara")).not.toBeInTheDocument();
  });

  it("date filter bounds the range", async () => {
    renderGrid();
    await userEvent.click(screen.getByRole("button", { name: "Filtre" }));
    const from = screen.getByLabelText("Tarih başlangıç");
    await userEvent.clear(from);
    await userEvent.type(from, "2026-04-01");
    expect(screen.getByText("Bursa")).toBeInTheDocument();
    expect(screen.queryByText("İzmir")).not.toBeInTheDocument();
  });

  it("boolean filter separates true from false", async () => {
    renderGrid();
    await userEvent.click(screen.getByRole("button", { name: "Filtre" }));
    // A custom combobox, not a native select: open it and choose.
    await userEvent.click(screen.getByRole("combobox", { name: "Aktif durumu" }));
    await screen.findByRole("listbox");
    await userEvent.click(screen.getByRole("option", { name: "Hayır" }));
    expect(screen.getByText("İzmir")).toBeInTheDocument();
    expect(screen.queryByText("Ankara")).not.toBeInTheDocument();
  });

  it("number filter bounds from above", async () => {
    renderGrid();
    await userEvent.click(screen.getByRole("button", { name: "Filtre" }));
    await userEvent.type(screen.getByRole("spinbutton", { name: "Adet en fazla" }), "5");
    expect(screen.getByText("İzmir")).toBeInTheDocument();
    expect(screen.queryByText("Adana")).not.toBeInTheDocument();
  });

  it("clearing filters restores every row", async () => {
    renderGrid();
    await userEvent.click(screen.getByRole("button", { name: "Filtre" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Hibe" }));
    expect(screen.queryByText("İzmir")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Filtreleri temizle" }));
    expect(screen.getByText("İzmir")).toBeInTheDocument();
  });
});

describe("toolbar extras", () => {
  it("saves, applies and deletes a view through the interface", async () => {
    renderGrid();
    await userEvent.type(screen.getByRole("searchbox"), "ankara");
    await userEvent.click(screen.getByRole("button", { name: "Daha fazla" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Görünüm adı" }), "Yalnız Ankara");
    await userEvent.click(screen.getByRole("button", { name: "Görünümü kaydet" }));

    expect(screen.getByRole("button", { name: "Yalnız Ankara" })).toBeInTheDocument();

    await userEvent.clear(screen.getByRole("searchbox"));
    expect(screen.getByText("İzmir")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Yalnız Ankara" }));
    expect(screen.queryByText("İzmir")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Yalnız Ankara görünümünü sil" }));
    expect(screen.queryByRole("button", { name: "Yalnız Ankara" })).not.toBeInTheDocument();
  });

  it("lists what the grid cannot do", async () => {
    renderGrid();
    await userEvent.click(screen.getByRole("button", { name: "Daha fazla" }));
    expect(screen.getByText("Bu tablonun yapamadıkları")).toBeInTheDocument();
    expect(screen.getByText(/Satır sanallaştırma/)).toBeInTheDocument();
  });

  it("shows the shareable query for a non-default state", async () => {
    renderGrid();
    await userEvent.type(screen.getByRole("searchbox"), "bursa");
    await userEvent.click(screen.getByRole("button", { name: "Daha fazla" }));
    expect(screen.getByText(/q=bursa/)).toBeInTheDocument();
  });

  it("removes a sort rule", async () => {
    renderGrid();
    await userEvent.click(screen.getByRole("button", { name: "Sırala" }));
    await userEvent.click(screen.getByRole("button", { name: "Sıralama ölçütü ekle" }));
    await userEvent.click(screen.getByRole("button", { name: "2. sıralama ölçütünü kaldır" }));
    expect(screen.getAllByRole("combobox", { name: /Sıralama sütunu/ })).toHaveLength(1);
  });

  it("moves a column down and turns grouping back off", async () => {
    renderGrid();
    await userEvent.click(screen.getByRole("button", { name: "Sütunlar" }));
    await userEvent.click(screen.getByRole("button", { name: "Ad sütununu aşağı taşı" }));
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent ?? "");
    expect(headers.findIndex((h) => h.startsWith("Tür"))).toBeLessThan(
      headers.findIndex((h) => h.startsWith("Ad ")),
    );

    await userEvent.click(screen.getByRole("button", { name: "Grupla" }));
    await userEvent.click(screen.getByRole("radio", { name: "Tür" }));
    expect(screen.getByRole("button", { name: /Hibe grubu/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Gruplama yok" }));
    expect(screen.queryByRole("button", { name: /Hibe grubu/ })).not.toBeInTheDocument();
  });

  it("clears a selection", async () => {
    renderGrid();
    await userEvent.click(screen.getByRole("checkbox", { name: /Ankara satırını seç/ }));
    await userEvent.click(screen.getByRole("button", { name: "Seçimi temizle" }));
    expect(screen.queryByRole("region", { name: /Toplu eylem/ })).not.toBeInTheDocument();
  });

  it("recovers from no-results with one control", async () => {
    renderGrid();
    await userEvent.type(screen.getByRole("searchbox"), "yok-böyle");
    await userEvent.click(screen.getByRole("button", { name: "Aramayı ve filtreleri temizle" }));
    expect(screen.getByText("Ankara")).toBeInTheDocument();
  });
});

describe("pipeline and serialization edges", () => {
  it("keeps rows when nothing is configured to hide them", () => {
    const state = initialGridState(config());
    expect(runPipeline(config(), state, ROWS).matched).toHaveLength(4);
  });

  it("clamps a page beyond the end", () => {
    const state = { ...initialGridState(config()), pageSize: 2, page: 99 };
    const result = runPipeline(config(), state, ROWS);
    expect(result.rendered.filter((row) => row.type === "row")).toHaveLength(2);
  });

  it("groups and pages together", () => {
    const state = {
      ...initialGridState(config()),
      groupByColumnId: "tur",
      pageSize: 2,
    };
    const result = runPipeline(config(), state, ROWS);
    expect(result.rendered.some((row) => row.type === "group")).toBe(true);
  });

  it("a collapsed group contributes a header and no rows", () => {
    const state = {
      ...initialGridState(config()),
      groupByColumnId: "tur",
      collapsedGroupKeys: ["hibe"],
    };
    const result = runPipeline(config(), state, ROWS);
    const header = result.rendered.find((row) => row.type === "group" && row.key === "hibe");
    expect(header).toMatchObject({ collapsed: true, count: 2 });
  });

  it("hidden columns leave the visible set", () => {
    const state = { ...initialGridState(config()), hiddenColumnIds: ["adet"] };
    expect(orderedVisibleColumns(config(), state).map((column) => column.id)).not.toContain("adet");
  });

  it("decodes a malformed filter payload without throwing", () => {
    const initial = initialGridState(config());
    expect(decodeGridState("filtre=%7Bnot-json", initial).filters).toEqual(initial.filters);
  });

  it("round-trips column layout and grouping", () => {
    const initial = initialGridState(config());
    const state = {
      ...initial,
      hiddenColumnIds: ["adet"],
      pinnedColumnIds: ["ad"],
      columnOrder: ["tur", "ad", "adet", "tarih", "aktif"],
      groupByColumnId: "tur",
      viewMode: "card" as const,
      pageSize: 10,
    };
    const decoded = decodeGridState(encodeGridState(state, initial), initial);
    expect(decoded).toMatchObject({
      hiddenColumnIds: ["adet"],
      pinnedColumnIds: ["ad"],
      groupByColumnId: "tur",
      viewMode: "card",
      pageSize: 10,
    });
  });

  it("ignores a saved view with a blank name", () => {
    saveView("test-grid", 1, "   ", initialGridState(config()));
    expect(listSavedViews("test-grid", 1)).toEqual([]);
  });

  it("never stores a selection in a saved view", () => {
    const state = { ...initialGridState(config()), selectedRowIds: ["1", "2"] };
    saveView("test-grid", 1, "Seçimli", state);
    expect(listSavedViews("test-grid", 1)[0]?.state.selectedRowIds).toEqual([]);
  });

  it("exports a boolean column in Turkish", () => {
    const csv = toCsv(
      [{ id: "aktif", header: "Aktif", accessor: (r: Row) => r.aktif }],
      [ROWS[0]!, ROWS[1]!],
    );
    expect(csv).toContain("Evet");
    expect(csv).toContain("Hayır");
  });
});
