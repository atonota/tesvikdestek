/**
 * The media and file library subsystem.
 *
 * One coherent public surface, exported through the shared component barrel
 * alongside the data grid. Like the grid, it is deliberately not counted in the
 * 75-component registry: it is one subsystem with a stable contract, not a
 * dozen more named parts to pad a number with.
 *
 * There *is* a product route: `/dosyalar`, in `src/routes/media.tsx`. What has
 * not changed is the reason this comment used to refuse one - the backend still
 * has no media table, no storage adapter and no endpoint. What changed is the
 * reading of "shipping a page that cannot do the thing it appears to do": the
 * route does not appear to do it. The library is genuinely empty, every
 * server-backed control renders disabled with its reason, the capacity figures
 * are `null` rather than zero, and the blocked half of the ledger below is
 * printed on the screen itself. A finished subsystem reachable only from
 * Storybook was not honesty, it was absence.
 *
 * The stylesheet is imported by that route module and by nothing else, so it
 * travels in the route's own lazy chunk. The components themselves do not:
 * `src/components/index.ts` re-exports this barrel and every route imports that
 * barrel, so this subsystem's JavaScript is in the shared component chunk for
 * every visitor. Only the CSS is lazy, and the difference is recorded here
 * because a comment that said "this subsystem is lazy" would be false in the
 * half that costs the most.
 *
 * Every component here is classified in `components/registry.ts`, and
 * `route-registry.test.ts` fails if a new PascalCase export leaves this barrel
 * unclassified. `MediaLibrary`, `MediaUploadPanel`, `MediaStoragePanel`,
 * `MediaOrganizer` and the `FolderTree` inside it are on `/dosyalar`;
 * `MediaDetails` and `MediaGovernancePanel` are Storybook-only, because both
 * describe a stored asset and there is no stored asset to describe.
 */

export * from "./types";
export {
  LOCAL_ONLY_CAPABILITIES,
  MEDIA_CAPABILITIES,
  MEDIA_CAPABILITY_COUNTS,
  blockedMediaCapabilities,
  enabledMediaCapabilities,
  isS3Available,
  mediaCapabilityById,
  readyMediaCapabilities,
  storageTargets,
} from "./capabilities";
export {
  NON_RETRYABLE_OUTCOMES,
  TERMINAL_PHASES,
  initialUploadItem,
  isRetryable,
  isTerminal,
  queueReducer,
  summariseQueue,
  uploadOutcomeMessage,
  uploadReducer,
} from "./upload-machine";
export type { QueueSummary } from "./upload-machine";
export {
  formatBytes,
  hasScanVerdict,
  isDownloadBlocked,
  isTreatedAsClean,
  lifecycleLabel,
  scanStateExplanation,
  scanStateLabel,
  scanStateTone,
  storageBackendLabel,
  uploadPhaseLabel,
} from "./vocabulary";
export {
  compareVersions,
  mediaAssetsGridConfig,
  mediaBulkActions,
  mediaReferencesGridConfig,
  mediaVersionsGridConfig,
  mimeLabel,
} from "./configs";
export type { MediaGridActions, VersionComparison } from "./configs";

export { MediaLibrary } from "./MediaLibrary";
export type { MediaLibraryProps } from "./MediaLibrary";
export { MediaUploadPanel } from "./MediaUploadPanel";
export type { MediaUploadPanelProps } from "./MediaUploadPanel";
export { FolderTree, MediaOrganizer } from "./MediaOrganizer";
export type { FolderTreeProps, MediaOrganizerProps, MetadataDraft } from "./MediaOrganizer";
export { MediaDetails } from "./MediaDetails";
export type { MediaDetailsProps } from "./MediaDetails";
export { MediaGovernancePanel } from "./MediaGovernancePanel";
export type { MediaGovernanceProps } from "./MediaGovernancePanel";
export { MediaStoragePanel } from "./MediaStoragePanel";
export type { MediaStoragePanelProps } from "./MediaStoragePanel";
