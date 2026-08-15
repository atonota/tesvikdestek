import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { emptyProfileValues } from "@/domain/facts";
import { calculateMaturity } from "@/domain/maturity";
import {
  decisionFixtures,
  programFixtures,
  readinessFixture,
  snapshotFixtures,
} from "@/mocks/fixtures";
import {
  ApprovalForm,
  AuthForm,
  CapabilityMatrix,
  CatalogList,
  DecisionCompare,
  DecisionDetail,
  DecisionList,
  EligibilityWizard,
  OpportunityDetail,
  OpsHealth,
  ProfileWorkspace,
  PublicLanding,
  ReadinessTemplate,
  SettingsPanel,
  SourceRegistry,
} from "./templates";

const meta = { title: "6 Sayfa şablonları/Genel bakış" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Landing: Story = {
  name: "PublicLanding",
  render: () => <PublicLanding programCount={3} snapshotCount={3} verifiedSnapshotCount={0} />,
};

export const Catalog: Story = {
  name: "CatalogList",
  render: () => <CatalogList programs={programFixtures} />,
};

export const CatalogEmpty: Story = {
  name: "CatalogList — boş",
  render: () => <CatalogList programs={[]} />,
};

export const Opportunity: Story = {
  name: "OpportunityDetail",
  render: () => <OpportunityDetail program={programFixtures[0]!} snapshots={snapshotFixtures} />,
};

export const Auth: Story = {
  name: "AuthForm — kayıt ve giriş",
  render: () => (
    <div className="dt-stack">
      <AuthForm mode="register" onSubmit={() => {}} />
      <AuthForm mode="login" onSubmit={() => {}} error="E-posta veya parola hatalı." />
    </div>
  ),
};

export const Profile: Story = {
  name: "ProfileWorkspace — yaz-ama-oku-yok",
  render: () => (
    <ProfileWorkspace
      defaultValues={emptyProfileValues() as Record<string, string>}
      missingFacts={["nace_code"]}
      onSubmit={() => {}}
    />
  ),
};

export const Wizard: Story = {
  name: "EligibilityWizard",
  render: () => {
    function Harness() {
      const [step, setStep] = useState(0);
      return (
        <EligibilityWizard
          step={step}
          defaultValues={emptyProfileValues() as Record<string, string>}
          onStepChange={setStep}
          onFinish={() => {}}
        />
      );
    }
    return <Harness />;
  },
};

export const Decisions: Story = {
  name: "DecisionList",
  render: () => <DecisionList decisions={decisionFixtures} />,
};

export const DecisionsEmpty: Story = {
  name: "DecisionList — boş",
  render: () => <DecisionList decisions={[]} />,
};

export const Decision: Story = {
  name: "DecisionDetail",
  render: () => (
    <DecisionDetail
      decision={decisionFixtures[0]!}
      program={programFixtures[0]!}
      snapshots={snapshotFixtures}
    />
  ),
};

export const Compare: Story = {
  name: "DecisionCompare",
  render: () => <DecisionCompare decisions={decisionFixtures} />,
};

export const Sources: Story = {
  name: "SourceRegistry",
  render: () => <SourceRegistry snapshots={snapshotFixtures} />,
};

export const Settings: Story = {
  name: "SettingsPanel",
  render: () => (
    <SettingsPanel
      title="Görünüm"
      sections={[
        { id: "a", title: "Yoğunluk", content: <p>Rahat / Sıkı / Yoğun</p> },
        { id: "b", title: "Tema", content: <p>Sistem / Açık / Koyu</p> },
      ]}
    />
  ),
};

export const Health: Story = {
  name: "OpsHealth — hazır ve okunamadı",
  render: () => (
    <div className="dt-stack">
      <OpsHealth
        health={readinessFixture}
        maturity={calculateMaturity({
          decisions: decisionFixtures,
          programs: programFixtures,
          snapshots: snapshotFixtures,
          health: readinessFixture,
        })}
        lastCheckedAt="2026-08-14T10:00:00+00:00"
      />
      <OpsHealth health={null} />
    </div>
  ),
};

export const Readiness: Story = {
  name: "ReadinessTemplate",
  render: () => <ReadinessTemplate decisions={decisionFixtures} />,
};

export const Capabilities: Story = {
  name: "CapabilityMatrix — dürüstlük defteri",
  render: () => <CapabilityMatrix />,
};

export const Approval: Story = {
  name: "ApprovalForm — Kullanıcı onayı",
  render: () => <ApprovalForm onSubmit={() => {}} />,
};
