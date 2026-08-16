/**
 * The provider connection centre — logic-only surface.
 *
 * W2 removed every visual component from this package: the clean-room
 * `CognitiveProviderCenter` master at `@/components/cognitive-provider-center`
 * is now the only presentation layer, reached by `/ayarlar/yapay-zeka` and
 * Storybook alike. What remains here is the vocabulary a future backend port
 * and the clean master both depend on — types, the provider catalogue, the
 * capability ledger and the wizard state machine — plain TypeScript with no
 * React component in it.
 *
 * Not re-exported from `@/components`, still deliberately: the clean master
 * imports this barrel by its own path, keeping this subsystem out of the
 * shared component chunk every route downloads.
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
