/**
 * Governance: scan verdict, access, audit trail, lifecycle and retention.
 *
 * Four rules are enforced here rather than left to the caller:
 *
 * 1. An unscanned file is *named* as unscanned. Silence would be read as
 *    "fine", and this panel is the last place that mistake can be caught.
 * 2. A permission the host did not grant renders as a disabled control with the
 *    reason, never as a missing one. A user who cannot see why also cannot ask.
 * 3. Legal hold outranks retention. If a hold is on, purge is refused whatever
 *    the retention date says, and the panel states that ordering explicitly.
 * 4. The audit list is labelled as *not* an audit trail, because nothing here
 *    is persisted. A client-side list of things that happened this session is a
 *    log of a page, not a record of a system.
 */

import { formatDate, formatDateTime } from "@/lib/intl";
import { cn } from "@/lib/cn";
import { Card, DefinitionList, Timeline } from "../composites";
import { EmptyState, PartialDataNotice } from "../patterns";
import { Badge, Button } from "../primitives";
import { mediaCapabilityById } from "./capabilities";
import type { MediaAsset, MediaAuditEntry, MediaCapabilities } from "./types";
import { lifecycleLabel, scanStateExplanation, scanStateLabel, scanStateTone } from "./vocabulary";

export interface MediaGovernanceProps {
  readonly asset: MediaAsset;
  readonly capabilities: MediaCapabilities;
  readonly audit?: readonly MediaAuditEntry[];
  readonly onTrash?: () => void;
  readonly onRestore?: () => void;
  readonly onPurge?: () => void;
  readonly onToggleLegalHold?: () => void;
  readonly onRescan?: () => void;
  readonly className?: string;
}

/** A control the host may not use yet: disabled, with the reason spelled out. */
function GatedAction({
  label,
  capabilityId,
  permitted,
  onClick,
  destructive = false,
  extraBlock,
}: {
  label: string;
  capabilityId: string;
  permitted: boolean;
  onClick?: (() => void) | undefined;
  destructive?: boolean;
  extraBlock?: string | undefined;
}) {
  const capability = mediaCapabilityById(capabilityId);
  const reason = extraBlock
    ? extraBlock
    : !permitted
      ? "Bu işlem için yetkiniz tanımlı değil."
      : capability && !capability.enabled
        ? capability.reason
        : !onClick
          ? "Bu ekran bu eylemi devralmadı."
          : null;

  return (
    <span className="dt-media-gov__action">
      <Button
        variant={destructive ? "danger" : "secondary"}
        size="sm"
        disabled={reason !== null}
        {...(reason ? { "aria-describedby": `gate-${capabilityId}-${label}` } : {})}
        onClick={() => onClick?.()}
      >
        {label}
      </Button>
      {reason ? (
        <span id={`gate-${capabilityId}-${label}`} className="dt-media-gov__reason">
          {reason}
        </span>
      ) : null}
    </span>
  );
}

/**
 * States: unscanned · pending · clean · infected · failed · unavailable ·
 * active · trashed · legal-hold · read-only.
 */
