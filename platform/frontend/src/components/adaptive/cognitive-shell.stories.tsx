/**
 * Cognitive Shell V2 — the dedicated catalogue `cognitive-shell-v2.test.tsx`
 * names, not `adaptive.stories.tsx`.
 *
 * `cognitive-shell-v2.test.tsx`'s own comment explains why some of the states
 * below cannot be reached by clicking anything in the running application:
 * the command resolver in `command.ts` is synchronous and local (it matches
 * substrings against navigation labels this client already has), so it can
 * never itself produce a `loading`, `ai-unavailable`, `offline`, `permission`,
 * `error` or `partial` condition. Those five and the loading skeletons are
 * demonstrations of what `describeCommandStatus` would render if a future
 * provider-backed vocabulary reported them - structural documentation of an
 * honest state, not a claim that this build can enter it. Every such story
 * says so in its own description.
 *
 * **Declaration order is load-bearing.** The skeleton/loading exports come
 * first, before any loaded/closed export - `cognitive-shell-v2.test.tsx`
 * reads `Object.keys()` on this module and fails if a loaded story is
 * declared first. See `[[skeleton-shimmer-first]]`.
 */

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { SkeletonControl, SkeletonList } from "@/components/ui/skeleton";
import { startDemoSession } from "@/demo";

import { describeCommandStatus, type CommandStatus } from "./command";
import { ShellAccountMenu } from "./ShellAccountMenu";
import {
  ShellHeaderSpotlight,
  type SpotlightAnswer,
  type SpotlightConfirmation,
} from "./ShellHeaderSpotlight";
import { ShellIdentityStrip } from "./ShellIdentityStrip";
import { ShellSidebarCommand } from "./ShellSidebarCommand";
import { ShellSidebarNav, type ShellNavItemMeta } from "./ShellSidebarNav";
import { AdaptiveShell, ShellNotificationsTrigger } from "./AdaptiveShell";
import type { NavItem } from "../shells";

const meta = {
  title: "Adaptive/Cognitive Shell V2",
};
export default meta;

/* ------------------------------------------------------------- fixtures */

const SAMPLE_NAV: readonly NavItem[] = [
  { to: "/panel", label: "Kokpit" },
  { to: "/degerlendirmeler", label: "Kararlar" },
  { to: "/firsatlar", label: "Fırsatlar" },
  { to: "/organizasyon/hazirlik", label: "Hazırlık" },
  { to: "/ayarlar/gorunum", label: "Ayarlar" },
];

/**
 * The router itself comes from Storybook's global `withRouter` decorator
 * (`.storybook/preview.tsx`) — every story already renders inside one. A
 * second `MemoryRouter` here would nest routers, which React Router refuses.
 */
