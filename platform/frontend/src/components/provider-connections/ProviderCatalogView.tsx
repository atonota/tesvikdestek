/**
 * The provider catalogue and the comparison matrix.
 *
 * Two views of the same declared facts. The cards are for choosing; the matrix
 * is for arguing about the choice with someone who was not in the room.
 *
 * Both are built from one rule: **an unavailable method is shown, not hidden.**
 * A catalogue that lists only what works looks tidy and teaches nothing - the
 * operator who wants "log in with our ChatGPT account" needs to see that the
 * row exists, that it is not available, and the sentence explaining why the
 * official path is the host-managed session instead. Hiding it just moves the
 * question to a support ticket.
 *
 * Nothing here is measured or probed. Every cell restates `catalog.ts`, and the
 * host capability gate is applied on top so a method the vendor supports but
 * this deployment cannot broker reads as unavailable *for a different reason* -
 * two different problems, two different sentences.
 */

import { cn } from "@/lib/cn";
import { Card } from "../composites";
import { Badge, Link } from "../primitives";
import { ALL_METHOD_IDS, PROVIDER_CATALOG } from "./catalog";
import { methodOfferability } from "./capabilities";
import { DataRoutingDisclosure } from "./DataRoutingDisclosure";
import type { ProviderConnectionCapabilities, ProviderDescriptor, ProviderId } from "./types";
import { methodExplanation, methodLabel } from "./vocabulary";

export interface ProviderCatalogViewProps {
  readonly capabilities: ProviderConnectionCapabilities;
  /** Defaults to the built-in catalogue; a host may inject its own. */
  readonly catalog?: readonly ProviderDescriptor[];
  readonly onChoose?: (providerId: ProviderId) => void;
  readonly className?: string;
}

/** States: choosable · read-only (no permission) · unconfirmed-documentation. */
export function ProviderCatalogView({
  capabilities,
  catalog = PROVIDER_CATALOG,
  onChoose,
  className,
}: ProviderCatalogViewProps) {
  return (
    <section className={cn("dt-provider-catalog", className)} aria-label="Sağlayıcı kataloğu">
      <p className="dt-muted">
        Hiçbir sağlayıcı varsayılan olarak bağlı değildir. Aşağıdaki her yöntem, sağlayıcının resmî
        olarak yayımladığı yola karşılık gelir; yayımlanmamış bir yol kullanılabilir gösterilmez.
      </p>

      <ul className="dt-provider-catalog__list">
        {catalog.map((provider) => (
          <li key={provider.id}>
            <Card
              title={provider.name}
              headingLevel={3}
              actions={<Badge tone="neutral">{provider.vendor}</Badge>}
              footer={
                <Link href={provider.docsUrl} external>
                  {provider.name} belgeleri
                </Link>
              }
            >
              <p>{provider.summary}</p>

              <ul className="dt-provider-catalog__methods">
                {provider.methods.map((method) => {
                  const gate = methodOfferability(capabilities, provider.id, method.method);
                  return (
                    <li key={method.method} className="dt-provider-catalog__method">
                      <Badge tone={gate.offerable ? "candidate" : "warning"}>
                        {gate.offerable ? "Kullanılabilir" : "Kullanılamaz"}
                      </Badge>
                      <span className="dt-provider-catalog__method-name">{method.label}</span>
                      <span className="dt-muted">{gate.reason ?? method.reason}</span>
                      <Link href={method.docsUrl} external>
                        Resmî belge
                      </Link>
                    </li>
                  );
                })}
              </ul>

              {onChoose ? (
                <button
                  type="button"
                  className="dt-btn dt-btn--secondary dt-btn--md"
                  onClick={() => onChoose(provider.id)}
                >
                  {provider.name} ile bağlantı kur
                </button>
              ) : null}

              <DataRoutingDisclosure provider={provider} />
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}

export interface ProviderComparisonProps {
  readonly capabilities: ProviderConnectionCapabilities;
  readonly catalog?: readonly ProviderDescriptor[];
  readonly className?: string;
}

/**
 * The comparison matrix.
 *
 * A real `<table>` with scoped headers rather than a grid of divs, because this
 * is exactly the content a screen-reader user needs to navigate by row and
 * column. Each cell carries its own text, never a bare tick or colour: "✓" on
 * its own is invisible to a screen reader and ambiguous to everyone else.
 */
export function ProviderComparison({
  capabilities,
  catalog = PROVIDER_CATALOG,
  className,
}: ProviderComparisonProps) {
  return (
    <div className={cn("dt-provider-compare", "dt-scroll-x", className)}>
      <table className="dt-table">
        <caption className="dt-table__caption">
          Sağlayıcı ve yöntem karşılaştırması. Her hücre sağlayıcının yayımladığı yolu ve bu
          kurulumun onu aracılayıp aracılayamadığını birlikte gösterir.
        </caption>
        <thead>
          <tr>
            <th scope="col">Yöntem</th>
            {catalog.map((provider) => (
              <th key={provider.id} scope="col">
                {provider.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ALL_METHOD_IDS.map((method) => (
            <tr key={method}>
              <th scope="row">
                <span>{methodLabel(method)}</span>
                <span className="dt-muted">{methodExplanation(method)}</span>
              </th>
              {catalog.map((provider) => {
                const declared = provider.methods.find((entry) => entry.method === method);
                const gate = methodOfferability(capabilities, provider.id, method);
                return (
                  <td key={provider.id}>
                    <Badge tone={gate.offerable ? "candidate" : "warning"}>
                      {gate.offerable ? "Kullanılabilir" : "Kullanılamaz"}
                    </Badge>
                    <span className="dt-muted">
                      {gate.reason ?? declared?.reason ?? "Bu sağlayıcı için tanımlı değil."}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
