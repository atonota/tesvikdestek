/**
 * The media workbench.
 *
 * A thin, honest composition: the accepted `DataGrid` does the table and card
 * rendering, `configs.tsx` declares the columns, and this component owns only
 * the things a library adds on top - the folder filter, the surface status, and
 * the standing notice that nothing here is persisted yet.
 *
 * It deliberately does not fetch. There is no media endpoint in this
 * repository, so a component that fetched would need a fake one, and a fake one
 * is how a demo becomes a lie. Rows arrive as a prop or they do not arrive.
 */

import { useMemo, useState } from "react";

import { cn } from "@/lib/cn";
import { DataGrid } from "../data-grid/DataGrid";
import type { GridStatus } from "../data-grid/types";
import { EmptyState, OfflineBanner, PartialDataNotice } from "../patterns";
import { mediaAssetsGridConfig, type MediaGridActions } from "./configs";
import type { MediaAsset, MediaCapabilities, MediaFolder, MediaSurfaceStatus } from "./types";

export interface MediaLibraryProps extends MediaGridActions {
  readonly assets: readonly MediaAsset[];
  readonly capabilities: MediaCapabilities;
  readonly status?: MediaSurfaceStatus;
  readonly errorMessage?: string;
  readonly onRefresh?: () => void;
  readonly folders?: readonly MediaFolder[];
  readonly activeFolderId?: string | null;
  readonly onFolderChange?: (folderId: string | null) => void;
  readonly className?: string;
}

/** The grid understands a narrower status vocabulary than the surface does. */
function toGridStatus(status: MediaSurfaceStatus): GridStatus {
  switch (status) {
    case "loading":
    case "refreshing":
    case "error":
    case "empty":
    case "no-results":
      return status;
    default:
      return "idle";
  }
}

/**
 * States: idle · loading · refreshing · error · empty · no-results · read-only
 * · offline. Table and card modes come from the grid's own view switch.
 */
export function MediaLibrary({
  assets,
  capabilities,
  status = "idle",
  errorMessage,
  onRefresh,
  folders,
  activeFolderId = null,
  onFolderChange,
  className,
  ...actions
}: MediaLibraryProps) {
  const [internalFolderId, setInternalFolderId] = useState<string | null>(activeFolderId);
  const folderId = onFolderChange ? activeFolderId : internalFolderId;

  const config = useMemo(
    () => mediaAssetsGridConfig(capabilities, actions),
    // `actions` is a fresh object each render; its identity is not meaningful,
    // and the callbacks it carries are read at click time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [capabilities],
  );

  const visible = useMemo(
    () => (folderId === null ? assets : assets.filter((asset) => asset.folderId === folderId)),
    [assets, folderId],
  );

  if (status === "read-only" && !capabilities.permissions.canDownload) {
    // Not `PermissionDenied`: that pattern offers a login, and logging in again
    // does not grant a permission the tenant was never given. Saying so plainly
    // is more use than a button that cannot help.
    return (
      <EmptyState
        title="Dosya kütüphanesi kapalı"
        reason="Bu oturumda dosya görüntüleme yetkisi tanımlı değil."
      />
    );
  }

  const changeFolder = (next: string | null) => {
    if (onFolderChange) onFolderChange(next);
    else setInternalFolderId(next);
  };

  return (
    <section className={cn("dt-media", className)} aria-label="Dosya kütüphanesi">
      {status === "offline" ? <OfflineBanner forceOffline /> : null}

      <PartialDataNotice
        what="Bu kütüphane henüz hiçbir dosyayı kalıcı olarak saklamıyor."
        because="Medya uçları backend'de yok: yükleme, indirme, üstveri ve tarama için sunucu yeteneği gerekiyor. Görünen satırlar yalnızca bu ekrana verilen üstveridir."
      />

      {folders && folders.length > 0 ? (
        <nav className="dt-media__folders" aria-label="Klasör süzgeci">
          <button
            type="button"
            className={cn("dt-media__folder-chip", folderId === null && "is-active")}
            aria-pressed={folderId === null}
            onClick={() => changeFolder(null)}
          >
            Tümü
          </button>
          {folders.map((folder) => (
            <button
              key={folder.id}
              type="button"
              className={cn("dt-media__folder-chip", folderId === folder.id && "is-active")}
              aria-pressed={folderId === folder.id}
              onClick={() => changeFolder(folder.id)}
            >
              {folder.name}
              <span className="dt-muted"> ({folder.assetCount})</span>
            </button>
          ))}
        </nav>
      ) : null}

      {status === "idle" && visible.length === 0 && assets.length > 0 ? (
        <EmptyState
          title="Bu klasörde dosya yok"
          reason="Başka bir klasör seçin veya süzgeci kaldırın."
        />
      ) : (
        <DataGrid
          config={config}
          rows={visible}
          status={toGridStatus(status)}
          {...(errorMessage ? { errorMessage } : {})}
          {...(onRefresh ? { onRefresh } : {})}
        />
      )}
    </section>
  );
}