function Providers({ children }: { readonly children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** Fires a real input event, the way a person typing would. */
function TypedCommand({ query }: { readonly query: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const input = rootRef.current?.querySelector<HTMLInputElement>('input[type="search"]');
    if (input === null || input === undefined) return;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")
      ?.set;
    setter?.call(input, query);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, [query]);
  return (
    <div ref={rootRef}>
      <ShellSidebarCommand navItems={SAMPLE_NAV} />
    </div>
  );
}

/** A status this repository's own resolver can never itself produce - see the file header. */
function UnreachableCommandStatus({ status }: { readonly status: CommandStatus }) {
  return (
    <div className="dt-drawer__command">
      <p className="dt-drawer__command-status">{describeCommandStatus(status)}</p>
    </div>
  );
}

/** Focuses the header Spotlight on mount, the way clicking or Cmd/Ctrl+K would. */
function FocusedSpotlight({
  query,
  answer,
  confirmation,
}: {
  readonly query?: string;
  readonly answer?: SpotlightAnswer;
  readonly confirmation?: SpotlightConfirmation;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const input = rootRef.current?.querySelector<HTMLInputElement>('input[type="search"]');
    if (input === null || input === undefined) return;
    input.focus();
    if (query === undefined) return;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")
      ?.set;
    setter?.call(input, query);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, [query]);
  return (
    <div ref={rootRef}>
      <ShellHeaderSpotlight
        navItems={SAMPLE_NAV}
        {...(answer ? { answer } : {})}
        {...(confirmation ? { confirmation } : {})}
      />
    </div>
  );
}

/**
 * Reference-style fixture values, demonstration-only.
 *
 * These strings echo the supplied Master Page / Sidebar 3a canon (org name,
 * stale-source phrasing, AI-answer copy) so the shapes are reviewable against
 * the reference. None of it is data this build has: see each story's own
 * description for what is real (the shell's honest fallback) versus what is
 * a fixture (this file, only).
 */
const FIXTURE_ANSWER: SpotlightAnswer = {
  text:
    "Bugün en kritik kayıt DEG-2026-0184: TÜBİTAK 1507 değerlendirmesinde 4 kuraldan 3'ü " +
    "karşılanıyor, R-07 (son 12 ay Ar-Ge harcaması) veri bekliyor.",
  confidenceLabel: "güven yüksek · 2 kaynak",
  citations: [
    { id: "c1", title: "TÜBİTAK 1507 çağrı duyurusu · madde 4.2", meta: "Yürürlük 1 Oca 2026" },
    { id: "c2", title: "Kural seti v12 · R-07", meta: "Son 12 ay Ar-Ge harcaması eşiği" },
  ],
};

const FIXTURE_CONFIRMATION: SpotlightConfirmation = {
  text:
    "DEG-2026-0184 için yeni değerlendirme kuyruğa alınacak ve R-07 alanı düzenlenmek üzere " +
    "açılacak. Kayıt, siz onaylamadan değiştirilmez.",
  confirmLabel: "Onayla ve çalıştır",
  rejectLabel: "Vazgeç",
  onConfirm: () => undefined,
  onReject: () => undefined,
};

const FIXTURE_NAV_META: Readonly<Record<string, ShellNavItemMeta>> = {
  "/degerlendirmeler": {
    count: 2,
    status: { tone: "bad", label: "Kanıt bekleyen karar var" },
    quickActions: [
      {
        id: "a1",
        title: "R-07 alanını doldur",
        description: "DEG-2026-0184 · sonucu değiştirebilir",
      },
      {
        id: "a2",
        title: "Koşullu kararları filtrele",
        description: "5 kayıt · kanıt bekliyor",
      },
    ],
  },
  "/firsatlar": {
    count: 1,
    status: { tone: "warning", label: "Yaklaşan son başvuru var" },
    quickActions: [
      {
        id: "a3",
        title: "45 günü kalan çağrıyı aç",
        description: "KOSGEB Ar-Ge · hazırlık %40",
      },
    ],
  },
  "/panel": { count: 0, status: { tone: "ok", label: "Güncel" } },
};

/* -------------------------------------------------- 1. loading / skeleton */

export const ShellLoadingSkeleton = {
  name: "çekmece · yükleniyor (loading skeleton)",
  render: () => <SkeletonList items={5} withAvatar />,
  parameters: {
    docs: {
      description: {
        story:
          "yapı iskeleti / skeleton: gezinme sözlüğü paketle birlikte geldiği için bu " +
          "yükleniyor durumu gerçek uygulamada gözlenemez - yalnızca belgeleyici bir " +
          "gösterimdir.",
      },
    },
  },
};

export const SpotlightLoadingSkeleton = {
  name: "spotlight · yükleniyor (loading skeleton)",
  render: () => <SkeletonControl />,
  parameters: {
    docs: {
      description: {
        story: "yapı iskeleti / skeleton: spotlight girişinin yüklenme öncesi biçimi.",
      },
    },
  },
};

/* --------------------------------------------------- 2. drawer open/closed */

export const DrawerClosed = {
  name: "çekmece · kapalı (closed)",
  render: () => (
    <Providers>
      <AdaptiveShell navItems={SAMPLE_NAV} title="Kokpit">
        <p>İçerik</p>
      </AdaptiveShell>
    </Providers>
  ),
};

export const DrawerOpenViaHamburger = {
  name: "çekmece · açık (open) · hamburger tetik",
  parameters: {
    docs: {
      description: {
        story: "hamburger, paylaşılan çekmeceyi komut girişine odaklanmış biçimde açar.",
      },
    },
  },
  render: () => (
    <Providers>
      <div className="dt-drawer__content" style={{ position: "static" }}>
        <ShellSidebarCommand navItems={SAMPLE_NAV} />
        <ShellSidebarNav navItems={SAMPLE_NAV} />
      </div>
    </Providers>
  ),
};

/** Opens the account dropdown on mount, the way clicking the footer trigger would. */
function OpenAccountMenu() {
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const trigger = rootRef.current?.querySelector<HTMLButtonElement>(
      "[data-shell-account-trigger]",
    );
    trigger?.click();
  }, []);
  return (
    <div ref={rootRef} className="dt-drawer__footer">
      <ShellAccountMenu />
    </div>
  );
}

