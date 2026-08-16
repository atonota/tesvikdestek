/**
 * The adaptive enterprise surface.
 *
 * One subsystem with a stable public surface, exported through the shared
 * component barrel alongside the data grid. Unlike the media library and the
 * provider connection centre, this one *is* rendered by real routes, so it
 * belongs in the production bundle and its stylesheet is imported by the
 * application entry.
 *
 * Deliberately outside the 75-component registry, for the same reason as the
 * grid: it is one subsystem with a contract, not five more named parts.
 */

export * from "./types";
export { deriveDataStatus, suggestFromLoadedData, uniqueMissingFacts } from "./rules";
export type {
  AssistantInput,
  DataStatusInput,
  DecisionFacts,
  QueryFacts,
  SnapshotFacts,
} from "./rules";
export { AdaptiveShell } from "./AdaptiveShell";
export type { AdaptiveShellProps, ConversionAction } from "./AdaptiveShell";
export { AdaptiveAssistant } from "./AdaptiveAssistant";
export type { AdaptiveAssistantProps } from "./AdaptiveAssistant";
export {
  buildCommandVocabulary,
  deriveCommandStatus,
  describeCommandStatus,
  resolveCommandQuery,
} from "./command";
export type { CommandEntry, CommandResult, CommandStatus } from "./command";
export { ShellHeaderSpotlight } from "./ShellHeaderSpotlight";
export type { ShellHeaderSpotlightProps } from "./ShellHeaderSpotlight";
export { ShellSidebarNav } from "./ShellSidebarNav";
export type { ShellSidebarNavProps } from "./ShellSidebarNav";
export { ShellSidebarCommand } from "./ShellSidebarCommand";
export type { ShellSidebarCommandProps } from "./ShellSidebarCommand";
export { ShellAccountMenu } from "./ShellAccountMenu";
export type { ShellAccountMenuProps } from "./ShellAccountMenu";
