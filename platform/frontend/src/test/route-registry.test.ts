/**
 * The completeness contract: routes, and what is said about them.
 *
 * Every defect this file guards against was, at the time it shipped, invisible
 * to a suite of a thousand passing tests - because each one was a gap *between*
 * two things that were individually fine:
 *
 *   - The media and provider subsystems were complete, covered and had no
 *     route. Nothing compared "what this product can render" with "what this
 *     product publishes an address for".
 *   - `/ayarlar/erisilebilirlik` and `/ayarlar/guvenlik` had routes and no link
 *     from anywhere. Nothing compared the route table with the navigation.
 *   - `/organizasyon` and `/ayarlar` 404'd, because the sections existed only
 *     as prefixes of their children.
 *   - The accessibility sweep scanned eleven destinations while the router
 *     published more than twenty. Nothing compared the sweep with the table.
 *   - Fourteen registered components were rendered by nothing. Nothing recorded
 *     whether that was a decision or an oversight.
 *
 * So this file only ever compares one declared thing against another declared
 * thing, and never restates either. It owns no list of its own.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import type { RouteObject } from "react-router";
import { describe, expect, it } from "vitest";

import {
  ROUTE_REGISTRY,
  STATIC_ROUTES,
  routes,
  type RegisteredRoute,
} from "@/app/router";
import {
  ALL_COMPONENT_NAMES,
  CLASSIFIED_COMPONENT_SURFACES,
  COMPONENT_SURFACES,
  STORYBOOK_ONLY_COMPONENTS,
  SUBSYSTEM_BARRELS,
  SUBSYSTEM_COMPONENT_SURFACES,
} from "@/components/registry";
import { CAPABILITIES } from "@/domain/capabilities";

const ROOT = process.cwd();

/* ------------------------------------------------ walking the real table */

interface WalkedRoute {
  readonly path: string;
  /** Was this route declared inside the pathless session boundary? */
  readonly guarded: boolean;
}

/**
 * The routes the router really publishes, read off the tree rather than
 * restated.
 *
 * A pathless route contributes no segment and is not itself an address - it is
 * how the session boundary wraps a subtree - so walking it sets `guarded` for
 * everything below and adds nothing of its own. The `*` catch-all is not an
 * address either.
 */
function walk(nodes: readonly RouteObject[], prefix: string, guarded: boolean): WalkedRoute[] {
  const found: WalkedRoute[] = [];
  for (const node of nodes) {
    const segment = node.path ?? "";
    const isPathless = node.path === undefined;
    const full = isPathless
      ? prefix
      : segment.startsWith("/")
        ? segment
        : `${prefix === "/" ? "" : prefix}/${segment}`;

    if (!isPathless && segment !== "*" && segment !== "") {
      found.push({ path: full, guarded });
    }
    if (node.index === true) {
      found.push({ path: prefix === "" ? "/" : prefix, guarded });
    }
    if (node.children) {
      found.push(...walk(node.children, full, guarded || isPathless));
    }
  }
  return found;
}

const WALKED = walk(routes, "", false);
const walkedPaths = WALKED.map((route) => route.path).sort();
const registeredPaths = ROUTE_REGISTRY.map((route) => route.path).sort();

describe("the walk itself sees the table it is supposed to see", () => {
  it("finds more than twenty addresses", () => {
    // A guard that silently walks nothing agrees with everything.
    expect(WALKED.length).toBeGreaterThan(20);
  });

  it("finds the landing page and the deepest settings screen", () => {
    expect(walkedPaths).toContain("/");
    expect(walkedPaths).toContain("/ayarlar/yapay-zeka");
  });
});

describe("the route registry and the route table agree", () => {
  it("declares every address the router publishes", () => {
    const undeclared = walkedPaths.filter((path) => !registeredPaths.includes(path));
    expect(undeclared, "yönlendiricide olup kayıtta olmayan adresler").toEqual([]);
  });

  it("publishes every address the registry declares", () => {
    const unpublished = registeredPaths.filter((path) => !walkedPaths.includes(path));
    expect(unpublished, "kayıtta olup yönlendiricide olmayan adresler").toEqual([]);
  });

  it("registers no duplicate path", () => {
    expect(new Set(registeredPaths).size).toBe(registeredPaths.length);
  });
});

