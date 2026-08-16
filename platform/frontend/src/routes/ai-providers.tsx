/**
 * `/ayarlar/yapay-zeka` — the AI provider connection center, clean-room.
 *
 * Moved out of the old `ProviderConnectionsRoute` so this address reaches
 * only the clean `CognitiveProviderCenter` master, never the rejected visual
 * component graph. Presentational data-plumbing only: it hands the real
 * catalogue and the real (empty) backend capability set to
 * `CognitiveProviderCenter` — the same master Storybook renders.
 *
 * There is still no provider backend in this repository: no credential
 * store, no OAuth broker, no health prober. `NO_BACKEND_CAPABILITIES` is
 * injected verbatim, so every method the catalogue lists renders as
 * unavailable with its reason, and no connection is ever shown as
 * established.
 */

import { NO_BACKEND_CAPABILITIES, PROVIDER_CATALOG } from "@/components/provider-connections";
import { CognitiveProviderCenter } from "@/components/cognitive-provider-center";

export function AiProvidersRoute() {
  return (
    <CognitiveProviderCenter
      state="success"
      capabilities={NO_BACKEND_CAPABILITIES}
      catalog={PROVIDER_CATALOG}
    />
  );
}
