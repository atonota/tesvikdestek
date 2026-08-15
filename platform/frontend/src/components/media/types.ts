/**
 * The media and file library contract.
 *
 * This module is the whole vocabulary the subsystem speaks: what an asset is,
 * what a scan verdict can say, what an upload queue item may hold, and which
 * capabilities a host application injects. It is plain TypeScript - no React,
 * no network, no storage - so a future backend port has one place to satisfy.
 *
 * Two decisions here are load-bearing and deliberately encoded in the types
 * rather than left to reviewers:
 *
 * 1. `UploadItem` holds *metadata about* a file and never the `File` itself.
 *    A queue item is serialisable, loggable and safe to keep in React state;
 *    a `File` handle is none of those things and tempts a later author into
 *    persisting it.
 * 2. `ScanState` has no boolean. "Not scanned" and "scanner unavailable" are
 *    distinct from "clean", and none of the three collapses into a `safe: bool`
 *    that a careless `if` would read as reassurance.
 */

import type { ReactNode } from "react";

/* ------------------------------------------------------------------ scan */

/**
 * The verdict vocabulary.
 *
 * `unscanned` means nothing ever looked. `unavailable` means the scanner was
 * asked and could not answer. Neither is `clean`, and the difference matters to
 * the person deciding whether to open the file.
 */
export type ScanState = "unscanned" | "pending" | "clean" | "infected" | "failed" | "unavailable";

/* ------------------------------------------------------------- lifecycle */

export type LifecycleState = "active" | "trashed" | "purge-pending";

/** A hold outranks retention: legal hold blocks purge regardless of the date. */
export interface RetentionPolicy {
  readonly retainUntil: string | null;
  readonly legalHold: boolean;
  readonly holdReason?: string;
}

/* --------------------------------------------------------------- storage */

export type StorageBackendId = "local" | "s3";

export interface StorageTarget {
  readonly id: StorageBackendId;
  readonly label: string;
  readonly description: string;
  readonly isDefault: boolean;
}

/**
 * Injected, never measured in the browser. The client cannot see a disk, so
 * every number here arrives from a host that can.
 */
export interface StorageStatus {
  readonly backend: StorageBackendId;
  readonly usedBytes: number | null;
  readonly quotaBytes: number | null;
  readonly assetCount: number | null;
  readonly lastCheckedAt: string | null;
  /** Present only for an S3-compatible target that a host declared healthy. */
  readonly s3?: {
    readonly endpointLabel: string;
    readonly healthy: boolean;
    readonly lastErrorAt: string | null;
  };
}

/* ----------------------------------------------------------- permissions */

/**
 * What the current actor may do. Every flag defaults to false at the call site:
 * an absent permission system must read as "not permitted", never as "allowed
 * because nobody said otherwise".
 */
export interface MediaPermissions {
  readonly canUpload: boolean;
  readonly canEditMetadata: boolean;
  readonly canDownload: boolean;
  readonly canTrash: boolean;
  readonly canRestore: boolean;
  readonly canPurge: boolean;
  readonly canManageLegalHold: boolean;
}

export const NO_PERMISSIONS: MediaPermissions = {
  canUpload: false,
  canEditMetadata: false,
  canDownload: false,
  canTrash: false,
  canRestore: false,
  canPurge: false,
  canManageLegalHold: false,
};

/* ---------------------------------------------------------- capabilities */

/** Whether the component exists and works, independent of any backend. */
export type UiReadiness = "ready" | "partial" | "absent";

/** Whether a real backend can serve it today. */
export type BackendReadiness = "available" | "blocked";

export interface MediaCapability {
  readonly id: string;
  readonly title: string;
  readonly ui: UiReadiness;
  readonly backend: BackendReadiness;
  /** True only when both the component and a backend can actually do it. */
  readonly enabled: boolean;
  readonly reason: string;
}

/**
 * What the host tells the subsystem it can do.
 *
 * Defaulted to the honest minimum by `LOCAL_ONLY_CAPABILITIES`: durable local
 * object storage as the target, and nothing else claimed.
 */
