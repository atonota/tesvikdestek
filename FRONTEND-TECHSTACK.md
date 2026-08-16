# DestekTeşvik — Frontend Teknoloji Yığını Karar Belgesi

**Tarih:** 2026-08-15
**Kapsam:** `platform/frontend/` — DestekTeşvik'in React tabanlı frontend uygulaması.
**Belge sınıfı:** Karar belgesi. Yürürlüktedir; değişikliği yalnız yeni bir karar kaydı (ADR) yapar.
**Revizyon:** **v3** — kaynak otoritesi düzeltildi. v2, `~/Desktop/frontend-tecstack.md`
belgesini "dış tavsiye, talimat değil" sayıyor ve Tailwind v4 ile shadcn/ui'yi Bölüm 8'de
*ölçüm bekleyen aday* olarak listeliyordu. **Bu bir karar değil, bir hataydı ve
düzeltilmiştir.** Bileşen soyağacı (Bölüm 3), Storybook katalog sözleşmesi (Bölüm 4) ve
port/adaptör stratejisi (Bölüm 5) v2'den değişmeden gelir.
**Girdi:** `~/Desktop/frontend-tecstack.md` — **sahibin bağlayıcı teknik girdisi.**
**capability_delta:** `+1` — v3'ün kaydettiği yığın kurulmuştur ve
`src/test/master-stack-contract.test.ts` ile testlidir.

> **Kaynak otoritesi.** `~/Desktop/frontend-tecstack.md` bu ürün için **bağlayıcıdır**.
> Bir repo belgesi onu "harici tavsiye", "koşullu" veya "opsiyonel" diye ezemez; v2'nin
> yaptığı buydu ve geri alınmıştır.
>
> Kaynak belge birden çok ürün için yazılmıştır, dolayısıyla her satırı bu repoya
> uymaz — ama **uymayan tek şey sürüm numaralarıdır, kararlar değil.** Repoda React
> Router **7.18.2** ve Vite **8.2.1** kuruludur; kaynak belge Router v8 ve Vite 7 der.
> Bunlar bu repoda daha yeni sürümlerdir ve `React Router v8` ayrı, kanıtlı bir
> migration milestone'u olarak kalır (Bölüm 8). Teknoloji **seçimleri** — Tailwind v4 +
> shadcn/ui, Phosphor ikonlar, yoğun analitikte ECharts, aynı pakette SCSS yasağı —
> tartışmaya açık değildir ve Bölüm 6'da yürürlükteki yığın olarak kayıtlıdır.

---

## 1. Owner özeti — neyi neden seçtik

Sade Türkçe, dört cümle:

1. **Zaten kurulu ve çalışan yığını koruyoruz.** React 19, React Router 7, TanStack
   Query/Table, React Hook Form, Zod, Zustand, Radix ve TypeScript strict repoda kurulu,
   testli ve çalışıyor. Çalışan bir temeli moda için değiştirmek, ürün ilerlemesini aylarca
   durdurur ve hiçbir müşteri sorunu çözmez.
2. **Eksik olan yığın değil, ürün katmanıdır.** Bu yüzden bu belgedeki "eklenecek"
   listesinin tamamı bir ürün ihtiyacına bağlıdır: dosya yükleme, grafik, zengin metin,
   bildirim, çok dillilik, gerçek zamanlı akış. Hiçbiri "modern olsun diye" eklenmez.
3. **Tasarım katmanı Tailwind v4 + shadcn/ui'dir; tasarım *tokenları* korunur.** İkisi
   çelişmez ve bu ayrımı yapmak kararın tamamıdır. Renk, köşe, tipografi ve yoğunluk
   sözleşmesi `tokens.css`'te kalır — parlamento mavisi ile limon sarısının kontrastı,
   12px köşe tavanı ve 1rem taban orada ölçülür. Tailwind bu tokenları `@theme inline`
   ile *işaret eder*, kopyalamaz; shadcn/ui bileşenleri o tokenlarla boyanır. Böylece
   ekranlar yeni sistemle çizilirken hiçbir tasarım sınırı ikinci bir palete kaymaz.
   **SCSS bu pakete girmez** — Tailwind zaten ön işlemcidir ve ikisi aynı pakette
   karıştırılmaz.
4. **Backend P1 frontend fazında geliştirilmez ama sözleşme bağlayıcıdır.** Frontend, tipli
   portlar üzerinden çalışır ve FastAPI'nin üreteceği OpenAPI sözleşmesine uyar; uydurma uç
   kullanmaz, SSR HTML ayrıştırmaz. Backend **P3'te başlar** ve programın kapsamındadır.

**Sahibin diliyle:** Bir CRM'iniz var. Motoru sağlam, direksiyonu çalışıyor, frenleri
test edilmiş. Ama koltuk yok, cam yok, kontak paneli yok. Doğru karar motoru değiştirmek
değil; koltukları takmaktır.

---

## 2. Kanonik sınırlar — pazarlık edilmez

| # | Sınır | Kapsam |
|---|---|---|
| 1 | **Next.js yoktur** | Aday değil, geçiş hedefi değil, opsiyon değil. Hiçbir belgede, hiçbir karşılaştırmada önerilmez. |
| 2 | **MetaFramer yoktur** | Aynı kapsam. |
| 3 | **Backend P1'de geliştirilmez** | Ama frontend **FastAPI / OpenAPI-compatible** olmak zorundadır. Backend P3–P6'da yapılır; "hiç yapılmayacak" demek değildir. |
| 4 | **Modular monolith** | Mikroservis değil, mikro-frontend değil. Tek uygulama, iyi ayrılmış modüller. |
| 5 | **Mobile-first, gerçek native 320px** | Kaynak düzen 320'de kurulur. "Responsive yaptık" bu sınırı karşılamaz. |
| 6 | **Minimum görünür metin 1rem** | 1rem altı görünür metin ihlaldir. |
| 7 | **Roboto, ağırlık 400+** | 300 ve altı ağırlık kullanılmaz. |
| 8 | **Köşe yuvarlaklığı ≤ 12px** | Arama alanı tek bilinçli istisnadır. |
| 9 | **Yerel depolama varsayılan, S3 opsiyonel** | Dosya depolama portu yerel adaptörle çalışır; S3 asla zorunlu bağımlılık olmaz. |
| 10 | **Mock testi production kanıtı değildir** | Her paket gerçek backend kapısını ayrı raporlar. |
| 11 | **İlk teslim MVP değildir** | P1 frontend teslimi eksiksiz, olgun, enterprise ve satılabilir olarak verilir; prototip, iskelet veya "sonra olgunlaştırılacak" bir taslak değildir. |
| 12 | **Storybook zorunludur** | Görünür her bileşen, Bölüm 4'teki yedi boyutla kataloglanır. Katalog eksikse milestone GREEN alamaz. |
| 13 | **Bileşen tekilliği** | Aynı rolü kuran ikinci bir bağımsız uygulama yazılamaz; soyağacı ve no-duplicate kuralı Bölüm 3'tedir. |