describe("everything classified as workspace is really behind the session boundary", () => {
  const accessOf = (path: string): RegisteredRoute["access"] =>
    (ROUTE_REGISTRY.find((route) => route.path === path) as RegisteredRoute).access;

  it("guards every workspace route", () => {
    const unguarded = WALKED.filter(
      (route) => accessOf(route.path) === "workspace" && !route.guarded,
    ).map((route) => route.path);
    expect(unguarded, "korumasız çalışma alanı rotaları").toEqual([]);
  });

  it("guards nothing that is meant to be reachable without a session", () => {
    const overGuarded = WALKED.filter(
      (route) => accessOf(route.path) !== "workspace" && route.guarded,
    ).map((route) => route.path);
    expect(overGuarded, "gereksiz yere korunan kamu/kimlik rotaları").toEqual([]);
  });

  it("keeps the login and registration screens outside the boundary", () => {
    // Otherwise signing in would require being signed in.
    for (const path of ["/giris", "/kayit"]) {
      expect(WALKED.find((route) => route.path === path)?.guarded).toBe(false);
    }
  });
});

describe("every workspace route is reachable from a navigation, not just typeable", () => {
  const linkedPaths = (): string[] => {
    const app = readFileSync(join(ROOT, "src", "routes", "app.tsx"), "utf8");
    return [...app.matchAll(/to:\s*"(\/[^"]*)"/gu)].map((match) => match[1] as string);
  };

  it("links every non-parameterised workspace screen from the main or a section nav", () => {
    const linked = new Set(linkedPaths());
    const orphans = ROUTE_REGISTRY.filter(
      (route) =>
        route.access === "workspace" &&
        route.parameterised !== true &&
        route.redirect !== true &&
        !linked.has(route.path) &&
        // A detail screen reached from its own list is not an orphan; these two
        // are reached from the decision list and the dashboard respectively.
        !["/uygunluk", "/uygunluk/sihirbaz", "/degerlendirmeler/karsilastir"].includes(route.path),
    ).map((route) => route.path);
    expect(orphans, "hiçbir gezinmeden bağlanmayan rotalar").toEqual([]);
  });

  it("links nowhere that the router does not publish", () => {
    const dangling = linkedPaths().filter((path) => !registeredPaths.includes(path));
    expect(dangling, "var olmayan adrese giden gezinme bağlantıları").toEqual([]);
  });
});

describe("the capability ledger and the route table describe the same product", () => {
  it("names a real route for every capability that claims one", () => {
    const claimed = CAPABILITIES.map((capability) => capability.route).filter(
      (route): route is string => typeof route === "string",
    );
    const missing = claimed.filter((route) => !registeredPaths.includes(route));
    expect(missing, "yetenek kütüğünde olup yönlendiricide olmayan rotalar").toEqual([]);
  });

  it("has a ledger entry for every workspace screen", () => {
    const ledgered = new Set(
      CAPABILITIES.map((capability) => capability.route).filter(Boolean),
    );
    const unledgered = ROUTE_REGISTRY.filter(
      (route) =>
        route.access === "workspace" &&
        route.redirect !== true &&
        !ledgered.has(route.path) &&
        /*
         * Three named exemptions, and only three.
         *
         * `/uygunluk` is a second address for the decision workspace, which the
         * ledger already carries under `/degerlendirmeler`; a second entry
         * would double-count one capability. The two appearance and
         * accessibility settings screens are local preferences written to this
         * browser - there is no backend contract for the ledger to record about
         * them, and inventing one would be padding.
         */
        !["/uygunluk", "/ayarlar/gorunum", "/ayarlar/erisilebilirlik"].includes(route.path),
    ).map((route) => route.path);
    expect(unledgered, "yetenek kütüğünde karşılığı olmayan çalışma alanı rotaları").toEqual([]);
  });
});

