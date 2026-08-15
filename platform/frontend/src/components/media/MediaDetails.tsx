/**
 * The details pane: identity, safe preview shell, versions, comparison, usage.
 *
 * The preview is a *shell*, not a viewer, and the distinction is a security
 * one. Rendering arbitrary uploaded content inline is how a document library
 * becomes an XSS vector: an SVG is a script container, an HTML file is a whole
 * page, and a PDF in an `<iframe>` inherits more than most people expect. So
 * the shell renders a preview only for a short allowlist of inert image types,
 * only from a URL the caller supplies, and shows a described placeholder for
 * everything else.
 *
 * Nothing is previewed at all until a scan verdict exists, because "look at
 * this file to decide if it is safe" is exactly backwards.
 */

import { useState } from "react";

import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/intl";
import { Card, CopyableHash, DefinitionList, Tabs } from "../composites";
import { DataGrid } from "../data-grid/DataGrid";
import { EmptyState, PartialDataNotice } from "../patterns";
import { Badge } from "../primitives";
import { Select } from "../select";
import {
  compareVersions,
  mediaReferencesGridConfig,
  mediaVersionsGridConfig,
  mimeLabel,
} from "./configs";
import type { MediaAsset, MediaCapabilities, MediaVersion } from "./types";
import {
  formatBytes,
  hasScanVerdict,
  isDownloadBlocked,
  lifecycleLabel,
  scanStateExplanation,
  scanStateLabel,
  scanStateTone,
} from "./vocabulary";

/** Inert raster types only. No SVG, no HTML, no PDF. */
const PREVIEWABLE = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export interface MediaDetailsProps {
  readonly asset: MediaAsset;
  readonly capabilities: MediaCapabilities;
  readonly versions?: readonly MediaVersion[];
  /** Supplied by a host that has a real download route. Absent means no preview. */
  readonly previewUrl?: string;
  readonly className?: string;
}

function PreviewShell({ asset, previewUrl }: { asset: MediaAsset; previewUrl?: string }) {
  const inert = PREVIEWABLE.has(asset.mimeType);
  const blocked = isDownloadBlocked(asset.scanState);

  if (blocked) {
    return (
      <p className="dt-media-preview dt-media-preview--blocked">
        Bu dosya karantinada. Önizleme ve indirme kapalı.
      </p>
    );
  }
  if (!hasScanVerdict(asset.scanState)) {
    return (
      <p className="dt-media-preview dt-media-preview--pending">
        Önizleme yok: dosya taranmadı. Taranmamış bir dosyayı görüntüleyerek güvenliğine karar
        vermek doğru sıra değildir.
      </p>
    );
  }
  if (!inert) {
    return (
      <p className="dt-media-preview dt-media-preview--unsupported">
        {mimeLabel(asset.mimeType)} türü için satır içi önizleme üretilmiyor. Yalnızca hareketsiz
        görüntü türleri gömülü gösterilir.
      </p>
    );
  }
  if (!previewUrl) {
    return (
      <p className="dt-media-preview dt-media-preview--absent">
        Önizleme adresi verilmedi; indirme ucu olmadan görüntü getirilemez.
      </p>
    );
  }
  return (
    <img
      className="dt-media-preview__image"
      src={previewUrl}
      alt={`${asset.fileName} önizlemesi`}
      loading="lazy"
    />
  );
}

