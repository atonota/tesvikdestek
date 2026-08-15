/**
 * The provider catalogue: which door each vendor actually opens.
 *
 * This is the module that decides what the product is allowed to offer, and it
 * is written from one rule: **a method appears as available only when the
 * vendor documents an official path for it.** Everything else is listed as
 * unavailable with the reason, because a missing option teaches nobody why it
 * is missing, and a fabricated option teaches something worse.
 *
 * Three distinctions are load-bearing here and are the ones most likely to be
 * quietly eroded by a later "just add sign-in with X" ticket:
 *
 * 1. **OAuth is not a synonym for "log in with your account."** Gemini has a
 *    real Google OAuth flow. OpenAI and Anthropic do not publish a consumer
 *    account OAuth app flow that a third-party product may drive; what they
 *    publish is a first-party CLI/app sign-in. Those are different mechanisms
 *    with different trust models, so they are different `ConnectionMethodId`s.
 *
 * 2. **A host-managed session is performed by the host, not by this browser.**
 *    The operator signs in through the vendor's own application or CLI on the
 *    machine that runs the workload; that host then reports a verified session.
 *    Reading, importing or replaying a browser cookie is not this method, is
 *    not supported, and has no representation anywhere in this subsystem.
 *
 * 3. **OpenClaw is reached through a gateway.** Its official documentation
 *    defines gateway authentication as a token, a password or a trusted proxy,
 *    and defines named model-provider auth profiles on the gateway - so those
 *    two are the available methods. It is deliberately *not* labelled a direct
 *    consumer-account OAuth provider, and no first-party consumer API key or
 *    host-verified subscription session is documented for reaching the
 *    gateway, so those three stay unavailable with their reasons.
 *
 * `trainsOnData` is `null` on every built-in entry, and that is the honest
 * value: this client cannot verify a vendor's training policy, and restating an
 * unverified `false` would be exactly the reassurance it must not give. A host
 * with a signed agreement may inject a catalogue that says otherwise.
 */

import type {
  ConnectionMethodId,
  ProviderDescriptor,
  ProviderId,
  ProviderMethod,
} from "./types";

/** Shared wording for the one thing every disclosure has in common. */
const UNVERIFIABLE_POLICY =
  "Bu istemci sağlayıcının politikasını doğrulayamaz; bağlayıcı metin sağlayıcının yayımladığı politikadır.";

const GEMINI: ProviderDescriptor = {
  id: "gemini",
  name: "Google Gemini",
  vendor: "Google",
  summary:
    "Google'ın Gemini modelleri. Hem Google hesabı üzerinden yetkilendirme hem de proje bazlı API anahtarı ile erişilebilir.",
  docsUrl: "https://ai.google.dev/gemini-api/docs",
  docsConfirmed: true,
  dataRouting: {
    categories: ["prompt-content", "document-content", "usage-metadata"],
    residency: "Google'ın seçtiği bölge. Bu istemci bölgeyi belirleyemez ve ölçemez.",
    retention: `Verinin ne kadar süre tutulduğu sağlayıcının API şartlarına bağlıdır. ${UNVERIFIABLE_POLICY}`,
    trainsOnData: null,
    policyUrl: "https://ai.google.dev/gemini-api/terms",
  },
  methods: [
    {
      method: "oauth",
      label: "Google ile yetkilendir (OAuth)",
      availability: "available",
      reason:
        "Google, üçüncü taraf uygulamaların sürdürebileceği resmî bir OAuth yetkilendirme akışı yayımlar. Akışı sunucu başlatır; tarayıcı yalnızca yönlendirmeyi izler.",
      docsUrl: "https://ai.google.dev/gemini-api/docs/oauth",
      requires: ["oauthBroker"],
    },
    {
      method: "api-key",
      label: "Gemini API anahtarı",
      availability: "available",
      reason:
        "Google AI Studio'da üretilen proje anahtarı. Anahtar sunucuya bir kez aktarılır ve bu istemcide hiçbir yere yazılmaz.",
      docsUrl: "https://ai.google.dev/gemini-api/docs/api-key",
      requires: ["apiKeyExchange"],
    },
    {
      method: "host-session",
      label: "Barındırıcı tarafından yönetilen abonelik oturumu",
      availability: "unavailable",
      reason:
        "Gemini için barındırıcının doğrulayıp bildirebileceği ayrı bir abonelik oturumu portu tanımlı değil. Hesap erişimi OAuth akışıyla sağlanır.",
      docsUrl: "https://ai.google.dev/gemini-api/docs/oauth",
      requires: ["hostSessionBridge"],
    },
    {
      method: "gateway-token",
      label: "Ağ geçidi belirteci",
      availability: "unavailable",
      reason:
        "Bu kurulumda Gemini'yi aracılayan bir ağ geçidi tanımlı değil. Ağ geçidi eklenirse bu yöntem sağlayıcı bazında yeniden değerlendirilir.",
      docsUrl: "https://ai.google.dev/gemini-api/docs",
      requires: ["gatewayBroker"],
    },
    {
      method: "host-auth-profile",
      label: "Barındırıcıdaki adlandırılmış kimlik profili",
      availability: "unavailable",
      reason:
        "Barındırıcıda Gemini için adlandırılmış kimlik profili şeması tanımlı değil; profil listesi sunucudan gelmediği sürece seçilecek bir şey yoktur.",
      docsUrl: "https://ai.google.dev/gemini-api/docs",
      requires: ["hostAuthProfiles"],
    },
  ],
};

