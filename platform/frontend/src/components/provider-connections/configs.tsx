/**
 * The typed grid configuration for the connection inventory.
 *
 * Declared here for the same reason every other table in this codebase is: a
 * hand-written `<table>` gets its caption, scoped headers, column control and
 * card fallback right once and wrong the next time. Going through `GridConfig`
 * means this surface inherits the grid's accessibility and state handling
 * instead of re-earning them - including the grid's own honesty about scope,
 * which is that everything it does happens over the rows it was given.
 *
 * The status column renders the *derived* status, which is why the factory
 * takes a clock. A table that printed the stored `connected` for a credential
 * that expired last week would be the single most misleading cell in the
 * product, and it would look completely fine.
 *
 * Bulk actions are hooks, not implementations. This package runs no mutation:
 * every action is handed to the caller, and one whose backend or permission is
 * missing is declared `allowed: false` with the reason attached rather than
 * hidden - a missing button teaches nobody why it is missing.
 */

import { formatDateTime } from "@/lib/intl";
import { Badge } from "../primitives";
import type { BulkAction, GridConfig } from "../data-grid/types";
import { actionOfferability } from "./capabilities";
import { providerById } from "./catalog";
import type {
  ConnectionStatus,
  ProviderConnection,
  ProviderConnectionCapabilities,
  ProviderConnectionPort,
} from "./types";
import {
  connectionStatusExplanation,
  connectionStatusLabel,
  connectionStatusTone,
  effectiveStatus,
  methodLabel,
} from "./vocabulary";

const STATUS_OPTIONS: readonly ConnectionStatus[] = [
  "disconnected",
  "pending",
  "connected",
  "degraded",
  "expired",
  "revoked",
  "error",
];

export interface ProviderGridActions {
  readonly onOpen?: (connection: ProviderConnection) => void;
}

/**
 * Bulk actions, gated by three things at once: the injected permission, the
 * backend capability, and whether this screen took the callback. Any one
 * missing disables the control and supplies the reason; none of them silently
 * removes it.
 *
 * Every label names the selection, never the result set. "Seçili bağlantıları"
 * is a promise this client can keep; "tüm eşleşen bağlantıları" is not, because
 * the client has no idea what else exists on the server.
 */
export function providerBulkActions(
  capabilities: ProviderConnectionCapabilities,
  port: ProviderConnectionPort,
): readonly BulkAction<ProviderConnection>[] {
  const build = (
    id: string,
    label: string,
    permission: Parameters<typeof actionOfferability>[1],
    backend: Parameters<typeof actionOfferability>[2],
    run: ((rows: readonly ProviderConnection[]) => void) | undefined,
    destructive = false,
  ): BulkAction<ProviderConnection> => {
    const gate = actionOfferability(capabilities, permission, backend, run);
    return {
      id,
      label,
      run: run ?? (() => undefined),
      allowed: gate.offerable,
      ...(gate.reason ? { reason: gate.reason } : {}),
      destructive,
    };
  };

  return [
    build(
      "reverify",
      "Seçili bağlantıları yeniden doğrula",
      "canReverify",
      "healthProbe",
      port.reverify
        ? (rows) => rows.forEach((row) => port.reverify?.(row.id))
        : undefined,
    ),
    build(
      "rotate",
      "Seçili bağlantıların anahtarını döndür",
      "canRotate",
      "credentialRotation",
      port.rotate ? (rows) => rows.forEach((row) => port.rotate?.(row.id)) : undefined,
    ),
    build(
      "revoke",
      "Seçili bağlantıları iptal et",
      "canRevoke",
      "revocation",
      port.revoke
        ? (rows) => rows.forEach((row) => port.revoke?.(row.id, "Toplu iptal."))
        : undefined,
      true,
    ),
  ];
}

