/**
 * The cognitive provider center, one story per honest read state.
 * `/ayarlar/yapay-zeka` and this catalogue import the same
 * `CognitiveProviderCenter` from `./index`.
 */

import type { Meta, StoryObj } from "@storybook/react-vite";

import { NO_BACKEND_CAPABILITIES, PROVIDER_CATALOG } from "@/components/provider-connections";

import { CognitiveProviderCenter } from "./index";

const meta = {
  title: "Kognitif sağlayıcı merkezi/Merkez",
  component: CognitiveProviderCenter,
} satisfies Meta<typeof CognitiveProviderCenter>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  name: "loading",
  args: {
    state: "loading",
    capabilities: NO_BACKEND_CAPABILITIES,
    catalog: PROVIDER_CATALOG,
  },
};

export const Empty: Story = {
  name: "empty",
  args: {
    state: "empty",
    capabilities: NO_BACKEND_CAPABILITIES,
    catalog: [],
  },
};

export const Error: Story = {
  name: "error",
  args: {
    state: "error",
    capabilities: NO_BACKEND_CAPABILITIES,
    catalog: PROVIDER_CATALOG,
    errorMessage: null,
    onRetry: () => {},
  },
};

export const Offline: Story = {
  name: "offline",
  args: {
    state: "offline",
    capabilities: NO_BACKEND_CAPABILITIES,
    catalog: PROVIDER_CATALOG,
    updatedAt: Date.parse("2026-08-16T19:58:01Z"),
  },
};

export const Permission: Story = {
  name: "permission",
  args: {
    state: "permission",
    capabilities: NO_BACKEND_CAPABILITIES,
    catalog: [],
  },
};

export const Success: Story = {
  name: "success",
  args: {
    state: "success",
    capabilities: NO_BACKEND_CAPABILITIES,
    catalog: PROVIDER_CATALOG,
  },
};

export const SuccessAtPhone320: Story = {
  name: "success-320",
  args: { ...Success.args },
  parameters: {
    viewport: {
      options: {
        phone320: {
          name: "phone320",
          styles: { width: "320px", height: "568px" },
        },
      },
    },
  },
  globals: { viewport: { value: "phone320", isRotated: false } },
};
