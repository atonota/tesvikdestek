# DestekTeşvik — Frontend Teknoloji Yığını Karar Belgesi

**Tarih:** 2026-08-15
**Kapsam:** `platform/frontend/` — DestekTeşvik'in React tabanlı frontend uygulaması.
**Belge sınıfı:** Karar belgesi. Yürürlüktedir; değişikliği yalnız yeni bir karar kaydı (ADR) yapar.
**Girdi:** `~/Desktop/frontend-tecstack.md` (dış teknik girdi, talimat değil) + repo gerçeği.
**capability_delta:** `0` — bu belge kod değiştirmez; hangi teknolojinin neden seçildiğini kaydeder.

> **Kaynak belgeye dair uyarı.** `frontend-tecstack.md` genel bir portföy tavsiyesidir
> (Segika, e-menum, istoc, arsam gibi başka ürünler için yazılmış) ve **bu projenin
> gerçeğiyle üç noktada çelişir**: React Router v8'i mevcut karar sayar, Tailwind v4 +
> shadcn/ui'yi varsayılan yol olarak önerir ve Vite 7'yi baseline kabul eder. Repoda
> React Router **7.18.2**, Vite **8.2.1** kuruludur ve tasarım katmanı **bespoke CSS
> token + cascade layer** sistemidir. Bu belge kaynak belgeyi **girdi** olarak kullanır,
> **talimat** olarak kabul etmez.

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
3. **Tasarım katmanı topluca yeniden yazılmaz.** Mevcut bespoke, pixel-perfect CSS token
   sistemi korunur. Tailwind zorunlu değildir, shadcn/ui zorunlu değildir ve SCSS ancak
   ölçülmüş bir fayda varsa gelir.
4. **Backend bu pakette geliştirilmez ama sözleşme bağlayıcıdır.** Frontend, FastAPI'nin
   ürettiği OpenAPI sözleşmesine uyar; uydurma uç kullanmaz, SSR HTML ayrıştırmaz.

**Sahibin diliyle:** Bir CRM'iniz var. Motoru sağlam, direksiyonu çalışıyor, frenleri
test edilmiş. Ama koltuk yok, cam yok, kontak paneli yok. Doğru karar motoru değiştirmek
değil; koltukları takmaktır.

---

## 2. Kanonik sınırlar — pazarlık edilmez

| # | Sınır | Kapsam |
|---|---|---|
| 1 | **Next.js yoktur** | Aday değil, geçiş hedefi değil, opsiyon değil. Hiçbir belgede, hiçbir karşılaştırmada önerilmez. |
| 2 | **MetaFramer yoktur** | Aynı kapsam. |
| 3 | **Backend bu pakette geliştirilmez** | Ama frontend **FastAPI / OpenAPI-compatible** olmak zorundadır. |
| 4 | **Modular monolith** | Mikroservis değil, mikro-frontend değil. Tek uygulama, iyi ayrılmış modüller. |
| 5 | **Mobile-first, gerçek native 320px** | Kaynak düzen 320'de kurulur. "Responsive yaptık" bu sınırı karşılamaz. |
| 6 | **Minimum görünür metin 1rem** | 1rem altı görünür metin ihlaldir. |
| 7 | **Roboto, ağırlık 400+** | 300 ve altı ağırlık kullanılmaz. |
| 8 | **Köşe yuvarlaklığı ≤ 12px** | Arama alanı tek bilinçli istisnadır. |
| 9 | **Yerel depolama varsayılan, S3 opsiyonel** | Dosya depolama portu yerel adaptörle çalışır; S3 asla zorunlu bağımlılık olmaz. |
| 10 | **Mock testi production kanıtı değildir** | Her paket gerçek backend kapısını ayrı raporlar. |

---

