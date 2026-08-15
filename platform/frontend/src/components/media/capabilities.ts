/**
 * The media capability ledger.
 *
 * Two axes, kept apart on purpose:
 *
 *   `ui`      - does the component exist and work? This package delivers that.
 *   `backend` - can a server actually do it today? For most of this list, no.
 *
 * Collapsing the two is how a component library starts lying: a finished
 * uploader with no endpoint behind it is *ready* and *blocked* at the same
 * time, and only saying both is honest. `enabled` is the conjunction, and it is
 * the only field a component may consult when deciding to render a live
 * control.
 *
 * There is no media backend in this repository: no table, no route, no storage
 * adapter. Every entry whose backend is `blocked` names the reason.
 */

import type {
  MediaCapabilities,
  MediaCapability,
  StorageBackendId,
  StorageTarget,
} from "./types";

/**
 * The honest default a host gets when it injects nothing.
 *
 * Durable local object storage is the declared target, and every server-side
 * feature is off. Permissions are all false: an absent authorisation system
 * must read as "not permitted".
 */
export const LOCAL_ONLY_CAPABILITIES: MediaCapabilities = {
  storage: { local: { available: true } },
  streamingUpload: false,
  rangeDownload: false,
  durableMetadata: false,
  antivirus: false,
  derivatives: false,
  auditPersistence: false,
  rbac: false,
  quotaEnforcement: false,
  retentionPurge: false,
  permissions: {
    canUpload: false,
    canEditMetadata: false,
    canDownload: false,
    canTrash: false,
    canRestore: false,
    canPurge: false,
    canManageLegalHold: false,
  },
};

function entry(
  id: string,
  title: string,
  ui: MediaCapability["ui"],
  backend: MediaCapability["backend"],
  reason: string,
): MediaCapability {
  return { id, title, ui, backend, enabled: ui === "ready" && backend === "available", reason };
}

export const MEDIA_CAPABILITIES: readonly MediaCapability[] = [
  /* --- component surfaces that need nothing from a server ---------------- */
  entry(
    "library-workbench",
    "Kütüphane tezgâhı (tablo ve kart)",
    "ready",
    "available",
    "Kabul edilmiş DataGrid üzerinde çalışır; verilen satırlar üzerinde tamdır.",
  ),
  entry(
    "typed-columns",
    "Tipli sütun, arama, filtre, sıralama, gruplama",
    "ready",
    "available",
    "DataGrid boru hattı; yalnızca verilen satırlar kapsamındadır.",
  ),
  entry(
    "selection-bulk-hooks",
    "Seçim ve izne duyarlı toplu eylem kancaları",
    "ready",
    "available",
    "Eylemler çağırana devredilir; bu paket hiçbir mutasyon çalıştırmaz.",
  ),
  entry(
    "folder-tree",
    "Klasör ve koleksiyon ağacı",
    "ready",
    "available",
    "Erişilebilir ağaç; hiyerarşi çağırandan gelir.",
  ),
  entry(
    "queue-state-machine",
    "Yükleme kuyruğu durum makinesi",
    "ready",
    "available",
    "Saf redüktör; taşıma katmanı değildir ve tek başına hiçbir bayt taşımaz.",
  ),
  entry(
    "accessible-picker",
    "Klavyeyle erişilebilir dosya seçici ve sürükle-bırak",
    "ready",
    "available",
    "Gerçek etiketli file input; sürükle-bırak yalnızca ek kolaylıktır.",
  ),
  entry(
    "scan-vocabulary",
    "Tarama durumu sözlüğü (taranmadı ≠ temiz)",
    "ready",
    "available",
    "Yalnız gerçek temiz verdicti temiz sayılır.",
  ),
  entry(
    "state-coverage",
    "Yükleniyor/yenileniyor/hata/boş/sonuç yok/salt-okunur/çevrimdışı",
    "ready",
    "available",
    "Durumlar bileşen sözleşmesinin parçasıdır.",
  ),

  /* --- everything that needs a server ------------------------------------ */
  entry(
    "streaming-upload",
    "Akışlı yükleme",
    "ready",
    "blocked",
    "Yükleme ucu yok. Bileşen bir taşıma geri çağrısı verilmeden etkin kontrol göstermez.",
  ),
  entry(
    "download-range",
    "İndirme ve byte-range/ETag",
    "ready",
    "blocked",
    "İndirme ucu yok; Range ve ETag davranışı sunucuya aittir ve taklit edilemez.",
  ),
  entry(
    "durable-metadata",
    "Kalıcı üstveri, etiket ve klasör",
    "ready",
    "blocked",
    "media_assets tablosu ve yazma ucu yok; düzenlemeler yalnız bu oturumda yaşar.",
  ),
  entry(
    "content-hash-dedup",
    "İçerik özeti ve tekilleştirme",
    "partial",
    "blocked",
    "Özet sunucuda hesaplanmalıdır; istemcinin hesapladığı bir özet kanıt değildir.",
  ),
  entry(
    "antivirus",
    "Kötücül yazılım taraması",
    "ready",
    "blocked",
    "Tarayıcı ucu yok. Bu yüzden hiçbir dosya temiz gösterilmez; taranmadı denir.",
  ),
  entry(
    "derivatives",
    "Türev ve önizleme üretimi",
    "partial",
    "blocked",
    "Türev üreten işçi yok; önizleme kabuğu yalnızca güvenli türler için yer tutar.",
  ),
  entry(
    "versioning",
    "Sürüm geçmişi ve sürüm karşılaştırma",
    "ready",
    "blocked",
    "Sürüm tablosu ve ucu yok; gösterilen sürümler çağıranın verdiği üstveridir.",
  ),
  entry(
    "usage-references",
    "Kullanım ve referans bağlantıları",
    "ready",
    "blocked",
    "Referans tablosu yok; bağlantılar çağıranın verdiği üstveridir.",
  ),
  entry(
    "audit-persistence",
    "Denetim izi kalıcılığı",
    "ready",
    "blocked",
    "Denetim yazma ucu yok; istemcide tutulan bir liste denetim izi değildir.",
  ),
  entry(
    "rbac",
    "Rol ve yetki denetimi",
    "ready",
    "blocked",
    "Rol modeli yok. İzinler çağırandan enjekte edilir ve varsayılan olarak kapalıdır.",
  ),
  entry(
    "quota-enforcement",
    "Kota uygulaması",
    "ready",
    "blocked",
    "Kotayı yalnız sunucu uygulayabilir; istemcideki sayaç bir sınır değildir.",
  ),
  entry(
    "retention-purge",
    "Saklama süresi ve kalıcı silme",
    "ready",
    "blocked",
    "Silme yetkisi hiçbir role verilmedi; kalıcı silme ayrı bir süreçtir.",
  ),
  entry(
    "legal-hold",
    "Hukuki muhafaza",
    "ready",
    "blocked",
    "Muhafaza bayrağı sunucuda saklanmalıdır; istemci yalnız gösterir.",
  ),
  entry(
    "s3-adapter",
    "S3 uyumlu depolama adaptörü",
    "ready",
    "blocked",
    "S3 kasıtlı olarak isteğe bağlıdır. Adaptör backend'e aittir; bu pakette AWS bağımlılığı yoktur.",
  ),
];

