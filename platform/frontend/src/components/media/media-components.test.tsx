/**
 * Component behaviour, accessibility and the honest-state contract.
 *
 * Complements the acceptance suite: that file pins the promises, this one pins
 * the rendering - keyboard behaviour in the tree, which controls are disabled
 * and why, what each surface state actually shows, and the vocabulary and
 * capability helpers that back all of it.
 */

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import {
  FolderTree,
  MediaDetails,
  MediaGovernancePanel,
  MediaLibrary,
  MediaOrganizer,
  MediaStoragePanel,
  MediaUploadPanel,
  compareVersions,
  enabledMediaCapabilities,
  formatBytes,
  hasScanVerdict,
  isDownloadBlocked,
  lifecycleLabel,
  mediaBulkActions,
  mediaCapabilityById,
  mimeLabel,
  scanStateExplanation,
  scanStateTone,
  storageBackendLabel,
  uploadPhaseLabel,
  MEDIA_CAPABILITY_COUNTS,
} from "./index";
import type { MediaAsset } from "./types";
import {
  MEDIA_ASSETS,
  MEDIA_AUDIT,
  MEDIA_CAPABILITIES_LOCAL_ONLY,
  MEDIA_CAPABILITIES_WITH_S3,
  MEDIA_CAPABILITIES_WRITABLE,
  MEDIA_FOLDERS,
  MEDIA_STORAGE_LOCAL,
  MEDIA_STORAGE_QUOTA_EXCEEDED,
  MEDIA_STORAGE_WITH_S3,
  MEDIA_VERSIONS,
} from "@/test/media-fixtures";

function renderRouted(node: React.ReactNode) {
  return render(<MemoryRouter>{node}</MemoryRouter>);
}

const unscanned = MEDIA_ASSETS.find((a) => a.scanState === "unscanned") as MediaAsset;
const infected = MEDIA_ASSETS.find((a) => a.scanState === "infected") as MediaAsset;
const clean = MEDIA_ASSETS.find((a) => a.scanState === "clean") as MediaAsset;
const held = MEDIA_ASSETS.find((a) => a.retention.legalHold) as MediaAsset;

/* ---------------------------------------------------------------- library */

describe("MediaLibrary", () => {
  it("renders a captioned table of the assets it was given", async () => {
    renderRouted(
      <MediaLibrary assets={MEDIA_ASSETS} capabilities={MEDIA_CAPABILITIES_LOCAL_ONLY} />,
    );
    const table = await screen.findByRole("table");
    expect(within(table).getByText(unscanned.fileName)).toBeInTheDocument();
  });

  it("always says nothing is persisted yet", () => {
    renderRouted(
      <MediaLibrary assets={MEDIA_ASSETS} capabilities={MEDIA_CAPABILITIES_LOCAL_ONLY} />,
    );
    expect(screen.getByText(/kalıcı olarak saklamıyor/iu)).toBeInTheDocument();
  });

  it("filters by folder and offers a way back", async () => {
    renderRouted(
      <MediaLibrary
        assets={MEDIA_ASSETS}
        capabilities={MEDIA_CAPABILITIES_LOCAL_ONLY}
        folders={MEDIA_FOLDERS}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /mali tablolar/iu }));
    const table = await screen.findByRole("table");
    expect(within(table).queryByText(unscanned.fileName)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^tümü$/iu }));
    expect(within(await screen.findByRole("table")).getByText(unscanned.fileName)).toBeInTheDocument();
  });

  it("shows an empty-folder state rather than an empty table", async () => {
    renderRouted(
      <MediaLibrary
        assets={MEDIA_ASSETS}
        capabilities={MEDIA_CAPABILITIES_LOCAL_ONLY}
        folders={[{ id: "f-bos", name: "Boş klasör", parentId: null, assetCount: 0 }]}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /boş klasör/iu }));
    expect(await screen.findByText(/bu klasörde dosya yok/iu)).toBeInTheDocument();
  });

  it("refuses the whole surface when read-only and viewing is not permitted", () => {
    renderRouted(
      <MediaLibrary
        assets={MEDIA_ASSETS}
        capabilities={MEDIA_CAPABILITIES_LOCAL_ONLY}
        status="read-only"
      />,
    );
    expect(screen.getByText(/görüntüleme yetkisi tanımlı değil/iu)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /giriş yap/iu })).toBeNull();
  });

  it("shows an offline banner without hiding the data", () => {
    renderRouted(
      <MediaLibrary
        assets={MEDIA_ASSETS}
        capabilities={MEDIA_CAPABILITIES_WRITABLE}
        status="offline"
      />,
    );
    expect(screen.getByText(/çevrimdışı/iu)).toBeInTheDocument();
  });

  it("surfaces an error with a retry", async () => {
    const onRefresh = vi.fn();
    renderRouted(
      <MediaLibrary
        assets={[]}
        capabilities={MEDIA_CAPABILITIES_LOCAL_ONLY}
        status="error"
        errorMessage="Kütüphane yüklenemedi."
        onRefresh={onRefresh}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /tekrar dene/iu }));
    expect(onRefresh).toHaveBeenCalled();
  });

  it("opens an asset through the caller's handler", async () => {
    const onOpen = vi.fn();
    renderRouted(
      <MediaLibrary
        assets={MEDIA_ASSETS}
        capabilities={MEDIA_CAPABILITIES_LOCAL_ONLY}
        onOpen={onOpen}
      />,
    );
    await userEvent.click(await screen.findByRole("button", { name: unscanned.fileName }));
    expect(onOpen).toHaveBeenCalledWith(unscanned);
  });
});

