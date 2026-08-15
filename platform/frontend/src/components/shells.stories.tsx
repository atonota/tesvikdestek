import type { Meta, StoryObj } from "@storybook/react-vite";

import { AppShell, AuthShell, PrintShell, PublicShell, WorkspaceShell } from "./shells";
import { Card } from "./composites";
import { Button } from "./primitives";

const meta = {
  title: "4 Kabuklar/Genel bakış",
  parameters: { layout: "fullscreen" },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const NAV = [
  { to: "/panel", label: "Kokpit", shortLabel: "Kokpit", icon: "◧" },
  { to: "/degerlendirmeler", label: "Kararlar", shortLabel: "Karar", icon: "▤" },
  { to: "/kaynaklar", label: "Kaynaklar", shortLabel: "Kaynak", icon: "❖" },
];

export const App: Story = {
  name: "AppShell — 320 alt navigasyon, 1024 sol rail",
  render: () => (
    <AppShell navItems={NAV} headerActions={<Button variant="ghost" size="sm">Çıkış</Button>}>
      <h1>Kokpit</h1>
      <p>320 pikselde alt navigasyon, 1024 pikselde kalıcı sol rail.</p>
    </AppShell>
  ),
};

export const Workspace: Story = {
  name: "WorkspaceShell — 1440'ta üç panel",
  render: () => (
    <WorkspaceShell
      listPanel={<Card title="Liste">Kararlar</Card>}
      detailPanel={<Card title="Ayrıntı">Seçili karar</Card>}
      evidencePanel={<Card title="Kanıt">Kaynak yakalaması</Card>}
    />
  ),
};

export const Public: Story = {
  name: "PublicShell",
  render: () => (
    <PublicShell navItems={[{ to: "/programlar", label: "Programlar" }]}>
      <h1>Kamuya açık sayfa</h1>
    </PublicShell>
  ),
};

export const Auth: Story = {
  name: "AuthShell — tek sütun, maks 480px",
  render: () => (
    <AuthShell title="Giriş" description="Oturum sunucuda tutulur." footer={<a href="/kayit">Kayıt ol</a>}>
      <p>Form buraya gelir.</p>
    </AuthShell>
  ),
};

export const Print: Story = {
  name: "PrintShell — karar çıktısı",
  render: () => (
    <PrintShell title="Karar çıktısı" subtitle="TUBITAK-1501 — Koşullu">
      <p>Yazdırmada gezinme kaybolur, sorumluluk sınırı kalır.</p>
    </PrintShell>
  ),
};
