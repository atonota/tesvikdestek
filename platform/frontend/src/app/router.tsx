/**
 * Route table.
 *
 * Every route here is backed by a real endpoint, or by a surface that says
 * plainly what it cannot do. A route that renders a plausible empty screen is
 * a lie with a URL, and that rule has not moved; what has moved is the reading
 * of "backed by". A capability whose backend is absent may have a route when
 * the route's whole job is to show the operator what exists, what is refused
 * and why - the file library and the AI provider centre are exactly that, and
 * both keep every control that would need a server disabled with its reason on
 * screen.
 *
 * The private half of the table sits behind one pathless boundary rather than
 * behind a check repeated per route. That is the difference between a rule and
 * a habit: a new workspace route added inside those children is guarded because
 * of where it is, not because somebody remembered.
 */

import {
  Navigate,
  createBrowserRouter,
  createMemoryRouter,
  Outlet,
  type RouteObject,
} from "react-router";

/**
 * The boot fallback and the error boundary, from the one module that may be
 * eager.
 *
 * Nothing here may reach `@/components`. This file is imported by the entry, so
 * its import graph is what every visitor downloads before choosing a route -
 * and the barrel re-exports the entire design system. `boot-surface.tsx`
 * records the measurement that settled it.
 */
import { BootFallback, NotFoundRoute, RouteErrorBoundary } from "@/routes/boot-surface";

/**
 * Every route is code-split.
 *
 * An anonymous visitor should not download the decision workspace, and the
 * workspace is where the weight is (tables, tri-state forms, trace rendering).
 * `lazy` is React Router's own mechanism, so the router still owns the loading
 * state rather than a Suspense boundary bolted on top.
 *
 * Nothing here may *also* be imported statically: a module that is both
 * statically and dynamically imported silently collapses back into the main
 * chunk, which is how code splitting quietly stops working.
 */
const publicModule = () => import("@/routes/public");
const authModule = () => import("@/routes/auth");
const appModule = () => import("@/routes/app");
/**
 * The W0 clean-room boundary: `/panel` and its session gate, each its own
 * module loader so the route table never resolves them through `app.tsx` and
 * its old visual component graph.
 */
const panelModule = () => import("@/routes/panel");
const workspaceGateModule = () => import("@/routes/workspace-gate");
/**
 * Two centres that carry their own stylesheet - and, for one of them, its code.
 *
 * They are separate modules rather than more exports of `app.tsx` for a reason
 * that is measured rather than aesthetic: each imports a stylesheet the eleven
 * other workspace screens have no use for, and kept in `app.tsx` those rules
 * would land in the chunk every signed-in visitor downloads on their way to the
 * dashboard.
 *
 * The two are not symmetrical, and saying they were would be a claim the build
 * contradicts. **Provider connections are lazy in both halves**: the subsystem
 * is not re-exported from `@/components`, so its JavaScript *and* its CSS reach
 * only the person who opens `/ayarlar/yapay-zeka`, and
 * `build-contract.test.ts` proves the JavaScript half against the built entry
 * chunk. **The media library is lazy in its stylesheet only**: `@/components`
 * re-exports `./media`, every route imports that barrel, so the media
 * components are in the shared component chunk whatever this route table does.
 * That re-export is a pinned contract, not an oversight, and this comment
 * records its cost rather than pretending it away.
 */
const mediaModule = () => import("@/routes/media");
const providersModule = () => import("@/routes/providers");

type PublicExport = keyof Awaited<ReturnType<typeof publicModule>>;
type AuthExport = keyof Awaited<ReturnType<typeof authModule>>;
type AppExport = keyof Awaited<ReturnType<typeof appModule>>;
type MediaExport = keyof Awaited<ReturnType<typeof mediaModule>>;
type ProvidersExport = keyof Awaited<ReturnType<typeof providersModule>>;
type PanelExport = keyof Awaited<ReturnType<typeof panelModule>>;
type WorkspaceGateExport = keyof Awaited<ReturnType<typeof workspaceGateModule>>;

