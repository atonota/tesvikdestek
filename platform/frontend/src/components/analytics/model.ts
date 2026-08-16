/**
 * Re-exported from the neutral domain module.
 *
 * The distribution maths and types now live at `@/domain/analytics`, reached
 * directly by the clean-room cognitive cockpit. This module stays as the
 * transition path for the older analytics surfaces (`PortfolioAnalytics`,
 * `analytics.test.tsx`) that still import from `./model`.
 */

export * from "@/domain/analytics";