const OPENAI: ProviderDescriptor = {
  id: "openai",
  name: "OpenAI / ChatGPT",
  vendor: "OpenAI",
  summary:
    "OpenAI modelleri. Platform API anahtarıyla ya da barındırıcının yürüttüğü resmî ChatGPT/Codex oturumuyla erişilir.",
  docsUrl: "https://platform.openai.com/docs",
  docsConfirmed: true,
  dataRouting: {
    categories: ["prompt-content", "document-content", "usage-metadata"],
    residency: "OpenAI'nin seçtiği bölge. Bu istemci bölgeyi belirleyemez ve ölçemez.",
    retention: `Verinin ne kadar süre tutulduğu sağlayıcının API veri kullanım politikasına bağlıdır. ${UNVERIFIABLE_POLICY}`,
    trainsOnData: null,
    policyUrl: "https://openai.com/policies/api-data-usage-policies",
  },
  methods: [
    {
      method: "api-key",
      label: "OpenAI API anahtarı",
      availability: "available",
      reason:
        "Platform hesabında üretilen anahtar. Anahtar sunucuya bir kez aktarılır ve bu istemcide hiçbir yere yazılmaz.",
      docsUrl: "https://platform.openai.com/docs/api-reference/authentication",
      requires: ["apiKeyExchange"],
    },
    {
      method: "host-session",
      label: "ChatGPT/Codex ile giriş (barındırıcı oturumu)",
      availability: "available",
      reason:
        "Resmî Codex uygulaması/CLI'si giriş işlemini barındırıcı makinede yürütür ve doğrulanmış oturumu sunucuya bildirir. Bu bir barındırıcı oturum sözleşmesidir; tarayıcıdan çerez veya belirteç okunmaz.",
      docsUrl: "https://developers.openai.com/codex/cli",
      requires: ["hostSessionBridge"],
    },
    {
      method: "oauth",
      label: "Hesapla yetkilendirme (OAuth)",
      availability: "unavailable",
      reason:
        "Üçüncü taraf bir ürünün sürdürebileceği tüketici hesabı OAuth akışı yayımlanmıyor. Hesap tabanlı erişimin resmî yolu barındırıcı oturumudur; burada OAuth sunmak olmayan bir kapıyı varmış gibi göstermek olurdu.",
      docsUrl: "https://developers.openai.com/codex/cli",
      requires: ["oauthBroker"],
    },
    {
      method: "gateway-token",
      label: "Ağ geçidi belirteci",
      availability: "unavailable",
      reason:
        "Bu kurulumda OpenAI'yi aracılayan bir ağ geçidi tanımlı değil; aracısız erişim API anahtarı yöntemiyle yapılır.",
      docsUrl: "https://platform.openai.com/docs",
      requires: ["gatewayBroker"],
    },
    {
      method: "host-auth-profile",
      label: "Barındırıcıdaki adlandırılmış kimlik profili",
      availability: "unavailable",
      reason:
        "Barındırıcıda OpenAI için adlandırılmış kimlik profili şeması tanımlı değil; profil listesi sunucudan gelmediği sürece seçilecek bir şey yoktur.",
      docsUrl: "https://platform.openai.com/docs",
      requires: ["hostAuthProfiles"],
    },
  ],
};

