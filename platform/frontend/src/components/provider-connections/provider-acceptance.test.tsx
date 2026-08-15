/**
 * RED acceptance suite for the provider connection centre.
 *
 * Written before the implementation. Every assertion here encodes a promise
 * that is cheap to break silently later, and each one fails against a *wrong*
 * implementation rather than merely against a missing file:
 *
 *  - a secret is never persisted, never left visible, and never survives a
 *    submit, a cancel or an unmount;
 *  - pressing "connect" creates a request and nothing else - no local state
 *    transition can paint a connection as established;
 *  - a method a provider does not support cannot be selected, in the reducer or
 *    in the UI, and says why it is unavailable;
 *  - a revoked or expired connection is never rendered as healthy, including
 *    the case where a stale record still says `connected`;
 *  - the host-managed session methods are described as what they are - an
 *    official first-party sign-in the host verifies - and never as a browser
 *    cookie or token import;
 *  - fixtures cannot leak into the runtime tree;
 *  - no control claims to act on records that were never loaded;
 *  - consent gates the wizard rather than decorating it;
 *  - a port callback is unreachable without both the backend capability and the
 *    permission.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  ConnectionHealthPanel,
  ConnectionInventory,
  ConnectionWizard,
  PROVIDER_CATALOG,
  PROVIDER_CONNECTION_CAPABILITIES,
  RoutingPolicyBuilder,
  SecretField,
  availableMethods,
  blockedProviderCapabilities,
  canAdvance,
  connectionStatusLabel,
  effectiveStatus,
  initialWizardState,
  isHealthy,
  isMethodAvailable,
  methodExplanation,
  methodLabel,
  methodNeedsSecret,
  providerBulkActions,
  providerById,
  readyProviderCapabilities,
  unavailableMethods,
  wizardReducer,
  type ConnectionMethodId,
  type ProviderId,
  type WizardState,
} from "./index";
import {
  CONNECTION_CLAUDE_API,
  CONNECTION_GEMINI_REVOKED,
  CONNECTION_OPENAI_EXPIRED,
  CONNECTION_OPENCLAW_STALE,
  PROVIDER_CAPABILITIES_BACKEND_ONLY,
  PROVIDER_CAPABILITIES_FULL,
  PROVIDER_CAPABILITIES_NONE,
  PROVIDER_CAPABILITIES_PERMISSIONS_ONLY,
  PROVIDER_CONNECTIONS,
  PROVIDER_NOW,
  PROVIDER_POLICY,
} from "@/test/provider-fixtures";

const SUBSYSTEM_DIR = join(process.cwd(), "src", "components", "provider-connections");

function subsystemSourceFiles(): string[] {
  const found: string[] = [];
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory)) {
      const full = join(directory, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/u.test(entry) && !/\.(test|stories)\.tsx?$/u.test(entry)) {
        found.push(full);
      }
    }
  };
  walk(SUBSYSTEM_DIR);
  return found;
}

/** Strips comments so a rule that *discusses* a token does not trip on it. */
function codeOnly(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/(^|[^:])\/\/.*$/gmu, "$1");
}

/** A wizard state parked on a given step, built only through real events. */
function wizardAt(step: WizardState["step"], providerId: ProviderId = "claude"): WizardState {
  let state = wizardReducer(initialWizardState(), { type: "provider.select", providerId });
  if (step === "provider") return initialWizardState();
  if (step === "method") return state;
  // Prefer a method that needs no secret, so the helper exercises the plain
  // request path. The secret-carrying path has its own tests.
  const methods = availableMethods(providerId);
  const method = (methods.find((entry) => !methodNeedsSecret(entry.method)) ?? methods[0])
    ?.method as ConnectionMethodId;
  state = wizardReducer(state, { type: "method.select", method });
  if (step === "consent") return state;
  state = wizardReducer(state, { type: "consent.acknowledge", acknowledged: true });
  state = wizardReducer(state, { type: "next" });
  if (step === "configure") return state;
  state = wizardReducer(state, { type: "configure.set", label: "Test bağlantısı", complete: true });
  return wizardReducer(state, { type: "next" });
}

/* ------------------------------------------------- narrow-viewport layout */

