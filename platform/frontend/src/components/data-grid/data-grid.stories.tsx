import type { Meta, StoryObj } from "@storybook/react-vite";

import { decisionFixtures, snapshotFixtures } from "@/mocks/fixtures";
import { DataGrid } from "./DataGrid";
import {
  compareGridConfig,
  compareRows,
  decisionsGridConfig,
  sourcesGridConfig,
  traceGridConfig,
} from "./configs";
import { DISABLED_CAPABILITIES, IMPLEMENTED_CAPABILITIES } from "./capabilities";

const meta = {
  title: "7 Veri tablosu/Genel bakış",
  parameters: {
    docs: {
      description: {
        component:
          "Tek bir tipli yapılandırma bir tabloyu tamamen tanımlar. Tüm işlemler bu oturumda yüklenmiş satırlar üzerinde çalışır; sunucuya bağlı yetenekler kapalı olarak ilan edilir.",
      },
    },
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Decisions: Story = {
  name: "Kararlar — seçim, gruplama, filtre",
  render: () => <DataGrid config={decisionsGridConfig({})} rows={decisionFixtures} />,
};

export const Sources: Story = {
  name: "Kaynaklar",
  render: () => <DataGrid config={sourcesGridConfig()} rows={snapshotFixtures} />,
};

export const Trace: Story = {
  name: "Kural izi",
  render: () => (
    <DataGrid
      config={traceGridConfig(snapshotFixtures.map((snapshot) => snapshot.id))}
      rows={decisionFixtures.flatMap((decision) => decision.traces)}
    />
  ),
};

export const Compare: Story = {
  name: "Karşılaştırma — transpoze",
  render: () => (
    <DataGrid
      config={compareGridConfig(decisionFixtures)}
      rows={compareRows(decisionFixtures)}
    />
  ),
};

export const States: Story = {
  name: "Durumlar — yükleniyor · yenileniyor · hata · boş",
  render: () => (
    <div className="dt-stack">
      <DataGrid config={sourcesGridConfig()} rows={[]} status="loading" />
      <DataGrid config={sourcesGridConfig()} rows={snapshotFixtures} status="refreshing" />
      <DataGrid
        config={sourcesGridConfig()}
        rows={[]}
        status="error"
        errorMessage="Sunucu tarafında bir hata oluştu."
        onRefresh={() => {}}
      />
      <DataGrid config={sourcesGridConfig()} rows={[]} />
    </div>
  ),
};

export const Capabilities: Story = {
  name: "Yetenek matrisi",
  render: () => (
    <div className="dt-stack">
      <section>
        <h3>Uygulananlar ({IMPLEMENTED_CAPABILITIES.length})</h3>
        <ul className="dt-list">
          {IMPLEMENTED_CAPABILITIES.map((capability) => (
            <li key={capability.id}>
              <strong>{capability.title}</strong>
              {capability.scope ? <span className="dt-muted"> — {capability.scope}</span> : null}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3>Kapalı olanlar ({DISABLED_CAPABILITIES.length})</h3>
        <ul className="dt-list">
          {DISABLED_CAPABILITIES.map((capability) => (
            <li key={capability.id}>
              <strong>{capability.title}:</strong> {capability.reason}
            </li>
          ))}
        </ul>
      </section>
    </div>
  ),
};
