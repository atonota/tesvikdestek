/**
 * RED acceptance suite for the media and file library.
 *
 * Written before the implementation. Every assertion here encodes a promise the
 * owner made about this subsystem, and each one is a promise that is cheap to
 * break silently later:
 *
 *  - the master components exist and are reachable from the shared barrel;
 *  - the upload queue is a real state machine with terminal states, not a bag
 *    of booleans that can report "completed" from nowhere;
 *  - S3 is optional in the strong sense - absent capability means absent UI,
 *    and no AWS dependency exists at all;
 *  - an unscanned file is never described as clean;
 *  - no raw `File` and no browser storage is used by this module;
 *  - the file picker is reachable by keyboard, not drag-only;
 *  - the capability matrix separates "the component is ready" from "the backend
 *    can do this", and never renders a blocked capability as a working control.
 *
 * These are behavioural assertions, not import smoke tests: each one fails
 * against a wrong implementation, not merely against a missing file.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import * as Barrel from "@/components";
import {
  MEDIA_CAPABILITIES,
  MediaGovernancePanel,
  MediaLibrary,
  MediaStoragePanel,
  MediaUploadPanel,
  blockedMediaCapabilities,
  isTreatedAsClean,
  readyMediaCapabilities,
  scanStateLabel,
  storageTargets,
  uploadReducer,
  type MediaAsset,
  type UploadItem,
} from "./index";
import {
  MEDIA_ASSETS,
  MEDIA_CAPABILITIES_LOCAL_ONLY,
  MEDIA_CAPABILITIES_WITH_S3,
  MEDIA_CAPABILITIES_WRITABLE,
  MEDIA_STORAGE_LOCAL,
  MEDIA_STORAGE_WITH_S3,
} from "@/test/media-fixtures";

const MEDIA_DIR = join(process.cwd(), "src", "components", "media");

function mediaSourceFiles(): string[] {
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
  walk(MEDIA_DIR);
  return found;
}

/** Strips comments so a rule that *discusses* a token does not trip on it. */
function codeOnly(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/(^|[^:])\/\/.*$/gmu, "$1");
}

function queued(overrides: Partial<UploadItem> = {}): UploadItem {
  return {
    id: "u1",
    fileName: "imza-sirkuleri.pdf",
    sizeBytes: 1024,
    declaredType: "application/pdf",
    phase: "queued",
    progress: 0,
    contentHash: null,
    outcome: null,
    error: null,
    attempts: 0,
    ...overrides,
  };
}

/* ------------------------------------------------------- exported surface */

describe("the media subsystem is exported as one coherent surface", () => {
  const REQUIRED_COMPONENTS = [
    "MediaLibrary",
    "MediaUploadPanel",
    "MediaOrganizer",
    "MediaDetails",
    "MediaGovernancePanel",
    "MediaStoragePanel",
  ] as const;

  it.each(REQUIRED_COMPONENTS)("%s is re-exported from @/components", (name) => {
    expect(typeof (Barrel as Record<string, unknown>)[name]).toBe("function");
  });

  it("exports the contracts a future backend port has to satisfy", () => {
    for (const name of [
      "uploadReducer",
      "initialUploadItem",
      "storageTargets",
      "isTreatedAsClean",
      "scanStateLabel",
      "readyMediaCapabilities",
      "blockedMediaCapabilities",
      "mediaAssetsGridConfig",
    ]) {
      expect(typeof (Barrel as Record<string, unknown>)[name]).toBe("function");
    }
    expect(Array.isArray((Barrel as Record<string, unknown>)["MEDIA_CAPABILITIES"])).toBe(true);
  });
});

/* --------------------------------------------------- upload state machine */

