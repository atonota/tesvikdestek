/**
 * The provider connection capability ledger.
 *
 * Two axes, kept apart on purpose:
 *
 *   `ui`      - does the component exist and work? This package delivers that.
 *   `backend` - can a server actually do it today? For most of this list, no.
 *
 * Collapsing the two is how a connection centre starts lying: a finished
 * wizard with no broker behind it is *ready* and *blocked* at the same time,
 * and only saying both is honest. `enabled` is the conjunction, and it is the
 * only field a component may consult when deciding to render a live control.
 *
 * There is no provider backend in this repository: no credential store, no
 * OAuth broker, no health prober, no metering. Every entry whose backend is
 * `blocked` names the reason. That is also why **no provider is connected by
 * default** - not as a policy choice, but because there is nothing here that
 * could connect one.
 */

import type {
  BackendCapabilityId,
  ConnectionMethodId,
  ProviderCapability,
  ProviderConnectionCapabilities,
  ProviderId,
  ProviderPermissions,
} from "./types";
import { methodFor } from "./catalog";

/**
 * The honest default a host gets when it injects nothing.
 *
 * No backend capability, no permission. An absent authorisation system must
 * read as "not permitted", never as "allowed because nobody said otherwise".
 */
export const NO_BACKEND_CAPABILITIES: ProviderConnectionCapabilities = {
  backend: [],
  permissions: {
    canConnect: false,
    canRotate: false,
    canRevoke: false,
    canReverify: false,
    canEditRouting: false,
    canViewAudit: false,
  },
};

function entry(
  id: string,
  title: string,
  ui: ProviderCapability["ui"],
  backend: ProviderCapability["backend"],
  reason: string,
): ProviderCapability {
  return { id, title, ui, backend, enabled: ui === "ready" && backend === "available", reason };
}

