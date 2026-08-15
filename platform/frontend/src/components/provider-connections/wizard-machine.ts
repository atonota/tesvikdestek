/**
 * The connection wizard as a pure reducer.
 *
 * The whole point of putting this in a plain function is that the invariant
 * everything else depends on becomes checkable in one place: **no event this
 * machine accepts can produce a connected connection.** `request.created` moves
 * the wizard to "the request exists, the server has not answered". Only
 * `backend.result` carries a `ProviderConnection`, and the wizard cannot
 * manufacture one of those - it can only be handed one.
 *
 * A second rule lives here for the same reason: a method the catalogue marks
 * unavailable is refused at the reducer, not only greyed out in the UI. A
 * component can be wrong; a reducer that ignores the event cannot be talked
 * into it by a stray click, a restored URL or a future keyboard shortcut.
 *
 * Step movement follows one rule, and it is worth stating because it is the
 * part that looks arbitrary otherwise: **a choice implies its own
 * confirmation, an acknowledgement and a free-text form do not.** Picking a
 * provider or a method is unambiguous, so those events advance. Ticking a
 * disclosure box or typing a label is not a statement that you are finished, so
 * those set data and wait for an explicit `next`.
 */

import { isMethodAvailable } from "./catalog";
import type { WizardEvent, WizardState, WizardStep } from "./types";

export const WIZARD_STEPS: readonly WizardStep[] = [
  "provider",
  "method",
  "consent",
  "configure",
  "verify",
  "review",
];

export function initialWizardState(): WizardState {
  return {
    step: "provider",
    providerId: null,
    method: null,
    consentAcknowledged: false,
    label: "",
    modelAllowlist: [],
    configurationComplete: false,
    request: null,
    result: null,
    error: null,
  };
}

/**
 * Whether the gate on the *current* step is open.
 *
 * Note the `verify` case: the gate is a backend result, not a created request.
 * Pressing connect and being told "request accepted" is not arrival, and the
 * wizard refuses to treat it as arrival.
 */
export function canAdvance(state: WizardState): boolean {
  switch (state.step) {
    case "provider":
      return state.providerId !== null;
    case "method":
      return state.method !== null;
    case "consent":
      return state.consentAcknowledged;
    case "configure":
      return state.configurationComplete && state.label.trim().length > 0;
    case "verify":
      return state.result !== null;
    case "review":
      return false;
  }
}

function stepAfter(step: WizardStep): WizardStep {
  const index = WIZARD_STEPS.indexOf(step);
  return WIZARD_STEPS[Math.min(index + 1, WIZARD_STEPS.length - 1)] ?? step;
}

function stepBefore(step: WizardStep): WizardStep {
  const index = WIZARD_STEPS.indexOf(step);
  return WIZARD_STEPS[Math.max(index - 1, 0)] ?? step;
}

export function wizardReducer(state: WizardState, event: WizardEvent): WizardState {
  switch (event.type) {
    case "provider.select": {
      if (state.providerId === event.providerId) return { ...state, step: "method" };
      // Changing the provider invalidates every later answer. Keeping the old
      // method would leave a method selected that the new provider may not even
      // support, which is exactly the state this subsystem must never be in.
      return {
        ...initialWizardState(),
        providerId: event.providerId,
        step: "method",
      };
    }

    case "method.select": {
      // Refused at the reducer, not merely disabled in the view.
      if (state.providerId === null) return state;
      if (!isMethodAvailable(state.providerId, event.method)) return state;
      return { ...state, method: event.method, step: "consent" };
    }

    case "consent.acknowledge": {
      // Withdrawing sends the operator back to the disclosure rather than
      // leaving them standing on a later step with the gate shut behind them.
      if (!event.acknowledged) {
        return { ...state, consentAcknowledged: false, step: "consent" };
      }
      return { ...state, consentAcknowledged: true };
    }

    case "configure.set":
      return { ...state, label: event.label, configurationComplete: event.complete };

    case "configure.allowlist":
      return { ...state, modelAllowlist: [...event.models] };

    case "request.start": {
      if (state.providerId === null || state.method === null) return state;
      return {
        ...state,
        error: null,
        request: {
          state: "creating",
          providerId: state.providerId,
          method: state.method,
          requestId: null,
          error: null,
        },
      };
    }

    case "request.created": {
      if (state.request === null) return state;
      // The step does not move. "Requested" is not "connected", and the only
      // honest thing to render here is that the server has not answered yet.
      return {
        ...state,
        step: "verify",
        request: { ...state.request, state: "created", requestId: event.requestId, error: null },
      };
    }

    case "request.failed": {
      if (state.request === null) return state;
      return {
        ...state,
        error: event.message,
        request: { ...state.request, state: "create-failed", error: event.message },
      };
    }

    case "backend.result":
      // The one door a connection comes through.
      return { ...state, step: "review", result: event.connection, error: null };

    case "next":
      return canAdvance(state) ? { ...state, step: stepAfter(state.step) } : state;

    case "back": {
      // Going back from the summary would offer to re-run a request that has
      // already produced a connection, so the summary is terminal until reset.
      if (state.step === "review") return state;
      return { ...state, step: stepBefore(state.step) };
    }

    case "reset":
      return initialWizardState();
  }
}

/** Steps the operator has genuinely completed, for the stepper's indicator. */
export function completedStepCount(state: WizardState): number {
  return WIZARD_STEPS.indexOf(state.step);
}