describe("the upload queue is a state machine with real invariants", () => {
  it("cannot reach completed without having uploaded", () => {
    // A completion event against a queued item is not a transition; if this
    // passed, a component could paint "yüklendi" for a file that never moved.
    const item = queued();
    const next = uploadReducer(item, { type: "upload.complete", assetId: "a1" });
    expect(next.phase).toBe("queued");
    expect(next).toBe(item);
  });

  it("walks the full happy path in order", () => {
    let item = queued();
    item = uploadReducer(item, { type: "validate.start" });
    expect(item.phase).toBe("validating");
    item = uploadReducer(item, { type: "validate.ok", contentHash: "a".repeat(64) });
    expect(item.phase).toBe("queued");
    expect(item.contentHash).toBe("a".repeat(64));
    item = uploadReducer(item, { type: "upload.start" });
    expect(item.phase).toBe("uploading");
    item = uploadReducer(item, { type: "upload.progress", progress: 40 });
    expect(item.progress).toBe(40);
    item = uploadReducer(item, { type: "upload.complete", assetId: "a1" });
    expect(item.phase).toBe("completed");
    expect(item.progress).toBe(100);
  });

  it("treats completed and cancelled as terminal", () => {
    const done = uploadReducer(
      uploadReducer(queued({ phase: "uploading" }), { type: "upload.complete", assetId: "a1" }),
      { type: "upload.start" },
    );
    expect(done.phase).toBe("completed");

    const cancelled = uploadReducer(uploadReducer(queued(), { type: "cancel" }), {
      type: "upload.start",
    });
    expect(cancelled.phase).toBe("cancelled");
  });

  it("pauses and resumes without losing progress", () => {
    let item = uploadReducer(queued({ phase: "uploading", progress: 55 }), {
      type: "upload.pause",
    });
    expect(item.phase).toBe("paused");
    expect(item.progress).toBe(55);
    item = uploadReducer(item, { type: "upload.resume" });
    expect(item.phase).toBe("uploading");
    expect(item.progress).toBe(55);
  });

  it("never lets progress go backwards or leave 0..100", () => {
    const item = queued({ phase: "uploading", progress: 60 });
    expect(uploadReducer(item, { type: "upload.progress", progress: 10 }).progress).toBe(60);
    expect(uploadReducer(item, { type: "upload.progress", progress: 999 }).progress).toBe(100);
    expect(uploadReducer(item, { type: "upload.progress", progress: -5 }).progress).toBe(60);
  });

  it("counts attempts on retry and clears the previous error", () => {
    const failed = uploadReducer(queued({ phase: "uploading" }), {
      type: "upload.fail",
      message: "Ağ hatası",
    });
    expect(failed.phase).toBe("failed");
    expect(failed.error).toBe("Ağ hatası");

    const retried = uploadReducer(failed, { type: "retry" });
    expect(retried.phase).toBe("queued");
    expect(retried.attempts).toBe(1);
    expect(retried.error).toBeNull();
  });

  it("a rejected file never becomes an upload", () => {
    // Duplicate and quota are decisions, not failures to retry into existence.
    for (const outcome of ["duplicate", "quota-exceeded", "too-large", "type-rejected"] as const) {
      const rejected = uploadReducer(queued({ phase: "validating" }), {
        type: "validate.reject",
        outcome,
        message: "reddedildi",
      });
      expect(rejected.phase).toBe("failed");
      expect(rejected.outcome).toBe(outcome);
      expect(uploadReducer(rejected, { type: "upload.start" }).phase).toBe("failed");
    }
  });
});

/* -------------------------------------------------- no File, no storage */

describe("nothing durable and nothing raw is kept in the browser", () => {
  it("no media module touches browser storage", () => {
    const offenders = mediaSourceFiles()
      .filter((file) =>
        /\b(localStorage|sessionStorage|indexedDB)\b/u.test(codeOnly(readFileSync(file, "utf8"))),
      )
      .map((file) => file.replace(process.cwd(), "."));
    expect(offenders).toEqual([]);
  });

  it("no media module persists or serialises a File or Blob", () => {
    const offenders = mediaSourceFiles().filter((file) => {
      const code = codeOnly(readFileSync(file, "utf8"));
      return /JSON\.stringify\([^)]*\b(file|blob)\b/iu.test(code) || /\bnew\s+FileReader\b/u.test(code);
    });
    expect(offenders).toEqual([]);
  });

  it("the queue item type carries metadata, never the file handle", () => {
    const source = readFileSync(join(MEDIA_DIR, "types.ts"), "utf8");
    const block = source.slice(
      source.indexOf("interface UploadItem"),
      source.indexOf("}", source.indexOf("interface UploadItem")),
    );
    expect(block).not.toMatch(/:\s*File\b/u);
    expect(block).not.toMatch(/:\s*Blob\b/u);
    expect(block).toMatch(/fileName/u);
    expect(block).toMatch(/sizeBytes/u);
  });
});