export function readyMediaCapabilities(): readonly MediaCapability[] {
  return MEDIA_CAPABILITIES.filter((capability) => capability.ui === "ready");
}

export function blockedMediaCapabilities(): readonly MediaCapability[] {
  return MEDIA_CAPABILITIES.filter((capability) => capability.backend === "blocked");
}

export function enabledMediaCapabilities(): readonly MediaCapability[] {
  return MEDIA_CAPABILITIES.filter((capability) => capability.enabled);
}

export function mediaCapabilityById(id: string): MediaCapability | undefined {
  return MEDIA_CAPABILITIES.find((capability) => capability.id === id);
}

export const MEDIA_CAPABILITY_COUNTS = {
  uiReady: MEDIA_CAPABILITIES.filter((capability) => capability.ui === "ready").length,
  backendBlocked: MEDIA_CAPABILITIES.filter((capability) => capability.backend === "blocked").length,
  enabled: MEDIA_CAPABILITIES.filter((capability) => capability.enabled).length,
} as const;

const TARGET_COPY: Record<StorageBackendId, { label: string; description: string }> = {
  local: {
    label: "Yerel disk",
    description:
      "Tek düğümde kalıcı nesne deposu. Varsayılan hedef budur ve S3 olmadan eksiksiz çalışır.",
  },
  s3: {
    label: "S3 uyumlu depolama",
    description: "İsteğe bağlı. Yalnızca çağıran bu yeteneği bildirdiğinde görünür.",
  },
};

/**
 * Which storage targets a host has actually declared.
 *
 * Local is always first and always the default. S3 appears only when the
 * injected capability says it is available - not when a key exists, not when a
 * label is set, only on an explicit `available: true`.
 */
export function storageTargets(capabilities: MediaCapabilities): readonly StorageTarget[] {
  const targets: StorageTarget[] = [];
  if (capabilities.storage.local.available !== false) {
    targets.push({ id: "local", ...TARGET_COPY.local, isDefault: true });
  }
  if (capabilities.storage.s3?.available === true) {
    targets.push({ id: "s3", ...TARGET_COPY.s3, isDefault: false });
  }
  return targets;
}

export function isS3Available(capabilities: MediaCapabilities): boolean {
  return capabilities.storage.s3?.available === true;
}
