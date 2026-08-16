/**
 * Which skeleton stands in for which master component.
 *
 * The owner's rule is "skeleton shimmer first", and a rule that is only checked
 * by grepping for the word `Skeleton` is not checked. This map is what makes it
 * checkable: every component the master layer exports appears here exactly once,
 * either with the skeleton shape that imitates it and the named story that shows
 * the pairing, or with an **explicit, reasoned exemption**.
 *
 * `skeleton-contract.test.tsx` reads this file and then goes and looks: it
 * renders each skeleton and asserts it produces shimmer shapes, and it imports
 * the catalogue module and asserts the named story export really exists. A
 * mapping that names a story nobody wrote fails, and so does a component that
 * quietly appears in the barrel without an entry here.
 *
 * ## Why exemptions are typed rather than absent
 *
 * Some parts genuinely have no loading state, and pretending otherwise would
 * produce shapes nobody ever sees. A `Separator` is a one-pixel rule; a
 * `TooltipProvider` renders nothing. But "this one does not need it" is exactly
 * the sentence that erodes a rule, so an exemption is a value with a `kind` and
 * a `reason` - visible in review, and impossible to add by omission.
 */

/** The skeleton shapes the master layer ships. */
export type SkeletonShape =
  | "SkeletonText"
  | "SkeletonCard"
  | "SkeletonTable"
  | "SkeletonChart"
  | "SkeletonForm"
  | "SkeletonMedia"
  | "SkeletonList"
  | "SkeletonControl"
  | "SkeletonTabStrip"
  | "Shimmer";

export interface SkeletonPairing {
  /** The shape that imitates this component's real layout. */
  readonly shape: SkeletonShape;
  /** The story export in `ui.stories.tsx` that shows the pairing. */
  readonly story: string;
  /** One line: what about the component's geometry the shape reproduces. */
  readonly imitates: string;
}

export type SkeletonExemptionKind =
  /** Draws no box of its own: a rule, a portal, a context provider. */
  | "structural"
  /** Only ever appears in response to a gesture, never while data loads. */
  | "on-demand";

export interface SkeletonExemption {
  readonly exempt: SkeletonExemptionKind;
  readonly reason: string;
}

export type SkeletonEntry = SkeletonPairing | SkeletonExemption;

export function isExempt(entry: SkeletonEntry): entry is SkeletonExemption {
  return "exempt" in entry;
}

/**
 * The map. One entry per master component, no silent gaps.
 *
 * Keyed by the exported name rather than by file, because the export is what a
 * screen imports and what the contract test can enumerate from the barrel.
 */
