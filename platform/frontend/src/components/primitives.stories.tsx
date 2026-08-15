import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  Badge,
  Button,
  Checkbox,
  FieldError,
  IconButton,
  Input,
  Label,
  Link,
  NumberInput,
  RadioGroup,
  Switch,
  Textarea,
  TristateSelect,
  VisuallyHidden,
} from "./primitives";

const meta = {
  title: "1 Primitifler/Genel bakış",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const ButtonVariants: Story = {
  name: "Button — varyantlar ve durumlar",
  render: () => (
    <div className="dt-stack">
      <div className="dt-row">
        <Button variant="primary">Birincil</Button>
        <Button variant="secondary">İkincil</Button>
        <Button variant="ghost">Sade</Button>
        <Button variant="danger">Yıkıcı</Button>
      </div>
      <div className="dt-row">
        <Button size="sm">Küçük</Button>
        <Button size="md">Orta</Button>
        <Button size="lg">Büyük</Button>
      </div>
      <div className="dt-row">
        <Button loading>Yükleniyor</Button>
        <Button disabled>Devre dışı</Button>
        <Button fullWidth>Tam genişlik</Button>
      </div>
    </div>
  ),
};

export const IconButtons: Story = {
  name: "IconButton — erişilebilir ad zorunlu",
  render: () => (
    <div className="dt-row">
      <IconButton label="Menüyü aç" icon="☰" />
      <IconButton label="Kapat" icon="✕" variant="secondary" />
      <IconButton label="Kopyala" icon="⧉" size="sm" />
    </div>
  ),
};

export const TextInputs: Story = {
  name: "Input · NumberInput · Textarea",
  render: () => (
    <div className="dt-stack">
      <Label htmlFor="s-eposta">E-posta</Label>
      <Input id="s-eposta" placeholder="ornek@sirket.com.tr" />
      <Label htmlFor="s-eposta-invalid" required>
        Geçersiz alan
      </Label>
      <Input id="s-eposta-invalid" invalid defaultValue="bozuk" />
      <FieldError id="s-eposta-invalid-error">Geçerli bir e-posta girin.</FieldError>
      <Label htmlFor="s-personel">Çalışan sayısı</Label>
      <NumberInput id="s-personel" suffix="kişi" defaultValue="8" />
      <Label htmlFor="s-not">Not</Label>
      <Textarea id="s-not" placeholder="Kısa açıklama" />
    </div>
  ),
};

export const TristateStates: Story = {
  name: "TristateSelect — Bilinmiyor ≠ Hayır",
  render: () => (
    <div className="dt-stack">
      <p className="dt-muted">
        Varsayılan “Bilinmiyor”dur ve boş değer olarak gönderilir. Motor bunu belirsizlik sayar,
        “hayır” saymaz.
      </p>
      <Label htmlFor="s-t1">Bilinmiyor (varsayılan)</Label>
      <TristateSelect id="s-t1" value="" onValueChange={() => {}} />
      <Label htmlFor="s-t2">Evet</Label>
      <TristateSelect id="s-t2" value="true" onValueChange={() => {}} />
      <Label htmlFor="s-t3">Hayır</Label>
      <TristateSelect id="s-t3" value="false" onValueChange={() => {}} />
      <Label htmlFor="s-t4">Geçersiz</Label>
      <TristateSelect id="s-t4" value="" invalid onValueChange={() => {}} />
    </div>
  ),
};

export const Choices: Story = {
  name: "Checkbox · RadioGroup · Switch",
  render: () => (
    <div className="dt-stack">
      <Checkbox label="Belgeyi hazırladım" description="Yalnızca bu tarayıcıda tutulur." />
      <RadioGroup
        name="s-density"
        legend="Yoğunluk"
        value="comfortable"
        onValueChange={() => {}}
        options={[
          { value: "comfortable", label: "Rahat", description: "48 piksel satır" },
          { value: "compact", label: "Sıkı", description: "40 piksel satır" },
          { value: "dense", label: "Yoğun", description: "32 piksel satır" },
        ]}
      />
      <Switch checked onCheckedChange={() => {}} label="Hareketi azalt" description="Geçişleri kapatır." />
    </div>
  ),
};

export const BadgesAndLinks: Story = {
  name: "Badge · Link · VisuallyHidden",
  render: () => (
    <div className="dt-stack">
      <div className="dt-row">
        <Badge>Nötr</Badge>
        <Badge tone="accent">Vurgu</Badge>
        <Badge tone="candidate">Aday uygunluk</Badge>
        <Badge tone="conditional">Koşullu</Badge>
        <Badge tone="insufficient">Yetersiz veri</Badge>
        <Badge tone="ineligible">Uygun değil</Badge>
      </div>
      <div className="dt-row">
        <Link to="/programlar">İç bağlantı</Link>
        <Link href="https://tubitak.gov.tr" external>
          Resmî kaynak
        </Link>
      </div>
      <p>
        Görsel olarak gizli metin de erişilebilirlik ağacındadır:
        <VisuallyHidden> ekran okuyucu bunu okur</VisuallyHidden>
      </p>
    </div>
  ),
};
