/**
 * `/ayarlar/yapay-zeka` - the AI provider connection centre.
 *
 * The requirement was for operators to be able to connect Gemini,
 * OpenAI/ChatGPT, Claude and OpenClaw accounts. The subsystem that does it was
 * built, tested and unreachable; this route is where it becomes part of the
 * product.
 *
 * **What this route promises, exactly.** Not connection - *disclosure*. There
 * is no credential store, no OAuth broker, no host-session bridge, no health
 * prober and no metering in this repository, so nothing here can establish
 * anything, and the design is arranged so that nothing here can appear to:
 *
 *   - `NO_BACKEND_CAPABILITIES` is injected verbatim. Every backend capability
 *     is absent and every permission is false, which is the truth about a
 *     deployment with neither a broker nor a role model. Under that gate every
 *     published method reads "Kullanılamaz" with the missing server capability
 *     named, and the wizard's method step disables every choice.
 *   - No `port` is passed to the wizard or the inventory. The port is the only
 *     way a request or a mutation could leave this screen; without one the
 *     wizard's create control is disabled with its reason, and no secret field
 *     is ever reachable, because the step that renders one cannot be arrived
 *     at while no method is selectable.
 *   - The connection list is genuinely empty. There is no seeded row, no
 *     "example" connection and no optimistic entry - `ConnectionWizard` has no
 *     code path that renders a connection as established, and this route
 *     supplies no `result` that could stand in for one.
 *
 * **What an operator does get**, and it is not nothing: the catalogue of what
 * each vendor actually publishes, method by method, with the official
 * documentation link for each; the data-routing disclosure for what each
 * provider would receive; and the exact list of server capabilities that would
 * have to exist first. That is the difference between a blocked capability that
 * teaches and one that hides.
 *
 * The side-by-side comparison matrix is the one part of the subsystem not on
 * this screen, and the reason is recorded at the point where it would mount.
 *
 * **Reached by its own path, never through the shared component barrel.** Every
 * route imports `@/components`, so a re-export from there would put this whole
 * subsystem - and its stylesheet - in the chunk every signed-in visitor
 * downloads on the way to the dashboard. Importing
 * `@/components/provider-connections` here instead keeps both its JavaScript
 * and its CSS in this route's lazy chunk; `build-contract.test.ts` measures
 * that against the built artifact.
 */

import {
  ConnectionInventory,
  ConnectionWizard,
  NO_BACKEND_CAPABILITIES,
  PROVIDER_CATALOG,
  ProviderCatalogView,
  blockedProviderCapabilities,
} from "@/components/provider-connections";
import { Card } from "@/components";

import "@/design/provider-connections.css";

import { SettingsSectionNav, Shell } from "./app";

/**
 * The blocked half of the provider ledger, on the screen it is about.
 *
 * `/yetenekler` carries the product-wide picture. This is the subsystem's own,
 * rendered where somebody is trying to connect an account - because "why can I
 * not choose this method" is asked here, and an answer two navigations away is
 * an answer nobody reads.
 */
function BlockedCapabilityLedger() {
  const blocked = blockedProviderCapabilities();
  return (
    <section aria-label="Sunucu gerektiren yetenekler">
      <Card title="Bağlantı için sunucuda olması gerekenler" headingLevel={2}>
        <p className="dt-muted">
          Aşağıdaki {blocked.length} yetenek arayüz tarafında hazırdır ve sunucu tarafında yoktur.
          Bu yüzden hiçbir sağlayıcı bağlanamaz ve hiçbir gizli değer bu ekrana girilemez.
        </p>
        <ul className="dt-list">
          {blocked.map((capability) => (
            <li key={capability.id}>
              <strong>{capability.title}</strong>
              <p className="dt-muted">{capability.reason}</p>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}

export function ProviderConnectionsRoute() {
  return (
    <Shell title="Yapay zekâ sağlayıcıları">
      <div className="dt-stack">
        <SettingsSectionNav />
        <h1>Yapay zekâ sağlayıcıları</h1>
        <p className="dt-lede">
          Gemini, OpenAI/ChatGPT, Claude ve OpenClaw için her sağlayıcının resmî olarak yayımladığı
          bağlantı yolları burada listelenir. Bugün hiçbiri kurulamaz: kimlik bilgisi deposu, OAuth
          aracısı ve sağlık yoklaması sunucuda yoktur. Bu ekran hiçbir anahtar istemez, hiçbir
          isteği dışarı göndermez ve hiçbir bağlantıyı kurulmuş göstermez.
        </p>

        <ProviderCatalogView capabilities={NO_BACKEND_CAPABILITIES} catalog={PROVIDER_CATALOG} />

        {/*
          * `ProviderComparison` is deliberately not mounted here yet.
          *
          * It was, and the browser accessibility sweep refused it: its scroll
          * container `.dt-provider-compare` is `overflow-x: auto` with no
          * focusable content anywhere inside, so axe reports
          * `scrollable-region-focusable` at *serious* on both viewports - a
          * table a pointer user can scroll and a keyboard user cannot. The
          * accepted `DataGrid` avoids this by accident of having sortable
          * header buttons; this table has none.
          *
          * The fix belongs to the component - a `tabIndex={0}` and an
          * accessible name on that wrapper - not to this route, and it is
          * recorded rather than worked around. The catalogue above already
          * discloses every published method, its availability and its reason
          * for all four providers, so nothing an operator needs is missing
          * here; what is missing is the side-by-side reading of it.
          */}

        {/*
          * No `port`, deliberately.
          *
          * The port is the only channel through which this wizard could create
          * a request, hand over a secret or learn a result. Passing a stub here
          * to "let the operator try it" would turn a disabled control that
          * explains itself into an enabled control that accepts an API key and
          * drops it.
          */}
        <ConnectionWizard capabilities={NO_BACKEND_CAPABILITIES} />

        <ConnectionInventory connections={[]} capabilities={NO_BACKEND_CAPABILITIES} />

        <BlockedCapabilityLedger />
      </div>
    </Shell>
  );
}