## 3. Mevcut ve korunacak

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
| Stil | Bespoke CSS token + cascade layer | — | Pixel-perfect; tasarım sınırları (12px radius, 1rem, Roboto 400+) burada zorlanır |
| Yazı tipi | `@fontsource-variable/roboto` | 5.3.0 | Yerel; harici CDN isteği yok |
| Birim test | Vitest + Testing Library | 4.1.10 / 16.3.2 | Son kaydedilen tam suite: **941**; bu belge paketinde yeniden koşulmadı |
| Tarayıcı test | Playwright | 1.62.1 | Son kaydedilen koşu: **57**; bu belge paketinde yeniden koşulmadı. Request routing kullanır, sayfaya worker kurmaz |
| Mock | MSW | 2.15.0 | **Yalnız Vitest'in Node interceptor'ı için.** Tarayıcı worker'ı yoktur ve `no-mock-artifacts.test.ts` bunu kilitler |
| Erişilebilirlik | axe-core + `@axe-core/playwright` + `eslint-plugin-jsx-a11y` | 4.13.0 / 4.11.2 / 6.10.2 | critical/serious = 0 kapısı |
| Katalog | Storybook | 10.5.8 | Bileşen kataloğu; master-component disiplininin vitrini |
| Lint | ESLint + typescript-eslint | 9.39.5 / 8.67.0 | Kurulu ve çalışıyor |
| Paket yöneticisi | pnpm (corepack) | 11.21.0 | `packageManager` alanında sabit |
| Node | ≥ 22 | — | `engines` alanında sabit |

---

## 4. Eklenecek — her biri bir ürün ihtiyacına bağlı

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

## 5. Koşullu — değerlendirme sonrası

Bunlar **yasak değildir**, ama bugün karar verilmez. Her biri kendi ölçüm kapısını geçmek
zorundadır.

| # | Aday | Koşul | Ölçüm |
|---|---|---|---|
| 1 | **SCSS Modules** | Yalnız gerçek ve ölçülmüş bir ihtiyaç varsa. **Tailwind ve SCSS aynı pakette karıştırılmaz.** | Mevcut CSS token sisteminin yetersiz kaldığı somut bir vaka + bakım maliyeti karşılaştırması |
| 2 | **Tailwind v4** | Zorunlu değildir. Benimsenirse SCSS'ten tamamen vazgeçilir ve geçiş kademeli olur | Mevcut bespoke tasarımın topluca yeniden yazılmayacağının kanıtı |
| 3 | **shadcn/ui** | Zorunlu değildir. Radix zaten davranışı veriyor | Hazır bileşenin tasarım sınırlarımızı (12px radius, Roboto 400+, 1rem) bozmadığının kanıtı |
| 4 | **React Router v8** | **Otomatik upgrade yoktur.** Ayrı, kanıtlı bir migration milestone'u olabilir | Tüm rota testleri GREEN + rollback yolu denenmiş |
| 5 | **WebSocket** | SSE yetmediği ölçülürse | Çift yönlü iletişim gerektiren somut bir yüzey |
| 6 | **Telemetri (OpenTelemetry)** | Gerçek trafik başlayınca | Frontend trace'inin FastAPI trace'iyle ilişkilendirilebilmesi |
| 7 | **Analitik (PostHog / Plausible, self-host)** | KVKK değerlendirmesinden sonra | Veri işleyen sıfatı ve saklama süresi kararı — **owner** |
| 8 | **Feature flag (Unleash / OpenFeature)** | İkinci eşzamanlı sürüm hattı çıkınca | Deploy ile yayın kararını ayırma ihtiyacı ölçülünce |
| 9 | **Sentry (self-host)** | Production trafiği başlayınca | Hata izleme hattı kurulmadan source map açılmaz |
| 10 | **Biome (ESLint+Prettier yerine)** | Lint süresi ölçülebilir biçimde sorun olursa | Mevcut ESLint kurulumu bugün sorun üretmiyor |
| 11 | **XState** | Dallanan, çok adımlı akış karmaşıklaşırsa | Sihirbaz ve başvuru hattının durum grafiği ölçülünce |
| 12 | **Monorepo (Turborepo)** | İkinci gerçek tüketici ürün çıkarsa | Bugün tek ürün var |

---

## 6. Reddedilen

