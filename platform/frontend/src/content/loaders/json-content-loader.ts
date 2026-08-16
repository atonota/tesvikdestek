/**
 * The dynamic JSON loader: every bundle under `src/content/base/**` becomes
 * this app's one `JsonContentAdapter`, and a content file edit hot-replaces
 * it in place through Vite's `import.meta.hot` - no full page reload, no
 * component call site aware that a reload even happened.
 *
 * `import.meta.glob` with `eager: true` is deliberate: content must be
 * synchronously present the moment a component (or a Storybook fixture built
 * at module scope) first resolves it, not one microtask later.
 */

import { JsonContentAdapter } from "../adapters/JsonContentAdapter";
import type { ContentBundle } from "../types";

const modules = import.meta.glob("../base/**/*.json", { eager: true }) as Record<
  string,
  { readonly default: ContentBundle }
>;

function currentBundles(): readonly ContentBundle[] {
  return Object.values(modules).map((module) => module.default);
}

export const contentPort = new JsonContentAdapter(currentBundles());

if (import.meta.hot) {
  import.meta.hot.accept(
    Object.keys(modules).map((moduleId) => moduleId),
    (updated) => {
      updated.forEach((updatedModule, index) => {
        const moduleId = Object.keys(modules)[index];
        if (moduleId && updatedModule) {
          modules[moduleId] = updatedModule as unknown as { readonly default: ContentBundle };
        }
      });
      contentPort.replaceBundles(currentBundles());
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("dt-content-updated"));
      }
    },
  );
}
