/**
 * One select that looks the same on every platform.
 *
 * A native `<select>` is not themeable in any meaningful way, and the five
 * platforms this product runs on disagree about what it is: macOS draws a
 * popover, Windows a drop list, Android and iOS a full-screen wheel, and each
 * picks its own font size - below this product's 1rem floor on at least two of
 * them. An enterprise filter bar whose controls change shape per operating
 * system is not one product, so the control is drawn here instead.
 *
 * Drawing it yourself means owing back everything the native control gave you
 * for free: an accessible name, `combobox` semantics, keyboard operation,
 * type-ahead, focus management and a scroll-safe popover. That is why this is
 * built on `@radix-ui/react-select` - the same vendor as the dialog, popover,
 * tabs and tooltip already in this codebase - rather than on a `<div>` with a
 * click handler, which is how custom selects usually end up unusable.
 *
 * **It lives here, not in `components/forms/`.** The tri-state primitive and
 * the filter bar both need it, and `forms/fields.tsx` imports the primitives.
 * Leaving the control inside the form layer would have made
 * `primitives → forms → primitives` a real cycle. This module is the neutral
 * floor: it imports one vendor package and the class joiner, and nothing else
 * in this codebase. `components/forms/Select.ts` re-exports it unchanged, so
 * every existing import path still resolves.
 *
 * Two behaviours are load-bearing and are pinned in `select.test.tsx`.
 *
 * **It is controlled, including at the empty value.** An earlier version
 * *omitted* the `value` prop when the value was `""`, reasoning that Radix
 * treats an absent value as "nothing selected". It does - and it also makes the
 * control uncontrolled, so Radix started moving the display on its own and a
 * caller that rejected a change still saw the new label on the trigger. Radix's
 * own `shouldShowPlaceholder` is `value === "" || value === undefined`, so
 * passing `""` straight through keeps the placeholder *and* keeps the control
 * controlled. There is no case where the prop is dropped.
 *
 * **An empty string can also be a real choice.** `""` is this product's wire
 * value for "bilinmiyor" on a tri-state fact and for "Tümü" on a filter, but
 * Radix refuses an `Item` whose value is `""`. So when - and only when - the
 * caller supplies an option whose value is `""`, that option is encoded to an
 * internal sentinel on the way in and decoded on the way out. The caller never
 * sees the sentinel, and the distinction between "no selection" and "the empty
 * choice" survives.
 */

import * as RadixSelect from "@radix-ui/react-select";

import { cn } from "@/lib/cn";

export interface SelectOption {
  readonly value: string;
  readonly label: string;
  /** Secondary line inside the option. Never the only carrier of meaning. */
  readonly description?: string;
  readonly disabled?: boolean;
  /** Why it is disabled. Rendered, because a dead row teaches nothing. */
  readonly disabledReason?: string;
}

export interface SelectProps {
  /**
   * The accessible name, when the caller has no `<label for=…>` to point at
   * the trigger. Optional precisely because `FormField` and `FilterBar` do
   * render a real label element, and an `aria-label` would silently win over
   * it - leaving the visible text and the announced name free to drift apart.
   */
  readonly label?: string;
  /**
   * The id of the element whose text *is* the name - a visible `<label>`.
   *
   * Preferred over `label` wherever a label element exists. `aria-label` wins
   * over everything else in the accessible-name calculation, so passing both
   * leaves the visible words and the announced ones free to drift apart: edit
   * the label and the control keeps announcing the old name. Passing this
   * instead makes the visible text the single source of the name, which is the
   * only arrangement that cannot rot.
   */
  readonly labelledBy?: string;
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly options: readonly SelectOption[];
  readonly placeholder?: string;
  readonly invalid?: boolean;
  readonly disabled?: boolean;
  readonly describedBy?: string;
  readonly name?: string;
  readonly id?: string;
  readonly className?: string;
}

/**
 * The stand-in for `""` inside Radix.
 *
 * Deliberately not a value any wire format could produce: the whole point is
 * that it can never collide with a real option, and that it never escapes this
 * module.
 *
 * The leading NUL is written as the escape `\0` and must stay an escape. As a
 * raw byte it made the whole module binary to Git, grep and `file`, so no diff
 * could display it; `build-contract.test.ts` pins that. The runtime value is
 * unchanged either way.
 */
const EMPTY_VALUE_SENTINEL = "\0dt-empty-option";

/** States: closed · open · selected · placeholder · invalid · disabled. */
export function Select({
  label,
  labelledBy,
  value,
  onValueChange,
  options,
  placeholder = "Seçin",
  invalid = false,
  disabled = false,
  describedBy,
  name,
  id,
  className,
}: SelectProps) {
  const hasEmptyOption = options.some((option) => option.value === "");
  const encode = (raw: string) =>
    hasEmptyOption && raw === "" ? EMPTY_VALUE_SENTINEL : raw;
  const decode = (raw: string) => (raw === EMPTY_VALUE_SENTINEL ? "" : raw);

  return (
    <RadixSelect.Root
      // Always passed, never omitted: omitting it is what made the control
      // uncontrolled at the empty value. `""` is exactly what Radix renders as
      // the placeholder, so nothing is lost by being explicit.
      value={encode(value)}
      onValueChange={(next) => onValueChange(decode(next))}
      disabled={disabled}
      {...(name ? { name } : {})}
    >
      {/*
       * One name, from one place. A control carrying both an `aria-labelledby`
       * and an `aria-label` is a control whose announced name is decided by the
       * specification rather than by the person who wrote the label.
       */}
      <RadixSelect.Trigger
        id={id}
        className={cn("dt-select", invalid && "dt-select--invalid", className)}
        {...(labelledBy ? { "aria-labelledby": labelledBy } : {})}
        {...(labelledBy === undefined && label ? { "aria-label": label } : {})}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
      >
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon className="dt-select__icon" aria-hidden="true">
          ▾
        </RadixSelect.Icon>
      </RadixSelect.Trigger>

      <RadixSelect.Portal>
        <RadixSelect.Content className="dt-select__content" position="popper" sideOffset={4}>
          <RadixSelect.ScrollUpButton className="dt-select__scroll" aria-hidden="true">
            ▴
          </RadixSelect.ScrollUpButton>
          <RadixSelect.Viewport className="dt-select__viewport">
            {options.map((option) => (
              <RadixSelect.Item
                key={option.value}
                value={encode(option.value)}
                disabled={option.disabled === true}
                className="dt-select__option"
              >
                <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                {option.description ? (
                  <span className="dt-select__option-desc">{option.description}</span>
                ) : null}
                {option.disabled && option.disabledReason ? (
                  <span className="dt-select__option-desc">{option.disabledReason}</span>
                ) : null}
                <RadixSelect.ItemIndicator className="dt-select__indicator" aria-hidden="true">
                  ✓
                </RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
          <RadixSelect.ScrollDownButton className="dt-select__scroll" aria-hidden="true">
            ▾
          </RadixSelect.ScrollDownButton>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