---

## 3. Bileşen mimarisi ve soyağacı (lineage)

### 3.1 Beş kademe — kullanıcının ifadesi korunarak

Kullanıcı bileşen sistemini beş kademeyle tanımladı. **İfade aynen korunur**; aşağıda her
kademenin React'teki somut karşılığı ve dizin yeri vardır. "Kalıtım / türeme" kelimesi
**silinmez**: React'te sınıf kalıtımı (`extends`) kullanılmadığı için türeme,
**sarmalama (wrapping) + yapılandırma (configuration) + sözleşme daraltma** ile gerçekleşir.
Bu bir kelime değişikliği değil, aynı niyetin React'teki doğru uygulamasıdır.

| Kademe | Kullanıcının ifadesi | React karşılığı | Repo yeri |
|---|---|---|---|
| 1 | **Frontend bileşeni** | Render edilen her görünür React bileşeni | `src/components/**` |
| 2 | **Ana bileşen (main)** | Bir davranışın tek sahibi (`Button`, `Dialog`, `Input`) | `primitives.tsx`, `composites.tsx` |
| 3 | **Master bileşen** | Bütün bir alanın tek sözleşmesi (`DataGrid`, `MediaLibrary`, `AppShell`, `FormShell`) | `data-grid/`, `media/`, `adaptive/`, `forms/` |
| 4 | **Master-main bileşen** | Master'ın içindeki, master sözleşmesini taşıyan ana parça (`GridToolbar`, `GridViewport`, `ShellHeader`) | İlgili master dizini |
| 5 | **Türeyen bileşen** | Ana/master bileşeni sarmalayıp yapılandıran, kendi davranışını eklemeyen bileşen (`PrimaryButton`, `DangerDialog`, `ApplicationGrid`) | `domain.tsx`, `templates.tsx` |

### 3.2 Türeme sözleşmesi — dört bağlayıcı kural

1. **Tek ata.** Türeyen bir bileşenin **tam olarak bir** ana/master atası vardır ve bu ata
   `registry.ts` kütüğünde adıyla yazılıdır.
2. **Davranış eklemez, daraltır.** Türev yalnız varsayılan prop, varyant, kısıtlanmış
   sözleşme ve alan anlamı ekler. Kendi odak tuzağını, kendi klavye haritasını veya kendi
   ARIA yapısını kuruyorsa **o bir türev değildir**; yeni bir ana bileşendir ve öyle
   kaydedilir.
3. **Erişilebilirlik atadan gelir.** Türevde ikinci kez a11y kurulmaz; atanın a11y testi
   türevi de korur.
4. **No-duplicate.** Aynı görsel/davranışsal rolü kuran ikinci bir bağımsız uygulama
   yazılamaz. Bir muhafız testi bunu koda karşı zorlar ve ihlalde paketi düşürür.

### 3.3 Bugünkü repo gerçeği ve kapanacak fark

`src/components/registry.ts` bugün kademe **listesi** tutar ve bir test kademe sayılarını
koda karşı zorlar: **primitives 14 / composites 16 / patterns 10 / shells 5 / domain 18 /
templates 12 = 75 kayıtlı bileşen.** Bunların dışında dört alt sistem vardır: `data-grid`,
`media`, `provider-connections`, `adaptive`.

**Eksik olan:** kütük **ata–türev ilişkisini tutmaz**. Yani bugün "bu bileşen hangi ana
bileşenden türedi" sorusunun makine tarafından okunabilir bir cevabı yoktur ve
**no-duplicate kuralı zorlanmamaktadır.** Kapanışı `V2-P0-05`'tedir.

---

## 4. Storybook — zorunlu katalog sözleşmesi

**Bileşenin kaynağı repo kodudur. Storybook kalıcı katalog ve test yüzeyidir.** İkisi
birbirinin yerine geçmez ve Storybook opsiyonel bir vitrin değildir; **bağlayıcı bir
kapıdır.**

### 4.1 Bir katalog girişinin taşımak zorunda olduğu yedi boyut

| # | Boyut | Kabul |
|---|---|---|
| 1 | **Varyantlar** | Tanımlı her görsel/anlamsal varyant için story |
| 2 | **Durumlar** | Yükleniyor, boş, sonuç yok, hata, kısmi, başarı, yetki, çevrimdışı — bileşen için anlamlı olanların hepsi |
| 3 | **320px** | Kaynak düzende gerçek görünüm; yatay taşma yok |
| 4 | **Dark ve light** | İkisi de ayrı story; biri diğerinin türevi değil |
| 5 | **Etkileşim** | Odak, hover, aktif, devre dışı, geçersiz ve klavye yolu |
| 6 | **Erişilebilirlik** | Story üzerinde axe koşar; critical/serious = 0 |
| 7 | **Soyağacı** | Girişte atası ve türevleri adıyla yazılı |

### 4.2 Bugünkü ölçüm ve kapsam farkı

| Ölçü | Bugün | Hedef |
|---|---|---|
| Story dosyası | 10 | — |
| Storybook `Meta` bildirimi (katalog girişi) | **10** | **75+** |
| Toplam `Story` dışa aktarımı | 89 | Yedi boyutu karşılayacak kadar |
| Katalog biçimi | Kademe başına "Genel bakış" (`1 Primitifler/Genel bakış` gibi) | Bileşen başına kendi girişi |
| Kendi katalog girişi olan kayıtlı bileşen | **0 / 75** | **75 / 75** |

**Doğru okuma:** Bugünkü Storybook boş değildir; 89 story gerçek ve testlidir. Ama katalog
**kademe düzeyinde**dir, **bileşen düzeyinde** değil. Yapılacak iş bir yeniden yazma değil,
bir **genişletmedir**: mevcut 89 story korunur ve bileşen girişlerine dağıtılır.

**Bağlayıcı kapı:** Kütükteki bir bileşen yedi boyutu taşıyan bir katalog girişine sahip
değilse, o bileşeni içeren milestone GREEN alamaz. Bu, P1 boyunca **her** milestone'un
kabul kriteridir; ayrı ve sonraki bir "katalog fazı" **yoktur**.

---

## 5. Frontend-first sözleşme ve port / adaptör stratejisi

### 5.1 Neden port

Frontend **P1'de tek başına** teslim edilir; backend **P3'te** başlar. Aradaki boşluk
uydurma uçla değil, **tipli port**la geçilir.

