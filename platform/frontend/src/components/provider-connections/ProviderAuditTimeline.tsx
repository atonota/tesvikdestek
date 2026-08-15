/**
 * The audit timeline.
 *
 * Read-only, and loudly so. There is no audit-writing endpoint in this
 * repository, and a list a client keeps in its own memory is not an audit
 * trail - it is a list that disappears when the tab closes and that nobody can
 * later prove was not edited. So this component renders what a host hands it
 * and states plainly that persistence lives elsewhere.
 *
 * The empty state is deliberately not "no activity". An empty audit view means
 * *this screen received no entries*, which is a different fact from "nothing
 * happened", and conflating them is how an absent integration reads as a clean
 * record.
 */

import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/intl";
import { Card, Timeline } from "../composites";
import { EmptyState, PartialDataNotice, SkeletonBlock } from "../patterns";
import { hasBackend, hasPermission } from "./capabilities";
import type {
  ProviderAuditEntry,
  ProviderConnectionCapabilities,
  ProviderSurfaceStatus,
} from "./types";
import { auditActionLabel } from "./vocabulary";

export interface ProviderAuditTimelineProps {
  readonly entries: readonly ProviderAuditEntry[];
  readonly capabilities: ProviderConnectionCapabilities;
  readonly status?: ProviderSurfaceStatus;
  readonly className?: string;
}

/** States: idle · loading · empty · read-only · error · permission-denied. */
export function ProviderAuditTimeline({
  entries,
  capabilities,
  status = "idle",
  className,
}: ProviderAuditTimelineProps) {
  if (!hasPermission(capabilities, "canViewAudit")) {
    // Not `PermissionDenied`: that pattern is about being signed out, and
    // telling a signed-in operator to log in would send them round a loop that
    // cannot end. This is an authorisation gap, and it is named as one.
    return (
      <EmptyState
        title="Denetim izi gösterilmiyor"
        reason="Denetim izini görüntüleme yetkiniz tanımlı değil. Yetki, bu ekranın değil kurulumun kararıdır."
      />
    );
  }

  return (
    <section className={cn("dt-provider-audit", className)} aria-label="Bağlantı denetim izi">
      <Card title="Denetim izi" headingLevel={3}>
        {status === "loading" ? (
          <SkeletonBlock lines={4} label="Denetim izi yükleniyor" />
        ) : entries.length === 0 ? (
          <EmptyState
            title="Bu ekrana hiç kayıt verilmedi"
            reason="Bu, hiçbir şey olmadığı anlamına gelmez. Kayıtları saklayan ve döndüren bir uç olmadığı sürece bu liste boş kalır."
          />
        ) : (
          <Timeline
            label="Sağlayıcı bağlantı olayları"
            entries={entries.map((entry) => ({
              id: entry.id,
              title: `${auditActionLabel(entry.action)} — ${entry.actorLabel}`,
              timestamp: formatDateTime(entry.occurredAt),
              detail: entry.detail,
            }))}
          />
        )}

        {hasBackend(capabilities, "auditPersistence") ? null : (
          <PartialDataNotice
            what="Bu liste kalıcı bir denetim izi değildir."
            because="Denetim kaydı yazan bir uç yok. Burada görünen satırlar çağıranın verdiği üstveridir; sayfa kapandığında geriye kanıt kalmaz."
          />
        )}
      </Card>
    </section>
  );
}
