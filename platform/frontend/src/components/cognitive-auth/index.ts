/**
 * The cognitive auth family — clean-room `/giris`, `/kayit`, `/onboarding`
 * and workspace-gate master surface, public barrel.
 *
 * `/giris`, `/kayit`, `/onboarding` and `workspace-gate.tsx` all import from
 * this one module, so there is exactly one implementation of each surface to
 * review — the same discipline `CognitiveCockpitDashboard` set for `/panel`.
 */

export { CognitiveAuthCard, type CognitiveAuthCardProps } from "./CognitiveAuthCard";
export {
  CognitiveAuthOnboarding,
  type CognitiveAuthOnboardingProps,
} from "./CognitiveAuthOnboarding";
export {
  CognitiveAuthGate,
  type CognitiveAuthGateProps,
  type CognitiveAuthGateState,
} from "./CognitiveAuthGate";
export { CognitiveAuthSkeleton, type CognitiveAuthSkeletonProps } from "./CognitiveAuthSkeleton";
export { CognitiveAuthSpotlight } from "./CognitiveAuthSpotlight";
export {
  CognitiveAccessWorkbench,
  type CognitiveAccessWorkbenchProps,
} from "./CognitiveAccessWorkbench";
