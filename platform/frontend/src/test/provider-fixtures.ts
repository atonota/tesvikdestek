/**
 * Provider connection fixtures - tests and Storybook only.
 *
 * This file lives under `src/test/` on purpose. Nothing under `src/components`
 * or `src/routes` may import it, and an acceptance test asserts exactly that,
 * so a fixture can never become the thing a real operator sees. That boundary
 * carries the weight now that `/ayarlar/yapay-zeka` exists and renders the
 * connection centre for real: the route passes an empty connection list and
 * `NO_BACKEND_CAPABILITIES`, so an operator sees no connection rather than a
 * convincing one. These records exercise components and document the states a
 * backend will one day produce - never to stand in for an endpoint that does
 * not exist.
 *
 * Note what no fixture contains: an API key, a token, a session cookie or any
 * other credential. The types have no field for one, and inventing a realistic
 * looking secret in a fixture is how a fake secret ends up in a screenshot.
 */

import type {
  ProviderAuditEntry,
  ProviderConnection,
  ProviderConnectionCapabilities,
  RoutingPolicy,
} from "@/components/provider-connections/types";

/** Frozen "now" for every relative assertion in tests and stories. */
export const PROVIDER_NOW = new Date("2026-08-14T12:00:00Z");

/* ---------------------------------------------------------- capabilities */

