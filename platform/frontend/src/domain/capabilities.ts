/**
 * The capability inventory - the product's own honesty ledger.
 *
 * Every surface the scope review identified, with what actually backs it.
 * `blocked` never means "coming soon" and never renders as a working control:
 * the capability does not exist in the backend, and a mocked version of it
 * would lie to the first real user.
 *
 * Counts are asserted by test: 18 green, 10 partial, 15 blocked.
 *
 * The partial count moved from eight to ten and the green count from seventeen
 * to eighteen when the file library and the AI provider centre were mounted as
 * routes, and the capability matrix was finally recorded as the capability it
 * has always been. Neither new entry is green: both surfaces are real and both
 * have a backend that does not exist, which is exactly what `partial` means
 * here - and the `documents` entry stays `blocked`, because a route that
 * explains a blockage does not remove it.
 */

export type CapabilityStatus = "green" | "partial" | "blocked";

export const BLOCKED_LABEL = "Backend yeteneği gerekli";
export const PARTIAL_LABEL = "Kısmi — sınırı aşağıda";
export const GREEN_LABEL = "Gerçek veriyle çalışıyor";

export const STATUS_LABELS: Record<CapabilityStatus, string> = {
  green: GREEN_LABEL,
  partial: PARTIAL_LABEL,
  blocked: BLOCKED_LABEL,
};

export type CapabilityGroup =
  | "public"
  | "auth"
  | "organization"
  | "discovery"
  | "decisions"
  | "approval"
  | "operations"
  | "pipeline"
  | "settings";

export const GROUP_LABELS: Record<CapabilityGroup, string> = {
  public: "Kamuya açık yüzey",
  auth: "Kimlik",
  organization: "Organizasyon",
  discovery: "Keşif ve kanıt",
  decisions: "Karar tezgâhı",
  approval: "Onay ve denetim",
  operations: "Operasyon",
  pipeline: "Başvuru hattı",
  settings: "Ayarlar",
};

export interface Capability {
  readonly id: string;
  readonly title: string;
  readonly group: CapabilityGroup;
  readonly status: CapabilityStatus;
  /** Blocked capabilities are never enabled; the UI must not offer them. */
  readonly enabled: boolean;
  /** Why it is partial or blocked. Required for anything not green. */
  readonly reason?: string;
  /** The backing contract, for green and partial surfaces. */
  readonly backedBy?: string;
  readonly route?: string;
}

