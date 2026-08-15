/**
 * Component behaviour for the provider connection centre.
 *
 * The acceptance suite next door pins the promises. This file covers the rest
 * of the surface: the catalogue and comparison views, the secret-carrying
 * request path end to end, the editable routing builder, the audit timeline's
 * states, the grid configuration, and the reducer's edges.
 */

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  ConnectionHealthPanel,
  ConnectionInventory,
  ConnectionWizard,
  DataRoutingDisclosure,
  PROVIDER_CAPABILITY_COUNTS,
  PROVIDER_CATALOG,
  ProviderAuditTimeline,
  ProviderCatalogView,
  ProviderComparison,
  RoutingPolicyBuilder,
  SecretField,
  WIZARD_STEPS,
  actionOfferability,
  canAdvance,
  connectionStatusTone,
  daysUntilExpiry,
  effectiveStatus,
  initialWizardState,
  methodOfferability,
  needsAttention,
  providerConnectionsGridConfig,
  trainingLabel,
  wizardReducer,
  type ProviderDescriptor,
} from "./index";
import {
  CONNECTION_CLAUDE_API,
  CONNECTION_CLAUDE_SESSION,
  CONNECTION_GEMINI_REVOKED,
  CONNECTION_OPENCLAW_STALE,
  PROVIDER_AUDIT,
  PROVIDER_CAPABILITIES_BACKEND_ONLY,
  PROVIDER_CAPABILITIES_FULL,
  PROVIDER_CAPABILITIES_NONE,
  PROVIDER_CONNECTIONS,
  PROVIDER_NOW,
  PROVIDER_POLICY,
} from "@/test/provider-fixtures";

const openclaw = PROVIDER_CATALOG.find((entry) => entry.id === "openclaw") as ProviderDescriptor;
const gemini = PROVIDER_CATALOG.find((entry) => entry.id === "gemini") as ProviderDescriptor;

/* ------------------------------------------------------------- catalogue */

describe("the catalogue view", () => {
  it("lists every provider with both its available and unavailable methods", () => {
    render(<ProviderCatalogView capabilities={PROVIDER_CAPABILITIES_FULL} />);
    for (const provider of PROVIDER_CATALOG) {
      expect(screen.getByRole("heading", { name: provider.name })).toBeInTheDocument();
    }
    // Unavailable rows are shown, not hidden: five methods per provider.
    expect(screen.getAllByText(/^Kullanılamaz$/u).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Kullanılabilir$/u).length).toBeGreaterThan(0);
  });

  it("says nothing is connected by default", () => {
    render(<ProviderCatalogView capabilities={PROVIDER_CAPABILITIES_NONE} />);
    expect(screen.getByText(/varsayılan olarak bağlı değildir/iu)).toBeInTheDocument();
  });

  it("marks every method unavailable when the host declared no backend", () => {
    render(<ProviderCatalogView capabilities={PROVIDER_CAPABILITIES_NONE} />);
    expect(screen.queryAllByText(/^Kullanılabilir$/u)).toHaveLength(0);
  });

  it("hands the chosen provider to the caller instead of connecting anything", async () => {
    const onChoose = vi.fn();
    render(<ProviderCatalogView capabilities={PROVIDER_CAPABILITIES_FULL} onChoose={onChoose} />);
    await userEvent.click(screen.getByRole("button", { name: /Claude ile bağlantı kur/u }));
    expect(onChoose).toHaveBeenCalledWith("claude");
  });

  it("shows no unconfirmed-source caveat, because every built-in link is confirmed", () => {
    render(<ProviderCatalogView capabilities={PROVIDER_CAPABILITIES_FULL} />);
    expect(PROVIDER_CATALOG.every((provider) => provider.docsConfirmed)).toBe(true);
    expect(screen.queryAllByText(/Bağlantı adresi doğrulanmadı/iu)).toHaveLength(0);
  });

  it("still flags an injected provider whose documentation link is unconfirmed", () => {
    // The caveat is a general capability of the surface, not a note about one
    // vendor. Confirming every built-in entry must not quietly delete the
    // ability to say "this link is unverified" about the next one.
    const unverified: ProviderDescriptor = { ...gemini, docsConfirmed: false };
    render(
      <ProviderCatalogView capabilities={PROVIDER_CAPABILITIES_FULL} catalog={[unverified]} />,
    );
    expect(screen.getAllByText(/Bağlantı adresi doğrulanmadı/iu).length).toBe(1);
  });

  it("opens external documentation in a new tab with a safe rel", () => {
    render(<ProviderCatalogView capabilities={PROVIDER_CAPABILITIES_FULL} />);
    const link = screen.getAllByRole("link", { name: /belgeleri/iu })[0] as HTMLAnchorElement;
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.rel).toContain("noreferrer");
  });
});

