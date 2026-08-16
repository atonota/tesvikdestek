/**
 * Route truth only.
 *
 * The rejected component catalogue used to live in this test as a second,
 * unrelated contract. Clean-room component/story ownership is now enforced by
 * the W0/W1/W2 boundary tests; this file remains the canonical route, access,
 * capability-ledger and accessibility-sweep parity check.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { RouteObject } from "react-router";
import { describe, expect, it } from "vitest";

import {
  ROUTE_REGISTRY,
  STATIC_ROUTES,
  routes,
  type RegisteredRoute,
} from "@/app/router";
import { CAPABILITIES } from "@/domain/capabilities";

const root = process.cwd();

interface WalkedRoute {
  readonly path: string;
  readonly guarded: boolean;
}

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

const walked = walk(routes, "", false);
const walkedPaths = walked.map((route) => route.path).sort();
const registeredPaths = ROUTE_REGISTRY.map((route) => route.path).sort();

describe("route registry parity", () => {
  it("walks a real application route tree", () => {
    expect(walked.length).toBeGreaterThan(20);
    expect(walkedPaths).toContain("/");
    expect(walkedPaths).toContain("/ayarlar/yapay-zeka");
  });

  it("matches the router in both directions without duplicates", () => {
    expect([...new Set(walkedPaths)]).toEqual(registeredPaths);
    expect(new Set(registeredPaths).size).toBe(registeredPaths.length);
  });
});

describe("workspace access boundary", () => {
  const accessOf = (path: string): RegisteredRoute["access"] =>
    (ROUTE_REGISTRY.find((route) => route.path === path) as RegisteredRoute).access;

  it("guards every workspace route and no public/auth route", () => {
    expect(
      walked
        .filter((route) => accessOf(route.path) === "workspace" && !route.guarded)
        .map((route) => route.path),
    ).toEqual([]);
    expect(
      walked
        .filter((route) => accessOf(route.path) !== "workspace" && route.guarded)
        .map((route) => route.path),
    ).toEqual([]);
  });

  it("keeps login and registration outside the session gate", () => {
    for (const path of ["/giris", "/kayit"]) {
      expect(walked.find((route) => route.path === path)?.guarded).toBe(false);
    }
  });
});

describe("capability ledger parity", () => {
  it("publishes every route claimed by a capability", () => {
    const missing = CAPABILITIES.map((capability) => capability.route)
      .filter((route): route is string => typeof route === "string")
      .filter((route) => !registeredPaths.includes(route));
    expect(missing).toEqual([]);
  });

  it("ledgers every workspace screen except named local/alias routes", () => {
    const ledgered = new Set(CAPABILITIES.map((capability) => capability.route).filter(Boolean));
    const exemptions = ["/uygunluk", "/ayarlar/gorunum", "/ayarlar/erisilebilirlik"];
    const unledgered = ROUTE_REGISTRY.filter(
      (route) =>
        route.access === "workspace" &&
        route.redirect !== true &&
        !ledgered.has(route.path) &&
        !exemptions.includes(route.path),
    ).map((route) => route.path);
    expect(unledgered).toEqual([]);
  });
});

describe("browser accessibility sweep parity", () => {
  const source = readFileSync(join(root, "e2e", "accessibility.spec.ts"), "utf8");
  const sweptPaths = [...source.matchAll(/"\.\/([^"]*)"/gu)].map(
    (match) => `/${match[1] as string}`,
  );
  const sweptViewports = [...source.matchAll(/width:\s*(\d+),\s*height:\s*(\d+)/gu)].map(
    (match) => `${match[1] as string}x${match[2] as string}`,
  );

  it("uses the required 320px and desktop viewports", () => {
    expect(sweptViewports).toEqual(["320x568", "1440x900"]);
  });

  it("covers every static registered address", () => {
    const swept = new Set(sweptPaths.map((path) => (path === "/" ? "/" : path.replace(/\/$/u, ""))));
    expect(STATIC_ROUTES.map((route) => route.path).filter((path) => !swept.has(path))).toEqual([]);
  });
});