/**
 * The 320px contract, asserted against the stylesheet.
 *
 * **Limitation, stated up front:** these run in jsdom, which has no layout
 * engine - `getBoundingClientRect()` returns zeroes, so a real width cannot be
 * measured here. That is a limitation of this file, not of the subsystem's
 * coverage. The division is now deliberate: `/ayarlar/yapay-zeka` exists and
 * `e2e/provider-route.spec.ts` visits it in a real browser at 320x568 and
 * 1440x900, where widths are actually measurable, while these assertions pin
 * the *cause* in the stylesheet - every grid in the sheet, including the ones
 * whose components no route mounts today. A browser test can only measure what
 * the route puts on the screen; this group covers the rest of the sheet, and
 * fails on the declaration rather than on the symptom.
 *
 * The cause, measured in Chromium at 320x800 on the built Storybook before the
 * fix: `documentElement.scrollWidth` 358 against a 320 client width. The chain
 * was `.dt-dl__row` (min-content up to 258.28px, because `minmax(9rem, 40%)`
 * puts a 144px floor under the term column) → `.dt-card` (326.28px once padding
 * and borders are added) → `.dt-provider-catalog__list` and
 * `.dt-provider-catalog`, whose *implicit* grid columns are `auto`.
 *
 * That last step is the defect this group locks. An `auto` track's minimum is
 * the item's min-content, so an auto-column grid cannot shrink below its
 * content: it grows past its own container instead. `minmax(0, 1fr)` gives the
 * track a zero minimum, which is what lets the content wrap rather than the
 * track overflow. Every grid in this subsystem needs it, so the rule is applied
 * to all of them rather than to the two that happened to be measured.
 */
