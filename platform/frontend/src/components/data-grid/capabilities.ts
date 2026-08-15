/**
 * What this grid can and cannot do, declared rather than discovered.
 *
 * The backend exposes no paging, filtering, sorting, bulk-mutation or export
 * endpoints: `GET /api/degerlendirmeler` returns every row for the tenant with
 * no parameters at all. So every capability here is *client-side over loaded
 * rows*, and the things that would need a server are listed as disabled with
 * the reason - never approximated client-side and presented as the real thing.
 *
 * The distinction that matters: "select all 12 loaded rows" is honest;
 * "select all 4,000 matching rows" would be a lie this client cannot back.
 */

export interface GridCapability {
  readonly id: string;
  readonly title: string;
  readonly scope?: string;
}

export interface DisabledGridCapability extends GridCapability {
  readonly reason: string;
}

export const IMPLEMENTED_CAPABILITIES: readonly GridCapability[] = [
  { id: "search", title: "Serbest metin arama", scope: "yüklenmiş satırlar" },
  { id: "column-visibility", title: "Sütun göster/gizle" },
  { id: "column-reorder", title: "Sütun sırası" },
  { id: "column-pin", title: "Sütun sabitleme (başa)" },
  { id: "multi-sort", title: "Çok sütunlu sıralama" },
  { id: "typed-filters", title: "Tipli filtreler", scope: "metin/sayı/tarih/enum/boolean" },
  { id: "grouping", title: "Gruplama ve grup açma/kapama" },
  { id: "selection", title: "Satır seçimi", scope: "yalnız yüklenmiş satırlar" },
  { id: "bulk-actions", title: "Toplu eylem çubuğu", scope: "seçili yüklenmiş satırlar" },
  { id: "client-pagination", title: "İstemci sayfalama" },
  { id: "url-state", title: "URL durum aktarımı" },
  { id: "saved-views", title: "Adlandırılmış görünümler", scope: "yalnız bu tarayıcı" },
  { id: "csv-export", title: "CSV dışa aktarma", scope: "yüklenmiş ve yetkili satırlar" },
  {
    id: "csv-formula-neutralization",
    title: "CSV formül nötrleştirme",
    scope: "kullanıcı kaynaklı metin hücreleri; =, +, -, @, sekme ve satır başı",
  },
  { id: "density", title: "Yoğunluk entegrasyonu" },
  { id: "view-modes", title: "Tablo/kart görünümü" },
  { id: "states", title: "Yükleniyor/yenileniyor/hata/boş/sonuç yok" },
  { id: "a11y", title: "Klavye, aria-sort/selected ve canlı duyuru" },
];

export const DISABLED_CAPABILITIES: readonly DisabledGridCapability[] = [
  {
    id: "server-wide-selection",
    title: "Tüm eşleşen satırları seç",
    reason:
      "Sunucu yalnızca kiracının tüm kayıtlarını filtresiz döndürür; yüklenmemiş satır kavramı yoktur ve sayısı bilinemez.",
  },
  {
    id: "server-pagination",
    title: "Sunucu taraflı sayfalama",
    reason: "Liste ucunda sayfa/limit parametresi yok.",
  },
  {
    id: "server-filtering",
    title: "Sunucu taraflı filtre ve sıralama",
    reason: "Liste ucu filtre veya sıralama parametresi kabul etmiyor.",
  },
  {
    id: "full-dataset-export",
    title: "Tüm veri kümesini dışa aktarma",
    reason:
      "Dışa aktarma yalnızca bu oturumda yüklenmiş satırları kapsar; sunucuda dışa aktarma ucu yok.",
  },
  {
    id: "cross-device-views",
    title: "Cihazlar arası kayıtlı görünüm",
    reason: "Kullanıcı tercihi saklayan bir uç yok; görünümler yalnız bu tarayıcıda durur.",
  },
  {
    id: "audit-persistence",
    title: "Tablo eylemlerinin denetim kaydı",
    reason: "Denetim yazma ucu yok; istemci tarafı bir kayıt denetim izi değildir.",
  },
  {
    id: "backend-mutations",
    title: "Toplu güncelleme/silme",
    reason:
      "Kararlar ve onaylar append-only'dur; toplu mutasyon ucu yoktur ve olması da istenmez.",
  },
  {
    id: "virtualization",
    title: "Satır sanallaştırma",
    reason:
      "Uygulanmadı. Bugünkü en büyük tablo üç satırdır; eşik aşılmadan sanallaştırma iddia edilmez.",
  },
];

/** Rows beyond which a real virtualization decision must be revisited. */
export const VIRTUALIZATION_THRESHOLD = 200;

export function isCapabilityDisabled(id: string): boolean {
  return DISABLED_CAPABILITIES.some((capability) => capability.id === id);
}

export function disabledReason(id: string): string | null {
  return DISABLED_CAPABILITIES.find((capability) => capability.id === id)?.reason ?? null;
}