export interface MediaCapabilities {
  readonly storage: {
    readonly local: { readonly available: boolean };
    /** Absent or `available: false` means no S3 surface renders at all. */
    readonly s3?: { readonly available: boolean; readonly endpointLabel?: string };
  };
  readonly streamingUpload: boolean;
  readonly rangeDownload: boolean;
  readonly durableMetadata: boolean;
  readonly antivirus: boolean;
  readonly derivatives: boolean;
  readonly auditPersistence: boolean;
  readonly rbac: boolean;
  readonly quotaEnforcement: boolean;
  readonly retentionPurge: boolean;
  readonly permissions: MediaPermissions;
}

/* ----------------------------------------------------------------- asset */

export interface MediaTag {
  readonly id: string;
  readonly label: string;
}

export interface MediaFolder {
  readonly id: string;
  readonly name: string;
  readonly parentId: string | null;
  readonly assetCount: number;
}

export interface MediaVersion {
  readonly versionNo: number;
  readonly contentHash: string;
  readonly sizeBytes: number;
  readonly createdAt: string;
  readonly authorLabel: string;
  readonly note: string;
}

/** Where an asset is referenced from, so deleting it is an informed act. */
export interface MediaReference {
  readonly id: string;
  readonly subjectType: string;
  readonly subjectLabel: string;
  readonly href?: string;
}

export interface MediaAuditEntry {
  readonly id: string;
  readonly action: string;
  readonly actorLabel: string;
  readonly occurredAt: string;
  readonly detail: string;
}

export interface MediaAsset {
  readonly id: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly contentHash: string;
  readonly folderId: string | null;
  readonly tags: readonly MediaTag[];
  readonly scanState: ScanState;
  readonly lifecycle: LifecycleState;
  readonly retention: RetentionPolicy;
  readonly storageBackend: StorageBackendId;
  readonly versionCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly description: string;
  readonly references: readonly MediaReference[];
}

/* ---------------------------------------------------------- upload queue */

export type UploadPhase =
  | "queued"
  | "validating"
  | "uploading"
  | "paused"
  | "failed"
  | "completed"
  | "cancelled";

/** Why a file was refused. `null` while nothing has been decided. */
export type UploadOutcome =
  | "duplicate"
  | "quota-exceeded"
  | "too-large"
  | "type-rejected"
  | null;

/**
 * One queue entry.
 *
 * Deliberately free of `File` and `Blob`: the handle stays in the caller's
 * transport closure, which is the only place that needs it and the only scope
 * short enough to be safe.
 */
export interface UploadItem {
  readonly id: string;
  readonly fileName: string;
  readonly sizeBytes: number;
  readonly declaredType: string;
  readonly phase: UploadPhase;
  readonly progress: number;
  readonly contentHash: string | null;
  readonly outcome: UploadOutcome;
  readonly error: string | null;
  readonly attempts: number;
  readonly assetId?: string;
}

export type UploadEvent =
  | { readonly type: "validate.start" }
  | { readonly type: "validate.ok"; readonly contentHash: string }
  | {
      readonly type: "validate.reject";
      readonly outcome: Exclude<UploadOutcome, null>;
      readonly message: string;
    }
  | { readonly type: "upload.start" }
  | { readonly type: "upload.progress"; readonly progress: number }
  | { readonly type: "upload.pause" }
  | { readonly type: "upload.resume" }
  | { readonly type: "upload.fail"; readonly message: string }
  | { readonly type: "upload.complete"; readonly assetId: string }
  | { readonly type: "retry" }
  | { readonly type: "cancel" };

/** What a host must provide before any byte can move. */
export interface UploadTransport {
  (request: {
    readonly item: UploadItem;
    readonly onProgress: (progress: number) => void;
  }): Promise<{ readonly assetId: string }>;
}

/* --------------------------------------------------------- shared shapes */

export interface MediaPanelProps {
  readonly capabilities: MediaCapabilities;
  readonly className?: string;
}

export type MediaSurfaceStatus =
  | "idle"
  | "loading"
  | "refreshing"
  | "error"
  | "empty"
  | "no-results"
  | "read-only"
  | "offline";

export interface MediaEmptyCopy {
  readonly title: string;
  readonly reason: string;
  readonly action?: ReactNode;
}
