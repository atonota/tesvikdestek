/**
 * Media library states.
 *
 * The subsystem *does* have a product route - `/dosyalar` - and this file is no
 * longer the only place these components are assembled. What the route cannot
 * do is show them holding anything: the backend has no media table, no storage
 * adapter and no endpoint, so `/dosyalar` mounts the library, the upload panel,
 * the storage panel and the organiser genuinely empty, with every server-backed
 * control disabled and its reason on screen.
 *
 * That is the division of labour here. The route is the honest empty product;
 * these stories are the only place a *populated* asset, a quarantined scan or a
 * legal hold can be reviewed, which is why `MediaDetails` and
 * `MediaGovernancePanel` are classified Storybook-only in
 * `components/registry.ts`: both describe a stored asset, and inventing one to
 * put on a route is the exact fabrication the route exists to avoid.
 *
 * Every story draws on `src/test/media-fixtures`, which is outside the runtime
 * tree and cannot be imported by a component or a route.
 *
 * The matrix below is the review surface: local-only default, S3 available, S3
 * unavailable, quota exceeded, quarantine, upload failure, read-only, versions,
 * and trash under legal hold.
 */

import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  MediaDetails,
  MediaGovernancePanel,
  MediaLibrary,
  MediaOrganizer,
  MediaStoragePanel,
  MediaUploadPanel,
} from "./index";
import type { MediaAsset, UploadItem } from "./types";
import {
  MEDIA_ASSETS,
  MEDIA_AUDIT,
  MEDIA_CAPABILITIES_LOCAL_ONLY,
  MEDIA_CAPABILITIES_WITH_S3,
  MEDIA_CAPABILITIES_WRITABLE,
  MEDIA_FOLDERS,
  MEDIA_STORAGE_LOCAL,
  MEDIA_STORAGE_QUOTA_EXCEEDED,
  MEDIA_STORAGE_WITH_S3,
  MEDIA_VERSIONS,
} from "@/test/media-fixtures";

const unscanned = MEDIA_ASSETS.find((a) => a.scanState === "unscanned") as MediaAsset;
const infected = MEDIA_ASSETS.find((a) => a.scanState === "infected") as MediaAsset;
const held = MEDIA_ASSETS.find((a) => a.retention.legalHold) as MediaAsset;

/**
 * There is no router wrapper here on purpose.
 *
 * `.storybook/preview.tsx` already renders every story inside a
 * `RouterProvider`, because several components link and a story that cannot
 * link is not a story of the real component. Adding a second `MemoryRouter`
 * around these stories made React Router throw ("You cannot render a <Router>
 * inside another <Router>"), its default error boundary caught the throw, and
 * every media story painted an application error instead of a component - in a
 * build that compiled and a suite that was green, because a Storybook build
 * compiles stories without ever executing them.
 *
 * `media-stories.test.tsx` now renders these exports through Storybook's
 * portable-stories API against that same preview, so the composition is
 * exercised rather than assumed.
 */

const queueItem =(overrides: Partial<UploadItem>): UploadItem => ({
  id: "u1",
  fileName: "imza-sirkuleri.pdf",
  sizeBytes: 482_113,
  declaredType: "application/pdf",
  phase: "queued",
  progress: 0,
  contentHash: null,
  outcome: null,
  error: null,
  attempts: 0,
  ...overrides,
});

/* --------------------------------------------------------------- workbench */

const meta: Meta<typeof MediaLibrary> = {
  title: "Media/MediaLibrary",
  component: MediaLibrary,
};
export default meta;

type LibraryStory = StoryObj<typeof MediaLibrary>;

/** The default a host gets with nothing injected: local storage, no permissions. */
export const LocalOnlyDefault: LibraryStory = {
  args: {
    assets: MEDIA_ASSETS,
    capabilities: MEDIA_CAPABILITIES_LOCAL_ONLY,
    folders: MEDIA_FOLDERS,
  },
};

export const Loading: LibraryStory = {
  args: { assets: [], capabilities: MEDIA_CAPABILITIES_LOCAL_ONLY, status: "loading" },
};

export const Empty: LibraryStory = {
  args: { assets: [], capabilities: MEDIA_CAPABILITIES_LOCAL_ONLY, status: "empty" },
};

export const ErrorState: LibraryStory = {
  args: {
    assets: [],
    capabilities: MEDIA_CAPABILITIES_LOCAL_ONLY,
    status: "error",
    errorMessage: "Kütüphane yüklenemedi.",
  },
};

/** Read-only: the surface says the permission is absent instead of showing a login. */
export const ReadOnly: LibraryStory = {
  args: {
    assets: MEDIA_ASSETS,
    capabilities: MEDIA_CAPABILITIES_LOCAL_ONLY,
    status: "read-only",
  },
};

export const Offline: LibraryStory = {
  args: {
    assets: MEDIA_ASSETS,
    capabilities: MEDIA_CAPABILITIES_WRITABLE,
    status: "offline",
  },
};

/* ------------------------------------------------------------------ upload */

type UploadStory = StoryObj<typeof MediaUploadPanel>;

/** No transport callback: the picker is disabled and explains why. */
export const UploadWithoutTransport: UploadStory = {
  render: () => (
    <MediaUploadPanel capabilities={MEDIA_CAPABILITIES_LOCAL_ONLY} items={[]} />
  ),
};