/* ------------------------------------------------------- S3 is optional */

describe("S3 is optional in the strong sense", () => {
  it("declares no AWS or S3 dependency", () => {
    const manifest = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    const names = [
      ...Object.keys(manifest.dependencies),
      ...Object.keys(manifest.devDependencies),
    ];
    expect(names.filter((name) => /aws|s3-|minio|@aws-sdk/iu.test(name))).toEqual([]);
  });

  it("defaults to durable local storage when no capability is injected", () => {
    const targets = storageTargets(MEDIA_CAPABILITIES_LOCAL_ONLY);
    expect(targets.map((target) => target.id)).toEqual(["local"]);
    expect(targets[0]?.isDefault).toBe(true);
  });

  it("shows no S3 surface when S3 is unavailable", () => {
    render(<MediaStoragePanel storage={MEDIA_STORAGE_LOCAL} capabilities={MEDIA_CAPABILITIES_LOCAL_ONLY} />);
    // The invariant is the absence of an S3 *surface*, not the absence of the
    // three characters: the local target's copy legitimately says it works
    // without S3, and banning the word would ban that sentence too.
    expect(screen.queryByRole("heading", { name: /S3/u })).toBeNull();
    expect(screen.getAllByText(/yerel disk/iu).length).toBeGreaterThan(0);
  });

  it("shows S3 only when an injected capability says it is available", () => {
    render(<MediaStoragePanel storage={MEDIA_STORAGE_WITH_S3} capabilities={MEDIA_CAPABILITIES_WITH_S3} />);
    expect(screen.getByRole("heading", { name: /S3/u })).toBeInTheDocument();
    expect(storageTargets(MEDIA_CAPABILITIES_WITH_S3).map((target) => target.id)).toEqual([
      "local",
      "s3",
    ]);
  });
});

/* ------------------------------------------- unscanned is never clean */

describe("an unscanned file is never presented as clean", () => {
  it("only an actual clean verdict counts as clean", () => {
    expect(isTreatedAsClean("clean")).toBe(true);
    for (const state of ["unscanned", "pending", "infected", "failed", "unavailable"] as const) {
      expect(isTreatedAsClean(state)).toBe(false);
    }
  });

  it("no non-clean state is labelled with a reassuring word", () => {
    for (const state of ["unscanned", "pending", "failed", "unavailable"] as const) {
      expect(scanStateLabel(state)).not.toMatch(/temiz|güvenli|sorunsuz/iu);
    }
  });

  it("the governance panel says a file was not scanned rather than staying silent", () => {
    const asset = MEDIA_ASSETS.find((item) => item.scanState === "unscanned") as MediaAsset;
    render(<MediaGovernancePanel asset={asset} capabilities={MEDIA_CAPABILITIES_LOCAL_ONLY} />);
    // Said more than once - badge, explanation and the standing notice - which
    // is the point: the panel is loud about it rather than merely not lying.
    expect(screen.getAllByText(/taranmadı/iu).length).toBeGreaterThan(0);
    expect(screen.queryByText(/^temiz$/iu)).toBeNull();
  });
});

/* ------------------------------------------------ accessible file picker */

