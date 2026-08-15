/**
 * Typed grid configurations for the media library.
 *
 * The media tables are declared here for the same reason every other table in
 * this codebase is: a hand-written `<table>` gets its caption, scoped headers,
 * column control and card fallback right once and wrong the next time. Going
 * through `GridConfig` means the media surfaces inherit the grid's
 * accessibility and state handling instead of re-earning them.
 *
 * Bulk actions are *hooks*, not implementations. This package runs no mutation:
 * every action is handed to the caller, and one whose backend does not exist is
 * declared `allowed: false` with the reason attached rather than hidden - a
 * missing button teaches nobody why it is missing.
 */

import { formatDate, formatDateTime, formatNumber } from "@/lib/intl";
import { Card, CopyableHash, DefinitionList } from "../composites";
import { Badge, Link } from "../primitives";
import type { BulkAction, GridConfig } from "../data-grid/types";
import { mediaCapabilityById } from "./capabilities";
import type {
  MediaAsset,
  MediaCapabilities,
  MediaReference,
  MediaVersion,
} from "./types";
import {
  formatBytes,
  isDownloadBlocked,
  lifecycleLabel,
  scanStateExplanation,
  scanStateLabel,
  scanStateTone,
} from "./vocabulary";

/** Short, human MIME names. Anything unlisted shows its raw subtype. */
const MIME_LABELS: Readonly<Record<string, string>> = {
  "application/pdf": "PDF",
  "image/png": "PNG",
  "image/jpeg": "JPEG",
  "image/webp": "WebP",
  "text/csv": "CSV",
  "application/zip": "ZIP",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
};

export function mimeLabel(mimeType: string): string {
  return MIME_LABELS[mimeType] ?? (mimeType.split("/")[1] ?? mimeType).toUpperCase();
}

export interface MediaGridActions {
  readonly onOpen?: (asset: MediaAsset) => void;
  readonly onDownload?: (assets: readonly MediaAsset[]) => void;
  readonly onTrash?: (assets: readonly MediaAsset[]) => void;
  readonly onRestore?: (assets: readonly MediaAsset[]) => void;
  readonly onAddTag?: (assets: readonly MediaAsset[]) => void;
}

/**
 * Bulk actions, gated by two things at once: the injected permission and the
 * backend capability. Either one missing disables the control and supplies the
 * reason; neither silently removes it.
 */
export function mediaBulkActions(
  capabilities: MediaCapabilities,
  actions: MediaGridActions,
): readonly BulkAction<MediaAsset>[] {
  const { permissions } = capabilities;
  const reasonFor = (id: string, permitted: boolean): string | undefined => {
    if (!permitted) return "Bu işlem için yetkiniz tanımlı değil.";
    const capability = mediaCapabilityById(id);
    if (capability && !capability.enabled) return capability.reason;
    return undefined;
  };

  const build = (
    id: string,
    label: string,
    capabilityId: string,
    permitted: boolean,
    run: ((rows: readonly MediaAsset[]) => void) | undefined,
    destructive = false,
  ): BulkAction<MediaAsset> => {
    const reason = reasonFor(capabilityId, permitted) ?? (run ? undefined : "Bu ekran bu eylemi devralmadı.");
    return {
      id,
      label,
      run: run ?? (() => undefined),
      allowed: reason === undefined,
      ...(reason ? { reason } : {}),
      destructive,
    };
  };

  return [
    build("download", "İndir", "download-range", permissions.canDownload, actions.onDownload),
    build("tag", "Etiket ekle", "durable-metadata", permissions.canEditMetadata, actions.onAddTag),
    build("trash", "Çöp kutusuna taşı", "durable-metadata", permissions.canTrash, actions.onTrash, true),
    build("restore", "Geri al", "durable-metadata", permissions.canRestore, actions.onRestore),
  ];
}

/**
 * The main asset table.
 *
 * The scan column is deliberately not hideable: a library where the safety
 * verdict can be switched off is a library that will eventually be read without
 * it.
 */
