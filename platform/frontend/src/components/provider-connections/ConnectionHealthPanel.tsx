/**
 * One connection, described honestly.
 *
 * Every number on this panel is injected. A browser cannot probe a provider,
 * cannot count tokens against a rate limit and cannot read a bill, so a
 * component that computed any of it would be inventing it; `null` renders as an
 * em dash rather than a confident zero.
 *
 * The status shown is the *derived* one. A record that still says `connected`
 * while its expiry has passed is rendered as expired, because a backend that
 * has not re-probed yet is not evidence of health - and the moment a screen
 * says "connected" about a lapsed credential is the moment someone schedules a
 * job against it.
 *
 * The three actions are gated twice, and the disabled copy names which half is
 * missing: "you are not allowed to" and "the server cannot do this" are
 * different problems for the person at the screen, and a uniformly grey button
 * tells them neither.
 */

import { cn } from "@/lib/cn";
import { formatDateTime, formatNumber } from "@/lib/intl";
import { Card, DefinitionList, Timeline } from "../composites";
import { PartialDataNotice } from "../patterns";
import { Badge, Button } from "../primitives";
import { actionOfferability } from "./capabilities";
import { providerById } from "./catalog";
import type {
  ProviderAuditEntry,
  ProviderConnection,
  ProviderConnectionCapabilities,
  ProviderConnectionPort,
} from "./types";
import {
  auditActionLabel,
  connectionStatusExplanation,
  connectionStatusLabel,
  connectionStatusTone,
  daysUntilExpiry,
  effectiveStatus,
  methodLabel,
  needsAttention,
} from "./vocabulary";

export interface ConnectionHealthPanelProps {
  readonly connection: ProviderConnection;
  readonly capabilities: ProviderConnectionCapabilities;
  readonly port?: ProviderConnectionPort;
  /** Entries for this connection. Display only; nothing here writes an audit. */
  readonly audit?: readonly ProviderAuditEntry[];
  readonly now?: Date;
  readonly className?: string;
}

/**
 * States: connected · degraded · expired (stored or derived) · revoked · error ·
 * pending · disconnected · read-only (no permission) · blocked (no backend).
 */