/* ------------------------------------------------------------ bulk actions */

describe("bulk actions are gated by permission and capability together", () => {
  it("disables everything under the honest default", () => {
    const actions = mediaBulkActions(MEDIA_CAPABILITIES_LOCAL_ONLY, {});
    expect(actions.every((action) => action.allowed === false)).toBe(true);
    expect(actions.every((action) => (action.reason ?? "").length > 0)).toBe(true);
  });

  it("still blocks a permitted action whose backend is missing", () => {
    // Permission granted, capability blocked: the control must stay disabled
    // and must say the backend is the reason, not the user's role.
    const download = mediaBulkActions(MEDIA_CAPABILITIES_WRITABLE, { onDownload: vi.fn() }).find(
      (action) => action.id === "download",
    );
    expect(download?.allowed).toBe(false);
    expect(download?.reason).toMatch(/ucu yok/iu);
  });

  it("marks trash as destructive", () => {
    const trash = mediaBulkActions(MEDIA_CAPABILITIES_WRITABLE, {}).find((a) => a.id === "trash");
    expect(trash?.destructive).toBe(true);
  });
});

/* ----------------------------------------------------------------- upload */

describe("MediaUploadPanel", () => {
  it("hands over metadata only, never the File", async () => {
    const onUpload = vi.fn();
    render(
      <MediaUploadPanel
        capabilities={MEDIA_CAPABILITIES_WRITABLE}
        items={[]}
        onUpload={onUpload}
      />,
    );
    const file = new File(["icerik"], "rapor.pdf", { type: "application/pdf" });
    await userEvent.upload(screen.getByLabelText(/dosya seç/iu), file);

    expect(onUpload).toHaveBeenCalledTimes(1);
    const handed = onUpload.mock.calls[0]?.[0] as readonly Record<string, unknown>[];
    expect(handed[0]).toEqual({ name: "rapor.pdf", size: file.size, type: "application/pdf" });
    expect(handed[0]).not.toBeInstanceOf(File);
  });

  it("disables the picker when the permission is missing even with a transport", () => {
    render(
      <MediaUploadPanel
        capabilities={MEDIA_CAPABILITIES_LOCAL_ONLY}
        items={[]}
        onUpload={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/dosya seç/iu)).toBeDisabled();
    expect(screen.getByText(/yükleme yetkisi tanımlı değil/iu)).toBeInTheDocument();
  });

  it("shows a progress bar only while bytes are moving", () => {
    const { rerender } = render(
      <MediaUploadPanel
        capabilities={MEDIA_CAPABILITIES_WRITABLE}
        onUpload={vi.fn()}
        items={[
          {
            id: "u1",
            fileName: "a.pdf",
            sizeBytes: 10,
            declaredType: "application/pdf",
            phase: "queued",
            progress: 0,
            contentHash: null,
            outcome: null,
            error: null,
            attempts: 0,
          },
        ]}
      />,
    );
    expect(screen.queryByRole("progressbar")).toBeNull();

    rerender(
      <MediaUploadPanel
        capabilities={MEDIA_CAPABILITIES_WRITABLE}
        onUpload={vi.fn()}
        items={[
          {
            id: "u1",
            fileName: "a.pdf",
            sizeBytes: 10,
            declaredType: "application/pdf",
            phase: "uploading",
            progress: 42,
            contentHash: null,
            outcome: null,
            error: null,
            attempts: 0,
          },
        ]}
      />,
    );
    expect(screen.getByRole("progressbar")).toHaveValue(42);
  });

  it("explains a duplicate and offers no retry for it", () => {
    const onRetry = vi.fn();
    render(
      <MediaUploadPanel
        capabilities={MEDIA_CAPABILITIES_WRITABLE}
        onUpload={vi.fn()}
        onRetry={onRetry}
        items={[
          {
            id: "u1",
            fileName: "a.pdf",
            sizeBytes: 10,
            declaredType: "application/pdf",
            phase: "failed",
            progress: 0,
            contentHash: "a".repeat(64),
            outcome: "duplicate",
            error: "yinelenen",
            attempts: 0,
          },
        ]}
      />,
    );
    expect(screen.getByText(/zaten yüklü/iu)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /tekrar dene/iu })).toBeNull();
  });

  it("offers pause, resume, retry and cancel where they apply", async () => {
    const handlers = { onPause: vi.fn(), onResume: vi.fn(), onRetry: vi.fn(), onCancel: vi.fn() };
    const base = {
      sizeBytes: 10,
      declaredType: "application/pdf",
      progress: 10,
      contentHash: null,
      outcome: null,
      error: null,
      attempts: 0,
    } as const;
    render(
      <MediaUploadPanel
        capabilities={MEDIA_CAPABILITIES_WRITABLE}
        onUpload={vi.fn()}
        {...handlers}
        items={[
          { ...base, id: "a", fileName: "a.pdf", phase: "uploading" },
          { ...base, id: "b", fileName: "b.pdf", phase: "paused" },
          { ...base, id: "c", fileName: "c.pdf", phase: "failed", error: "ağ" },
        ]}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /duraklat/iu }));
    await userEvent.click(screen.getByRole("button", { name: /sürdür/iu }));
    await userEvent.click(screen.getByRole("button", { name: /tekrar dene/iu }));
    expect(handlers.onPause).toHaveBeenCalledWith("a");
    expect(handlers.onResume).toHaveBeenCalledWith("b");
    expect(handlers.onRetry).toHaveBeenCalledWith("c");
    expect(screen.getAllByRole("button", { name: "İptal" }).length).toBe(3);
  });

  it("accepts a drop only when it can actually transport it", async () => {
    const onUpload = vi.fn();
    const { container, rerender } = render(
      <MediaUploadPanel capabilities={MEDIA_CAPABILITIES_LOCAL_ONLY} items={[]} />,
    );
    const zone = container.querySelector(".dt-media-upload__zone") as HTMLElement;
    const file = new File(["x"], "x.pdf", { type: "application/pdf" });
    const data = { files: [file], items: [], types: ["Files"] };

    const { fireEvent } = await import("@testing-library/dom");
    fireEvent.drop(zone, { dataTransfer: data });
    expect(onUpload).not.toHaveBeenCalled();

    rerender(
      <MediaUploadPanel
        capabilities={MEDIA_CAPABILITIES_WRITABLE}
        items={[]}
        onUpload={onUpload}
      />,
    );
    fireEvent.drop(container.querySelector(".dt-media-upload__zone") as HTMLElement, {
      dataTransfer: data,
    });
    expect(onUpload).toHaveBeenCalledTimes(1);
  });
});