describe("the comparison matrix", () => {
  it("is a real table with a caption and a header per provider", () => {
    render(<ProviderComparison capabilities={PROVIDER_CAPABILITIES_FULL} />);
    const table = screen.getByRole("table");
    expect(within(table).getByText(/karşılaştırması/iu)).toBeInTheDocument();
    for (const provider of PROVIDER_CATALOG) {
      expect(within(table).getByRole("columnheader", { name: provider.name })).toBeInTheDocument();
    }
  });

  it("carries text in every cell rather than a tick", () => {
    render(<ProviderComparison capabilities={PROVIDER_CAPABILITIES_FULL} />);
    const cells = screen.getAllByRole("cell");
    expect(cells.length).toBe(5 * PROVIDER_CATALOG.length);
    for (const cell of cells) {
      expect(cell.textContent ?? "").toMatch(/Kullanıl(abilir|amaz)/u);
    }
  });
});

/* ----------------------------------------------------------- disclosure */

describe("the data routing disclosure", () => {
  it("never claims a training policy this client cannot verify", () => {
    render(<DataRoutingDisclosure provider={gemini} />);
    expect(screen.getByText(/bu istemci doğrulamaz/iu)).toBeInTheDocument();
    expect(trainingLabel(null)).toMatch(/doğrulamaz/iu);
    expect(trainingLabel(false)).toMatch(/yapmadığını bildiriyor/iu);
  });

  it("names the method's mechanism when one is chosen", () => {
    render(<DataRoutingDisclosure provider={openclaw} method="host-auth-profile" />);
    expect(screen.getByText(/yalnızca adıyla seçilir/iu)).toBeInTheDocument();
  });
});

/* --------------------------------------------------------------- wizard */

describe("the wizard's secret-carrying path", () => {
  const apiKeyState = () => {
    let state = wizardReducer(initialWizardState(), {
      type: "provider.select",
      providerId: "gemini",
    });
    state = wizardReducer(state, { type: "method.select", method: "api-key" });
    state = wizardReducer(state, { type: "consent.acknowledge", acknowledged: true });
    state = wizardReducer(state, { type: "next" });
    state = wizardReducer(state, { type: "configure.set", label: "Gemini", complete: true });
    return wizardReducer(state, { type: "next" });
  };

  it("hands the typed key straight to the port and clears the field in the same act", async () => {
    const createConnectionRequest = vi.fn().mockResolvedValue({ requestId: "req-9" });
    render(
      <ConnectionWizard
        capabilities={PROVIDER_CAPABILITIES_FULL}
        port={{ createConnectionRequest }}
        initialState={apiKeyState()}
      />,
    );
    const input = screen.getByLabelText(/API anahtarı/iu) as HTMLInputElement;
    await userEvent.type(input, "AIza-not-a-real-key");
    await userEvent.click(screen.getByRole("button", { name: /bağlantı isteği oluştur/iu }));

    expect(createConnectionRequest).toHaveBeenCalledTimes(1);
    const payload = createConnectionRequest.mock.calls[0]?.[0] as {
      secret?: { value: string; oneTimeUse: boolean };
      providerId: string;
      method: string;
    };
    expect(payload.providerId).toBe("gemini");
    expect(payload.method).toBe("api-key");
    expect(payload.secret?.value).toBe("AIza-not-a-real-key");
    expect(payload.secret?.oneTimeUse).toBe(true);
    expect(input.value).toBe("");
    expect(await screen.findByText(/sunucu yanıtı bekleniyor/iu)).toBeInTheDocument();
  });

  it("reports a rejected request without inventing a connection", async () => {
    const createConnectionRequest = vi.fn().mockRejectedValue(new Error("Ağ geçidi yanıt vermedi"));
    render(
      <ConnectionWizard
        capabilities={PROVIDER_CAPABILITIES_FULL}
        port={{ createConnectionRequest }}
        initialState={apiKeyState()}
      />,
    );
    await userEvent.type(screen.getByLabelText(/API anahtarı/iu), "AIza-not-a-real-key");
    await userEvent.click(screen.getByRole("button", { name: /bağlantı isteği oluştur/iu }));

    // Said twice on purpose: once on the request line, once as a field error.
    expect((await screen.findAllByText(/Ağ geçidi yanıt vermedi/u)).length).toBeGreaterThan(0);
    expect(screen.queryByText(/^Bağlı$/u)).toBeNull();
  });

  it("moves to the summary only when the caller supplies a connection", async () => {
    const { rerender } = render(
      <ConnectionWizard capabilities={PROVIDER_CAPABILITIES_FULL} initialState={apiKeyState()} />,
    );
    expect(screen.queryByText(/^Bağlı$/u)).toBeNull();

    rerender(
      <ConnectionWizard
        capabilities={PROVIDER_CAPABILITIES_FULL}
        initialState={apiKeyState()}
        result={CONNECTION_CLAUDE_API}
        now={PROVIDER_NOW}
      />,
    );
    expect(await screen.findByText(/^Bağlı$/u)).toBeInTheDocument();
  });
});

