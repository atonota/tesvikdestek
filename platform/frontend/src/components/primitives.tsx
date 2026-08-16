/**
 * Level 1 - primitives (14).
 *
 * Every one of these is a real element with real semantics. The rule at this
 * level: a primitive never invents an accessible name, never hides a state it
 * has, and never uses colour as the only signal.
 *
 * Documented states per component are listed in the JSDoc above it, and each
 * has stories in `primitives.stories.tsx`.
 */

import {
  forwardRef,
  useId,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { Link as RouterLink } from "react-router";

import { cn } from "@/lib/cn";
import { TRISTATE_CHOICES, type Tristate } from "@/domain/tristate";
import { Select } from "./select";
import { badgeVariants } from "./ui/badge";
import { buttonVariants } from "./ui/button";

/* ------------------------------------------------------------------ Button */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner, sets aria-busy and blocks the click. */
  loading?: boolean;
  /** Announced while loading, so the label change is not silent. */
  loadingLabel?: string;
  fullWidth?: boolean;
}

/**
 * The product button, drawn by the master button's recipe.
 *
 * This is the derivation that makes the design-system adoption real rather than
 * announced. Roughly forty call sites across every authenticated route import
 * *this* component; a master layer sitting beside it, rendered by one new
 * screen, would leave the product looking exactly as it did. So the appearance
 * comes from `buttonVariants` - Tailwind utilities, `cva`, the shadcn/ui
 * contract - while the API, the loading behaviour and the `dt-btn` class hooks
 * stay exactly as they were.
 *
 * **Both class sets are emitted, and that is deliberate.** The `dt-*` classes
 * are load-bearing beyond styling: `demo-login.test.tsx` asserts
 * `dt-btn--block`, the browser suite counts `.dt-btn--primary` to prove there is
 * one primary action per screen, and `AdaptiveShell` styles a router link as a
 * button by writing the classes directly. Deleting them would break behaviour
 * this package never agreed to change. They cost nothing visually, because the
 * bespoke rules live in `@layer components` and Tailwind's utilities live in
 * `@layer utilities` - later layer wins regardless of specificity, so the
 * master recipe is what paints.
 *
 * One visible consequence, and it is a correction rather than a side effect:
 * the primary button was painted with `--dt-color-accent`, not with
 * `--dt-color-primary`. The brand contract says the primary is parliament blue.
 * It now is, on every screen at once.
 *
 * States: idle · hover · focus-visible · active · loading · disabled.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    loadingLabel = "İşleniyor",
    fullWidth = false,
    disabled,
    children,
    className,
    type = "button",
    ...rest
  },
  ref,
) {
  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      data-slot="button"
      className={cn(
        buttonVariants({ variant, size, block: fullWidth }),
        "dt-btn",
        `dt-btn--${variant}`,
        `dt-btn--${size}`,
        fullWidth && "dt-btn--block",
        className,
      )}
      disabled={disabled === true || loading}
      aria-busy={loading || undefined}
    >
      {loading ? (
        <>
          <span className="dt-spinner" aria-hidden="true" />
          <span>{loadingLabel}…</span>
        </>
      ) : (
        children
      )}
    </button>
  );
});

/* -------------------------------------------------------------- IconButton */

export interface IconButtonProps extends Omit<ButtonProps, "children"> {
  /** Required. An icon-only control with no name is invisible to screen readers. */
  label: string;
  icon: ReactNode;
}

/** States: idle · hover · focus-visible · active · disabled · pressed. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, variant = "ghost", size = "md", className, ...rest },
  ref,
) {
  return (
    <button
      {...rest}
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      data-slot="icon-button"
      className={cn(
        // The master recipe's `icon` size is the 44px touch target the product
        // owes a thumb; the caller's `size` still drives the bespoke class so
        // nothing that styles on it changes meaning.
        buttonVariants({ variant, size: "icon" }),
        "dt-btn",
        "dt-icon-btn",
        `dt-btn--${variant}`,
        `dt-btn--${size}`,
        className,
      )}
    >
      <span aria-hidden="true">{icon}</span>
    </button>
  );
});

/* ------------------------------------------------------------------- Input */

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

/** States: idle · focus · filled · invalid · disabled · readonly. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid = false, className, ...rest },
  ref,
) {
  return (
    <input
      {...rest}
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn("dt-input", invalid && "dt-input--invalid", className)}
    />
  );
});

/* -------------------------------------------------------------- NumberInput */

export interface NumberInputProps extends Omit<InputProps, "type" | "inputMode"> {
  /** Rendered after the field for context, e.g. "kişi", "TL". */
  suffix?: string;
}

/**
 * Turkish keyboards and thousands separators: the field stays `type="text"`
 * with a numeric inputMode so the browser does not localise the value behind
 * our back, and the caller controls parsing.
 *
 * States: idle · focus · filled · invalid · disabled.
 */