describe("every grid in this subsystem can shrink below its content", () => {
  const CSS_PATH = join(process.cwd(), "src", "design", "provider-connections.css");
  const stylesheet = () => readFileSync(CSS_PATH, "utf8").replace(/\/\*[\s\S]*?\*\//gu, "");

  /** Character ranges covered by an `@media` block, brace-matched. */
  function mediaRanges(css: string): readonly (readonly [number, number])[] {
    const ranges: [number, number][] = [];
    const opener = /@media[^{]*\{/gu;
    let match: RegExpExecArray | null;
    while ((match = opener.exec(css)) !== null) {
      let depth = 1;
      let index = opener.lastIndex;
      while (index < css.length && depth > 0) {
        if (css[index] === "{") depth += 1;
        else if (css[index] === "}") depth -= 1;
        index += 1;
      }
      ranges.push([match.index, index]);
    }
    return ranges;
  }

  /** Leaf rules only: the inner regex cannot span a nested block. */
  function rules(css: string) {
    const found: { selector: string; body: string; index: number }[] = [];
    const rule = /([^{}]+)\{([^{}]*)\}/gu;
    let match: RegExpExecArray | null;
    while ((match = rule.exec(css)) !== null) {
      found.push({ selector: (match[1] ?? "").trim(), body: match[2] ?? "", index: match.index });
    }
    return found;
  }

  const baseGridRules = () => {
    const css = stylesheet();
    const media = mediaRanges(css);
    return rules(css)
      .filter((entry) => /display:\s*grid/u.test(entry.body))
      .filter((entry) => !media.some(([from, to]) => entry.index > from && entry.index < to));
  };

  it("finds the grid rules to check at all", () => {
    // A guard that silently checks nothing is decorative.
    expect(baseGridRules().length).toBeGreaterThan(10);
  });

  it.each(baseGridRules().map((entry) => [entry.selector, entry] as const))(
    "%s declares a zero-minimum column track",
    (_selector, entry) => {
      const declaration = /grid-template-columns:\s*([^;]+);/u.exec(entry.body)?.[1] ?? "";
      expect(declaration).not.toBe("");
      // `minmax(0, …)` is the whole point: an implicit `auto` track refuses to
      // go below min-content and overflows its container instead.
      expect(declaration).toContain("minmax(0");
    },
  );

  it("stacks the disclosure's definition rows instead of holding a 9rem term column", () => {
    // The shared `.dt-dl__row` keeps its two-column form everywhere else; this
    // subsystem narrows it for itself rather than changing a primitive that
    // media, the data grid and every route also use.
    const css = stylesheet();
    const scoped = rules(css).filter((entry) => /dt-provider-\w+[^{]*\.dt-dl__row/u.test(entry.selector));
    expect(scoped.length).toBeGreaterThan(0);

    const media = mediaRanges(css);
    const base = scoped.filter((entry) => !media.some(([from, to]) => entry.index > from && entry.index < to));
    expect(base.length).toBeGreaterThan(0);
    for (const entry of base) {
      const declaration = /grid-template-columns:\s*([^;]+);/u.exec(entry.body)?.[1] ?? "";
      expect(declaration).toContain("minmax(0");
      expect(declaration).not.toContain("9rem");
    }

    // The two-column form still exists, restored only where there is room.
    const restored = scoped.filter((entry) => media.some(([from, to]) => entry.index > from && entry.index < to));
    expect(restored.length).toBeGreaterThan(0);
  });

  it("lets the card header wrap rather than overflow", () => {
    // Title plus a vendor badge does not fit on one 288px line, and the badge
    // was the visibly clipped element in the browser evidence.
    const css = stylesheet();
    const header = rules(css).find((entry) => /\.dt-card__head/u.test(entry.selector));
    expect(header?.body ?? "").toMatch(/flex-wrap:\s*wrap/u);
  });

  it("keeps the stepper's off-screen text inside the stepper's own scroller", () => {
    // `.dt-visually-hidden` is `position: absolute`. Without a positioned
    // ancestor it escapes `.dt-stepper__list`'s horizontal scroller and widens
    // the document instead - measured at 616px against a 320px viewport before
    // this rule existed, on a wizard whose six steps legitimately scroll.
    const css = stylesheet();
    const scoped = rules(css).find((entry) =>
      /dt-provider-wizard[^{]*\.dt-stepper__item/u.test(entry.selector),
    );
    expect(scoped?.body ?? "").toMatch(/position:\s*relative/u);
  });

  it("does not hide the overflow instead of fixing it", () => {
    // Clipping turns a visible bug into an invisible one. `overflow-x: auto` on
    // a deliberately wide table is a different thing and stays allowed, so the
    // ban is on hiding specifically.
    const css = stylesheet();
    expect(css).not.toMatch(/overflow(-[xy])?:\s*hidden/u);
    expect(css).not.toMatch(/white-space:\s*nowrap/u);
  });
});

/* ------------------------------------------------------ the catalogue */

describe("the catalogue states each provider's real methods and nothing more", () => {
  it("covers exactly the four providers this package is about", () => {
    expect(PROVIDER_CATALOG.map((provider) => provider.id).sort()).toEqual([
      "claude",
      "gemini",
      "openai",
      "openclaw",
    ]);
  });

  it("Gemini offers Google OAuth and an API key", () => {
    expect(isMethodAvailable("gemini", "oauth")).toBe(true);
    expect(isMethodAvailable("gemini", "api-key")).toBe(true);
  });

  it("OpenAI offers an API key and the official host-managed session, not a generic OAuth login", () => {
    expect(isMethodAvailable("openai", "api-key")).toBe(true);
    expect(isMethodAvailable("openai", "host-session")).toBe(true);
    // There is no consumer-account OAuth app flow to offer, so offering one
    // would be inventing a door that does not exist.
    expect(isMethodAvailable("openai", "oauth")).toBe(false);
  });

  it("Claude offers an API key and the official host-verified subscription session", () => {
    expect(isMethodAvailable("claude", "api-key")).toBe(true);
    expect(isMethodAvailable("claude", "host-session")).toBe(true);
    expect(isMethodAvailable("claude", "oauth")).toBe(false);
  });

  it("OpenClaw offers a gateway token and a host auth profile, and is not labelled an OAuth provider", () => {
    expect(isMethodAvailable("openclaw", "gateway-token")).toBe(true);
    expect(isMethodAvailable("openclaw", "host-auth-profile")).toBe(true);
    expect(isMethodAvailable("openclaw", "oauth")).toBe(false);
  });

  it("every unavailable method carries a reason and every available one a requirement", () => {
    for (const provider of PROVIDER_CATALOG) {
      expect(provider.methods.length).toBeGreaterThan(1);
      for (const method of provider.methods) {
        expect(method.reason.length).toBeGreaterThan(20);
        expect(method.docsUrl).toMatch(/^https:\/\//u);
      }
      // A provider with nothing marked unavailable has not been thought about.
      expect(unavailableMethods(provider.id).length).toBeGreaterThan(0);
    }
  });

  it("no available method is offered without naming the host capability it needs", () => {
    for (const provider of PROVIDER_CATALOG) {
      for (const method of availableMethods(provider.id)) {
        expect(method.requires.length).toBeGreaterThan(0);
      }
    }
  });
});

/* ------------------------------------------- the account-method wording */

describe("host-managed sessions are described truthfully", () => {
  it("never describes a session method as importing a cookie or scraping a token", () => {
    const forbidden = /çerez|cookie|kazı|scrap|tarayıcıdan al|oturum çal/iu;
    for (const method of ["host-session", "host-auth-profile"] as const) {
      expect(methodLabel(method)).not.toMatch(forbidden);
      // The explanation may only mention the practice in order to deny it, so
      // the assertion is on the *claim*: it must say who verifies instead.
      expect(methodExplanation(method)).toMatch(/barındırıcı/iu);
    }
  });

  it("says the host performs and verifies the sign-in, not this browser", () => {
    expect(methodExplanation("host-session")).toMatch(/doğrula/iu);
    expect(methodExplanation("host-session")).not.toMatch(/bu tarayıcı (oturum|çerez)/iu);
  });

  it("no module reads or writes a cookie", () => {
    const offenders = subsystemSourceFiles()
      .filter((file) => /document\.cookie|\bcookieStore\b/u.test(codeOnly(readFileSync(file, "utf8"))))
      .map((file) => file.replace(process.cwd(), "."));
    expect(offenders).toEqual([]);
  });

  it("an API-key method is never called an account login", () => {
    expect(methodLabel("api-key")).not.toMatch(/giriş yap|hesabınızla/iu);
  });
});

/* -------------------------------------------------- the ephemeral secret */

describe("a secret is ephemeral in the strong sense", () => {
  it("no module touches browser storage or the URL with a secret", () => {
    const offenders = subsystemSourceFiles()
      .filter((file) => {
        const code = codeOnly(readFileSync(file, "utf8"));
        return /\b(localStorage|sessionStorage|indexedDB)\b/u.test(code);
      })
      .map((file) => file.replace(process.cwd(), "."));
    expect(offenders).toEqual([]);
  });

  it("no module logs anything", () => {
    const offenders = subsystemSourceFiles()
      .filter((file) => /\bconsole\.\w+\(/u.test(codeOnly(readFileSync(file, "utf8"))))
      .map((file) => file.replace(process.cwd(), "."));
    expect(offenders).toEqual([]);
  });

  it("no connection or audit record has anywhere to put a credential", () => {
    const contract = readFileSync(join(SUBSYSTEM_DIR, "types.ts"), "utf8");
    const block = contract.slice(
      contract.indexOf("interface ProviderConnection {"),
      contract.indexOf("/* ------------------------------------------------------------------ audit"),
    );
    expect(block).toMatch(/maskedHint/u);
    expect(block).not.toMatch(/\bapiKey\b|\bsecret\b|\btoken\b|\bcookie\b/iu);
  });

  it("is masked by default and reveals only on an explicit, announced action", async () => {
    render(<SecretField fieldId="api-key" label="API anahtarı" onSubmit={vi.fn()} />);
    const input = screen.getByLabelText(/API anahtarı/iu);
    expect(input).toHaveAttribute("type", "password");

    const reveal = screen.getByRole("button", { name: /göster/iu });
    expect(reveal).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(reveal);
    expect(input).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: /gizle/iu })).toHaveAttribute("aria-pressed", "true");
  });

  it("offers no copy affordance by default", () => {
    render(<SecretField fieldId="api-key" label="API anahtarı" onSubmit={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /kopyala/iu })).toBeNull();
  });

  it("clears the value and re-masks it after submit", async () => {
    const onSubmit = vi.fn();
    render(<SecretField fieldId="api-key" label="API anahtarı" onSubmit={onSubmit} />);
    const input = screen.getByLabelText(/API anahtarı/iu) as HTMLInputElement;

    await userEvent.type(input, "sk-not-a-real-key");
    await userEvent.click(screen.getByRole("button", { name: /göster/iu }));
    await userEvent.click(screen.getByRole("button", { name: /gönder|aktar/iu }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const secret = onSubmit.mock.calls[0]?.[0] as { value: string; oneTimeUse: boolean };
    expect(secret.value).toBe("sk-not-a-real-key");
    expect(secret.oneTimeUse).toBe(true);

    // The field keeps nothing: not the value, not the revealed state.
    expect(input.value).toBe("");
    expect(input).toHaveAttribute("type", "password");
  });

  it("clears the value on cancel", async () => {
    const onCancel = vi.fn();
    render(
      <SecretField fieldId="api-key" label="API anahtarı" onSubmit={vi.fn()} onCancel={onCancel} />,
    );
    const input = screen.getByLabelText(/API anahtarı/iu) as HTMLInputElement;
    await userEvent.type(input, "sk-not-a-real-key");
    await userEvent.click(screen.getByRole("button", { name: /vazgeç|iptal/iu }));
    expect(input.value).toBe("");
    expect(onCancel).toHaveBeenCalled();
  });

  it("reports the clear on unmount so a caller can drop its own copy", async () => {
    const onClear = vi.fn();
    const view = render(
      <SecretField fieldId="api-key" label="API anahtarı" onSubmit={vi.fn()} onClear={onClear} />,
    );
    await userEvent.type(screen.getByLabelText(/API anahtarı/iu), "sk-not-a-real-key");
    view.unmount();
    expect(onClear).toHaveBeenCalled();
  });

  it("never puts the value in an attribute a screenshot or a DOM dump would carry", async () => {
    render(<SecretField fieldId="api-key" label="API anahtarı" onSubmit={vi.fn()} />);
    const input = screen.getByLabelText(/API anahtarı/iu);
    await userEvent.type(input, "sk-not-a-real-key");
    expect(input.outerHTML).not.toContain("sk-not-a-real-key");
    expect(input).toHaveAttribute("autocomplete", "off");
  });
});

/* -------------------------------------------- pressing connect proves nothing */

describe("the client cannot conclude that a connection exists", () => {
  it("has no local event that produces a connected status", () => {
    const state = wizardAt("verify");
    const started = wizardReducer(state, { type: "request.start" });
    const created = wizardReducer(started, { type: "request.created", requestId: "req-1" });

    expect(created.request?.state).toBe("created");
    // The wizard advanced to "waiting for the backend", not to success.
    expect(created.step).toBe("verify");
    expect(created.result).toBeNull();
  });

  it("only a backend result can carry a connection into the wizard", () => {
    const created = wizardReducer(
      wizardReducer(wizardAt("verify"), { type: "request.start" }),
      { type: "request.created", requestId: "req-1" },
    );
    const answered = wizardReducer(created, {
      type: "backend.result",
      connection: CONNECTION_CLAUDE_API,
    });
    expect(answered.step).toBe("review");
    expect(answered.result?.status).toBe("connected");
  });

  it("a failed request never becomes a connection", () => {
    const failed = wizardReducer(
      wizardReducer(wizardAt("verify"), { type: "request.start" }),
      { type: "request.failed", message: "Ağ hatası" },
    );
    expect(failed.result).toBeNull();
    expect(failed.request?.state).toBe("create-failed");
    expect(failed.error).toBe("Ağ hatası");
  });

  it("the wizard renders a pending request as pending, never as connected", async () => {
    const createConnectionRequest = vi.fn().mockResolvedValue({ requestId: "req-1" });
    render(
      <ConnectionWizard
        capabilities={PROVIDER_CAPABILITIES_FULL}
        port={{ createConnectionRequest }}
        initialState={wizardAt("verify")}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /bağlantı isteği oluştur/iu }));

    expect(createConnectionRequest).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/sunucu yanıtı bekleniyor/iu)).toBeInTheDocument();
    expect(screen.queryByText(/^bağlı$/iu)).toBeNull();
  });

  it("offers no connect control at all when the host declared no way to create a request", async () => {
    render(
      <ConnectionWizard capabilities={PROVIDER_CAPABILITIES_FULL} initialState={wizardAt("verify")} />,
    );
    expect(screen.getByRole("button", { name: /bağlantı isteği oluştur/iu })).toBeDisabled();
  });
});

/* --------------------------------------------- unsupported is unselectable */

describe("a method a provider does not support cannot be chosen", () => {
  it("the reducer refuses an unsupported method", () => {
    const state = wizardReducer(initialWizardState(), {
      type: "provider.select",
      providerId: "openclaw",
    });
    const attempted = wizardReducer(state, { type: "method.select", method: "oauth" });
    expect(attempted.method).toBeNull();
    expect(attempted.step).toBe("method");
  });

  it("the method step renders unsupported methods as disabled with the reason", () => {
    render(
      <ConnectionWizard
        capabilities={PROVIDER_CAPABILITIES_FULL}
        initialState={wizardAt("method", "openclaw")}
      />,
    );
    const unsupported = screen.getByRole("radio", { name: /OAuth/iu });
    expect(unsupported).toBeDisabled();
    // The reason now cites what the official gateway-authentication docs do
    // define, which is why the consumer OAuth row is not among them.
    expect(screen.getByText(/tüketici hesabı OAuth akışı tanımlı değil/iu)).toBeInTheDocument();
  });

  it("a supported method whose host capability is missing is also unavailable, with its own reason", () => {
    render(
      <ConnectionWizard
        capabilities={PROVIDER_CAPABILITIES_NONE}
        initialState={wizardAt("method", "claude")}
      />,
    );
    for (const option of screen.getAllByRole("radio")) expect(option).toBeDisabled();
    expect(screen.getAllByText(/sunucu tarafında tanımlı değil/iu).length).toBeGreaterThan(0);
  });
});

/* ----------------------------------------------------- consent is a gate */

describe("consent gates the wizard rather than decorating it", () => {
  it("cannot advance past the disclosure without an explicit acknowledgement", () => {
    const state = wizardAt("consent");
    expect(state.consentAcknowledged).toBe(false);
    expect(canAdvance(state)).toBe(false);
    expect(canAdvance(wizardReducer(state, { type: "consent.acknowledge", acknowledged: true }))).toBe(
      true,
    );
  });

  it("shows the data categories, residency and retention before anything is typed", () => {
    render(
      <ConnectionWizard
        capabilities={PROVIDER_CAPABILITIES_FULL}
        initialState={wizardAt("consent", "gemini")}
      />,
    );
    expect(screen.getByText(/veri yerleşimi/iu)).toBeInTheDocument();
    expect(screen.getByText(/saklama/iu)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /devam/iu })).toBeDisabled();
  });

  it("withdrawing the acknowledgement closes the gate again", () => {
    const acknowledged = wizardReducer(wizardAt("consent"), {
      type: "consent.acknowledge",
      acknowledged: true,
    });
    const withdrawn = wizardReducer(acknowledged, {
      type: "consent.acknowledge",
      acknowledged: false,
    });
    expect(canAdvance(withdrawn)).toBe(false);
  });
});