export const AccountMenuOpen = {
  name: "hesap menüsü · açık (tüm ögeler)",
  parameters: {
    docs: {
      description: {
        story:
          "referanstaki tam öge kümesi: Ayarlar, Yardım, Dil ve bölge (devre dışı), " +
          "Çalışma alanlarım (devre dışı), Erişilebilirlik, Rol ve izinler (devre dışı), " +
          "Çıkış - devre dışı ögelerin gerekçesi domain/capabilities.ts'ten okunur.",
      },
    },
  },
  render: () => (
    <Providers>
      {(() => {
        startDemoSession("superadmin");
        return null;
      })()}
      <OpenAccountMenu />
    </Providers>
  ),
};

export const DrawerOpenViaAvatar = {
  name: "çekmece · açık (open) · avatar tetik (hesap tetik)",
  parameters: {
    docs: {
      description: {
        story:
          "avatar, aynı çekmeceyi footer hesap tetiğine odaklanmış biçimde açar - " +
          "ikinci bir hesap sayfası açmaz.",
      },
    },
  },
  render: () => (
    <Providers>
      {(() => {
        startDemoSession("superadmin");
        return null;
      })()}
      <div className="dt-drawer__content" style={{ position: "static" }}>
        <ShellSidebarNav navItems={SAMPLE_NAV} />
        <div className="dt-drawer__footer">
          <ShellAccountMenu />
        </div>
      </div>
    </Providers>
  ),
};

/* --------------------------------------------- 3. the composed shell */

export const HeaderSpotlightStandalone = {
  name: "spotlight (master bileşen)",
  render: () => (
    <Providers>
      <ShellHeaderSpotlight navItems={SAMPLE_NAV} />
    </Providers>
  ),
};

export const SpotlightExpandedIdleTiles = {
  name: "spotlight · genişledi · boşta (gezinme kutucukları)",
  parameters: {
    docs: {
      description: {
        story:
          "spotlight odaklandığında, sorgu boşken gezinmenin kendisinden türetilen " +
          "kutucuklar gösterilir - uydurma öneri veya sayaç yok.",
      },
    },
  },
  render: () => (
    <Providers>
      <FocusedSpotlight />
    </Providers>
  ),
};

export const SpotlightExecuteAffordance = {
  name: "spotlight · tek sonuç · çalıştır düğmesi",
  parameters: {
    docs: {
      description: {
        story:
          "sorgu sözlükte tam olarak bir hedefe karşılık geldiğinde → çalıştır düğmesi " +
          "belirir ve Enter aynı hedefe gider; birden çok eşleşme varken düğme " +
          "görünmez, çünkü hangi sonucun çalıştırılacağı belirsizdir.",
      },
    },
  },
  render: () => (
    <Providers>
      <FocusedSpotlight query="karar" />
    </Providers>
  ),
};

export const ComposedShell = {
  name: "birleşik kabuk (composed shell)",
  render: () => (
    <Providers>
      <AdaptiveShell navItems={SAMPLE_NAV} title="Kokpit">
        <p>Sayfa içeriği</p>
      </AdaptiveShell>
    </Providers>
  ),
};

export const NotificationsTriggerDisabledHonestly = {
  name: "bildirimler · devre dışı (dürüst gerekçe)",
  parameters: {
    docs: {
      description: {
        story:
          "bu dağıtımın bildirim sistemi yok; sayı uydurmak yerine kontrol devre dışı " +
          "ve gerekçesi ekran okuyucuya `aria-describedby` ile bağlı.",
      },
    },
  },
  render: () => <ShellNotificationsTrigger />,
};

/* --------------------------------------------------- 4. command states */

