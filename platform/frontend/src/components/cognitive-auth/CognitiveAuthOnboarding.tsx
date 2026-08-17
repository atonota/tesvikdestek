/**
 * The cognitive auth onboarding — clean-room `/onboarding` master surface.
 *
 * Presentational: `OnboardingRoute` owns the current step and every
 * navigation callback. Three steps, unchanged in meaning from the old
 * `AuthShell`-hosted flow — what this replaces is only the frame around them.
 */

import { useId } from "react";

import { useContent } from "@/content";
import { DISCLAIMER } from "@/domain/outcomes";
import { cn } from "@/lib/utils";

import { CognitiveAuthSpotlight } from "./CognitiveAuthSpotlight";

import "./cognitive-auth.css";

export interface CognitiveAuthOnboardingProps {
  readonly step: number;
  readonly onBack: () => void;
  readonly onNext: () => void;
  readonly onFinish: () => void;
}

export function CognitiveAuthOnboarding({ step, onBack, onNext, onFinish }: CognitiveAuthOnboardingProps) {
  const skipLabel = useContent("auth.a11y.skip_link");
  const title = useContent("auth.onboarding.title");
  const description = useContent("auth.onboarding.description");
  const progressLabel = useContent("auth.onboarding.progress_label");
  const stepWhat = useContent("auth.onboarding.step_what");
  const stepLimits = useContent("auth.onboarding.step_limits");
  const stepAccount = useContent("auth.onboarding.step_account");
  const whatBody = useContent("auth.onboarding.what_body");
  const limitsIntro = useContent("auth.onboarding.limits_intro");
  const limitApplication = useContent("auth.onboarding.limit_application");
  const limitCalculation = useContent("auth.onboarding.limit_calculation");
  const limitDate = useContent("auth.onboarding.limit_date");
  const accountBody = useContent("auth.onboarding.account_body");
  const backLabel = useContent("auth.onboarding.back");
  const nextLabel = useContent("auth.onboarding.next");
  const finishLabel = useContent("auth.onboarding.finish");
  const listId = useId();

  const steps = [
    { id: "ne", label: stepWhat },
    { id: "sinir", label: stepLimits },
    { id: "hesap", label: stepAccount },
  ];
  const isLast = step === steps.length - 1;

  return (
    <div className="cognitive-auth" data-cognitive-auth data-mode="onboarding">
      <a className="cognitive-auth__skip-link" href="#ana-icerik">
        {skipLabel}
      </a>
      <CognitiveAuthSpotlight />
      <main id="ana-icerik" className="cognitive-auth__canvas" tabIndex={-1}>
        <div className="cognitive-auth__panel">
          <h1 className="cognitive-auth__title">{title}</h1>
          <p className="cognitive-auth__lede">{description}</p>
          <ol className="cognitive-auth__stepper" aria-label={progressLabel} id={listId}>
            {steps.map((entry, index) => (
              <li
                key={entry.id}
                className="cognitive-auth__step"
                data-current={index === step ? "true" : "false"}
                aria-current={index === step ? "step" : undefined}
              >
                {entry.label}
              </li>
            ))}
          </ol>
          <div className="cognitive-auth__step-body">
            {step === 0 ? <p>{whatBody}</p> : null}
            {step === 1 ? (
              <div className="cognitive-auth__step-body">
                <p>{limitsIntro}</p>
                <ul className="cognitive-auth__limits-list">
                  <li>{limitApplication}</li>
                  <li>{limitCalculation}</li>
                  <li>{limitDate}</li>
                </ul>
                <p className="cognitive-auth__lede">{DISCLAIMER}</p>
              </div>
            ) : null}
            {step === 2 ? <p>{accountBody}</p> : null}
          </div>
          <div className="cognitive-auth__step-actions">
            <button
              type="button"
              className={cn("cognitive-auth__step-button", "cognitive-auth__step-button--secondary")}
              disabled={step === 0}
              onClick={onBack}
            >
              {backLabel}
            </button>
            {isLast ? (
              <button
                type="button"
                className={cn("cognitive-auth__step-button", "cognitive-auth__step-button--primary")}
                onClick={onFinish}
              >
                {finishLabel}
              </button>
            ) : (
              <button
                type="button"
                className={cn("cognitive-auth__step-button", "cognitive-auth__step-button--primary")}
                onClick={onNext}
              >
                {nextLabel}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
