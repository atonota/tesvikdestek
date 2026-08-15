/**
 * The connection wizard.
 *
 * Six steps: provider, method, data disclosure, configuration, verification,
 * summary. Everything that could be got wrong here is delegated to the reducer
 * in `wizard-machine.ts`, so this file is a rendering of a state rather than a
 * second place where the rules live.
 *
 * The one thing worth reading carefully is the verification step. Pressing the
 * button creates a *request*: the wizard reports that a request exists and that
 * the server has not answered. It has no code path that renders a connection as
 * established - the summary step is only reachable through `backend.result`,
 * which this component never dispatches on its own. A caller that receives an
 * established connection pushes it in through `result`.
 *
 * For a method that carries a secret, the secret field *is* the submit control.
 * There is no staging step where a typed key waits around in component state
 * for a later click: the value goes from the field to the caller's callback in
 * one act, and the field clears itself in the same act.
 */

import { useEffect, useReducer, useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import { Card, DefinitionList, Stepper } from "../composites";
import { PartialDataNotice } from "../patterns";
import { Badge, Button, Checkbox, FieldError, Input, Label, Link } from "../primitives";
import { PROVIDER_CATALOG, providerById } from "./catalog";
import { methodOfferability } from "./capabilities";
import { DataRoutingDisclosure } from "./DataRoutingDisclosure";
import { SecretField } from "./SecretField";
import type {
  EphemeralSecret,
  ProviderConnection,
  ProviderConnectionCapabilities,
  ProviderConnectionPort,
  WizardState,
} from "./types";
import {
  connectionStatusExplanation,
  connectionStatusLabel,
  connectionStatusTone,
  effectiveStatus,
  methodExplanation,
  methodLabel,
  methodNeedsSecret,
  wizardStepLabel,
} from "./vocabulary";
import { WIZARD_STEPS, canAdvance, initialWizardState, wizardReducer } from "./wizard-machine";

export interface ConnectionWizardProps {
  readonly capabilities: ProviderConnectionCapabilities;
  readonly port?: ProviderConnectionPort;
  /** Seeds the machine. Used by stories and tests to land on a given step. */
  readonly initialState?: WizardState;
  /**
   * A connection the backend established. The only way a connection enters
   * this component; there is no local path that produces one.
   */
  readonly result?: ProviderConnection;
  readonly onStateChange?: (state: WizardState) => void;
  readonly now?: Date;
  readonly className?: string;
}

export function ConnectionWizard({
  capabilities,
  port,
  initialState,
  result,
  onStateChange,
  now = new Date(),
  className,
}: ConnectionWizardProps) {
  const [state, dispatch] = useReducer(wizardReducer, initialState ?? initialWizardState());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    onStateChange?.(state);
  }, [state, onStateChange]);

  useEffect(() => {
    if (result) dispatch({ type: "backend.result", connection: result });
  }, [result]);

  const provider = state.providerId ? providerById(state.providerId) : undefined;
  const canCreate =
    capabilities.permissions.canConnect && typeof port?.createConnectionRequest === "function";

  const createRequest = async (secret?: EphemeralSecret) => {
    if (!state.providerId || !state.method || !port?.createConnectionRequest) return;
    dispatch({ type: "request.start" });
    setBusy(true);
    try {
      const acknowledgement = await port.createConnectionRequest({
        providerId: state.providerId,
        method: state.method,
        label: state.label,
        modelAllowlist: state.modelAllowlist,
        ...(secret ? { secret } : {}),
      });
      dispatch({ type: "request.created", requestId: acknowledgement.requestId });
    } catch (error) {
      dispatch({
        type: "request.failed",
        message: error instanceof Error ? error.message : "İstek oluşturulamadı.",
      });
    } finally {
      setBusy(false);
    }
  };

  /* ------------------------------------------------------------ step bodies */

  const providerStep = (
    <fieldset className="dt-provider-wizard__choices">
      <legend>Sağlayıcı seçin</legend>
      {PROVIDER_CATALOG.map((entry) => (
        <div key={entry.id} className="dt-choice">
          <input
            id={`provider-${entry.id}`}
            className="dt-choice__control"
            type="radio"
            name="provider"
            checked={state.providerId === entry.id}
            onChange={() => dispatch({ type: "provider.select", providerId: entry.id })}
          />
          <span className="dt-choice__text">
            <label htmlFor={`provider-${entry.id}`}>{entry.name}</label>
            <span className="dt-choice__desc">{entry.summary}</span>
          </span>
        </div>
      ))}
    </fieldset>
  );

  const methodStep = provider ? (
    <fieldset className="dt-provider-wizard__choices">
      <legend>{provider.name} için bağlantı yöntemi</legend>
      {provider.methods.map((entry) => {
        const offerability = methodOfferability(capabilities, provider.id, entry.method);
        const id = `method-${entry.method}`;
        return (
          <div key={entry.method} className="dt-choice">
            <input
              id={id}
              className="dt-choice__control"
              type="radio"
              name="method"
              disabled={!offerability.offerable}
              checked={state.method === entry.method}
              onChange={() => dispatch({ type: "method.select", method: entry.method })}
            />
            <span className="dt-choice__text">
              <label htmlFor={id}>{entry.label}</label>
              <span className="dt-choice__desc">{methodExplanation(entry.method)}</span>
              {offerability.reason ? (
                <span className="dt-provider-wizard__blocked">{offerability.reason}</span>
              ) : null}
              <Link href={entry.docsUrl} external>
                Resmî belge
              </Link>
            </span>
          </div>
        );
      })}
    </fieldset>
  ) : null;

  const consentStep =
    provider && state.method ? (
      <>
        <DataRoutingDisclosure provider={provider} method={state.method} />
        <Checkbox
          label="Bu bildirimi okudum ve bu yönlendirmeyi kabul ediyorum."
          description="Kabul kaydı yalnızca çağıran tarafından saklanabilir; bu paket hiçbir şey yazmaz."
          checked={state.consentAcknowledged}
          onChange={(event) =>
            dispatch({ type: "consent.acknowledge", acknowledged: event.target.checked })
          }
        />
      </>
    ) : null;

  const configureStep = (
    <div className="dt-provider-wizard__form">
      <Label htmlFor="connection-label" required>
        Bağlantı adı
      </Label>
      <Input
        id="connection-label"
        value={state.label}
        placeholder="Örn. Üretim anahtarı"
        onChange={(event) =>
          dispatch({
            type: "configure.set",
            label: event.target.value,
            complete: event.target.value.trim().length > 0,
          })
        }
      />
      <Label htmlFor="model-allowlist" hint="Boş bırakılırsa sunucunun varsayılanı geçerlidir">
        İzin verilen modeller (virgülle)
      </Label>
      <Input
        id="model-allowlist"
        value={state.modelAllowlist.join(", ")}
        onChange={(event) =>
          dispatch({
            type: "configure.allowlist",
            models: event.target.value
              .split(",")
              .map((model) => model.trim())
              .filter((model) => model.length > 0),
          })
        }
      />
      <p className="dt-muted">
        Model listesi bir istek değil bir sınırdır ve yalnızca sunucu uygulayabilir. Burada yazılan
        liste sunucuya iletilir; istemci hiçbir çağrıyı süzemez.
      </p>
    </div>
  );

  const verifyStep = (
    <div className="dt-provider-wizard__verify">
      <DefinitionList
        columns={2}
        items={[
          { term: "Sağlayıcı", description: provider?.name ?? "—" },
          { term: "Yöntem", description: state.method ? methodLabel(state.method) : "—" },
          { term: "Ad", description: state.label || "—" },
          {
            term: "Model listesi",
            description:
              state.modelAllowlist.length > 0
                ? state.modelAllowlist.join(", ")
                : "Sunucunun varsayılanı",
          },
        ]}
      />

      {state.method && methodNeedsSecret(state.method) ? (
        <SecretField
          fieldId={state.method}
          label={methodLabel(state.method)}
          submitLabel="Bağlantı isteği oluştur"
          disabled={!canCreate || busy}
          {...(canCreate ? {} : { disabledReason: connectBlockedReason(capabilities) })}
          onSubmit={(secret) => void createRequest(secret)}
        />
      ) : (
        <>
          <Button disabled={!canCreate || busy} loading={busy} onClick={() => void createRequest()}>
            Bağlantı isteği oluştur
          </Button>
          {canCreate ? null : (
            <p className="dt-provider-wizard__blocked">{connectBlockedReason(capabilities)}</p>
          )}
        </>
      )}

      <p className="dt-provider-wizard__request" role="status">
        {requestNarration(state)}
      </p>

      <FieldError id="wizard-error">{state.error}</FieldError>

      <PartialDataNotice
        what="Bu adım bir istek oluşturur, bağlantı kurmaz."
        because="Bağlantının kurulup kurulmadığını yalnızca sunucu bilir ve yalnızca sunucu bildirir. Bu ekran kendi başına hiçbir bağlantıyı kurulmuş sayamaz."
      />
    </div>
  );

  const reviewStep = state.result ? (
    <div className="dt-provider-wizard__review">
      <Badge
        tone={connectionStatusTone(effectiveStatus(state.result, now))}
        srDescription={connectionStatusExplanation(effectiveStatus(state.result, now))}
      >
        {connectionStatusLabel(effectiveStatus(state.result, now))}
      </Badge>
      <DefinitionList
        items={[
          { term: "Ad", description: state.result.label },
          { term: "Yöntem", description: methodLabel(state.result.method) },
          { term: "Sunucunun gerekçesi", description: state.result.statusReason ?? "—" },
        ]}
      />
      <Button variant="secondary" onClick={() => dispatch({ type: "reset" })}>
        Yeni bağlantı
      </Button>
    </div>
  ) : (
    <p className="dt-muted">Sunucudan bir sonuç gelmedi.</p>
  );

  const bodies: Record<WizardState["step"], ReactNode> = {
    provider: providerStep,
    method: methodStep,
    consent: consentStep,
    configure: configureStep,
    verify: verifyStep,
    review: reviewStep,
  };

  return (
    <section
      className={cn("dt-provider-wizard", className)}
      aria-label="Sağlayıcı bağlantı sihirbazı"
    >
      <Stepper
        label="Bağlantı adımları"
        currentIndex={WIZARD_STEPS.indexOf(state.step)}
        steps={WIZARD_STEPS.map((step) => ({ id: step, label: wizardStepLabel(step) }))}
      />

      <Card title={wizardStepLabel(state.step)} headingLevel={3}>
        {bodies[state.step]}
      </Card>

      <div className="dt-provider-wizard__nav">
        <Button
          variant="ghost"
          disabled={state.step === "provider" || state.step === "review"}
          onClick={() => dispatch({ type: "back" })}
        >
          Geri
        </Button>
        <Button disabled={!canAdvance(state)} onClick={() => dispatch({ type: "next" })}>
          Devam
        </Button>
      </div>
    </section>
  );
}

/** Which half is missing, said plainly rather than as a silent disabled state. */
function connectBlockedReason(capabilities: ProviderConnectionCapabilities): string {
  if (!capabilities.permissions.canConnect) return "Bağlantı kurma yetkiniz tanımlı değil.";
  return "Bağlantı isteğini devralacak bir uç yok; bu ekran istek oluşturamaz.";
}

/**
 * What the request line says.
 *
 * "Created" is narrated as *waiting*, never as arrival. This sentence is the
 * one a person reads to decide whether the thing worked, so it is the sentence
 * most worth being pedantic about.
 */
function requestNarration(state: WizardState): string {
  if (state.request === null) return "Henüz bir istek oluşturulmadı.";
  switch (state.request.state) {
    case "idle":
      return "Henüz bir istek oluşturulmadı.";
    case "creating":
      return "İstek oluşturuluyor…";
    case "created":
      return `İstek oluşturuldu (${state.request.requestId ?? "kimliksiz"}); sunucu yanıtı bekleniyor.`;
    case "create-failed":
      return `İstek oluşturulamadı: ${state.request.error ?? "sebep bildirilmedi"}.`;
  }
}