export function providerConnectionsGridConfig(
  capabilities: ProviderConnectionCapabilities,
  now: Date,
  port: ProviderConnectionPort = {},
  actions: ProviderGridActions = {},
): GridConfig<ProviderConnection> {
  const statusOf = (row: ProviderConnection) => effectiveStatus(row, now);

  return {
    id: "provider-connections",
    schemaVersion: 1,
    caption: "Sağlayıcı bağlantı envanteri (yalnızca bu oturumda yüklenmiş satırlar)",
    getRowId: (row) => row.id,
    viewModes: ["table", "card"],
    defaultViewMode: "table",
    selectable: true,
    defaultSort: [{ columnId: "label", direction: "asc" }],
    emptyTitle: "Bağlı sağlayıcı yok",
    emptyMessage:
      "Hiçbir sağlayıcı kendiliğinden bağlanmaz. Bağlantı kurulana kadar bu tablo boş kalır.",
    noResultsTitle: "Sonuç bulunamadı",
    noResultsMessage: "Arama ve filtreler birlikte yüklenmiş satırların hiçbirini bırakmadı.",
    bulkActions: providerBulkActions(capabilities, port),
    ...(actions.onOpen
      ? {
          rowActions: [
            {
              id: "open",
              label: "Ayrıntı",
              run: (row: ProviderConnection) => actions.onOpen?.(row),
            },
          ],
        }
      : {}),
    renderCard: (row) => (
      <div className="dt-provider-inventory__card">
        <strong>{row.label}</strong>
        <Badge tone={connectionStatusTone(statusOf(row))}>{connectionStatusLabel(statusOf(row))}</Badge>
        <span className="dt-muted">
          {providerById(row.providerId)?.name ?? row.providerId} · {methodLabel(row.method)}
        </span>
      </div>
    ),
    columns: [
      {
        id: "label",
        header: "Bağlantı",
        accessor: (row) => row.label,
        kind: "text",
        sortable: true,
        filterable: true,
      },
      {
        id: "provider",
        header: "Sağlayıcı",
        accessor: (row) => providerById(row.providerId)?.name ?? row.providerId,
        kind: "enum",
        options: [
          { value: "Google Gemini", label: "Google Gemini" },
          { value: "OpenAI / ChatGPT", label: "OpenAI / ChatGPT" },
          { value: "Claude", label: "Claude" },
          { value: "OpenClaw", label: "OpenClaw" },
        ],
        sortable: true,
        filterable: true,
        groupable: true,
      },
      {
        id: "method",
        header: "Yöntem",
        accessor: (row) => methodLabel(row.method),
        kind: "text",
        sortable: true,
        filterable: true,
        groupable: true,
      },
      {
        /**
         * Not hideable, and not the stored value.
         *
         * An inventory where the status column can be switched off is an
         * inventory that will eventually be read without it.
         */
        id: "status",
        header: "Durum",
        accessor: (row) => connectionStatusLabel(statusOf(row)),
        cell: (row) => (
          <Badge
            tone={connectionStatusTone(statusOf(row))}
            srDescription={connectionStatusExplanation(statusOf(row))}
          >
            {connectionStatusLabel(statusOf(row))}
          </Badge>
        ),
        kind: "enum",
        options: STATUS_OPTIONS.map((status) => ({
          value: connectionStatusLabel(status),
          label: connectionStatusLabel(status),
        })),
        sortable: true,
        filterable: true,
        groupable: true,
        hideable: false,
      },
      {
        id: "lastChecked",
        header: "Son kontrol",
        accessor: (row) => row.lastCheckedAt ?? "",
        cell: (row) => (row.lastCheckedAt ? formatDateTime(row.lastCheckedAt) : "Hiç yoklanmadı"),
        kind: "date",
        sortable: true,
        filterable: true,
      },
      {
        id: "expiresAt",
        header: "Bitiş",
        accessor: (row) => row.expiresAt ?? "",
        cell: (row) => (row.expiresAt ? formatDateTime(row.expiresAt) : "Tanımsız"),
        kind: "date",
        sortable: true,
        filterable: true,
      },
      {
        id: "models",
        header: "Model listesi",
        accessor: (row) =>
          row.modelAllowlist.length > 0 ? row.modelAllowlist.join(", ") : "Sunucunun varsayılanı",
        kind: "text",
        filterable: true,
        hiddenByDefault: true,
      },
      {
        id: "scopes",
        header: "Kapsamlar",
        accessor: (row) => (row.scopes.length > 0 ? row.scopes.join(", ") : "Bildirilmedi"),
        kind: "text",
        filterable: true,
        hiddenByDefault: true,
      },
      {
        id: "createdBy",
        header: "Oluşturan",
        accessor: (row) => row.createdByLabel,
        kind: "text",
        sortable: true,
        filterable: true,
        hiddenByDefault: true,
      },
    ],
  };
}