export const SKELETON_MAP = {
  /*
   * `Button` and `Tabs` used to map to `Shimmer` and `SkeletonText` while their
   * `imitates` line described a touch-height control and a bordered tab track.
   * The prose described the *story*; the mapped shape drew a plain bar. Two
   * named shapes now draw what the sentences claim, so the map and the pixels
   * say the same thing and the contract test can render the mapped shape and
   * check it.
   */
  Button: {
    shape: "SkeletonControl",
    story: "SkeletonButton",
    imitates: "the control's 44px touch height and its 8px corner, at its real width",
  },
  Badge: {
    shape: "Shimmer",
    story: "SkeletonBadge",
    imitates: "the 4px-cornered chip at label height - the one case a plain bar is the shape",
  },
  Card: {
    shape: "SkeletonCard",
    story: "SkeletonCardPairing",
    imitates: "the border, the 12px corner, the header grid and the body's line count",
  },
  Tabs: {
    shape: "SkeletonTabStrip",
    story: "SkeletonTabs",
    imitates: "the bordered, muted track and its triggers at touch height",
  },
  Progress: {
    shape: "Shimmer",
    story: "SkeletonProgress",
    imitates: "the thin track at full width, before a value is known",
  },
  Skeleton: {
    shape: "SkeletonText",
    story: "SkeletonShapes",
    imitates: "itself: the live region that names what is loading",
  },
  Sheet: {
    shape: "SkeletonList",
    story: "SkeletonSheet",
    imitates: "the panel's stacked rows while its contents are fetched",
  },
  Tooltip: {
    exempt: "on-demand",
    reason:
      "Opens on hover or focus and only ever shows text the page already has. There is no moment at which a tooltip is present and its content is still loading.",
  },
  TooltipTrigger: {
    exempt: "structural",
    reason: "Renders its child; the child carries whatever loading state it has.",
  },
  TooltipContent: {
    exempt: "on-demand",
    reason: "Same as Tooltip: portalled content that only exists after a gesture.",
  },
  TooltipProvider: {
    exempt: "structural",
    reason: "Renders no box of its own; it carries the shared delay configuration.",
  },
  Separator: {
    exempt: "structural",
    reason:
      "A one-pixel rule. A shimmering hairline is noise, and the regions it divides carry their own skeletons.",
  },
  SheetTrigger: {
    exempt: "structural",
    reason: "Renders its child, which is a Button and is paired above.",
  },
  SheetClose: { exempt: "structural", reason: "Renders its child, usually an icon button." },
  SheetTitle: {
    exempt: "structural",
    reason: "Text inside SheetContent, covered by the sheet's own pairing.",
  },
  SheetDescription: {
    exempt: "structural",
    reason: "Text inside SheetContent, covered by the sheet's own pairing.",
  },
  SheetContent: {
    exempt: "structural",
    reason: "The Sheet pairing above is this element's pairing; they are one surface.",
  },
  SheetOverlay: { exempt: "structural", reason: "A backdrop. It has no content to load." },
  SheetHeader: { exempt: "structural", reason: "Layout slot inside SheetContent." },
  SheetBody: { exempt: "structural", reason: "Layout slot inside SheetContent." },
  SheetFooter: { exempt: "structural", reason: "Layout slot inside SheetContent." },
  CardHeader: { exempt: "structural", reason: "Layout slot; SkeletonCard draws it." },
  CardTitle: { exempt: "structural", reason: "Layout slot; SkeletonCard draws it." },
  CardDescription: { exempt: "structural", reason: "Layout slot; SkeletonCard draws it." },
  CardAction: { exempt: "structural", reason: "Layout slot; SkeletonCard draws it." },
  CardContent: { exempt: "structural", reason: "Layout slot; SkeletonCard draws it." },
  CardFooter: { exempt: "structural", reason: "Layout slot; SkeletonCard draws it." },
  TabsList: { exempt: "structural", reason: "Layout slot; the Tabs pairing draws it." },
  TabsTrigger: { exempt: "structural", reason: "Layout slot; the Tabs pairing draws it." },
  TabsContent: { exempt: "structural", reason: "Layout slot; the Tabs pairing draws it." },
  Shimmer: {
    exempt: "structural",
    reason: "It is the skeleton primitive; every shape below is built from it.",
  },
  SkeletonText: {
    exempt: "structural",
    reason:
      "It is a skeleton shape. A loading state for a loading state would be an infinite regress, and there is nothing behind it to wait for.",
  },
  SkeletonCard: {
    exempt: "structural",
    reason:
      "It is a skeleton shape; it is the loading state of Card, and is paired from that side of the map.",
  },
  SkeletonTable: {
    exempt: "structural",
    reason:
      "It is a skeleton shape; it is what a data table shows while its rows are on the wire.",
  },
  SkeletonChart: {
    exempt: "structural",
    reason:
      "It is a skeleton shape; the analytics section pairs it, and a chart engine is never behind it.",
  },
  SkeletonForm: {
    exempt: "structural",
    reason:
      "It is a skeleton shape; a form's fields are rendered from a schema the client already holds.",
  },
  SkeletonMedia: {
    exempt: "structural",
    reason:
      "It is a skeleton shape; the media library pairs it when its thumbnails are being fetched.",
  },
  SkeletonList: {
    exempt: "structural",
    reason:
      "It is a skeleton shape; the Sheet pairing uses it for a panel's stacked rows.",
  },
  SkeletonControl: {
    exempt: "structural",
    reason:
      "It is a skeleton shape; it is what Button maps to, and is paired from that side of the map.",
  },
  SkeletonTabStrip: {
    exempt: "structural",
    reason:
      "It is a skeleton shape; it is what Tabs maps to, and is paired from that side of the map.",
  },
  DropdownMenu: {
    exempt: "on-demand",
    reason:
      "Opens on a click and only ever shows menu rows this client already has synchronously — real identity, static settings/help destinations. There is no moment at which it is present and its content is still loading.",
  },
  DropdownMenuTrigger: {
    exempt: "structural",
    reason: "Renders its child, which is the drawer's footer account button and is paired above.",
  },
  DropdownMenuContent: {
    exempt: "on-demand",
    reason: "Same as DropdownMenu: portalled content that only exists after a gesture.",
  },
  DropdownMenuGroup: {
    exempt: "structural",
    reason: "Layout slot inside DropdownMenuContent; the menu's own exemption covers it.",
  },
  DropdownMenuItem: {
    exempt: "structural",
    reason: "A row inside DropdownMenuContent; the menu's own on-demand exemption covers it.",
  },
  DropdownMenuLabel: {
    exempt: "structural",
    reason: "Layout slot inside DropdownMenuContent; the menu's own exemption covers it.",
  },
  DropdownMenuSeparator: {
    exempt: "structural",
    reason: "A one-pixel rule inside the menu; nothing here loads independently of the menu.",
  },
  DropdownMenuPortal: {
    exempt: "structural",
    reason: "Renders its children into a portal; carries no content of its own.",
  },
  buttonVariants: { exempt: "structural", reason: "A class recipe, not a component." },
  badgeVariants: { exempt: "structural", reason: "A class recipe, not a component." },
} as const satisfies Record<string, SkeletonEntry>;

export type MappedComponent = keyof typeof SKELETON_MAP;

/**
 * The cognitive cockpit's own shape-matched skeleton, registered separately.
 *
 * `CognitiveCockpitDashboard` is not exported from this master `ui` barrel -
 * it lives in `src/components/cognitive-cockpit`, a product-level master
 * surface rather than a `ui` primitive - so pairing it inside `SKELETON_MAP`
 * would fail `skeleton-contract.test.tsx`'s "maps nothing that is not
 * exported" check, which enumerates this barrel exactly. This entry records
 * the same pairing the RED contract for the cockpit checks for: the dashboard
 * has a named, shape-matched skeleton before it is integrated anywhere.
 */
export const CROSS_BARREL_SKELETON_PAIRINGS = {
  CognitiveCockpitDashboard: "CognitiveCockpitSkeleton",
} as const satisfies Record<string, string>;
