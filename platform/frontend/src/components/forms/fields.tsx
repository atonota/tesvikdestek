/**
 * The form layer, on react-hook-form.
 *
 * `react-hook-form` and `@hookform/resolvers` were dependencies of this package
 * that nothing outside this directory called: registration, login, the company
 * profile, the eligibility wizard and the approval note were all hand-rolled
 * `useState` with a bare `<form onSubmit>`. That is not a style preference:
 * hand-rolled forms are where "submit fired with an empty required field" and
 * "the error was red but never announced" come from, and both are failures a
 * person only discovers after they have lost their work. Every one of those
 * five now goes through this layer, and
 * `test/platform-controls-contract.test.ts` fails if a template grows a
 * `<form>` of its own again.
 *
 * What this layer guarantees, and what the tests next door pin:
 *
 *  - `onValid` receives the *typed* values and is never called while any field
 *    is invalid, and those values are what the caller submits - see
 *    `test/form-data-flow.test.tsx`;
 *  - every error is a `role="alert"` wired to its field through
 *    `aria-describedby`, so a screen reader reads the field and its problem
 *    together rather than announcing a colour;
 *  - every id a field points at with `aria-describedby` exists and carries
 *    text;
 *  - the accessible name of a field is the visible label, and only the visible
 *    label;
 *  - `aria-invalid` is set on the control itself, not on a wrapper.
 *
 * Validation rules are declared per field rather than in a schema object here.
 * A zod resolver is available and appropriate the moment a form needs
 * cross-field rules; until then, the rules live next to the label they belong
 * to, where the person editing the label will see them.
 *
 * There is deliberately **no** per-field change callback. One existed, so that
 * the profile and the wizard could keep their own copy of the answers, and the
 * copy - not the validated form state - was what the routes POSTed. Two stores
 * for one set of answers is a race with a wrong answer in it: react-hook-form
 * decided whether the values were valid while a different object decided what
 * was sent. The form is now the only store, the summary reads it through
 * `useWatch`, and the submitted object is the validated one.
 */

import { useId, type ReactNode } from "react";
import {
  Controller,
  FormProvider,
  useForm,
  useFormContext,
  useWatch,
  type FieldValues,
  type SubmitHandler,
} from "react-hook-form";

import { cn } from "@/lib/cn";
import { Button, FieldError, Input, Label, NumberInput, Textarea } from "../primitives";
import { Select } from "../select";

/* ------------------------------------------------------------------- form */

export interface AppFormProps<TValues extends FieldValues> {
  readonly defaultValues: TValues;
  /** Called only when every field passes. Receives what the user typed. */
  readonly onValid: SubmitHandler<TValues>;
  readonly children: ReactNode;
  /** Required: a form landmark with no name is unnavigable. */
  readonly label: string;
  readonly submitLabel?: string;
  readonly busy?: boolean;
  readonly footer?: ReactNode;
  /** A full-width submit, for the single-column authentication card. */
  readonly submitFullWidth?: boolean;
  /**
   * Hide the submit button without hiding the form.
   *
   * The wizard's early steps have no submission to offer - "İleri" moves a
   * step, it does not save anything - and a submit button that is really a
   * navigation control is how a half-answered form gets posted.
   */
  readonly showSubmit?: boolean;
  readonly className?: string;
}

/**
 * States: pristine · dirty · submitting · invalid · submitted.
 *
 * `mode: "onTouched"` is deliberate. Validating on every keystroke marks a
 * field invalid while the person is still typing the first character of a
 * perfectly good answer, which teaches them to ignore the error styling.
 */
export function AppForm<TValues extends FieldValues>({
  defaultValues,
  onValid,
  children,
  label,
  submitLabel = "Kaydet",
  busy = false,
  footer,
  submitFullWidth = false,
  showSubmit = true,
  className,
}: AppFormProps<TValues>) {
  const form = useForm<TValues>({ defaultValues: defaultValues as never, mode: "onTouched" });

  return (
    <FormProvider {...form}>
      <form
        aria-label={label}
        noValidate
        className={cn("dt-form", className)}
        onSubmit={(event) => {
          void form.handleSubmit(onValid)(event);
        }}
      >
        <div className="dt-form__fields">{children}</div>
        <div className="dt-form__actions">
          {showSubmit ? (
            <Button
              type="submit"
              loading={busy || form.formState.isSubmitting}
              fullWidth={submitFullWidth}
            >
              {submitLabel}
            </Button>
          ) : null}
          {footer}
        </div>
      </form>
    </FormProvider>
  );
}

/**
 * The live values of the surrounding `AppForm`.
 *
 * For the one legitimate reason a template needs them before submission: the
 * wizard's summary step counts how many facts have been answered. It reads the
 * form rather than a copy of the form, so the count on screen and the object
 * that is submitted cannot disagree - which is exactly what the second store
 * this replaced could do.
 *
 * `react-hook-form` stays inside this directory. A template reaching for
 * `useWatch` itself would put the vendor back in the layer above.
 */
