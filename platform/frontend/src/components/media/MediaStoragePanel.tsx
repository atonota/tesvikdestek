/**
 * Storage status and capacity.
 *
 * Local durable storage is the product's default and its complete answer: a
 * single Hetzner node with a real filesystem needs no object-store vendor to be
 * production-capable. S3 is strictly optional, and "optional" is enforced two
 * ways here - no S3 surface renders unless an injected capability says the
 * backend has one, and no AWS package exists in this project to render it with.
 *
 * Every number on this panel is injected. A browser cannot see a disk, so a
 * component that computed capacity would be inventing it; `null` renders as an
 * em dash rather than a confident zero.
 */

import { cn } from "@/lib/cn";
import { formatDateTime, formatNumber } from "@/lib/intl";
import { Card, DefinitionList } from "../composites";
import { PartialDataNotice } from "../patterns";
import { Badge } from "../primitives";
import { isS3Available, storageTargets } from "./capabilities";
import type { MediaCapabilities, StorageStatus } from "./types";
import { formatBytes, storageBackendLabel } from "./vocabulary";

export interface MediaStoragePanelProps {
  readonly storage: StorageStatus;
  readonly capabilities: MediaCapabilities;
  readonly className?: string;
}

function usageRatio(status: StorageStatus): number | null {
  if (status.usedBytes === null || status.quotaBytes === null || status.quotaBytes === 0) return null;
  return Math.min(1, status.usedBytes / status.quotaBytes);
}

/**
 * States: local-only (default) · s3-available · s3-unhealthy · quota-unknown ·
 * quota-exceeded.
 */
export function MediaStoragePanel({ storage, capabilities, className }: MediaStoragePanelProps) {
  const targets = storageTargets(capabilities);
  const s3 = isS3Available(capabilities);
  const ratio = usageRatio(storage);
  const full = ratio !== null && ratio >= 1;
  const nearlyFull = ratio !== null && ratio >= 0.9 && !full;

  return (
    <section className={cn("dt-media-storage", className)} aria-label="Depolama durumu">
      <Card title="Depolama" headingLevel={3}>
        <ul className="dt-media-storage__targets" aria-label="Depolama hedefleri">
          {targets.map((target) => (
            <li key={target.id} className="dt-media-storage__target">
              <span className="dt-media-storage__target-name">
                {storageBackendLabel(target.id)}
              </span>
              {target.isDefault ? <Badge tone="accent">Varsayılan</Badge> : null}
              <p className="dt-muted">{target.description}</p>
            </li>
          ))}
        </ul>

        <DefinitionList
          columns={2}
          items={[
            { term: "Etkin hedef", description: storageBackendLabel(storage.backend) },
            { term: "Kullanılan", description: formatBytes(storage.usedBytes) },
            {
              term: "Kota",
              description: storage.quotaBytes === null ? "Tanımsız" : formatBytes(storage.quotaBytes),
            },
            {
              term: "Dosya sayısı",
              description: storage.assetCount === null ? "—" : formatNumber(storage.assetCount),
            },
            {
              term: "Son kontrol",
              description: storage.lastCheckedAt ? formatDateTime(storage.lastCheckedAt) : "—",
            },
          ]}
        />

        {ratio !== null ? (
          <>
            <progress
              className="dt-media-storage__meter"
              max={100}
              value={Math.round(ratio * 100)}
              aria-label="Depolama doluluk oranı"
            >
              {Math.round(ratio * 100)}%
            </progress>
            <p className={cn("dt-media-storage__ratio", full && "is-full")} aria-live="polite">
              {full
                ? "Kota dolu. Yeni yükleme kabul edilmemelidir."
                : nearlyFull
                  ? `Doluluk %${Math.round(ratio * 100)} — kota sınırına yaklaşıldı.`
                  : `Doluluk %${Math.round(ratio * 100)}.`}
            </p>
          </>
        ) : (
          <p className="dt-muted">Kota tanımsız olduğu için doluluk oranı hesaplanmıyor.</p>
        )}

        {!capabilities.quotaEnforcement ? (
          <PartialDataNotice
            what="Kota burada gösterilir ama uygulanmaz."
            because="Kotayı yalnızca sunucu uygulayabilir. İstemcideki bir sayaç sınır değildir; gerçek sınır yazma anında sunucuda konur."
          />
        ) : null}
      </Card>

      {s3 && storage.s3 ? (
        <Card title="S3 uyumlu depolama" headingLevel={3} tone="sunken">
          <DefinitionList
            items={[
              { term: "Uç", description: storage.s3.endpointLabel },
              {
                term: "Sağlık",
                description: storage.s3.healthy ? (
                  <Badge tone="candidate">Sağlıklı bildirildi</Badge>
                ) : (
                  <Badge tone="ineligible">Sağlıksız bildirildi</Badge>
                ),
              },
              {
                term: "Son hata",
                description: storage.s3.lastErrorAt ? formatDateTime(storage.s3.lastErrorAt) : "—",
              },
            ]}
          />
          <p className="dt-muted">
            Bu bilgiler dışarıdan enjekte edilir. Bu paket S3'e bağlanmaz ve hiçbir AWS bağımlılığı
            içermez; adaptör backend'e aittir.
          </p>
        </Card>
      ) : null}
    </section>
  );
}
