/**
 * The twelve company profile facts, mirroring `delivery/forms.py`.
 *
 * The backend has no endpoint that reads these back (verified: no profile GET
 * in `routers/api.py`), which is why every surface that edits them must say so
 * rather than pretending the blank form is the stored truth.
 */

import { TRISTATE_UNKNOWN, type Tristate } from "./tristate";

export type FactKind = "tristate" | "integer" | "text";

export interface FactDefinition {
  readonly name: string;
  readonly label: string;
  readonly kind: FactKind;
  readonly help?: string;
  readonly min?: number;
  readonly max?: number;
  readonly placeholder?: string;
}

export const BOOLEAN_FACTS: readonly FactDefinition[] = [
  {
    name: "is_capital_company",
    label: "Sermaye şirketi mi?",
    kind: "tristate",
    help: "Anonim veya limited şirket ise Evet.",
  },
  {
    name: "is_resident_in_turkey",
    label: "Türkiye'de yerleşik mi?",
    kind: "tristate",
  },
  {
    name: "sme_declaration",
    label: "KOBİ beyanı var mı?",
    kind: "tristate",
    help: "KOBİ vasfına ilişkin güncel beyan.",
  },
  {
    name: "has_previous_tubitak_project",
    label: "Daha önce TÜBİTAK projesi yürütüldü mü?",
    kind: "tristate",
  },
  {
    name: "kosgeb_db_registered",
    label: "KOSGEB veri tabanına kayıtlı mı?",
    kind: "tristate",
  },
  {
    name: "kosgeb_declaration_current",
    label: "KOSGEB beyanı güncel mi?",
    kind: "tristate",
  },
];

export const INTEGER_FACTS: readonly FactDefinition[] = [
  { name: "employee_count", label: "Çalışan sayısı", kind: "integer", min: 0, max: 100000 },
  {
    name: "annual_revenue_try",
    label: "Yıllık net satış hasılatı (TL)",
    kind: "integer",
    min: 0,
    help: "Ticari sırdır; audit kaydına yalnızca alan adı yazılır, değeri yazılmaz.",
  },
  { name: "founded_year", label: "Kuruluş yılı", kind: "integer", min: 1900, max: 2100 },
];

export const TEXT_FACTS: readonly FactDefinition[] = [
  { name: "nace_code", label: "NACE kodu", kind: "text", placeholder: "62.01" },
  { name: "nace_section", label: "NACE bölümü", kind: "text", placeholder: "J" },
  { name: "region_code", label: "Bölge kodu (NUTS)", kind: "text", placeholder: "TR51" },
];

export const ALL_FACTS: readonly FactDefinition[] = [
  ...BOOLEAN_FACTS,
  ...INTEGER_FACTS,
  ...TEXT_FACTS,
];

export const FACT_LABELS: Record<string, string> = Object.fromEntries(
  ALL_FACTS.map((fact) => [fact.name, fact.label]),
);

/** Derived server-side from `founded_year`; never entered directly. */
export const DERIVED_FACT_LABELS: Record<string, string> = {
  company_age_years: "Şirket yaşı (yıl)",
};

export function factLabel(name: string): string {
  return FACT_LABELS[name] ?? DERIVED_FACT_LABELS[name] ?? name;
}

export type ProfileFormValues = {
  display_name: string;
} & Record<string, string | Tristate>;

export function emptyProfileValues(): ProfileFormValues {
  const values: ProfileFormValues = { display_name: "" };
  for (const fact of BOOLEAN_FACTS) values[fact.name] = TRISTATE_UNKNOWN;
  for (const fact of [...INTEGER_FACTS, ...TEXT_FACTS]) values[fact.name] = "";
  return values;
}

/** How many of the twelve facts carry an answer. */
export function answeredFactCount(values: ProfileFormValues): number {
  return ALL_FACTS.filter((fact) => {
    const value = values[fact.name];
    return typeof value === "string" && value.trim() !== "";
  }).length;
}