const fromPublic = (name: PublicExport) => async () => ({
  Component: (await publicModule())[name] as React.ComponentType,
});
const fromAuth = (name: AuthExport) => async () => ({
  Component: (await authModule())[name] as React.ComponentType,
});
const fromApp = (name: AppExport) => async () => ({
  Component: (await appModule())[name] as React.ComponentType,
});
const fromMedia = (name: MediaExport) => async () => ({
  Component: (await mediaModule())[name] as React.ComponentType,
});
const fromProviders = (name: ProvidersExport) => async () => ({
  Component: (await providersModule())[name] as React.ComponentType,
});
const fromPanel = (name: PanelExport) => async () => ({
  Component: (await panelModule())[name] as React.ComponentType,
});
const fromWorkspaceGate = (name: WorkspaceGateExport) => async () => ({
  Component: (await workspaceGateModule())[name] as React.ComponentType,
});

/* --------------------------------------------------------- route registry */

export type RouteAccess = "public" | "auth" | "workspace";

export interface RegisteredRoute {
  /** The full path, exactly as it appears in the address bar. */
  readonly path: string;
  readonly access: RouteAccess;
  /** Carries a URL parameter, so there is no single address to visit. */
  readonly parameterised?: boolean;
  /** Renders nothing of its own; it sends the reader to another path. */
  readonly redirect?: boolean;
}

/**
 * Every address this application answers, declared once.
 *
 * This list exists because "is the product complete?" was, until now, a
 * question nobody could answer mechanically. Two finished subsystems had no
 * route at all; two settings screens had routes and no link; two section paths
 * 404'd; and the accessibility sweep scanned eleven of the destinations while
 * the router published more than twenty. Each of those is the same failure -
 * the route table and the claims made about it drifted, and nothing compared
 * them.
 *
 * `route-registry.test.ts` compares them. It walks the real `routes` tree and
 * fails if this list and that tree disagree in either direction, fails if a
 * path classified `workspace` is not actually inside the session boundary, and
 * fails if a static route is missing from the browser accessibility sweep. So
 * adding a route means adding it here, and adding it here means it gets
 * scanned - neither is a step anyone can quietly skip.
 */
export const ROUTE_REGISTRY: readonly RegisteredRoute[] = [
  { path: "/", access: "public" },
  { path: "/nasil-calisir", access: "public" },
  { path: "/programlar", access: "public" },
  { path: "/programlar/:code", access: "public", parameterised: true },
  { path: "/onboarding", access: "public" },

  { path: "/kayit", access: "auth" },
  { path: "/giris", access: "auth" },

  { path: "/panel", access: "workspace" },
  { path: "/firsatlar", access: "workspace" },
  { path: "/firsatlar/:code", access: "workspace", parameterised: true },
  { path: "/kaynaklar", access: "workspace" },
  { path: "/kaynaklar/:id", access: "workspace", parameterised: true },
  { path: "/uygunluk", access: "workspace" },
  { path: "/uygunluk/sihirbaz", access: "workspace" },
  { path: "/degerlendirmeler", access: "workspace" },
  { path: "/degerlendirmeler/karsilastir", access: "workspace" },
  { path: "/degerlendirmeler/:id", access: "workspace", parameterised: true },
  { path: "/organizasyon", access: "workspace", redirect: true },
  { path: "/organizasyon/profil", access: "workspace" },
  { path: "/organizasyon/hazirlik", access: "workspace" },
  { path: "/olgunluk", access: "workspace" },
  { path: "/operasyon/saglik", access: "workspace" },
  { path: "/yetenekler", access: "workspace" },
  { path: "/dosyalar", access: "workspace" },
  { path: "/ayarlar", access: "workspace", redirect: true },
  { path: "/ayarlar/gorunum", access: "workspace" },
  { path: "/ayarlar/erisilebilirlik", access: "workspace" },
  { path: "/ayarlar/guvenlik", access: "workspace" },
  { path: "/ayarlar/yapay-zeka", access: "workspace" },
];

