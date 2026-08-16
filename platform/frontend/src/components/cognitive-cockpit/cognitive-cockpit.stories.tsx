/**
 * The cognitive cockpit, one story per enterprise read state.
 *
 * `/panel` and this catalogue import the same `CognitiveCockpitDashboard` from
 * `./index` - there is exactly one implementation of the dashboard, reviewed
 * once, and every state below is a different set of props over it rather than
 * a different component. The composed body below is built only from this
 * package's own clean-room components - no legacy `Card`, no product-level
 * domain component - so what Storybook shows is the same enterprise surface
 * `/panel` renders, not a placeholder card standing in for it.
 */

import type { Meta, StoryObj } from "@storybook/react-vite";

import type { Distribution } from "@/domain/analytics";
import { resolveContent } from "@/content";

import { CognitiveAccessScopePanel } from "./CognitiveAccessScopePanel";
import { CognitiveAnalyticsPanel } from "./CognitiveAnalyticsPanel";
import { CognitiveAuditTruthBlock } from "./CognitiveAuditTruthBlock";
import { CognitiveCatalogPanel } from "./CognitiveCatalogPanel";
import { CognitiveCockpitDashboard, type CockpitIdentity } from "./index";
import { CognitiveEvidenceGapList } from "./CognitiveEvidenceGapList";
import { CognitiveEvidenceRail } from "./CognitiveEvidenceRail";
import { CognitiveKpiStrip } from "./CognitiveKpiStrip";
import { CognitiveNextActionQueue } from "./CognitiveNextActionQueue";
import type { CockpitSearchItem } from "./CognitiveSpotlightHeader";

const PORTFOLIO_DISTRIBUTION: Distribution = {
  status: "populated",
  total: 10,
  slices: [
    { key: "grant", label: resolveContent("cockpit.story.distribution.portfolio.grant"), count: 5 },
    { key: "export", label: resolveContent("cockpit.story.distribution.portfolio.export"), count: 3 },
    {
      key: "employment",
      label: resolveContent("cockpit.story.distribution.portfolio.employment"),
      count: 2,
    },
  ],
};

const OUTCOME_DISTRIBUTION: Distribution = {
  status: "populated",
  total: 10,
  slices: [
    {
      key: "candidate_eligible",
      label: resolveContent("cockpit.story.distribution.outcomes.candidate"),
      count: 4,
      tone: "candidate",
    },
    {
      key: "conditionally_eligible",
      label: resolveContent("cockpit.story.distribution.outcomes.conditional"),
      count: 3,
      tone: "conditional",
    },
    {
      key: "not_eligible",
      label: resolveContent("cockpit.story.distribution.outcomes.ineligible"),
      count: 1,
      tone: "ineligible",
    },
    {
      key: "insufficient_data",
      label: resolveContent("cockpit.story.distribution.outcomes.insufficient"),
      count: 2,
      tone: "insufficient",
    },
  ],
};

const EVIDENCE_DISTRIBUTION: Distribution = {
  status: "populated",
  total: 7,
  slices: [
    { key: "verified", label: resolveContent("cockpit.story.distribution.evidence.verified"), count: 4 },
    {
      key: "pending_review",
      label: resolveContent("cockpit.story.distribution.evidence.pending"),
      count: 3,
    },
  ],
};

const IDENTITY: CockpitIdentity = {
  organisationLabel: resolveContent("cockpit.story.identity.org"),
  roleLabel: resolveContent("cockpit.identity.role.superadmin"),
  isDemo: false,
};

const DEMO_IDENTITY: CockpitIdentity = {
  ...IDENTITY,
  organisationLabel: resolveContent("cockpit.story.identity.demo_org"),
  isDemo: true,
};

const SEARCH_ITEMS: readonly CockpitSearchItem[] = [
  {
    id: "d-1",
    label: resolveContent("cockpit.story.search.rd_center.label"),
    hint: resolveContent("cockpit.story.search.rd_center.hint"),
    to: "/degerlendirmeler/d-1",
  },
  {
    id: "d-2",
    label: resolveContent("cockpit.story.search.export.label"),
    hint: resolveContent("cockpit.story.search.export.hint"),
    to: "/degerlendirmeler/d-2",
  },
];

