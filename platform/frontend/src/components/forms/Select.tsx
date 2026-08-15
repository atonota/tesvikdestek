/**
 * Compatibility surface for the platform-identical select.
 *
 * The control itself moved to `components/select.tsx`. It had to: the tri-state
 * primitive and the filter bar both needed it, and `forms/fields.tsx` imports
 * the primitives, so leaving it here would have made `primitives → forms →
 * primitives` a genuine import cycle rather than a diagram.
 *
 * This file stays so that `@/components/forms/Select` keeps resolving for every
 * existing caller and test. It adds nothing and hides nothing - the
 * documentation of the control's two load-bearing behaviours lives with the
 * implementation, next to the code that has to honour them.
 */

export { Select } from "../select";
export type { SelectOption, SelectProps } from "../select";
