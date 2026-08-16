/**
 * The cognitive file library, one story per honest read state. `/dosyalar`
 * and this catalogue import the same `CognitiveFileLibrary` from `./index`.
 */

import type { Meta, StoryObj } from "@storybook/react-vite";

import { LOCAL_ONLY_CAPABILITIES, type StorageStatus } from "@/components/media";

import { CognitiveFileLibrary } from "./index";

const MEASURED_STORAGE: StorageStatus = {
  backend: "local",
  usedBytes: 41_943_040,
  quotaBytes: 5_368_709_120,
  assetCount: 12,
  lastCheckedAt: "2026-08-16T19:58:01Z",
};

const meta = {
  title: "Kognitif dosya kütüphanesi/Kütüphane",
  component: CognitiveFileLibrary,
} satisfies Meta<typeof CognitiveFileLibrary>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  name: "loading",
  args: {
    state: "loading",
    capabilities: LOCAL_ONLY_CAPABILITIES,
    storage: null,
    assetCount: null,
  },
};

export const Empty: Story = {
  name: "empty",
  args: {
    state: "empty",
    capabilities: LOCAL_ONLY_CAPABILITIES,
    storage: null,
    assetCount: 0,
  },
};

export const Error: Story = {
  name: "error",
  args: {
    state: "error",
    capabilities: LOCAL_ONLY_CAPABILITIES,
    storage: null,
    assetCount: null,
    errorMessage: null,
    onRetry: () => {},
  },
};

export const Offline: Story = {
  name: "offline",
  args: {
    state: "offline",
    capabilities: LOCAL_ONLY_CAPABILITIES,
    storage: MEASURED_STORAGE,
    assetCount: 12,
    updatedAt: Date.parse("2026-08-16T19:58:01Z"),
  },
};

export const Permission: Story = {
  name: "permission",
  args: {
    state: "permission",
    capabilities: LOCAL_ONLY_CAPABILITIES,
    storage: null,
    assetCount: null,
  },
};

export const Success: Story = {
  name: "success",
  args: {
    state: "success",
    capabilities: LOCAL_ONLY_CAPABILITIES,
    storage: MEASURED_STORAGE,
    assetCount: 12,
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
