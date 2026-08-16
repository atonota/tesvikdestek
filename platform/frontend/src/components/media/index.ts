/**
 * The media and file library — logic-only surface.
 *
 * W2 removed every visual component from this package: the clean-room
 * `CognitiveFileLibrary` master at `@/components/cognitive-file-library` is
 * now the only presentation layer, reached by `/dosyalar` and Storybook alike.
 * What remains here is the vocabulary a future backend port and the clean
 * master both depend on — types, the capability ledger and the upload state
 * machine — plain TypeScript with no React component in it.
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
