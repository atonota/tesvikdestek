/**
 * Level 2 - composites (16).
 *
 * Composites assemble primitives into the reusable structures the product
 * actually repeats: a labelled field, a sortable table, a dialog that traps
 * focus. Nothing domain-specific lives here.
 */

import * as RadixDialog from "@radix-ui/react-dialog";
import * as RadixPopover from "@radix-ui/react-popover";
import * as RadixTooltip from "@radix-ui/react-tooltip";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { cn } from "@/lib/cn";
import { Button, FieldError, IconButton, Input, Label } from "./primitives";
import {
  Card as UiCard,
  CardAction as UiCardAction,
  CardContent as UiCardContent,
  CardFooter as UiCardFooter,
  CardHeader as UiCardHeader,
  CardTitle as UiCardTitle,
} from "./ui/card";
import {
  Tabs as UiTabs,
  TabsContent as UiTabsContent,
  TabsList as UiTabsList,
  TabsTrigger as UiTabsTrigger,
} from "./ui/tabs";
import { Select } from "./select";
import { DataGrid } from "./data-grid/DataGrid";
import type { GridColumn, GridConfig } from "./data-grid/types";

/**
 * Translate the TanStack column shape existing callers already pass into the
 * grid's typed columns, so adopting the grid costs one prop and no rewrite.
 * Anything the older shape cannot express (filters, grouping, pinning) simply
 * stays off rather than being guessed at.
 */
function toGridConfig<T>(input: {
  gridId: string;
  caption: string;
  columns: ColumnDef<T, unknown>[];
  getRowId?: ((row: T) => string) | undefined;
  renderCard?: ((row: T) => ReactNode) | undefined;
  emptyMessage?: string | undefined;
}): GridConfig<T> {
  const columns: GridColumn<T>[] = input.columns.map((column, index) => {
    const id = String(column.id ?? index);
    const accessorFn = (column as { accessorFn?: (row: T) => unknown }).accessorFn;
    return {
      id,
      header: typeof column.header === "string" ? column.header : id,
      accessor: (row) => {
        const value = accessorFn ? accessorFn(row) : null;
        return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
          ? value
          : value === null || value === undefined
            ? null
            : String(value);
      },
      ...(column.cell
        ? {
            cell: (row: T) =>
              typeof column.cell === "function"
                ? (column.cell as (context: unknown) => ReactNode)({ row: { original: row } })
                : null,
          }
        : {}),
      sortable: (column as { enableSorting?: boolean }).enableSorting !== false && Boolean(accessorFn),
      hideable: true,
    };
  });

  return {
    id: input.gridId,
    schemaVersion: 1,
    caption: input.caption,
    columns,
    getRowId: input.getRowId ?? ((row: T) => JSON.stringify(row)),
    viewModes: input.renderCard ? ["table", "card"] : ["table"],
    ...(input.renderCard ? { renderCard: input.renderCard } : {}),
    ...(input.emptyMessage ? { emptyMessage: input.emptyMessage } : {}),
  };
}

/* --------------------------------------------------------------- FormField */

export interface FormFieldProps {
  id: string;
  label: string;
  children: (aria: { id: string; "aria-describedby": string | undefined }) => ReactNode;
  hint?: string | undefined;
  error?: string | undefined;
  required?: boolean | undefined;
}

/**
 * Wires label, control, hint and error together so the association cannot be
 * forgotten. States: idle · with-hint · invalid · required.
 */
export function FormField({ id, label, children, hint, error, required }: FormFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("dt-field", error && "dt-field--invalid")}>
      <Label htmlFor={id} required={required ?? false}>
        {label}
      </Label>
      {hint ? (
        <p id={hintId} className="dt-field__hint">
          {hint}
        </p>
      ) : null}
      {children({ id, "aria-describedby": describedBy })}
      <FieldError id={errorId ?? `${id}-error`}>{error}</FieldError>
    </div>
  );
}