/* ------------------------------------------------------------------- tree */

describe("FolderTree", () => {
  it("is a real tree with levels and expanded state", () => {
    render(<FolderTree folders={MEDIA_FOLDERS} />);
    const tree = screen.getByRole("tree", { name: /klasörler/iu });
    const roots = within(tree).getAllByRole("treeitem");
    expect(roots.length).toBeGreaterThan(0);
    expect(roots[0]).toHaveAttribute("aria-level", "1");
    expect(roots[0]).toHaveAttribute("aria-expanded", "true");
  });

  it("navigates and selects with the keyboard alone", async () => {
    const onSelect = vi.fn();
    render(<FolderTree folders={MEDIA_FOLDERS} onSelect={onSelect} />);
    await userEvent.tab();
    await userEvent.keyboard("{ArrowDown}");
    await userEvent.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith("f-imza");
  });

  it("collapses and expands a branch with the arrow keys", async () => {
    render(<FolderTree folders={MEDIA_FOLDERS} />);
    await userEvent.tab();
    await userEvent.keyboard("{ArrowLeft}");
    expect(screen.getAllByRole("treeitem")[0]).toHaveAttribute("aria-expanded", "false");
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getAllByRole("treeitem")[0]).toHaveAttribute("aria-expanded", "true");
  });

  it("jumps to the ends with Home and End", async () => {
    render(<FolderTree folders={MEDIA_FOLDERS} />);
    await userEvent.tab();
    await userEvent.keyboard("{End}");
    await userEvent.keyboard("{Home}");
    expect(screen.getAllByRole("treeitem")[0]).toHaveFocus();
  });

  it("says so when there is no hierarchy at all", () => {
    render(<FolderTree folders={[]} />);
    expect(screen.getByText(/klasör tanımlı değil/iu)).toBeInTheDocument();
  });
});