describe("the browser accessibility sweep covers every static route", () => {
  const accessibilitySpec = (): string =>
    readFileSync(join(ROOT, "e2e", "accessibility.spec.ts"), "utf8");

  const sweptPaths = (): string[] => {
    return [...accessibilitySpec().matchAll(/"\.\/([^"]*)"/gu)].map(
      (match) => `/${match[1] as string}`,
    );
  };

  /**
   * The two sizes the sweep must run at, read off the spec's own list.
   *
   * The owner's requirement is 320x568 and 1440x900, and the spec scanned
   * 1280x900. That is not a rounding difference: 1440 is where this product's
   * desktop layout actually gets its widest columns, and a sweep at 1280 is
   * silent about the one size the owner named. Pinned here rather than in the
   * spec's own file, because a file that both declares and checks its viewport
   * cannot disagree with anything.
   */
  const sweptViewports = (): string[] =>
    [...accessibilitySpec().matchAll(/width:\s*(\d+),\s*height:\s*(\d+)/gu)].map(
      (match) => `${match[1] as string}x${match[2] as string}`,
    );

  it("scans exactly the two viewports the requirement names", () => {
    expect(sweptViewports(), "erişilebilirlik taramasının görünüm boyutları").toEqual([
      "320x568",
      "1440x900",
    ]);
  });

  it("reads the spec's own lists rather than a copy of them", () => {
    expect(sweptPaths().length).toBeGreaterThan(15);
  });

  it("scans every registered static address", () => {
    const swept = new Set(sweptPaths().map((path) => (path === "/" ? "/" : path.replace(/\/$/u, ""))));
    const unscanned = STATIC_ROUTES.map((route) => route.path).filter(
      (path) => !swept.has(path),
    );
    expect(unscanned, "erişilebilirlik taramasında olmayan rotalar").toEqual([]);
  });
});

/* ------------------------------------------- component surface coverage */

const files = (() => {
  const found: string[] = [];
  const walkDir = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walkDir(full);
      else if (/\.tsx?$/u.test(entry)) found.push(full);
    }
  };
  walkDir(join(ROOT, "src"));
  return found;
})();

const isStory = (file: string) => /\.stories\.tsx?$/u.test(file);
const isTestFile = (file: string) =>
  /\.(test|spec)\.tsx?$/u.test(file) ||
  file.startsWith(join(ROOT, "src", "test")) ||
  file.startsWith(join(ROOT, "src", "mocks"));

const RUNTIME_FILES = files.filter((file) => !isStory(file) && !isTestFile(file));
const STORY_FILES = files.filter(isStory);

/**
 * Files in which this component is actually rendered as an element.
 *
 * `<Name<` is matched as well as `<Name` followed by space, `/` or `>`, because
 * a generic component is written `<AppForm<AuthFormValues> …>` and the narrower
 * pattern read that as "not rendered anywhere". It was: by every form in the
 * product. A classification guard that cannot see the real call sites reports
 * the wrong half of the system as dead.
 */
function renderedIn(name: string, list: readonly string[]): string[] {
  const pattern = new RegExp(`<${name}(?:[\\s/>]|<)`, "u");
  return list.filter((file) => pattern.test(readFileSync(file, "utf8")));
}

/* ------------------------------------------- the route-reachable module set */

/**
 * Every module a route can actually reach, followed rather than assumed.
 *
 * "Rendered by a runtime module" was the old bar and it is too low: a component
 * rendered only inside another module that nothing imports is still dead, and
 * it would pass. So the graph is walked from the route table itself, through
 * static and dynamic imports alike, and *that* closure is what "the product
 * renders it" means below.
 */
