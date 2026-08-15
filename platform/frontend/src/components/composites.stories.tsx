import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { decisionFixtures } from "@/mocks/fixtures";
import {
  Card,
  CopyableHash,
  DataTable,
  DefinitionList,
  Dialog,
  Fieldset,
  FilterBar,
  FormField,
  Pagination,
  Popover,
  SearchInput,
  Stepper,
  Tabs,
  Timeline,
  Toast,
  Tooltip,
} from "./composites";
import { Button, Input } from "./primitives";

const meta = { title: "2 Bileşikler/Genel bakış" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Forms: Story = {
  name: "FormField · Fieldset",
  render: () => (
    <Fieldset legend="Nitelik beyanları" description="Emin değilseniz Bilinmiyor bırakın.">
      <FormField id="sb-1" label="E-posta" hint="Kurumsal adres" required>
        {(aria) => <Input {...aria} />}
      </FormField>
      <FormField id="sb-2" label="Geçersiz alan" error="Bu alan zorunludur.">
        {(aria) => <Input {...aria} invalid />}
      </FormField>
    </Fieldset>
  ),
};

export const Cards: Story = {
  name: "Card — tonlar",
  render: () => (
    <div className="dt-stack">
      <Card title="Varsayılan" actions={<Button size="sm">Eylem</Button>}>
        Gövde içeriği.
      </Card>
      <Card title="Gömük" tone="sunken">
        Arka planla aynı seviyede.
      </Card>
      <Card title="Uyarı" tone="warning" footer={<span className="dt-muted">Alt bilgi</span>}>
        Dikkat gerektiren içerik.
      </Card>
    </div>
  ),
};

export const Tables: Story = {
  name: "DataTable — sıralanabilir, açıklamalı",
  render: () => (
    <DataTable
      caption="Değerlendirme kararları"
      data={[...decisionFixtures]}
      getRowId={(row) => row.id}
      columns={[
        { id: "program", header: "Program", accessorFn: (row) => row.program_code },
        { id: "outcome", header: "Sonuç", accessorFn: (row) => row.outcome_label },
        { id: "missing", header: "Eksik olgu", accessorFn: (row) => row.missing_facts.length },
      ]}
    />
  ),
};

export const EmptyTable: Story = {
  name: "DataTable — boş",
  render: () => (
    <DataTable caption="Kararlar" data={[]} columns={[]} emptyMessage="Henüz karar yok." />
  ),
};

export const Definitions: Story = {
  name: "DefinitionList — tek ve iki sütun",
  render: () => (
    <div className="dt-stack">
      <DefinitionList
        items={[
          { term: "Program kodu", description: "TUBITAK-1501" },
          { term: "Yürürlük", description: "" },
        ]}
      />
      <DefinitionList
        columns={2}
        items={[
          { term: "Program", description: "3" },
          { term: "Kaynak", description: "3" },
          { term: "Doğrulanmış", description: "0" },
          { term: "Sonuç türü", description: "4" },
        ]}
      />
    </div>
  ),
};

export const Overlays: Story = {
  name: "Tabs · Dialog · Popover · Tooltip",
  render: () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <div className="dt-stack">
          <Tabs
            label="Örnek sekmeler"
            items={[
              { value: "a", label: "Gerekçe", content: <p>Gerekçe içeriği</p> },
              { value: "b", label: "Kanıt", content: <p>Kanıt içeriği</p> },
            ]}
          />
          <div className="dt-row">
            <Button onClick={() => setOpen(true)}>Diyaloğu aç</Button>
            <Popover label="Ek bilgi" trigger={<Button variant="secondary">Popover</Button>}>
              <p>Odak tuzağı olmayan, kapatılabilir yardımcı içerik.</p>
            </Popover>
            <Tooltip content="Yalnızca destekleyici bilgi taşır.">
              <Button variant="ghost">Tooltip</Button>
            </Tooltip>
          </div>
          <Dialog
            open={open}
            onOpenChange={setOpen}
            title="Emin misiniz?"
            description="Odak tuzaklanır, Esc kapatır, odak tetikleyiciye döner."
          >
            <p>Diyalog gövdesi.</p>
          </Dialog>
        </div>
      );
    }
    return <Harness />;
  },
};

export const Feedback: Story = {
  name: "Toast · Pagination",
  render: () => (
    <div className="dt-stack">
      <Toast message="Bilgi mesajı" />
      <Toast message="İstek başarılı" tone="success" onDismiss={() => {}} />
      <Toast message="İstek başarısız" tone="error" onDismiss={() => {}} />
      <Pagination page={2} pageCount={5} totalItems={48} onPageChange={() => {}} />
    </div>
  ),
};

export const FiltersAndSearch: Story = {
  name: "FilterBar · SearchInput",
  render: () => (
    <div className="dt-stack">
      <SearchInput value="" onValueChange={() => {}} resultCount={3} />
      <FilterBar
        resultCount={3}
        onChange={() => {}}
        onReset={() => {}}
        filters={[
          {
            id: "support",
            label: "Destek türü",
            value: "grant",
            options: [{ value: "grant", label: "Hibe" }],
          },
          {
            id: "window",
            label: "Çağrı penceresi",
            value: "",
            options: [{ value: "unknown", label: "Bilinmiyor" }],
          },
        ]}
      />
    </div>
  ),
};

export const Progress: Story = {
  name: "Stepper · Timeline · CopyableHash",
  render: () => (
    <div className="dt-stack">
      <Stepper
        currentIndex={1}
        steps={[
          { id: "a", label: "Nitelik" },
          { id: "b", label: "Ölçek" },
          { id: "c", label: "Sınıflandırma" },
          { id: "d", label: "Özet" },
        ]}
      />
      <Timeline
        entries={[
          { id: "1", title: "TUBITAK-1501 — Koşullu", timestamp: "14.08.2026 09:00" },
          { id: "2", title: "TUBITAK-1507 — Yetersiz veri", timestamp: "14.08.2026 09:05" },
        ]}
      />
      <CopyableHash label="Karar özeti" value={"b".repeat(64)} />
    </div>
  ),
};