/* -------------------------------------------------------------- organizer */

describe("MediaOrganizer", () => {
  it("warns before the user types that edits are not saved", () => {
    render(
      <MediaOrganizer folders={MEDIA_FOLDERS} capabilities={MEDIA_CAPABILITIES_WRITABLE} />,
    );
    expect(screen.getByText(/kaydedilmiyor/iu)).toBeInTheDocument();
  });

  it("refuses editing without the permission", () => {
    render(
      <MediaOrganizer folders={MEDIA_FOLDERS} capabilities={MEDIA_CAPABILITIES_LOCAL_ONLY} />,
    );
    expect(screen.getByText(/düzenleme yetkisi tanımlı değil/iu)).toBeInTheDocument();
  });

  it("adds a tag on Enter and refuses a duplicate", async () => {
    const onDraftChange = vi.fn();
    render(
      <MediaOrganizer
        folders={MEDIA_FOLDERS}
        capabilities={MEDIA_CAPABILITIES_WRITABLE}
        draft={{ description: "", tags: [{ id: "Resmî", label: "Resmî" }] }}
        onDraftChange={onDraftChange}
      />,
    );
    const input = screen.getByLabelText(/etiket ekle/iu);
    await userEvent.type(input, "Mali{Enter}");
    expect(onDraftChange).toHaveBeenCalledWith(
      expect.objectContaining({ tags: [{ id: "Resmî", label: "Resmî" }, { id: "Mali", label: "Mali" }] }),
    );

    onDraftChange.mockClear();
    await userEvent.type(input, "resmî{Enter}");
    expect(onDraftChange).not.toHaveBeenCalled();
  });

  it("removes a tag through a labelled control", async () => {
    const onDraftChange = vi.fn();
    render(
      <MediaOrganizer
        folders={MEDIA_FOLDERS}
        capabilities={MEDIA_CAPABILITIES_WRITABLE}
        draft={{ description: "", tags: [{ id: "Mali", label: "Mali" }] }}
        onDraftChange={onDraftChange}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /mali etiketini kaldır/iu }));
    expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ tags: [] }));
  });
});

/* ---------------------------------------------------------------- details */