/* ------------------------------------------------ revoked is never healthy */

describe("a revoked, expired or stale connection is never rendered as healthy", () => {
  it("only a live connected status counts as healthy", () => {
    expect(isHealthy(CONNECTION_CLAUDE_API, PROVIDER_NOW)).toBe(true);
    for (const connection of [CONNECTION_GEMINI_REVOKED, CONNECTION_OPENAI_EXPIRED]) {
      expect(isHealthy(connection, PROVIDER_NOW)).toBe(false);
    }
  });

  it("a record that still says connected past its expiry reads as expired", () => {
    expect(CONNECTION_OPENCLAW_STALE.status).toBe("connected");
    expect(effectiveStatus(CONNECTION_OPENCLAW_STALE, PROVIDER_NOW)).toBe("expired");
    expect(isHealthy(CONNECTION_OPENCLAW_STALE, PROVIDER_NOW)).toBe(false);
  });

  it("no non-connected status is labelled with a reassuring word", () => {
    for (const status of ["disconnected", "pending", "expired", "revoked", "error"] as const) {
      expect(connectionStatusLabel(status)).not.toMatch(/sağlıklı|çalışıyor|hazır/iu);
    }
  });

  it("the health panel says why, rather than showing a bare unhappy badge", () => {
    render(
      <ConnectionHealthPanel
        connection={CONNECTION_GEMINI_REVOKED}
        capabilities={PROVIDER_CAPABILITIES_FULL}
        now={PROVIDER_NOW}
      />,
    );
    // The server's own sentence, not just an unhappy badge colour.
    expect(screen.getByText(/Google hesabı yöneticisi/iu)).toBeInTheDocument();
    expect(screen.getAllByText(/geri çekildi/iu).length).toBeGreaterThan(0);
    expect(screen.queryByText(/^sağlıklı$/iu)).toBeNull();
  });

  it("the health panel refuses to imply freshness it does not have", () => {
    render(
      <ConnectionHealthPanel
        connection={CONNECTION_OPENCLAW_STALE}
        capabilities={PROVIDER_CAPABILITIES_FULL}
        now={PROVIDER_NOW}
      />,
    );
    // The stored record says connected; the panel must show the derived truth.
    expect(screen.getAllByText(/süresi doldu/iu).length).toBeGreaterThan(0);
    expect(screen.queryByText(/^bağlı$/iu)).toBeNull();
  });
});

