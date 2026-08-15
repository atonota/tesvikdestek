import type { Meta, StoryObj } from "@storybook/react-vite";

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
import { Button } from "./primitives";

const meta = {
  title: "3 Durum desenleri/Altı durum",
  parameters: {
    docs: {
      description: {
        component:
          "loading · empty · error · permission · offline · partial-data. Bu ürünün en sık görülen ekranları bunlardır.",
      },
    },
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  name: "loading",
  render: () => <SkeletonBlock lines={4} label="Kararlar yükleniyor" />,
};

export const Empty: Story = {
  name: "empty",
  render: () => (
    <EmptyState
      title="Henüz karar yok"
      reason="Profilinizi doldurup değerlendirmeyi çalıştırdığınızda kararlar burada listelenir."
      action={<Button>Sihirbazı başlat</Button>}
    />
  ),
};

export const ErrorWithDetail: Story = {
  name: "error",
  render: () => (
    <ErrorState
      message="Sunucu tarafında bir hata oluştu."
      detail="ApiError: İstek başarısız (500) — /api/programlar"
      onRetry={() => {}}
    />
  ),
};

export const Permission: Story = {
  name: "permission",
  render: () => <PermissionDenied action="Kararları görüntülemek" />,
};

export const Offline: Story = {
  name: "offline",
  render: () => <OfflineBanner forceOffline lastUpdated="2026-08-14T09:00:00+00:00" />,
};

export const PartialData: Story = {
  name: "partial-data",
  render: () => (
    <PartialDataNotice
      what="Bu formdaki kayıtlı değerler sunucudan geri okunamıyor."
      because="Backend'de profil okuma ucu yok. Alanların boş görünmesi kayıt yapılmadığı anlamına gelmez."
    />
  ),
};

export const Supporting: Story = {
  name: "stale · confirm · barrier · disclaimer",
  render: () => (
    <div className="dt-stack">
      <StaleDataNotice isStale onRefresh={() => {}} />
      <ConfirmDestructive
        title="Oturumu kapat"
        body="Bu cihazdaki oturum sunucuda iptal edilir."
        confirmLabel="Çıkış yap"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
      <FormSubmitBarrier submitting>
        <Button type="submit">Gönder</Button>
      </FormSubmitBarrier>
      <DisclaimerBlock />
      <DisclaimerBlock variant="compact" />
    </div>
  ),
};