export const CommandIdle = {
  name: "komut · boşta (idle)",
  render: () => (
    <Providers>
      <ShellSidebarCommand navItems={SAMPLE_NAV} />
    </Providers>
  ),
};

export const CommandFiltering = {
  name: "komut · filtreleme (filtering)",
  render: () => (
    <Providers>
      <TypedCommand query="karar" />
    </Providers>
  ),
};

export const CommandNoResults = {
  name: "komut · sonuç yok (no results)",
  render: () => (
    <Providers>
      <TypedCommand query="zzzzz-bulunamayan-sorgu" />
    </Providers>
  ),
};

export const CommandAiUnavailable = {
  name: "komut · yapay zekâ kullanılamıyor (ai unavailable)",
  parameters: {
    docs: {
      description: {
        story:
          "bu depoda bağlı bir sağlayıcı yok; komut çözücü kendisi asla bu durumu " +
          "üretmez - bkz. dosya başlığı.",
      },
    },
  },
  render: () => <UnreachableCommandStatus status="ai-unavailable" />,
};

export const CommandOffline = {
  name: "komut · çevrimdışı (offline)",
  render: () => <UnreachableCommandStatus status="offline" />,
};

export const CommandPermission = {
  name: "komut · izin yok (permission)",
  render: () => <UnreachableCommandStatus status="permission" />,
};

export const CommandError = {
  name: "komut · hata (error)",
  render: () => <UnreachableCommandStatus status="error" />,
};

export const CommandPartial = {
  name: "komut · kısmi sonuç (partial)",
  render: () => <UnreachableCommandStatus status="partial" />,
};

/* --------------------------------------------------------- 5. appearance */

export const ThemeLight = {
  name: "tema · açık tema (light)",
  globals: { theme: "light" },
  render: () => (
    <Providers>
      <ComposedShell.render />
    </Providers>
  ),
};

export const ThemeDark = {
  name: "tema · koyu (dark)",
  globals: { theme: "dark" },
  render: () => (
    <Providers>
      <ComposedShell.render />
    </Providers>
  ),
};

export const ReducedMotionShell = {
  name: "hareket azalt (reduced motion)",
  render: () => {
    if (typeof document !== "undefined") {
      document.documentElement.dataset["reducedMotion"] = "true";
    }
    return (
      <Providers>
        <ComposedShell.render />
      </Providers>
    );
  },
};

/* ---------------------------------------------------------- 6. viewports */

const VIEWPORT_OPTIONS = {
  phone320: { name: "320px", styles: { width: "320px", height: "640px" } },
  phone390: { name: "390px", styles: { width: "390px", height: "844px" } },
  tablet768: { name: "768px", styles: { width: "768px", height: "1024px" } },
  desktop1024: { name: "1024px", styles: { width: "1024px", height: "800px" } },
  desktop1440: { name: "1440px", styles: { width: "1440px", height: "900px" } },
} as const;

function viewportStory(name: string, key: keyof typeof VIEWPORT_OPTIONS) {
  return {
    name,
    parameters: { viewport: { options: VIEWPORT_OPTIONS } },
    globals: { viewport: { value: key } },
    render: () => (
      <Providers>
        <ComposedShell.render />
      </Providers>
    ),
  };
}

export const Viewport320 = viewportStory("görünüm · 320px", "phone320");
export const Viewport390 = viewportStory("görünüm · 390px", "phone390");
export const Viewport768 = viewportStory("görünüm · 768px", "tablet768");
export const Viewport1024 = viewportStory("görünüm · 1024px", "desktop1024");
export const Viewport1440 = viewportStory("görünüm · 1440px", "desktop1440");

/* ------------------------- 7. structural master-contract fixtures -------- */
/**
 * Every story in this section demonstrates a shape the master components
 * accept, using reference-style fixture values - never a claim about what
 * the running application currently produces. `AdaptiveShell.tsx` binds each
 * of these props to real data where real data exists (the demo role) and to
 * an honest, stated fallback everywhere else; see the component's own file
 * header for exactly which is which.
 */