const CLAUDE: ProviderDescriptor = {
  id: "claude",
  name: "Claude",
  vendor: "Anthropic",
  summary:
    "Anthropic'in Claude modelleri. Anthropic API anahtarıyla ya da barındırıcının doğruladığı Claude.ai / Claude Code abonelik oturumuyla erişilir.",
  docsUrl: "https://docs.anthropic.com",
  docsConfirmed: true,
  dataRouting: {
    categories: ["prompt-content", "document-content", "usage-metadata"],
    residency: "Anthropic'in seçtiği bölge. Bu istemci bölgeyi belirleyemez ve ölçemez.",
    retention: `Verinin ne kadar süre tutulduğu sağlayıcının ticari şartlarına bağlıdır. ${UNVERIFIABLE_POLICY}`,
    trainsOnData: null,
    policyUrl: "https://www.anthropic.com/legal/commercial-terms",
  },
  methods: [
    {
      method: "api-key",
      label: "Anthropic API anahtarı",
      availability: "available",
      reason:
        "Anthropic konsolunda üretilen anahtar. Anahtar sunucuya bir kez aktarılır ve bu istemcide hiçbir yere yazılmaz.",
      docsUrl: "https://docs.anthropic.com/en/api/getting-started",
      requires: ["apiKeyExchange"],
    },
    {
      method: "host-session",
      label: "Claude.ai / Claude Code abonelik oturumu (barındırıcı oturumu)",
      availability: "available",
      reason:
        "Resmî Claude Code istemcisi girişi barındırıcı makinede yürütür ve doğrulanmış abonelik oturumunu sunucuya bildirir. Doğrulama barındırıcıya aittir; hiçbir çerez veya belirteç tarayıcıdan okunmaz.",
      docsUrl: "https://docs.anthropic.com/en/docs/claude-code/setup",
      requires: ["hostSessionBridge"],
    },
    {
      method: "oauth",
      label: "Hesapla yetkilendirme (OAuth)",
      availability: "unavailable",
      reason:
        "Üçüncü taraf bir ürünün sürdürebileceği tüketici hesabı OAuth akışı yayımlanmıyor. Abonelik erişiminin resmî yolu barındırıcı oturumudur.",
      docsUrl: "https://docs.anthropic.com/en/docs/claude-code/setup",
      requires: ["oauthBroker"],
    },
    {
      method: "gateway-token",
      label: "Ağ geçidi belirteci",
      availability: "unavailable",
      reason:
        "Bu kurulumda Claude'u aracılayan bir ağ geçidi tanımlı değil; aracısız erişim API anahtarı yöntemiyle yapılır.",
      docsUrl: "https://docs.anthropic.com",
      requires: ["gatewayBroker"],
    },
    {
      method: "host-auth-profile",
      label: "Barındırıcıdaki adlandırılmış kimlik profili",
      availability: "unavailable",
      reason:
        "Barındırıcıda Claude için adlandırılmış kimlik profili şeması tanımlı değil; profil listesi sunucudan gelmediği sürece seçilecek bir şey yoktur.",
      docsUrl: "https://docs.anthropic.com",
      requires: ["hostAuthProfiles"],
    },
  ],
};