export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(function NumberInput(
  { suffix, invalid = false, className, ...rest },
  ref,
) {
  return (
    <span className="dt-number-input">
      <input
        {...rest}
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-invalid={invalid || undefined}
        className={cn("dt-input", invalid && "dt-input--invalid", className)}
      />
      {suffix ? (
        <span className="dt-number-input__suffix" aria-hidden="true">
          {suffix}
        </span>
      ) : null}
    </span>
  );
});

/* ----------------------------------------------------------- TristateSelect */

export interface TristateSelectProps {
  value: Tristate;
  onValueChange: (value: Tristate) => void;
  invalid?: boolean;
  disabled?: boolean;
  id?: string;
  /** Only when there is no `<label for=…>`; an aria-label would beat one. */
  "aria-label"?: string;
  "aria-describedby"?: string;
  className?: string;
}

/**
 * The domain-critical primitive.
 *
 * "Bilinmiyor" is first and is the default. An unanswered question must never
 * serialise as "Hayır": the engine treats absence as UNKNOWN, and collapsing it
 * into a "no" is what tells a company it is ineligible for money it could have
 * had.
 *
 * It is drawn on the shared `Select`, not on a native `<select>`. The wire
 * value for "Bilinmiyor" is the empty string, which the shared control encodes
 * internally so it can be a real, selectable option rather than a placeholder -
 * the distinction the entire tri-state vocabulary rests on.
 *
 * States: unknown (default) · yes · no · invalid · disabled.
 */
export function TristateSelect({
  value,
  onValueChange,
  invalid = false,
  disabled = false,
  id,
  className,
  ...aria
}: TristateSelectProps) {
  const label = aria["aria-label"];
  const describedBy = aria["aria-describedby"];
  return (
    <Select
      {...(id ? { id } : {})}
      {...(label ? { label } : {})}
      {...(describedBy ? { describedBy } : {})}
      {...(className ? { className } : {})}
      value={value}
      onValueChange={(next) => onValueChange(next as Tristate)}
      options={TRISTATE_CHOICES.map((choice) => ({ value: choice.value, label: choice.label }))}
      invalid={invalid}
      disabled={disabled}
    />
  );
}

/* ---------------------------------------------------------------- Textarea */

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

/** States: idle · focus · filled · invalid · disabled. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid = false, className, rows = 4, ...rest },
  ref,
) {
  return (
    <textarea
      {...rest}
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn("dt-input", "dt-textarea", invalid && "dt-input--invalid", className)}
    />
  );
});

/* ---------------------------------------------------------------- Checkbox */

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: ReactNode;
  description?: string;
}

/** States: unchecked · checked · focus · disabled. */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, description, className, id, ...rest },
  ref,
) {
  const generated = useId();
  const inputId = id ?? generated;
  const descriptionId = description ? `${inputId}-desc` : undefined;
  return (
    <div className={cn("dt-choice", className)}>
      <input
        {...rest}
        ref={ref}
        id={inputId}
        type="checkbox"
        aria-describedby={descriptionId}
        className="dt-choice__control"
      />
      <span className="dt-choice__text">
        <label htmlFor={inputId}>{label}</label>
        {description ? (
          <span id={descriptionId} className="dt-choice__desc">
            {description}
          </span>
        ) : null}
      </span>
    </div>
  );
});

/* -------------------------------------------------------------- RadioGroup */

export interface RadioOption {
  value: string;
  label: string;
  description?: string;
}

export interface RadioGroupProps {
  name: string;
  legend: string;
  options: readonly RadioOption[];
  value: string;
  onValueChange: (value: string) => void;
  describedBy?: string;
  disabled?: boolean;
}

/** States: unselected · selected · focus · disabled. */
export function RadioGroup({
  name,
  legend,
  options,
  value,
  onValueChange,
  describedBy,
  disabled = false,
}: RadioGroupProps) {
  return (
    <fieldset className="dt-radiogroup" aria-describedby={describedBy} disabled={disabled}>
      <legend className="dt-radiogroup__legend">{legend}</legend>
      {options.map((option) => {
        const id = `${name}-${option.value || "unknown"}`;
        return (
          <div key={id} className="dt-choice">
            <input
              id={id}
              className="dt-choice__control"
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onValueChange(option.value)}
            />
            <span className="dt-choice__text">
              <label htmlFor={id}>{option.label}</label>
              {option.description ? (
                <span className="dt-choice__desc">{option.description}</span>
              ) : null}
            </span>
          </div>
        );
      })}
    </fieldset>
  );
}

/* ------------------------------------------------------------------ Switch */

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  id?: string;
}

/**
 * A real checkbox with `role="switch"` rather than a div: it stays keyboard
 * operable and form-associable for free.
 *
 * States: off · on · focus · disabled.
 */