/* ---------------------------------------------------------------- Fieldset */

export interface FieldsetProps {
  legend: string;
  description?: string;
  children: ReactNode;
  columns?: 1 | 2;
}

/** States: default · with-description · two-column (≥768px). */
export function Fieldset({ legend, description, children, columns = 1 }: FieldsetProps) {
  const descriptionId = useId();
  return (
    <fieldset
      className={cn("dt-fieldset", columns === 2 && "dt-fieldset--two")}
      aria-describedby={description ? descriptionId : undefined}
    >
      <legend className="dt-fieldset__legend">{legend}</legend>
      {description ? (
        <p id={descriptionId} className="dt-fieldset__desc">
          {description}
        </p>
      ) : null}
      {children}
    </fieldset>
  );
}

/* -------------------------------------------------------------------- Card */

export interface CardProps {
  title?: ReactNode;
  /** Rendered in the header, right-aligned. */
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  /** Heading level so a card never breaks the document outline. */
  headingLevel?: 2 | 3 | 4;
  tone?: "default" | "sunken" | "warning";
  className?: string;
}

/**
 * The product card, composed from the master card's parts.
 *
 * Card UI is the layout language of this product - every screen is a stack of
 * these - so this is the third and largest place the master layer had to arrive
 * for the adoption to be visible rather than announced.
 *
 * The props-shaped API survives untouched (`title`, `actions`, `footer`,
 * `headingLevel`, `tone`), because roughly sixty call sites use it and because
 * it carries one thing the composition alone cannot: `headingLevel`. A card
 * that always emitted an `h2` would break the document outline the moment a
 * screen nested one inside a section, and the shadcn composition has no opinion
 * about heading level at all. So the wrapper keeps the semantics and the master
 * parts supply the shape.
 *
 * `asChild` on `CardTitle` is what lets the real heading element survive: the
 * slot renders `<h2>`/`<h3>`/`<h4>` with the title styling merged onto it,
 * rather than wrapping a heading in a styled div.
 *
 * States: default · sunken · warning · with-actions · with-footer.
 */
export function Card({
  title,
  actions,
  footer,
  children,
  headingLevel = 2,
  tone = "default",
  className,
}: CardProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <UiCard
      asChild
      className={cn("dt-card", tone !== "default" && `dt-card--${tone}`, className)}
      {...(tone === "default" ? {} : { "data-tone": tone })}
    >
      <section>
        {title || actions ? (
          <UiCardHeader className="dt-card__head">
            {title ? (
              <UiCardTitle asChild className="dt-card__title">
                <Heading>{title}</Heading>
              </UiCardTitle>
            ) : (
              <span />
            )}
            {actions ? (
              <UiCardAction className="dt-card__actions">{actions}</UiCardAction>
            ) : null}
          </UiCardHeader>
        ) : null}
        <UiCardContent className="dt-card__body">{children}</UiCardContent>
        {footer ? (
          <UiCardFooter asChild className="dt-card__foot">
            <footer>{footer}</footer>
          </UiCardFooter>
        ) : null}
      </section>
    </UiCard>
  );
}

/* --------------------------------------------------------------- DataTable */

export interface DataTableProps<T> {
  /** Required. A table without a caption is a maze for a screen reader. */
  caption: string;
  columns: ColumnDef<T, unknown>[];
  data: T[];
  emptyMessage?: string;
  /** Rendered instead of the table below 768px, where columns stop fitting. */
  renderCard?: (row: T) => ReactNode;
  getRowId?: (row: T) => string;
  className?: string;
  /**
   * Opt in to the full grid toolbar. Left off, `DataTable` stays the small,
   * quiet table its existing callers expect.
   */
  gridId?: string;
}

