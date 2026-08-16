/**
 * The cognitive provider center — clean-room `/ayarlar/yapay-zeka` master
 * surface, public barrel. Storybook and the route both import
 * `CognitiveProviderCenter` from this one module, so there is exactly one
 * implementation to review.
 */

export {
  CognitiveProviderCenter,
  type CognitiveProviderCenterProps,
  type ProviderCenterReadState,
} from "./CognitiveProviderCenter";
