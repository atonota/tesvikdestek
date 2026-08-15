/**
 * Tri-state facts: yes, no, and "we were never told".
 *
 * This is the single most load-bearing type in the product. `delivery/forms.py`
 * parses `""` as *absent* and the engine turns an absent fact into UNKNOWN, not
 * into `false`. Collapsing the two would tell a company it is ineligible for
 * money it could actually have had - which is precisely the silent failure the
 * whole system exists to prevent.
 */

export const TRISTATE_UNKNOWN = "" as const;
export const TRISTATE_YES = "true" as const;
export const TRISTATE_NO = "false" as const;

export type Tristate = typeof TRISTATE_UNKNOWN | typeof TRISTATE_YES | typeof TRISTATE_NO;

export const TRISTATE_VALUES: readonly Tristate[] = [
  TRISTATE_UNKNOWN,
  TRISTATE_YES,
  TRISTATE_NO,
];

/** Order matters: "Bilinmiyor" is first because it is the honest default. */
export const TRISTATE_CHOICES: readonly { value: Tristate; label: string }[] = [
  { value: TRISTATE_UNKNOWN, label: "Bilinmiyor" },
  { value: TRISTATE_YES, label: "Evet" },
  { value: TRISTATE_NO, label: "Hayır" },
];

export function isTristate(value: unknown): value is Tristate {
  return value === TRISTATE_UNKNOWN || value === TRISTATE_YES || value === TRISTATE_NO;
}

/** The exact wire value `delivery/forms.py` expects. Unknown stays empty. */
export function serialiseTristate(value: Tristate): string {
  return value;
}

export function parseTristate(raw: string | undefined | null): Tristate {
  if (raw === TRISTATE_YES || raw === TRISTATE_NO) return raw;
  return TRISTATE_UNKNOWN;
}

/** `false` is an answer. Empty is not. */
export function isAnswered(value: Tristate): boolean {
  return value !== TRISTATE_UNKNOWN;
}

export function tristateLabel(value: Tristate): string {
  return TRISTATE_CHOICES.find((choice) => choice.value === value)?.label ?? "Bilinmiyor";
}
