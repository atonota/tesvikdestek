/**
 * The words this subsystem is allowed to use about a connection.
 *
 * The most dangerous sentence a connection centre can render is a reassuring
 * one about a connection nobody verified. Two rules keep that from happening,
 * and both are here rather than in a component so a test, a story and a screen
 * cannot disagree:
 *
 *  - `isHealthy` returns true for exactly one derived state, and the derivation
 *    outranks the stored one. A record that still says `connected` while its
 *    expiry has passed reads as expired, because a backend that has not
 *    re-probed yet is not evidence of health.
 *  - no label for a non-connected status contains a calming word, and no method
 *    label describes a host-managed sign-in as anything a browser does.
 *
 * Plain TypeScript on purpose, like the media vocabulary next door: the same
 * rules apply everywhere and none of the callers gets its own opinion.
 */

import type {
  ConnectionMethodId,
  ConnectionStatus,
  DataCategory,
  DegradationMode,
  ProviderAuditAction,
  ProviderConnection,
  WizardStep,
} from "./types";

/* ---------------------------------------------------------------- status */

const STATUS_LABELS: Record<ConnectionStatus, string> = {
  disconnected: "Bağlı değil",
  pending: "Beklemede",
  connected: "Bağlı",
  degraded: "Bozulmuş",
  expired: "Süresi doldu",
  revoked: "Geri çekildi",
  error: "Hata",
};

export function connectionStatusLabel(status: ConnectionStatus): string {
  return STATUS_LABELS[status];
}

const STATUS_EXPLANATIONS: Record<ConnectionStatus, string> = {
  disconnected:
    "Bu sağlayıcı için kurulmuş bir bağlantı yok. Varsayılan durum budur; hiçbir sağlayıcı kendiliğinden bağlanmaz.",
  pending: "Bağlantı isteği oluşturuldu ve sunucudan bir sonuç henüz gelmedi.",
  connected: "Sunucu bağlantıyı kurdu ve son yoklamada çalışır bildirdi.",
  degraded: "Bağlantı duruyor ama bazı yoklamalar sonuçsuz kaldı; davranış öngörülemez.",
  expired: "Kimlik bilgisi ya da oturum süresi doldu. Yeniden kurulmadan istek gönderilmemelidir.",
  revoked: "Yetki geri çekildi. Bu bağlantı üzerinden istek gönderilemez.",
  error: "Son işlem hata verdi. Sebep sunucudan gelen mesajda yazılıdır.",
};

export function connectionStatusExplanation(status: ConnectionStatus): string {
  return STATUS_EXPLANATIONS[status];
}

/**
 * Badge tone, in the design system's existing vocabulary.
 *
 * Only a live connection earns the affirmative tone. Everything unknown or
 * lapsed is a warning rather than neutral grey, because grey reads as "nothing
 * to see here" and that is precisely the message an expired credential must not
 * send. The literals match `BadgeTone` in the primitives, but the type is not
 * imported: this module stays free of anything React-shaped.
 */
export function connectionStatusTone(
  status: ConnectionStatus,
): "candidate" | "ineligible" | "warning" | "neutral" {
  if (status === "connected") return "candidate";
  if (status === "revoked" || status === "error") return "ineligible";
  if (status === "disconnected") return "neutral";
  return "warning";
}

/**
 * The status after the clock has been taken into account.
 *
 * A stored `connected` whose `expiresAt` is in the past is reported as
 * `expired`. The stored value is not corrected anywhere - the record still says
 * what the backend said - but nothing in this subsystem renders the stored
 * value directly, so the display cannot outlive the credential.
 */
export function effectiveStatus(connection: ProviderConnection, now: Date): ConnectionStatus {
  if (connection.status === "revoked" || connection.status === "expired") return connection.status;
  if (connection.expiresAt === null) return connection.status;
  const expiry = new Date(connection.expiresAt);
  if (Number.isNaN(expiry.getTime())) return connection.status;
  return expiry.getTime() <= now.getTime() ? "expired" : connection.status;
}

/**
 * Health, asked as a question with one right answer.
 *
 * Equality against a single derived literal rather than a "not broken" test:
 * the negative form silently absorbs every status added later, including the
 * next one that means "we do not know". `degraded` is deliberately excluded -
 * a connection that fails half its probes is not healthy, it is a warning.
 */
export function isHealthy(connection: ProviderConnection, now: Date): boolean {
  return effectiveStatus(connection, now) === "connected";
}

/** Whether the operator should be told to act before using this connection. */
export function needsAttention(connection: ProviderConnection, now: Date): boolean {
  const status = effectiveStatus(connection, now);
  return status === "degraded" || status === "expired" || status === "revoked" || status === "error";
}

/** Days until expiry, or `null` when nothing expires or the date is unusable. */
export function daysUntilExpiry(connection: ProviderConnection, now: Date): number | null {
  if (connection.expiresAt === null) return null;
  const expiry = new Date(connection.expiresAt);
  if (Number.isNaN(expiry.getTime())) return null;
  return Math.ceil((expiry.getTime() - now.getTime()) / 86_400_000);
}

/* ---------------------------------------------------------------- method */

const METHOD_LABELS: Record<ConnectionMethodId, string> = {
  "api-key": "API anahtarı",
  oauth: "OAuth yetkilendirme akışı",
  "host-session": "Barındırıcı tarafından yönetilen oturum",
  "gateway-token": "Ağ geçidi belirteci",
  "host-auth-profile": "Barındırıcıdaki kimlik profili",
};

export function methodLabel(method: ConnectionMethodId): string {
  return METHOD_LABELS[method];
}

