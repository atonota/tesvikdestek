import type { Meta, StoryObj } from "@storybook/react-vite";

import { calculateMaturity } from "@/domain/maturity";
import { decisionFixtures, programFixtures, readinessFixture, snapshotFixtures } from "@/mocks/fixtures";
import {
  ApprovalRecordCard,
  BackendCapabilityGate,
  CallWindowBadge,
  CitationChip,
  DecisionCompareGrid,
  DecisionHashPair,
  MaturityRadar,
  MissingFactsPanel,
  MoneyStateLabel,
  OutcomeBadge,
  OutcomeDistribution,
  PredicateTraceTable,
  ProgramCard,
  ReasonList,
  RequiredDocumentsChecklist,
  ReviewStatusBadge,
  RuleTree,
  SourceFreshnessMeter,
  SourceSnapshotCard,
} from "./domain";

const meta = { title: "5 Alan bileşenleri/Genel bakış" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Outcomes: Story = {
  name: "OutcomeBadge — yalnızca dört değer",
  render: () => (
    <div className="dt-stack">
      <OutcomeBadge outcome="candidate_eligible" showDescription />
      <OutcomeBadge outcome="conditional" showDescription />
      <OutcomeBadge outcome="insufficient_data" showDescription />
      <OutcomeBadge outcome="ineligible" showDescription />
      <p className="dt-muted">“Onaylandı” diye bir değer yoktur ve eklenemez.</p>
    </div>
  ),
};

export const Distribution: Story = {
  name: "OutcomeDistribution — sayı, para değil",
  render: () => (
    <div className="dt-stack">
      <OutcomeDistribution decisions={decisionFixtures} />
      <OutcomeDistribution decisions={[]} />
    </div>
  ),
};

export const ReasonsAndGaps: Story = {
  name: "ReasonList · MissingFactsPanel",
  render: () => (
    <div className="dt-stack">
      <ReasonList reasons={["call_window_unknown", "source_effective_dates_unknown"]} />
      <ReasonList reasons={[]} />
      <MissingFactsPanel missingFacts={["nace_code", "sme_declaration"]} />
      <MissingFactsPanel missingFacts={[]} />
    </div>
  ),
};

export const Traces: Story = {
  name: "PredicateTraceTable — masaüstünde tablo, mobilde kart",
  render: () => (
    <PredicateTraceTable
      traces={[...decisionFixtures[0]!.traces, ...decisionFixtures[1]!.traces]}
      knownSnapshotIds={snapshotFixtures.map((s) => s.id)}
    />
  ),
};

export const Rules: Story = {
  name: "RuleTree",
  render: () => (
    <div className="dt-stack">
      <RuleTree
        root={{
          kind: "all",
          label: "Tümü sağlanmalı",
          children: [
            { kind: "predicate", label: "Sermaye şirketi", result: "true" },
            { kind: "predicate", label: "NACE kodu 62/63", result: "unknown" },
          ],
        }}
      />
      <RuleTree root={null} />
    </div>
  ),
};

export const Sources: Story = {
  name: "Kaynak bileşenleri",
  render: () => (
    <div className="dt-stack">
      <SourceSnapshotCard snapshot={snapshotFixtures[0]!} />
      <SourceFreshnessMeter snapshots={snapshotFixtures} />
      <div className="dt-row">
        <ReviewStatusBadge status="verified" />
        <ReviewStatusBadge status="pending_review" />
        <ReviewStatusBadge status="stale" />
      </div>
      <div className="dt-row">
        <CallWindowBadge state="open" />
        <CallWindowBadge state="closed" />
        <CallWindowBadge state="unknown" />
      </div>
      <div className="dt-row">
        <CitationChip citation="snap-tubitak-1501-2026-08-14" />
        <CitationChip citation="snap-eksik" known={false} />
      </div>
    </div>
  ),
};

export const Evidence: Story = {
  name: "DecisionHashPair · DecisionCompareGrid",
  render: () => (
    <div className="dt-stack">
      <DecisionHashPair inputHash={"a".repeat(64)} decisionHash={"b".repeat(64)} />
      <DecisionCompareGrid decisions={decisionFixtures} />
      <DecisionCompareGrid decisions={[decisionFixtures[0]!]} />
    </div>
  ),
};

export const ProgrammesAndMoney: Story = {
  name: "ProgramCard · MoneyStateLabel · Belge listesi",
  render: () => (
    <div className="dt-stack">
      <ProgramCard program={programFixtures[0]!} href="/firsatlar/TUBITAK-1501" />
      <MoneyStateLabel publishedReference={null} />
      <MoneyStateLabel publishedReference="1.000.000 ₺" />
      <RequiredDocumentsChecklist documents={programFixtures[0]!.required_documents} />
      <RequiredDocumentsChecklist documents={[]} />
    </div>
  ),
};

export const ApprovalAndMaturity: Story = {
  name: "ApprovalRecordCard · MaturityRadar",
  render: () => (
    <div className="dt-stack">
      <ApprovalRecordCard />
      <ApprovalRecordCard note="İç değerlendirmede uygun bulundu." approvedAt="2026-08-14T10:00:00+00:00" />
      <MaturityRadar
        dimensions={
          calculateMaturity({
            decisions: decisionFixtures,
            programs: programFixtures,
            snapshots: snapshotFixtures,
            health: readinessFixture,
          }).dimensions
        }
      />
    </div>
  ),
};

export const CapabilityGates: Story = {
  name: "BackendCapabilityGate — yeşil, kısmi, engelli",
  render: () => (
    <div className="dt-stack">
      <BackendCapabilityGate
        capability={{ id: "a", title: "Kokpit", group: "decisions", status: "green", enabled: true }}
      >
        <p>Gerçek içerik burada görünür.</p>
      </BackendCapabilityGate>
      <BackendCapabilityGate
        capability={{
          id: "b",
          title: "Şirket profili",
          group: "organization",
          status: "partial",
          enabled: true,
          reason: "Profil yazılabilir ama okunamaz.",
        }}
      />
      <BackendCapabilityGate
        capability={{
          id: "c",
          title: "Başvuru hattı",
          group: "pipeline",
          status: "blocked",
          enabled: false,
          reason: "Application varlığı domainde hiç yok.",
        }}
      />
    </div>
  ),
};