export const PROVIDER_CONNECTION_CAPABILITIES: readonly ProviderCapability[] = [
  /* --- surfaces that need nothing from a server -------------------------- */
  entry(
    "provider-catalog",
    "Sağlayıcı kataloğu ve yöntem matrisi",
    "ready",
    "available",
    "Katalog istemcide tanımlıdır; her yöntemin durumu ve gerekçesi yazılıdır.",
  ),
  entry(
    "method-comparison",
    "Sağlayıcı karşılaştırma görünümü",
    "ready",
    "available",
    "Karşılaştırma yalnızca katalogdaki bildirimleri gösterir, ölçüm yapmaz.",
  ),
  entry(
    "connection-wizard",
    "Bağlantı sihirbazı (sağlayıcı → yöntem → bildirim → yapılandırma → doğrulama)",
    "ready",
    "available",
    "Sihirbaz saf bir durum makinesidir; hiçbir adımı tek başına bağlantıya dönüştüremez.",
  ),
  entry(
    "ephemeral-secret-field",
    "Kalıcı olmayan gizli alan yaşam döngüsü",
    "ready",
    "available",
    "Değer yalnızca alan takılıyken bellekte durur; gönderim, vazgeçme ve sökülmede temizlenir.",
  ),
  entry(
    "state-coverage",
    "Bağlı değil/beklemede/bağlı/bozulmuş/süresi dolmuş/geri çekilmiş/hata durumları",
    "ready",
    "available",
    "Durumlar bileşen sözleşmesinin parçasıdır ve yalnızca dışarıdan gelir.",
  ),
  entry(
    "inventory-grid",
    "Bağlantı envanteri (kabul edilmiş DataGrid)",
    "ready",
    "available",
    "Kabul edilmiş DataGrid üzerinde çalışır; yalnızca verilen satırlar kapsamındadır.",
  ),
  entry(
    "consent-disclosure",
    "Rıza, veri kategorisi, yerleşim ve saklama bildirimi",
    "ready",
    "available",
    "Bildirim metni katalogdan gelir; sihirbaz açık kabul olmadan ilerlemez.",
  ),
  entry(
    "policy-builder-ui",
    "Yönlendirme ve geri çekilme politikası düzenleyicisi",
    "ready",
    "available",
    "Düzenleyici bir taslak üretir; taslağı yalnızca çağıran kaydedebilir.",
  ),
  entry(
    "a11y",
    "Klavye, odak, etiket ve canlı durum duyurusu",
    "ready",
    "available",
    "320 piksele kadar tek sütun; hiçbir durum yalnız renkle anlatılmaz.",
  ),

  /* --- everything that needs a server ------------------------------------ */
  entry(
    "credential-storage",
    "Kimlik bilgisi saklama ve şifreleme",
    "absent",
    "blocked",
    "Kimlik bilgisi deposu yok. Bu paket hiçbir anahtarı hiçbir yere yazmaz; gizli değer yalnızca çağırana devredilir.",
  ),
  entry(
    "api-key-exchange",
    "API anahtarı takası",
    "ready",
    "blocked",
    "Anahtarı devralacak bir uç yok. Geri çağrı verilmeden gizli alan etkin gösterilmez.",
  ),
  entry(
    "oauth-broker",
    "OAuth yetkilendirme akışı",
    "ready",
    "blocked",
    "Yetkilendirme akışını başlatacak ve geri dönüşü karşılayacak sunucu yok; istemci tek başına akışı yürütemez.",
  ),
  entry(
    "host-session-bridge",
    "Barındırıcı oturumu köprüsü",
    "ready",
    "blocked",
    "Barındırıcının doğruladığı oturumu bildirecek bir uç yok. Oturum barındırıcıda kurulur; tarayıcı bunu üstlenemez.",
  ),
  entry(
    "gateway-broker",
    "Ağ geçidi aracılığı",
    "ready",
    "blocked",
    "Ağ geçidiyle konuşacak sunucu tarafı yok; istemciden ağ geçidine doğrudan çağrı yapılmaz.",
  ),
  entry(
    "host-auth-profiles",
    "Barındırıcıdaki kimlik profillerinin listesi",
    "ready",
    "blocked",
    "Profil listesini döndüren bir uç yok; liste gelmeden seçilecek profil de yoktur.",
  ),
  entry(
    "health-probe",
    "Sağlık yoklaması ve son kontrol zamanı",
    "ready",
    "blocked",
    "Yoklama ucu yok. Gösterilen sağlık ve son kontrol zamanı çağıranın verdiği üstveridir.",
  ),
  entry(
    "credential-rotation",
    "Anahtar döndürme",
    "ready",
    "blocked",
    "Döndürme ucu yok; istemcide üretilen bir anahtar değişimi kanıt değildir.",
  ),
  entry(
    "revocation",
    "Bağlantı iptali ve geri çekme",
    "ready",
    "blocked",
    "İptal ucu yok. İptal sunucuda gerçekleşmelidir; istemcide gizlenen bir satır iptal değildir.",
  ),
  entry(
    "routing-policy",
    "Yönlendirme ve geri çekilme politikasının uygulanması",
    "ready",
    "blocked",
    "Politikayı uygulayacak yönlendirici yok; düzenleyici yalnızca taslak üretir ve taslak davranış değiştirmez.",
  ),
  entry(
    "audit-persistence",
    "Denetim izi kalıcılığı",
    "ready",
    "blocked",
    "Denetim yazma ucu yok; istemcide tutulan bir liste denetim izi değildir.",
  ),
  entry(
    "usage-metering",
    "Kullanım, kota ve hız sınırı ölçümü",
    "ready",
    "blocked",
    "Ölçüm ucu yok. Gösterilen sayılar sağlayıcıdan sunucu aracılığıyla gelmelidir; istemci hiçbirini hesaplamaz.",
  ),
  entry(
    "budget-enforcement",
    "Bütçe uygulaması",
    "ready",
    "blocked",
    "Bütçeyi yalnız sunucu uygulayabilir; istemcideki bir sayaç harcamayı durdurmaz.",
  ),
  entry(
    "auto-discovery",
    "Sağlayıcı yeteneklerinin otomatik keşfi",
    "absent",
    "blocked",
    "Sağlayıcıları yoklayan bir keşif katmanı yok; katalog elle yazılır ve yazıldığı gibi gösterilir.",
  ),
];

export function readyProviderCapabilities(): readonly ProviderCapability[] {
  return PROVIDER_CONNECTION_CAPABILITIES.filter((capability) => capability.ui === "ready");
}

export function blockedProviderCapabilities(): readonly ProviderCapability[] {
  return PROVIDER_CONNECTION_CAPABILITIES.filter((capability) => capability.backend === "blocked");
}