export function ConnectionHealthPanel({
  connection,
  capabilities,
  port,
  audit = [],
  now = new Date(),
  className,
}: ConnectionHealthPanelProps) {
  const status = effectiveStatus(connection, now);
  const provider = providerById(connection.providerId);
  const remainingDays = daysUntilExpiry(connection, now);

  const reverify = actionOfferability(capabilities, "canReverify", "healthProbe", port?.reverify);
  const rotate = actionOfferability(
    capabilities,
    "canRotate",
    "credentialRotation",
    port?.rotate,
  );
  const revoke = actionOfferability(capabilities, "canRevoke", "revocation", port?.revoke);

  const drifted = connection.status !== status;

  return (
    <section
      className={cn("dt-provider-health", className)}
      aria-label={`${connection.label} bağlantı durumu`}
    >
      <Card
        title={connection.label}
        headingLevel={3}
        tone={needsAttention(connection, now) ? "warning" : "default"}
        actions={
          <Badge tone={connectionStatusTone(status)} srDescription={connectionStatusExplanation(status)}>
            {connectionStatusLabel(status)}
          </Badge>
        }
      >
        <DefinitionList
          columns={2}
          items={[
            { term: "Sağlayıcı", description: provider?.name ?? connection.providerId },
            { term: "Yöntem", description: methodLabel(connection.method) },
            { term: "Kimlik ipucu", description: connection.maskedHint ?? "—" },
            {
              term: "Son kontrol",
              description: connection.lastCheckedAt
                ? formatDateTime(connection.lastCheckedAt)
                : "Hiç yoklanmadı",
            },
            {
              term: "Bitiş",
              description:
                connection.expiresAt === null
                  ? "Tanımsız"
                  : `${formatDateTime(connection.expiresAt)}${
                      remainingDays === null
                        ? ""
                        : remainingDays >= 0
                          ? ` (${formatNumber(remainingDays)} gün kaldı)`
                          : " (geçti)"
                    }`,
            },
            {
              term: "Kapsamlar",
              description: connection.scopes.length > 0 ? connection.scopes.join(", ") : "Bildirilmedi",
            },
            {
              term: "İzin verilen modeller",
              description:
                connection.modelAllowlist.length > 0
                  ? connection.modelAllowlist.join(", ")
                  : "Sunucunun varsayılanı",
            },
            { term: "Oluşturan", description: connection.createdByLabel },
          ]}
        />

        {connection.statusReason ? (
          <p className="dt-provider-health__reason">{connection.statusReason}</p>
        ) : null}

        {drifted ? (
          <PartialDataNotice
            what="Kayıtlı durum ile gösterilen durum farklı."
            because={`Sunucunun son bildirdiği durum "${connectionStatusLabel(
              connection.status,
            )}", ancak bitiş tarihi geçmiş. Yeni bir yoklama gelene kadar geçerli sayılan durum "${connectionStatusLabel(
              status,
            )}" olmalıdır.`}
          />
        ) : null}

        <div className="dt-provider-health__actions">
          <GatedButton label="Yeniden doğrula" gate={reverify} onRun={() => port?.reverify?.(connection.id)} />
          <GatedButton
            label="Anahtarı döndür"
            gate={rotate}
            onRun={() => port?.rotate?.(connection.id)}
          />
          <GatedButton
            label="Bağlantıyı iptal et"
            gate={revoke}
            destructive
            onRun={() => port?.revoke?.(connection.id, "Operatör iptal etti.")}
          />
        </div>
      </Card>

      <Card title="Hız sınırları ve bütçe" headingLevel={3} tone="sunken">
        {connection.rateLimits.length === 0 ? (
          <p className="dt-muted">Bu bağlantı için hız sınırı bildirilmedi.</p>
        ) : (
          <DefinitionList
            columns={2}
            items={connection.rateLimits.map((window) => ({
              term: window.label,
              description: `${window.used === null ? "—" : formatNumber(window.used)} / ${
                window.limit === null ? "—" : formatNumber(window.limit)
              }${window.resetsAt ? ` · sıfırlanma ${formatDateTime(window.resetsAt)}` : ""}`,
            }))}
          />
        )}

        {connection.budget ? (
          <DefinitionList
            items={[
              {
                term: `Harcama (${connection.budget.periodLabel})`,
                description: `${
                  connection.budget.spentMinorUnits === null
                    ? "—"
                    : formatNumber(connection.budget.spentMinorUnits / 100)
                } / ${
                  connection.budget.budgetMinorUnits === null
                    ? "—"
                    : formatNumber(connection.budget.budgetMinorUnits / 100)
                } ${connection.budget.currency}`,
              },
            ]}
          />
        ) : (
          <p className="dt-muted">Bu bağlantı için bütçe bildirilmedi.</p>
        )}

        <PartialDataNotice
          what="Bu sayılar burada gösterilir ama uygulanmaz."
          because="Hız sınırını ve bütçeyi yalnızca sunucu uygulayabilir. İstemcideki bir sayaç harcamayı durdurmaz; gerçek sınır çağrı anında sunucuda konur."
        />
      </Card>

      {audit.length > 0 ? (
        <Card title="Bu bağlantının geçmişi" headingLevel={3} tone="sunken">
          <Timeline
            label={`${connection.label} denetim izi`}
            entries={audit.map((entry) => ({
              id: entry.id,
              title: `${auditActionLabel(entry.action)} — ${entry.actorLabel}`,
              timestamp: formatDateTime(entry.occurredAt),
              detail: entry.detail,
            }))}
          />
        </Card>
      ) : null}
    </section>
  );
}

/**
 * A button that is disabled with a stated reason rather than silently inert.
 *
 * The reason sits next to the control, not in a tooltip: a tooltip is invisible
 * to the keyboard user who just tabbed onto a button that does nothing.
 */
function GatedButton({
  label,
  gate,
  onRun,
  destructive = false,
}: {
  readonly label: string;
  readonly gate: { readonly offerable: boolean; readonly reason: string | null };
  readonly onRun: () => void;
  readonly destructive?: boolean;
}) {
  return (
    <span className="dt-provider-health__action">
      <Button
        variant={destructive ? "danger" : "secondary"}
        disabled={!gate.offerable}
        onClick={onRun}
      >
        {label}
      </Button>
      {gate.reason ? <span className="dt-provider-health__blocked">{gate.reason}</span> : null}
    </span>
  );
}