/* -------------------------------------------- permissions gate every action */

describe("a port callback is unreachable without both halves", () => {
  const port = () => ({ reverify: vi.fn(), rotate: vi.fn(), revoke: vi.fn() });

  it("renders every action disabled when the actor has no permission", async () => {
    const callbacks = port();
    render(
      <ConnectionHealthPanel
        connection={CONNECTION_CLAUDE_API}
        capabilities={PROVIDER_CAPABILITIES_BACKEND_ONLY}
        port={callbacks}
        now={PROVIDER_NOW}
      />,
    );
    for (const name of [/yeniden doğrula/iu, /döndür/iu, /iptal et/iu]) {
      const button = screen.getByRole("button", { name });
      expect(button).toBeDisabled();
      await userEvent.click(button);
    }
    expect(callbacks.reverify).not.toHaveBeenCalled();
    expect(callbacks.rotate).not.toHaveBeenCalled();
    expect(callbacks.revoke).not.toHaveBeenCalled();
  });

  it("renders every action disabled when the backend cannot perform it", async () => {
    const callbacks = port();
    render(
      <ConnectionHealthPanel
        connection={CONNECTION_CLAUDE_API}
        capabilities={PROVIDER_CAPABILITIES_PERMISSIONS_ONLY}
        port={callbacks}
        now={PROVIDER_NOW}
      />,
    );
    const button = screen.getByRole("button", { name: /yeniden doğrula/iu });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(callbacks.reverify).not.toHaveBeenCalled();
  });

  it("invokes the callback only when the backend and the permission are both present", async () => {
    const callbacks = port();
    render(
      <ConnectionHealthPanel
        connection={CONNECTION_CLAUDE_API}
        capabilities={PROVIDER_CAPABILITIES_FULL}
        port={callbacks}
        now={PROVIDER_NOW}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /yeniden doğrula/iu }));
    expect(callbacks.reverify).toHaveBeenCalledWith(CONNECTION_CLAUDE_API.id);
  });

  it("the routing builder is inert without the routing capability", () => {
    render(
      <RoutingPolicyBuilder
        policy={PROVIDER_POLICY}
        connections={PROVIDER_CONNECTIONS}
        capabilities={PROVIDER_CAPABILITIES_PERMISSIONS_ONLY}
      />,
    );
    expect(screen.getByText(/yönlendirme .*sunucu/iu)).toBeInTheDocument();
    for (const control of screen.queryAllByRole("spinbutton")) expect(control).toBeDisabled();
  });
});

