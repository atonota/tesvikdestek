/**
 * The master component system, by level.
 *
 * This list is the contract: a test asserts that every name here is really
 * exported from `@/components` and that the level counts are exactly
 * 14/16/10/5/18/12 = 75. It exists so "we have a design system" is a checkable
 * claim rather than a slide.
 *
 * Components that are product surfaces rather than system parts -
 * `BackendCapabilityGate`, `CapabilityMatrix`, `ReadinessTemplate`,
 * `ApprovalForm` - are exported from the barrel but deliberately not counted
 * here; padding the number would defeat its purpose.
 *
 * One subsystem sits outside the count for the same reason: the data grid
 * (`components/data-grid`). It has one stable public surface exported from
 * `@/components` and declares its own capability ledger rather than borrowing
 * this one.
 *
 * The media library and the provider connection centre were previously
 * registered here as subsystems too. W2 removed every visual component from
 * both packages - `src/components/media` and
 * `src/components/provider-connections` are now logic-only (types,
 * capability ledgers, state machines) - and replaced them with the
 * clean-room `CognitiveFileLibrary` and `CognitiveProviderCenter` masters,
 * which render `/dosyalar` and `/ayarlar/yapay-zeka` respectively. Neither
 * package is registered as a subsystem barrel below; there is nothing left
 * in either one for this registry to classify.
 */

export const COMPONENT_LEVELS = {
  primitives: [
    "Button",
    "IconButton",
    "Input",
    "NumberInput",
    "TristateSelect",
    "Textarea",
    "Checkbox",
    "RadioGroup",
    "Switch",
    "Label",
    "FieldError",
    "Badge",
    "Link",
    "VisuallyHidden",
  ],
  composites: [
    "FormField",
    "Fieldset",
    "Card",
    "DataTable",
    "DefinitionList",
    "Tabs",
    "Dialog",
    "Popover",
    "Tooltip",
    "Toast",
    "Pagination",
    "FilterBar",
    "SearchInput",
    "Stepper",
    "Timeline",
    "CopyableHash",
  ],
  patterns: [
    "SkeletonBlock",
    "EmptyState",
    "ErrorState",
    "PermissionDenied",
    "OfflineBanner",
    "PartialDataNotice",
    "StaleDataNotice",
    "ConfirmDestructive",
    "FormSubmitBarrier",
    "DisclaimerBlock",
  ],
  shells: ["AppShell", "WorkspaceShell", "PublicShell", "AuthShell", "PrintShell"],
  domain: [
    "OutcomeBadge",
    "OutcomeDistribution",
    "ReasonList",
    "MissingFactsPanel",
    "PredicateTraceTable",
    "RuleTree",
    "CitationChip",
    "SourceSnapshotCard",
    "SourceFreshnessMeter",
    "ReviewStatusBadge",
    "CallWindowBadge",
    "DecisionHashPair",
    "DecisionCompareGrid",
    "ProgramCard",
    "RequiredDocumentsChecklist",
    "ApprovalRecordCard",
    "MaturityRadar",
    "MoneyStateLabel",
  ],
  templates: [
    "PublicLanding",
    "CatalogList",
    "OpportunityDetail",
    "AuthForm",
    "ProfileWorkspace",
    "EligibilityWizard",
    "DecisionList",
    "DecisionDetail",
    "DecisionCompare",
    "SourceRegistry",
    "SettingsPanel",
    "OpsHealth",
  ],
} as const satisfies Record<string, readonly string[]>;

export type ComponentLevel = keyof typeof COMPONENT_LEVELS;

export const LEVEL_TITLES: Record<ComponentLevel, string> = {
  primitives: "Primitifler",
  composites: "Bileşikler",
  patterns: "Durum desenleri",
  shells: "Kabuklar",
  domain: "Alan bileşenleri",
  templates: "Sayfa şablonları",
};

export const ALL_COMPONENT_NAMES: readonly string[] = Object.values(COMPONENT_LEVELS).flat();

/**
 * Where each registered component is actually rendered.
 *
 * A design system's honest claim is not "we have 75 components" - it is "we
 * know which of them the product uses and which of them it does not". Fourteen
 * of these are rendered nowhere in runtime code: they exist, they are covered
 * by tests and they have stories, and no route puts them on a screen.
 *
 * The wrong response to that is a `/bilesenler` gallery route, and it is worth
 * saying why, because it is the obvious move. A gallery is a route that exists
 * for the people who build the product rather than for the people who use it;
 * it inflates the route inventory, it has to be maintained, and it makes
 * "reachable in the product" mean nothing, because everything is reachable in
 * it. Storybook already is that surface and is not shipped to users.
 *
 * So the classification is declared here and checked by
 * `src/test/route-registry.test.ts` instead. Three values, and each one is a
 * different true statement rather than three shades of "done":
 *
 *   `route`       a currently usable product surface: runtime code a route can
 *                 reach renders it, and the existing static route contract in
 *                 the test is what decides that, not a claim made here.
 *   `route-gated` the route and import graph do reach the component, and the
 *                 capabilities the route injects deliberately stop the
 *                 interaction from ever becoming visible to the user today. The
 *                 component is real and unfaked; the missing half is a backend
 *                 capability that this package does not invent. It is held to
 *                 the same reachability proof as `route`, and the set of names
 *                 allowed to carry it is pinned by exact equality in the test,
 *                 so it can never quietly become a place to hide dead code.
 *   `storybook`   no route reachability at all, and it has stories. A story is
 *                 required - an unrendered, undocumented component is not a
 *                 classification, it is dead code - and it must *not* turn up
 *                 in runtime code, which would mean this list has gone stale.
 *
 * Moving a name between the lists is the whole cost of using one of these for
 * the first time, and the test says so on the line it fails.
 */