describe("the file picker is operable without a mouse", () => {
  it("exposes a real labelled file input, not a drag-only target", async () => {
    const onUpload = vi.fn();
    // Both halves are required for a live control: a transport *and* the
    // permission. The local-only default grants neither, which is checked
    // separately below.
    render(
      <MediaUploadPanel capabilities={MEDIA_CAPABILITIES_WRITABLE} onUpload={onUpload} items={[]} />,
    );
    const input = screen.getByLabelText(/dosya seç/iu);
    expect(input).toHaveAttribute("type", "file");
    expect(input).toBeEnabled();

    // Reachable by keyboard alone, and exactly one tab stop carries that name -
    // a drop zone plus a duplicate button would be two.
    await userEvent.tab();
    expect(input).toHaveFocus();
    expect(screen.queryAllByLabelText(/dosya seç/iu)).toHaveLength(1);
  });

  it("announces the queue through a live region", () => {
    render(
      <MediaUploadPanel
        capabilities={MEDIA_CAPABILITIES_LOCAL_ONLY}
        onUpload={vi.fn()}
        items={[queued({ phase: "uploading", progress: 30 })]}
      />,
    );
    const status = screen.getByRole("status");
    expect(within(status).getByText(/1/u)).toBeInTheDocument();
  });

  it("refuses to offer uploading at all when no transport callback is given", () => {
    // Without `onUpload` nothing can carry bytes anywhere. Rendering an enabled
    // control here would let the UI report a success that never happened.
    render(<MediaUploadPanel capabilities={MEDIA_CAPABILITIES_LOCAL_ONLY} items={[]} />);
    expect(screen.getByLabelText(/dosya seç/iu)).toBeDisabled();
    expect(screen.getByText(/yükleme ucu yok/iu)).toBeInTheDocument();
  });
});

/* ----------------------------------------------------- capability honesty */

describe("the capability matrix separates UI readiness from backend reality", () => {
  it("marks every backend-dependent capability as blocked with a reason", () => {
    const blocked = blockedMediaCapabilities();
    const ids = blocked.map((capability) => capability.id);
    for (const required of [
      "streaming-upload",
      "download-range",
      "durable-metadata",
      "antivirus",
      "derivatives",
      "audit-persistence",
      "rbac",
      "quota-enforcement",
      "retention-purge",
      "s3-adapter",
    ]) {
      expect(ids).toContain(required);
    }
    for (const capability of blocked) {
      expect(capability.reason.length).toBeGreaterThan(10);
      expect(capability.enabled).toBe(false);
    }
  });

  it("never marks a blocked capability as enabled", () => {
    for (const capability of MEDIA_CAPABILITIES) {
      if (capability.backend === "blocked") expect(capability.enabled).toBe(false);
    }
  });

  it("reports UI readiness separately from backend availability", () => {
    const ready = readyMediaCapabilities();
    expect(ready.length).toBeGreaterThan(5);
    for (const capability of ready) expect(capability.ui).toBe("ready");
    // Component readiness must not be laundered into backend availability.
    expect(ready.some((capability) => capability.backend === "blocked")).toBe(true);
  });

  it("the library renders no control for a blocked bulk action", async () => {
    render(
      <MediaLibrary
        assets={MEDIA_ASSETS}
        capabilities={MEDIA_CAPABILITIES_LOCAL_ONLY}
        status="idle"
      />,
    );
    const grid = await screen.findByRole("table");
    expect(within(grid).queryByRole("button", { name: /kalıcı olarak sil/iu })).toBeNull();
  });
});

/* ------------------------------------------------------- no fake success */

describe("the runtime never fabricates a successful upload", () => {
  it("no media module simulates progress with a timer", () => {
    const offenders = mediaSourceFiles().filter((file) => {
      const code = codeOnly(readFileSync(file, "utf8"));
      return /setInterval\s*\(|setTimeout\s*\([^,]+,\s*\d+\s*\)\s*;?\s*\/\/\s*progress/u.test(code);
    });
    expect(offenders).toEqual([]);
  });

  it("no media module ships fixture rows", () => {
    // Fixtures live in src/test and are imported by tests and stories only.
    const offenders = mediaSourceFiles().filter((file) =>
      /media-fixtures|MEDIA_ASSETS\s*=/u.test(codeOnly(readFileSync(file, "utf8"))),
    );
    expect(offenders).toEqual([]);
  });
});