/** The addresses a browser test can simply visit: no parameter, no redirect. */
export const STATIC_ROUTES: readonly RegisteredRoute[] = ROUTE_REGISTRY.filter(
  (route) => route.parameterised !== true && route.redirect !== true,
);

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <Outlet />,
    hydrateFallbackElement: <BootFallback />,
    errorElement: <RouteErrorBoundary />,
    children: [
      // public
      { index: true, lazy: fromPublic("LandingRoute") },
      { path: "nasil-calisir", lazy: fromPublic("HowItWorksRoute") },
      { path: "programlar", lazy: fromPublic("PublicCatalogRoute") },
      { path: "programlar/:code", lazy: fromPublic("PublicProgramDetailRoute") },
      { path: "onboarding", lazy: fromPublic("OnboardingRoute") },

      // auth
      { path: "kayit", lazy: fromAuth("RegisterRoute") },
      { path: "giris", lazy: fromAuth("LoginRoute") },

      /*
       * The workspace, behind one session boundary.
       *
       * A pathless route: it owns no URL of its own and contributes nothing to
       * any address, so the private paths read exactly as they did before. What
       * it owns is the answer to "is there a session?", asked once per
       * navigation into this subtree. Before it existed, an anonymous visitor
       * opening `/panel` was handed the signed-in shell - private navigation,
       * a "Çıkış" button, a page title - with a generic failure card in the
       * middle of it, because the only thing that noticed the missing session
       * was the query that happened to run inside the page.
       *
       * `/organizasyon` and `/ayarlar` are sections rather than screens, so
       * each redirects to its own first screen instead of 404ing. `replace` is
       * deliberate: a redirect that pushes leaves the reader unable to go back
       * past it.
       */
      {
        lazy: fromWorkspaceGate("WorkspaceGate"),
        children: [
          { path: "panel", lazy: fromPanel("DashboardRoute") },
          { path: "firsatlar", lazy: fromApp("OpportunitiesRoute") },
          { path: "firsatlar/:code", lazy: fromApp("OpportunityDetailRoute") },
          { path: "kaynaklar", lazy: fromApp("SourceRegistryRoute") },
          { path: "kaynaklar/:id", lazy: fromApp("SourceDetailRoute") },
          { path: "uygunluk", lazy: fromApp("DecisionsRoute") },
          { path: "uygunluk/sihirbaz", lazy: fromApp("WizardRoute") },
          { path: "degerlendirmeler", lazy: fromApp("DecisionsRoute") },
          { path: "degerlendirmeler/karsilastir", lazy: fromApp("DecisionCompareRoute") },
          { path: "degerlendirmeler/:id", lazy: fromApp("DecisionDetailRoute") },
          { path: "organizasyon", element: <Navigate to="/organizasyon/profil" replace /> },
          { path: "organizasyon/profil", lazy: fromApp("ProfileRoute") },
          { path: "organizasyon/hazirlik", lazy: fromApp("ReadinessRoute") },
          { path: "olgunluk", lazy: fromApp("MaturityRoute") },
          { path: "operasyon/saglik", lazy: fromApp("OpsHealthRoute") },
          { path: "yetenekler", lazy: fromApp("CapabilityMatrixRoute") },
          { path: "dosyalar", lazy: fromMedia("MediaRoute") },
          { path: "ayarlar", element: <Navigate to="/ayarlar/gorunum" replace /> },
          { path: "ayarlar/gorunum", lazy: fromApp("AppearanceSettingsRoute") },
          { path: "ayarlar/erisilebilirlik", lazy: fromApp("AccessibilitySettingsRoute") },
          { path: "ayarlar/guvenlik", lazy: fromApp("SecuritySettingsRoute") },
          { path: "ayarlar/yapay-zeka", lazy: fromProviders("ProviderConnectionsRoute") },
        ],
      },

      { path: "*", element: <NotFoundRoute /> },
    ],
  },
];

/**
 * Production router.
 *
 * The basename follows Vite's `base`, so the mount point is decided once, at
 * build time, instead of being restated here and drifting from it.
 */
export function createAppRouter() {
  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/u, "");
  return createBrowserRouter(routes, { basename: base === "" ? "/" : base });
}

/** Used by tests; no basename so paths read naturally in assertions. */
export function createTestRouter(initialPath: string) {
  return createMemoryRouter(routes, { initialEntries: [initialPath] });
}
