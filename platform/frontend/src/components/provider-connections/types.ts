/**
 * The provider connection contract.
 *
 * This module is the whole vocabulary the subsystem speaks: which AI providers
 * exist, which connection methods each one *actually* supports, what a live
 * connection may report about itself, and what a host application has to hand
 * in before any control becomes live. Plain TypeScript - no React, no network,
 * no storage - so a future backend port has exactly one place to satisfy.
 *
 * Four decisions here are load-bearing and are encoded in the types rather than
 * left to a reviewer's memory:
 *
 * 1. **A secret is never a `string` field on a record.** `EphemeralSecret` is
 *    the only shape a secret travels in, it is marked `oneTimeUse`, and no
 *    connection type has a place to put one. A type with nowhere to store a key
 *    cannot accidentally grow a key.
 * 2. **Status is inbound-only.** `ConnectionStatus` values arrive from a
 *    backend result. The client's own vocabulary for "the user pressed connect"
 *    is `ConnectionRequest`, which has no `connected` member at all, so no
 *    amount of local state can paint a connection that does not exist.
 * 3. **Method support is per provider and closed.** `ProviderMethod` pairs a
 *    method with an availability verdict and a reason. There is no "probably
 *    works" - a method is `available` with a documented requirement, or
 *    `unavailable` with the reason it is unavailable.
 * 4. **`host-session` is not a cookie.** It names an official, host-managed
 *    sign-in performed by a first-party application or CLI, which then reports
 *    a verified session. Importing browser cookies is not this, is not
 *    supported, and has no representation here.
 */

import type { ReactNode } from "react";

/* -------------------------------------------------------------- providers */

export type ProviderId = "gemini" | "openai" | "claude" | "openclaw";

/**
 * How a connection is established.
 *
 * `api-key`            operator pastes a provider-issued API key.
 * `oauth`              official authorisation-code flow, started by the backend.
 * `host-session`       official first-party app/CLI sign-in; the host verifies
 *                      the resulting subscription session and reports it. The
 *                      browser never sees, imports or scrapes a cookie.
 * `gateway-token`      token for a gateway that brokers the provider.
 * `host-auth-profile`  a named credential profile already configured on the
 *                      host; the client selects it by name and never reads it.
 */
export type ConnectionMethodId =
  | "api-key"
  | "oauth"
  | "host-session"
  | "gateway-token"
  | "host-auth-profile";

/** Whether a provider supports a method at all. No third, hopeful value. */
export type MethodAvailability = "available" | "unavailable";

export interface ProviderMethod {
  readonly method: ConnectionMethodId;
  /** The provider's own name for this path, e.g. "Sign in with ChatGPT". */
  readonly label: string;
  readonly availability: MethodAvailability;
  /**
   * Why it is available (what the operator must supply) or why it is not.
   * Never empty: an unavailable method with no reason teaches nobody anything.
   */
  readonly reason: string;
  /** Official documentation for this exact path. Rendered as an external link. */
  readonly docsUrl: string;
  /** What the host must be able to do before the method can be offered live. */
  readonly requires: readonly BackendCapabilityId[];
}

/** Capabilities a host declares. Everything defaults to absent. */
export type BackendCapabilityId =
  | "apiKeyExchange"
  | "oauthBroker"
  | "hostSessionBridge"
  | "gatewayBroker"
  | "hostAuthProfiles"
  | "healthProbe"
  | "credentialRotation"
  | "revocation"
  | "routingPolicy"
  | "auditPersistence"
  | "usageMetering"
  | "budgetEnforcement";

export interface ProviderDescriptor {
  readonly id: ProviderId;
  readonly name: string;
  readonly vendor: string;
  /** One sentence, factual: what this provider is, not why to pick it. */
  readonly summary: string;
  readonly docsUrl: string;
  /**
   * Whether the documentation link was confirmed against a first-party source
   * when this entry was written.
   *
   * `false` is not a defect to hide - it renders as a visible caveat next to
   * the link. A catalogue that presents an unconfirmed URL with the same
   * confidence as a confirmed one is how an operator ends up reading someone
   * else's documentation and believing it is the vendor's.
   */
  readonly docsConfirmed: boolean;
  readonly methods: readonly ProviderMethod[];
  /**
   * Data-handling facts the operator must see *before* choosing a method.
   * Injected as declared facts, never inferred by this client.
   */
  readonly dataRouting: DataRoutingDisclosure;
}

/* ------------------------------------------------------------- disclosure */

export type DataCategory =
  | "prompt-content"
  | "document-content"
  | "company-facts"
  | "operator-identity"
  | "usage-metadata";

/**
 * What leaves the deployment when this provider is used.
 *
 * `residency` and `retention` are strings, not enums, because the honest answer
 * is frequently "the vendor documents this and we restate it", and squeezing
 * that into an enum invents precision the client does not have.
 */