| # | Reddedilen | Gerekçe |
|---|---|---|
| 1 | **Next.js** | Kanonik yasak. Aday, geçiş hedefi veya opsiyon olarak dahi anılmaz |
| 2 | **MetaFramer** | Kanonik yasak, aynı kapsam |
| 3 | **Mevcut bespoke tasarımın topluca yeniden yazılması** | Aylarca kayıp ve geniş regresyon yüzeyi karşılığında sıfır müşteri değeri |
| 4 | **Tailwind + SCSS'in aynı pakette karıştırılması** | İkisi de CSS'i genişleten ön işlemcilerdir; birlikte kullanıldığında `@apply` ve tema değişkenleri öngörülemez biçimde bozulur |
| 5 | **SSR / server-rendering katmanı** | Ölçülmüş bir SEO veya ilk boya ihtiyacı yok; dağıtıma Node katmanı eklemek operasyon yükü üretir |
| 6 | **Mikro-frontend** | Tek ürün, tek ekip. Modular monolith yeterli |
| 7 | **Alpha/beta paketlerin production'a alınması** | Kırılma riski ürünün taşıyabileceğinden büyük |
| 8 | **Tarayıcı deposunda gizli değer (token, API anahtarı)** | Güvenlik ihlali; `truth-guard.test.ts` bunu koda karşı yasaklar |
| 9 | **Public source map** | Gerekçesiz kaynak ifşası ve dört katı dağıtım boyutu. Hata izleme hattı gelirse doğru ayar `"hidden"`'dır |
| 10 | **Tarayıcıda çalışan kural motoru** | Uygunluk kararı sunucunundur; `architecture.test.ts` bunu zorlar |
| 11 | **Uydurma backend ucu** | Var olmayan uca istek atan ekran yazılmaz |
| 12 | **ECharts'ın ana pakete girmesi** | Kök prototipteki 1.59 MB gömülü ECharts kusuru tekrar edilmez |

---

## 7. Depolama — yerel varsayılan, S3 opsiyonel

### 7.1 Port ve adaptör

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

### 7.2 Sahibin diliyle

Bir HRMS'e özlük dosyası yüklüyorsunuz. Yükleme çubuğu doluyor, "kaydedildi" yazıyor.
Altı ay sonra denetimde dosya yok — çünkü arkada bir depolama yoktu.

Bugünkü ürün bu hatayı **yapmıyor**: taşıma katmanı olmadığı için yükleyici kapalı ve
nedeni ekranda yazılı. Yapılacak iş, kapalı olanı açmaktır; açık görünüp çalışmayan bir
şey yapmak değil.

---

## 8. Sağlayıcı bağlantı mimarisi

### 8.1 Kapsam

Desteklenecek sağlayıcılar: **Gemini, OpenClaw, Claude, ChatGPT/OpenAI** — her biri için
hem hesap tabanlı hem API tabanlı bağlantı.

### 8.2 Değişmez güvenlik kuralları

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

### 8.3 Bugünkü durum

`platform/frontend/src/routes/providers.tsx` bu kuralların hepsine uyar: `port` verilmez,
her izin `false`'tur, hiçbir gizli alan erişilebilir değildir ve bağlantı listesi gerçekten
boştur. Eksik olan **sunucu tarafı broker**'dır.

---

## 9. Tarayıcı ve cihaz merdiveni

### 9.1 Genişlik merdiveni

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

### 9.2 Tarayıcı matrisi

| Tarayıcı | Durum | Hedef |
|---|---|---|
| Chromium (masaüstü) | ✅ Test ediliyor | Korunur |
| Chromium tabanlı mobil emülasyon | ✅ Test ediliyor | Korunur |
| WebKit / Safari | ❌ **UNVERIFIED** | F10'da kapatılır |
| Firefox | ❌ **UNVERIFIED** | F10'da kapatılır |
| Gerçek iOS Safari cihazı | ❌ **UNVERIFIED** | F10'da kapatılır |

---

## 10. Performans bütçeleri