export function mediaAssetsGridConfig(
  capabilities: MediaCapabilities,
  actions: MediaGridActions = {},
): GridConfig<MediaAsset> {
  return {
    id: "media-assets",
    schemaVersion: 1,
    caption: "Dosya kütüphanesi",
    getRowId: (row) => row.id,
    viewModes: ["table", "card"],
    defaultViewMode: "table",
    selectable: true,
    defaultSort: [{ columnId: "updated", direction: "desc" }],
    defaultPageSize: 25,
    emptyTitle: "Kütüphanede dosya yok",
    emptyMessage: "Bir dosya yüklendiğinde burada listelenir.",
    noResultsTitle: "Eşleşen dosya yok",
    noResultsMessage: "Arama ve filtreleri gevşetmeyi deneyin.",
    bulkActions: mediaBulkActions(capabilities, actions),
    renderCard: (asset) => (
      <Card headingLevel={3} title={asset.fileName}>
        <div className="dt-row dt-media__card-row">
          <Badge tone={scanStateTone(asset.scanState)} srDescription={scanStateExplanation(asset.scanState)}>
            {scanStateLabel(asset.scanState)}
          </Badge>
          <Badge tone="neutral">{mimeLabel(asset.mimeType)}</Badge>
          <span className="dt-muted">{formatBytes(asset.sizeBytes)}</span>
        </div>
        <DefinitionList
          items={[
            { term: "Güncellendi", description: formatDateTime(asset.updatedAt) },
            { term: "Sürüm", description: formatNumber(asset.versionCount) },
            { term: "Durum", description: lifecycleLabel(asset.lifecycle) },
          ]}
        />
      </Card>
    ),
    columns: [
      {
        id: "name",
        header: "Dosya adı",
        accessor: (row) => row.fileName,
        kind: "text",
        sortable: true,
        filterable: true,
        pinnable: true,
        hideable: false,
        cell: (row) =>
          actions.onOpen ? (
            <button type="button" className="dt-linklike" onClick={() => actions.onOpen?.(row)}>
              {row.fileName}
            </button>
          ) : (
            <span className="dt-media__name">{row.fileName}</span>
          ),
      },
      {
        id: "scan",
        header: "Tarama",
        accessor: (row) => scanStateLabel(row.scanState),
        kind: "enum",
        sortable: true,
        filterable: true,
        groupable: true,
        // Not hideable: see the note above.
        hideable: false,
        options: (["unscanned", "pending", "clean", "infected", "failed", "unavailable"] as const).map(
          (state) => ({ value: scanStateLabel(state), label: scanStateLabel(state) }),
        ),
        cell: (row) => (
          <Badge
            tone={scanStateTone(row.scanState)}
            srDescription={scanStateExplanation(row.scanState)}
          >
            {scanStateLabel(row.scanState)}
          </Badge>
        ),
      },
      {
        id: "type",
        header: "Tür",
        accessor: (row) => mimeLabel(row.mimeType),
        kind: "enum",
        sortable: true,
        filterable: true,
        groupable: true,
        hideable: true,
      },
      {
        id: "size",
        header: "Boyut",
        accessor: (row) => row.sizeBytes,
        kind: "number",
        sortable: true,
        filterable: true,
        hideable: true,
        cell: (row) => formatBytes(row.sizeBytes),
      },
      {
        id: "lifecycle",
        header: "Yaşam döngüsü",
        accessor: (row) => lifecycleLabel(row.lifecycle),
        kind: "enum",
        sortable: true,
        filterable: true,
        groupable: true,
        hideable: true,
        options: (["active", "trashed", "purge-pending"] as const).map((state) => ({
          value: lifecycleLabel(state),
          label: lifecycleLabel(state),
        })),
      },
      {
        id: "hold",
        header: "Muhafaza",
        accessor: (row) => row.retention.legalHold,
        kind: "boolean",
        sortable: true,
        filterable: true,
        hideable: true,
        cell: (row) =>
          row.retention.legalHold ? (
            <Badge tone="warning" srDescription={row.retention.holdReason ?? "Gerekçe verilmedi"}>
              Hukuki muhafaza
            </Badge>
          ) : (
            <span className="dt-muted">—</span>
          ),
      },
      {
        id: "versions",
        header: "Sürüm",
        accessor: (row) => row.versionCount,
        kind: "number",
        sortable: true,
        hideable: true,
        cell: (row) => formatNumber(row.versionCount),
      },
      {
        id: "updated",
        header: "Güncellendi",
        accessor: (row) => row.updatedAt,
        kind: "date",
        sortable: true,
        filterable: true,
        hideable: true,
        cell: (row) => formatDateTime(row.updatedAt),
      },
      {
        id: "download",
        header: "İndirme",
        headerDescription: "Karantinadaki dosya indirilemez.",
        accessor: (row) => (isDownloadBlocked(row.scanState) ? "Kapalı" : "Açık"),
        kind: "enum",
        sortable: false,
        hideable: true,
        cell: (row) =>
          isDownloadBlocked(row.scanState) ? (
            <Badge tone="ineligible" srDescription="Zararlı bulundu; indirme kapalı.">
              Kapalı
            </Badge>
          ) : (
            <span className="dt-muted">Açık</span>
          ),
      },
    ],
  };
}