export interface DataRoutingDisclosure {
  readonly categories: readonly DataCategory[];
  readonly residency: string;
  readonly retention: string;
  /** Whether the vendor documents training on this traffic; `null` = unstated. */
  readonly trainsOnData: boolean | null;
  readonly policyUrl: string;
}

/* ------------------------------------------------------------- permissions */

/** Every flag defaults to false: an absent authorisation system is "no". */
export interface ProviderPermissions {
  readonly canConnect: boolean;
  readonly canRotate: boolean;
  readonly canRevoke: boolean;
  readonly canReverify: boolean;
  readonly canEditRouting: boolean;
  readonly canViewAudit: boolean;
}

export const NO_PROVIDER_PERMISSIONS: ProviderPermissions = {
  canConnect: false,
  canRotate: false,
  canRevoke: false,
  canReverify: false,
  canEditRouting: false,
  canViewAudit: false,
};

/* ----------------------------------------------------------- capabilities */

/** Whether the component exists and works, independent of any backend. */
export type UiReadiness = "ready" | "partial" | "absent";

/** Whether a real backend can serve it today. */
export type BackendReadiness = "available" | "blocked";

export interface ProviderCapability {
  readonly id: string;
  readonly title: string;
  readonly ui: UiReadiness;
  readonly backend: BackendReadiness;
  /** True only when both the component and a backend can actually do it. */
  readonly enabled: boolean;
  readonly reason: string;
}

/**
 * What the host tells the subsystem it can do.
 *
 * `backend` is a flat allowlist of capability ids. Absent means absent: there
 * is no "unknown, assume yes".
 */
export interface ProviderConnectionCapabilities {
  readonly backend: readonly BackendCapabilityId[];
  readonly permissions: ProviderPermissions;
}

/* ------------------------------------------------------------------ secret */

/**
 * A secret in flight.
 *
 * The only shape a key or token is ever allowed to take in this subsystem. It
 * is handed to a caller-supplied callback and is expected to be consumed
 * immediately: `oneTimeUse` is a literal `true` so that a future author cannot
 * quietly widen it to "sometimes reusable", and the field name is the warning.
 *
 * Nothing in this package writes it anywhere. There is no field of this type on
 * any connection, audit entry, policy or grid row.
 */
export interface EphemeralSecret {
  readonly value: string;
  readonly oneTimeUse: true;
  /** Which field it came from, so a caller can route it without guessing. */
  readonly fieldId: string;
}

/* ------------------------------------------------------------- connection */

/**
 * Every state a connection can honestly be in.
 *
 * `pending` means a request was created and the backend has not answered.
 * `degraded` means connected but failing some probes. `expired` and `revoked`
 * are distinct: one lapsed, the other was withdrawn, and an operator needs to
 * know which.
 */
export type ConnectionStatus =
  | "disconnected"
  | "pending"
  | "connected"
  | "degraded"
  | "expired"
  | "revoked"
  | "error";

/**
 * What pressing "connect" may produce locally.
 *
 * Deliberately a different, smaller type than `ConnectionStatus`, and
 * deliberately without `connected`: the client can create a request and can
 * observe that it failed to be created. It cannot conclude success. Success is
 * a `ConnectionStatus` and only ever arrives from outside.
 */
export type ConnectionRequestState = "idle" | "creating" | "created" | "create-failed";

export interface ConnectionRequest {
  readonly state: ConnectionRequestState;
  readonly providerId: ProviderId;
  readonly method: ConnectionMethodId;
  /** Present only once the backend acknowledged the request. */
  readonly requestId: string | null;
  readonly error: string | null;
}

export interface RateLimitWindow {
  readonly label: string;
  readonly limit: number | null;
  readonly used: number | null;
  readonly resetsAt: string | null;
}

export interface UsageBudget {
  /** Minor currency units, as the host reports them. Never computed here. */
  readonly spentMinorUnits: number | null;
  readonly budgetMinorUnits: number | null;
  readonly currency: string;
  readonly periodLabel: string;
}

/**
 * One connection as the backend describes it.
 *
 * There is no secret on this record and there is no place to put one: a key,
 * token or session cookie has no field here, by construction. `maskedHint` is
 * the last four characters a backend chose to echo, and it is a display string,
 * not a credential.
 */
export interface ProviderConnection {
  readonly id: string;
  readonly providerId: ProviderId;
  readonly method: ConnectionMethodId;
  readonly label: string;
  readonly status: ConnectionStatus;
  /** Why it is degraded, expired, revoked or in error. Required for those. */
  readonly statusReason: string | null;
  readonly maskedHint: string | null;
  readonly lastCheckedAt: string | null;
  readonly expiresAt: string | null;
  readonly scopes: readonly string[];
  readonly modelAllowlist: readonly string[];
  readonly rateLimits: readonly RateLimitWindow[];
  readonly budget: UsageBudget | null;
  readonly createdAt: string;
  readonly createdByLabel: string;
}