/** States: identity · preview-blocked/pending/unsupported/absent · versions · compare · usage. */
export function MediaDetails({
  asset,
  capabilities,
  versions = [],
  previewUrl,
  className,
}: MediaDetailsProps) {
  const [leftNo, setLeftNo] = useState<number | null>(versions[1]?.versionNo ?? null);
  const [rightNo, setRightNo] = useState<number | null>(versions[0]?.versionNo ?? null);

  const left = versions.find((version) => version.versionNo === leftNo);
  const right = versions.find((version) => version.versionNo === rightNo);
  const comparison = left && right ? compareVersions(left, right) : [];

  const versionOptions = versions.map((version) => ({
    value: String(version.versionNo),
    label: `v${version.versionNo}`,
  }));

  const identity = (
    <>
      <div className="dt-row dt-media__card-row">
        <Badge tone={scanStateTone(asset.scanState)} srDescription={scanStateExplanation(asset.scanState)}>
          {scanStateLabel(asset.scanState)}
        </Badge>
        <Badge tone="neutral">{mimeLabel(asset.mimeType)}</Badge>
        <Badge tone="neutral">{lifecycleLabel(asset.lifecycle)}</Badge>
      </div>
      <DefinitionList
        columns={2}
        items={[
          { term: "Dosya adı", description: asset.fileName },
          { term: "Boyut", description: formatBytes(asset.sizeBytes) },
          { term: "MIME", description: asset.mimeType },
          { term: "Sürüm sayısı", description: String(asset.versionCount) },
          { term: "Oluşturuldu", description: formatDateTime(asset.createdAt) },
          { term: "Güncellendi", description: formatDateTime(asset.updatedAt) },
          {
            term: "İçerik özeti",
            description: <CopyableHash value={asset.contentHash} label="İçerik özeti" />,
          },
          { term: "Açıklama", description: asset.description || "—" },
        ]}
      />
      <PreviewShell asset={asset} {...(previewUrl ? { previewUrl } : {})} />
    </>
  );

  const versionTab = versions.length === 0 ? (
    <EmptyState
      title="Sürüm üstverisi yok"
      reason="Sürüm tablosu ve ucu backend'de yok; bu ekrana sürüm verilmedi."
    />
  ) : (
    <>
      <DataGrid config={mediaVersionsGridConfig()} rows={versions} />
      <fieldset className="dt-media-compare__picker">
        <legend>Sürüm karşılaştırma</legend>
        {/*
         * The same platform-identical control the rest of the product uses.
         * Version numbers cross the control as strings and are parsed back on
         * the way out, exactly as they were with the native element's
         * `event.target.value`.
         */}
        <label htmlFor="cmp-left">Soldaki sürüm</label>
        <Select
          id="cmp-left"
          value={leftNo === null || leftNo === undefined ? "" : String(leftNo)}
          onValueChange={(value) => setLeftNo(Number(value))}
          options={versionOptions}
        />
        <label htmlFor="cmp-right">Sağdaki sürüm</label>
        <Select
          id="cmp-right"
          value={rightNo === null || rightNo === undefined ? "" : String(rightNo)}
          onValueChange={(value) => setRightNo(Number(value))}
          options={versionOptions}
        />
      </fieldset>

      <PartialDataNotice
        what="Karşılaştırma yalnızca üstveri düzeyindedir."
        because="Dosya içeriğinin farkı sunucuda üretilir; tarayıcı iki dosyayı karşılaştıramaz ve karşılaştırıyormuş gibi yapmaz."
      />

      {comparison.length > 0 ? (
        <table className="dt-table dt-media-compare">
          <caption className="dt-table__caption">
            v{left?.versionNo} ile v{right?.versionNo} üstveri karşılaştırması
          </caption>
          <thead>
            <tr>
              <th scope="col">Alan</th>
              <th scope="col">v{left?.versionNo}</th>
              <th scope="col">v{right?.versionNo}</th>
            </tr>
          </thead>
          <tbody>
            {comparison.map((row) => (
              <tr key={row.field} className={cn(row.changed && "is-changed")}>
                <th scope="row">{row.field}</th>
                <td>{row.left}</td>
                <td>
                  {row.right}
                  {row.changed ? <span className="dt-visually-hidden"> (değişti)</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </>
  );

  const usageTab =
    asset.references.length === 0 ? (
      <EmptyState
        title="Bağlı kayıt gösterilemiyor"
        reason="Referans ucu backend'de yok. Bu, dosyanın hiçbir yerde kullanılmadığı anlamına gelmez."
      />
    ) : (
      <DataGrid config={mediaReferencesGridConfig()} rows={asset.references} />
    );

  return (
    <Card
      title={asset.fileName}
      headingLevel={2}
      className={cn("dt-media-details", className)}
      footer={
        !capabilities.rangeDownload ? (
          <p className="dt-muted">
            İndirme ucu yok; bu ekrandan dosya indirilemez.
          </p>
        ) : null
      }
    >
      <Tabs
        label="Dosya ayrıntısı"
        items={[
          { value: "identity", label: "Künye", content: identity },
          { value: "versions", label: `Sürümler (${versions.length})`, content: versionTab },
          { value: "usage", label: `Kullanım (${asset.references.length})`, content: usageTab },
        ]}
      />
    </Card>
  );
}