describe("the wizard's navigation", () => {
  it("starts on the provider step with nothing chosen", () => {
    render(<ConnectionWizard capabilities={PROVIDER_CAPABILITIES_FULL} />);
    expect(screen.getByRole("radio", { name: /Google Gemini/u })).not.toBeChecked();
    expect(screen.getByRole("button", { name: /^Devam$/u })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Geri$/u })).toBeDisabled();
  });

  it("advances through the steps as choices are made", async () => {
    render(<ConnectionWizard capabilities={PROVIDER_CAPABILITIES_FULL} />);
    await userEvent.click(screen.getByRole("radio", { name: /Google Gemini/u }));
    expect(screen.getByRole("heading", { name: /Yöntem/u })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: /Google ile yetkilendir/u }));
    expect(screen.getByRole("heading", { name: /Veri bildirimi/u })).toBeInTheDocument();
  });

  it("changing the provider drops the method chosen for the previous one", () => {
    let state = wizardReducer(initialWizardState(), {
      type: "provider.select",
      providerId: "gemini",
    });
    state = wizardReducer(state, { type: "method.select", method: "oauth" });
    expect(state.method).toBe("oauth");
    // OpenClaw has no OAuth path; carrying the old choice over would leave the
    // wizard holding a method its provider does not support.
    const switched = wizardReducer(state, { type: "provider.select", providerId: "openclaw" });
    expect(switched.method).toBeNull();
    expect(switched.consentAcknowledged).toBe(false);
  });

  it("the summary is terminal until the operator starts again", () => {
    const reviewed = wizardReducer(
      wizardReducer(initialWizardState(), { type: "provider.select", providerId: "claude" }),
      { type: "backend.result", connection: CONNECTION_CLAUDE_API },
    );
    expect(reviewed.step).toBe("review");
    expect(wizardReducer(reviewed, { type: "back" }).step).toBe("review");
    expect(wizardReducer(reviewed, { type: "reset" })).toEqual(initialWizardState());
  });

  it("ignores a method chosen before a provider", () => {
    const stray = wizardReducer(initialWizardState(), { type: "method.select", method: "api-key" });
    expect(stray.method).toBeNull();
  });

  it("ignores a request acknowledgement that was never asked for", () => {
    const stray = wizardReducer(initialWizardState(), {
      type: "request.created",
      requestId: "req-1",
    });
    expect(stray.request).toBeNull();
    expect(stray.result).toBeNull();
  });

  it("refuses to advance from a blank configuration label", () => {
    let state = wizardReducer(initialWizardState(), {
      type: "provider.select",
      providerId: "claude",
    });
    state = wizardReducer(state, { type: "method.select", method: "host-session" });
    state = wizardReducer(state, { type: "consent.acknowledge", acknowledged: true });
    state = wizardReducer(state, { type: "next" });
    state = wizardReducer(state, { type: "configure.set", label: "   ", complete: true });
    expect(canAdvance(state)).toBe(false);
  });

  it("has one step label per step", () => {
    expect(WIZARD_STEPS).toHaveLength(6);
    render(<ConnectionWizard capabilities={PROVIDER_CAPABILITIES_FULL} />);
    expect(screen.getByRole("navigation", { name: /Bağlantı adımları/u })).toBeInTheDocument();
  });
});

/* --------------------------------------------------------- health panel */