| Ölçüt | Bütçe | Bugünkü durum |
|---|---|---|
| İlk yüklenen JS (gzip) | ≤ 180 kB | ~155 kB ölçüldü (eski ölçüm; her F fazında yeniden ölçülür) |
| Route başına lazy chunk | Zorunlu | ✅ Her rota `lazy` |
| Ana pakette grafik kütüphanesi | **Yasak** | ✅ Yok |
| Source map (production) | **Yok** | ✅ `sourcemap: false`, testle kilitli |
| Mock artefaktı (production) | **Yok** | ✅ `no-mock-artifacts.test.ts` kilitliyor |
| Harici origin isteği | **0** | ✅ Testle korunuyor |
| LCP / INP / CLS | Ölçülecek | ❌ **UNVERIFIED** — hiç ölçülmedi |

**Kural:** Bütçe aşıldığında bütçe yükseltilmez; kod küçültülür. Bu, mevcut paketin
kapsam eşiklerinde uyguladığı disiplinin aynısıdır (eşik düşürülmedi, test eklendi).

---

## 11. Erişilebilirlik kapıları

| Kapı | Eşik | Zorlayan |
|---|---|---|
| axe critical / serious | **0** | Playwright + `@axe-core/playwright` |
| Klavye ile tam kullanım | Zorunlu | E2E test |
| Başlık hiyerarşisi | Tek `h1`, seviye atlanmaz | Birim test |
| Kaydırılabilir kabın odaklanabilirliği | Zorunlu | axe (`scrollable-region-focusable`) |
| Renk kontrastı | WCAG 2.2 AA | axe + tasarım token'ları |
| Minimum metin boyutu | 1rem | Tasarım sözleşmesi testi |
| `prefers-reduced-motion` | Mutlak saygı | Motion katmanı testi |
| Ekran okuyucu manuel turu | Faz kapısı | ❌ **UNVERIFIED** — yapılmadı |

---

## 12. Test piramidi ve RED→GREEN

### 12.1 Piramit

| Seviye | Araç | Neyi kanıtlar | Bugünkü sayı |
|---|---|---|---|
| Birim / bileşen | Vitest + Testing Library | Bileşen kendi sözleşmesine uyar | 941 (son kayıt) |
| Muhafız (guard) | Vitest | Ürün kendi hakkında yalan söylemiyor | Yukarıdakine dahil |
| Mimari | Vitest + AST | Katman sınırları delinmemiş | Yukarıdakine dahil |
| Sözleşme | Zod `.strict()` + build kapısı | Backend sözleşmesi kaymamış | Build'de |
| Tarayıcı (e2e) | Playwright | Gerçek tarayıcıda yolculuk yürüyor | 57 (son kayıt) |
| Gerçek backend E2E | Playwright, mock routing kapalı | Ürün gerçek backend ile çalışıyor | ❌ **UNVERIFIED** — M67'de kapatılır |

> **Sayıların okunma kuralı.** **941** ve **57**, en son kaydedilen tam koşuların
> sonuçlarıdır; **bu belge paketinde suite yeniden koşulmamıştır** ve bu belge canlı bir
> doğrulama iddiası kurmaz. Ayrıca bu iki sayı **koşum sonucudur, dosyadaki test
> bildirimi sayısı değildir**: bu paketin ölçümünde e2e ağacında 7 spec dosyasında
> **52 statik `test(` bildirimi** vardır ve bunlar iki Playwright projesinde (chromium,
> mobile) koşar. Bildirim sayısı ile koşum sayısı aynı şey değildir ve birbirinin yerine
> yazılamaz.

### 12.2 RED→GREEN komutları

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

### 12.3 RED'in geçerlilik kuralı

Bir RED yalnızca **davranışsal** ise kanıttır. Modül çözümleme hatası (import edilemeyen
dosya) RED sayılmaz — bu, testin değil kurulumun hatasıdır. Hedef modül kasıtlı olarak
yanlış bir stub ile eklenir ve test **yanlış davranışı** yakalar.

### 12.4 Sözleşme stratejisi

1. Backend `pydantic` şeması → OpenAPI spec.
2. Spec → üretilmiş TypeScript istemcisi (`@hey-api/openapi-ts`).
3. Üretilmiş tip ile repodaki Zod şeması CI'da karşılaştırılır.
4. **Spec değişti ve istemci güncellenmediyse build kırılır.**