export function useFormValues<TValues extends FieldValues>(): TValues {
  const form = useFormContext<TValues>();
  return useWatch({ control: form.control }) as TValues;
}

/* ------------------------------------------------------------------ text */

export interface TextFieldProps {
  readonly name: string;
  readonly label: string;
  readonly required?: boolean;
  readonly hint?: string;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly multiline?: boolean;
  readonly rows?: number;
  readonly placeholder?: string;
  /**
   * `numeric` renders the `NumberInput` primitive: `type="text"` with a numeric
   * inputMode, so the browser does not localise a Turkish-formatted number
   * behind our back and the caller keeps control of parsing.
   */
  readonly numeric?: boolean;
  readonly type?: "text" | "email" | "password";
  readonly autoComplete?: string;
}

/** States: idle · focus · filled · invalid · disabled. */
export function TextField({
  name,
  label,
  required = false,
  hint,
  minLength,
  maxLength,
  multiline = false,
  rows = 4,
  placeholder,
  numeric = false,
  type = "text",
  autoComplete,
}: TextFieldProps) {
  const form = useFormContext();
  const generated = useId();
  const fieldId = `${generated}-${name}`;
  const errorId = `${fieldId}-error`;
  const hintId = hint ? `${fieldId}-hint` : undefined;

  const message = form.formState.errors[name]?.message;
  const error = typeof message === "string" ? message : undefined;

  const registration = form.register(name, {
    ...(required ? { required: "Bu alan zorunludur." } : {}),
    ...(minLength
      ? { minLength: { value: minLength, message: `En az ${minLength} karakter girin.` } }
      : {}),
    ...(maxLength
      ? { maxLength: { value: maxLength, message: `En fazla ${maxLength} karakter girin.` } }
      : {}),
  });

  const shared = {
    id: fieldId,
    invalid: error !== undefined,
    "aria-describedby": [hintId, error ? errorId : undefined].filter(Boolean).join(" ") || undefined,
    ...(placeholder ? { placeholder } : {}),
    ...(autoComplete ? { autoComplete } : {}),
    ...registration,
  } as const;

  return (
    <div className="dt-form__field">
      <Label
        htmlFor={fieldId}
        required={required}
        {...(hint ? { hint, hintId } : {})}
      >
        {label}
      </Label>
      {multiline ? (
        <Textarea rows={rows} {...shared} />
      ) : numeric ? (
        <NumberInput {...shared} />
      ) : (
        <Input type={type} {...shared} />
      )}
      <FieldError id={errorId}>{error}</FieldError>
    </div>
  );
}

/* ---------------------------------------------------------------- select */

export interface SelectFieldOption {
  readonly value: string;
  readonly label: string;
  readonly description?: string;
  readonly disabled?: boolean;
}

export interface SelectFieldProps {
  readonly name: string;
  readonly label: string;
  readonly options: readonly SelectFieldOption[];
  readonly required?: boolean;
  readonly placeholder?: string;
  readonly hint?: string;
}

/**
 * A select bound to the form, through `Controller` rather than `register`.
 *
 * The custom select is not a native input and has no `ref` to hand to
 * `register`; `Controller` is how react-hook-form adopts a controlled
 * component without either side inventing its own copy of the value.
 */
export function SelectField({
  name,
  label,
  options,
  required = false,
  placeholder = "Seçin",
  hint,
}: SelectFieldProps) {
  const form = useFormContext();
  const generated = useId();
  const fieldId = `${generated}-${name}`;
  const labelId = `${fieldId}-label`;
  const errorId = `${fieldId}-error`;
  const hintId = hint ? `${fieldId}-hint` : undefined;

  return (
    <Controller
      control={form.control}
      name={name}
      rules={required ? { required: "Bir seçim yapın." } : {}}
      render={({ field, fieldState }) => (
        <div className="dt-form__field">
          <Label
            htmlFor={fieldId}
            required={required}
            textId={labelId}
            {...(hint ? { hint, hintId } : {})}
          >
            {label}
          </Label>
          <Select
            id={fieldId}
            labelledBy={labelId}
            value={(field.value as string | undefined) ?? ""}
            onValueChange={(value) => {
              field.onChange(value);
            }}
            options={options}
            placeholder={placeholder}
            invalid={fieldState.error !== undefined}
            {...(() => {
              const describedBy = [hintId, fieldState.error ? errorId : undefined]
                .filter(Boolean)
                .join(" ");
              return describedBy ? { describedBy } : {};
            })()}
          />
          <FieldError id={errorId}>{fieldState.error?.message}</FieldError>
        </div>
      )}
    />
  );
}