export function MediaGovernancePanel({
  asset,
  capabilities,
  audit = [],
  onTrash,
  onRestore,
  onPurge,
  onToggleLegalHold,
  onRescan,
  className,
}: MediaGovernanceProps) {
  const { permissions } = capabilities;
  const hold = asset.retention.legalHold;
  const isTrashed = asset.lifecycle === "trashed";

  return (
    <div className={cn("dt-media-gov", className)}>
      <Card title="Tarama ve karantina" headingLevel={3}>
        <div className="dt-row dt-media__card-row">
          <Badge tone={scanStateTone(asset.scanState)} srDescription={scanStateExplanation(asset.scanState)}>
            {scanStateLabel(asset.scanState)}
          </Badge>
        </div>
        <p className="dt-media-gov__explain">{scanStateExplanation(asset.scanState)}</p>
        {!capabilities.antivirus ? (
          <PartialDataNotice
            what="Bu kurulumda hiçbir dosya taranmıyor."
            because="Kötücül yazılım tarayıcısı ucu yok. Bu yüzden dosyalar 'taranmadı' olarak gösterilir; 'temiz' denmez."
          />
        ) : null}
        <GatedAction
          label="Yeniden tara"
          capabilityId="antivirus"
          permitted
          {...(onRescan ? { onClick: onRescan } : {})}
        />
      </Card>

      <Card title="Erişim ve yetki" headingLevel={3}>
        {!capabilities.rbac ? (
          <PartialDataNotice
            what="Rol tabanlı yetki yok."
            because="Rol modeli backend'de tanımlı değil. İzinler bu ekrana dışarıdan verilir ve verilmediğinde kapalı kabul edilir."
          />
        ) : null}
        <DefinitionList
          columns={2}
          items={[
            { term: "Yükleme", description: permissions.canUpload ? "İzinli" : "Kapalı" },
            { term: "İndirme", description: permissions.canDownload ? "İzinli" : "Kapalı" },
            { term: "Üstveri düzenleme", description: permissions.canEditMetadata ? "İzinli" : "Kapalı" },
            { term: "Çöp kutusu", description: permissions.canTrash ? "İzinli" : "Kapalı" },
            { term: "Geri alma", description: permissions.canRestore ? "İzinli" : "Kapalı" },
            { term: "Kalıcı silme", description: permissions.canPurge ? "İzinli" : "Kapalı" },
            {
              term: "Hukuki muhafaza",
              description: permissions.canManageLegalHold ? "İzinli" : "Kapalı",
            },
          ]}
        />
      </Card>

      <Card title="Yaşam döngüsü, saklama ve muhafaza" headingLevel={3}>
        <div className="dt-row dt-media__card-row">
          <Badge tone="neutral">{lifecycleLabel(asset.lifecycle)}</Badge>
          {hold ? (
            <Badge tone="warning" srDescription={asset.retention.holdReason ?? "Gerekçe verilmedi"}>
              Hukuki muhafaza açık
            </Badge>
          ) : null}
        </div>

        <DefinitionList
          items={[
            {
              term: "Saklama bitişi",
              description: asset.retention.retainUntil
                ? formatDate(asset.retention.retainUntil)
                : "Tanımlı değil",
            },
            {
              term: "Muhafaza gerekçesi",
              description: asset.retention.holdReason ?? "—",
            },
          ]}
        />

        <p className="dt-media-gov__rule">
          Hukuki muhafaza saklama süresini ezer: muhafaza açıkken saklama süresi dolmuş olsa bile
          kalıcı silme yapılamaz.
        </p>

        <div className="dt-media-gov__actions">
          {isTrashed ? (
            <GatedAction
              label="Geri al"
              capabilityId="durable-metadata"
              permitted={permissions.canRestore}
              {...(onRestore ? { onClick: onRestore } : {})}
            />
          ) : (
            <GatedAction
              label="Çöp kutusuna taşı"
              capabilityId="durable-metadata"
              permitted={permissions.canTrash}
              destructive
              {...(onTrash ? { onClick: onTrash } : {})}
            />
          )}

          <GatedAction
            label="Kalıcı olarak sil"
            capabilityId="retention-purge"
            permitted={permissions.canPurge}
            destructive
            {...(hold ? { extraBlock: "Hukuki muhafaza açık; kalıcı silme engellendi." } : {})}
            {...(onPurge ? { onClick: onPurge } : {})}
          />

          <GatedAction
            label={hold ? "Muhafazayı kaldır" : "Muhafaza uygula"}
            capabilityId="legal-hold"
            permitted={permissions.canManageLegalHold}
            {...(onToggleLegalHold ? { onClick: onToggleLegalHold } : {})}
          />
        </div>
      </Card>

      <Card title="Denetim izi" headingLevel={3}>
        <PartialDataNotice
          what="Bu liste bir denetim izi değildir."
          because="Denetim yazma ucu yok. Burada görünenler bu ekrana verilen üstveridir; kalıcı ve değiştirilemez bir kayıt sunucuda tutulmalıdır."
        />
        {audit.length === 0 ? (
          <EmptyState title="Kayıt yok" reason="Bu dosya için denetim üstverisi verilmedi." />
        ) : (
          <Timeline
            label="Dosya olayları"
            entries={audit.map((entry) => ({
              id: entry.id,
              title: entry.action,
              timestamp: formatDateTime(entry.occurredAt),
              detail: `${entry.actorLabel} — ${entry.detail}`,
            }))}
          />
        )}
      </Card>
    </div>
  );
}