export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  disabled = false,
  id,
}: SwitchProps) {
  const generated = useId();
  const inputId = id ?? generated;
  const descriptionId = description ? `${inputId}-desc` : undefined;
  return (
    <div className="dt-switch">
      <input
        id={inputId}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        aria-describedby={descriptionId}
        onChange={(event) => onCheckedChange(event.target.checked)}
        className="dt-switch__control"
      />
      <span className="dt-choice__text">
        <label htmlFor={inputId}>{label}</label>
        {description ? (
          <span id={descriptionId} className="dt-choice__desc">
            {description}
          </span>
        ) : null}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------- Label */

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
  /** Shown next to the label; used for "sunucudan okunamıyor" style notes. */
  hint?: string;
  /**
   * Id for the element carrying the label *text*.
   *
   * A `<label for=…>` names a labelable element; a custom control drawn on a
   * `<button>` is not one, so it has to be named with `aria-labelledby` - and
   * `aria-labelledby` needs an id on the words themselves, not on the whole
   * label. Pointing at the label element would fold the required marker and the
   * hint into the announced name.
   */
  textId?: string | undefined;
  /**
   * Id for the hint.
   *
   * A field that lists a hint id in its `aria-describedby` while no element in
   * the document carries that id has, in practice, no description at all: the
   * reference resolves to nothing and the screen reader announces nothing.
   */
  hintId?: string | undefined;
}

/** States: default · required · with-hint. */
export function Label({
  required = false,
  hint,
  textId,
  hintId,
  children,
  className,
  ...rest
}: LabelProps) {
  return (
    <label {...rest} className={cn("dt-label", className)}>
      <span {...(textId ? { id: textId } : {})}>{children}</span>
      {required ? (
        <span className="dt-label__required" aria-hidden="true">
          *
        </span>
      ) : null}
      {required ? <span className="dt-visually-hidden">(zorunlu)</span> : null}
      {hint ? (
        <span {...(hintId ? { id: hintId } : {})} className="dt-label__hint">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

/* -------------------------------------------------------------- FieldError */

export interface FieldErrorProps {
  id: string;
  children?: ReactNode;
}

/**
 * Errors are announced, not just coloured.
 *
 * States: empty (renders nothing) · error.
 */
export function FieldError({ id, children }: FieldErrorProps) {
  if (!children) return null;
  return (
    <p id={id} className="dt-field-error" role="alert">
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------- Badge */

export type BadgeTone =
  | "neutral"
  | "accent"
  | "candidate"
  | "ineligible"
  | "conditional"
  | "insufficient"
  | "warning";

export interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  /** Extra context for screen readers, e.g. the outcome description. */
  srDescription?: string | undefined;
  className?: string;
}

/**
 * The product badge, drawn by the master badge's recipe.
 *
 * Same derivation as `Button`, and the same reason: this is the badge every
 * outcome, every review status and every call window on every screen renders,
 * so it is where the design system either arrives or does not. The `dt-badge`
 * classes stay because the browser suite locates badges by them.
 *
 * States: one per tone. Colour is never the only carrier - text always shows,
 * and `srDescription` carries what the colour means to a screen reader.
 */
export function Badge({ tone = "neutral", children, srDescription, className }: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ tone }), "dt-badge", `dt-badge--${tone}`, className)}
    >
      {children}
      {srDescription ? <span className="dt-visually-hidden"> — {srDescription}</span> : null}
    </span>
  );
}

/* -------------------------------------------------------------------- Link */

export interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  to?: string;
  external?: boolean;
}

/**
 * Internal links route; external links say so, both visually and to a screen
 * reader, and carry `rel="noreferrer"`.
 *
 * States: internal · external · disabled-looking (via aria-disabled).
 */
export function Link({ to, external = false, children, className, href, ...rest }: LinkProps) {
  if (to && !external) {
    return (
      <RouterLink to={to} className={cn("dt-link", className)} {...rest}>
        {children}
      </RouterLink>
    );
  }
  return (
    <a
      {...rest}
      href={href ?? to}
      className={cn("dt-link", className)}
      {...(external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
    >
      {children}
      {external ? (
        <>
          <span aria-hidden="true"> ↗</span>
          <span className="dt-visually-hidden"> (yeni sekmede açılır)</span>
        </>
      ) : null}
    </a>
  );
}

/* ---------------------------------------------------------- VisuallyHidden */

export interface VisuallyHiddenProps {
  children: ReactNode;
  /** Render as a different element when the context needs it. */
  as?: "span" | "div" | "h2";
}

/** States: always hidden visually, always present in the accessibility tree. */
export function VisuallyHidden({ children, as: Tag = "span" }: VisuallyHiddenProps) {
  return <Tag className="dt-visually-hidden">{children}</Tag>;
}
