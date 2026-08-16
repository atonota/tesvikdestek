/**
 * The cognitive cockpit — clean-room `/panel` master surface, public barrel.
 *
 * Interaction and visual authority: the design reference whose contents hash
 * to sha256 23c3729ad1856d056699d68503e2d92a0f996ba57f531fe1edc7e00bb85fd146.
 * Consulted for behaviour only; nothing in this package is copied from it.
 *
 * Storybook and the `/panel` route both import `CognitiveCockpitDashboard`
 * from this one module, so there is exactly one implementation to review.
 */

export {
  CognitiveCockpitDashboard,
  type CockpitIdentity,
  type CockpitReadState,
  type CognitiveCockpitDashboardProps,
} from "./CognitiveCockpitDashboard";
export { CognitiveCockpitSkeleton } from "./CognitiveCockpitSkeleton";
export {
  CognitiveSpotlightHeader,
  type CockpitSearchItem,
  type CognitiveSpotlightHeaderProps,
} from "./CognitiveSpotlightHeader";
export { CognitiveCommandDrawer, type CognitiveCommandDrawerProps } from "./CognitiveCommandDrawer";
export { CognitiveAccountMenu, type CognitiveAccountMenuProps } from "./CognitiveAccountMenu";
export {
  CognitiveEvidenceRail,
  type CockpitEvidenceStatus,
  type CockpitEvidenceSuggestion,
  type CognitiveEvidenceRailProps,
} from "./CognitiveEvidenceRail";
export {
  CognitiveKpiStrip,
  type CockpitKpiTile,
  type CockpitProvenance,
  type CognitiveKpiStripProps,
} from "./CognitiveKpiStrip";
export {
  CognitiveNextActionQueue,
  type CockpitQueueItem,
  type CognitiveNextActionQueueProps,
} from "./CognitiveNextActionQueue";
export {
  CognitiveEvidenceGapList,
  type CockpitEvidenceGap,
  type CognitiveEvidenceGapListProps,
} from "./CognitiveEvidenceGapList";
export { CognitiveAuditTruthBlock } from "./CognitiveAuditTruthBlock";
export {
  CognitiveCatalogPanel,
  type CockpitCatalogCount,
  type CockpitCatalogSource,
  type CognitiveCatalogPanelProps,
} from "./CognitiveCatalogPanel";
export {
  CognitiveAccessScopePanel,
  type CognitiveAccessScopePanelProps,
} from "./CognitiveAccessScopePanel";
export {
  CognitiveAnalyticsPanel,
  type CockpitAnalyticsTab,
  type CognitiveAnalyticsPanelProps,
} from "./CognitiveAnalyticsPanel";
