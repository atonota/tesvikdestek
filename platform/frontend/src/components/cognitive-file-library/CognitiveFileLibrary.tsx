/**
 * The cognitive file library — clean-room `/dosyalar` master surface.
 *
 * Presentational only: the route owns every read and passes down one honest
 * state, exactly as `CognitiveCockpitDashboard` does for `/panel`. There is
 * still no media backend in this repository — no table, no upload endpoint,
 * no storage adapter — so this component never renders an uploaded file, a
 * measured storage figure or an established capability that does not exist.
 * The blocked half of the ledger is printed on the screen it is about,
 * instead of only living in a separate capability matrix.
 */

import { Badge, EmptyState, ErrorState, OfflineBanner, Skeleton, SkeletonCard, SkeletonList } from "@/foundation";
import { resolveContent, useContent } from "@/content";
import {
  blockedMediaCapabilities,
  storageBackendLabel,
  storageTargets,
  type MediaCapabilities,
  type StorageStatus,
} from "@/components/media";

import "./cognitive-file-library.css";

export type FileLibraryReadState = "loading" | "empty" | "error" | "permission" | "offline" | "success";

export interface CognitiveFileLibraryProps {
  readonly state: FileLibraryReadState;
  readonly capabilities: MediaCapabilities;
  readonly storage: StorageStatus | null;
  readonly assetCount: number | null;
  readonly errorMessage?: string | null;
  readonly onRetry?: () => void;
  readonly updatedAt?: number | null;
}

const STATE_CONTENT_IDS: Record<FileLibraryReadState, { title: string; reason: string }> = {
  loading: { title: "file_library.state.loading.title", reason: "file_library.state.loading.reason" },
  empty: { title: "file_library.state.empty.title", reason: "file_library.state.empty.reason" },
  error: { title: "file_library.state.error.title", reason: "file_library.state.error.reason" },
  permission: { title: "file_library.state.permission.title", reason: "file_library.state.permission.reason" },
  offline: { title: "file_library.state.offline.title", reason: "file_library.state.offline.reason" },
  success: { title: "file_library.state.success.title", reason: "file_library.state.success.reason" },
};

function stateCopyFor(state: FileLibraryReadState): { title: string; reason: string } {
  const ids = STATE_CONTENT_IDS[state];
  return { title: resolveContent(ids.title), reason: resolveContent(ids.reason) };
}

function FileLibrarySkeleton() {
  const label = useContent("file_library.state.loading.title");
  return (
    <Skeleton label={label} className="cognitive-file-library__skeleton" role="status" aria-busy="true">
      <SkeletonCard withAction lines={2} />
      <SkeletonList items={4} />
    </Skeleton>
  );
}

function StorageSummary({ storage, capabilities }: { readonly storage: StorageStatus | null; readonly capabilities: MediaCapabilities }) {
  const heading = useContent("file_library.storage.heading");
  const unmeasuredMark = useContent("file_library.storage.value_dash");
  const usedLabel = useContent("file_library.storage.used_label");
  const quotaLabel = useContent("file_library.storage.quota_label");
  const targets = storageTargets(capabilities);

  return (
    <section className="cognitive-file-library__storage" aria-labelledby="cognitive-file-library-storage-heading">
      <h2 id="cognitive-file-library-storage-heading" className="cognitive-file-library__section-title">
        {heading}
      </h2>
      <div className="cognitive-file-library__storage-grid">
        <div className="cognitive-file-library__storage-figure">
          <span className="cognitive-file-library__storage-figure-label">{usedLabel}</span>
          <span className="cognitive-file-library__storage-figure-value">
            {storage?.usedBytes !== null && storage?.usedBytes !== undefined
              ? String(storage.usedBytes)
              : unmeasuredMark}
          </span>
        </div>
        <div className="cognitive-file-library__storage-figure">
          <span className="cognitive-file-library__storage-figure-label">{quotaLabel}</span>
          <span className="cognitive-file-library__storage-figure-value">
            {storage?.quotaBytes !== null && storage?.quotaBytes !== undefined
              ? String(storage.quotaBytes)
              : unmeasuredMark}
          </span>
        </div>
      </div>
      <ul className="cognitive-file-library__targets">
        {targets.map((target) => (
          <li key={target.id} className="cognitive-file-library__target">
            <strong>{target.label}</strong>
            <span>{target.description}</span>
            {target.isDefault ? <Badge tone="neutral">{storageBackendLabel(target.id)}</Badge> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function BlockedCapabilityLedger() {
  const heading = useContent("file_library.blocked.heading");
  const intro = useContent("file_library.blocked.intro");
  const blocked = blockedMediaCapabilities();

  return (
    <section className="cognitive-file-library__blocked" aria-labelledby="cognitive-file-library-blocked-heading">
      <h2 id="cognitive-file-library-blocked-heading" className="cognitive-file-library__section-title">
        {heading}
      </h2>
      <p className="cognitive-file-library__blocked-intro">{intro}</p>
      <ul className="cognitive-file-library__blocked-list">
        {blocked.map((capability) => (
          <li key={capability.id} className="cognitive-file-library__blocked-item">
            <strong>{capability.title}</strong>
            <span>{capability.reason}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CognitiveFileLibrary({
  state,
  capabilities,
  storage,
  assetCount,
  errorMessage = null,
  onRetry,
  updatedAt = null,
}: CognitiveFileLibraryProps) {
  const copy = stateCopyFor(state);
  const pageTitle = useContent("file_library.page.title");
  const lede = useContent("file_library.lede");
  const retryLabel = useContent("file_library.action.retry");
  const assetCountLabel = useContent("file_library.summary.asset_count", {
    values: { count: assetCount !== null ? String(assetCount) : "" },
  });
  const offlineLabel = useContent("file_library.offline.label");
  const offlineMessage = useContent("file_library.offline.message", {
    values: { when: updatedAt ? new Date(updatedAt).toLocaleString("tr-TR") : "" },
  });

  return (
    <div className="cognitive-file-library" data-state={state}>
      <div className="cognitive-file-library__heading">
        <h1 className="cognitive-file-library__title">{pageTitle}</h1>
        <p className="cognitive-file-library__lede">{lede}</p>
      </div>

      {state === "offline" ? <OfflineBanner label={offlineLabel} message={offlineMessage} /> : null}

      {state === "loading" ? <FileLibrarySkeleton /> : null}
      {state === "permission" ? (
        <div className="cognitive-file-library__state fd-state fd-state--denied" role="alert">
          <h3 className="fd-state__title">{copy.title}</h3>
          <p className="fd-state__reason">{copy.reason}</p>
        </div>
      ) : null}
      {state === "error" ? (
        <ErrorState
          title={copy.title}
          message={errorMessage ?? copy.reason}
          {...(onRetry ? { onRetry, retryLabel } : {})}
        />
      ) : null}
      {state === "empty" ? <EmptyState title={copy.title} reason={copy.reason} /> : null}

      {state === "success" ? (
        <>
          <p className="cognitive-file-library__summary" role="status">
            {assetCountLabel}
          </p>
          <StorageSummary storage={storage} capabilities={capabilities} />
          <BlockedCapabilityLedger />
        </>
      ) : null}
    </div>
  );
}
