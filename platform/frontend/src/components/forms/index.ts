/**
 * The form layer.
 *
 * One accessible select that renders identically on every platform, and
 * react-hook-form bound fields that refuse to submit invalid values.
 *
 * The claim this barrel used to make - that real routes used the layer - was
 * not true when it was written. It is now: registration and login
 * (`/kayit`, `/giris`), the company profile (`/organizasyon/profil`), the
 * eligibility wizard (`/uygunluk/sihirbaz`) and the approval note on every
 * decision route all render `AppForm`. `test/platform-controls-contract.test.ts`
 * is what keeps the sentence honest - it fails if any template grows a `<form>`
 * or a hand-rolled value store of its own.
 *
 * The select itself lives one level up, in `components/select.tsx`: the
 * tri-state primitive and the filter bar both need it, and this directory
 * imports the primitives, so keeping it here would have made
 * `primitives → forms → primitives` a real cycle. `./Select` re-exports it
 * unchanged so every existing import path still resolves.
 */

export { Select } from "./Select";
export type { SelectOption, SelectProps } from "./Select";
export { AppForm, SelectField, TextField, useFormValues } from "./fields";
export type {
  AppFormProps,
  SelectFieldOption,
  SelectFieldProps,
  TextFieldProps,
} from "./fields";
