/**
 * The routing and fallback policy editor.
 *
 * It builds a draft: an ordered list of connections, a model allowlist per
 * entry, and what to do when the preferred connection cannot serve. It does not
 * route anything. There is no router in this repository, so the whole surface
 * is inert unless a host declares `routingPolicy` *and* grants
 * `canEditRouting` - and when it is inert it says so at the top rather than
 * presenting a working-looking form that saves nowhere.
 *
 * `fail-closed` is the default and is listed first on purpose. A fallback that
 * silently answers from a different model is a different answer, and a product
 * that makes decisions about public money should refuse before it substitutes.
 *
 * Priority is an explicit integer the operator types, not an implicit list
 * order: two rules at priority 1 is a configuration error the operator can see
 * and fix, whereas a drag-and-drop list quietly encodes an order nobody chose.
 */

import { useMemo, useState } from "react";

import { cn } from "@/lib/cn";
import { Card, DefinitionList } from "../composites";
import { PartialDataNotice } from "../patterns";
import { Badge, Button, RadioGroup, Switch } from "../primitives";
import { actionOfferability } from "./capabilities";
import type {
  DegradationMode,
  ProviderConnection,
  ProviderConnectionCapabilities,
  ProviderConnectionPort,
  RoutingPolicy,
  RoutingRule,
} from "./types";
import {
  connectionStatusLabel,
  degradationExplanation,
  degradationLabel,
  effectiveStatus,
  isHealthy,
} from "./vocabulary";

export interface RoutingPolicyBuilderProps {
  readonly policy: RoutingPolicy;
  readonly connections: readonly ProviderConnection[];
  readonly capabilities: ProviderConnectionCapabilities;
  readonly port?: ProviderConnectionPort;
  readonly now?: Date;
  readonly className?: string;
}

const DEGRADATION_ORDER: readonly DegradationMode[] = [
  "fail-closed",
  "next-in-order",
  "read-only-cache",
];

