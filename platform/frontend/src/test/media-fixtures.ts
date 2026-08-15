/**
 * Media fixtures - tests and Storybook only.
 *
 * This file lives under `src/test/` on purpose. Nothing under `src/components`
 * or `src/routes` may import it, and an acceptance test asserts exactly that,
 * so a fixture can never become the thing a real user sees. That boundary is
 * the whole point now that `/dosyalar` exists and renders the media subsystem
 * for real: the route passes empty collections and its own capability ledger,
 * and these rows stay on the test side of the import line. They exercise
 * components; they never stand in for an endpoint that does not exist.
 */

import type {
  MediaAsset,
  MediaAuditEntry,
  MediaCapabilities,
  MediaFolder,
  MediaVersion,
  StorageStatus,
} from "@/components/media/types";
import { LOCAL_ONLY_CAPABILITIES } from "@/components/media/capabilities";

export const MEDIA_FOLDERS: readonly MediaFolder[] = [
  { id: "f-kurumsal", name: "Kurumsal belgeler", parentId: null, assetCount: 2 },
  { id: "f-imza", name: "İmza sirküleri", parentId: "f-kurumsal", assetCount: 1 },
  { id: "f-mali", name: "Mali tablolar", parentId: null, assetCount: 1 },
];

export const MEDIA_ASSETS: readonly MediaAsset[] = [
  {
    id: "m-001",
    fileName: "imza-sirkuleri-2026.pdf",
    mimeType: "application/pdf",
    sizeBytes: 482_113,
    contentHash: "b".repeat(64),
    folderId: "f-imza",
    tags: [{ id: "t-resmi", label: "Resmî" }],
    scanState: "unscanned",
    lifecycle: "active",
    retention: { retainUntil: null, legalHold: false },
    storageBackend: "local",
    versionCount: 2,
    createdAt: "2026-08-01T09:12:00Z",
    updatedAt: "2026-08-12T14:03:00Z",
    description: "Noter onaylı imza sirküleri.",
    references: [
      {
        id: "r-1",
        subjectType: "decision",
        subjectLabel: "TUBITAK-1501 kararı",
        href: "/degerlendirmeler/d-1",
      },
    ],
  },
  {
    id: "m-002",
    fileName: "bilanco-2025.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    sizeBytes: 92_400,
    contentHash: "c".repeat(64),
    folderId: "f-mali",
    tags: [{ id: "t-mali", label: "Mali" }],
    scanState: "clean",
    lifecycle: "active",
    retention: { retainUntil: "2031-01-01", legalHold: false },
    storageBackend: "local",
    versionCount: 1,
    createdAt: "2026-07-19T11:00:00Z",
    updatedAt: "2026-07-19T11:00:00Z",
    description: "2025 yılı bilançosu.",
    references: [],
  },
  {
    id: "m-003",
    fileName: "supheli-ek.zip",
    mimeType: "application/zip",
    sizeBytes: 2_311_000,
    contentHash: "d".repeat(64),
    folderId: "f-kurumsal",
    tags: [],
    scanState: "infected",
    lifecycle: "active",
    retention: { retainUntil: null, legalHold: false },
    storageBackend: "local",
    versionCount: 1,
    createdAt: "2026-08-10T08:30:00Z",
    updatedAt: "2026-08-10T08:31:00Z",
    description: "Karantinaya alındı.",
    references: [],
  },
  {
    id: "m-004",
    fileName: "eski-taslak.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    sizeBytes: 41_000,
    contentHash: "e".repeat(64),
    folderId: "f-kurumsal",
    tags: [{ id: "t-taslak", label: "Taslak" }],
    scanState: "unavailable",
    lifecycle: "trashed",
    retention: { retainUntil: "2027-01-01", legalHold: true, holdReason: "Devam eden inceleme" },
    storageBackend: "local",
    versionCount: 3,
    createdAt: "2026-05-02T10:00:00Z",
    updatedAt: "2026-08-13T16:45:00Z",
    description: "Çöp kutusunda, hukuki muhafaza altında.",
    references: [],
  },
];

export const MEDIA_VERSIONS: readonly MediaVersion[] = [
  {
    versionNo: 2,
    contentHash: "b".repeat(64),
    sizeBytes: 482_113,
    createdAt: "2026-08-12T14:03:00Z",
    authorLabel: "İ. Karaca",
    note: "Yenilenmiş sirküler.",
  },
  {
    versionNo: 1,
    contentHash: "f".repeat(64),
    sizeBytes: 470_002,
    createdAt: "2026-08-01T09:12:00Z",
    authorLabel: "İ. Karaca",
    note: "İlk yükleme.",
  },
];

export const MEDIA_AUDIT: readonly MediaAuditEntry[] = [
  {
    id: "a-2",
    action: "media_version_added",
    actorLabel: "İ. Karaca",
    occurredAt: "2026-08-12T14:03:00Z",
    detail: "Sürüm 2 eklendi.",
  },
  {
    id: "a-1",
    action: "media_uploaded",
    actorLabel: "İ. Karaca",
    occurredAt: "2026-08-01T09:12:00Z",
    detail: "Dosya yüklendi.",
  },
];

export const MEDIA_CAPABILITIES_LOCAL_ONLY: MediaCapabilities = LOCAL_ONLY_CAPABILITIES;

export const MEDIA_CAPABILITIES_WITH_S3: MediaCapabilities = {
  ...LOCAL_ONLY_CAPABILITIES,
  storage: {
    local: { available: true },
    s3: { available: true, endpointLabel: "eu-central-1 uyumlu uç" },
  },
};

export const MEDIA_CAPABILITIES_WRITABLE: MediaCapabilities = {
  ...LOCAL_ONLY_CAPABILITIES,
  permissions: {
    canUpload: true,
    canEditMetadata: true,
    canDownload: true,
    canTrash: true,
    canRestore: true,
    canPurge: false,
    canManageLegalHold: true,
  },
};

export const MEDIA_STORAGE_LOCAL: StorageStatus = {
  backend: "local",
  usedBytes: 2_926_513,
  quotaBytes: 10_737_418_240,
  assetCount: 4,
  lastCheckedAt: "2026-08-14T20:00:00Z",
};

export const MEDIA_STORAGE_QUOTA_EXCEEDED: StorageStatus = {
  backend: "local",
  usedBytes: 10_737_418_240,
  quotaBytes: 10_737_418_240,
  assetCount: 1204,
  lastCheckedAt: "2026-08-14T20:00:00Z",
};

export const MEDIA_STORAGE_WITH_S3: StorageStatus = {
  backend: "s3",
  usedBytes: 2_926_513,
  quotaBytes: null,
  assetCount: 4,
  lastCheckedAt: "2026-08-14T20:00:00Z",
  s3: { endpointLabel: "eu-central-1 uyumlu uç", healthy: true, lastErrorAt: null },
};
