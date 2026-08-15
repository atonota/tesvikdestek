/**
 * Provider connection centre states.
 *
 * The subsystem has a product route - `/ayarlar/yapay-zeka` - which renders the
 * catalogue, the wizard and an empty inventory against a backend that has no
 * credential store, no OAuth broker and no health prober. Storybook is
 * therefore not the only place these components are assembled any more; it is
 * the only place the ones that need a *real connection* can be reviewed at all.
 *
 * That is why four of them are classified Storybook-only in
 * `components/registry.ts`. `ConnectionHealthPanel`, `RoutingPolicyBuilder` and
 * `ProviderAuditTimeline` describe a connection's health, routing and history:
 * with nothing connected, a route could only show them holding invented state.
 * `ProviderComparison` is held back for a different and narrower reason - its
 * scroll region needs a keyboard fix in the component itself, and a route-level
 * workaround would hide that rather than fix it.
 *
 * Every story draws on `src/test/provider-fixtures`, which lives outside the
 * runtime tree and cannot be imported by a component or a route.
 *
 * The matrix below is the review surface: nothing connected (the default), a
 * host with no backend at all, permissions without a backend, backend without
 * permissions, each wizard step, the secret field's lifecycle, a degraded
 * connection, a revoked one, a stale-but-expired one, a routing policy with a
 * priority conflict, and the audit view with and without persistence.
 */

import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  ConnectionHealthPanel,
  ConnectionInventory,
  ConnectionWizard,
  ProviderAuditTimeline,
  ProviderCatalogView,
  ProviderComparison,
  RoutingPolicyBuilder,
  SecretField,
  initialWizardState,
  wizardReducer,
} from "./index";
import type { ConnectionMethodId, ProviderId, WizardState } from "./types";
import {
  CONNECTION_CLAUDE_API,
  CONNECTION_CLAUDE_SESSION,
  CONNECTION_GEMINI_REVOKED,
  CONNECTION_OPENAI_EXPIRED,
  CONNECTION_OPENCLAW_STALE,
  PROVIDER_AUDIT,
  PROVIDER_CAPABILITIES_BACKEND_ONLY,
  PROVIDER_CAPABILITIES_FULL,
  PROVIDER_CAPABILITIES_NONE,
  PROVIDER_CAPABILITIES_PERMISSIONS_ONLY,
  PROVIDER_CONNECTIONS,
  PROVIDER_NOW,
  PROVIDER_POLICY,
} from "@/test/provider-fixtures";

/** Walks the machine to a step using real events, never by assembling state. */
function at(step: WizardState["step"], providerId: ProviderId, method: ConnectionMethodId) {
  let state = wizardReducer(initialWizardState(), { type: "provider.select", providerId });
  if (step === "method") return state;
  state = wizardReducer(state, { type: "method.select", method });
  if (step === "consent") return state;
  state = wizardReducer(state, { type: "consent.acknowledge", acknowledged: true });
  state = wizardReducer(state, { type: "next" });
  if (step === "configure") return state;
  state = wizardReducer(state, { type: "configure.set", label: "Üretim bağlantısı", complete: true });
  return wizardReducer(state, { type: "next" });
}

/* --------------------------------------------------------------- catalogue */

const catalogMeta: Meta<typeof ProviderCatalogView> = {
  title: "Sağlayıcı bağlantıları/Katalog",
  component: ProviderCatalogView,
};
export default catalogMeta;

type CatalogStory = StoryObj<typeof ProviderCatalogView>;

/** The honest starting point: a host that has declared nothing. */
export const KatalogHicbiriBagliDegil: CatalogStory = {
  args: { capabilities: PROVIDER_CAPABILITIES_NONE },
};

export const KatalogSunucuHazir: CatalogStory = {
  args: { capabilities: PROVIDER_CAPABILITIES_FULL },
};

export const KarsilastirmaMatrisi: StoryObj<typeof ProviderComparison> = {
  render: () => <ProviderComparison capabilities={PROVIDER_CAPABILITIES_FULL} />,
};

export const KarsilastirmaSunucusuz: StoryObj<typeof ProviderComparison> = {
  render: () => <ProviderComparison capabilities={PROVIDER_CAPABILITIES_NONE} />,
};

/* ------------------------------------------------------------------ secret */

export const GizliAlanBos: StoryObj<typeof SecretField> = {
  render: () => (
    <SecretField fieldId="api-key" label="API anahtarı" onSubmit={() => undefined} />
  ),
};

export const GizliAlanKopyalamaAcik: StoryObj<typeof SecretField> = {
  render: () => (
    <SecretField fieldId="api-key" label="API anahtarı" allowCopy onSubmit={() => undefined} />
  ),
};

