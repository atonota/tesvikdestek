/**
 * The icon layer — Phosphor, through one adapter.
 *
 * shadcn/ui ships wired to Lucide. This product's icon set is Phosphor, so the
 * substitution is made once, here, rather than in every component that draws an
 * icon. `master-stack-contract.test.ts` enforces that: nothing else in `src/`
 * may import `@phosphor-icons/react`, and nothing anywhere may import Lucide.
 *
 * Two things this indirection buys that a direct import does not:
 *
 *  - **A checked inventory.** The set below is the icon vocabulary of the
 *    product. Adding an icon is a visible edit to a named list rather than an
 *    import appearing in a component nobody reviews, which is how icon sets
 *    grow to four hundred glyphs with six near-duplicates for "user".
 *  - **One decision about weight and size.** Phosphor's weights carry meaning
 *    at these sizes: `regular` is the interface default, and `fill` is reserved
 *    for the selected state of a navigation item, where a weight change is a
 *    second, non-colour carrier of "you are here".
 *
 * The icons replace typographic glyphs (`◧`, `▤`, `❖`, `☰`, `✕`) that were
 * standing in for them. Those characters render differently on every platform,
 * are missing from several Android system fonts, and are read aloud by a screen
 * reader as their Unicode names when they are not hidden. Every icon here is
 * `aria-hidden` by default and is named by the text beside it.
 */

import {
  Archive,
  ArrowClockwise,
  ArrowRight,
  Bell,
  Buildings,
  CalendarBlank,
  CaretDown,
  CaretRight,
  ChartBar,
  ChartLineUp,
  ChartPieSlice,
  Check,
  CheckCircle,
  ClipboardText,
  Clock,
  FolderOpen,
  Gauge,
  GearSix,
  Heartbeat,
  Info,
  Lightning,
  List,
  ListChecks,
  Lock,
  MagnifyingGlass,
  Prohibit,
  PuzzlePiece,
  SignOut,
  Sparkle,
  Table,
  Target,
  Users,
  Warning,
  WarningCircle,
  WifiSlash,
  X,
  type Icon,
  type IconProps,
  type IconWeight,
} from "@phosphor-icons/react";

export type { Icon, IconProps, IconWeight };

/**
 * The product's icon vocabulary, by role rather than by picture.
 *
 * Named for what the icon *means* here, not for what it draws. A rename in
 * Phosphor then costs one line in this file instead of a search across the
 * codebase, and a reviewer reading `Icons.readiness` learns something a
 * reviewer reading `ClipboardText` does not.
 */
export const Icons = {
  /* navigation */
  dashboard: Gauge,
  decisions: ListChecks,
  opportunities: Target,
  sources: Archive,
  readiness: ClipboardText,
  maturity: ChartLineUp,
  health: Heartbeat,
  files: FolderOpen,
  capabilities: PuzzlePiece,
  settings: GearSix,

  /* chrome */
  menu: List,
  close: X,
  next: CaretRight,
  expand: CaretDown,
  search: MagnifyingGlass,
  signOut: SignOut,
  organisation: Buildings,
  people: Users,
  assistant: Sparkle,
  refresh: ArrowClockwise,
  go: ArrowRight,
  notifications: Bell,

  /* state and meaning */
  info: Info,
  warning: Warning,
  error: WarningCircle,
  confirmed: CheckCircle,
  check: Check,
  denied: Lock,
  blocked: Prohibit,
  offline: WifiSlash,

  /* domain */
  deadline: CalendarBlank,
  elapsed: Clock,
  quickAction: Lightning,
  chartBar: ChartBar,
  chartPie: ChartPieSlice,
  table: Table,
} as const satisfies Record<string, Icon>;

export type IconName = keyof typeof Icons;

/**
 * The default icon size, in the same unit the type scale uses.
 *
 * `1em` rather than a pixel count: an icon beside a label should grow with the
 * label, and this product has a font-scale setting that makes that literal. A
 * fixed 16px icon next to 1.125rem text at the "large" setting looks like a
 * mistake, because it is one.
 */
export const ICON_SIZE = "1.25em";

export interface AppIconProps extends Omit<IconProps, "ref"> {
  readonly name: IconName;
  /**
   * The accessible name, when the icon is the only content.
   *
   * Left off, the icon is decoration and is hidden from the accessibility tree
   * - which is correct beside a text label and wrong when it stands alone.
   */
  readonly label?: string;
}

/** Renders one icon from the vocabulary above, hidden unless it is named. */
export function AppIcon({ name, label, size = ICON_SIZE, weight, ...rest }: AppIconProps) {
  const Glyph = Icons[name];
  return (
    <Glyph
      size={size}
      weight={weight ?? "regular"}
      {...(label === undefined
        ? { "aria-hidden": true, focusable: false }
        : { role: "img", "aria-label": label })}
      {...rest}
    />
  );
}