describe("MediaDetails", () => {
  it("refuses to preview an unscanned file and explains the ordering", () => {
    renderRouted(
      <MediaDetails asset={unscanned} capabilities={MEDIA_CAPABILITIES_LOCAL_ONLY} />,
    );
    expect(screen.getByText(/doğru sıra değildir/iu)).toBeInTheDocument();
  });

  it("blocks preview outright for a quarantined file", () => {
    renderRouted(<MediaDetails asset={infected} capabilities={MEDIA_CAPABILITIES_LOCAL_ONLY} />);
    expect(screen.getAllByText(/karantinada/iu).length).toBeGreaterThan(0);
  });

  it("declines to embed a non-image type even when scanned clean", () => {
    renderRouted(<MediaDetails asset={clean} capabilities={MEDIA_CAPABILITIES_LOCAL_ONLY} />);
    expect(screen.getByText(/satır içi önizleme üretilmiyor/iu)).toBeInTheDocument();
  });

  it("renders an image only with a supplied URL", () => {
    const image: MediaAsset = { ...clean, mimeType: "image/png", fileName: "plan.png" };
    const { rerender } = renderRouted(
      <MediaDetails asset={image} capabilities={MEDIA_CAPABILITIES_LOCAL_ONLY} />,
    );
    expect(screen.getByText(/önizleme adresi verilmedi/iu)).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <MediaDetails
          asset={image}
          capabilities={MEDIA_CAPABILITIES_LOCAL_ONLY}
          previewUrl="/media/plan.png"
        />
      </MemoryRouter>,
    );
    expect(screen.getByAltText(/plan\.png önizlemesi/iu)).toBeInTheDocument();
  });

  it("shows versions and a metadata-only comparison", async () => {
    renderRouted(
      <MediaDetails
        asset={unscanned}
        capabilities={MEDIA_CAPABILITIES_LOCAL_ONLY}
        versions={MEDIA_VERSIONS}
      />,
    );
    await userEvent.click(screen.getByRole("tab", { name: /sürümler/iu }));
    expect(await screen.findByText(/yalnızca üstveri düzeyindedir/iu)).toBeInTheDocument();
  });

  it("does not claim absence of usage when the endpoint is missing", async () => {
    renderRouted(<MediaDetails asset={clean} capabilities={MEDIA_CAPABILITIES_LOCAL_ONLY} />);
    await userEvent.click(screen.getByRole("tab", { name: /kullanım/iu }));
    expect(
      await screen.findByText(/hiçbir yerde kullanılmadığı anlamına gelmez/iu),
    ).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------- governance */

describe("MediaGovernancePanel", () => {
  it("states the hold-beats-retention ordering", () => {
    render(<MediaGovernancePanel asset={held} capabilities={MEDIA_CAPABILITIES_WRITABLE} />);
    expect(screen.getByText(/saklama süresini ezer/iu)).toBeInTheDocument();
  });

  it("blocks purge while a legal hold is on, and says which rule won", () => {
    render(<MediaGovernancePanel asset={held} capabilities={MEDIA_CAPABILITIES_WRITABLE} />);
    const purge = screen.getByRole("button", { name: /kalıcı olarak sil/iu });
    expect(purge).toBeDisabled();
    expect(screen.getByText(/muhafaza açık; kalıcı silme engellendi/iu)).toBeInTheDocument();
  });

  it("offers restore instead of trash for a trashed asset", () => {
    render(<MediaGovernancePanel asset={held} capabilities={MEDIA_CAPABILITIES_WRITABLE} />);
    expect(screen.getByRole("button", { name: /geri al/iu })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /çöp kutusuna taşı/iu })).toBeNull();
  });

  it("says the audit list is not an audit trail", () => {
    render(
      <MediaGovernancePanel
        asset={unscanned}
        capabilities={MEDIA_CAPABILITIES_LOCAL_ONLY}
        audit={MEDIA_AUDIT}
      />,
    );
    expect(screen.getByText(/denetim izi değildir/iu)).toBeInTheDocument();
    expect(screen.getByText(/sürüm 2 eklendi/iu)).toBeInTheDocument();
  });

  it("reports every permission as closed under the honest default", () => {
    render(
      <MediaGovernancePanel asset={unscanned} capabilities={MEDIA_CAPABILITIES_LOCAL_ONLY} />,
    );
    expect(screen.getAllByText(/^kapalı$/iu).length).toBeGreaterThanOrEqual(7);
  });
});

/* ---------------------------------------------------------------- storage */

describe("MediaStoragePanel", () => {
  it("names local as the default target", () => {
    render(
      <MediaStoragePanel
        storage={MEDIA_STORAGE_LOCAL}
        capabilities={MEDIA_CAPABILITIES_LOCAL_ONLY}
      />,
    );
    expect(screen.getByText(/^varsayılan$/iu)).toBeInTheDocument();
  });

  it("says a full quota should stop uploads", () => {
    render(
      <MediaStoragePanel
        storage={MEDIA_STORAGE_QUOTA_EXCEEDED}
        capabilities={MEDIA_CAPABILITIES_LOCAL_ONLY}
      />,
    );
    expect(screen.getByText(/kota dolu/iu)).toBeInTheDocument();
  });

  it("declines to compute a ratio without a quota", () => {
    render(
      <MediaStoragePanel
        storage={MEDIA_STORAGE_WITH_S3}
        capabilities={MEDIA_CAPABILITIES_WITH_S3}
      />,
    );
    expect(screen.getByText(/doluluk oranı hesaplanmıyor/iu)).toBeInTheDocument();
  });

  it("reports injected S3 health without claiming to have measured it", () => {
    render(
      <MediaStoragePanel
        storage={MEDIA_STORAGE_WITH_S3}
        capabilities={MEDIA_CAPABILITIES_WITH_S3}
      />,
    );
    expect(screen.getByText(/sağlıklı bildirildi/iu)).toBeInTheDocument();
    expect(screen.getByText(/hiçbir aws bağımlılığı/iu)).toBeInTheDocument();
  });

  it("says a client-side quota is not a limit", () => {
    render(
      <MediaStoragePanel
        storage={MEDIA_STORAGE_LOCAL}
        capabilities={MEDIA_CAPABILITIES_LOCAL_ONLY}
      />,
    );
    expect(screen.getByText(/gösterilir ama uygulanmaz/iu)).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------- vocabulary */

describe("vocabulary and capability helpers", () => {
  it("gives only a clean verdict an affirmative tone", () => {
    expect(scanStateTone("clean")).toBe("candidate");
    expect(scanStateTone("infected")).toBe("ineligible");
    for (const state of ["unscanned", "pending", "failed", "unavailable"] as const) {
      expect(scanStateTone(state)).toBe("warning");
      expect(scanStateExplanation(state).length).toBeGreaterThan(10);
    }
  });

  it("counts a verdict as existing only when one was actually reached", () => {
    expect(hasScanVerdict("clean")).toBe(true);
    expect(hasScanVerdict("infected")).toBe(true);
    for (const state of ["unscanned", "pending", "failed", "unavailable"] as const) {
      expect(hasScanVerdict(state)).toBe(false);
    }
  });

  it("blocks download for infection only", () => {
    expect(isDownloadBlocked("infected")).toBe(true);
    expect(isDownloadBlocked("unscanned")).toBe(false);
  });

  it("formats bytes without inventing precision", () => {
    expect(formatBytes(null)).toBe("—");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toMatch(/KiB/u);
    expect(formatBytes(1024 ** 4)).toMatch(/TiB/u);
  });

  it("labels every enum it owns", () => {
    expect(lifecycleLabel("trashed")).toMatch(/çöp/iu);
    expect(uploadPhaseLabel("paused")).toMatch(/duraklat/iu);
    expect(storageBackendLabel("s3")).toMatch(/S3/u);
    expect(mimeLabel("application/pdf")).toBe("PDF");
    expect(mimeLabel("application/x-weird")).toBe("X-WEIRD");
  });

  it("compares versions field by field and flags what changed", () => {
    const [left, right] = [MEDIA_VERSIONS[1]!, MEDIA_VERSIONS[0]!];
    const rows = compareVersions(left, right);
    expect(rows.find((row) => row.field === "Sürüm")?.changed).toBe(true);
    expect(compareVersions(left, left).every((row) => !row.changed)).toBe(true);
  });

  it("enables nothing that needs a backend", () => {
    expect(enabledMediaCapabilities().every((c) => c.backend === "available")).toBe(true);
    expect(MEDIA_CAPABILITY_COUNTS.backendBlocked).toBeGreaterThan(0);
    expect(mediaCapabilityById("s3-adapter")?.enabled).toBe(false);
    expect(mediaCapabilityById("nope")).toBeUndefined();
  });
});