/**
 * What each method actually is.
 *
 * The two host-managed entries are the ones worth reading twice. They describe
 * a sign-in that happens in the vendor's own application on the machine that
 * runs the workload, after which that machine reports a verified session. The
 * denial is explicit rather than implied, because "we do not do the other
 * thing" is only reassuring when it is written down.
 */
const METHOD_EXPLANATIONS: Record<ConnectionMethodId, string> = {
  "api-key":
    "Sağlayıcının konsolunda üretilen anahtar operatör tarafından bir kez yapıştırılır ve sunucuya devredilir. Bu istemci anahtarı hiçbir yere yazmaz.",
  oauth:
    "Sunucu resmî yetkilendirme akışını başlatır, sağlayıcı operatörü doğrular ve sonucu sunucuya döndürür. Tarayıcı yalnızca yönlendirmeyi izler.",
  "host-session":
    "Giriş, iş yükünü çalıştıran makinede sağlayıcının kendi uygulaması veya CLI'si tarafından yapılır; barındırıcı oturumu doğrular ve sunucuya bildirir. Tarayıcı hiçbir oturum verisi okumaz, kopyalamaz veya içe aktarmaz.",
  "gateway-token":
    "Ağ geçidinin ürettiği belirteç operatör tarafından bir kez yapıştırılır ve sunucuya devredilir. İstemci ağ geçidiyle doğrudan konuşmaz.",
  "host-auth-profile":
    "Barındırıcıda önceden tanımlanmış kimlik profili yalnızca adıyla seçilir. Profilin içeriğini barındırıcı tutar ve doğrular; istemci içeriği hiç görmez.",
};

export function methodExplanation(method: ConnectionMethodId): string {
  return METHOD_EXPLANATIONS[method];
}

/** Whether choosing this method requires the operator to type a secret. */
export function methodNeedsSecret(method: ConnectionMethodId): boolean {
  return method === "api-key" || method === "gateway-token";
}

/* ------------------------------------------------------------ disclosure */

const DATA_CATEGORY_LABELS: Record<DataCategory, string> = {
  "prompt-content": "İstem metni",
  "document-content": "Belge içeriği",
  "company-facts": "Şirket olguları",
  "operator-identity": "Operatör kimliği",
  "usage-metadata": "Kullanım üstverisi",
};

export function dataCategoryLabel(category: DataCategory): string {
  return DATA_CATEGORY_LABELS[category];
}

/** Training claims are only ever restated, never asserted by this client. */
export function trainingLabel(trainsOnData: boolean | null): string {
  if (trainsOnData === null) {
    return "Sağlayıcı politikasında belirtilir; bu istemci doğrulamaz.";
  }
  return trainsOnData
    ? "Sağlayıcı bu trafikle eğitim yaptığını bildiriyor."
    : "Sağlayıcı bu trafikle eğitim yapmadığını bildiriyor.";
}

/* ---------------------------------------------------------------- policy */

const DEGRADATION_LABELS: Record<DegradationMode, string> = {
  "fail-closed": "Kapalı düş (istek reddedilir)",
  "next-in-order": "Sıradaki bağlantıya geç",
  "read-only-cache": "Yalnızca önbellekten oku",
};

export function degradationLabel(mode: DegradationMode): string {
  return DEGRADATION_LABELS[mode];
}

const DEGRADATION_EXPLANATIONS: Record<DegradationMode, string> = {
  "fail-closed":
    "Öncelikli bağlantı çalışmazsa istek reddedilir. En güvenli seçenek budur ve varsayılandır.",
  "next-in-order":
    "Öncelikli bağlantı çalışmazsa listedeki bir sonraki etkin bağlantı denenir. Model listesi farklıysa sonuç da farklı olur.",
  "read-only-cache":
    "Yeni istek gönderilmez; yalnızca daha önce alınmış yanıtlar okunur. Güncel sonuç beklenmemelidir.",
};

export function degradationExplanation(mode: DegradationMode): string {
  return DEGRADATION_EXPLANATIONS[mode];
}

/* ----------------------------------------------------------------- audit */

const AUDIT_ACTION_LABELS: Record<ProviderAuditAction, string> = {
  "connection.requested": "Bağlantı isteği oluşturuldu",
  "connection.established": "Sunucu bağlantıyı kurdu",
  "connection.verified": "Bağlantı yeniden doğrulandı",
  "connection.degraded": "Bağlantı bozuldu",
  "credential.rotated": "Kimlik bilgisi döndürüldü",
  "connection.revoked": "Bağlantı iptal edildi",
  "policy.changed": "Yönlendirme politikası değişti",
  "consent.recorded": "Veri bildirimi kabulü kaydedildi",
};

export function auditActionLabel(action: ProviderAuditAction): string {
  return AUDIT_ACTION_LABELS[action];
}

/* ---------------------------------------------------------------- wizard */

const STEP_LABELS: Record<WizardStep, string> = {
  provider: "Sağlayıcı",
  method: "Yöntem",
  consent: "Veri bildirimi",
  configure: "Yapılandırma",
  verify: "Doğrulama",
  review: "Özet",
};

export function wizardStepLabel(step: WizardStep): string {
  return STEP_LABELS[step];
}

/* ---------------------------------------------------------------- numbers */

/**
 * A rate-limit or budget figure that a host did not supply.
 *
 * `null` renders as an em dash rather than a confident zero: "0 istek
 * kullanıldı" and "bu sayıyı kimse bilmiyor" are different facts.
 */
export function formatMeasured(value: number | null, formatter: (value: number) => string): string {
  return value === null ? "—" : formatter(value);
}