/* ---------------------------------------- loaded rows only, never the server */

describe("no control claims to act on records that were never loaded", () => {
  it("the inventory says its scope is the loaded rows", async () => {
    render(
      <ConnectionInventory
        connections={PROVIDER_CONNECTIONS}
        capabilities={PROVIDER_CAPABILITIES_FULL}
        now={PROVIDER_NOW}
      />,
    );
    await screen.findByRole("table");
    expect(screen.getAllByText(/yüklenmiş/iu).length).toBeGreaterThan(0);
  });

  it("offers no select-all-matching action anywhere", () => {
    render(
      <ConnectionInventory
        connections={PROVIDER_CONNECTIONS}
        capabilities={PROVIDER_CAPABILITIES_FULL}
        now={PROVIDER_NOW}
      />,
    );
    expect(screen.queryByRole("button", { name: /tüm eşleşen|sunucudaki tüm/iu })).toBeNull();
  });

  it("no bulk action is permitted without the permission that backs it", () => {
    const denied = providerBulkActions(PROVIDER_CAPABILITIES_BACKEND_ONLY, {});
    expect(denied.length).toBeGreaterThan(0);
    for (const action of denied) {
      expect(action.allowed).toBe(false);
      expect((action.reason ?? "").length).toBeGreaterThan(10);
      expect(action.label).not.toMatch(/tüm eşleşen|tümünü/iu);
    }
  });
});

