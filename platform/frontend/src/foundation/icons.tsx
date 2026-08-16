/**
 * Clean foundation icons — the installed Phosphor vocabulary, direct.
 *
 * The product's icon set is Phosphor (`master-stack-contract.test.ts` pins
 * the dependency); this module is the W0 clean-room's own import point for
 * it, separate from `@/components/icons` so the `/panel` route graph never
 * reaches `@/components`. No hand-drawn SVG element and no typographic glyph
 * stands in for a real icon here — `w0-clean-panel-boundary.test.ts` pins
 * both: this file must import from the Phosphor package and must not declare
 * a raw vector-drawing element of its own.
 *
 * Every glyph is decorative (`aria-hidden`) by default; the control around it
 * always carries the real, JSON-authored accessible name. Passing `label`
 * renders the icon as the accessible content instead, for the rare case
 * where an icon stands with no adjacent text.
 */

import {
  ArrowSquareOut,
  Bell,
  CaretDown,
  List,
  MagnifyingGlass,
  X,
  type Icon,
  type IconProps,
} from "@phosphor-icons/react";

export type { Icon, IconProps };

/** The chrome glyphs the clean cockpit needs, named for their role here. */
const ICONS = {
  close: X,
  menu: List,
  search: MagnifyingGlass,
  notifications: Bell,
  expand: CaretDown,
  externalLink: ArrowSquareOut,
} as const satisfies Record<string, Icon>;

export type FoundationIconName = keyof typeof ICONS;

/** `1em`-relative, so an icon beside a label grows with the font-scale setting. */
export const FOUNDATION_ICON_SIZE = "1.25em";

export interface FoundationIconProps extends Omit<IconProps, "ref"> {
  readonly name: FoundationIconName;
  /** The accessible name, when the icon is the only content. */
  readonly label?: string;
}

export function FoundationIcon({
  name,
  label,
  size = FOUNDATION_ICON_SIZE,
  weight,
  ...rest
}: FoundationIconProps) {
  const Glyph = ICONS[name];
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