/**
 * Sortable, keyboard-operable table with `aria-sort` on the active column.
 *
 * Kept as the small surface for callers that want a plain table. When `gridId`
 * is supplied it delegates to `DataGrid`, so a caller can adopt the enterprise
 * toolbar by adding one prop rather than by rewriting its markup. TanStack
 * `ColumnDef`s are translated to grid columns on the way through.
 *
 * Virtualisation is not implemented at either level; it is declared unsupported
 * in the grid capability matrix rather than hinted at here.
 *
 * States: loaded · empty · sorted-asc · sorted-desc · mobile-cards.
 */
export function DataTable<T>({
  caption,
  columns,
  data,
  emptyMessage = "Kayıt yok.",
  renderCard,
  getRowId,
  className,
  gridId,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);

  // Delegation happens before any table machinery is built.
  const gridConfig = useMemo(
    () =>
      gridId
        ? toGridConfig({ gridId, caption, columns, getRowId, renderCard, emptyMessage })
        : null,
    [gridId, caption, columns, getRowId, renderCard, emptyMessage],
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    ...(getRowId ? { getRowId } : {}),
  });

  if (gridConfig) {
    return <DataGrid config={gridConfig} rows={data} />;
  }

  if (data.length === 0) {
    return <p className="dt-muted">{emptyMessage}</p>;
  }

  return (
    <>
      {renderCard ? (
        <ul className="dt-table-cards" aria-label={caption}>
          {table.getRowModel().rows.map((row) => (
            <li key={row.id} className="dt-table-cards__item">
              {renderCard(row.original)}
            </li>
          ))}
        </ul>
      ) : null}
      <div className={cn("dt-scroll-x", "dt-table-wrap", renderCard && "dt-table-wrap--desktop", className)}>
        <table className="dt-table">
          <caption className="dt-table__caption">{caption}</caption>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const sortDirection = header.column.getIsSorted();
                  const canSort = header.column.getCanSort();
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={
                        sortDirection === "asc"
                          ? "ascending"
                          : sortDirection === "desc"
                            ? "descending"
                            : canSort
                              ? "none"
                              : undefined
                      }
                    >
                      {canSort ? (
                        <button
                          type="button"
                          className="dt-table__sort"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <span aria-hidden="true">
                            {sortDirection === "asc" ? " ▲" : sortDirection === "desc" ? " ▼" : " ⇅"}
                          </span>
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ---------------------------------------------------------- DefinitionList */

export interface DefinitionItem {
  term: string;
  description: ReactNode;
}

export interface DefinitionListProps {
  items: readonly DefinitionItem[];
  /** Two columns from 768px; one below. */
  columns?: 1 | 2;
  className?: string;
}

/** States: populated · empty (renders an honest dash per row). */
export function DefinitionList({ items, columns = 1, className }: DefinitionListProps) {
  return (
    <dl className={cn("dt-dl", columns === 2 && "dt-dl--two", className)}>
      {items.map((item) => (
        <div key={item.term} className="dt-dl__row">
          <dt>{item.term}</dt>
          <dd>{item.description === "" || item.description == null ? "—" : item.description}</dd>
        </div>
      ))}
    </dl>
  );
}

/* -------------------------------------------------------------------- Tabs */

export interface TabItem {
  value: string;
  label: string;
  content: ReactNode;
}

export interface TabsProps {
  items: readonly TabItem[];
  defaultValue?: string;
  label: string;
}

/**
 * The product tabs, drawn by the master tabs.
 *
 * Same Radix engine as before - this is not a behaviour change - but the strip
 * now scrolls instead of wrapping at 320px and the selected tab is carried by
 * surface, weight and border rather than by an underline alone.
 *
 * States: one selected at a time; keyboard arrow navigation via Radix.
 */
export function Tabs({ items, defaultValue, label }: TabsProps) {
  const first = items[0]?.value ?? "";
  return (
    <UiTabs defaultValue={defaultValue ?? first} className="dt-tabs">
      <UiTabsList className="dt-tabs__list" aria-label={label}>
        {items.map((item) => (
          <UiTabsTrigger key={item.value} value={item.value} className="dt-tabs__trigger">
            {item.label}
          </UiTabsTrigger>
        ))}
      </UiTabsList>
      {items.map((item) => (
        <UiTabsContent key={item.value} value={item.value} className="dt-tabs__content">
          {item.content}
        </UiTabsContent>
      ))}
    </UiTabs>
  );
}

/* ------------------------------------------------------------------ Dialog */

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** States: closed · open (focus trapped, Esc closes, focus returns). */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="dt-dialog__overlay" />
        <RadixDialog.Content className="dt-dialog">
          <RadixDialog.Title className="dt-dialog__title">{title}</RadixDialog.Title>
          {description ? (
            <RadixDialog.Description className="dt-dialog__desc">
              {description}
            </RadixDialog.Description>
          ) : null}
          <div className="dt-dialog__body">{children}</div>
          <div className="dt-dialog__foot">
            {footer}
            <RadixDialog.Close asChild>
              <Button variant="secondary">Kapat</Button>
            </RadixDialog.Close>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

/* ----------------------------------------------------------------- Popover */

export interface PopoverProps {
  trigger: ReactNode;
  children: ReactNode;
  label: string;
}

/** States: closed · open. Content is never the only carrier of information. */
export function Popover({ trigger, children, label }: PopoverProps) {
  return (
    <RadixPopover.Root>
      <RadixPopover.Trigger asChild>{trigger}</RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content className="dt-popover" sideOffset={6} aria-label={label}>
          {children}
          <RadixPopover.Arrow className="dt-popover__arrow" />
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}

/* ----------------------------------------------------------------- Tooltip */

export interface TooltipProps {
  content: string;
  children: ReactNode;
}

/**
 * A tooltip is an enhancement, never the only place information lives - it is
 * unreachable on touch and easy to miss. Callers must repeat anything critical
 * in visible text.
 *
 * States: hidden · shown (hover/focus).
 */
export function Tooltip({ content, children }: TooltipProps) {
  return (
    <RadixTooltip.Provider delayDuration={200}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content className="dt-tooltip" sideOffset={6}>
            {content}
            <RadixTooltip.Arrow className="dt-tooltip__arrow" />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}

/* ------------------------------------------------------------------- Toast */

export interface ToastProps {
  message: string;
  tone?: "info" | "success" | "error";
  onDismiss?: () => void;
}

/**
 * Polite live region. "success" here means "the request succeeded", never "you
 * were approved" - the tone token is about the HTTP result only.
 *
 * States: info · success · error · dismissible.
 */
export function Toast({ message, tone = "info", onDismiss }: ToastProps) {
  return (
    <div className={cn("dt-toast", `dt-toast--${tone}`)} role="status" aria-live="polite">
      <span>{message}</span>
      {onDismiss ? <IconButton label="Bildirimi kapat" icon="×" onClick={onDismiss} size="sm" /> : null}
    </div>
  );
}

/* -------------------------------------------------------------- Pagination */

export interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  /** Always true here; the API has no paging parameters. Shown to the user. */
  clientSide?: boolean;
  totalItems?: number;
}

/**
 * Client-side paging, and it says so. The list endpoint returns every record
 * for the tenant with no page parameter, so calling this "server paging" would
 * misrepresent both performance and freshness.
 *
 * States: single-page (hidden) · first · middle · last.
 */
export function Pagination({
  page,
  pageCount,
  onPageChange,
  clientSide = true,
  totalItems,
}: PaginationProps) {
  if (pageCount <= 1) return null;
  return (
    <nav className="dt-pagination" aria-label="Sayfalama">
      <Button
        variant="secondary"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        Önceki
      </Button>
      <span aria-live="polite">
        Sayfa {page} / {pageCount}
        {totalItems !== undefined ? ` — ${totalItems} kayıt` : ""}
      </span>
      <Button
        variant="secondary"
        size="sm"
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
      >
        Sonraki
      </Button>
      {clientSide ? (
        <span className="dt-pagination__note">
          Sayfalama tarayıcıda yapılır; sunucu tüm kayıtları tek seferde döndürür.
        </span>
      ) : null}
    </nav>
  );
}

/* --------------------------------------------------------------- FilterBar */

export interface FilterDefinition {
  id: string;
  label: string;
  options: readonly { value: string; label: string }[];
  value: string;
}

export interface FilterBarProps {
  filters: readonly FilterDefinition[];
  onChange: (id: string, value: string) => void;
  onReset?: () => void;
  resultCount?: number;
}

/** States: idle · active-filters · no-results. */
export function FilterBar({ filters, onChange, onReset, resultCount }: FilterBarProps) {
  const active = filters.filter((filter) => filter.value !== "").length;
  return (
    <div className="dt-filterbar" role="group" aria-label="Filtreler">
      {filters.map((filter) => (
        <div key={filter.id} className="dt-filterbar__item">
          {/*
           * A real `<label for=…>`, and therefore no `label` prop on the
           * control: an `aria-label` would win over the visible text and let
           * the two drift apart. "Tümü" is a genuine option whose wire value is
           * the empty string, not a placeholder - clearing a filter is a choice
           * the person made, and it reads back as one.
           */}
          <label htmlFor={`filter-${filter.id}`}>{filter.label}</label>
          <Select
            id={`filter-${filter.id}`}
            value={filter.value}
            onValueChange={(value) => onChange(filter.id, value)}
            options={[{ value: "", label: "Tümü" }, ...filter.options]}
          />
        </div>
      ))}
      {onReset && active > 0 ? (
        <Button variant="ghost" size="sm" onClick={onReset}>
          Filtreleri temizle
        </Button>
      ) : null}
      {resultCount !== undefined ? (
        <p className="dt-filterbar__count" aria-live="polite">
          {resultCount} sonuç
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------- SearchInput */

export interface SearchInputProps {
  value: string;
  onValueChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  resultCount?: number;
}

/** States: empty · typing · with-results · no-results. */
export function SearchInput({
  value,
  onValueChange,
  label = "Ara",
  placeholder = "Program adı veya kodu",
  resultCount,
}: SearchInputProps) {
  const id = useId();
  return (
    <div className="dt-search">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onValueChange(event.target.value)}
      />
      {resultCount !== undefined ? (
        <p className="dt-visually-hidden" aria-live="polite">
          {resultCount} sonuç bulundu
        </p>
      ) : null}
    </div>
  );
}

/* ----------------------------------------------------------------- Stepper */

export interface StepDefinition {
  id: string;
  label: string;
}

export interface StepperProps {
  steps: readonly StepDefinition[];
  currentIndex: number;
  label?: string;
}

/**
 * States: upcoming · current · complete.
 *
 * The list scrolls sideways, so it has to take focus.
 *
 * At 320px the steps do not fit: measured on `/uygunluk/sihirbaz` at 320x568,
 * `scrollWidth` 362 against a `clientWidth` of 288. A pointer drags it; a
 * keyboard had nothing to hold, because the region carried no `tabindex` and
 * contained no focusable child. axe reports exactly that as
 * `scrollable-region-focusable`, rated serious, and it fired here and on
 * `/onboarding`, which renders the same component.
 *
 * `tabIndex={0}` is the whole fix - a focused scroll container is scrolled by
 * the arrow keys by the browser itself, so nothing here handles keys. What it
 * costs is stated deliberately:
 *
 *  - **It is named and described.** The surrounding `<nav>` names the landmark,
 *    not the box that scrolls, and a focus stop that announces nothing reads as
 *    a dead tab press. The instruction says which keys move it.
 *  - **It stays an `<ol>` with its implicit role.** The steps are numbered and
 *    ordered before they are a scroller.
 *
 * `jsx-a11y/no-noninteractive-tabindex` is suppressed on that one line, and
 * only there. The rule is right in general - a `tabindex` on static text is a
 * focus stop that does nothing - and wrong for a scroll container, which is the
 * documented exception: WCAG 2.1.1 requires the content this box hides to be
 * reachable, and `tabindex` on the container is how the browser's own arrow-key
 * scrolling is reached. The rule and axe disagree here; axe is the one holding
 * the success criterion. The suppression is one line, names the rule, and does
 * not touch the ESLint configuration.
 */
export function Stepper({ steps, currentIndex, label = "Adımlar" }: StepperProps) {
  const instructionsId = useId();
  return (
    <nav aria-label={label} className="dt-stepper">
      <p id={instructionsId} className="dt-visually-hidden">
        Bu adım listesi yatay olarak kaydırılır. Listeye odaklandığınızda sol ve sağ ok
        tuşlarıyla kaydırabilirsiniz.
      </p>
      <ol
        className="dt-stepper__list"
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrollable region must be keyboard reachable (axe scrollable-region-focusable, WCAG 2.1.1)
        tabIndex={0}
        aria-label={`${label} listesi`}
        aria-describedby={instructionsId}
      >
        {steps.map((step, index) => {
          const state =
            index < currentIndex ? "complete" : index === currentIndex ? "current" : "upcoming";
          return (
            <li
              key={step.id}
              className={cn("dt-stepper__item", `dt-stepper__item--${state}`)}
              aria-current={state === "current" ? "step" : undefined}
            >
              <span className="dt-stepper__index" aria-hidden="true">
                {index + 1}
              </span>
              <span>{step.label}</span>
              <span className="dt-visually-hidden">
                {state === "complete"
                  ? " (tamamlandı)"
                  : state === "current"
                    ? " (şu anki adım)"
                    : " (sırada)"}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/* ---------------------------------------------------------------- Timeline */

export interface TimelineEntry {
  id: string;
  title: string;
  timestamp: string;
  detail?: ReactNode;
}

export interface TimelineProps {
  entries: readonly TimelineEntry[];
  emptyMessage?: string;
  label?: string;
}

/** States: populated · empty. */
export function Timeline({ entries, emptyMessage = "Kayıt yok.", label = "Zaman çizelgesi" }: TimelineProps) {
  if (entries.length === 0) return <p className="dt-muted">{emptyMessage}</p>;
  return (
    <ol className="dt-timeline" aria-label={label}>
      {entries.map((entry) => (
        <li key={entry.id} className="dt-timeline__item">
          <div className="dt-timeline__marker" aria-hidden="true" />
          <div className="dt-timeline__body">
            <p className="dt-timeline__title">{entry.title}</p>
            <p className="dt-timeline__time">{entry.timestamp}</p>
            {entry.detail ? <div className="dt-timeline__detail">{entry.detail}</div> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------------------------------------ CopyableHash */

export interface CopyableHashProps {
  value: string;
  label: string;
  /** How many leading characters to show. */
  visibleChars?: number;
}

/**
 * A hash is evidence, so it must be both readable at a glance and copyable in
 * full. The short form is shown; the full value is in the accessible name and
 * on the clipboard.
 *
 * States: idle · copied · copy-unavailable (no clipboard API).
 */
export function CopyableHash({ value, label, visibleChars = 12 }: CopyableHashProps) {
  const [copied, setCopied] = useState(false);
  const short = useMemo(() => value.slice(0, visibleChars), [value, visibleChars]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = useCallback(() => {
    if (!navigator.clipboard) return;
    void navigator.clipboard.writeText(value).then(() => setCopied(true));
  }, [value]);

  return (
    <span className="dt-hash">
      <span className="dt-hash__label">{label}</span>
      <code className="dt-mono" title={value}>
        {short}…
      </code>
      <Button variant="ghost" size="sm" onClick={copy} aria-label={`${label} değerini kopyala: ${value}`}>
        {copied ? "Kopyalandı" : "Kopyala"}
      </Button>
    </span>
  );
}