/* ------------------------------------------------------ capability honesty */

describe("the capability matrix separates UI readiness from backend reality", () => {
  it("marks every backend-dependent capability as blocked with a reason", () => {
    const ids = blockedProviderCapabilities().map((capability) => capability.id);
    for (const required of [
      "oauth-broker",
      "host-session-bridge",
      "credential-storage",
      "health-probe",
      "credential-rotation",
      "revocation",
      "routing-policy",
      "audit-persistence",
      "usage-metering",
      "budget-enforcement",
    ]) {
      expect(ids).toContain(required);
    }
    for (const capability of blockedProviderCapabilities()) {
      expect(capability.reason.length).toBeGreaterThan(10);
      expect(capability.enabled).toBe(false);
    }
  });

  it("never marks a blocked capability as enabled", () => {
    for (const capability of PROVIDER_CONNECTION_CAPABILITIES) {
      if (capability.backend === "blocked") expect(capability.enabled).toBe(false);
    }
  });

  it("reports UI readiness separately from backend availability", () => {
    const ready = readyProviderCapabilities();
    expect(ready.length).toBeGreaterThan(5);
    for (const capability of ready) expect(capability.ui).toBe("ready");
    expect(ready.some((capability) => capability.backend === "blocked")).toBe(true);
  });

  it("nothing is connected by default", () => {
    // The honest starting point: a fresh deployment has no provider wired up,
    // and no capability claims otherwise.
    const enabled = PROVIDER_CONNECTION_CAPABILITIES.filter((capability) => capability.enabled);
    expect(enabled.every((capability) => capability.backend === "available")).toBe(true);
    expect(PROVIDER_CAPABILITIES_NONE.backend).toEqual([]);
  });
});

/* ----------------------------------------------------- no runtime fixtures */