/** Version history, as a grid so it inherits the same affordances. */
export function mediaVersionsGridConfig(): GridConfig<MediaVersion> {
  return {
    id: "media-versions",
    schemaVersion: 1,
    caption: "Sürüm geçmişi",
    getRowId: (row) => String(row.versionNo),
    viewModes: ["table"],
    defaultSort: [{ columnId: "version", direction: "desc" }],
    emptyTitle: "Sürüm kaydı yok",
    emptyMessage: "Bu dosya için sürüm üstverisi verilmedi.",
    columns: [
      {
        id: "version",
        header: "Sürüm",
        accessor: (row) => row.versionNo,
        kind: "number",
        sortable: true,
        hideable: false,
        pinnable: true,
        cell: (row) => `v${row.versionNo}`,
      },
      {
        id: "hash",
        header: "İçerik özeti",
        accessor: (row) => row.contentHash,
        kind: "text",
        hideable: true,
        cell: (row) => <CopyableHash value={row.contentHash} label="İçerik özeti" />,
      },
      {
        id: "size",
        header: "Boyut",
        accessor: (row) => row.sizeBytes,
        kind: "number",
        sortable: true,
        hideable: true,
        cell: (row) => formatBytes(row.sizeBytes),
      },
      {
        id: "created",
        header: "Tarih",
        accessor: (row) => row.createdAt,
        kind: "date",
        sortable: true,
        hideable: true,
        cell: (row) => formatDateTime(row.createdAt),
      },
      { id: "author", header: "Ekleyen", accessor: (row) => row.authorLabel, kind: "text", hideable: true },
      { id: "note", header: "Not", accessor: (row) => row.note, kind: "text", hideable: true },
    ],
  };
}

/** Where an asset is used, so removing it is never a blind act. */
export function mediaReferencesGridConfig(): GridConfig<MediaReference> {
  return {
    id: "media-references",
    schemaVersion: 1,
    caption: "Kullanım ve referanslar",
    getRowId: (row) => row.id,
    viewModes: ["table"],
    emptyTitle: "Bu dosyaya bağlı kayıt yok",
    emptyMessage: "Referans üstverisi verilmedi; bağlı kayıt olmadığı anlamına gelmez.",
    columns: [
      {
        id: "subject",
        header: "Kayıt",
        accessor: (row) => row.subjectLabel,
        kind: "text",
        sortable: true,
        filterable: true,
        hideable: false,
        cell: (row) =>
          row.href ? <Link to={row.href}>{row.subjectLabel}</Link> : <span>{row.subjectLabel}</span>,
      },
      {
        id: "type",
        header: "Tür",
        accessor: (row) => row.subjectType,
        kind: "enum",
        sortable: true,
        filterable: true,
        groupable: true,
        hideable: true,
      },
    ],
  };
}

/** Version comparison is metadata-only: the client never diffs file bytes. */
export interface VersionComparison {
  readonly field: string;
  readonly left: string;
  readonly right: string;
  readonly changed: boolean;
}

export function compareVersions(left: MediaVersion, right: MediaVersion): readonly VersionComparison[] {
  const row = (field: string, a: string, b: string): VersionComparison => ({
    field,
    left: a,
    right: b,
    changed: a !== b,
  });
  return [
    row("Sürüm", `v${left.versionNo}`, `v${right.versionNo}`),
    row("İçerik özeti", left.contentHash.slice(0, 12), right.contentHash.slice(0, 12)),
    row("Boyut", formatBytes(left.sizeBytes), formatBytes(right.sizeBytes)),
    row("Tarih", formatDate(left.createdAt), formatDate(right.createdAt)),
    row("Ekleyen", left.authorLabel, right.authorLabel),
    row("Not", left.note, right.note),
  ];
}