export const UploadInProgress: UploadStory = {
  render: () => (
    <MediaUploadPanel
      capabilities={MEDIA_CAPABILITIES_WRITABLE}
      onUpload={() => undefined}
      onPause={() => undefined}
      onCancel={() => undefined}
      items={[
        queueItem({ id: "a", phase: "validating" }),
        queueItem({ id: "b", fileName: "bilanco.xlsx", phase: "uploading", progress: 62 }),
        queueItem({ id: "c", fileName: "plan.png", phase: "paused", progress: 35 }),
        queueItem({ id: "d", fileName: "sozlesme.pdf", phase: "completed", progress: 100 }),
      ]}
    />
  ),
};

/** Failure, duplicate and quota side by side - three different endings. */
export const UploadFailure: UploadStory = {
  render: () => (
    <MediaUploadPanel
      capabilities={MEDIA_CAPABILITIES_WRITABLE}
      onUpload={() => undefined}
      onRetry={() => undefined}
      onCancel={() => undefined}
      items={[
        queueItem({ id: "a", phase: "failed", error: "Bağlantı koptu.", attempts: 2 }),
        queueItem({ id: "b", fileName: "ayni.pdf", phase: "failed", outcome: "duplicate" }),
        queueItem({ id: "c", fileName: "dev.zip", phase: "failed", outcome: "too-large" }),
      ]}
    />
  ),
};

/** Quota exceeded: the queue reports it as a decision, not a retryable fault. */
export const QuotaExceeded: UploadStory = {
  render: () => (
    <div className="dt-stack">
      <MediaStoragePanel
        storage={MEDIA_STORAGE_QUOTA_EXCEEDED}
        capabilities={MEDIA_CAPABILITIES_LOCAL_ONLY}
      />
      <MediaUploadPanel
        capabilities={MEDIA_CAPABILITIES_WRITABLE}
        onUpload={() => undefined}
        onCancel={() => undefined}
        items={[queueItem({ phase: "failed", outcome: "quota-exceeded" })]}
      />
    </div>
  ),
};

/* ----------------------------------------------------------------- storage */

type StorageStory = StoryObj<typeof MediaStoragePanel>;

/** S3 absent: no S3 panel renders at all. */
export const StorageS3Unavailable: StorageStory = {
  render: () => (
    <MediaStoragePanel
      storage={MEDIA_STORAGE_LOCAL}
      capabilities={MEDIA_CAPABILITIES_LOCAL_ONLY}
    />
  ),
};

/** S3 present only because an injected capability declared it. */
export const StorageS3Available: StorageStory = {
  render: () => (
    <MediaStoragePanel
      storage={MEDIA_STORAGE_WITH_S3}
      capabilities={MEDIA_CAPABILITIES_WITH_S3}
    />
  ),
};

/* -------------------------------------------------------------- governance */

type GovernanceStory = StoryObj<typeof MediaGovernancePanel>;

/** The default case in this build: nothing was scanned, and it says so. */
export const GovernanceUnscanned: GovernanceStory = {
  render: () => (
    <MediaGovernancePanel
      asset={unscanned}
      capabilities={MEDIA_CAPABILITIES_WRITABLE}
      audit={MEDIA_AUDIT}
    />
  ),
};

export const GovernanceQuarantine: GovernanceStory = {
  render: () => (
    <MediaGovernancePanel asset={infected} capabilities={MEDIA_CAPABILITIES_WRITABLE} />
  ),
};

/** Trash plus legal hold: purge is refused and the panel names the winning rule. */
export const GovernanceTrashLegalHold: GovernanceStory = {
  render: () => (
    <MediaGovernancePanel
      asset={held}
      capabilities={MEDIA_CAPABILITIES_WRITABLE}
      audit={MEDIA_AUDIT}
    />
  ),
};

/* ----------------------------------------------------------------- details */

type DetailsStory = StoryObj<typeof MediaDetails>;

export const DetailsWithVersions: DetailsStory = {
  render: () => (
    <MediaDetails
      asset={unscanned}
      capabilities={MEDIA_CAPABILITIES_LOCAL_ONLY}
      versions={MEDIA_VERSIONS}
    />
  ),
};

export const DetailsQuarantinedPreview: DetailsStory = {
  render: () => (
    <MediaDetails asset={infected} capabilities={MEDIA_CAPABILITIES_LOCAL_ONLY} />
  ),
};

/* --------------------------------------------------------------- organizer */

type OrganizerStory = StoryObj<typeof MediaOrganizer>;

export const OrganizerEditable: OrganizerStory = {
  render: () => (
    <MediaOrganizer
      folders={MEDIA_FOLDERS}
      capabilities={MEDIA_CAPABILITIES_WRITABLE}
      draft={{ description: "Noter onaylı sirküler.", tags: [{ id: "Resmî", label: "Resmî" }] }}
      onDraftChange={() => undefined}
    />
  ),
};

export const OrganizerReadOnly: OrganizerStory = {
  render: () => (
    <MediaOrganizer folders={MEDIA_FOLDERS} capabilities={MEDIA_CAPABILITIES_LOCAL_ONLY} />
  ),
};
