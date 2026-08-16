/**
 * The cognitive file library — clean-room `/dosyalar` master surface, public
 * barrel. Storybook and the route both import `CognitiveFileLibrary` from
 * this one module, so there is exactly one implementation to review.
 */

export {
  CognitiveFileLibrary,
  type CognitiveFileLibraryProps,
  type FileLibraryReadState,
} from "./CognitiveFileLibrary";