/** The honest default: a host that has declared nothing. */
export const PROVIDER_CAPABILITIES_NONE: ProviderConnectionCapabilities = {
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

/** A host that can broker every method but grants no permission. */
export const PROVIDER_CAPABILITIES_BACKEND_ONLY: ProviderConnectionCapabilities = {
  backend: [
    "apiKeyExchange",
    "oauthBroker",
    "hostSessionBridge",
    "gatewayBroker",
    "hostAuthProfiles",
    "healthProbe",
    "credentialRotation",
    "revocation",
    "routingPolicy",
    "auditPersistence",
    "usageMetering",
  ],
  permissions: {
    canConnect: false,
    canRotate: false,
    canRevoke: false,
    canReverify: false,
    canEditRouting: false,
    canViewAudit: false,
  },
};

/** Backend and permissions both present: the only shape with live controls. */
export const PROVIDER_CAPABILITIES_FULL: ProviderConnectionCapabilities = {
  backend: PROVIDER_CAPABILITIES_BACKEND_ONLY.backend,
  permissions: {
    canConnect: true,
    canRotate: true,
    canRevoke: true,
    canReverify: true,
    canEditRouting: true,
    canViewAudit: true,
  },
};

/** Permissions granted while the backend cannot do any of it. */
export const PROVIDER_CAPABILITIES_PERMISSIONS_ONLY: ProviderConnectionCapabilities = {
  backend: [],
  permissions: PROVIDER_CAPABILITIES_FULL.permissions,
};

/* ------------------------------------------------------------ connections */

export const CONNECTION_CLAUDE_API: ProviderConnection = {
  id: "c-claude-api",
  providerId: "claude",
  method: "api-key",
  label: "Claude - üretim anahtarı",
  status: "connected",
  statusReason: null,
  maskedHint: "••••4f21",
  lastCheckedAt: "2026-08-14T11:40:00Z",
  expiresAt: null,
  scopes: ["messages:write"],
  modelAllowlist: ["claude-opus-5", "claude-sonnet-5"],
  rateLimits: [
    { label: "İstek/dakika", limit: 4000, used: 128, resetsAt: "2026-08-14T12:01:00Z" },
    { label: "Token/dakika", limit: 400_000, used: 91_200, resetsAt: "2026-08-14T12:01:00Z" },
  ],
  budget: {
    spentMinorUnits: 41_250,
    budgetMinorUnits: 100_000,
    currency: "USD",
    periodLabel: "Ağustos 2026",
  },
  createdAt: "2026-07-02T08:00:00Z",
  createdByLabel: "İsmail Karaca",
};

/** Host-verified subscription session - no cookie, no scraped token. */
export const CONNECTION_CLAUDE_SESSION: ProviderConnection = {
  id: "c-claude-session",
  providerId: "claude",
  method: "host-session",
  label: "Claude Code - barındırıcı oturumu",
  status: "degraded",
  statusReason: "Son iki sağlık yoklaması zaman aşımına uğradı.",
  maskedHint: null,
  lastCheckedAt: "2026-08-14T10:05:00Z",
  expiresAt: "2026-09-30T00:00:00Z",
  scopes: ["subscription:use"],
  modelAllowlist: [],
  rateLimits: [],
  budget: null,
  createdAt: "2026-06-11T09:30:00Z",
  createdByLabel: "İsmail Karaca",
};

export const CONNECTION_OPENAI_EXPIRED: ProviderConnection = {
  id: "c-openai-session",
  providerId: "openai",
  method: "host-session",
  label: "ChatGPT/Codex - barındırıcı oturumu",
  status: "expired",
  statusReason: "Abonelik oturumunun süresi doldu; barındırıcıda yeniden giriş gerekiyor.",
  maskedHint: null,
  lastCheckedAt: "2026-08-13T22:00:00Z",
  expiresAt: "2026-08-13T23:59:00Z",
  scopes: [],
  modelAllowlist: [],
  rateLimits: [],
  budget: null,
  createdAt: "2026-05-20T07:15:00Z",
  createdByLabel: "İsmail Karaca",
};

export const CONNECTION_GEMINI_REVOKED: ProviderConnection = {
  id: "c-gemini-oauth",
  providerId: "gemini",
  method: "oauth",
  label: "Gemini - Google OAuth",
  status: "revoked",
  statusReason: "Yetki Google hesabı yöneticisi tarafından geri çekildi.",
  maskedHint: null,
  lastCheckedAt: "2026-08-12T16:20:00Z",
  expiresAt: null,
  scopes: ["generative-language.retriever"],
  modelAllowlist: ["gemini-2.5-pro"],
  rateLimits: [],
  budget: null,
  createdAt: "2026-04-04T11:00:00Z",
  createdByLabel: "Denetim Ekibi",
};

/**
 * A connection whose stored status says connected while its expiry has passed.
 *
 * This one exists to prove the derivation: a stale `connected` must not be
 * rendered as healthy just because a backend has not re-probed it yet.
 */
export const CONNECTION_OPENCLAW_STALE: ProviderConnection = {
  id: "c-openclaw-gateway",
  providerId: "openclaw",
  method: "gateway-token",
  label: "OpenClaw - ağ geçidi belirteci",
  status: "connected",
  statusReason: null,
  maskedHint: "••••9c02",
  lastCheckedAt: "2026-07-30T09:00:00Z",
  expiresAt: "2026-08-01T00:00:00Z",
  scopes: ["gateway:invoke"],
  modelAllowlist: [],
  rateLimits: [{ label: "İstek/dakika", limit: null, used: null, resetsAt: null }],
  budget: null,
  createdAt: "2026-03-01T10:00:00Z",
  createdByLabel: "İsmail Karaca",
};

export const PROVIDER_CONNECTIONS: readonly ProviderConnection[] = [
  CONNECTION_CLAUDE_API,
  CONNECTION_CLAUDE_SESSION,
  CONNECTION_OPENAI_EXPIRED,
  CONNECTION_GEMINI_REVOKED,
  CONNECTION_OPENCLAW_STALE,
];

/* ----------------------------------------------------------------- audit */

export const PROVIDER_AUDIT: readonly ProviderAuditEntry[] = [
  {
    id: "pa-1",
    action: "consent.recorded",
    actorLabel: "İsmail Karaca",
    occurredAt: "2026-07-02T07:58:00Z",
    detail: "Veri yönlendirme bildirimi okundu ve kabul edildi.",
    connectionId: "c-claude-api",
  },
  {
    id: "pa-2",
    action: "connection.requested",
    actorLabel: "İsmail Karaca",
    occurredAt: "2026-07-02T07:59:00Z",
    detail: "API anahtarı yöntemiyle bağlantı isteği oluşturuldu.",
    connectionId: "c-claude-api",
  },
  {
    id: "pa-3",
    action: "connection.established",
    actorLabel: "Sunucu",
    occurredAt: "2026-07-02T08:00:00Z",
    detail: "Sunucu bağlantıyı kurdu ve doğruladı.",
    connectionId: "c-claude-api",
  },
  {
    id: "pa-4",
    action: "connection.degraded",
    actorLabel: "Sunucu",
    occurredAt: "2026-08-14T10:05:00Z",
    detail: "Sağlık yoklaması zaman aşımına uğradı.",
    connectionId: "c-claude-session",
  },
  {
    id: "pa-5",
    action: "connection.revoked",
    actorLabel: "Denetim Ekibi",
    occurredAt: "2026-08-12T16:20:00Z",
    detail: "Google hesabı yöneticisi yetkiyi geri çekti.",
    connectionId: "c-gemini-oauth",
  },
];

/* ---------------------------------------------------------------- policy */

export const PROVIDER_POLICY: RoutingPolicy = {
  degradation: "fail-closed",
  rules: [
    {
      connectionId: "c-claude-api",
      priority: 1,
      modelAllowlist: ["claude-opus-5"],
      enabled: true,
    },
    {
      connectionId: "c-openclaw-gateway",
      priority: 2,
      modelAllowlist: [],
      enabled: false,
    },
  ],
};
