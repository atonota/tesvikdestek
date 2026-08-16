import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    /**
     * A realistic wall-clock allowance, not a weaker assertion.
     *
     * Many suites here mount the *real* router, which means a dynamic import of
     * a route module, the design system, the icon set and a query round trip -
     * and `render-app.tsx` then waits up to 5 seconds for the loading state to
     * clear. Vitest's own default is also 5 seconds, so the helper's patience
     * and the test's budget were the same number: any run where the first
     * import was slow spent the whole budget inside `waitFor` and failed on
     * arithmetic rather than on a defect. Under `--coverage`, with forty-seven
     * files in parallel, that happened to eight suites.
     *
     * Nothing about what those tests check changes. A genuine hang still fails,
     * fifteen seconds later than it used to.
     */
    testTimeout: 20_000,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    css: true,
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "json-summary", "html"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.stories.tsx",
        "src/**/*.{test,spec}.{ts,tsx}",
        "src/test/**",
        "src/mocks/**",
        "src/main.tsx",
        "src/**/index.ts",
      ],
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 70,
        statements: 80,
      },
    },
  },
});