```
Bileşen  →  Port (tipli sözleşme, Zod ile doğrulanır)
                 ├─ MockAdapter   (P1 boyunca; açıkça mock olarak işaretli)
                 └─ HttpAdapter   (P3+ geldiğinde; OpenAPI'den üretilmiş istemci)
```

Bileşen hangi adaptörün arkada olduğunu bilmez. Adaptör değişimi **bileşeni değiştirmez** —
P1'de yazılan yüzeylerin backend gelince yeniden yazılmamasının tek sebebi budur.

### 5.2 Backend yokken ne kanıtlanır, ne kanıtlanmaz

| Kanıtlanan | Kanıtlanmayan |
|---|---|
| Yüzeyin sekiz durumu render edilir ve testlidir | Gerçek sunucu davranışı |
| Port sözleşmesi tiplidir ve `.strict()` Zod ile doğrulanır | Sözleşmenin gerçek OpenAPI çıktısıyla birebir uyuştuğu |
| Mock adaptör **açıkça mock** olarak işaretlenir ve muhafız testiyle kilitlenir | Uçtan uca gerçek veri akışı |
| Yetenek kütüğü, arkasında uç olmayan her yeteneği **engelli** ilan eder | Engelli yeteneğin ne zaman açılacağı |

**Bağlayıcı kural:** Bir port'un mock adaptörle çalışması hiçbir yerde "bu fonksiyon
çalışıyor" diye raporlanmaz. P1 tesliminin iddiası şudur ve yalnız şudur: **frontend
eksiksiz, olgun, enterprise ve sözleşmeye bağlıdır; ürünün tamamı production'a hazır
değildir.**

### 5.3 Bugünkü repo gerçeği

Desen bugün **doğru ama tekil**: tipli port yalnız
`src/components/provider-connections/types.ts:379`'daki `ProviderConnectionPort`'tur. Medya
yükleme yüzeyi de bir taşıma katmanı bekler ve verilmediği için **gerekçesiyle kapalıdır** —
bu doğru davranıştır. Eksik olan, aynı disiplinin **uygulama geneline yayılmasıdır**
(`V2-P1-23`, `V2-P1-24`).

---

## 6. Mevcut ve korunacak

Bunlar repoda kuruludur, çalışır ve **değiştirilmez.**

| Katman | Teknoloji | Sürüm | Neden korunuyor |
|---|---|---|---|
| Dil | TypeScript (strict) | 5.9.3 | `tsc -b --noEmit` build kapısında; tip güvenliği regresyonun ilk savunma hattı |
| Derleme | Vite | 8.2.1 | Kurulu ve çalışıyor; kaynak belgedeki "Vite 7" bilgisi eskidir |
| Render | React | 19.2.8 | Kullanıcının açık talebi ve kurulu sürüm |
| Routing | React Router | 7.18.2 | Kullanıcının "React Router 19" ifadesinin doğru uygulanan karşılığı |
| Sunucu durumu | TanStack Query | 5.101.4 | Kullanıcının açık talebi; cache, invalidation ve yeniden deneme tek yerde |
| Tablo | TanStack Table | 8.21.3 | Kullanıcının açık talebi; master DataGrid'in motoru |
| Form | React Hook Form | 7.85.0 | Kullanıcının açık talebi; `@hookform/resolvers` ile Zod'a bağlı |
| Doğrulama | Zod | 4.4.3 | Her API yanıtı `.strict()` doğrulanır; backend `extra="forbid"` ile simetrik |
| İstemci durumu | Zustand | 5.0.15 | Yalnız UI tercihi (yoğunluk, tema, yazı ölçeği, hareket azaltma) tutar |
| Bileşen davranışı | Radix primitives | dialog/popover/select/tabs/tooltip | Erişilebilir davranış; görünüm bize ait |
| Stil motoru | **Tailwind CSS v4** + `@tailwindcss/vite` | 4.3.3 | Bağlayıcı. PostCSS zinciri yok, SCSS yok. `src/design/tailwind.css` |
| Tasarım tokenları | Bespoke CSS token + cascade layer | — | Korunur ve **kaynak otoritesidir**. Tailwind teması `@theme inline` ile bunlara bağlanır; sınırlar (12px radius, 1rem, Roboto 400+) burada zorlanır |
| Master bileşen sistemi | **shadcn/ui kod sözleşmesi** | `components.json` (Tailwind v4 şekli) | Bağlayıcı. `data-slot`, `cva`, `cn` = clsx + tailwind-merge. `src/components/ui/` |
| Türetilmiş bileşenler | Ürünün 75 bileşeni | — | `Button`, `Badge`, `Card`, `Tabs` master katmandan türetilir; genel API değişmez, böylece adaptasyon tüm rotalarda aynı anda görünür |
| İkon | **Phosphor** (`@phosphor-icons/react`) | 2.1.10 | Bağlayıcı. Lucide yasak (shadcn varsayılanı). Tek adaptör: `src/components/icons.tsx` |
| Yoğun analitik grafiği | **ECharts** | 6.1.0 | Bağlayıcı. `echarts/core` + yalnız kullanılan chart/component/renderer; `React.lazy` ile ayrı chunk; **asla ana pakette değil** |
| Yazı tipi | `@fontsource-variable/roboto` | 5.3.0 | Yerel; harici CDN isteği yok |
| Birim test | Vitest + Testing Library | 4.1.10 / 16.3.2 | Son kaydedilen tam suite: **941**; bu belge paketinde yeniden koşulmadı |
| Tarayıcı test | Playwright | 1.62.1 | Son kaydedilen koşu: **57**; bu belge paketinde yeniden koşulmadı. Request routing kullanır, sayfaya worker kurmaz |
| Mock | MSW | 2.15.0 | **Yalnız Vitest'in Node interceptor'ı için.** Tarayıcı worker'ı yoktur ve `no-mock-artifacts.test.ts` bunu kilitler |
| Erişilebilirlik | axe-core + `@axe-core/playwright` + `eslint-plugin-jsx-a11y` | 4.13.0 / 4.11.2 / 6.10.2 | critical/serious = 0 kapısı |
| Katalog | Storybook | 10.5.8 | **Zorunlu** bileşen kataloğu ve test yüzeyi; sözleşmesi Bölüm 4'tedir |
| Lint | ESLint + typescript-eslint | 9.39.5 / 8.67.0 | Kurulu ve çalışıyor |
| Paket yöneticisi | pnpm (corepack) | 11.21.0 | `packageManager` alanında sabit |
| Node | ≥ 22 | — | `engines` alanında sabit |

---