/** States: editable · read-only (no permission) · blocked (no router) · conflicted. */
export function RoutingPolicyBuilder({
  policy,
  connections,
  capabilities,
  port,
  now = new Date(),
  className,
}: RoutingPolicyBuilderProps) {
  const [draft, setDraft] = useState<RoutingPolicy>(policy);
  // Three separate gates, kept separate so "you are not allowed to", "there is
  // no router" and "this screen did not take the action" stay distinguishable.
  // `editable` governs the controls; `savable` additionally needs somewhere to
  // save to, because a draft with no destination is not a saved policy.
  const gate = actionOfferability(
    capabilities,
    "canEditRouting",
    "routingPolicy",
    port?.saveRoutingPolicy,
  );
  const editable =
    capabilities.permissions.canEditRouting && capabilities.backend.includes("routingPolicy");
  const savable = editable && typeof port?.saveRoutingPolicy === "function";

  const conflicts = useMemo(() => {
    const seen = new Map<number, number>();
    for (const rule of draft.rules) seen.set(rule.priority, (seen.get(rule.priority) ?? 0) + 1);
    return [...seen.entries()].filter(([, count]) => count > 1).map(([priority]) => priority);
  }, [draft.rules]);

  const update = (connectionId: string, patch: Partial<RoutingRule>) => {
    setDraft((current) => ({
      ...current,
      rules: current.rules.map((rule) =>
        rule.connectionId === connectionId ? { ...rule, ...patch } : rule,
      ),
    }));
  };

  const ordered = [...draft.rules].sort((left, right) => left.priority - right.priority);

  return (
    <section className={cn("dt-provider-routing", className)} aria-label="Yönlendirme politikası">
      {editable ? null : (
        <p className="dt-provider-routing__blocked" role="note">
          Yönlendirme politikası bu sunucuda uygulanmıyor; burada üretilen taslak hiçbir çağrının
          gittiği yeri değiştirmez. {gate.reason ?? ""}
        </p>
      )}

      <Card title="Öncelik sırası" headingLevel={3}>
        {ordered.length === 0 ? (
          <p className="dt-muted">Politikada hiç kural yok.</p>
        ) : (
          <ul className="dt-provider-routing__rules">
            {ordered.map((rule) => {
              const connection = connections.find((entry) => entry.id === rule.connectionId);
              const priorityId = `priority-${rule.connectionId}`;
              const healthy = connection ? isHealthy(connection, now) : false;
              return (
                <li key={rule.connectionId} className="dt-provider-routing__rule">
                  <span className="dt-provider-routing__name">
                    {connection?.label ?? rule.connectionId}
                  </span>
                  {connection ? (
                    <Badge tone={healthy ? "candidate" : "warning"}>
                      {connectionStatusLabel(effectiveStatus(connection, now))}
                    </Badge>
                  ) : (
                    <Badge tone="warning">Bu bağlantı yüklenmedi</Badge>
                  )}
                  <label className="dt-provider-routing__priority" htmlFor={priorityId}>
                    Öncelik
                  </label>
                  <input
                    id={priorityId}
                    className="dt-input"
                    type="number"
                    min={1}
                    step={1}
                    value={rule.priority}
                    disabled={!editable}
                    onChange={(event) =>
                      update(rule.connectionId, { priority: Number(event.target.value) })
                    }
                  />
                  <Switch
                    label="Etkin"
                    checked={rule.enabled}
                    disabled={!editable}
                    onCheckedChange={(checked) => update(rule.connectionId, { enabled: checked })}
                  />
                  <span className="dt-provider-routing__models">
                    {rule.modelAllowlist.length > 0
                      ? rule.modelAllowlist.join(", ")
                      : "Sunucunun varsayılan model listesi"}
                  </span>
                  {!healthy && rule.enabled ? (
                    <span className="dt-provider-routing__warning">
                      Bu bağlantı şu anda sağlıklı değil; sırası geldiğinde geri çekilme davranışı
                      uygulanır.
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        {conflicts.length > 0 ? (
          <p className="dt-provider-routing__conflict" role="alert">
            Aynı önceliğe sahip birden fazla kural var ({conflicts.join(", ")}). Hangisinin önce
            deneneceği tanımsızdır; sıra elle düzeltilmelidir.
          </p>
        ) : null}
      </Card>

      <Card title="Geri çekilme davranışı" headingLevel={3} tone="sunken">
        <RadioGroup
          name="degradation"
          legend="Öncelikli bağlantı çalışmazsa"
          disabled={!editable}
          value={draft.degradation}
          onValueChange={(value) =>
            setDraft((current) => ({ ...current, degradation: value as DegradationMode }))
          }
          options={DEGRADATION_ORDER.map((mode) => ({
            value: mode,
            label: degradationLabel(mode),
            description: degradationExplanation(mode),
          }))}
        />

        <DefinitionList
          items={[
            { term: "Seçili davranış", description: degradationLabel(draft.degradation) },
            { term: "Anlamı", description: degradationExplanation(draft.degradation) },
          ]}
        />
      </Card>

      <div className="dt-provider-routing__actions">
        <Button
          disabled={!savable || conflicts.length > 0}
          onClick={() => port?.saveRoutingPolicy?.(draft)}
        >
          Politikayı kaydet
        </Button>
        <Button variant="ghost" disabled={!editable} onClick={() => setDraft(policy)}>
          Değişiklikleri geri al
        </Button>
      </div>

      <PartialDataNotice
        what="Bu ekran bir taslak üretir, bir davranış değiştirmez."
        because="Politikayı uygulayacak yönlendirici sunucuda yaşar. Kaydedilmemiş bir taslak hiçbir çağrının nereye gittiğini etkilemez, kaydedilmiş bir taslak da ancak sunucu uyguladığı kadar geçerlidir."
      />
    </section>
  );
}