function resolveImport(specifier: string, fromFile: string): string | null {
  const base = specifier.startsWith("@/")
    ? join(ROOT, "src", specifier.slice(2))
    : specifier.startsWith(".")
      ? join(fromFile, "..", specifier)
      : null;
  if (base === null) return null;
  for (const candidate of [
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function routeReachableModules(): string[] {
  const entry = join(ROOT, "src", "app", "router.tsx");
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    const source = readFileSync(file, "utf8");
    const specifiers = [
      ...[...source.matchAll(/from\s+["']([^"']+)["']/gu)].map((match) => match[1] as string),
      ...[...source.matchAll(/import\(\s*["']([^"']+)["']\s*\)/gu)].map(
        (match) => match[1] as string,
      ),
    ];
    for (const specifier of specifiers) {
      const resolved = resolveImport(specifier, file);
      if (resolved !== null && !seen.has(resolved)) queue.push(resolved);
    }
  }
  return [...seen];
}

const ROUTE_REACHABLE = routeReachableModules().filter(
  (file) => !isStory(file) && !isTestFile(file),
);

/* ------------------------------------------ subsystem classification universe */

/**
 * The PascalCase value exports of one subsystem barrel, read off the barrel.
 *
 * Type-only exports are excluded because a type renders nothing. `export *`
 * lines are followed into the module they name, so a component that arrives
 * through a star re-export cannot slip past the census.
 */
function barrelComponents(barrel: string): string[] {
  const file = join(ROOT, "src", "components", barrel, "index.ts");
  const source = readFileSync(file, "utf8");
  const names: string[] = [];

  for (const match of source.matchAll(/export\s*\{([^}]*)\}/gu)) {
    if (/^export\s+type\s*\{/u.test(match[0])) continue;
    for (const raw of (match[1] as string).split(",")) {
      const part = raw.trim();
      if (part === "" || /^type\s/u.test(part)) continue;
      const name = (part.split(/\s+as\s+/u).pop() ?? "").trim();
      if (name !== "") names.push(name);
    }
  }

  for (const match of source.matchAll(/export\s+\*\s+from\s+["']([^"']+)["']/gu)) {
    const resolved = resolveImport(match[1] as string, file);
    if (resolved === null) throw new Error(`çözülemeyen yeniden dışa aktarım: ${match[0]}`);
    names.push(
      ...[
        ...readFileSync(resolved, "utf8").matchAll(
          /export\s+(?:const|function|class)\s+([A-Za-z0-9_$]+)/gu,
        ),
      ].map((own) => own[1] as string),
    );
  }

  // PascalCase, and with a lowercase letter in it: `MEDIA_CAPABILITIES` is a
  // ledger, not a component, and neither is a bare acronym.
  return names.filter((name) => /^[A-Z][A-Za-z0-9]*$/u.test(name) && /[a-z]/u.test(name));
}

const SUBSYSTEM_EXPORTS = SUBSYSTEM_BARRELS.flatMap(barrelComponents);

describe("the classification universe covers the subsystems too, not just the 75", () => {
  it("reads a real census off every barrel rather than an empty one", () => {
    expect(SUBSYSTEM_BARRELS.length).toBe(5);
    expect(SUBSYSTEM_EXPORTS.length).toBeGreaterThan(20);
  });

  it("classifies exactly the components the five barrels export", () => {
    // Both directions. A new PascalCase export with no classification is the
    // failure this exists for; a classified name that no barrel exports any
    // more is the same drift running the other way.
    expect(Object.keys(SUBSYSTEM_COMPONENT_SURFACES).sort()).toEqual(
      [...SUBSYSTEM_EXPORTS].sort(),
    );
  });

  it("leaves the 75-component registry and its count untouched", () => {
    // The subsystems are classified, not counted. The maturity claim about the
    // core system is a separate contract and this must not inflate it.
    expect(ALL_COMPONENT_NAMES.length).toBe(75);
    for (const name of ALL_COMPONENT_NAMES) {
      expect(SUBSYSTEM_COMPONENT_SURFACES[name], `${name} iki kez sınıflandırıldı`).toBeUndefined();
    }
  });

  it("is the union of both classifications and nothing else", () => {
    expect(Object.keys(CLASSIFIED_COMPONENT_SURFACES).sort()).toEqual(
      [...ALL_COMPONENT_NAMES, ...SUBSYSTEM_EXPORTS].sort(),
    );
  });

  it("walks a route-reachable module set that is real", () => {
    expect(ROUTE_REACHABLE.length).toBeGreaterThan(20);
    expect(ROUTE_REACHABLE).toContain(join(ROOT, "src", "routes", "app.tsx"));
    expect(ROUTE_REACHABLE).toContain(join(ROOT, "src", "components", "templates.tsx"));
  });
});

describe("every classified subsystem component is really on the surface it claims", () => {
  const subsystemNames = () => Object.keys(SUBSYSTEM_COMPONENT_SURFACES);

  it.each(SUBSYSTEM_EXPORTS)("%s is classified at all", (name) => {
    expect(subsystemNames(), `${name} sınıflandırılmadı`).toContain(name);
  });

  // Both route-bearing surfaces, on purpose. `route-gated` weakens the
  // reachability claim not at all - it only says the interaction is closed
  // today - so exempting it here would turn the new value into a way out of
  // this rule rather than a truer description of it.
  it.each(
    SUBSYSTEM_EXPORTS.filter((name) =>
      ["route", "route-gated"].includes(SUBSYSTEM_COMPONENT_SURFACES[name] as string),
    ),
  )("%s is rendered by a module a route can reach", (name) => {
    expect(
      renderedIn(name, ROUTE_REACHABLE).map((file) => file.replace(`${ROOT}/`, "")),
      `${name} ürün yüzeyi olarak sınıflandırıldı ama hiçbir rota zinciri onu render etmiyor`,
    ).not.toEqual([]);
  });

  it.each(
    SUBSYSTEM_EXPORTS.filter((name) => SUBSYSTEM_COMPONENT_SURFACES[name] === "storybook"),
  )("%s is Storybook-only, so it has a story and no route reaches it", (name) => {
    expect(
      renderedIn(name, STORY_FILES).length,
      `${name} hiçbir yerde render edilmiyor: ne üründe ne Storybook'ta`,
    ).toBeGreaterThan(0);
    expect(
      renderedIn(name, ROUTE_REACHABLE).map((file) => file.replace(`${ROOT}/`, "")),
      `${name} artık bir rotadan erişiliyor; sınıflandırmayı "route" olarak güncelleyin`,
    ).toEqual([]);
  });

  it("still adds no component gallery route to make the numbers look better", () => {
    expect(registeredPaths.filter((path) => /bilesen|component|galeri/u.test(path))).toEqual([]);
  });
});

/* ------------------------------------------- the gated surface, and stale prose */

/**
 * The third surface, and why two values were not enough.
 *
 * The taxonomy had exactly two answers to "where does this component appear?":
 * a route renders it, or only Storybook does. `SecretField` is neither. Its
 * module is genuinely route-reachable - `/ayarlar/yapay-zeka` renders
 * `ConnectionWizard`, which imports and renders it - and yet no operator can
 * make it appear, because the route injects `NO_BACKEND_CAPABILITIES`, every
 * catalogued connection method declares a `requires` the empty backend list
 * cannot satisfy, so `methodOfferability` disables every method radio and the
 * verification step that holds the field is unreachable.
 *
 * Calling that `route` claims a screen the user cannot get to. Calling it
 * `storybook` claims the product does not import it, which the import graph
 * refutes. So the classification gets a third value that says both true things
 * at once, and this group is what stops it from being a euphemism: the gated
 * set is pinned by exact equality, so a component cannot be quietly moved into
 * it to escape the reachability rule.
 */
describe("the taxonomy separates a gated surface from an ordinary one", () => {
  const surfaceOf = (name: string): string => CLASSIFIED_COMPONENT_SURFACES[name] as string;
  const gated = (): string[] =>
    Object.keys(CLASSIFIED_COMPONENT_SURFACES).filter((name) => surfaceOf(name) === "route-gated");

  it("classifies SecretField as the gated state", () => {
    expect(
      surfaceOf("SecretField"),
      "SecretField'in modülü rotadan erişilebilir ama etkileşimi yetenek kapısıyla kapalı",
    ).toBe("route-gated");
  });

  it("classifies SecretField as neither an ordinary route surface nor Storybook-only", () => {
    expect(surfaceOf("SecretField")).not.toBe("route");
    expect(surfaceOf("SecretField")).not.toBe("storybook");
  });

  it("holds the gated set to exactly the components source evidence proves gated", () => {
    // Exact equality, not a lower bound. Widening this list is the failure this
    // assertion exists for: "gated" must stay a measurement about capability
    // wiring, never a place to park a component that no route reaches at all.
    expect(gated(), "yetenek kapısıyla kapalı bileşen kümesi").toEqual(["SecretField"]);
  });

  it("uses exactly three surface values across the subsystems and no fourth", () => {
    expect([...new Set(Object.values(SUBSYSTEM_COMPONENT_SURFACES))].sort()).toEqual([
      "route",
      "route-gated",
      "storybook",
    ]);
  });

  it("still proves the gated component's route reachability through ConnectionWizard", () => {
    // The gated state weakens no reachability claim: it is asserted here in the
    // same terms as `route`, through the real import graph.
    expect(gated().length).toBeGreaterThan(0);
    for (const name of gated()) {
      expect(
        renderedIn(name, ROUTE_REACHABLE).map((file) => file.replace(`${ROOT}/`, "")),
        `${name} rota grafiğinden erişilebilir sayıldı ama hiçbir rota zinciri onu render etmiyor`,
      ).not.toEqual([]);
    }
    const wizard = join(ROOT, "src", "components", "provider-connections", "ConnectionWizard.tsx");
    expect(ROUTE_REACHABLE).toContain(wizard);
    expect(renderedIn("SecretField", [wizard])).toEqual([wizard]);
    expect(renderedIn("ConnectionWizard", ROUTE_REACHABLE)).toContain(
      join(ROOT, "src", "routes", "providers.tsx"),
    );
  });

  it("leaves the Storybook rules exactly where they were", () => {
    // A gated component is not a Storybook component and must not be smuggled
    // into either Storybook-only list to make a count work out.
    expect(STORYBOOK_ONLY_COMPONENTS).toHaveLength(14);
    for (const name of gated()) {
      expect(STORYBOOK_ONLY_COMPONENTS).not.toContain(name);
      expect(SUBSYSTEM_COMPONENT_SURFACES[name]).not.toBe("storybook");
    }
    expect(
      Object.keys(SUBSYSTEM_COMPONENT_SURFACES)
        .filter((name) => SUBSYSTEM_COMPONENT_SURFACES[name] === "storybook")
        .sort(),
    ).toEqual([
      "ConnectionHealthPanel",
      "MediaDetails",
      "MediaGovernancePanel",
      "ProviderAuditTimeline",
      "ProviderComparison",
      "RoutingPolicyBuilder",
    ]);
  });

  /*
   * The prose above the map is read like anything else here.
   *
   * The map is machine-checked in both directions by the groups above, so the
   * only thing left that can be false about the classification is the sentence
   * a developer actually reads before trusting it. A doc block that says one
   * number while the map says another is worse than no doc block: it is read as
   * evidence, and it makes the shorter list look like the oversight.
   *
   * So the count is derived, never restated: the prose must carry it as a digit
   * the test can parse, and the digit is compared with the map. Nothing below
   * knows how many Storybook-only subsystem components there are.
   */
  const registrySource = join(ROOT, "src", "components", "registry.ts");

  /** The doc block immediately above the map, read off the file. */
  const subsystemDocBlock = (): string => {
    const source = readFileSync(registrySource, "utf8");
    const before = source.split("export const SUBSYSTEM_COMPONENT_SURFACES")[0] ?? source;
    const blocks = before.match(/\/\*\*[\s\S]*?\*\//gu) ?? [];
    return blocks[blocks.length - 1] ?? "";
  };

  /** Its paragraphs, split at the blank comment lines the file really has. */
  const docParagraphs = (): string[] => subsystemDocBlock().split(/\n\s*\*\s*\n/u);

  /**
   * The Storybook-only half is everything before the first paragraph that
   * speaks about the gated surface; that paragraph and what follows it are the
   * gated half. The split is taken from the text itself, so neither half is
   * restated here.
   */
  const docHalves = (): { storybook: string; gated: string } => {
    const paragraphs = docParagraphs();
    const cut = paragraphs.findIndex((paragraph) => paragraph.includes("route-gated"));
    return {
      storybook: paragraphs.slice(0, Math.max(cut, 0)).join("\n"),
      gated: cut < 0 ? "" : paragraphs.slice(cut).join("\n"),
    };
  };

  const storybookSubsystemNames = (): string[] =>
    Object.keys(SUBSYSTEM_COMPONENT_SURFACES)
      .filter((name) => SUBSYSTEM_COMPONENT_SURFACES[name] === "storybook")
      .sort();

  it("really reads a doc block above the subsystem map", () => {
    // A block that stopped resolving would make every assertion below pass by
    // reading nothing.
    expect(existsSync(registrySource), `${registrySource} okunamadı`).toBe(true);
    expect(subsystemDocBlock(), "haritanın üstündeki doc bloğu bulunamadı").toContain("`storybook`");
    const paragraphs = docParagraphs();
    expect(paragraphs.length, "doc bloğu paragraflara ayrılamadı").toBeGreaterThan(2);
    expect(
      paragraphs.findIndex((paragraph) => paragraph.includes("route-gated")),
      "doc bloğunda kapılı yüzeyi anlatan paragraf yok",
    ).toBeGreaterThan(0);
  });

  it("states the Storybook-only count as a digit that matches the map", () => {
    // Derived, not restated: the digit comes off the prose and the total comes
    // off the map, and this test knows neither number.
    const declared = /(\d+)\s+of\s+(?:these|them)\s+are\s+`storybook`/u.exec(subsystemDocBlock());
    expect(
      declared,
      "doc bloğu Storybook-only sayısını testin okuyabileceği bir rakamla belirtmiyor",
    ).not.toBeNull();
    expect(
      Number(declared?.[1]),
      "doc bloğundaki Storybook-only sayısı haritadaki `storybook` değeri sayısıyla uyuşmuyor",
    ).toBe(storybookSubsystemNames().length);
  });

  it("explains every Storybook-only component it counts", () => {
    // A true count with an unexplained name is the same defect one step later:
    // the reader cannot check the number against anything.
    const { storybook } = docHalves();
    for (const name of storybookSubsystemNames()) {
      expect(storybook, `${name} Storybook-only sayılıyor ama gerekçesi yazılmamış`).toContain(
        `\`${name}\``,
      );
    }
  });

  it("keeps the gated component out of the Storybook-only explanation", () => {
    // `SecretField` is `route-gated`, and the paragraph below owns it. Naming
    // it among the Storybook-only reasons implies a seventh Storybook name that
    // the map does not have, and contradicts the gated group above.
    const { storybook, gated: gatedHalf } = docHalves();
    for (const name of gated()) {
      expect(
        storybook,
        `${name} kapılı yüzey; Storybook-only gerekçelerinde anılmamalı`,
      ).not.toContain(name);
      expect(gatedHalf, `${name} kapılı paragrafta açıklanmalı`).toContain(name);
    }
  });
});

/**
 * The comments that outlived the fact they described.
 *
 * Six files justified a real decision - excluding a stylesheet, keeping
 * fixtures out of runtime code, scoping a CSS rule, splitting a test between
 * jsdom and a browser, loading a stylesheet in the Storybook preview - with the
 * same expired sentence: that the media and provider subsystems have no route.
 * They have routes. `/dosyalar` and `/ayarlar/yapay-zeka` are in the registry
 * and are walked by the table test above.
 *
 * The Storybook preview is read here for the same reason as the five source
 * files and by the same rule: it is configuration a developer reads as evidence
 * about the application, so an expired reason in it misleads exactly as much.
 *
 * The decisions are still right; only the reasons are wrong, which is the
 * dangerous shape. A stale reason is read as current evidence by the next
 * person, who then "fixes" a correct exclusion or leaves a real gap in place.
 * So the prose is checked like anything else: these phrases may not reappear in
 * these files while those two routes exist.
 */
describe("no file justifies itself with a route claim that expired", () => {
  const STALE = [
    /no\s+route\s+renders/iu,
    /no\s+product\s+route/iu,
    /has\s+no\s+route/iu,
    /no\s+route\s+for\s+\w+\s+to\s+visit/iu,
    /until\s+a\s+route\s+exists/iu,
  ];

  const FILES = [
    join(ROOT, "src", "main.tsx"),
    join(ROOT, "src", "test", "media-fixtures.ts"),
    join(ROOT, "src", "test", "provider-fixtures.ts"),
    join(ROOT, "src", "test", "design-system-contract.test.ts"),
    join(ROOT, "src", "components", "provider-connections", "provider-acceptance.test.tsx"),
    join(ROOT, ".storybook", "preview.tsx"),
  ];

  it("reads every guarded file, including the one outside src", () => {
    // A path that stopped resolving would make this group pass by reading
    // nothing. The preview lives outside `src`, so it is the likeliest to move.
    for (const file of FILES) {
      expect(existsSync(file), `${file} okunamadı`).toBe(true);
    }
    expect(FILES).toContain(join(ROOT, ".storybook", "preview.tsx"));
  });

  it("is checking against routes that really exist", () => {
    // The premise. If these two ever stop being published, the phrases below
    // become true again and this whole group should be revisited, not deleted.
    expect(registeredPaths).toContain("/dosyalar");
    expect(registeredPaths).toContain("/ayarlar/yapay-zeka");
  });

  it.each(FILES.map((file) => [file.replace(`${ROOT}/`, ""), file] as const))(
    "%s states no expired no-route reason",
    (_label, file) => {
      const source = readFileSync(file, "utf8");
      const found = STALE.filter((pattern) => pattern.test(source)).map((pattern) => pattern.source);
      expect(found, "artık doğru olmayan 'rota yok' gerekçeleri").toEqual([]);
    },
  );
});

describe("the component classification is exhaustive and true", () => {
  it("classifies every registered component and nothing else", () => {
    expect(Object.keys(COMPONENT_SURFACES).sort()).toEqual([...ALL_COMPONENT_NAMES].sort());
  });

  it("classifies no name that is not registered", () => {
    const strays = STORYBOOK_ONLY_COMPONENTS.filter(
      (name) => !ALL_COMPONENT_NAMES.includes(name),
    );
    expect(strays, "kayıtlı olmayan bileşen sınıflandırıldı").toEqual([]);
  });

  it("finds the files it is supposed to read", () => {
    expect(RUNTIME_FILES.length).toBeGreaterThan(30);
    expect(STORY_FILES.length).toBeGreaterThan(5);
  });

  it.each(
    ALL_COMPONENT_NAMES.filter((name) =>
      ["route", "route-gated"].includes(COMPONENT_SURFACES[name] as string),
    ),
  )("%s is classified as a product surface and is rendered by one", (name) => {
    expect(
      renderedIn(name, RUNTIME_FILES).map((file) => file.replace(`${ROOT}/`, "")),
      `${name} ürün yüzeyi olarak sınıflandırıldı ama hiçbir çalışma zamanı modülü onu render etmiyor`,
    ).not.toEqual([]);
  });

  it.each(STORYBOOK_ONLY_COMPONENTS)(
    "%s is Storybook-only, so it has a story and no runtime caller",
    (name) => {
      expect(
        renderedIn(name, STORY_FILES).length,
        `${name} hiçbir yerde render edilmiyor: ne üründe ne Storybook'ta`,
      ).toBeGreaterThan(0);
      expect(
        renderedIn(name, RUNTIME_FILES).map((file) => file.replace(`${ROOT}/`, "")),
        `${name} artık üründe kullanılıyor; sınıflandırmayı "route" olarak güncelleyin`,
      ).toEqual([]);
    },
  );

  it("adds no component gallery route to make the numbers look better", () => {
    // The tempting fix for the list above is a `/bilesenler` page. It would make
    // every component "reachable" and the classification meaningless.
    expect(registeredPaths.filter((path) => /bilesen|component|galeri/u.test(path))).toEqual([]);
  });
});
