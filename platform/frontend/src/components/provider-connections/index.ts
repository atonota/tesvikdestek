/**
 * The provider connection centre.
 *
 * One coherent public surface for connecting Gemini, OpenAI/ChatGPT, Claude and
 * OpenClaw. Like the data grid and the media library, it is one subsystem with
 * a stable contract rather than a dozen more named parts, and it is deliberately
 * outside the 75-component registry.
 *
 * **It is not re-exported from `@/components`, and that is deliberate.** The
 * media subsystem is, and the measurement in `src/test/build-contract.test.ts`
 * records what that costs: every route imports the shared barrel, so anything
 * re-exported from it lands in the production bundle whether or not a route
 * renders it. That lesson was learned about a 4.7 kB stylesheet; this subsystem
 * is considerably larger, so shipping it to every user would be the same
 * mistake at a larger size.
 *
 * **There is a product route: `/ayarlar/yapay-zeka`, in
 * `src/routes/providers.tsx`.** The sentence this comment used to carry - that
 * the subsystem had none - stopped being true when that route arrived, and the
 * rule it stood for did not change: the route reaches this barrel by its own
 * path rather than through `@/components`, so both the JavaScript and the
 * stylesheet stay out of what every signed-in visitor downloads.
 * `build-contract.test.ts` checks that against the built entry chunk.
 *
 * What has *not* changed is the backend: no credential store, no OAuth broker,
 * no health prober. So the route renders the catalogue, the wizard and an empty
 * inventory with every server-backed control disabled and its reason printed,
 * and the surfaces that would need a real connection to say anything true -
 * `ConnectionHealthPanel`, `RoutingPolicyBuilder`, `ProviderAuditTimeline` -
 * stay in Storybook. `ProviderComparison` stays there for a different reason:
 * its scroll region needs a keyboard fix in the component itself, and routing
 * around that would hide the defect rather than fix it. All of this is declared
 * in `components/registry.ts` and checked by `route-registry.test.ts`, which
 * fails if a new PascalCase export here goes unclassified. The Storybook
 * preview keeps the stylesheet import for exactly those stories.
 */

export * from "./types";

export {
  ALL_METHOD_IDS,
  PROVIDER_CATALOG,
  availableMethods,
  isMethodAvailable,
  methodFor,
  providerById,
  unavailableMethods,
} from "./catalog";

export {
  NO_BACKEND_CAPABILITIES,
  PROVIDER_CAPABILITY_COUNTS,
  PROVIDER_CONNECTION_CAPABILITIES,
  actionOfferability,
  backendCapabilityLabel,
  blockedProviderCapabilities,
  enabledProviderCapabilities,
  hasBackend,
  hasPermission,
  methodOfferability,
  providerCapabilityById,
  readyProviderCapabilities,
} from "./capabilities";
export type { Offerability } from "./capabilities";

export {
  auditActionLabel,
  connectionStatusExplanation,
  connectionStatusLabel,
  connectionStatusTone,
  dataCategoryLabel,
  daysUntilExpiry,
  degradationExplanation,
  degradationLabel,
  effectiveStatus,
  formatMeasured,
  isHealthy,
  methodExplanation,
  methodLabel,
  methodNeedsSecret,
  needsAttention,
  trainingLabel,
  wizardStepLabel,
} from "./vocabulary";

export {
  WIZARD_STEPS,
  canAdvance,
  completedStepCount,
  initialWizardState,
  wizardReducer,
} from "./wizard-machine";

export { providerBulkActions, providerConnectionsGridConfig } from "./configs";
export type { ProviderGridActions } from "./configs";

export { SecretField } from "./SecretField";
export type { SecretFieldProps } from "./SecretField";
export { DataRoutingDisclosure } from "./DataRoutingDisclosure";
export type { DataRoutingDisclosureProps } from "./DataRoutingDisclosure";
export { ProviderCatalogView, ProviderComparison } from "./ProviderCatalogView";
export type { ProviderCatalogViewProps, ProviderComparisonProps } from "./ProviderCatalogView";
export { ConnectionWizard } from "./ConnectionWizard";
export type { ConnectionWizardProps } from "./ConnectionWizard";
export { ConnectionHealthPanel } from "./ConnectionHealthPanel";
export type { ConnectionHealthPanelProps } from "./ConnectionHealthPanel";
export { ConnectionInventory } from "./ConnectionInventory";
export type { ConnectionInventoryProps } from "./ConnectionInventory";
export { RoutingPolicyBuilder } from "./RoutingPolicyBuilder";
export type { RoutingPolicyBuilderProps } from "./RoutingPolicyBuilder";
export { ProviderAuditTimeline } from "./ProviderAuditTimeline";
export type { ProviderAuditTimelineProps } from "./ProviderAuditTimeline";
