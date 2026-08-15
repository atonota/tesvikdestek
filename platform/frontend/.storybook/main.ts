import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: [],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  // No build-time call-home. This package makes no external requests, at build
  // time or at runtime.
  core: {
    disableTelemetry: true,
  },
  typescript: {
    check: false,
  },
};

export default config;
