/**
 * The cognitive auth family, one story per required state. `/giris`, `/kayit`,
 * `/onboarding` and `workspace-gate.tsx` import the same components this
 * catalogue renders from `./index` — there is exactly one implementation of
 * each surface, reviewed once.
 */

import type { Meta, StoryObj } from "@storybook/react-vite";

import { DEMO_PROFILES } from "@/demo";
import { useUiStore } from "@/store/ui";

import { CognitiveAuthCard } from "./CognitiveAuthCard";
import { CognitiveAuthGate } from "./CognitiveAuthGate";
import { CognitiveAuthOnboarding } from "./CognitiveAuthOnboarding";

const meta = {
  title: "Kognitif kimlik doğrulama/Aile",
  component: CognitiveAuthCard,
} satisfies Meta<typeof CognitiveAuthCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Login: Story = {
  name: "login",
  args: {
    mode: "login",
    demoProfiles: DEMO_PROFILES,
    onDemoStart: () => {},
    onSubmit: () => {},
  },
};

export const Register: Story = {
  name: "register",
  args: {
    mode: "register",
    onSubmit: () => {},
  },
};

export const Onboarding: Story = {
  name: "onboarding",
  args: { mode: "login", onSubmit: () => {} },
  render: () => (
    <CognitiveAuthOnboarding step={0} onBack={() => {}} onNext={() => {}} onFinish={() => {}} />
  ),
};

export const DemoCustomer: Story = {
  name: "demo-customer",
  args: {
    ...Login.args,
    demoStarting: "customer",
  },
};

export const DemoSuperadmin: Story = {
  name: "demo-superadmin",
  args: {
    ...Login.args,
    demoStarting: "superadmin",
  },
};

export const Submitting: Story = {
  name: "submitting",
  args: {
    ...Login.args,
    submitting: true,
  },
};

export const ValidationError: Story = {
  name: "validation-error",
  args: {
    mode: "login",
    onSubmit: () => {},
  },
  play: async ({ canvasElement }) => {
    const submit = canvasElement.querySelector<HTMLButtonElement>('button[type="submit"]');
    submit?.click();
  },
};

export const ServerError: Story = {
  name: "server-error",
  args: {
    mode: "login",
    onSubmit: () => {},
    error: "E-posta veya parola hatalı.",
  },
};

export const RealAccountOpen: Story = {
  name: "real-account-open",
  args: { ...Login.args },
  play: async ({ canvasElement }) => {
    const toggle = Array.from(canvasElement.querySelectorAll("button")).find((button) =>
      button.hasAttribute("aria-expanded"),
    );
    toggle?.click();
  },
};

export const Loading: Story = {
  name: "loading",
  args: { mode: "login", onSubmit: () => {} },
  render: () => <CognitiveAuthGate state="loading-session" />,
};

export const SessionRequired: Story = {
  name: "session-required",
  args: { mode: "login", onSubmit: () => {} },
  render: () => <CognitiveAuthGate state="session-required" loginHref="/giris" />,
};

export const Dark: Story = {
  name: "dark",
  args: { ...Login.args },
  decorators: [
    (StoryFn) => {
      useUiStore.getState().setTheme("dark");
      return <StoryFn />;
    },
  ],
};

export const AtPhone320: Story = {
  name: "at-phone-320",
  args: { ...Login.args },
  parameters: {
    viewport: {
      options: {
        phone320: {
          name: "phone320",
          styles: { width: "320px", height: "640px" },
        },
      },
    },
  },
  globals: { viewport: { value: "phone320", isRotated: false } },
};

export const ReducedMotion: Story = {
  name: "reduced-motion",
  args: { ...Login.args },
  decorators: [
    (StoryFn) => {
      useUiStore.getState().setReducedMotion(true);
      return <StoryFn />;
    },
  ],
};