/* ------------------------------------------------------------------ audit */

export type ProviderAuditAction =
  | "connection.requested"
  | "connection.established"
  | "connection.verified"
  | "connection.degraded"
  | "credential.rotated"
  | "connection.revoked"
  | "policy.changed"
  | "consent.recorded";

export interface ProviderAuditEntry {
  readonly id: string;
  readonly action: ProviderAuditAction;
  readonly actorLabel: string;
  readonly occurredAt: string;
  readonly detail: string;
  readonly connectionId: string | null;
}

/* ----------------------------------------------------------------- policy */

export type DegradationMode = "fail-closed" | "next-in-order" | "read-only-cache";

export interface RoutingRule {
  readonly connectionId: string;
  /** 1 is tried first. Duplicates are a configuration error, not a tie. */
  readonly priority: number;
  readonly modelAllowlist: readonly string[];
  readonly enabled: boolean;
}

export interface RoutingPolicy {
  readonly rules: readonly RoutingRule[];
  readonly degradation: DegradationMode;
}

/* ------------------------------------------------------------------ wizard */

export type WizardStep = "provider" | "method" | "consent" | "configure" | "verify" | "review";

/**
 * The wizard's own state. Note what is absent: no secret, no status.
 *
 * The draft holds a *reference* to what the operator chose, never the value
 * they typed into a secret field. That value lives in the field's own state for
 * as long as the field is mounted and goes nowhere else.
 */
export interface WizardState {
  readonly step: WizardStep;
  readonly providerId: ProviderId | null;
  readonly method: ConnectionMethodId | null;
  readonly consentAcknowledged: boolean;
  readonly label: string;
  readonly modelAllowlist: readonly string[];
  /** Whether the non-secret configuration is complete enough to submit. */
  readonly configurationComplete: boolean;
  readonly request: ConnectionRequest | null;
  /** The backend's answer, once there is one. Never set by the wizard itself. */
  readonly result: ProviderConnection | null;
  readonly error: string | null;
}

export type WizardEvent =
  | { readonly type: "provider.select"; readonly providerId: ProviderId }
  | { readonly type: "method.select"; readonly method: ConnectionMethodId }
  | { readonly type: "consent.acknowledge"; readonly acknowledged: boolean }
  | { readonly type: "configure.set"; readonly label: string; readonly complete: boolean }
  | { readonly type: "configure.allowlist"; readonly models: readonly string[] }
  | { readonly type: "request.start" }
  | { readonly type: "request.created"; readonly requestId: string }
  | { readonly type: "request.failed"; readonly message: string }
  /** The only door a `ProviderConnection` can come through. */
  | { readonly type: "backend.result"; readonly connection: ProviderConnection }
  /** Move to the next step, but only when that step's gate is open. */
  | { readonly type: "next" }
  | { readonly type: "back" }
  | { readonly type: "reset" };

/* --------------------------------------------------------------- the port */

/**
 * What a host must implement before any of this does anything.
 *
 * Every member is optional. An absent callback is not a stub to fill in later
 * with a fake - it is the reason the corresponding control renders disabled.
 * No endpoint path appears anywhere in this subsystem; the host owns routing.
 */
export interface ProviderConnectionPort {
  /**
   * Create a connection request. Returns the backend's acknowledgement only.
   * It deliberately cannot return "connected": establishing a connection is a
   * separate, backend-driven event delivered as a `ProviderConnection`.
   */
  readonly createConnectionRequest?: (input: {
    readonly providerId: ProviderId;
    readonly method: ConnectionMethodId;
    readonly label: string;
    readonly modelAllowlist: readonly string[];
    /** Present only for methods that need one. Consumed, never stored. */
    readonly secret?: EphemeralSecret;
  }) => Promise<{ readonly requestId: string }>;
  readonly reverify?: (connectionId: string) => void;
  readonly rotate?: (connectionId: string) => void;
  readonly revoke?: (connectionId: string, reason: string) => void;
  readonly saveRoutingPolicy?: (policy: RoutingPolicy) => void;
}

/* --------------------------------------------------------- shared shapes */

export type ProviderSurfaceStatus =
  | "idle"
  | "loading"
  | "refreshing"
  | "error"
  | "empty"
  | "no-results"
  | "read-only"
  | "partial";

export interface ProviderEmptyCopy {
  readonly title: string;
  readonly reason: string;
  readonly action?: ReactNode;
}

export interface ProviderPanelProps {
  readonly capabilities: ProviderConnectionCapabilities;
  readonly className?: string;
}
