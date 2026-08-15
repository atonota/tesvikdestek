/**
 * A field for a value that must not survive being used.
 *
 * The lifecycle is the component. An API key or gateway token typed here lives
 * in one piece of React state, for as long as this field is mounted, and is
 * handed to the caller exactly once:
 *
 *   - masked by default, revealed only by an explicit, announced toggle;
 *   - cleared on submit, on cancel, and on unmount - the unmount case matters
 *     most, because a wizard that is closed mid-flow is the one path a person
 *     never thinks to test;
 *   - never written to browser storage, never put in a URL, never logged, and
 *     never placed in a DOM attribute.
 *
 * That last point is why the input is **uncontrolled**, which is otherwise the
 * wrong default in this codebase. A controlled input means React holds the
 * secret in component state *and* writes it into the element's `value`
 * attribute, so it turns up in `outerHTML`, in a DOM dump, in a devtools state
 * inspection and in anything that serialises the tree. The acceptance suite
 * caught exactly that. Uncontrolled, the value exists in one place - the live
 * DOM node - React state holds only a boolean saying whether the field is
 * empty, and clearing is a direct assignment on the node.
 *   - no copy affordance unless a caller explicitly asks for one, and copying
 *     out of the input is refused in the default (masked) state, because a
 *     "copy key" button is a paste into a chat window waiting to happen.
 *
 * The payload is an `EphemeralSecret`: `oneTimeUse: true` is a literal, not a
 * flag, so a caller reading the type is told what to do with it before they
 * read any documentation.
 *
 * Note what this component does *not* do: it never submits anything anywhere.
 * With no `onSubmit` there is nothing to hand a secret to, and the field says
 * so instead of collecting one that has nowhere to go.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import { Button, FieldError, IconButton, Input, Label } from "../primitives";
import type { EphemeralSecret } from "./types";

export interface SecretFieldProps {
  /** Identifies the value to the caller, so it can be routed without guessing. */
  readonly fieldId: string;
  readonly label: string;
  readonly hint?: string;
  readonly placeholder?: string;
  readonly submitLabel?: string;
  readonly disabled?: boolean;
  /** Shown when disabled. A control that does nothing must say why. */
  readonly disabledReason?: string;
  /**
   * Opt-in copy button. Off by default and deliberately awkward to turn on:
   * the only honest reason to copy a secret out of this field is to move it to
   * a password manager, and that is a decision a caller makes explicitly.
   */
  readonly allowCopy?: boolean;
  readonly onSubmit: (secret: EphemeralSecret) => void;
  readonly onCancel?: () => void;
  /** Fired whenever the value is dropped, including on unmount. */
  readonly onClear?: () => void;
  readonly className?: string;
}

/** States: empty · filled · revealed · disabled · submitted (cleared). */
export function SecretField({
  fieldId,
  label,
  hint,
  placeholder,
  submitLabel = "Sunucuya aktar",
  disabled = false,
  disabledReason,
  allowCopy = false,
  onSubmit,
  onCancel,
  onClear,
  className,
}: SecretFieldProps) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const noteId = `${inputId}-note`;
  /** The live DOM node is the only place the value exists. */
  const inputRef = useRef<HTMLInputElement | null>(null);
  /** State holds whether there is a value, never the value. */
  const [filled, setFilled] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * The clear callback is held in a ref so the unmount effect can stay
   * dependency-free. An effect that re-runs when a caller passes a fresh arrow
   * function would fire "cleared" on every render, which is noise the caller
   * would learn to ignore - and an ignored security signal is worse than none.
   */
  const onClearRef = useRef(onClear);
  // Kept current in an effect rather than during render: a ref written while
  // rendering is a value React is allowed to discard, and this one has to
  // survive to the unmount below.
  useEffect(() => {
    onClearRef.current = onClear;
  });

  useEffect(() => {
    return () => {
      onClearRef.current?.();
    };
  }, []);

  const clear = useCallback(() => {
    if (inputRef.current) inputRef.current.value = "";
    setFilled(false);
    setRevealed(false);
    onClearRef.current?.();
  }, []);

  const submit = () => {
    const value = inputRef.current?.value ?? "";
    if (value.length === 0) {
      setError("Değer boş; aktarılacak bir şey yok.");
      return;
    }
    setError(null);
    // Read before clearing: the handoff must not race the wipe below.
    const secret: EphemeralSecret = { value, oneTimeUse: true, fieldId };
    clear();
    onSubmit(secret);
  };

  const cancel = () => {
    setError(null);
    clear();
    onCancel?.();
  };

  const copy = () => {
    // Only reachable when a caller opted in *and* the operator has revealed the
    // value, so nothing is copied out of a field the person cannot see.
    void navigator.clipboard?.writeText(inputRef.current?.value ?? "");
  };

  return (
    <div className={cn("dt-secret", className)}>
      <Label htmlFor={inputId} required {...(hint ? { hint } : {})}>
        {label}
      </Label>

      <div className="dt-secret__row">
        <Input
          id={inputId}
          ref={inputRef}
          type={revealed ? "text" : "password"}
          disabled={disabled}
          placeholder={placeholder ?? "•••••••••••••••"}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-describedby={`${noteId}${error ? ` ${errorId}` : ""}`}
          invalid={error !== null}
          onChange={(event) => setFilled(event.target.value.length > 0)}
          onCopy={(event) => {
            // A masked field that can still be copied is masked in appearance
            // only. Revealing first is a deliberate act; this is not.
            if (!allowCopy || !revealed) event.preventDefault();
          }}
        />
        <IconButton
          label={revealed ? "Değeri gizle" : "Değeri göster"}
          aria-pressed={revealed}
          disabled={disabled}
          icon={revealed ? "🙈" : "👁"}
          onClick={() => setRevealed((current) => !current)}
        />
        {allowCopy ? (
          <IconButton
            label="Değeri kopyala"
            icon="⧉"
            disabled={disabled || !revealed || !filled}
            onClick={copy}
          />
        ) : null}
      </div>

      <p id={noteId} className="dt-muted">
        Bu değer yalnızca bu alan ekrandayken bellekte tutulur. Gönderildiğinde, vazgeçildiğinde ya
        da ekran kapandığında silinir; tarayıcıya, adrese ya da kayıtlara hiçbir kopyası yazılmaz.
      </p>

      <FieldError id={errorId}>{error}</FieldError>

      <div className="dt-secret__actions">
        <Button onClick={submit} disabled={disabled}>
          {submitLabel}
        </Button>
        <Button variant="ghost" onClick={cancel} disabled={disabled}>
          Vazgeç
        </Button>
      </div>

      {disabled ? (
        <p className="dt-secret__blocked" role="note">
          {disabledReason ?? "Bu alan devralınmadı; girilen bir değeri iletecek bir uç yok."}
        </p>
      ) : null}
    </div>
  );
}