/**
 * The composed enterprise body: KPI/provenance strip, next-action queue,
 * analytics, evidence gaps and audit truth in the main canvas; catalog,
 * context and access scope in the wide rail. `/panel` and this story render
 * the exact same `CognitiveAnalyticsPanel` - its chart half is still reached
 * through a dynamic `import()` internally, so opening this story does not
 * pull `echarts` into Storybook's own eager bundle.
 */
function composedMainCanvas() {
  return (
    <>
      <CognitiveKpiStrip
        tiles={[
          {
            id: "pending-evidence",
            label: resolveContent("cockpit.kpi.pending_evidence.label"),
            value: "3",
            hint: resolveContent("cockpit.kpi.pending_evidence.hint"),
          },
          {
            id: "unverified-sources",
            label: resolveContent("cockpit.kpi.unverified_sources.label"),
            value: "2",
            hint: resolveContent("cockpit.kpi.unverified_sources.hint"),
          },
          {
            id: "open-calls",
            label: resolveContent("cockpit.kpi.open_calls.label"),
            value: "1",
            hint: resolveContent("cockpit.kpi.open_calls.hint"),
          },
          {
            id: "platform-status",
            label: resolveContent("cockpit.kpi.platform_status.label"),
            value: "ready",
            hint: resolveContent("cockpit.kpi.platform_status.hint"),
          },
        ]}
        provenance={{
          sourceId: "snap-2026-0142",
          capturedAt: "2026-08-16T14:02:11Z",
          ruleVersion: "v3.1",
          calibrationStatus: "ready",
        }}
      />
      <CognitiveNextActionQueue
        items={[
          {
            id: "d-1",
            title: resolveContent("cockpit.queue.item.title", {
              values: {
                outcomeLabel: resolveContent("cockpit.story.distribution.outcomes.conditional"),
                programCode: resolveContent("cockpit.story.search.rd_center.hint"),
              },
            }),
            detail: resolveContent("cockpit.queue.item.detail", { values: { count: "1" } }),
            to: "/degerlendirmeler/d-1",
          },
        ]}
        onRunEvaluation={() => {}}
      />
      <CognitiveAnalyticsPanel
        caption={resolveContent("cockpit.analytics.caption")}
        tabs={[
          { key: "portfolio", label: resolveContent("cockpit.analytics.tab.portfolio"), distribution: PORTFOLIO_DISTRIBUTION },
          { key: "outcomes", label: resolveContent("cockpit.analytics.tab.outcomes"), distribution: OUTCOME_DISTRIBUTION },
          { key: "evidence", label: resolveContent("cockpit.analytics.tab.evidence"), distribution: EVIDENCE_DISTRIBUTION },
        ]}
      />
      <CognitiveEvidenceGapList
        gaps={[
          { fact: "sme_declaration", blockedDecisionCount: 2 },
          { fact: "nace_code", blockedDecisionCount: 1 },
        ]}
      />
      <CognitiveAuditTruthBlock />
    </>
  );
}