export const GizliAlanDevralinmadi: StoryObj<typeof SecretField> = {
  render: () => (
    <SecretField
      fieldId="api-key"
      label="API anahtarı"
      disabled
      disabledReason="Anahtarı devralacak bir uç yok; bu ekran hiçbir değeri iletemez."
      onSubmit={() => undefined}
    />
  ),
};

/* ------------------------------------------------------------------ wizard */

export const SihirbazSaglayiciSecimi: StoryObj<typeof ConnectionWizard> = {
  render: () => <ConnectionWizard capabilities={PROVIDER_CAPABILITIES_FULL} />,
};

/** OpenClaw has no OAuth path; the row is shown disabled with the reason. */
export const SihirbazDesteklenmeyenYontem: StoryObj<typeof ConnectionWizard> = {
  render: () => (
    <ConnectionWizard
      capabilities={PROVIDER_CAPABILITIES_FULL}
      initialState={at("method", "openclaw", "gateway-token")}
    />
  ),
};

/** Permissions granted, backend absent: every method reads as unavailable. */
export const SihirbazSunucuYok: StoryObj<typeof ConnectionWizard> = {
  render: () => (
    <ConnectionWizard
      capabilities={PROVIDER_CAPABILITIES_PERMISSIONS_ONLY}
      initialState={at("method", "claude", "api-key")}
    />
  ),
};

export const SihirbazVeriBildirimi: StoryObj<typeof ConnectionWizard> = {
  render: () => (
    <ConnectionWizard
      capabilities={PROVIDER_CAPABILITIES_FULL}
      initialState={at("consent", "gemini", "oauth")}
    />
  ),
};

export const SihirbazYapilandirma: StoryObj<typeof ConnectionWizard> = {
  render: () => (
    <ConnectionWizard
      capabilities={PROVIDER_CAPABILITIES_FULL}
      initialState={at("configure", "openai", "host-session")}
    />
  ),
};

/** The secret-carrying path: the field itself is the submit control. */
export const SihirbazAnahtarlaDogrulama: StoryObj<typeof ConnectionWizard> = {
  render: () => (
    <ConnectionWizard
      capabilities={PROVIDER_CAPABILITIES_FULL}
      port={{ createConnectionRequest: async () => ({ requestId: "req-1" }) }}
      initialState={at("verify", "claude", "api-key")}
    />
  ),
};

/** Backend present, permission absent: the request control is inert and says so. */
export const SihirbazYetkisiz: StoryObj<typeof ConnectionWizard> = {
  render: () => (
    <ConnectionWizard
      capabilities={PROVIDER_CAPABILITIES_BACKEND_ONLY}
      initialState={at("verify", "claude", "host-session")}
    />
  ),
};

/** The only way a connection reaches the summary: handed in from outside. */
export const SihirbazSunucuSonucu: StoryObj<typeof ConnectionWizard> = {
  render: () => (
    <ConnectionWizard
      capabilities={PROVIDER_CAPABILITIES_FULL}
      initialState={at("verify", "claude", "host-session")}
      result={CONNECTION_CLAUDE_API}
      now={PROVIDER_NOW}
    />
  ),
};

/* ------------------------------------------------------------------ health */

export const SaglikBagli: StoryObj<typeof ConnectionHealthPanel> = {
  render: () => (
    <ConnectionHealthPanel
      connection={CONNECTION_CLAUDE_API}
      capabilities={PROVIDER_CAPABILITIES_FULL}
      audit={PROVIDER_AUDIT.filter((entry) => entry.connectionId === CONNECTION_CLAUDE_API.id)}
      now={PROVIDER_NOW}
    />
  ),
};

export const SaglikBozulmus: StoryObj<typeof ConnectionHealthPanel> = {
  render: () => (
    <ConnectionHealthPanel
      connection={CONNECTION_CLAUDE_SESSION}
      capabilities={PROVIDER_CAPABILITIES_FULL}
      now={PROVIDER_NOW}
    />
  ),
};

export const SaglikSuresiDoldu: StoryObj<typeof ConnectionHealthPanel> = {
  render: () => (
    <ConnectionHealthPanel
      connection={CONNECTION_OPENAI_EXPIRED}
      capabilities={PROVIDER_CAPABILITIES_FULL}
      now={PROVIDER_NOW}
    />
  ),
};

export const SaglikGeriCekildi: StoryObj<typeof ConnectionHealthPanel> = {
  render: () => (
    <ConnectionHealthPanel
      connection={CONNECTION_GEMINI_REVOKED}
      capabilities={PROVIDER_CAPABILITIES_FULL}
      now={PROVIDER_NOW}
    />
  ),
};

