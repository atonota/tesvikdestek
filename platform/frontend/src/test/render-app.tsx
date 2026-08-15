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
    // A lazy chunk plus a query round-trip can exceed the 1s default when the
    // whole suite runs in parallel. Same assertion, realistic patience.
    { timeout: 5000 },
  );
  return result;
}