export const IdentityStripRealFallback = {
  name: "üst şerit · gerçek geri dönüş (organizasyon/rol/kaynak sağlığı yok)",
  parameters: {
    docs: {
      description: {
        story:
          "AdaptiveShell'in kendi bağladığı durum: bu dağıtımda organizasyon kavramı " +
          "yok (tek kiracı), demo oturumu açık değilse rol modeli tanımlı değil, ve " +
          "hiçbir rota kaynak tazeliği beslemiyor - üçü de domain/capabilities.ts'ten " +
          "okunan gerçek gerekçelerle, uydurma değer olmadan gösterilir.",
      },
    },
  },
  render: () => (
    <ShellIdentityStrip
      organisation={{ label: "Bu dağıtım tek çalışma alanı barındırır.", tone: "neutral" }}
      role={{ label: "Rol modeli domainde tanımlı değil.", tone: "neutral" }}
      sourceHealth={{ label: "Kaynak tazeliği bu ekranda izlenmiyor.", tone: "neutral" }}
    />
  ),
};

export const IdentityStripFixtureValues = {
  name: "üst şerit · referans değerleriyle (fixture)",
  parameters: {
    docs: {
      description: {
        story:
          "referanstaki 'Arge Yazılım A.Ş. · Danışman · 1 kaynak bayat' örneğini bu " +
          "dosyadaki sabit değerlerle canlandırır - uygulamanın ürettiği bir veri değil.",
      },
    },
  },
  render: () => (
    <ShellIdentityStrip
      organisation={{ label: "Arge Yazılım A.Ş. (fixture)", tone: "neutral" }}
      role={{ label: "Danışman (fixture)", tone: "ok" }}
      sourceHealth={{ label: "1 kaynak bayat (fixture)", tone: "warning" }}
    />
  ),
};

export const NotificationsTriggerWithCountFixture = {
  name: "bildirimler · sayılı (fixture) · gerçekte devre dışı ile karşılaştır",
  parameters: {
    docs: {
      description: {
        story:
          "count verildiğinde tetik etkinleşir ve rozet gösterir - bu depoda hiçbir " +
          "rota gerçek bir sayı beslemez, bkz. 'bildirimler · devre dışı' hikâyesi.",
      },
    },
  },
  render: () => <ShellNotificationsTrigger count={3} />,
};

export const SpotlightAnswerWithCitationsFixture = {
  name: "spotlight · AI yanıtı + kaynak gösterimi (fixture, ulaşılamaz)",
  parameters: {
    docs: {
      description: {
        story:
          "bu depoda bağlı bir AI sağlayıcısı yok (NO_ASSISTANT_PROVIDER); bu şekil " +
          "hiçbir gerçek etkileşimle üretilemez. Referans metniyle yapı ve kaynak " +
          "gösterimi kanıtlanır - sağlayıcı bağlandığında dolduracak boş bir kalıp.",
      },
    },
  },
  render: () => (
    <Providers>
      <FocusedSpotlight query="en kritik karar" answer={FIXTURE_ANSWER} />
    </Providers>
  ),
};

export const SpotlightConfirmationPreviewFixture = {
  name: "spotlight · onay önizlemesi (fixture, ulaşılamaz)",
  parameters: {
    docs: {
      description: {
        story:
          "bir yazma işlemi öncesi onay kalıbı - aynı sağlayıcı yokluğu nedeniyle bu " +
          "build'de tetiklenemez; yapının kendisi burada canlı tutulur.",
      },
    },
  },
  render: () => (
    <Providers>
      <FocusedSpotlight query="değerlendirme başlat" confirmation={FIXTURE_CONFIRMATION} />
    </Providers>
  ),
};

export const SidebarNavWithCountsStatusAndActionsFixture = {
  name: "çekmece gezinmesi · sayı, durum noktası, hızlı eylemler (fixture)",
  parameters: {
    docs: {
      description: {
        story:
          "metaByRoute referans verileriyle dolduruldu (fixture) - gerçek uygulama hiçbir " +
          "rotaya bunu bağlamaz (bkz. ShellSidebarNav dosya başlığı), bu yüzden çalışan " +
          "üründe hiçbir bölüm sayı ya da nokta göstermez.",
      },
    },
  },
  render: () => (
    <Providers>
      <div className="dt-drawer__content" style={{ position: "static" }}>
        <ShellSidebarNav navItems={SAMPLE_NAV} metaByRoute={FIXTURE_NAV_META} />
      </div>
    </Providers>
  ),
};
