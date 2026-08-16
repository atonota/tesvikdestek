/**
 * The master component layer's catalogue.
 *
 * This is the binding Storybook contract for the layer everything else in the
 * product is derived from, so it is organised around the two axes that actually
 * break: **viewport** and **state**.
 *
 * Every group below carries a 320px story as well as its default. 320px is the
 * source layout for this product rather than the smallest supported one, and a
 * catalogue that only shows components at desktop width is a catalogue of the
 * secondary case. Theme is a toolbar global (`Tema: light | dark`) so every
 * story here is also a dark-mode story without doubling the file.
 *
 * The skeleton group comes first, deliberately. The owner's standing rule is
 * **skeleton shimmer first**: a component's loading state is designed and built
 * before the component, and it has to imitate that component's real layout
 * rather than stand in as a grey rectangle. Putting it at the top of the
 * catalogue is what stops it becoming the state nobody looks at.
 */

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect } from "react";

import { AppIcon } from "@/components/icons";

import { Badge } from "./badge";
import { Button } from "./button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "./card";
import { Progress } from "./progress";
import { Separator } from "./separator";
import {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./sheet";
import {
  Shimmer,
  Skeleton,
  SkeletonCard,
  SkeletonChart,
  SkeletonControl,
  SkeletonForm,
  SkeletonList,
  SkeletonMedia,
  SkeletonTable,
  SkeletonTabStrip,
  SkeletonText,
} from "./skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";

/**
 * The narrow viewport this product is designed at, not merely supports.
 *
 * Storybook 10's API, not Storybook 7's. The old shape - `parameters.viewport`
 * carrying a `viewports` map and a `defaultViewport` string - still *parses* in
 * Storybook 10 and silently does nothing: `defaultViewport` was removed, the
 * selected viewport now lives in `globals.viewport.value`, and the catalogue of
 * sizes moved to `parameters.viewport.options`. A story written the old way
 * renders at the full canvas width while its name says 320px, which is a false
 * green in the one place a reviewer looks for the mobile-first evidence.
 *
 * So the size is declared in `options` and *selected* in `globals`, and
 * `skeleton-contract.test.tsx` asserts the story exports really carry both -
 * by reading the exported objects, not by searching the file for "320px".
 */
const PHONE_320 = {
  name: "320px — iPhone 4",
  styles: { width: "320px", height: "568px" },
  type: "mobile",
} as const;

const PHONE = {
  parameters: { viewport: { options: { phone320: PHONE_320 } } },
  globals: { viewport: { value: "phone320", isRotated: false } },
};

const meta = {
  title: "Master/Genel bakış",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

/* --------------------------------------------------- skeleton shimmer first */

function SkeletonGallery() {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h3 className="text-lg font-medium">Metin</h3>
        <Skeleton label="Açıklama metni yükleniyor">
          <SkeletonText lines={4} />
        </Skeleton>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-lg font-medium">Kart</h3>
        <Skeleton label="Kart yükleniyor">
          <SkeletonCard withAction lines={3} withFooter />
        </Skeleton>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-lg font-medium">Tablo</h3>
        <Skeleton label="Karar tablosu yükleniyor">
          <SkeletonTable rows={5} columns={4} />
        </Skeleton>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-lg font-medium">Grafik — çubuk</h3>
        <Skeleton label="Portföy grafiği yükleniyor">
          <SkeletonChart shape="bar" bars={4} />
        </Skeleton>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-lg font-medium">Grafik — halka</h3>
        <Skeleton label="Sonuç dağılımı yükleniyor">
          <SkeletonChart shape="pie" bars={4} />
        </Skeleton>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-lg font-medium">Form</h3>
        <Skeleton label="Şirket profili formu yükleniyor">
          <SkeletonForm fields={4} columns={2} />
        </Skeleton>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-lg font-medium">Medya</h3>
        <Skeleton label="Dosya kütüphanesi yükleniyor">
          <SkeletonMedia items={6} />
        </Skeleton>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-lg font-medium">Liste</h3>
        <Skeleton label="Kaynak listesi yükleniyor">
          <SkeletonList items={4} withAvatar />
        </Skeleton>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-lg font-medium">Tek yüzey</h3>
        <Shimmer className="h-touch w-full rounded-md" />
      </section>
    </div>
  );
}

/**
 * Every skeleton shape, at desktop width.
 *
 * Read them next to the loaded stories below: each shape is the same box, the
 * same corner and the same density as the component it replaces, which is what
 * stops the page moving when the data lands.
 */
export const SkeletonShapes: Story = { render: () => <SkeletonGallery /> };

/** The same shapes at 320px, where the table collapses and the media grid rewraps. */
export const SkeletonShapes320: Story = {
  name: "Skeleton — 320px",
  ...PHONE,
  render: () => <SkeletonGallery />,
};

/**
 * The shimmer with motion refused.
 *
 * Storybook cannot change the operating-system preference, so this story sets
 * the product's own switch - the `data-reduced-motion` attribute the appearance
 * store writes on `<html>` - which is the second of the two carriers the
 * shimmer answers. The sweep should be still.
 */
export const SkeletonReducedMotion: Story = {
  name: "Skeleton — hareket azaltılmış",
  /**
   * The attribute is set by a decorator and removed on unmount.
   *
   * Written in `render` first, it leaked: `document.documentElement` is shared
   * by every story in the canvas, nothing ever took the attribute off, and each
   * story opened after this one silently had its motion disabled - so the
   * catalogue stopped showing the animated state it exists to show. A decorator
   * has a teardown; a render function does not.
   */
  decorators: [
    (Story) => {
      useEffect(() => {
        document.documentElement.dataset["reducedMotion"] = "true";
        return () => {
          delete document.documentElement.dataset["reducedMotion"];
        };
      }, []);
      return <Story />;
    },
  ],
  render: () => (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        <code>data-reduced-motion=&quot;true&quot;</code> — parıltı durmalıdır.
      </p>
      <Skeleton label="Hareket azaltılmış yükleme">
        <SkeletonCard lines={3} />
      </Skeleton>
    </div>
  ),
};

/* ------------------------------------------- skeleton / component pairings */

/**
 * The pairings, one story per master component that has a loading state.
 *
 * Each shows the skeleton **above** the component it stands in for, at the same
 * width, so the geometry can be compared by eye rather than trusted. That
 * comparison is the whole point of the rule: if the two boxes are different
 * heights, the page moves when the data lands.
 *
 * `skeleton-map.ts` names these exports and `skeleton-contract.test.tsx`
 * imports this module and checks each one exists. A pairing that is described
 * but not written fails the suite.
 */
function Pairing({
  loading,
  loaded,
}: {
  readonly loading: React.ReactNode;
  readonly loaded: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h3 className="text-lg font-medium">Yükleniyor</h3>
        {loading}
      </section>
      <Separator />
      <section className="flex flex-col gap-2">
        <h3 className="text-lg font-medium">Yüklendi</h3>
        {loaded}
      </section>
    </div>
  );
}

export const SkeletonButton: Story = {
  name: "Pairing — Button",
  render: () => (
    <Pairing
      loading={
        <Skeleton label="Eylemler yükleniyor" className="flex-row flex-wrap gap-2">
          <SkeletonControl width="w-56" />
          <SkeletonControl width="w-28" />
        </Skeleton>
      }
      loaded={
        <div className="flex flex-wrap gap-2">
          <Button>Uygunluk sihirbazını başlat</Button>
          <Button variant="secondary">Çalıştır</Button>
        </div>
      }
    />
  ),
};

export const SkeletonBadge: Story = {
  name: "Pairing — Badge",
  render: () => (
    <Pairing
      loading={
        <Skeleton label="Durum etiketleri yükleniyor" className="flex-row flex-wrap gap-2">
          <Shimmer className="h-6 w-24" />
          <Shimmer className="h-6 w-20" />
          <Shimmer className="h-6 w-28" />
        </Skeleton>
      }
      loaded={
        <div className="flex flex-wrap gap-2">
          <Badge tone="conditional">Koşullu</Badge>
          <Badge tone="insufficient">Yetersiz veri</Badge>
          <Badge tone="candidate">Aday uygunluk</Badge>
        </div>
      }
    />
  ),
};

export const SkeletonCardPairing: Story = {
  name: "Pairing — Card",
  render: () => (
    <Pairing
      loading={
        <Skeleton label="Kart yükleniyor">
          <SkeletonCard withAction lines={3} />
        </Skeleton>
      }
      loaded={
        <Card>
          <CardHeader>
            <CardTitle asChild>
              <h3>Sıradaki eylem</h3>
            </CardTitle>
            <CardAction>
              <Button size="sm" variant="secondary">
                Çalıştır
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <p>
              Kart, ürünün yerleşim dilidir. İskelet aynı kenarlığı, aynı 12px köşeyi ve aynı
              başlık ızgarasını çizer, böylece veri indiğinde hiçbir şey yer değiştirmez.
            </p>
          </CardContent>
        </Card>
      }
    />
  ),
};

export const SkeletonTabs: Story = {
  name: "Pairing — Tabs",
  render: () => (
    <Pairing
      loading={
        <Skeleton label="Sekmeler yükleniyor">
          <SkeletonTabStrip triggers={5} />
          <SkeletonText lines={3} />
        </Skeleton>
      }
      loaded={<TabStrip />}
    />
  ),
};

export const SkeletonProgress: Story = {
  name: "Pairing — Progress",
  render: () => (
    <Pairing
      loading={
        <Skeleton label="Hazırlık oranı yükleniyor">
          <Shimmer className="h-4 w-40" />
          <Shimmer className="h-2 w-full rounded-xs" />
        </Skeleton>
      }
      loaded={
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">Hazırlık tamamlanma oranı</p>
          <Progress value={62} aria-label="Hazırlık tamamlanma oranı" />
        </div>
      }
    />
  ),
};

export const SkeletonSheet: Story = {
  name: "Pairing — Sheet",
  render: () => (
    <Pairing
      loading={
        <Skeleton label="Bağlam paneli yükleniyor">
          <Shimmer className="h-6 w-40" />
          <SkeletonList items={3} withAvatar />
        </Skeleton>
      }
      loaded={<SheetDemo side="end" />}
    />
  ),
};

/* ------------------------------------------------------------------ loaded */

function ButtonMatrix() {
  return (
    <div className="flex flex-col gap-4">
      {(["primary", "secondary", "outline", "ghost", "danger", "link"] as const).map(
        (variant) => (
          <div key={variant} className="flex flex-wrap items-center gap-2">
            <Button variant={variant} size="sm">
              {variant} · sm
            </Button>
            <Button variant={variant} size="md">
              {variant} · md
            </Button>
            <Button variant={variant} size="lg">
              {variant} · lg
            </Button>
            <Button variant={variant} disabled>
              devre dışı
            </Button>
          </div>
        ),
      )}
      <Button variant="primary" block>
        <AppIcon name="quickAction" />
        Tam genişlik
      </Button>
    </div>
  );
}

/** Every variant against every size, plus the disabled state. */
export const Buttons: Story = { render: () => <ButtonMatrix /> };

/** The same matrix at 320px, where the rows wrap instead of overflowing. */
export const Buttons320: Story = {
  name: "Button — 320px",
  ...PHONE,
  render: () => <ButtonMatrix />,
};

function BadgeRow() {
  return (
    <div className="flex flex-wrap gap-2">
      {(
        [
          "neutral",
          "accent",
          "candidate",
          "ineligible",
          "conditional",
          "insufficient",
          "warning",
        ] as const
      ).map((tone) => (
        <Badge key={tone} tone={tone}>
          {tone}
        </Badge>
      ))}
    </div>
  );
}

/** The four outcome tones plus the three interface tones. No "success". */
export const Badges: Story = { render: () => <BadgeRow /> };

export const Badges320: Story = {
  name: "Badge — 320px",
  ...PHONE,
  render: () => <BadgeRow /> ,
};

function CardComposition() {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle asChild>
            <h3>Sıradaki eylem</h3>
          </CardTitle>
          <CardAction>
            <Button size="sm" variant="secondary">
              Çalıştır
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <p>
            Kart, ürünün yerleşim dilidir: her ekran bunların yığınıdır. Başlık seviyesini
            ekran seçer, görünümü master katman verir.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle asChild>
            <h3>Hazırlık</h3>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Progress value={62} aria-label="Hazırlık tamamlanma oranı" />
          <Separator />
          <Progress value={null} aria-label="Ölçülemeyen boyut" />
          <p className="text-sm text-muted-foreground">
            İkinci çubuk <code>value=null</code>: ölçülemeyen bir değer sıfır olarak
            gösterilmez.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/** Card composition, with the progress and separator parts in place. */
export const Cards: Story = { render: () => <CardComposition /> };

export const Cards320: Story = {
  name: "Card — 320px",
  ...PHONE,
  render: () => <CardComposition />,
};

function TabStrip() {
  return (
    <Tabs defaultValue="portfoy">
      <TabsList aria-label="Örnek sekmeler">
        <TabsTrigger value="portfoy">Portföy</TabsTrigger>
        <TabsTrigger value="sonuc">Sonuç</TabsTrigger>
        <TabsTrigger value="kanit">Kanıt</TabsTrigger>
        <TabsTrigger value="takvim">Takvim</TabsTrigger>
        <TabsTrigger value="ekip">Ekip</TabsTrigger>
      </TabsList>
      <TabsContent value="portfoy">Portföy içeriği.</TabsContent>
      <TabsContent value="sonuc">Sonuç içeriği.</TabsContent>
      <TabsContent value="kanit">Kanıt içeriği.</TabsContent>
      <TabsContent value="takvim">Takvim içeriği.</TabsContent>
      <TabsContent value="ekip">Ekip içeriği.</TabsContent>
    </Tabs>
  );
}

/** Five tabs — more than fit at 320px, which is the point of the 320 story. */
export const TabsStory: Story = { name: "Tabs", render: () => <TabStrip /> };

export const Tabs320: Story = {
  name: "Tabs — 320px (kaydırılır)",
  ...PHONE,
  render: () => <TabStrip />,
};

/** The tooltip opens on focus as well as hover, and closes on Escape. */
export const TooltipStory: Story = {
  name: "Tooltip",
  render: () => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline">
            <AppIcon name="info" />
            Karar özeti nedir?
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          Ön değerlendirmedir; resmî kurum kararı değildir ve bağlayıcı değildir.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
};

function SheetDemo({ side }: { side: "start" | "end" | "bottom" }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="secondary">
          <AppIcon name="menu" />
          {side} panelini aç
        </Button>
      </SheetTrigger>
      <SheetContent side={side}>
        <SheetHeader>
          <SheetTitle className="text-lg font-medium">Bağlam paneli</SheetTitle>
          <SheetClose asChild>
            <Button variant="ghost" size="icon" aria-label="Paneli kapat">
              <AppIcon name="close" />
            </Button>
          </SheetClose>
        </SheetHeader>
        <SheetBody>
          <p>
            Escape kapatır, odak tuzağa düşer ve kapanınca tetikleyiciye döner. Bu davranış
            Radix&apos;in, görünüm master katmanın.
          </p>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

/** The drawer from the inline edge — the desktop navigation idiom. */
export const SheetStart: Story = { name: "Sheet — start", render: () => <SheetDemo side="start" /> };

/**
 * The bottom sheet at 320px — the native phone idiom.
 *
 * A panel that slides from the bottom is what a phone user expects and what the
 * thumb can reach; the same panel pinned to the side edge is a desktop pattern
 * shrunk down.
 */
export const SheetBottom320: Story = {
  name: "Sheet — 320px alt çekmece",
  ...PHONE,
  render: () => <SheetDemo side="bottom" />,
};