export const STORYBOOK_ONLY_COMPONENTS: readonly string[] = [
  "TristateSelect",
  "DataTable",
  "Dialog",
  "Popover",
  "Tooltip",
  "Toast",
  "Pagination",
  "PermissionDenied",
  "StaleDataNotice",
  "ConfirmDestructive",
  "FormSubmitBarrier",
  "AppShell",
  "PrintShell",
  "RuleTree",
];

export type ComponentSurface = "route" | "route-gated" | "storybook";

/** Every registered name, classified. Exhaustive by construction. */
export const COMPONENT_SURFACES: Readonly<Record<string, ComponentSurface>> =
  Object.fromEntries(
    ALL_COMPONENT_NAMES.map((name) => [
      name,
      STORYBOOK_ONLY_COMPONENTS.includes(name) ? "storybook" : "route",
    ]),
  );

/* ------------------------------------------- the subsystems, classified too */

/**
 * The three barrels whose components are outside the 75 and inside the product.
 *
 * The classification above was exhaustive over the wrong universe. It covered
 * the 75 core names and stopped, which meant the data grid, the adaptive shell
 * and the form layer were not classified at all. Nothing recorded which of
 * them the product renders and which of them only Storybook does, so "is this
 * subsystem shipped?" was again a question with no mechanical answer.
 *
 * `route-registry.test.ts` reads the real export list off each of these barrels
 * and fails if a PascalCase component export is missing from the map below, in
 * either direction. Adding a component to a subsystem is therefore the same
 * two-line act as adding one to the core system: export it, and say where it
 * appears.
 *
 * The media library and the provider connection centre are deliberately not
 * listed here - see the comment above `COMPONENT_LEVELS` for why.
 */
export const SUBSYSTEM_BARRELS = ["data-grid", "adaptive", "forms"] as const;

/**
 * Where each subsystem component appears.
 *
 * The media library and the provider connection centre used to be registered
 * here too - `MediaLibrary`, `MediaUploadPanel`, `MediaStoragePanel`,
 * `MediaOrganizer`, `FolderTree`, `MediaDetails`, `MediaGovernancePanel`,
 * `ProviderCatalogView`, `DataRoutingDisclosure`, `ConnectionWizard`,
 * `ConnectionInventory`, `SecretField`, `ProviderComparison`,
 * `ConnectionHealthPanel`, `RoutingPolicyBuilder`, `ProviderAuditTimeline` -
 * and are gone with the rejected visual implementation those names belonged
 * to. `/dosyalar` and `/ayarlar/yapay-zeka` now render the clean-room
 * `CognitiveFileLibrary` and `CognitiveProviderCenter` masters instead, which
 * are registered separately - see `COGNITIVE_COCKPIT_DASHBOARD` below for how
 * a master surface outside the primitives/composites/patterns/shells/domain/
 * templates ladder is named in this file.
 */
export const SUBSYSTEM_COMPONENT_SURFACES: Readonly<Record<string, ComponentSurface>> = {
  // data-grid
  DataGrid: "route",
  GridToolbar: "route",
  // adaptive
  AdaptiveShell: "route",
  AdaptiveAssistant: "route",
  ShellHeaderSpotlight: "route",
  ShellSidebarNav: "route",
  ShellSidebarCommand: "route",
  ShellAccountMenu: "route",
  // forms
  Select: "route",
  AppForm: "route",
  SelectField: "route",
  TextField: "route",
};

/**
 * The whole classified universe: the 75 and the five subsystems.
 *
 * A union rather than a new count. `ALL_COMPONENT_NAMES` and its 14/16/10/5/18/
 * 12 = 75 arithmetic is a separate published contract about the core system and
 * is deliberately not inflated by the subsystems, which declare their own
 * capability ledgers.
 */
export const CLASSIFIED_COMPONENT_SURFACES: Readonly<Record<string, ComponentSurface>> = {
  ...COMPONENT_SURFACES,
  ...SUBSYSTEM_COMPONENT_SURFACES,
};

/**
 * The cognitive cockpit, registered outside the 75-component count.
 *
 * `src/components/cognitive-cockpit` is a master *surface* - one dashboard and
 * its own chrome - rather than a member of the primitives/composites/patterns/
 * shells/domain/templates ladder above, so it is named here rather than folded
 * into `COMPONENT_LEVELS` or `SUBSYSTEM_COMPONENT_SURFACES`, both of which are
 * checked for exact equality against their own barrels elsewhere. It renders
 * `/panel` and is registered before its skeleton is checked in
 * `skeleton-map.ts`.
 */
export const COGNITIVE_COCKPIT_DASHBOARD = "CognitiveCockpitDashboard" as const;

/** The six states every pattern/page layer must be able to show. */
export const DOCUMENTED_STATES = [
  "loading",
  "empty",
  "error",
  "permission",
  "offline",
  "partial-data",
] as const;