## 7. Eklenecek — her biri bir ürün ihtiyacına bağlı

Bunlar bugün yoktur ve yol haritasındaki ilgili milestone'da eklenir. Hiçbiri "iyi olur"
diye eklenmez; her satırın karşısında onu zorunlu kılan ürün ihtiyacı vardır.

> **Tek istisna, satır 2.** URL durumu grid seviyesinde **bugün çalışır durumdadır** ve
> testlidir. O satır bir yokluğu değil, mevcut dar kapsamın uygulama geneline
> genişletilmesini tarif eder. Kapsam farkı satırın içinde açıkça yazılıdır.

| # | Yetenek | Teknoloji kararı | Zorunlu kılan ürün ihtiyacı |
|---|---|---|---|
| 1 | Üretilmiş OpenAPI istemcisi | `@hey-api/openapi-ts` (backend spec'inden) | Sözleşme kayarsa build kırılmalı; elle yazılan tip her zaman bayatlar |
| 2 | URL durumu — **uygulama geneli** | Zod ile parse edilen search params (kendi ince katmanımız). **Grid seviyesinde bugün vardır** (`url-state.ts`); eksik olan, aynı disiplinin tüm rotalara yayılması ve şemanın Zod ile doğrulanması | Yalnız grid değil, her filtrelenebilir yüzey paylaşılabilir bir adres üretmeli |
| 3 | Çok dillilik | `i18next` + tarayıcının `Intl` API'si | Türkiye-first, international-ready; country packs |
| 4 | Tarih ve saat | UTC taşıma + `Intl.DateTimeFormat` görüntüleme; ağır ihtiyaçta `date-fns` | Başvuru pencereleri ve son tarihler yanlış saat diliminde parasal hata üretir |
| 5 | Para | String olarak taşı + `Intl.NumberFormat` ile göster; **asla `number`** | Kayan nokta hatası bir teşvik tutarında kabul edilemez |
| 6 | Gerçek zamanlı akış | **SSE** (tek yön) varsayılan; çift yön gerekirse WebSocket ayrı karar | Bildirim ve içgörü akışı proaktifliğin taşıyıcısı |
| 7 | Dirençli dosya yükleme | Parçalı/sürdürülebilir yükleme (tus profili); yerel depolama portu üzerinden | Belge kütüphanesi ürünün ikinci yarısı; yarım yükleme kabul edilemez |
| 8 | Grafik | Hafif ihtiyaçta kendi SVG primitifimiz; yoğun analitikte **ECharts** yalnız lazy chunk | Gömülü grafik ve analitik panosu. **ECharts asla ana pakete girmez** |
| 9 | Zengin metin | TipTap + DOMPurify (sanitizasyon sunucuda tekrar) | Danışman notu, başvuru taslağı |
| 10 | Sürükle-bırak | dnd-kit | Kanban görünümü ve klasör ağacı; klavye desteği zorunlu |
| 11 | Bildirim (toast) | Kendi bileşenimiz (tasarım sistemine bağlı) | Bildirim merkezi; harici kütüphane tasarım sınırlarını bozar |
| 12 | Hareket (motion) | Motion, `prefers-reduced-motion` mutlak saygıyla | Conversion ve anlam taşıyan geçişler |
| 13 | Görsel regresyon | Playwright ekran görüntüsü + eşik | Bespoke tasarımın sessizce bozulmasını yakalar |
| 14 | Bundle bütçesi | `size-limit` CI kapısı | Paket boyutu regresyonu PR'da yakalanmalı |
| 15 | Ortam değişkeni doğrulama | Zod ile parse; eksik env **build'de** patlar | Eksik yapılandırma production'da değil, build'de görülmeli |
| 16 | CSP ve CSRF | CSP başlığı sözleşmesi + mevcut `X-CSRF-Token` disiplini | Güvenlik; XSS ve cross-site istek |
| 17 | Bağımlılık taraması | GitHub Actions'ta denetim adımı | Tedarik zinciri riski |

---

## 8. Koşullu — değerlendirme sonrası

Bunlar **yasak değildir**, ama bugün karar verilmez. Her biri kendi ölçüm kapısını geçmek
zorundadır.

> **v3 notu.** Bu bölümün 1., 2., 3. ve 13. satırları **Tailwind v4**, **shadcn/ui** ve
> **SCSS**'i "koşullu aday" sayıyordu. İlk ikisi bağlayıcı karardır ve kuruludur — yerleri
> Bölüm 6'dır. SCSS ise koşullu değil **reddedilmiştir** (Bölüm 9): Tailwind zaten ön
> işlemcidir ve ikisi aynı pakette karıştırılmaz. Dört satır da bu yüzden kaldırıldı.

| # | Aday | Koşul | Ölçüm |
|---|---|---|---|
| 4 | **React Router v8** | **Otomatik upgrade yoktur.** Ayrı, kanıtlı bir migration milestone'u olabilir | Tüm rota testleri GREEN + rollback yolu denenmiş |
| 5 | **Base UI** | Kaynak belgenin "bileşen davranışı" satırı Base UI der; bu proje Radix kullanır. Sapma **açık ve gerekçelidir**, sessiz değil — Bölüm 9.1 | Radix'in bugün karşıladığı davranışları Base UI'ın da karşıladığının kanıtı + tüm sheet/select/tabs/tooltip testlerinin GREEN kalması |
| 5 | **WebSocket** | SSE yetmediği ölçülürse | Çift yönlü iletişim gerektiren somut bir yüzey |
| 6 | **Telemetri (OpenTelemetry)** | Gerçek trafik başlayınca | Frontend trace'inin FastAPI trace'iyle ilişkilendirilebilmesi |
| 7 | **Analitik (PostHog / Plausible, self-host)** | KVKK değerlendirmesinden sonra | Veri işleyen sıfatı ve saklama süresi kararı — **owner** |
| 8 | **Feature flag (Unleash / OpenFeature)** | İkinci eşzamanlı sürüm hattı çıkınca | Deploy ile yayın kararını ayırma ihtiyacı ölçülünce |
| 9 | **Sentry (self-host)** | Production trafiği başlayınca | Hata izleme hattı kurulmadan source map açılmaz |
| 10 | **Biome (ESLint+Prettier yerine)** | Lint süresi ölçülebilir biçimde sorun olursa | Mevcut ESLint kurulumu bugün sorun üretmiyor |
| 11 | **XState** | Dallanan, çok adımlı akış karmaşıklaşırsa | Sihirbaz ve başvuru hattının durum grafiği ölçülünce |
| 12 | **Monorepo (Turborepo)** | İkinci gerçek tüketici ürün çıkarsa | Bugün tek ürün var |

---

## 9. Reddedilen

| # | Reddedilen | Gerekçe |
|---|---|---|
| 1 | **Next.js** | Kanonik yasak. Aday, geçiş hedefi veya opsiyon olarak dahi anılmaz |
| 2 | **MetaFramer** | Kanonik yasak, aynı kapsam |
| 3 | **Tasarım *tokenlarının* topluca atılması** | Kontrast, köşe ve tipografi sınırları orada ölçülür; ikinci bir palet bu kapıların birinden sessizce kaçar. Tailwind bu tokenları işaret eder, kopyalamaz |
| 4 | **Tailwind + SCSS'in aynı pakette karıştırılması** | İkisi de CSS'i genişleten ön işlemcilerdir; birlikte kullanıldığında `@apply` ve tema değişkenleri öngörülemez biçimde bozulur |
| 5 | **SSR / server-rendering katmanı** | Ölçülmüş bir SEO veya ilk boya ihtiyacı yok; dağıtıma Node katmanı eklemek operasyon yükü üretir |
| 6 | **Mikro-frontend** | Tek ürün, tek ekip. Modular monolith yeterli |
| 7 | **Alpha/beta paketlerin production'a alınması** | Kırılma riski ürünün taşıyabileceğinden büyük |
| 8 | **Tarayıcı deposunda gizli değer (token, API anahtarı)** | Güvenlik ihlali; `truth-guard.test.ts` bunu koda karşı yasaklar |
| 9 | **Public source map** | Gerekçesiz kaynak ifşası ve dört katı dağıtım boyutu. Hata izleme hattı gelirse doğru ayar `"hidden"`'dır |
| 10 | **Tarayıcıda çalışan kural motoru** | Uygunluk kararı sunucunundur; `architecture.test.ts` bunu zorlar |
| 11 | **Uydurma backend ucu** | Var olmayan uca istek atan ekran yazılmaz |
| 12 | **ECharts'ın ana pakete girmesi** | Kök prototipteki 1.59 MB gömülü ECharts kusuru tekrar edilmez. `build-contract.test.ts` bunu emit edilen parçalara karşı ölçer |
| 13 | **Bu pakette SCSS** | Tailwind v4 zaten ön işlemcidir. Sass önce, Tailwind sonra çalışır; `theme()` çıktısı Sass fonksiyonlarına ulaşmaz ve iç içe seçiciler `@apply`'ı bozar. Legacy yüzeyler (Django/Frappe şablonu, e-posta, print) ayrı pakettir |
| 14 | **Lucide ikonları** | shadcn/ui varsayılanıdır; bu ürünün ikon seti Phosphor'dur. Kurulumdan sonra ikon katmanı değiştirilmiştir ve tek adaptörden geçer |

### 9.1 Base UI yerine Radix — açık sapma

Kaynak belge (`~/Desktop/frontend-tecstack.md`) "Bileşen davranışı → Base UI" der. Bu proje
**Radix** kullanır. Bu bir ihmal değil, kayıtlı bir sapmadır; gerekçesi üç maddedir ve
üçü de repo kanıtına dayanır:

1. **shadcn/ui'ın bu projedeki hâli Radix üzerine kuruludur.** Bağlayıcı karar
   "Tailwind v4 + shadcn/ui"dir; `components.json` ile gelen bileşenlerin davranış
   katmanı Radix'tir. Base UI'a geçmek, kaynak belgenin *daha güçlü* olan diğer
   kararını (shadcn/ui kod sözleşmesi) elle yeniden yazmak demektir.
2. **Radix zaten kurulu, testli ve davranışı kanıtlanmış.** `dialog`, `popover`,
   `select`, `tabs`, `tooltip` bu repoda kuruludur; sheet'in odak tuzağı, Escape ile
   kapanması ve **kapanınca odağı tetikleyiciye döndürmesi** `adaptive-sheets.test.tsx`
   ve tarayıcı süitiyle korunur. Bu davranışların en sık atlananı sonuncusudur ve
   testle kilitlidir.
3. **Cross-platform select ve klavye/ekran okuyucu davranışı bugünkü sözleşmedir.**
   `select.tsx` iOS/macOS/Windows/Linux/Android'de tutarlı, kontrollü bir görünüm ve
   `Bilinmiyor` üçlü durumunu gerçek bir seçenek olarak taşır — native `<select>`'in
   yapamadığı şey budur. Bunu Base UI'a taşımak, kanıtlanmış bir yüzeyi kanıtlanmamış
   bir yüzeyle değiştirmek olur.

**Yasak değildir.** Base UI, Bölüm 8 satır 5'te koşullu adaydır ve kendi ölçüm kapısı
yazılıdır. Bugün karar Radix'tir ve gerekçesi burada durur.

---

## 10. Depolama — yerel varsayılan, S3 opsiyonel

### 10.1 Port ve adaptör

Frontend **depolama portu** üzerinden konuşur; hangi adaptörün arkada olduğunu bilmez.

```
UI  →  StoragePort  →  { LocalAdapter (varsayılan)  |  S3Adapter (opsiyonel) }
```

| Kural | Açıklama |
|---|---|
| Varsayılan adaptör | **Yerel depolama.** Kurulum hiçbir bulut hesabı gerektirmez |
| S3 | **Kesinlikle opsiyonel.** Yapılandırılmamışsa ürün tam çalışır |
| Adaptör seçimi | Sunucu tarafındadır; frontend yalnız `backend: "local" \| "s3"` bilgisini görüntüler |
| Ölçülmemiş değer | `null` olarak taşınır ve em-dash olarak görünür. **Asla `0` yazılmaz** — sıfır bir ölçümdür |
| Taşıma katmanı yoksa | Yükleyici **devre dışı** görünür ve gerekçesini yazar. Sessizce dosya kabul edip atmak, bir belge ürününün yapabileceği en yıkıcı hatadır |

### 10.2 Sahibin diliyle

Bir HRMS'e özlük dosyası yüklüyorsunuz. Yükleme çubuğu doluyor, "kaydedildi" yazıyor.
Altı ay sonra denetimde dosya yok — çünkü arkada bir depolama yoktu.

Bugünkü ürün bu hatayı **yapmıyor**: taşıma katmanı olmadığı için yükleyici kapalı ve
nedeni ekranda yazılı. Yapılacak iş, kapalı olanı açmaktır; açık görünüp çalışmayan bir
şey yapmak değil.

---

## 11. Sağlayıcı bağlantı mimarisi

### 11.1 Kapsam

Desteklenecek sağlayıcılar: **Gemini, OpenClaw, Claude, ChatGPT/OpenAI** — her biri için
hem hesap tabanlı hem API tabanlı bağlantı.

### 11.2 Değişmez güvenlik kuralları

| # | Kural | Neden |
|---|---|---|
| 1 | **Gizli değer asla tarayıcı deposuna yazılmaz** | `localStorage`/`sessionStorage`/IndexedDB'deki bir API anahtarı, tek bir XSS ile çalınır |
| 2 | **Gizli değer asla frontend state'inde kalıcı tutulmaz** | Form alanından çıkışta bellekten düşer |
| 3 | **Kimlik bilgisi sunucudaki broker'da yaşar** | Frontend yalnız bağlantının *durumunu* görür, *değerini* değil |
| 4 | **OAuth akışı sunucu üzerinden yürür** | Yönlendirme ve jeton takası tarayıcıda yapılmaz |
| 5 | **Sağlık yoklaması (health) sunucudan gelir** | Frontend sağlayıcıya doğrudan istek atmaz |
| 6 | **Yönlendirme (routing) sunucu kararıdır** | Hangi sağlayıcıya gideceği iş kuralıdır, UI tercihi değil |
| 7 | **Her bağlantı işlemi denetime yazılır** | Kim, ne zaman, hangi sağlayıcıyı bağladı/kaldırdı |
| 8 | **Broker yoksa arayüz devre dışıdır** | Bugünkü durum tam olarak budur ve doğrudur |

### 11.3 Bugünkü durum

`platform/frontend/src/routes/providers.tsx` bu kuralların hepsine uyar: `port` verilmez,
her izin `false`'tur, hiçbir gizli alan erişilebilir değildir ve bağlantı listesi gerçekten
boştur. Eksik olan **sunucu tarafı broker**'dır.

---

## 12. Tarayıcı ve cihaz merdiveni

### 12.1 Genişlik merdiveni

| Genişlik | Rol |
|---|---|
| **320px** | **Kaynak düzen.** Her ekran burada tasarlanır ve burada kabul edilir |
| 360px | Yaygın Android |
| 375px | iPhone SE / mini |
| 390px | iPhone standart |
| 412 / 430px | Büyük Android / iPhone Pro Max |
| 480px | Küçük tablet dikey / büyük telefon yatay |
| 768px | Tablet |
| 1024px | Küçük dizüstü — sol panel kalıcılaşır |
| 1280px | Standart masaüstü — sağ panel açılır |
| 1440px+ | Geniş masaüstü — üç panelli tezgâh |

**Kural:** 320'den yukarı doğru progressive enhancement. Masaüstü gereklidir ama
**mobil kapanmadan** masaüstüne geçilmez.

### 12.2 Tarayıcı matrisi

| Tarayıcı | Durum | Hedef |
|---|---|---|
| Chromium (masaüstü) | ✅ Test ediliyor | Korunur |
| Chromium tabanlı mobil emülasyon | ✅ Test ediliyor | Korunur |
| WebKit / Safari | ❌ **UNVERIFIED** | `V2-P1-71`'de kapatılır |
| Firefox | ❌ **UNVERIFIED** | `V2-P1-71`'de kapatılır |
| Gerçek iOS Safari cihazı | ❌ **UNVERIFIED** | `V2-P1-71`'de kapatılır |

---

## 13. Performans bütçeleri

| Ölçüt | Bütçe | Bugünkü durum |
|---|---|---|
| İlk yüklenen JS (gzip) | ≤ 180 kB | **131.500 bayt ölçüldü** (2026-08-16, final artefakt; `dist/index.html`'in doğrudan referans verdiği tüm JS, `gzipSync`; ham 424.968). Artık tahmin değil kapı: `build-contract.test.ts` her derlemede ölçer |
| Route başına lazy chunk | Zorunlu | ✅ Her rota `lazy` |
| Ana pakette grafik kütüphanesi | **Yasak** | ✅ Yok — ECharts + zrender **526.495 ham / 175.842 gzip**, tamamı tembel; `build-contract.test.ts` eager grafikte olmadığını **ve** bir tembel parçada olduğunu ölçer |
| Tembel JS toplamı | Sınırsız (isteğe bağlı indirilir) | 973.150 ham / 312.401 gzip |
| İlk yüklenen CSS (gzip) | Bütçe yok, kayıt var | 61.454 ham / 11.191 gzip |
| Source map (production) | **Yok** | ✅ `sourcemap: false`, testle kilitli |
| Mock artefaktı (production) | **Yok** | ✅ `no-mock-artifacts.test.ts` kilitliyor |
| Harici origin isteği | **0** | ✅ Testle korunuyor |
| LCP / INP / CLS | Ölçülecek | ❌ **UNVERIFIED** — hiç ölçülmedi |

**Kural:** Bütçe aşıldığında bütçe yükseltilmez; kod küçültülür. Bu, mevcut paketin
kapsam eşiklerinde uyguladığı disiplinin aynısıdır (eşik düşürülmedi, test eklendi).

---

## 14. Erişilebilirlik kapıları

| Kapı | Eşik | Zorlayan |
|---|---|---|
| axe critical / serious | **0** | Playwright + `@axe-core/playwright` |
| Klavye ile tam kullanım | Zorunlu | E2E test |
| Başlık hiyerarşisi | Tek `h1`, seviye atlanmaz | Birim test |
| Kaydırılabilir kabın odaklanabilirliği | Zorunlu | axe (`scrollable-region-focusable`) |
| Renk kontrastı | WCAG 2.2 AA | axe + tasarım token'ları |
| Minimum metin boyutu | 1rem | Tasarım sözleşmesi testi |
| `prefers-reduced-motion` | Mutlak saygı | Motion katmanı testi |
| Ekran okuyucu manuel turu | Faz kapısı | ❌ **UNVERIFIED** — `V2-P1-70`'te kapatılır |

---

## 15. Test piramidi ve RED→GREEN

### 15.1 Piramit

| Seviye | Araç | Neyi kanıtlar | Bugünkü sayı |
|---|---|---|---|
| Birim / bileşen | Vitest + Testing Library | Bileşen kendi sözleşmesine uyar | 941 (son kayıt) |
| Muhafız (guard) | Vitest | Ürün kendi hakkında yalan söylemiyor | Yukarıdakine dahil |
| Mimari | Vitest + AST | Katman sınırları delinmemiş | Yukarıdakine dahil |
| Sözleşme | Zod `.strict()` + build kapısı | Backend sözleşmesi kaymamış | Build'de |
| Tarayıcı (e2e) | Playwright | Gerçek tarayıcıda yolculuk yürüyor | 57 (son kayıt) |
| Gerçek backend E2E | Playwright, mock routing kapalı | Ürün gerçek backend ile çalışıyor | ❌ **UNVERIFIED** — `V2-P6-01`'de kapatılır |

> **Sayıların okunma kuralı.** **941** ve **57**, en son kaydedilen tam koşuların
> sonuçlarıdır; **bu belge paketinde suite yeniden koşulmamıştır** ve bu belge canlı bir
> doğrulama iddiası kurmaz. Ayrıca bu iki sayı **koşum sonucudur, dosyadaki test
> bildirimi sayısı değildir**: bu paketin ölçümünde e2e ağacında 7 spec dosyasında
> **52 statik `test(` bildirimi** vardır ve bunlar iki Playwright projesinde (chromium,
> mobile) koşar. Bildirim sayısı ile koşum sayısı aynı şey değildir ve birbirinin yerine
> yazılamaz.

### 15.2 RED→GREEN komutları

```bash
cd platform/frontend

# RED: kabul testini önce yaz, kırmızı olduğunu kanıtla
pnpm vitest run <yeni-test-dosyasi>          # exit code 1 beklenir

# GREEN: uygulama, sonra tam kapı
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm build
pnpm storybook:build
pnpm e2e
```

### 15.3 RED'in geçerlilik kuralı

Bir RED yalnızca **davranışsal** ise kanıttır. Modül çözümleme hatası (import edilemeyen
dosya) RED sayılmaz — bu, testin değil kurulumun hatasıdır. Hedef modül kasıtlı olarak
yanlış bir stub ile eklenir ve test **yanlış davranışı** yakalar.

### 15.4 Sözleşme stratejisi

1. Backend `pydantic` şeması → OpenAPI spec.
2. Spec → üretilmiş TypeScript istemcisi (`@hey-api/openapi-ts`).
3. Üretilmiş tip ile repodaki Zod şeması CI'da karşılaştırılır.
4. **Spec değişti ve istemci güncellenmediyse build kırılır.**

Bu zincir, "backend değişti, frontend fark etmedi" hatasını yapısal olarak imkânsız kılar.

---

## 16. Hetzner ve GitHub Actions taşınabilirliği

| Konu | Karar |
|---|---|
| Donanım hedefi | Hetzner AMD EPYC **veya** Intel x86_64 — ikisi de `linux/amd64` |
| ISA baseline | **Genel `linux/amd64`.** `x86-64-v2` daraltması reddedilmiştir; kanıt üretmez, yanlış güvence verir |
| Derleme bayrağı | `-march=native` ve AVX-512 zorunluluğu **kullanılmaz** |
| Frontend çıktısı | Statik varlık (HTML + CSS + JS). ISA'ya duyarsızdır |
| CI | GitHub Actions; `ubuntu-latest` x86_64 runner |
| CI'nın iddiası | "Bir x86_64 hostta build ve test geçti." **Dual-vendor kanıtı değildir** |
| Dual-host smoke | Ayrı bir **environment gate**; owner host sağlayana kadar UNVERIFIED |
| Node sürümü | `engines: node >= 22`; CI ve yerel aynı sürümü kullanır |
| Paket yöneticisi | pnpm, corepack ile sabitlenmiş (`packageManager: pnpm@11.21.0`) |
| Kurulum | `pnpm install --frozen-lockfile` — lockfile kayması build'i düşürür |

---

## 17. Karar kayıtları ve değişiklik kuralları

### 17.1 Bir teknolojiyi eklemek için gereken beş şey

1. Onu zorunlu kılan **somut ürün ihtiyacı** (bir kullanıcı yolculuğu cümlesi).
2. Reddedilen **en az bir alternatif** ve reddetme gerekçesi.
3. **Ölçülebilir kabul kriteri** (bundle etkisi, test sayısı, performans).
4. **Rollback yolu** — nasıl geri alınır.
5. Bu belgeye eklenen **bir satır**.

Beşi de yoksa teknoloji eklenmez.

### 17.2 Migration kuralları

| Kural | Açıklama |
|---|---|
| Büyük sürüm yükseltmesi otomatik değildir | React Router 7 → 8 dahil. Kendi milestone'u, kendi RED'i, kendi rollback'i olur |
| Topluca yeniden yazma yasaktır | Tasarım katmanı, tablo katmanı ve form katmanı kademeli değişir |
| Bir migration paketinde başka iş yapılmaz | Migration + özellik aynı pakette olursa hata kaynağı ayrıştırılamaz |
| Rollback yolu paket **başlamadan** bilinir | Bilinmiyorsa paket başlamaz |

### 17.3 Rollback

Frontend paketlerinin rollback'i, o paketin dosyalarının geri alınmasıdır. Backend,
prototip ve diğer paketler etkilenmez. Rollback kararı ve yürütmesi **Codex Desktop
MASTER**'ındır.

---

## 18. Owner özeti — sade Türkçe

**once:** Frontend'in hangi teknolojiyle, neden yürüdüğü hiçbir yerde tek bir belgede
yazılı değildi. Masaüstünde duran genel bir tavsiye belgesi vardı ama o belge başka
ürünler için yazılmıştı ve repodaki gerçekle üç noktada çelişiyordu. Bileşenlerin
birbirinden nasıl türeyeceği ve Storybook'un ne kadar zorunlu olduğu da yazılı değildi.

**simdi:** Tek bir karar belgesi var. Neyin kurulu olduğu (sürüm sürüm), neyin ekleneceği
(her biri bir ürün ihtiyacına bağlı), neyin koşullu olduğu (hangi ölçümü geçmesi gerektiği
yazılı) ve neyin reddedildiği (gerekçesiyle) ayrı ayrı listelendi. Buna üç yeni bölüm
eklendi: **bileşen soyağacı** (beş kademe, türeme kuralı, no-duplicate), **Storybook zorunlu
katalog sözleşmesi** (yedi boyut, bileşen başına giriş) ve **port/adaptör stratejisi**
(backend yokken neyin kanıtlandığı, neyin kanıtlanmadığı).

**fark:** Artık bir sonraki paket "hangi kütüphaneyi kullanalım" tartışmasıyla başlamaz ve
"bu buton nereden geliyor" sorusunun cevabı var. Karar verilmiş; verilmemiş olanların hangi
ölçümle verileceği de yazılmış. En önemlisi: çalışan bespoke tasarım sistemi topluca
yeniden yazılmayacak ve React Router v8'e otomatik geçilmeyecek — ikisi de aylarca kayıp
anlamına gelirdi.

**kullaniciYolculugu:** Bu belge kullanıcının doğrudan gördüğü bir şey değildir; ama
kullanıcının göreceği her şeyin sınırını çizer. Örneğin bir KOBİ yetkilisi telefonundan
başvuru belgesi yüklediğinde: dosya yerel depolamaya gider (S3 hesabı açmasına gerek yok),
yükleme yarıda kesilirse kaldığı yerden devam eder, API anahtarı hiçbir zaman tarayıcısında
saklanmaz ve ekranın hiçbir yerinde 1rem'den küçük metin görmez. Backend henüz yokken aynı
kullanıcı yükleyiciyi **kapalı ve gerekçesi yazılı** görür — sessizce dosya kabul edip atan
bir ekran görmez. Bu beş davranışın hepsi bu belgedeki birer karardır.

**kalanEngel:** Eklenecek 17 yeteneğin tamamı henüz yoktur. Koşullu kalemlerin hiçbirine
karar verilmemiştir ve verilmesi için ölçüm gerekir. Bileşen soyağacı kütükte yazılı
değildir ve no-duplicate kuralı zorlanmamaktadır; Storybook kataloğu bugün **0/75** bileşen
düzeyinde giriş taşır. WebKit ve Firefox doğrulaması, LCP/INP/CLS ölçümü, gerçek backend
E2E ve dual-host smoke **UNVERIFIED** durumdadır. Analitik ve telemetri kararları KVKK
değerlendirmesine bağlıdır ve **owner** kararıdır.

**capability_delta:** `0`. Bu belge tek bir satır ürün kodu değiştirmedi. Yaptığı şey, bir
sonraki paketin yanlış teknolojiyle ve yanlış bileşen disipliniyle başlamasını engellemek.

---

## 19. Skeleton shimmer first — bağlayıcı geliştirme kuralı

Sahibin kalıcı kuralıdır ve yalnız bu paket için değildir. Bir bileşen geliştirilirken
**önce o bileşenin kendi yükleme durumu** kurulur, testiyle birlikte; sonra
loaded / empty / error / permission / offline durumları ve asıl bileşen gelir.

### 19.0 Nerede GREEN, nerede değil — kapsam ayrımı

Bu ayrım belgenin en önemli satırıdır; karıştırılırsa kural yapılmış sayılır ve iş durur.

| Katman | Durum | Kanıt |
|---|---|---|
| **Master bileşen katmanı** (`src/components/ui/*`) | ✅ **GREEN** | Her export ya `skeleton-map.ts`'te şekil + adlandırılmış story ile eşlenmiş ya da `kind` + gerekçeli muafiyet taşıyor; `skeleton-contract.test.tsx` barrel'dan enumerate eder, şekli **render edip** shimmer sayar, story modülünü **import edip** export'un varlığını doğrular |
| **Analitik bölümü** (`src/components/analytics/*`) | ✅ **GREEN** | Bölüm-seviyesi `AnalyticsSkeleton` (kart + sekme şeridi) ve panel-seviyesi `AnalyticsPanelSkeleton` (sarmalayıcısız) ayrı; iç içe kart/tablist DOM kontratıyla yasaklı |
| **Uygulama kabuğu ilk boyası** (`routes/boot-surface.tsx`) | ✅ **GREEN** | Master `Skeleton` + `SkeletonText` kullanır, barrel'a dokunmaz |
| **Ürünün geri kalanı** | ❌ **KALAN KAPSAM** | Aşağıdaki modüller hâlâ jenerik `SkeletonBlock` çiziyor |

**Jenerik `SkeletonBlock` hâlâ şu modüllerde kullanılıyor** — hiçbiri bu kuralı karşılamaz,
çünkü `SkeletonBlock` sabit sayıda satır çizer ve arkasındaki bileşenin yerleşimiyle
hiçbir ilişkisi yoktur:

- `src/components/data-grid/DataGrid.tsx`
- `src/components/templates.tsx`
- `src/routes/QueryBoundary.tsx`
- `src/routes/app.tsx`

Bu liste `skeleton-contract.test.tsx` tarafından ağaçla karşılaştırılır: bir modül
geçirildiğinde test kırmızıya döner ve bu listenin güncellenmesini ister. Kural
**ürün genelinde yapılmadı**; yalnız master katman ve analitik bölümü GREEN'dir.

| # | Kural | Nasıl zorlanır |
|---|---|---|
| 1 | Skeleton **RED testi** bileşenden önce yazılır | `src/test/skeleton-contract.test.tsx` |
| 2 | Skeleton, o bileşenin **gerçek yerleşimini** taklit eder — şekil, satır sayısı, medya kutusu, tablo/chart/form yoğunluğu. **Tek bir jenerik dikdörtgen yeterli değildir** | Aynı dosya: tablo iskeletinde satır ve sütun, grafik iskeletinde eksen ve farklı uzunlukta çubuk, form iskeletinde etiket-alan çifti sayılır |
| 3 | Skeleton **içerik gibi okunmaz**; container yükleme durumunu açıklar | Her şekil `aria-hidden`; container `role="status"` + `aria-busy` + ne yüklendiğini söyleyen tek cümle |
| 4 | `prefers-reduced-motion` altında **shimmer durur** | İki taşıyıcı birden: `motion-reduce:` ve ürünün kendi `data-reduced-motion` ayarı |
| 5 | **320px ve desktop** davranışı test edilir | Storybook'ta her şekil için 320px hikâyesi; tarayıcı ölçümü e2e'de |
| 6 | Her master bileşenin skeleton'ı **Storybook'ta kataloglanır** | `src/components/ui/ui.stories.tsx` — katalogun ilk grubu |

Gerekçe: yerleşimi tutmayan bir iskelet, veri geldiği anda sayfayı zıplatır ve okuyucunun
baktığı satırı kaydırır; ekran okuyucuya da hiçbir şey söylemez. Şekli tutan bir iskelet
aynı sayfanın boş hâlidir — veri indiğinde hiçbir şey yer değiştirmez.

Şekiller: `SkeletonText`, `SkeletonCard`, `SkeletonTable`, `SkeletonChart` (çubuk ve halka),
`SkeletonForm`, `SkeletonMedia`, `SkeletonList`, `SkeletonControl` (44px dokunma hedefi + 8px
köşe), `SkeletonTabStrip` (kenarlıklı, sönük şerit) — hepsi `src/components/ui/skeleton.tsx`.

Haritadaki `imitates` cümlesi ile **fiilen çizilen şekil** aynı şeyi söylemek zorundadır.
`Button` ve `Tabs` bir süre `Shimmer` ve `SkeletonText`'e eşlenmişken metinleri dokunma
yüksekliğinde bir kontrolü ve kenarlıklı bir sekme şeridini tarif ediyordu; metin story'yi
anlatıyordu, eşlenen şekil ise düz bir çubuk çiziyordu. `SkeletonControl` ve
`SkeletonTabStrip` bu yüzden vardır.
