/**
 * The cognitive provider center — clean-room `/ayarlar/yapay-zeka` master
 * surface.
 *
 * Presentational only, same discipline as `CognitiveCockpitDashboard`: the
 * route owns every read and passes down one honest state. There is still no
 * provider backend in this repository — no credential store, no OAuth broker,
 * no health prober — so this component never renders a connected provider, a
 * live secret field or a measured usage figure. It discloses the catalogue
 * of what each vendor actually publishes and the blocked half of the ledger,
 * on the screen it is about.
 */

import { Badge, EmptyState, ErrorState, Link, OfflineBanner, Skeleton, SkeletonList } from "@/foundation";
import { resolveContent, useContent } from "@/content";
import {
  blockedProviderCapabilities,
  methodOfferability,
  type ProviderConnectionCapabilities,
  type ProviderDescriptor,
} from "@/components/provider-connections";

import "./cognitive-provider-center.css";

export type ProviderCenterReadState = "loading" | "empty" | "error" | "permission" | "offline" | "success";

export interface CognitiveProviderCenterProps {
  readonly state: ProviderCenterReadState;
  readonly capabilities: ProviderConnectionCapabilities;
  readonly catalog: readonly ProviderDescriptor[];
  readonly errorMessage?: string | null;
  readonly onRetry?: () => void;
  readonly updatedAt?: number | null;
}

const STATE_CONTENT_IDS: Record<ProviderCenterReadState, { title: string; reason: string }> = {
  loading: { title: "ai_provider_center.state.loading.title", reason: "ai_provider_center.state.loading.reason" },
  empty: { title: "ai_provider_center.state.empty.title", reason: "ai_provider_center.state.empty.reason" },
  error: { title: "ai_provider_center.state.error.title", reason: "ai_provider_center.state.error.reason" },
  permission: {
    title: "ai_provider_center.state.permission.title",
    reason: "ai_provider_center.state.permission.reason",
  },
  offline: { title: "ai_provider_center.state.offline.title", reason: "ai_provider_center.state.offline.reason" },
  success: { title: "ai_provider_center.state.success.title", reason: "ai_provider_center.state.success.reason" },
};

function stateCopyFor(state: ProviderCenterReadState): { title: string; reason: string } {
  const ids = STATE_CONTENT_IDS[state];
  return { title: resolveContent(ids.title), reason: resolveContent(ids.reason) };
}

function ProviderCenterSkeleton() {
  const label = useContent("ai_provider_center.state.loading.title");
  return (
    <Skeleton label={label} className="cognitive-provider-center__skeleton" role="status" aria-busy="true">
      <SkeletonList items={4} />
    </Skeleton>
  );
}

function CatalogView({
  catalog,
  capabilities,
}: {
  readonly catalog: readonly ProviderDescriptor[];
  readonly capabilities: ProviderConnectionCapabilities;
}) {
  const heading = useContent("ai_provider_center.catalog.heading");
  const availableLabel = useContent("ai_provider_center.catalog.method.available");
  const unavailableLabel = useContent("ai_provider_center.catalog.method.unavailable");
  const docsLabel = useContent("ai_provider_center.catalog.docs_link");
  const docsExternalLabel = useContent("ai_provider_center.catalog.docs_link_external_note");

  return (
    <section className="cognitive-provider-center__catalog" aria-labelledby="cognitive-provider-center-catalog-heading">
      <h2 id="cognitive-provider-center-catalog-heading" className="cognitive-provider-center__section-title">
        {heading}
      </h2>
      <ul className="cognitive-provider-center__provider-list">
        {catalog.map((provider) => (
          <li key={provider.id} className="cognitive-provider-center__provider">
            <div className="cognitive-provider-center__provider-head">
              <strong>{provider.name}</strong>
              <Link to={provider.docsUrl} external externalIndicatorLabel={docsExternalLabel}>
                {docsLabel}
              </Link>
            </div>
            <p className="cognitive-provider-center__provider-summary">{provider.summary}</p>
            <ul className="cognitive-provider-center__method-list">
              {provider.methods.map((method) => {
                const offerability = methodOfferability(capabilities, provider.id, method.method);
                return (
                  <li key={method.method} className="cognitive-provider-center__method">
                    <span>{method.label}</span>
                    <Badge tone={offerability.offerable ? "accent" : "neutral"}>
                      {offerability.offerable ? availableLabel : unavailableLabel}
                    </Badge>
                    <span className="cognitive-provider-center__method-reason">
                      {offerability.reason ?? method.reason}
                    </span>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}

function BlockedCapabilityLedger() {
  const heading = useContent("ai_provider_center.blocked.heading");
  const intro = useContent("ai_provider_center.blocked.intro");
  const blocked = blockedProviderCapabilities();

  return (
    <section className="cognitive-provider-center__blocked" aria-labelledby="cognitive-provider-center-blocked-heading">
      <h2 id="cognitive-provider-center-blocked-heading" className="cognitive-provider-center__section-title">
        {heading}
      </h2>
      <p className="cognitive-provider-center__blocked-intro">{intro}</p>
      <ul className="cognitive-provider-center__blocked-list">
        {blocked.map((capability) => (
          <li key={capability.id} className="cognitive-provider-center__blocked-item">
            <strong>{capability.title}</strong>
            <span>{capability.reason}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CognitiveProviderCenter({
  state,
  capabilities,
  catalog,
  errorMessage = null,
  onRetry,
  updatedAt = null,
}: CognitiveProviderCenterProps) {
  const copy = stateCopyFor(state);
  const pageTitle = useContent("ai_provider_center.page.title");
  const lede = useContent("ai_provider_center.lede");
  const retryLabel = useContent("ai_provider_center.action.retry");
  const offlineLabel = useContent("ai_provider_center.offline.label");
  const offlineMessage = useContent("ai_provider_center.offline.message", {
    values: { when: updatedAt ? new Date(updatedAt).toLocaleString("tr-TR") : "" },
  });

  return (
    <div className="cognitive-provider-center" data-state={state}>
      <div className="cognitive-provider-center__heading">
        <h1 className="cognitive-provider-center__title">{pageTitle}</h1>
        <p className="cognitive-provider-center__lede">{lede}</p>
      </div>

      {state === "offline" ? <OfflineBanner label={offlineLabel} message={offlineMessage} /> : null}

      {state === "loading" ? <ProviderCenterSkeleton /> : null}
      {state === "permission" ? (
        <div className="cognitive-provider-center__state fd-state fd-state--denied" role="alert">
          <h3 className="fd-state__title">{copy.title}</h3>
          <p className="fd-state__reason">{copy.reason}</p>
        </div>
      ) : null}
      {state === "error" ? (
        <ErrorState
          title={copy.title}
          message={errorMessage ?? copy.reason}
          {...(onRetry ? { onRetry, retryLabel } : {})}
        />
      ) : null}
      {state === "empty" ? <EmptyState title={copy.title} reason={copy.reason} /> : null}

      {state === "success" ? (
        <>
          <CatalogView catalog={catalog} capabilities={capabilities} />
          <BlockedCapabilityLedger />
        </>
      ) : null}
    </div>
  );
}
