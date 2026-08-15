/**
 * CSV of the rows handed to it - which is always the loaded, authorised set.
 *
 * There is no export endpoint, so a "download everything" button would have to
 * invent data it never received. The caller passes exactly what the user can
 * already see, and the interface labels the export accordingly.
 */

import type { GridColumn } from "./types";

/**
 * Characters that make a spreadsheet treat a cell as a formula rather than as
 * text. `=`, `+`, `-` and `@` start an expression; a leading tab or carriage
 * return is stripped on open and hands the interpretation to whatever follows.
 */
const FORMULA_PREFIXES = new Set(["=", "+", "-", "@", "\t", "\r"]);

/**
 * Make a user-supplied cell inert before it is quoted.
 *
 * RFC 4180 quoting is not a defence: the quotes are removed while the file is
 * parsed, and the cell is interpreted afterwards. So the leading apostrophe -
 * the spreadsheet's own "this is text" marker - goes on first, and the quoting
 * below then treats the result as any other value.
 *
 * The apostrophe is visible in the exported file. That is a deliberate trade:
 * an export is read by a person, and a visibly marked cell is better than a
 * cell that runs.
 */
function neutraliseFormula(value: string): string {
  return FORMULA_PREFIXES.has(value.charAt(0)) ? `'${value}` : value;
}

/** RFC 4180 quoting: a separator, quote or newline inside a cell is escaped. */
function escapeCell(value: string): string {
  if (/[",\n\r]/u.test(value)) {
    return `"${value.replace(/"/gu, '""')}"`;
  }
  return value;
}

/** Neutralise first, quote second. The order is the whole point. */
function csvField(value: string): string {
  return escapeCell(neutraliseFormula(value));
}

/**
 * The cell text, and whether its value could carry user input.
 *
 * A number this grid rendered itself - `-12`, `1e+21` - begins with `-` or
 * contains `+` without ever being an expression, and prefixing it would corrupt
 * a numeric column to defend against a payload that cannot exist there. Only a
 * string reaches the export unshaped by us, so only a string is neutralised.
 */
function cellText<TRow>(
  column: GridColumn<TRow>,
  row: TRow,
): { readonly text: string; readonly userSupplied: boolean } {
  const raw = column.accessor(row);
  if (raw === null || raw === undefined) return { text: "", userSupplied: false };
  if (typeof raw === "boolean") return { text: raw ? "Evet" : "Hayır", userSupplied: false };
  if (typeof raw === "string") return { text: raw, userSupplied: true };
  return { text: String(raw), userSupplied: false };
}

export function toCsv<TRow>(
  columns: readonly GridColumn<TRow>[],
  rows: readonly TRow[],
): string {
  // Headers are authored in `configs.tsx` rather than typed by a user, but they
  // are strings on the same row of the same file: neutralised too, so no future
  // header can quietly become the one unguarded cell.
  const header = columns.map((column) => csvField(column.header)).join(",");
  const body = rows.map((row) =>
    columns
      .map((column) => {
        const cell = cellText(column, row);
        return cell.userSupplied ? csvField(cell.text) : escapeCell(cell.text);
      })
      .join(","),
  );
  return [header, ...body].join("\n") + "\n";
}

/** Triggers a client-side download. No network request is made. */
/**
 * Byte order mark, written as an escape so it is visible in review.
 *
 * It used to be the literal character. The comment claimed one thing and the
 * bytes said another: a zero-width code point no reviewer can see sitting in a
 * string that looks empty.
 */
const BOM = "\uFEFF";

export function downloadCsv(filename: string, content: string): void {
  // Leading BOM so Excel opens UTF-8 Turkish characters correctly.
  const blob = new Blob([`${BOM}${content}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
