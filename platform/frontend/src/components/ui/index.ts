/**
 * The master component layer's public surface.
 *
 * Deliberately NOT re-exported from `@/components`. That barrel already exports
 * a `Button`, a `Card`, a `Badge` and a `Tabs` - the product-level components
 * that are *built on* these - and merging the two namespaces would give one
 * name two meanings resolved by import order.
 *
 * The derived layer imports these by path. Screens import the derived layer, or
 * import from here directly when they want the composition rather than the
 * product wrapper.
 */

export { Button, buttonVariants, type ButtonVariantProps } from "./button";
export { Badge, badgeVariants, type BadgeVariantProps } from "./badge";
export {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card";
export { Progress } from "./progress";
export { Separator } from "./separator";
export {
  Shimmer,
  Skeleton,
  SkeletonCard,
  SkeletonControl,
  SkeletonChart,
  SkeletonForm,
  SkeletonList,
  SkeletonMedia,
  SkeletonTable,
  SkeletonTabStrip,
  SkeletonText,
  type SkeletonCardProps,
  type SkeletonControlProps,
  type SkeletonChartProps,
  type SkeletonFormProps,
  type SkeletonListProps,
  type SkeletonMediaProps,
  type SkeletonProps,
  type SkeletonTableProps,
  type SkeletonTabStripProps,
  type SkeletonTextProps,
} from "./skeleton";
export { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";
export {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetTitle,
  SheetTrigger,
  type SheetSide,
} from "./sheet";
export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";
