import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor, type RenderResult } from "@testing-library/react";
import { RouterProvider } from "react-router";
import { expect } from "vitest";

import { createTestRouter } from "@/app/router";

/**
 * Mount the real router at a path, with retries off so failures surface fast,
 * and wait until the first paint has settled past its loading state.
 */
export async function renderAppAt(initialPath: string): Promise<RenderResult> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const router = createTestRouter(initialPath);
  const result = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await waitFor(
    () => {
      // Every shell renders a <main>; its presence means the lazy route module
      // resolved and painted.
      expect(result.container.querySelector("main")).not.toBeNull();
      expect(result.container.querySelector(".dt-skeleton")).toBeNull();
    },
    /*
     * Patience, sized to what is actually being waited for.
     *
     * This is a dynamic import of a route module - which now pulls the design
     * system, the master component layer and the icon set - plus a query round
     * trip, on one of forty-seven files running in parallel. The number was
     * 5000, which was also Vitest's own per-test default, so the helper could
     * spend the entire test budget here and fail on arithmetic; and as the
     * module graph grew it began to.
     *
     * The assertion is unchanged and is the strict one: a `<main>` on screen
     * **and** no skeleton left anywhere. A route that never paints still fails.
     */
    { timeout: 15_000 },
  );
  return result;
}