export function enabledProviderCapabilities(): readonly ProviderCapability[] {
  return PROVIDER_CONNECTION_CAPABILITIES.filter((capability) => capability.enabled);
}

export function providerCapabilityById(id: string): ProviderCapability | undefined {
  return PROVIDER_CONNECTION_CAPABILITIES.find((capability) => capability.id === id);
}

export const PROVIDER_CAPABILITY_COUNTS = {
  uiReady: PROVIDER_CONNECTION_CAPABILITIES.filter((capability) => capability.ui === "ready").length,
  backendBlocked: PROVIDER_CONNECTION_CAPABILITIES.filter(
    (capability) => capability.backend === "blocked",
  ).length,
  enabled: PROVIDER_CONNECTION_CAPABILITIES.filter((capability) => capability.enabled).length,
} as const;

/* ------------------------------------------------- what a host declared */

/** Turkish names for the capabilities a host declares, used in disabled copy. */
const BACKEND_CAPABILITY_LABELS: Record<BackendCapabilityId, string> = {
  apiKeyExchange: "API anahtarı takası",
  oauthBroker: "OAuth aracısı",
  hostSessionBridge: "barındırıcı oturumu köprüsü",
  gatewayBroker: "ağ geçidi aracısı",
  hostAuthProfiles: "barındırıcı kimlik profilleri",
  healthProbe: "sağlık yoklaması",
  credentialRotation: "anahtar döndürme",
  revocation: "bağlantı iptali",
  routingPolicy: "yönlendirme politikası",
  auditPersistence: "denetim kaydı",
  usageMetering: "kullanım ölçümü",
  budgetEnforcement: "bütçe uygulaması",
};

export function backendCapabilityLabel(id: BackendCapabilityId): string {
  return BACKEND_CAPABILITY_LABELS[id];
}

export function hasBackend(
  capabilities: ProviderConnectionCapabilities,
  id: BackendCapabilityId,
): boolean {
  return capabilities.backend.includes(id);
}

export function hasPermission(
  capabilities: ProviderConnectionCapabilities,
  key: keyof ProviderPermissions,
): boolean {
  return capabilities.permissions[key] === true;
}

/**
 * Whether an action may render as a live control.
 *
 * Both halves are required and the reason names the missing half, because
 * "nothing happens when I click" and "you are not allowed to" and "the server
 * cannot do this" are three different problems for the person at the screen.
 */
export interface Offerability {
  readonly offerable: boolean;
  readonly reason: string | null;
}

export function actionOfferability(
  capabilities: ProviderConnectionCapabilities,
  permission: keyof ProviderPermissions,
  backend: BackendCapabilityId,
  callback: unknown,
): Offerability {
  if (!hasPermission(capabilities, permission)) {
    return { offerable: false, reason: "Bu işlem için yetkiniz tanımlı değil." };
  }
  if (!hasBackend(capabilities, backend)) {
    return {
      offerable: false,
      reason: `Bu işlem sunucu tarafında tanımlı değil: ${backendCapabilityLabel(backend)}.`,
    };
  }
  if (typeof callback !== "function") {
    return { offerable: false, reason: "Bu ekran bu eylemi devralmadı." };
  }
  return { offerable: true, reason: null };
}

/**
 * Whether a connection method may be offered to the operator at all.
 *
 * Three gates in order, and the order is the point: a method the vendor does
 * not support is refused before anyone asks whether the host could broker it,
 * so an over-configured host can never unlock a door that is not there.
 */
export function methodOfferability(
  capabilities: ProviderConnectionCapabilities,
  providerId: ProviderId,
  method: ConnectionMethodId,
): Offerability {
  const descriptor = methodFor(providerId, method);
  if (!descriptor) {
    return { offerable: false, reason: "Bu yöntem bu sağlayıcı için tanımlı değil." };
  }
  if (descriptor.availability !== "available") {
    return { offerable: false, reason: descriptor.reason };
  }
  const missing = descriptor.requires.filter((required) => !hasBackend(capabilities, required));
  if (missing.length > 0) {
    return {
      offerable: false,
      reason: `Bu yöntem sunucu tarafında tanımlı değil: ${missing
        .map((id) => backendCapabilityLabel(id))
        .join(", ")}.`,
    };
  }
  return { offerable: true, reason: null };
}