function composedContextRail(identity: CockpitIdentity) {
  return (
    <>
      <CognitiveCatalogPanel
        counts={[
          { label: resolveContent("cockpit.catalog.count.programs"), value: "3" },
          { label: resolveContent("cockpit.catalog.count.decisions"), value: "10" },
          { label: resolveContent("cockpit.catalog.count.sources"), value: "7" },
        ]}
        sources={[
          {
            id: "snap-1",
            publisher: resolveContent("cockpit.story.source.official_gazette.publisher"),
            title: resolveContent("cockpit.story.source.official_gazette.title"),
            capturedAt: "16.08.2026 12:02",
          },
          {
            id: "snap-2",
            publisher: resolveContent("cockpit.story.source.kosgeb.publisher"),
            title: resolveContent("cockpit.story.source.kosgeb.title"),
            capturedAt: "07.08.2026 09:10",
          },
        ]}
      />
      <CognitiveEvidenceRail
        suggestions={[
          {
            id: "missing-facts",
            title: resolveContent("cockpit.story.suggestion.missing_facts.title"),
            why: resolveContent("cockpit.story.suggestion.missing_facts.why"),
            actionLabel: resolveContent("cockpit.story.suggestion.missing_facts.action_label"),
            to: "/organizasyon/profil",
          },
        ]}
        status={{
          label: resolveContent("cockpit.context.status_label"),
          lastLoadedAt: "2026-08-16T19:58:01Z",
          missing: ["nace_code", "sme_declaration"],
          partial: false,
        }}
        providerReason={resolveContent("cockpit.story.provider_reason")}
      />
      <CognitiveAccessScopePanel
        tenantLabel={identity.organisationLabel}
        roleLabel={identity.roleLabel}
        isDemo={identity.isDemo}
      />
    </>
  );
}

const meta = {
  title: "Kognitif kokpit/Panel",
  component: CognitiveCockpitDashboard,
  parameters: {
    docs: {
      description: {
        component: resolveContent("cockpit.story.meta.description"),
      },
    },
  },
} satisfies Meta<typeof CognitiveCockpitDashboard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  name: "loading",
  args: { state: "loading", identity: IDENTITY },
};

export const Empty: Story = {
  name: "empty",
  args: { state: "empty", identity: IDENTITY },
};

export const NoResult: Story = {
  name: "no-result",
  args: {
    state: "success",
    identity: IDENTITY,
    searchItems: SEARCH_ITEMS,
    mainCanvas: composedMainCanvas(),
    contextRail: composedContextRail(IDENTITY),
  },
  play: async ({ canvasElement }) => {
    const input = canvasElement
      .querySelector(".cognitive-spotlight__panel")
      ?.querySelector<HTMLInputElement>("input");
    input?.click();
    if (input) {
      input.value = resolveContent("cockpit.story.search.no_match_query");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  },
};

export const ErrorState: Story = {
  name: "error",
  args: {
    state: "error",
    identity: IDENTITY,
    errorMessage: resolveContent("cockpit.story.error_message"),
  },
};

export const Partial: Story = {
  name: "partial",
  args: {
    state: "partial",
    identity: IDENTITY,
    mainCanvas: composedMainCanvas(),
    contextRail: composedContextRail(IDENTITY),
  },
};

export const Success: Story = {
  name: "success",
  args: {
    state: "success",
    identity: IDENTITY,
    searchItems: SEARCH_ITEMS,
    notificationCount: 3,
    readAt: "14:02",
    mainCanvas: composedMainCanvas(),
    contextRail: composedContextRail(IDENTITY),
  },
};

export const Permission: Story = {
  name: "permission",
  args: { state: "permission", identity: IDENTITY },
};

export const Offline: Story = {
  name: "offline",
  args: {
    state: "offline",
    identity: IDENTITY,
    mainCanvas: composedMainCanvas(),
    contextRail: composedContextRail(IDENTITY),
  },
};

export const Stale: Story = {
  name: "stale",
  args: {
    state: "success",
    identity: {
      ...IDENTITY,
      staleSourceNotice: resolveContent("cockpit.story.stale_notice"),
    },
    updatedAt: Date.parse("2026-08-13T09:00:00Z"),
    mainCanvas: composedMainCanvas(),
    contextRail: composedContextRail(IDENTITY),
  },
};

export const DemoAtPhone320: Story = {
  name: resolveContent("cockpit.story.name.demo_320"),
  args: {
    state: "success",
    identity: DEMO_IDENTITY,
    readAt: "19:58",
    mainCanvas: composedMainCanvas(),
    contextRail: composedContextRail(DEMO_IDENTITY),
  },
  parameters: {
    viewport: {
      options: {
        phone320: { name: "320px", styles: { width: "320px", height: "640px" }, type: "mobile" },
      },
    },
  },
  globals: { viewport: { value: "phone320", isRotated: false } },
};
