/**
 * The cognitive opportunity workspace, one story per honest read state.
 * `/firsatlar` and `/firsatlar/:code` import these same components from
 * `./index` — this catalogue never wraps or restyles them.
 */

import type { Meta, StoryObj } from "@storybook/react-vite";

import { resolveContent } from "@/content";

import {
  CognitiveOpportunityDetail,
  CognitiveOpportunityList,
  CognitiveOpportunityWorkspaceSkeleton,
  type OpportunityDetailProgram,
  type OpportunityDetailSource,
  type OpportunityListProgram,
} from "./index";

const SAMPLE_PROGRAMS: readonly OpportunityListProgram[] = [
  {
    code: "KOSGEB-2026-01",
    name: resolveContent("opportunity.story.program.kosgeb_digital.name"),
    support_type: "grant",
    call_window_state: "open",
  },
  {
    code: "TUBITAK-1501",
    name: resolveContent("opportunity.story.program.tubitak.name"),
    support_type: "grant",
    call_window_state: "closed",
  },
  {
    code: "TKB-YATIRIM-07",
    name: resolveContent("opportunity.story.program.yatirim_kredisi.name"),
    support_type: "loan",
    call_window_state: "open",
  },
  {
    code: "IHRACAT-GARANTI-03",
    name: resolveContent("opportunity.story.program.ihracat_garanti.name"),
    support_type: "guarantee",
    call_window_state: "unknown",
  },
];

const SAMPLE_PROGRAM: OpportunityDetailProgram = {
  code: "KOSGEB-2026-01",
  name: resolveContent("opportunity.story.program.kosgeb_digital.name"),
  version: "3",
  support_type: "grant",
  call_window_state: "open",
  official_url: "https://www.kosgeb.gov.tr/",
  published_reference: "RG-2026/41",
  required_documents: [
    resolveContent("opportunity.story.document.tax_certificate"),
    resolveContent("opportunity.story.document.activity_certificate"),
    resolveContent("opportunity.story.document.balance_sheet"),
  ],
};

const SAMPLE_SOURCES: readonly OpportunityDetailSource[] = [
  {
    id: "src-1",
    title: resolveContent("opportunity.story.source.kosgeb_implementation.title"),
    publisher: resolveContent("opportunity.story.source.kosgeb_implementation.publisher"),
    url: "https://www.kosgeb.gov.tr/destekler/dijital-donusum",
    captured_at: "2026-08-10",
  },
  {
    id: "src-2",
    title: resolveContent("opportunity.story.source.official_gazette.title"),
    publisher: resolveContent("opportunity.story.source.official_gazette.publisher"),
    url: "https://www.resmigazete.gov.tr/",
    captured_at: "2026-07-28",
  },
];

const GENERIC_ERROR_MESSAGE = resolveContent("opportunity.story.generic_error_message");
const FILTERED_SEARCH_QUERY = resolveContent("opportunity.story.filtered_search_query");
const LOGIN_ACTION_LABEL = resolveContent("opportunity.state.session_error.login_action");

const meta = {
  title: "Kognitif fırsat çalışma alanı/Çalışma alanı",
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  name: "loading",
  render: () => <CognitiveOpportunityWorkspaceSkeleton variant="list" />,
};

export const Empty: Story = {
  name: "empty",
  render: () => <CognitiveOpportunityList state="empty" />,
};

export const FilteredEmpty: Story = {
  name: "filtered-empty",
  render: () => (
    <CognitiveOpportunityList
      state="success"
      programs={SAMPLE_PROGRAMS}
      initialSearch={FILTERED_SEARCH_QUERY}
    />
  ),
};

export const Success: Story = {
  name: "success",
  render: () => <CognitiveOpportunityList state="success" programs={SAMPLE_PROGRAMS} />,
};

export const SessionError: Story = {
  name: "session-error",
  render: () => (
    <CognitiveOpportunityList
      state="session-error"
      sessionAction={<a href="/giris">{LOGIN_ACTION_LABEL}</a>}
    />
  ),
};

export const GenericError: Story = {
  name: "generic-error",
  render: () => (
    <CognitiveOpportunityList state="error" errorMessage={GENERIC_ERROR_MESSAGE} onRetry={() => {}} />
  ),
};

export const WithSources: Story = {
  name: "with-sources",
  render: () => (
    <CognitiveOpportunityDetail state="success" program={SAMPLE_PROGRAM} sources={SAMPLE_SOURCES} />
  ),
};

export const WithoutSources: Story = {
  name: "without-sources",
  render: () => <CognitiveOpportunityDetail state="success" program={SAMPLE_PROGRAM} sources={[]} />,
};

export const UnreadRegistry: Story = {
  name: "unread-registry",
  render: () => (
    <CognitiveOpportunityDetail
      state="success"
      program={SAMPLE_PROGRAM}
      sources={null}
      sourcesErrorMessage={GENERIC_ERROR_MESSAGE}
      onSourcesRetry={() => {}}
    />
  ),
};

export const NotFound: Story = {
  name: "not-found",
  render: () => <CognitiveOpportunityDetail state="not-found" code="BULUNMAYAN-KOD" />,
};

export const AtPhone320: Story = {
  name: "success-320",
  render: () => <CognitiveOpportunityList state="success" programs={SAMPLE_PROGRAMS} />,
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
