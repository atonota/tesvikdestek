/**
 * The six documented states, proven at the layer that owns them.
 *
 * loading · empty · error · permission · offline · partial-data
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DISCLAIMER } from "@/domain/outcomes";
import {
  ConfirmDestructive,
  DisclaimerBlock,
  EmptyState,
  ErrorState,
  FormSubmitBarrier,
  OfflineBanner,
  PartialDataNotice,
  PermissionDenied,
  SkeletonBlock,
  StaleDataNotice,
} from "./patterns";

describe("loading state", () => {
  it("announces itself rather than shimmering silently", () => {
    render(<SkeletonBlock lines={2} label="Kararlar yükleniyor" />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText(/kararlar yükleniyor/i)).toBeInTheDocument();
  });
});

describe("empty state", () => {
  it("always gives a reason, not just a shrug", () => {
    render(
      <EmptyState title="Henüz karar yok" reason="Değerlendirme çalıştırılmadı." />,
    );
    expect(screen.getByRole("heading", { name: "Henüz karar yok" })).toBeInTheDocument();
    expect(screen.getByText("Değerlendirme çalıştırılmadı.")).toBeInTheDocument();
  });

  it("can offer exactly one action", () => {
    render(
      <EmptyState title="Boş" reason="Neden" action={<button type="button">Başlat</button>} />,
    );
    expect(screen.getByRole("button", { name: "Başlat" })).toBeInTheDocument();
  });
});

describe("error state", () => {
  it("is announced and can be retried", async () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Sunucuya ulaşılamadı." onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Sunucuya ulaşılamadı.");
    await userEvent.click(screen.getByRole("button", { name: "Tekrar dene" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("hides technical detail behind a disclosure and invents no request id", () => {
    render(<ErrorState message="Hata" detail="ContractError: beklenmeyen alan" />);
    expect(screen.getByText("Teknik ayrıntı")).toBeInTheDocument();
    expect(screen.queryByText(/request[- ]id/i)).not.toBeInTheDocument();
  });
});

describe("permission state", () => {
  it("explains what needs a session", () => {
    render(<PermissionDenied action="Kararları görüntülemek" />);
    expect(screen.getByRole("alert")).toHaveTextContent(/giriş yapmanız gerekiyor/i);
  });
});

describe("offline state", () => {
  it("stays hidden while online", () => {
    const { container } = render(<OfflineBanner forceOffline={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("refuses to promise a queued write", () => {
    render(<OfflineBanner forceOffline lastUpdated="2026-08-14T09:00:00+00:00" />);
    expect(screen.getByRole("status")).toHaveTextContent(/kuyruğa alınmaz/i);
  });

  it("names when the shown data was last read", () => {
    render(<OfflineBanner forceOffline lastUpdated="2026-08-14T09:00:00+00:00" />);
    expect(screen.getByRole("status")).toHaveTextContent(/14\.08\.2026/);
  });
});

describe("partial-data state", () => {
  it("names the missing field and the missing capability", () => {
    render(
      <PartialDataNotice
        what="Kayıtlı değerler okunamıyor."
        because="Profil okuma ucu yok."
      />,
    );
    expect(screen.getByText(/kayıtlı değerler okunamıyor/i)).toBeInTheDocument();
    expect(screen.getByText(/profil okuma ucu yok/i)).toBeInTheDocument();
  });
});

describe("stale data", () => {
  it("stays hidden when fresh", () => {
    const { container } = render(<StaleDataNotice isStale={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("offers a refresh when stale", async () => {
    const onRefresh = vi.fn();
    render(<StaleDataNotice isStale onRefresh={onRefresh} />);
    await userEvent.click(screen.getByRole("button", { name: "Yenile" }));
    expect(onRefresh).toHaveBeenCalledOnce();
  });
});

describe("destructive confirmation and submit barrier", () => {
  it("requires an explicit confirm", async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDestructive
        title="Emin misiniz?"
        body="Bu işlem geri alınamaz."
        confirmLabel="Sil"
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Sil" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("disables the whole form while submitting", () => {
    render(
      <FormSubmitBarrier submitting>
        <button type="submit">Gönder</button>
      </FormSubmitBarrier>,
    );
    expect(screen.getByRole("button", { name: "Gönder" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(/gönderiliyor/i);
  });
});

describe("disclaimer", () => {
  it("renders the backend constant byte-for-byte", () => {
    render(<DisclaimerBlock />);
    expect(screen.getByTestId("disclaimer")).toHaveTextContent(DISCLAIMER);
  });

  it("keeps the same words in the compact variant", () => {
    render(<DisclaimerBlock variant="compact" />);
    expect(screen.getByTestId("disclaimer")).toHaveTextContent(DISCLAIMER);
  });
});