Bu zincir, "backend değişti, frontend fark etmedi" hatasını yapısal olarak imkânsız kılar.

---

## 13. Hetzner ve GitHub Actions taşınabilirliği

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

## 14. Karar kayıtları ve değişiklik kuralları

### 14.1 Bir teknolojiyi eklemek için gereken beş şey

1. Onu zorunlu kılan **somut ürün ihtiyacı** (bir kullanıcı yolculuğu cümlesi).
2. Reddedilen **en az bir alternatif** ve reddetme gerekçesi.
3. **Ölçülebilir kabul kriteri** (bundle etkisi, test sayısı, performans).
4. **Rollback yolu** — nasıl geri alınır.
5. Bu belgeye eklenen **bir satır**.

Beşi de yoksa teknoloji eklenmez.

### 14.2 Migration kuralları

| Kural | Açıklama |
|---|---|
| Büyük sürüm yükseltmesi otomatik değildir | React Router 7 → 8 dahil. Kendi milestone'u, kendi RED'i, kendi rollback'i olur |
| Topluca yeniden yazma yasaktır | Tasarım katmanı, tablo katmanı ve form katmanı kademeli değişir |
| Bir migration paketinde başka iş yapılmaz | Migration + özellik aynı pakette olursa hata kaynağı ayrıştırılamaz |
| Rollback yolu paket **başlamadan** bilinir | Bilinmiyorsa paket başlamaz |

### 14.3 Rollback

Frontend paketlerinin rollback'i, o paketin dosyalarının geri alınmasıdır. Backend,
prototip ve diğer paketler etkilenmez. Rollback kararı ve yürütmesi **Codex Desktop
MASTER**'ındır.

---

## 15. Owner özeti — sade Türkçe

**once:** Frontend'in hangi teknolojiyle, neden yürüdüğü hiçbir yerde tek bir belgede
yazılı değildi. Masaüstünde duran genel bir tavsiye belgesi vardı ama o belge başka
ürünler için yazılmıştı ve repodaki gerçekle üç noktada çelişiyordu.

**simdi:** Tek bir karar belgesi var. Neyin kurulu olduğu (sürüm sürüm), neyin ekleneceği
(her biri bir ürün ihtiyacına bağlı), neyin koşullu olduğu (hangi ölçümü geçmesi gerektiği
yazılı) ve neyin reddedildiği (gerekçesiyle) ayrı ayrı listelendi.

**fark:** Artık bir sonraki paket "hangi kütüphaneyi kullanalım" tartışmasıyla başlamaz.
Karar verilmiş; verilmemiş olanların hangi ölçümle verileceği de yazılmış. En önemlisi:
çalışan bespoke tasarım sistemi topluca yeniden yazılmayacak ve React Router v8'e
otomatik geçilmeyecek — ikisi de aylarca kayıp anlamına gelirdi.

**kullaniciYolculugu:** Bu belge kullanıcının doğrudan gördüğü bir şey değildir; ama
kullanıcının göreceği her şeyin sınırını çizer. Örneğin bir KOBİ yetkilisi telefonundan
başvuru belgesi yüklediğinde: dosya yerel depolamaya gider (S3 hesabı açmasına gerek yok),
yükleme yarıda kesilirse kaldığı yerden devam eder, API anahtarı hiçbir zaman tarayıcısında
saklanmaz ve ekranın hiçbir yerinde 1rem'den küçük metin görmez. Bu dört davranışın hepsi
bu belgedeki birer karardır.

**kalanEngel:** Eklenecek 17 yeteneğin tamamı henüz yoktur. Koşullu 12 kalemin hiçbirine
karar verilmemiştir ve verilmesi için ölçüm gerekir. WebKit ve Firefox doğrulaması,
LCP/INP/CLS ölçümü, gerçek backend E2E ve dual-host smoke **UNVERIFIED** durumdadır.
Analitik ve telemetri kararları KVKK değerlendirmesine bağlıdır ve **owner** kararıdır.

**capability_delta:** `0`. Bu belge tek bir satır ürün kodu değiştirmedi. Yaptığı şey, bir
sonraki paketin yanlış teknolojiyle başlamasını engellemek.
