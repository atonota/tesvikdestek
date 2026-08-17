import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";

import { useUiStore } from "@/store/ui";
import { AppShell, PrintShell, PublicShell, WorkspaceShell } from "./shells";

const NAV = [
  { to: "/panel", label: "Kokpit", shortLabel: "Kokpit", icon: "◧" },
  { to: "/degerlendirmeler", label: "Kararlar", icon: "▤" },
];

function routed(element: React.ReactElement, path = "/panel") {
  const router = createMemoryRouter([{ path: "*", element }], { initialEntries: [path] });
  return render(<RouterProvider router={router} />);
}

beforeEach(() => {
  useUiStore.setState({
    density: "comfortable",
    theme: "system",
    fontScale: "normal",
    reducedMotion: false,
    navDrawerOpen: false,
    evidencePanelOpen: true,
  });
});

describe("AppShell", () => {
  it("provides a skip link, a main landmark and named navigation", () => {
    routed(
      <AppShell navItems={NAV}>
        <h1>Kokpit</h1>
      </AppShell>,
    );
    expect(screen.getByRole("link", { name: "İçeriğe geç" })).toHaveAttribute(
      "href",
      "#ana-icerik",
    );
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Ana gezinme" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Hızlı gezinme" })).toBeInTheDocument();
  });

  it("toggles the drawer and reports its expanded state", async () => {
    routed(
      <AppShell navItems={NAV}>
        <h1>Kokpit</h1>
      </AppShell>,
    );
    const toggle = screen.getByRole("button", { name: "Menüyü aç" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Menüyü kapat" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("applies persisted appearance to the document root", () => {
    useUiStore.setState({ density: "dense", theme: "dark", fontScale: "large", reducedMotion: true });
    routed(
      <AppShell navItems={NAV}>
        <h1>Kokpit</h1>
      </AppShell>,
    );
    expect(document.documentElement.dataset["density"]).toBe("dense");
    expect(document.documentElement.dataset["theme"]).toBe("dark");
    expect(document.documentElement.dataset["fontScale"]).toBe("large");
    expect(document.documentElement.dataset["reducedMotion"]).toBe("true");
  });

  it("removes the theme attribute when following the system", () => {
    useUiStore.setState({ theme: "system" });
    routed(
      <AppShell navItems={NAV}>
        <h1>Kokpit</h1>
      </AppShell>,
    );
    expect(document.documentElement.dataset["theme"]).toBeUndefined();
  });
});

describe("WorkspaceShell", () => {
  it("labels its three regions", () => {
    routed(
      <WorkspaceShell
        listPanel={<p>liste</p>}
        detailPanel={<p>detay</p>}
        evidencePanel={<p>kanıt</p>}
      />,
    );
    expect(screen.getByRole("region", { name: "Liste" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Ayrıntı" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Kanıt" })).toBeInTheDocument();
  });

  it("collapses the evidence panel on request", async () => {
    routed(
      <WorkspaceShell
        listPanel={<p>liste</p>}
        detailPanel={<p>detay</p>}
        evidencePanel={<p>kanıt içeriği</p>}
      />,
    );
    expect(screen.getByText("kanıt içeriği")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Kanıt panelini kapat" }));
    expect(screen.queryByText("kanıt içeriği")).not.toBeInTheDocument();
  });

  it("works as two panels when there is no evidence to show", () => {
    routed(<WorkspaceShell listPanel={<p>liste</p>} detailPanel={<p>detay</p>} />);
    expect(screen.queryByRole("region", { name: "Kanıt" })).not.toBeInTheDocument();
  });
});

describe("PublicShell, PrintShell", () => {
  it("public shell carries the liability footer", () => {
    routed(
      <PublicShell navItems={[{ to: "/programlar", label: "Programlar" }]}>
        <h1>Ana</h1>
      </PublicShell>,
      "/",
    );
    expect(screen.getByText(/bağlayıcı değildir/i)).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Site gezinme" })).toBeInTheDocument();
  });

  it("print shell keeps the title and drops navigation", () => {
    render(
      <PrintShell title="Karar çıktısı" subtitle="TUBITAK-1501">
        <p>gövde</p>
      </PrintShell>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Karar çıktısı" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });
});