describe("the health panel", () => {
  it("renders the injected rate limits and budget without computing any of them", () => {
    render(
      <ConnectionHealthPanel
        connection={CONNECTION_CLAUDE_API}
        capabilities={PROVIDER_CAPABILITIES_FULL}
        now={PROVIDER_NOW}
      />,
    );
    expect(screen.getByText(/128 \/ 4\.000/u)).toBeInTheDocument();
    expect(screen.getByText(/412,5 \/ 1\.000 USD/u)).toBeInTheDocument();
    expect(screen.getAllByText(/yalnızca sunucu uygulayabilir/iu).length).toBeGreaterThan(0);
  });

  it("shows an em dash rather than a zero for a limit nobody reported", () => {
    render(
      <ConnectionHealthPanel
        connection={CONNECTION_OPENCLAW_STALE}
        capabilities={PROVIDER_CAPABILITIES_FULL}
        now={PROVIDER_NOW}
      />,
    );
    expect(screen.getByText("— / —")).toBeInTheDocument();
  });

  it("explains when the stored status and the shown status disagree", () => {
    render(
      <ConnectionHealthPanel
        connection={CONNECTION_OPENCLAW_STALE}
        capabilities={PROVIDER_CAPABILITIES_FULL}
        now={PROVIDER_NOW}
      />,
    );
    expect(screen.getByText(/Kayıtlı durum ile gösterilen durum farklı/iu)).toBeInTheDocument();
  });

  it("says a connection was never probed rather than showing a blank", () => {
    render(
      <ConnectionHealthPanel
        connection={{ ...CONNECTION_CLAUDE_API, lastCheckedAt: null }}
        capabilities={PROVIDER_CAPABILITIES_FULL}
        now={PROVIDER_NOW}
      />,
    );
    expect(screen.getByText(/Hiç yoklanmadı/u)).toBeInTheDocument();
  });

  it("renders the audit entries it is handed", () => {
    render(
      <ConnectionHealthPanel
        connection={CONNECTION_CLAUDE_API}
        capabilities={PROVIDER_CAPABILITIES_FULL}
        audit={PROVIDER_AUDIT.filter((entry) => entry.connectionId === CONNECTION_CLAUDE_API.id)}
        now={PROVIDER_NOW}
      />,
    );
    expect(screen.getByText(/Sunucu bağlantıyı kurdu — Sunucu/u)).toBeInTheDocument();
  });

  it("tells the operator which connections need attention", () => {
    expect(needsAttention(CONNECTION_CLAUDE_API, PROVIDER_NOW)).toBe(false);
    expect(needsAttention(CONNECTION_CLAUDE_SESSION, PROVIDER_NOW)).toBe(true);
    expect(needsAttention(CONNECTION_GEMINI_REVOKED, PROVIDER_NOW)).toBe(true);
  });

  it("counts the days left, and reports a lapsed one as past", () => {
    expect(daysUntilExpiry(CONNECTION_CLAUDE_API, PROVIDER_NOW)).toBeNull();
    expect(daysUntilExpiry(CONNECTION_OPENCLAW_STALE, PROVIDER_NOW)).toBeLessThan(0);
    expect(daysUntilExpiry(CONNECTION_CLAUDE_SESSION, PROVIDER_NOW)).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------- routing policy */

describe("the routing policy builder", () => {
  const editable = () => ({
    policy: PROVIDER_POLICY,
    connections: PROVIDER_CONNECTIONS,
    capabilities: PROVIDER_CAPABILITIES_FULL,
    now: PROVIDER_NOW,
  });

  it("defaults to failing closed rather than substituting a different model", () => {
    render(<RoutingPolicyBuilder {...editable()} />);
    expect(screen.getByRole("radio", { name: /Kapalı düş/u })).toBeChecked();
  });

  it("warns when an enabled rule points at a connection that is not healthy", () => {
    render(
      <RoutingPolicyBuilder
        {...editable()}
        policy={{
          degradation: "next-in-order",
          rules: [
            { connectionId: "c-openclaw-gateway", priority: 1, modelAllowlist: [], enabled: true },
          ],
        }}
      />,
    );
    expect(screen.getByText(/şu anda sağlıklı değil/iu)).toBeInTheDocument();
  });

  it("refuses to save while two rules claim the same priority", async () => {
    const saveRoutingPolicy = vi.fn();
    render(<RoutingPolicyBuilder {...editable()} port={{ saveRoutingPolicy }} />);
    const priorities = screen.getAllByRole("spinbutton");
    await userEvent.clear(priorities[1] as HTMLInputElement);
    await userEvent.type(priorities[1] as HTMLInputElement, "1");

    expect(screen.getByRole("alert")).toHaveTextContent(/Aynı önceliğe sahip/u);
    expect(screen.getByRole("button", { name: /Politikayı kaydet/u })).toBeDisabled();
    expect(saveRoutingPolicy).not.toHaveBeenCalled();
  });

  it("hands the draft to the caller and never applies it itself", async () => {
    const saveRoutingPolicy = vi.fn();
    render(<RoutingPolicyBuilder {...editable()} port={{ saveRoutingPolicy }} />);
    await userEvent.click(screen.getByRole("radio", { name: /Sıradaki bağlantıya geç/u }));
    await userEvent.click(screen.getByRole("button", { name: /Politikayı kaydet/u }));
    expect(saveRoutingPolicy).toHaveBeenCalledWith(
      expect.objectContaining({ degradation: "next-in-order" }),
    );
  });

  it("names a rule whose connection was never loaded instead of hiding it", () => {
    render(
      <RoutingPolicyBuilder
        {...editable()}
        connections={[]}
      />,
    );
    expect(screen.getAllByText(/Bu bağlantı yüklenmedi/u).length).toBe(PROVIDER_POLICY.rules.length);
  });

  it("cannot save without a callback, even with permission and a router", () => {
    render(<RoutingPolicyBuilder {...editable()} />);
    expect(screen.getByRole("button", { name: /Politikayı kaydet/u })).toBeDisabled();
  });
});

/* ----------------------------------------------------------- audit view */

describe("the audit timeline", () => {
  it("distinguishes an empty list from a quiet system", () => {
    render(<ProviderAuditTimeline entries={[]} capabilities={PROVIDER_CAPABILITIES_FULL} />);
    expect(screen.getByText(/Bu ekrana hiç kayıt verilmedi/u)).toBeInTheDocument();
    expect(screen.getByText(/hiçbir şey olmadığı anlamına gelmez/iu)).toBeInTheDocument();
  });

  it("says it is not a durable audit trail when nothing persists it", () => {
    render(
      <ProviderAuditTimeline entries={PROVIDER_AUDIT} capabilities={PROVIDER_CAPABILITIES_NONE} />,
    );
    // No permission: the list is not rendered at all, and the reason is named.
    expect(screen.getByText(/yetkiniz tanımlı değil/iu)).toBeInTheDocument();
  });

  it("renders the entries when the actor may see them", () => {
    render(
      <ProviderAuditTimeline entries={PROVIDER_AUDIT} capabilities={PROVIDER_CAPABILITIES_FULL} />,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(PROVIDER_AUDIT.length);
    // This host declared `auditPersistence`, so the "not a real audit trail"
    // caveat is correctly absent.
    expect(screen.queryByText(/kalıcı bir denetim izi değildir/iu)).toBeNull();
  });

  it("warns that the list is not an audit trail when nothing persists it", () => {
    render(
      <ProviderAuditTimeline
        entries={PROVIDER_AUDIT}
        capabilities={{ backend: [], permissions: PROVIDER_CAPABILITIES_FULL.permissions }}
      />,
    );
    expect(screen.getByText(/kalıcı bir denetim izi değildir/iu)).toBeInTheDocument();
  });

  it("shows a skeleton rather than an empty state while loading", () => {
    render(
      <ProviderAuditTimeline
        entries={[]}
        capabilities={PROVIDER_CAPABILITIES_FULL}
        status="loading"
      />,
    );
    expect(screen.queryByText(/Bu ekrana hiç kayıt verilmedi/u)).toBeNull();
  });
});

/* ------------------------------------------------------------- inventory */

describe("the inventory", () => {
  const props = {
    connections: PROVIDER_CONNECTIONS,
    capabilities: PROVIDER_CAPABILITIES_FULL,
    now: PROVIDER_NOW,
  };

  it("says how many rows it is showing", () => {
    render(<ConnectionInventory {...props} />);
    expect(
      screen.getByText(new RegExp(`${PROVIDER_CONNECTIONS.length} bağlantıyı gösterir`, "u")),
    ).toBeInTheDocument();
  });

  it("explains the empty state without implying a clean slate", () => {
    render(<ConnectionInventory {...props} connections={[]} />);
    expect(screen.getByText(/Bağlı sağlayıcı yok/u)).toBeInTheDocument();
    expect(screen.getByText(/kendiliğinden bağlanmaz/iu)).toBeInTheDocument();
  });

  it("surfaces a load error with a retry rather than an empty table", async () => {
    const onRefresh = vi.fn();
    render(
      <ConnectionInventory {...props} status="error" errorMessage="Liste okunamadı" onRefresh={onRefresh} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /tekrar|yeniden/iu }));
    expect(onRefresh).toHaveBeenCalled();
  });

  it("keeps the status column from being hidden", () => {
    const config = providerConnectionsGridConfig(PROVIDER_CAPABILITIES_FULL, PROVIDER_NOW);
    const status = config.columns.find((column) => column.id === "status");
    expect(status?.hideable).toBe(false);
  });

  it("names the selection, never the result set", () => {
    const config = providerConnectionsGridConfig(PROVIDER_CAPABILITIES_FULL, PROVIDER_NOW);
    for (const action of config.bulkActions ?? []) {
      expect(action.label).toMatch(/^Seçili/u);
    }
    expect(config.caption).toMatch(/yüklenmiş/u);
  });
});

/* ---------------------------------------------------------- the gates */

describe("the offerability gates", () => {
  it("names the missing permission before the missing backend", () => {
    const gate = actionOfferability(PROVIDER_CAPABILITIES_NONE, "canRotate", "credentialRotation", vi.fn());
    expect(gate.reason).toMatch(/yetkiniz/iu);
  });

  it("names the missing backend once the permission is there", () => {
    const gate = actionOfferability(
      { backend: [], permissions: PROVIDER_CAPABILITIES_FULL.permissions },
      "canRotate",
      "credentialRotation",
      vi.fn(),
    );
    expect(gate.reason).toMatch(/sunucu tarafında tanımlı değil/iu);
  });

  it("names the missing callback last", () => {
    const gate = actionOfferability(
      PROVIDER_CAPABILITIES_FULL,
      "canRotate",
      "credentialRotation",
      undefined,
    );
    expect(gate.reason).toMatch(/devralmadı/iu);
  });

  it("refuses an unsupported method even when the host could broker it", () => {
    // Backend can do everything; the vendor still does not publish this door.
    const gate = methodOfferability(PROVIDER_CAPABILITIES_BACKEND_ONLY, "claude", "oauth");
    expect(gate.offerable).toBe(false);
    expect(gate.reason).toMatch(/tüketici hesabı OAuth/iu);
  });

  it("counts more blocked capabilities than enabled ones, and says so", () => {
    expect(PROVIDER_CAPABILITY_COUNTS.backendBlocked).toBeGreaterThan(
      PROVIDER_CAPABILITY_COUNTS.enabled,
    );
  });
});

/* -------------------------------------------------------------- tones */

describe("status tones", () => {
  it("gives the affirmative tone to exactly one status", () => {
    const tones = (
      ["disconnected", "pending", "connected", "degraded", "expired", "revoked", "error"] as const
    ).map(connectionStatusTone);
    expect(tones.filter((tone) => tone === "candidate")).toHaveLength(1);
  });

  it("derives the status from the clock, not from the record alone", () => {
    const before = new Date("2026-07-31T00:00:00Z");
    expect(effectiveStatus(CONNECTION_OPENCLAW_STALE, before)).toBe("connected");
    expect(effectiveStatus(CONNECTION_OPENCLAW_STALE, PROVIDER_NOW)).toBe("expired");
  });

  it("leaves an unparseable expiry alone rather than guessing", () => {
    const broken = { ...CONNECTION_CLAUDE_API, expiresAt: "yakında" };
    expect(effectiveStatus(broken, PROVIDER_NOW)).toBe("connected");
    expect(daysUntilExpiry(broken, PROVIDER_NOW)).toBeNull();
  });
});

/* ------------------------------------------------------------ secret UI */

describe("the secret field's remaining states", () => {
  it("refuses an empty submit and says why", async () => {
    const onSubmit = vi.fn();
    render(<SecretField fieldId="api-key" label="API anahtarı" onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: /aktar/iu }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/boş/u);
  });

  it("offers copy only after an explicit reveal, when a caller opted in", async () => {
    render(<SecretField fieldId="api-key" label="API anahtarı" allowCopy onSubmit={vi.fn()} />);
    const copy = screen.getByRole("button", { name: /kopyala/iu });
    expect(copy).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/API anahtarı/iu), "abc");
    expect(copy).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: /göster/iu }));
    expect(copy).toBeEnabled();
  });

  it("states why it is inert when no transport was given", () => {
    render(
      <SecretField
        fieldId="api-key"
        label="API anahtarı"
        disabled
        disabledReason="Anahtarı devralacak bir uç yok."
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/API anahtarı/iu)).toBeDisabled();
    expect(screen.getByRole("note")).toHaveTextContent(/uç yok/u);
  });
});