/** Stored status says connected; the expiry has passed. The derived truth wins. */
export const SaglikKayitEskimis: StoryObj<typeof ConnectionHealthPanel> = {
  render: () => (
    <ConnectionHealthPanel
      connection={CONNECTION_OPENCLAW_STALE}
      capabilities={PROVIDER_CAPABILITIES_FULL}
      now={PROVIDER_NOW}
    />
  ),
};

export const SaglikYetkisiz: StoryObj<typeof ConnectionHealthPanel> = {
  render: () => (
    <ConnectionHealthPanel
      connection={CONNECTION_CLAUDE_API}
      capabilities={PROVIDER_CAPABILITIES_BACKEND_ONLY}
      now={PROVIDER_NOW}
    />
  ),
};

/* --------------------------------------------------------------- inventory */

export const EnvanterDolu: StoryObj<typeof ConnectionInventory> = {
  render: () => (
    <ConnectionInventory
      connections={PROVIDER_CONNECTIONS}
      capabilities={PROVIDER_CAPABILITIES_FULL}
      now={PROVIDER_NOW}
    />
  ),
};

export const EnvanterBos: StoryObj<typeof ConnectionInventory> = {
  render: () => (
    <ConnectionInventory
      connections={[]}
      capabilities={PROVIDER_CAPABILITIES_NONE}
      now={PROVIDER_NOW}
    />
  ),
};

export const EnvanterHata: StoryObj<typeof ConnectionInventory> = {
  render: () => (
    <ConnectionInventory
      connections={[]}
      capabilities={PROVIDER_CAPABILITIES_FULL}
      status="error"
      errorMessage="Bağlantı listesi okunamadı."
      onRefresh={() => undefined}
      now={PROVIDER_NOW}
    />
  ),
};

/* ----------------------------------------------------------------- routing */

export const YonlendirmeDuzenlenebilir: StoryObj<typeof RoutingPolicyBuilder> = {
  render: () => (
    <RoutingPolicyBuilder
      policy={PROVIDER_POLICY}
      connections={PROVIDER_CONNECTIONS}
      capabilities={PROVIDER_CAPABILITIES_FULL}
      port={{ saveRoutingPolicy: () => undefined }}
      now={PROVIDER_NOW}
    />
  ),
};

export const YonlendirmeCakisma: StoryObj<typeof RoutingPolicyBuilder> = {
  render: () => (
    <RoutingPolicyBuilder
      policy={{
        degradation: "next-in-order",
        rules: [
          { connectionId: "c-claude-api", priority: 1, modelAllowlist: [], enabled: true },
          { connectionId: "c-openclaw-gateway", priority: 1, modelAllowlist: [], enabled: true },
        ],
      }}
      connections={PROVIDER_CONNECTIONS}
      capabilities={PROVIDER_CAPABILITIES_FULL}
      port={{ saveRoutingPolicy: () => undefined }}
      now={PROVIDER_NOW}
    />
  ),
};

export const YonlendirmeSunucusuz: StoryObj<typeof RoutingPolicyBuilder> = {
  render: () => (
    <RoutingPolicyBuilder
      policy={PROVIDER_POLICY}
      connections={PROVIDER_CONNECTIONS}
      capabilities={PROVIDER_CAPABILITIES_PERMISSIONS_ONLY}
      now={PROVIDER_NOW}
    />
  ),
};

/* ------------------------------------------------------------------- audit */

export const DenetimIzi: StoryObj<typeof ProviderAuditTimeline> = {
  render: () => (
    <ProviderAuditTimeline entries={PROVIDER_AUDIT} capabilities={PROVIDER_CAPABILITIES_FULL} />
  ),
};

export const DenetimIziKalicilikYok: StoryObj<typeof ProviderAuditTimeline> = {
  render: () => (
    <ProviderAuditTimeline
      entries={PROVIDER_AUDIT}
      capabilities={{ backend: [], permissions: PROVIDER_CAPABILITIES_FULL.permissions }}
    />
  ),
};

export const DenetimIziBos: StoryObj<typeof ProviderAuditTimeline> = {
  render: () => <ProviderAuditTimeline entries={[]} capabilities={PROVIDER_CAPABILITIES_FULL} />,
};

export const DenetimIziYetkisiz: StoryObj<typeof ProviderAuditTimeline> = {
  render: () => (
    <ProviderAuditTimeline entries={PROVIDER_AUDIT} capabilities={PROVIDER_CAPABILITIES_NONE} />
  ),
};