describe("fixtures and endpoints stay out of the runtime tree", () => {
  it("no subsystem module imports a fixture", () => {
    const offenders = subsystemSourceFiles()
      .filter((file) => /provider-fixtures|PROVIDER_CONNECTIONS\s*=/u.test(readFileSync(file, "utf8")))
      .map((file) => file.replace(process.cwd(), "."));
    expect(offenders).toEqual([]);
  });

  it("no subsystem module invents an endpoint or calls the network", () => {
    const offenders = subsystemSourceFiles().filter((file) => {
      const code = codeOnly(readFileSync(file, "utf8"));
      return /\bfetch\(|XMLHttpRequest|EventSource|\bWebSocket\b/u.test(code);
    });
    expect(offenders).toEqual([]);
  });

  it("the only external URLs are official documentation links", () => {
    const urls = subsystemSourceFiles()
      .flatMap((file) => [...readFileSync(file, "utf8").matchAll(/https?:\/\/[^\s"'`)]+/gu)])
      .map((match) => match[0]);
    expect(urls.length).toBeGreaterThan(4);
    for (const url of urls) expect(url).toMatch(/^https:\/\//u);
  });

  /**
   * Host allowlists, not substring matches.
   *
   * `/openai/iu` against the whole URL would happily accept
   * `https://openai.blogspot.example/`. What has to be true is that the
   * *hostname* is one the vendor controls, so the check parses the URL and
   * compares hosts.
   */
  const FIRST_PARTY_HOSTS: Record<ProviderId, readonly string[]> = {
    gemini: ["ai.google.dev"],
    openai: ["platform.openai.com", "developers.openai.com", "openai.com"],
    claude: ["docs.anthropic.com", "www.anthropic.com"],
    openclaw: ["docs.openclaw.ai"],
  };

  it("every provider's top-level documentation link is on a first-party host", () => {
    for (const provider of PROVIDER_CATALOG) {
      expect(new URL(provider.docsUrl).hostname).toBe(FIRST_PARTY_HOSTS[provider.id][0]);
      expect(providerById(provider.id)?.name).toBe(provider.name);
    }
  });

  it("every method and policy link is on a first-party host too", () => {
    for (const provider of PROVIDER_CATALOG) {
      const allowed = FIRST_PARTY_HOSTS[provider.id];
      const urls = [
        provider.dataRouting.policyUrl,
        ...provider.methods.map((method) => method.docsUrl),
      ];
      for (const url of urls) {
        expect(allowed).toContain(new URL(url).hostname);
      }
    }
  });

  it("all four providers' top-level documentation is confirmed against a first-party source", () => {
    // MASTER live-verified each of these roots. An entry that regressed to
    // `false` would start rendering an unconfirmed-source caveat next to a link
    // that is, in fact, confirmed - so the flag is pinned rather than assumed.
    for (const provider of PROVIDER_CATALOG) {
      expect(provider.docsConfirmed).toBe(true);
    }
  });

  it("still models a provider whose documentation was never confirmed", () => {
    // The flag stays a real axis of the contract: the built-in catalogue is
    // fully confirmed today, but a host injecting a future provider must still
    // be able to say "this link is unverified" and have it shown. The rendering
    // half of that is proved in `provider-components.test.tsx`.
    const unconfirmed = { ...PROVIDER_CATALOG[0]!, id: "openclaw" as ProviderId, docsConfirmed: false };
    expect(unconfirmed.docsConfirmed).toBe(false);
    expect(PROVIDER_CATALOG.some((provider) => provider.docsConfirmed === false)).toBe(false);
  });
});

/* ----------------------------------------------------------- the grid rows */

describe("the inventory grid describes connections without leaking them", () => {
  it("renders one row per loaded connection", async () => {
    render(
      <ConnectionInventory
        connections={PROVIDER_CONNECTIONS}
        capabilities={PROVIDER_CAPABILITIES_FULL}
        now={PROVIDER_NOW}
      />,
    );
    const table = await screen.findByRole("table");
    expect(within(table).getAllByRole("row").length).toBeGreaterThan(PROVIDER_CONNECTIONS.length);
    expect(within(table).getAllByText(/Claude - üretim anahtarı/u).length).toBeGreaterThan(0);
  });

  it("shows the derived status, not the stored one, for a lapsed connection", async () => {
    render(
      <ConnectionInventory
        connections={[CONNECTION_OPENCLAW_STALE]}
        capabilities={PROVIDER_CAPABILITIES_FULL}
        now={PROVIDER_NOW}
      />,
    );
    const table = await screen.findByRole("table");
    expect(within(table).getAllByText(/süresi doldu/iu).length).toBeGreaterThan(0);
    expect(within(table).queryByText(/^bağlı$/iu)).toBeNull();
  });
});
