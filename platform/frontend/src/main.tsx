import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";

import { AppProviders } from "@/app/providers";
import { createAppRouter } from "@/app/router";

/**
 * Roboto is bundled, not borrowed.
 *
 * The font stack used to name Roboto and then fall through to whatever the
 * operating system had, so the product looked like a different product on
 * Windows, on Linux and on an older Android. `roboto.css` declares the two
 * faces this product renders - Latin and Latin Extended, weight axis, upright -
 * rather than importing the package entry and emitting all 54 files it ships.
 */
import "@/design/roboto.css";

/**
 * Tailwind first, then the token layer, then the bespoke component sheets.
 *
 * The order is the cascade contract. Tailwind's `@layer utilities` has to come
 * last in layer order so a utility beats a `.dt-*` component rule regardless of
 * specificity - that is what lets the master component layer paint while the
 * `dt-*` class hooks stay in the markup for the tests and the browser suite
 * that locate elements by them. Importing this sheet first is what establishes
 * that order.
 */
import "@/design/tailwind.css";

import "@/design/tokens.css";
import "@/design/base.css";
import "@/design/components.css";
import "@/design/data-grid.css";
import "@/design/adaptive.css";
/**
 * The media stylesheet is deliberately absent from the entry.
 *
 * `/dosyalar` renders the media subsystem, so this is no longer a claim that
 * nothing uses those rules - it is a claim about *where* they are loaded. The
 * entry is the eager bundle every visitor downloads, including someone who only
 * ever opens the landing page; the media rules belong to a lazily imported
 * route module and are fetched with it, which is why importing them here shipped
 * 4.7 kB to people who never reach that screen. Storybook loads the same sheet
 * through `.storybook/preview.tsx` for the same reason: it assembles the
 * components outside any route.
 *
 * Moving the import into `src/components/media/index.ts` was tried first and
 * measured: it changed nothing, because `src/components/index.ts` re-exports
 * that entry and every route imports the barrel, so the stylesheet stayed in
 * the eager graph. `src/test/build-contract.test.ts` holds both halves of this.
 */

/**
 * No mocking machinery ships here.
 *
 * The browser tests fake the backend with Playwright request routing, so the
 * production bundle contains no MSW worker and no test-only branch. The unit
 * suite still uses MSW, but only through its Node interceptor.
 *
 * That is a claim about a build output, so it is checked against the build
 * output rather than trusted: `src/test/no-mock-artifacts.test.ts` fails if a
 * worker script reappears in `public/` or `dist/`. It exists because this
 * comment was once true of the imports and false of the artifact.
 */
const container = document.getElementById("root");
if (!container) throw new Error("#root bulunamadı");

createRoot(container).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={createAppRouter()} />
    </AppProviders>
  </StrictMode>,
);