const OPENCLAW: ProviderDescriptor = {
  id: "openclaw",
  name: "OpenClaw",
  vendor: "OpenClaw",
  summary:
    "Bir ağ geçidi üzerinden aracılanan OpenClaw erişimi. Bağlantı ya ağ geçidi belirteciyle ya da barındırıcıda tanımlı adlandırılmış kimlik profiliyle kurulur.",
  docsUrl: "https://docs.openclaw.ai/",
  docsConfirmed: true,
  dataRouting: {
    categories: ["prompt-content", "usage-metadata"],
    residency:
      "Ağ geçidini işleten tarafın seçtiği bölge. Bu istemci ağ geçidinin nerede çalıştığını bilemez.",
    retention: `Verinin ne kadar süre tutulduğu ağ geçidi işletmecisinin politikasına bağlıdır. ${UNVERIFIABLE_POLICY}`,
    trainsOnData: null,
    policyUrl: "https://docs.openclaw.ai/",
  },
  methods: [
    {
      method: "gateway-token",
      label: "Ağ geçidi belirteci",
      availability: "available",
      reason:
        "Ağ geçidi kimlik doğrulaması resmî belgelerde belirteç, parola ve güvenilen vekil sunucu biçimlerinde tanımlıdır. Belirteç sunucuya bir kez aktarılır ve bu istemcide hiçbir yere yazılmaz.",
      docsUrl: "https://docs.openclaw.ai/gateway/configuration-reference",
      requires: ["gatewayBroker"],
    },
    {
      method: "host-auth-profile",
      label: "Barındırıcıdaki adlandırılmış kimlik profili",
      availability: "available",
      reason:
        "Resmî belgeler ağ geçidinde adlandırılmış model sağlayıcı kimlik profilleri tanımlar. Profil adla seçilir; istemci profilin içeriğini hiç görmez, yalnızca adını iletir.",
      docsUrl: "https://docs.openclaw.ai/gateway/authentication",
      requires: ["hostAuthProfiles"],
    },
    {
      method: "oauth",
      label: "Hesapla yetkilendirme (OAuth)",
      availability: "unavailable",
      reason:
        "Resmî ağ geçidi kimlik doğrulama belgelerinde doğrudan tüketici hesabı OAuth akışı tanımlı değil. Bu yöntemi sunmak, ağ geçidi üzerinden giden bir bağlantıyı doğrudan hesap bağlantısı gibi göstermek olurdu.",
      docsUrl: "https://docs.openclaw.ai/gateway/authentication",
      requires: ["oauthBroker"],
    },
    {
      method: "api-key",
      label: "Sağlayıcı API anahtarı",
      availability: "unavailable",
      reason:
        "Ağ geçidine bağlanmak için birinci taraf bir tüketici API anahtarı tanımlı değil; resmî belgelerde anahtarın yerini ağ geçidi belirteci alır.",
      docsUrl: "https://docs.openclaw.ai/gateway/authentication",
      requires: ["apiKeyExchange"],
    },
    {
      method: "host-session",
      label: "Barındırıcı tarafından yönetilen abonelik oturumu",
      availability: "unavailable",
      reason:
        "Resmî belgelerde barındırıcının doğrulayıp bildirebileceği bir abonelik oturumu portu tanımlı değil; ağ geçidine erişim ağ geçidi kimliğiyle yapılır.",
      docsUrl: "https://docs.openclaw.ai/gateway/authentication",
      requires: ["hostSessionBridge"],
    },
  ],
};

/** Ordered for the catalogue view; the order is presentational, not a ranking. */
export const PROVIDER_CATALOG: readonly ProviderDescriptor[] = [GEMINI, OPENAI, CLAUDE, OPENCLAW];

export function providerById(id: ProviderId): ProviderDescriptor | undefined {
  return PROVIDER_CATALOG.find((provider) => provider.id === id);
}

export function methodFor(
  providerId: ProviderId,
  method: ConnectionMethodId,
): ProviderMethod | undefined {
  return providerById(providerId)?.methods.find((entry) => entry.method === method);
}

/**
 * Availability asked as a question with one right answer.
 *
 * Written as an equality against `"available"` rather than `!== "unavailable"`,
 * because the negative form silently absorbs every verdict added later -
 * including the next one that means "we are not sure".
 */
export function isMethodAvailable(providerId: ProviderId, method: ConnectionMethodId): boolean {
  return methodFor(providerId, method)?.availability === "available";
}

export function availableMethods(providerId: ProviderId): readonly ProviderMethod[] {
  return providerById(providerId)?.methods.filter((entry) => entry.availability === "available") ?? [];
}

export function unavailableMethods(providerId: ProviderId): readonly ProviderMethod[] {
  return (
    providerById(providerId)?.methods.filter((entry) => entry.availability === "unavailable") ?? []
  );
}

/** Every method any provider mentions, for the comparison matrix's columns. */
export const ALL_METHOD_IDS: readonly ConnectionMethodId[] = [
  "api-key",
  "oauth",
  "host-session",
  "gateway-token",
  "host-auth-profile",
];