export const CAPABILITIES: readonly Capability[] = [
  // ---------------------------------------------------------------- green (18)
  {
    id: "landing",
    title: "Karşılama sayfası",
    group: "public",
    status: "green",
    enabled: true,
    backedBy: "GET /api/programlar, GET /api/kaynaklar",
    route: "/",
  },
  {
    id: "how-it-works",
    title: "Nasıl çalışır",
    group: "public",
    status: "green",
    enabled: true,
    backedBy: "Statik içerik + DISCLAIMER",
    route: "/nasil-calisir",
  },
  {
    id: "public-catalog",
    title: "Program kataloğu",
    group: "public",
    status: "green",
    enabled: true,
    backedBy: "GET /api/programlar",
    route: "/programlar",
  },
  {
    id: "public-program-detail",
    title: "Program detayı",
    group: "public",
    status: "green",
    enabled: true,
    backedBy: "GET /api/programlar, GET /api/kaynaklar",
    route: "/programlar/:code",
  },
  {
    id: "register",
    title: "Kayıt",
    group: "auth",
    status: "green",
    enabled: true,
    backedBy: "GET /api/csrf → POST /kayit",
    route: "/kayit",
  },
  {
    id: "login",
    title: "Giriş",
    group: "auth",
    status: "green",
    enabled: true,
    backedBy: "GET /api/csrf → POST /giris",
    route: "/giris",
  },
  {
    id: "logout",
    title: "Çıkış",
    group: "auth",
    status: "green",
    enabled: true,
    backedBy: "POST /cikis",
  },
  {
    id: "readiness",
    title: "Organizasyon hazırlığı",
    group: "organization",
    status: "green",
    enabled: true,
    backedBy: "GET /api/degerlendirmeler → missing_facts",
    route: "/organizasyon/hazirlik",
  },
  {
    id: "dashboard",
    title: "Kokpit",
    group: "decisions",
    status: "green",
    enabled: true,
    backedBy: "GET /api/degerlendirmeler, /api/programlar, /api/kaynaklar, /hazir",
    route: "/panel",
  },
  {
    id: "opportunities",
    title: "Fırsat keşfi",
    group: "discovery",
    status: "green",
    enabled: true,
    backedBy: "GET /api/programlar (istemci tarafı filtre)",
    route: "/firsatlar",
  },
  {
    id: "opportunity-detail",
    title: "Fırsat detayı",
    group: "discovery",
    status: "green",
    enabled: true,
    backedBy: "GET /api/programlar, GET /api/kaynaklar",
    route: "/firsatlar/:code",
  },
  {
    id: "source-registry",
    title: "Kaynak kütüğü",
    group: "discovery",
    status: "green",
    enabled: true,
    backedBy: "GET /api/kaynaklar",
    route: "/kaynaklar",
  },
  {
    id: "evaluation-run",
    title: "Değerlendirme çalıştırma",
    group: "decisions",
    status: "green",
    enabled: true,
    backedBy: "GET /api/csrf → POST /api/degerlendir (X-CSRF-Token)",
  },
  {
    id: "decision-list",
    title: "Karar listesi",
    group: "decisions",
    status: "green",
    enabled: true,
    backedBy: "GET /api/degerlendirmeler",
    route: "/degerlendirmeler",
  },
  {
    id: "decision-detail",
    title: "Karar detayı ve kural izi",
    group: "decisions",
    status: "green",
    enabled: true,
    backedBy: "GET /api/degerlendirmeler/{id}",
    route: "/degerlendirmeler/:id",
  },
  {
    id: "decision-compare",
    title: "Karar karşılaştırma",
    group: "decisions",
    status: "green",
    enabled: true,
    backedBy: "GET /api/degerlendirmeler/{id} (N çağrı)",
    route: "/degerlendirmeler/karsilastir",
  },
  {
    id: "capability-matrix",
    title: "Yetenek matrisi",
    group: "settings",
    status: "green",
    enabled: true,
    backedBy: "Bu kütüğün kendisi (domain/capabilities.ts); sunucu çağrısı yok",
    route: "/yetenekler",
  },
  {
    id: "ops-health",
    title: "Platform sağlığı",
    group: "operations",
    status: "green",
    enabled: true,
    backedBy: "GET /hazir",
    route: "/operasyon/saglik",
  },

  // ------------------------------------------------------------- partial (10)
  {
    id: "onboarding",
    title: "Onboarding sihirbazı",
    group: "public",
    status: "partial",
    enabled: true,
    reason: "Adım durumu sunucuda tutulmaz; sayfa yenilenirse ilerleme kaybolur.",
    backedBy: "POST /kayit",
    route: "/onboarding",
  },
  {
    id: "profile-write",
    title: "Şirket profili",
    group: "organization",
    status: "partial",
    enabled: true,
    reason:
      "Profil yazılabilir ama okunamaz: backend'de profil okuma ucu yok. Kayıtlı değerler bu ekranda doğrulanamaz.",
    backedBy: "POST /profil (SSR form)",
    route: "/organizasyon/profil",
  },
  {
    id: "eligibility-wizard",
    title: "Uygunluk sihirbazı",
    group: "decisions",
    status: "partial",
    enabled: true,
    reason: "Sihirbaz yeniden açıldığında önceki cevaplar sunucudan okunamaz.",
    backedBy: "POST /profil → POST /api/degerlendir",
    route: "/uygunluk/sihirbaz",
  },
  {
    id: "source-detail",
    title: "Kaynak detayı",
    group: "discovery",
    status: "partial",
    enabled: true,
    reason: "Yakalanan ham metin API'de dönmüyor; yalnızca üstveri ve içerik özeti görünür.",
    backedBy: "GET /api/kaynaklar",
    route: "/kaynaklar/:id",
  },
  {
    id: "approval-write",
    title: "Kullanıcı onayı verme",
    group: "approval",
    status: "partial",
    enabled: true,
    reason: "Onay kaydedilir ama geri okunamaz: onay listesi ucu yok.",
    backedBy: "POST /degerlendirmeler/{id}/onay (SSR form)",
  },
  {
    id: "document-checklist",
    title: "Belge kontrol listesi",
    group: "organization",
    status: "partial",
    enabled: true,
    reason:
      "Gerekli belge listesi gerçek; işaretlemeler yalnızca bu tarayıcıda tutulur ve sunucuya gitmez.",
    backedBy: "GET /api/programlar → required_documents",
  },
  {
    id: "maturity",
    title: "Olgunluk göstergesi",
    group: "operations",
    status: "partial",
    enabled: true,
    reason:
      "7 boyuttan 2'si ölçülemiyor (başvuru hazırlığı, kullanıcı güvenlik duruşu); biri dolaylı çıkarım.",
    backedBy: "GET /api/degerlendirmeler, /api/kaynaklar, /hazir",
    route: "/olgunluk",
  },
  {
    id: "security-settings",
    title: "Güvenlik ayarları",
    group: "settings",
    status: "partial",
    enabled: true,
    reason: "Yalnızca oturum kapatma var; parola değiştirme ve iki adımlı doğrulama yok.",
    backedBy: "POST /cikis",
    route: "/ayarlar/guvenlik",
  },
  {
    id: "ai-providers",
    title: "Yapay zekâ sağlayıcı bağlantıları",
    group: "settings",
    status: "partial",
    enabled: true,
    reason:
      "Gemini, OpenAI/ChatGPT, Claude ve OpenClaw için yayımlanmış yöntemler, resmî belge bağlantıları, veri yönlendirme bildirimi ve karşılaştırma gerçektir. Bağlantı kurulamaz: kimlik bilgisi deposu, OAuth aracısı, barındırıcı oturumu köprüsü ve sağlık yoklaması sunucuda yok. Hiçbir gizli alan etkin gösterilmez ve bu ekran hiçbir istek göndermez.",
    backedBy: "İstemci tarafı sağlayıcı kataloğu (components/provider-connections); sunucu ucu yok",
    route: "/ayarlar/yapay-zeka",
  },
  {
    id: "media-library",
    title: "Dosya kütüphanesi",
    group: "pipeline",
    status: "partial",
    enabled: true,
    reason:
      "Kütüphane, arama, süzgeç, sıralama, görünüm ve depolama paneli gerçektir ve verilen satırlar üzerinde tamdır; verilen satır sayısı bugün sıfırdır. Yükleme, indirme, kalıcı üstveri, tarama ve kota için sunucu ucu yok, bu yüzden o kontroller gerekçesiyle kapalı gösterilir.",
    backedBy: "İstemci tarafı bileşen sistemi (components/media); sunucu ucu yok",
    route: "/dosyalar",
  },

  // -------------------------------------------------------------- blocked (15)
  {
    id: "password-reset",
    title: "Parola sıfırlama",
    group: "auth",
    status: "blocked",
    enabled: false,
    reason: "E-posta gönderimi ve sıfırlama jetonu backend'de yok.",
  },
  {
    id: "email-verification",
    title: "E-posta doğrulama",
    group: "auth",
    status: "blocked",
    enabled: false,
    reason: "Doğrulama akışı ve jeton modeli yok.",
  },
  {
    id: "sessions",
    title: "Aktif oturumlarım",
    group: "auth",
    status: "blocked",
    enabled: false,
    reason: "user_sessions tablosu var ama okuma ucu yok.",
  },
  {
    id: "team",
    title: "Kullanıcı yönetimi",
    group: "organization",
    status: "blocked",
    enabled: false,
    reason: "Kayıt tek kiracı + tek kullanıcı üretir; çok kullanıcı modeli yok.",
  },
  {
    id: "roles",
    title: "Rol ve yetki",
    group: "organization",
    status: "blocked",
    enabled: false,
    /*
     * Still blocked, and the demo does not move it.
     *
     * The login screen now offers a süperadmin and a müşteri demo profile, and
     * without this sentence the next reader would find those two roles in the
     * interface, find this entry saying roles do not exist, and conclude the
     * ledger had gone stale. It has not: the demo role selects a label and a
     * data set in one browser tab. It authorises nothing, because there is
     * nothing to authorise - no role model, no permission check, no server that
     * has heard of it. Marking this green on the strength of a frontend demo is
     * exactly the unearned green this ledger exists to prevent.
     */
    reason:
      "Rol modeli domainde tanımlı değil. Giriş ekranındaki demo rolleri yalnızca arayüz " +
      "demosudur: tarayıcı belleğinde bir etiket ve örnek veri seçer, hiçbir yetki vermez.",
  },
  {
    id: "saved-opportunities",
    title: "Kaydedilen fırsatlar",
    group: "discovery",
    status: "blocked",
    enabled: false,
    reason: "Kayıt yeri yok; tarayıcıda tutmak sunucu kaydı gibi görünürdü.",
  },
  {
    id: "server-side-paging",
    title: "Sunucu taraflı sayfalama ve filtre",
    group: "decisions",
    status: "blocked",
    enabled: false,
    reason: "Liste ucu tüm kayıtları filtresiz döner; sayfalama parametresi yok.",
  },
  {
    id: "source-diff",
    title: "Kaynak değişiklik geçmişi",
    group: "discovery",
    status: "blocked",
    enabled: false,
    reason: "Snapshot sürümleri arası fark ucu yok.",
  },
  {
    id: "approval-list",
    title: "Onay listesi",
    group: "approval",
    status: "blocked",
    enabled: false,
    reason: "ApprovalOut şeması yazılmış ama hiçbir route kullanmıyor.",
  },
  {
    id: "audit-timeline",
    title: "Denetim izi",
    group: "approval",
    status: "blocked",
    enabled: false,
    reason: "AuditRepository.list_for_tenant var, HTTP ucu yok.",
  },
  {
    id: "applications",
    title: "Başvuru hattı",
    group: "pipeline",
    status: "blocked",
    enabled: false,
    reason: "Application varlığı domainde hiç yok.",
  },
  {
    id: "tasks",
    title: "Görevler",
    group: "pipeline",
    status: "blocked",
    enabled: false,
    reason: "Task varlığı yok.",
  },
  {
    /*
     * This entry used to read "kapsam dışı bırakıldı" - out of scope. That
     * wording described a decision, not a fact about the system, and the
     * decision has been reversed: the file library is a required capability and
     * has a route at `/dosyalar`. What has not changed is the blockage, which
     * is why the entry stays `blocked` rather than being quietly promoted. The
     * surface exists; the transport does not, and the surface says so.
     */
    id: "documents",
    title: "Belge yükleme ve saklama",
    group: "pipeline",
    status: "blocked",
    enabled: false,
    reason:
      "Yükleme ucu, media_assets tablosu ve depolama adaptörü backend'de yok. Yüzey /dosyalar adresinde açıktır ve dosya seçici, taşıma katmanı verilmediği için gerekçesiyle kapalı gösterilir; hiçbir dosya kabul edilmez.",
  },
  {
    id: "calendar",
    title: "Takvim",
    group: "pipeline",
    status: "blocked",
    enabled: false,
    reason: "Üç programın da çağrı penceresi boş; takvim uydurma tarih üretirdi.",
  },
  {
    id: "notifications",
    title: "Bildirimler",
    group: "pipeline",
    status: "blocked",
    enabled: false,
    reason: "Bildirim tablosu, kanalı ve işçisi yok.",
  },
];

export function capabilitiesByStatus(status: CapabilityStatus): readonly Capability[] {
  return CAPABILITIES.filter((capability) => capability.status === status);
}

export function capabilityById(id: string): Capability | undefined {
  return CAPABILITIES.find((capability) => capability.id === id);
}

export const CAPABILITY_COUNTS = {
  green: capabilitiesByStatus("green").length,
  partial: capabilitiesByStatus("partial").length,
  blocked: capabilitiesByStatus("blocked").length,
} as const;
