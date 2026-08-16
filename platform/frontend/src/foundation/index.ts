/**
 * Clean foundation — the W0 clean-room primitive layer for `/panel`.
 *
 * Built directly on React Router, Radix primitives and this product's design
 * tokens. Nothing here wraps, re-exports or imports the old `@/components`
 * system; it is a separate, small layer owned by the cognitive cockpit
 * package and anything else that chooses to build on it.
 */

import "./foundation.css";

export { Button, buttonVariants, type ButtonVariantProps } from "./button";
export { Badge, badgeVariants, type BadgeProps, type BadgeVariantProps } from "./badge";
export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetTitle,
  SheetOverlay,
  SheetContent,
  SheetHeader,
  SheetBody,
  type SheetSide,
} from "./sheet";
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "./dropdown-menu";
export {
  Shimmer,
  Skeleton,
  SkeletonControl,
  SkeletonCard,
  SkeletonTable,
  SkeletonList,
  SkeletonChart,
  type SkeletonProps,
  type SkeletonControlProps,
  type SkeletonCardProps,
  type SkeletonTableProps,
  type SkeletonListProps,
  type SkeletonChartProps,
} from "./skeleton";
export {
  EmptyState,
  ErrorState,
  OfflineBanner,
  PartialDataNotice,
  type EmptyStateProps,
  type ErrorStateProps,
  type OfflineBannerProps,
  type PartialDataNoticeProps,
} from "./states";
export { Link, type LinkProps } from "./link";
export {
  FoundationIcon,
  FOUNDATION_ICON_SIZE,
  type FoundationIconName,
  type FoundationIconProps,
} from "./icons";
