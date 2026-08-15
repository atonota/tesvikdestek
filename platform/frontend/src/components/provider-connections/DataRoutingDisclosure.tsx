/**
 * What leaves the deployment, said before anyone types a credential.
 *
 * This panel is the reason the wizard has a step of its own between "which
 * method" and "paste your key". Connecting a provider is a data-routing
 * decision, and a data-routing decision made after the key is already in the
 * field is a decision made under sunk cost.
 *
 * Everything here is a restatement of what the catalogue declares. Nothing is
 * measured: this client cannot see which region a request lands in, cannot
 * observe a retention window, and cannot verify a training policy - so it says
 * who can, and links to them. `trainsOnData: null` renders as "the provider's
 * policy states this; this client does not verify it", which is the honest
 * sentence and also the least comfortable one.
 */

import { cn } from "@/lib/cn";
import { DefinitionList } from "../composites";
import { Badge, Link } from "../primitives";
import type { ConnectionMethodId, ProviderDescriptor } from "./types";
import { dataCategoryLabel, methodExplanation, methodLabel, trainingLabel } from "./vocabulary";

export interface DataRoutingDisclosureProps {
  readonly provider: ProviderDescriptor;
  /** When given, the method's own mechanism is described alongside. */
  readonly method?: ConnectionMethodId;
  readonly className?: string;
}

/** States: with-method · provider-only · unconfirmed-documentation. */
export function DataRoutingDisclosure({ provider, method, className }: DataRoutingDisclosureProps) {
  const { dataRouting } = provider;

  return (
    <section
      className={cn("dt-provider-disclosure", className)}
      aria-label={`${provider.name} veri yönlendirme bildirimi`}
    >
      <DefinitionList
        items={[
          {
            term: "Giden veri",
            description:
              dataRouting.categories.length === 0
                ? "Bildirilmedi"
                : dataRouting.categories.map(dataCategoryLabel).join(", "),
          },
          { term: "Veri yerleşimi", description: dataRouting.residency },
          { term: "Saklama", description: dataRouting.retention },
          { term: "Eğitim", description: trainingLabel(dataRouting.trainsOnData) },
          {
            term: "Politika",
            description: (
              <Link href={dataRouting.policyUrl} external>
                {provider.vendor} veri politikası
              </Link>
            ),
          },
        ]}
      />

      {method ? (
        <p className="dt-provider-disclosure__method">
          <strong>{methodLabel(method)}:</strong> {methodExplanation(method)}
        </p>
      ) : null}

      {provider.docsConfirmed ? null : (
        <p className="dt-provider-disclosure__caveat">
          <Badge tone="warning">Bağlantı adresi doğrulanmadı</Badge> Bu sağlayıcının belge adresi
          birinci taraf bir kaynağa karşı doğrulanmadı. Kuruluma başlamadan önce operatörün adresi
          teyit etmesi gerekir.
        </p>
      )}
    </section>
  );
}
