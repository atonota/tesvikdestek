# Enterprise Frontend — Uygulama Raporu

**Change package:** `destektesvik-enterprise-frontend-v1`
**Konum:** `platform/frontend/` (+ `.github/workflows/frontend-ci.yml`, bu rapor)
**Base SHA:** `2ad7561e6fa33eb384c8ce62402f9ac18dd2152d`
**Host:** macOS (Darwin 25.1.0), arm64, Node v24.6.0, pnpm 11.21.0 (corepack)

Bu paket **hiçbir Python, Jinja, migration, domain, API veya backend testine dokunmaz** ve
dondurulmuş kök prototipi değiştirmez. Geri alma: `platform/frontend/`,
`.github/workflows/frontend-ci.yml` ve bu rapor silinir; başka hiçbir şey etkilenmez.

---

## 8 fazlık ilerleme

**8/8 tamamlandı, 0/8 aktif**

| Faz | Kapsam | Durum |
|---|---|---|
| W0 | Vite + React 19 + TS strict iskele, dev proxy, CI, RED test paketi | ✅ |
| W1 | Token'lar, 14 primitive, 10 durum deseni, Storybook | ✅ |
| W2 | Zod sözleşme katmanı, Query istemcisi, CSRF + form adaptörü, MSW | ✅ |
| W3 | 5 kabuk, kayıt/giriş/çıkış, hata sınırları | ✅ |
| W4 | Katalog, program detayı, kaynak kütüğü | ✅ |
| W5 | Karar tezgâhı: liste, detay, kural izi, karşılaştırma, kullanıcı onayı | ✅ |
| W6 | Tri-state profil, sihirbaz, kısmi-veri dürüstlüğü | ✅ |
| W7 | 7 boyutlu olgunluk, `/hazir` paneli, ayarlar, yetenek matrisi | ✅ |
| W8 | Sertleştirme: kapsam eşikleri, a11y, Playwright, doküman | ✅ |

---

## Önce / şimdi / fark

**once:** Kullanıcı 9 Jinja şablonundan (toplam 401 satır) oluşan, **hiç JavaScript içermeyen**
form tabanlı bir arayüz görüyordu. Bir kararın neden "Koşullu" olduğunu ancak düz metni okuyarak
anlıyordu; iki kararı yan yana koyamıyordu; sistemin neyi yapamadığını hiçbir yerde göremiyordu.

**simdi:** Aynı backend'e tek satır dokunmadan, `platform/frontend/` altında 34 kaynak
modülü, 75 bileşenlik bir tasarım sistemi ve 26 route tanımlı (25 ayrı yüzey uygulaması —
`/uygunluk` ile `/degerlendirmeler` aynı `DecisionsRoute`'u paylaşır) bir React uygulaması var. Kullanıcı
telefonda dört adımlı sihirbazı bitirebiliyor; masaüstünde 1440 pikselde üç panelli tezgâhta
her koşulun hangi olguda takıldığını satır satır, hangi resmî kaynağa dayandığını kimliği ve
iki hash'iyle görebiliyor; iki kararı yan yana koyabiliyor; olgunluk göstergesinde
"Başvuru hazırlığı — Ölçülemiyor" uyarısını kendi gözüyle okuyor; ve **yapılamayan 15 yeteneği**
"Backend yeteneği gerekli" etiketiyle, devre dışı düğmelerle görüyor.

**fark:** Sıfırdan kurulan bir frontend regresyon yüzeyi — 351 birim/bileşen/muhafız testi ve
34 tarayıcı testi — artı ürünün kendi dürüstlüğünü kodda zorlayan üç muhafız: yasaklı ifade
taraması, mimari sınır taraması ve yetenek matrisi sayım testi.

**kullaniciYolculugu:** Bir KOBİ yetkilisi `/kayit` → `/giris` → `/uygunluk/sihirbaz` →
`/degerlendirmeler` → `/degerlendirmeler/:id` yolunu tamamlıyor. Karar detayında "Kural izi"
sekmesinde `nace_code` olgusunun `prefix ["62","63"]` koşulunda **Bilinmiyor** kaldığını,
"Kanıt" sekmesinde kararın `snap-tubitak-1501-2026-08-14` yakalamasına dayandığını ve iki
hash'ini görüyor. "Kullanıcı onayı" sekmesinde kendi notunu kaydediyor — ve ekran ona bu onayın
hiçbir kuruma iletilmediğini, geçmiş onayların **listelenemediğini** söylüyor.

**kalanEngel:** Profil okuma ucu, onay listesi ucu, denetim izi ucu ve oturum/me ucu yok. Bu
dördü olmadan profil/onay/denetim yüzeyleri kalıcı olarak yarım kalır. Başvuru hattı, görevler,
belgeler, takvim ve bildirimler ise **varlık düzeyinde yok** — frontend işi değil, eksik backend
yeteneği.

**capability_delta:** +17 tam çalışan route yüzeyi, +8 kısıtı açıkça yazılmış yüzey,
+15 açıkça engellenmiş ve taklit edilmemiş yetenek, +75 yeniden kullanılabilir bileşen,
+7 boyutlu ölçülebilirlik etiketli olgunluk göstergesi. **Yeni backend yeteneği: 0.**

---

## Sayımlar

| Ölçü | Değer |
|---|---|
| Route tanımı | 26 (17 🟢 tam · 8 🟡 kısmi yüzey · 1 not-found) |
| Ayrı yüzey uygulaması | **25** — `/uygunluk` ve `/degerlendirmeler` aynı `DecisionsRoute`'u paylaşır |
| Master bileşen | **75** = 14 primitive + 16 bileşik + 10 durum deseni + 5 kabuk + 18 alan + 12 şablon |
| Ek ürün bileşeni (75'e dahil değil) | 4 (`BackendCapabilityGate`, `CapabilityMatrix`, `ReadinessTemplate`, `ApprovalForm`) |
| Storybook story | 54 (6 dosya, seviye başına bir katalog) |
| Kaynak modülü | 34 (`.stories`/`.test` hariç) |
| Test dosyası | 17 (15 vitest + 2 playwright spec) |
| Paket dosyası (`platform/frontend`) | 76 |
| Yetenek envanteri | 17 green / 8 partial / 15 blocked |

---

## RED kanıtı

Ürün kodu yazılmadan önce yedi kabul kapısı yazıldı. İlk koşu **modül çözümleme hatası** verdi;
bu paketin kendi ölçütüne göre bu kanıt sayılmaz, bu yüzden hedef modüller **kasıtlı olarak
yanlış** stub'larla eklendi (boş bileşen kayıt defteri, `serialiseTristate` her zaman `"false"`,
tek boyutlu olgunluk + `overall` skoru, boş yetenek envanteri, `findForbiddenClaims` hiçbir şey
bulmuyor). RED bu yüzden tümüyle davranışsaldır.

```
$ cd platform/frontend
$ pnpm vitest run

     × renders a skip link, one h1 and a main landmark at the root route
     × renders an honest not-found surface for an unknown route
     × exports exactly the 75 named components in the six documented levels
     × exposes the four backend outcome labels and nothing resembling approval
     × flags entitlement language through the shared guard
     × labels a recorded user approval exactly as Kullanıcı onayı
     × serialises the three states to the exact wire values the backend parses
     × never collapses unknown into false
     × returns all seven dimensions with an explicit measurability label
     × refuses to publish a single aggregate score
     × scores application readiness as unmeasurable, not as zero-out-of-five
     × keeps the disclaimer text byte-identical to the backend constant
     × renders the disclaimer on the decision detail template
     × publishes a capability matrix whose blocked entries are all disabled
     × counts the route inventory exactly as the scope report measured it
     × renders blocked capabilities as disabled with the required label

      Tests  16 failed | 2 passed (18)
```

**Exit code:** `1`

Temsilî iddialar, koşudan birebir:

```
AssertionError: expected [] to have a length of 14 but got +0
AssertionError: expected 'Onay' to be 'Kullanıcı onayı'
AssertionError: expected 'false' not to be 'false'
AssertionError: expected [ { id: 'data' } ] to have a length of 7 but got 1
AssertionError: expected { Object (dimensions, overall) } to not have property "overall"
AssertionError: expected 'stub' to be 'Bu sonuc bir on degerlendirmedir; res…'
AssertionError: expected 0 to be greater than or equal to 15
AssertionError: expected +0 to be 17
TestingLibraryElementError: Unable to find an accessible element with the role "link" and name /içeriğe geç/i
```

Geçen iki test, boş dizi üzerinde önemsiz biçimde doğru olan yinelenen-ad ve dışa-aktarım
kontrolleriydi; bu rapor onları RED kanıtı saymaz.

> **Bir RED, testin kendi hatasıydı ve öyle kaydedilir.** `/içeriğe geç/i` düzenli ifadesi
> hiçbir zaman eşleşemezdi: JavaScript'in `i` bayrağı Türkçe **İ** (U+0130) ile `i`'yi
> katlamaz. Uygulama değil, iddia düzeltildi (birebir dize karşılaştırması).

---

## GREEN kanıtı

```
$ pnpm install --frozen-lockfile      # Already up to date
$ pnpm lint                           # ✖ 1 problem (0 errors, 1 warning)
$ pnpm typecheck                      # tsc -b --noEmit, çıktı yok
$ pnpm test                           # Test Files 15 passed · Tests 351 passed
$ pnpm test:coverage
  Statements   : 91.59% ( 883/964 )
  Branches     : 82.93% ( 700/844 )
  Functions    : 88.03% ( 412/468 )
  Lines        : 93.07% ( 793/852 )
$ pnpm build                          # ✓ built
$ pnpm storybook:build                # Storybook build completed successfully
$ pnpm e2e                            # 34 passed (chromium + mobile)
```

**Exit kodları:** `0` (lint dâhil — kalan tek uyarı aşağıda açıklanıyor).

Kapsam eşikleri `vitest.config.ts` içinde tanımlıdır (satır 80, dal 80, fonksiyon 70, ifade 80)
ve koşuyu kendi başına düşürür. **Eşikler düşürülmedi**; ilk ölçümde dal kapsamı %77.37 ile
kaldığında eşik değil, test eklendi.

### Kalan tek lint uyarısı

```
src/components/composites.tsx:169  react-hooks/incompatible-library
  TanStack Table's `useReactTable()` API returns functions that cannot be memoized safely
```

React Compiler'ın `DataTable` içindeki `useReactTable()` çağrısını memoize etmeyi atladığını
bildirir. Hata değil, bilgilendirme; kütüphane değiştirilmeden susturulamaz ve susturmak
bilgiyi gizlemek olurdu. **UNVERIFIED değil, bilinen ve kabul edilen bir uyarıdır.**

### Paket boyutu

Temiz `dist/` (8 dosya = 1 HTML + 1 CSS + **6** JS, source map yok):

```
index.html                              0.84 kB │ gzip:   0.49 kB
assets/index-*.css                     24.57 kB │ gzip:   5.07 kB
assets/index-*.js                     520.92 kB │ gzip: 156.72 kB   (ilk yükleme)
assets/queries-*.js                    12.09 kB │ gzip:   4.08 kB   (lazy)
assets/app-*.js                        10.06 kB │ gzip:   3.65 kB   (lazy)
assets/public-*.js                      4.32 kB │ gzip:   1.88 kB   (lazy)
assets/auth-*.js                        1.11 kB │ gzip:   0.59 kB   (lazy)
assets/QueryBoundary-*.js               0.38 kB │ gzip:   0.28 kB   (lazy)
```

Bağımsız ölçüm: `gzip -c dist/assets/index-*.js | wc -c` → **155.084 bayt**. Vite'ın raporladığı
156,72 kB ile arasındaki fark sıkıştırma seviyesi farkıdır, maddi değildir.

İlk JS ~155 kB gzip; kapsam raporundaki 180 kB bütçesinin altında. Her route `lazy` ile
bölünmüştür. **ECharts kullanılmadı**: gösterilebilecek tek şey dört sonucun sayımı ve o da
etiketli çubuklarla, kütüphanesiz ve ekran okuyucuya okunur biçimde çiziliyor. Para grafiği
üretilemez (`published_reference` 3/3 `null`) ve üretilmesi §F.6'yı ihlal ederdi.

`dist/` içeriği tam olarak sekiz dosyadır: `index.html`, bir CSS ve altı JS. Source map yok,
mock artefaktı yok. Bu iddia artık `no-mock-artifacts.test.ts` tarafından **kilit altındadır**
(dosya sayısı, uzantı dağılımı ve `sourceMappingURL` referansı dâhil) — daha önce iki kez
ölçülmeden yazıldığı için.

---

## Düzeltme — yanlış çıkan bir iddia ve sebebi

Bu raporun ilk sürümü *"production bundle contains no MSW worker"* dedi. **Bu yanlıştı.**

MSW'nin çalışma zamanı importu gerçekten kaldırılmıştı ve `dist/assets` içinde MSW kod parçası
yoktu; ama `public/mockServiceWorker.js` (9.666 bayt) hâlâ depoda izleniyordu ve Vite `public/`
dizinini `dist/` içine **olduğu gibi kopyalar**. Yani kullanıcıya bir istek yakalayıcı servis
worker'ı gönderiliyordu.

Kök neden, temizliği yaparken `rm -rf public` komutunu depo kökünden çalıştırmış olmam: komut
var olmayan bir dizini sildi, sessizce başarılı oldu ve ben doğrulamadan iddiayı yazdım.
**Bir import'u kaldırmak bir artefaktı kaldırmak değildir; bir build çıktısı hakkındaki iddia
build çıktısına bakılarak doğrulanmalıdır.**

Ayrıca iki yapılandırma dosyasının yorumları da artık doğru olmayan bir mekanizmayı anlatıyordu
(`playwright.config.ts`: "MSW browser worker", "worker handshake", "mock-enabled build";
`pnpm-workspace.yaml`: "Storybook and Playwright benefit from the worker").

Yapılanlar:

1. `src/test/no-mock-artifacts.test.ts` eklendi — RED'i önce yakalayan muhafız.
2. `public/mockServiceWorker.js` silindi; `public/` dizini tamamen kalktı.
3. `playwright.config.ts` ve `pnpm-workspace.yaml` yorumları gerçekte çalışan mekanizmayı
   anlatacak şekilde düzeltildi.
4. MSW yalnızca **Vitest'in Node interceptor'ı** için duruyor (`src/mocks/server.ts` →
   `msw/node`). Tarayıcı testleri Playwright request routing kullanır ve sayfaya hiçbir şey
   kurmaz. `package.json` içinde `msw.workerDirectory` alanı yoktur, bu yüzden MSW'nin
   postinstall'ı artık hiçbir worker yazmaz — tekrarı engelleyen asıl düzeltme budur.

### Muhafızın RED kanıtı

```
$ pnpm vitest run src/test/no-mock-artifacts.test.ts

     × public/ does not contain a mock service worker
     × public/ contains no mocking artifact under any name
     × the built output, when present, contains no mock service worker
     × no application source imports the browser worker
     × does not claim a service worker intercepts anything
     × names the mechanism it actually uses
     × the pnpm workspace notes do not claim the worker benefits Storybook or Playwright

      Tests  7 failed | 4 passed (11)
```

**Exit code:** `1`. Temsilî iddialar: `expected true to be false`,
`expected 'import { defineConfig, devices } from…' to match /request routing/iu`.

> Bu RED'lerden biri yine **testin kendi hatasıydı**: muhafız, yasakladığı dizeleri kendi
> kaynağında taşıdığı için kendini işaretledi. Dosya kendi taramasından çıkarıldı. İki tanesi de
> aşırı katıydı — yapılandırmanın *"no service worker is installed"* diyebilmesi gerekir;
> bu yüzden kontrol, cümle düzeyinde olumsuzlama farkındalığı kazandı ve muhafızın hâlâ
> başarısız olabildiğini kanıtlayan bir test eklendi.

### GREEN

```
$ pnpm vitest run src/test/no-mock-artifacts.test.ts     # Tests 12 passed
$ pnpm build && ls dist
  index.html  assets/                                    # mockServiceWorker.js yok
$ find dist -iname '*mock*' -o -iname '*msw*'            # çıktı yok
$ grep -rl "setupWorker" dist                            # çıktı yok
```
---

## Backend uyumluluk haritası

Yalnızca gerçekten var olan uçlar kullanıldı. **Hiçbir route uydurulmadı, hiçbir SSR HTML
ayrıştırılmadı.**

| Yüzey | Sözleşme | Yön |
|---|---|---|
| Katalog, program detayı, fırsatlar | `GET /api/programlar` | oku |
| Kaynak kütüğü, kanıt paneli | `GET /api/kaynaklar` | oku |
| Karar listesi, kokpit, hazırlık, olgunluk | `GET /api/degerlendirmeler` | oku |
| Karar detayı, karşılaştırma | `GET /api/degerlendirmeler/{id}` | oku |
| Platform sağlığı | `GET /hazir` | oku |
| Jeton | `GET /api/csrf` | oku |
| Değerlendirme çalıştırma | `POST /api/degerlendir` + `X-CSRF-Token` | yaz |
| Kayıt / giriş / çıkış | `POST /kayit`, `/giris`, `/cikis` (form + `csrf_token`) | yaz |
| Profil | `POST /profil` (form, 12 alan, tri-state) | yaz |
| Kullanıcı onayı | `POST /degerlendirmeler/{id}/onay` (form) | yaz |

Üç mekanizma kanıta dayanır:

1. **Tek imza.** `GET /api/csrf` ile `pages.py::_render` **aynı** `sign_csrf`'i çağırır; bu
   yüzden JSON ucundan alınan jeton SSR form alanında da geçerlidir. Varsayım değil, kod eşitliği.
2. **Çerez tabanlı kimlik.** İstemci yalnızca `credentials: "include"` kullanır; hiçbir jeton
   tarayıcı deposuna yazılmaz ve bu bir kaynak taramasıyla korunur.
3. **Form uçları sürülebilir.** `303` yanıtın gövdesi yok sayılır, HTML **hiç ayrıştırılmaz**;
   başarı `response.ok`, ardından `invalidateQueries()`.

Her yanıt Zod ile `.strict()` doğrulanır (backend şemaları `extra="forbid"`). Sözleşme kayarsa
ekran veri göstermez, **"Sunucu yanıtı beklenen sözleşmeye uymuyor"** der — bir testle kanıtlı.

---

## Engellenmiş yetenek envanteri (15)

Hiçbiri taklit edilmedi; hepsi `/yetenekler` sayfasında devre dışı düğme ve gerekçeyle görünür.

| Yetenek | Neden |
|---|---|
| Parola sıfırlama · E-posta doğrulama | Jeton modeli ve e-posta gönderimi yok |
| Aktif oturumlarım | `user_sessions` var, okuma ucu yok |
| Kullanıcı yönetimi · Rol/yetki | Kayıt tek kiracı + tek kullanıcı üretir; rol modeli yok |
| Kaydedilen fırsatlar | Kayıt yeri yok; tarayıcıda tutmak sunucu kaydı gibi görünürdü |
| Sunucu taraflı sayfalama/filtre | Liste ucu tüm kayıtları filtresiz döner |
| Kaynak değişiklik geçmişi | Snapshot farkı ucu yok |
| Onay listesi | `ApprovalOut` yazılmış, hiçbir route kullanmıyor |
| Denetim izi | `AuditRepository.list_for_tenant` var, HTTP ucu yok |
| Başvuru hattı · Görevler · Belge yükleme | `Application`/`Task`/`Document` domainde yok |
| Takvim | Üç programın da çağrı penceresi boş; takvim uydurma tarih üretirdi |
| Bildirimler | Tablo, kanal ve işçi yok |

**Kısmi (8)** yüzeylerin her biri sınırını ekranda yazar; en önemlisi: profil **yazılabilir ama
okunamaz** ve bu, formun her açılışında `PartialDataNotice` ile söylenir.

---

## Dürüstlük muhafızları (kodda zorlanır)

| Muhafız | Ne yapar |
|---|---|
| `truth-guard.test.ts` | Tüm kaynak ağacını tarar: "onaylandı", "hak kazan", "alacağınız tutar", "garanti" iddiaları **0 eşleşme**. Yadsımayı iddiadan ayırt eder (cümle içi olumsuzlama), böylece ürün kendi sınırlarını anlatmaya devam edebilir |
| `truth-guard.test.ts` (güvenlik) | `dangerouslySetInnerHTML` 0 · tarayıcı deposunda kimlik/olgu 0 · harici origin isteği 0 · `credentials: "include"` mevcut |
| `architecture.test.ts` | `domain/` React/router/Query import etmez, `fetch` çağırmaz; hiçbir bileşen doğrudan `fetch` etmez; **istemcide kural motoru çalıştırılmaz** |
| `red-acceptance.test.tsx` | 75 bileşen ve altı seviye sayımı; yetenek matrisi 17/8/15; disclaimer birebir |
| `capability-truth.spec.ts` | Gerçek tarayıcıda: 15 devre dışı düğme, karar yüzeylerinde yasaklı ifade yok, AI rozeti yok, bilinmeyen çağrı penceresi "Açık" görünmüyor |

---

## Doğrulama komutları ve sonuçları

### Frontend

| Komut | Sonuç |
|---|---|
| `pnpm install --frozen-lockfile` | ✅ Already up to date |
| `pnpm lint` | ✅ 0 error, 1 warning (yukarıda açıklandı) |
| `pnpm typecheck` | ✅ çıktı yok |
| `pnpm test` | ✅ 15 dosya, **351 test** |
| `pnpm test:coverage` | ✅ 91.59 / 82.93 / 88.03 / 93.07 — eşiklerin üstünde |
| `pnpm build` | ✅ 8 dosya; ilk JS ~155 kB gzip; source map yok, mock artefaktı yok |
| `pnpm storybook:build` | ✅ tamamlandı |
| `pnpm e2e` | ✅ **34 passed** (chromium + mobile), axe critical/serious = 0 |

### Backend (değişmediğinin kanıtı)

| Komut | Sonuç |
|---|---|
| `uv run --frozen ruff check .` | ✅ All checks passed |
| `uv run --frozen ruff format --check .` | ✅ 76 files already formatted |
| `uv run --frozen mypy` | ✅ 71 source files |
| `uv run --frozen pytest tests` | ✅ **334 passed, 68 skipped** — paketten önceki sayıyla birebir aynı |
| `git diff --check` | ✅ temiz |
| `git status --short` | ✅ yalnızca `M .gitignore` (önceki paketin izinli eklemesi) + untracked paket dizinleri |

### Bulunan ve düzeltilen gerçek bir sızıntı

`ruff format --check .` backend'de 76 yerine **77** dosya saymaya başladı: Ruff, biçimlendirme
yürüyüşünde `frontend/node_modules/.pnpm/flatted@*/…/flatted.py` dosyasına giriyordu. Linter onu
dışlıyordu, biçimlendirici saymıştı — yani bir **frontend bağımlılığı, backend'in biçim kapısını
düşürebilirdi**. `platform/pyproject.toml` bu paketin yetkisinde olmadığı için düzeltme
`platform/frontend/.ruff.toml` (`extend-exclude = ["*"]`) ile kendi ağacımızda yapıldı. Sayım
76'ya döndü.

---

## Ürün iddiası — ne çalışıyor, ne çalışmıyor

**Şu anda çalışan (gerçek backend ile, ters proxy kurulduğunda):** kamuya açık karşılama, nasıl
çalışır, program kataloğu ve detayı, kayıt, giriş, çıkış, kokpit, fırsat keşfi ve detayı, kaynak
kütüğü, değerlendirme çalıştırma, karar listesi/detayı/kural izi/karşılaştırma, organizasyon
hazırlığı, 7 boyutlu olgunluk, platform sağlığı, yetenek matrisi, görünüm ve erişilebilirlik
ayarları.

**Kısmen çalışan, sınırı ekranda yazan:** şirket profili (yaz-ama-oku-yok), uygunluk sihirbazı
(cevaplar geri yüklenemez), kaynak detayı (ham metin yok), kullanıcı onayı (yaz, listeleme yok),
belge kontrol listesi (yalnız bu tarayıcıda), güvenlik ayarları (yalnız çıkış), onboarding
(ilerleme kalıcı değil).

**Çalışmayan ve gizlenmeyen:** başvuru hattı, görevler, belgeler, takvim, bildirimler, denetim
izi, onay listesi, rol/ekip, parola sıfırlama, 2FA, sunucu taraflı sayfalama.

**Bu paketin tek cümlelik dürüst iddiası:** *Bu, bugünkü backend'in gerçekten üretebildiği her
şeyi kurumsal ölçekte gösteren, üretemediği hiçbir şeyi taklit etmeyen bir karar ve kanıt
tezgâhıdır.*

---

## Doğrulanmamış kapılar (UNVERIFIED)

| Kapı | Durum | Neden |
|---|---|---|
| Gerçek FastAPI + PostgreSQL karşısında uçtan uca akış | **UNVERIFIED** | Tarayıcı testleri Playwright request routing kullanır. Her spec başlığı `[mocked backend]` taşır ve bu rapor gerçek-backend E2E iddia **etmez** |
| Ters proxy altında `/uygulama` yayını | **UNVERIFIED** | Altyapı kararı; `platform/frontend/docs/deployment.md` sözleşmeyi yazar, uygulamaz |
| Frontend CI işi | **UNVERIFIED** | Hiçbir şey push edilmedi; `frontend-ci.yml` GitHub'da hiç çalışmadı |
| Lighthouse performans bütçeleri (LCP/INP/CLS) | **UNVERIFIED** | Ölçülmedi; yalnızca bundle boyutu ölçüldü |
| Görsel snapshot temeli (96 kare) | **UNVERIFIED** | Alınmadı; yerine 4 kırılımda taşma testi ve axe kontrolü yapıldı |
| VoiceOver ile manuel ekran okuyucu turu | **UNVERIFIED** | Otomatik axe temizdir; manuel tur yapılmadı |
| WebKit ve Firefox tarayıcıları | **UNVERIFIED** | Yalnızca Chromium ve Chromium tabanlı mobil emülasyon çalıştırıldı |
| PostgreSQL/Docker/Hetzner backend kapıları | **UNVERIFIED** | Bu paketin kapsamı dışında; önceki paketlerin durumu değişmedi |

Hiçbiri simüle edilmedi ve hiçbirinin yerine ikame kanıt sunulmadı.

---

## Geri alma

```bash
rm -rf platform/frontend
rm .github/workflows/frontend-ci.yml
rm docs/reports/2026-08-14-enterprise-frontend-implementation.md
```

Bu üç komuttan sonra depo, bu paket hiç var olmamış gibi kalır: backend'in 334 testi, ruff,
mypy ve dondurulmuş prototip muhafızı etkilenmez.

---

# Bağımsız inceleme sonrası düzeltme (CONDITIONAL → kapatma)

Paketi yazmayan bağımsız bir inceleyici `783e8574…7c21` fingerprint'i üzerinde **CONDITIONAL**
döndürdü: 1×P0, 2×P1, 1×P2 ve dört sayım kayması. Hepsi haklıydı. Aşağıdakiler yalnızca
inceleyicinin allowlist'i içinde düzeltildi.

## P0 — Oturum düştüğünde yazma işlemi sessizce "başarılı" görünüyordu

`_require_user`, kimliksiz bir form POST'una **`303 → /giris?hata=oturum`** yanıtı verir.
`fetch` yönlendirmeyi varsayılan olarak izler, giriş sayfası sıradan bir **`200 text/html`**
olarak döner ve `response.ok` **`true`** olur. Sonuç: oturumu düşmüş bir kullanıcı profilini
kaydettiğinde veya onay notu yazdığında **hiçbir şey yazılmamışken arayüz başarı raporluyordu**.

Bunu görebilecek tek veri (`response.url`) üretiliyor ama okunmuyordu.

**Düzeltme:** `client.ts` içinde `SessionExpiredError` ve `landedOnLoginPage()`. Kontrol
`request()` içinde, `ok` kontrolünden **önce** yapılır — çünkü bu hata 200 kılığında gelir.
Yalnızca tarayıcının zaten verdiği `redirected` ve `url` kullanılır; **HTML ayrıştırılmaz** ve
**her yönlendirme hata sayılmaz**: başarılı giriş de bir 303'tür ve `/profil`'e iner.
`path !== "/giris"` koruması, başarısız bir girişin "oturum doldu" diye etiketlenmesini önler.

## P1-1 — Giriş ve kayıt ekranlarında yanlış / ham hata metni

`describeError` uç noktadan bağımsızdı: yanlış parola (`/giris` 401) **"Oturumunuz doğrulanmadı,
tekrar giriş yapın"** diyordu — kullanıcı zaten giriş ekranındaydı. Reddedilen kayıt (`/kayit`
400) ise ham **"İstek başarısız (400)"** dizesini gösteriyordu.

**Düzeltme:** `ApiError.path` + `status` eşlemesi. `/giris` 401 → *"E-posta veya parola
hatalı."* (iki yarısı için tek mesaj; hangisinin yanlış olduğu sızmaz). `/kayit` 400 → ne
düzeltileceğini söyleyen, ama **e-postanın kayıtlı olup olmadığını doğrulamayan** bir mesaj.
Diğer 401'ler oturum rehberliğini korur.

İnceleyicinin haklı olarak "kapsıyormuş gibi görünen test" dediği prop-enjeksiyonu
(`templates-and-routes.test.tsx`) yerine artık **gerçek uygulama akışı** test ediliyor: MSW 401
döndürüyor, `/giris` ekranı sürülüyor, `role="alert"` içeriği doğrulanıyor.

## P1-2 — Build çıktısı hakkında (ikinci kez) yanlış iddia

Rapor *"başka hiçbir dosya yok"* diyordu; gerçek `dist/` **14 dosyaydı** — altı `.js.map`,
toplam 2,46 MB. Yani tüm TypeScript kaynağı `/uygulama/assets/*.js.map` altından herkese açık
yayımlanıyordu ve bu bir seçim olarak hiçbir yerde beyan edilmemişti.

**MASTER kararı:** `sourcemap: false`. Map'leri yükleyeceğimiz özel bir hata-izleme hattı yok;
public source map, gerekçesiz bir kaynak ifşası ve dört katı dağıtım boyutudur. İleride bir
izleme servisi benimsenirse doğru ayar `"hidden"`'dır.

İddia artık **test kilidi altında**: `no-mock-artifacts.test.ts` dosya sayısını (8), uzantı
dağılımını (1 HTML + 1 CSS + 6 JS), `.map` yokluğunu ve hiçbir asset'in `sourceMappingURL`
referansı taşımadığını doğrular.

## P2 — Depolama muhafızının kör noktası

Muhafız `store/ui.ts`'yi **dosya düzeyinde tümüyle muaf** tutuyor ve `localStorage` sözcüğünü
arıyordu — oysa kalıcılık `zustand/middleware` `persist` ile yapılıyor ve bu sözcük kaynak
ağacında hiç geçmiyor. Yani muhafız, kod tabanının kullanmadığı bir token'ı arıyordu.

**Düzeltme:** dosya muafiyeti kaldırıldı. Muhafız artık her `persist(` kullanımını bulur,
`partialize` varlığını zorunlu kılar, yazılan anahtarları çıkarır ve yalnızca
`density · theme · fontScale · reducedMotion` listesine izin verir; kimlik, e-posta, kiracı,
organizasyon, şirket olgusu veya profil değeri içeren bir anahtar testi düşürür. Muhafızın
gerçekten düşebildiğini kanıtlayan bir test de eklendi.

## P3 — Sayım kaymaları

| Kalem | Önce | Şimdi |
|---|---|---|
| Test sayısı (rapor `:46`) | 293 | o dönemde ölçülen **328**. *Güncel sayı bu bölümün çok altında değişti; paketin şu anki toplamı **351**'dir ve yukarıdaki güncel tablolar onu gösterir.* |
| Test sayısı (CI yorumu) | 294 | sayı kaldırıldı — yorumdaki sayı bayatlar, paket kendi toplamını raporlar |
| Chunk tablosu | 5 parça | **6** parça (`QueryBoundary-*.js` eklendi), boyutlar yeniden ölçüldü |
| Route ifadesi | "26 route'luk uygulama" | "26 route tanımı, **25 ayrı yüzey**" (`/uygunluk` ve `/degerlendirmeler` aynı bileşeni paylaşır) |
| gzip | 156,47 kB | Vite 156,72 kB · bağımsız `gzip` 155.084 B (araç farkı, beyan edildi) |

## RED kanıtı (düzeltmeden önce)

```
$ pnpm vitest run src/test/write-truth.test.tsx

  × postForm to profil throws when it lands on the login page
  × postForm to onay throws when it lands on the login page
  × a session-expired write never reports ok
  × the JSON evaluation endpoint is held to the same rule
  × gives the user session-expired guidance, not a success message
  × saving a profile with an expired session fails and invalidates nothing
  × recording an approval with an expired session fails and invalidates nothing
  × running an evaluation with an expired session fails and invalidates nothing
  × a wrong password on /giris reads as a credentials error, not a session error
  × a rejected registration reads as a validation message, not a raw status

  Tests  10 failed | 5 passed (15)
```

En can alıcı satır, P0'ın birebir kanıtıdır:

```
AssertionError: promise resolved "{ ok: true, …(1) }" instead of rejecting
AssertionError: expected { ok: true, …(1) } to not match object { ok: true }
```

Geçen 5 test, **başarılı** yönlendirmelerin (giriş → `/profil`, çıkış → `/`) hâlâ başarı
sayıldığını doğrular; yani düzeltme "her yönlendirmeyi hata say" değildir.

`sourcemap` ve depolama muhafızı için RED, aynı koşuda `no-mock-artifacts` ve `truth-guard`
dosyalarından geldi.

## GREEN

```
$ pnpm lint            → ✖ 1 problem (0 errors, 1 warning)
$ pnpm typecheck       → çıktı yok
$ pnpm test            → Test Files 15 passed · Tests 328 passed
$ pnpm test:coverage   → 90.68 / 82.48 / 86.66 / 92.07
$ pnpm build           → 8 dosya, map yok
$ pnpm storybook:build → completed (storybook-static içinde 0 adet .map)
$ pnpm e2e             → 34 passed
```

## Bu düzeltmenin kapsamadığı iş — sonraki pakette kapatıldı

P0'ın **kullanıcıya görünen** yarısı bu pakette bırakılmıştı: yazma işlemi doğru biçimde
başarısız oluyor ve hiçbir şeyi tazelemiyordu, ama profil, onay ve sihirbaz ekranlarında bunu
söyleyen bir hata bölgesi yoktu. `src/routes/app.tsx` ve `src/components/templates.tsx` o
düzeltmenin allowlist'inde değildi. Aşağıdaki bölüm bu eksiği kapatır.

---

# Kullanıcıya görünen hata yüzeyi (P0'ın ikinci yarısı)

Bağımsız inceleme `f36fe290…7235` fingerprint'ini, P0'ın görünen yarısı eksik olduğu için
**CONDITIONAL** bıraktı. Bu paket yalnızca o eksiği kapatır: zaten doğru üretilen
`SessionExpiredError` ve API hatalarını, etkilenen yazma ekranlarında görünür kılar.

## RED — mevcut arayüze karşı

```
$ pnpm vitest run src/test/write-truth.test.tsx

  × A. the profile screen announces the failure and claims no success
  × B. the approval screen announces the failure and records no approval
  × C. the wizard announces the failure and does not advance to evaluation

  Tests  3 failed | 20 passed (23)
```

Üçünün de hatası birebir aynıydı ve tam olarak eksiği adlandırıyordu:

```
TestingLibraryElementError: Unable to find role="alert"
```

Dört **pozitif kontrol** RED aşamasında da geçti (D1 gerçek profil kaydı, D2 gerçek onay kaydı,
D3 gerçek sihirbaz tamamlanması, A2 gönderim öncesi hiçbir uyarı yok). Yani düzeltme
"her yazmayı hatalı göster" değildir; başarı yolu değişmeden duruyordu ve duruyor.

> **RED sırasında bulunan ayrı bir kusur.** D3 pozitif kontrolü ilk koşuda
> `Found multiple elements with the role "heading"` ile düştü: `/degerlendirmeler` sayfası
> **iki `h1`** basıyor. Bu paketin izni hata yüzeyiyle sınırlı olduğu için o an
> **sessizce düzeltilmedi**; test, başlık saymak yerine "sihirbaz artık ekranda değil"
> biçiminde yazıldı ve kusur takip işi olarak kaydedildi. Aşağıdaki başlık hiyerarşisi
> paketinde kapatılmıştır.

## Uygulama

| Dosya | Değişiklik |
|---|---|
| `components/templates.tsx` | `ProfileWorkspace`, `ApprovalForm`, `EligibilityWizard` için `error?: string \| null` prop'u ve `role="alert"` taşıyan `dt-field-error` bölgesi |
| `routes/app.tsx` | `ProfileRoute`, `DecisionDetailRoute`, `WizardRoute` → `describeError(mutation.error)` |

Üç ilke korundu:

1. **Başarı yolu yalnız `onSuccess`'te.** `recordedNote` hâlâ yalnızca mutation başarılı
   olduğunda yazılır; başarısız bir onay "kaydedildi" kartını asla boyayamaz.
2. **Sihirbaz başarısızlıkta ilerlemez.** `evaluate.mutate` yalnızca `save` başarılı olduğunda
   çağrılır, `navigate` yalnızca `evaluate` başarılı olduğunda. Test, başarısız kayıtta
   `POST /api/degerlendir`'in **hiç çağrılmadığını** doğrular.
3. **Yeni yetenek uydurulmadı.** Global toast yok, HTML ayrıştırma yok, API/backend sözleşmesi
   değişmedi.

## GREEN

```
$ pnpm vitest run src/test/write-truth.test.tsx   → Tests 23 passed (23)
$ pnpm lint            → ✖ 1 problem (0 errors, 1 warning)
$ pnpm typecheck       → çıktı yok
$ pnpm test            → Test Files 15 passed · Tests 335 passed
$ pnpm test:coverage   → 91.51 / 82.83 / 87.95 / 93.01
$ pnpm build           → 8 dosya (1 HTML + 1 CSS + 6 JS), map yok, mock yok
$ pnpm storybook:build → completed, 0 adet .map
$ pnpm e2e             → 34 passed
```

Backend değişmedi: `pytest` 334 passed / 68 skipped, `ruff` temiz, `ruff format --check`
76 dosya, `mypy` 71 kaynak dosyası, `git diff --check` temiz.

## Hâlâ açık olan takip işi

- Hata bölgesi yalnızca bu üç yazma ekranına eklendi. Diğer yüzeylerde okuma hataları zaten
  `QueryBoundary` → `ErrorState` üzerinden `role="alert"` ile duyuruluyor.

---

# Başlık hiyerarşisi (çift `h1`)

Önceki pakette RED sırasında bulunup takip işi olarak kaydedilen kusur burada kapatıldı.

## Sorun

`/degerlendirmeler` iki `h1` basıyordu: `DecisionsRoute` içindeki görsel-gizli
**"Karar tezgâhı"** ve tezgâha gömülü `DecisionDetail`'in program başlığı. Tek köklü bir
belge ana hattı yoktu; ekran okuyucu tek bir ekran için **iki farklı belge başlığı** duyuruyordu.

Aynı bileşen `/degerlendirmeler/:id` adresinde başlı başına bir sayfadır ve orada başlığının
`h1` olması doğrudur. Yani çözüm silmek değil, **bağlam**tır.

## RED

```
$ pnpm vitest run src/test/templates-and-routes.test.tsx -t "heading hierarchy"

  × the decision workspace has exactly one h1
  × the embedded decision title is an h2 under that h1
  × no route skips a heading level below the decision title
  ✓ the standalone decision page keeps its title as the h1

  Tests  3 failed | 1 passed | 31 skipped (35)
```

```
AssertionError: expected [ <h1 …(1)></h1>, <h1></h1> ] to have a length of 1 but got 2
TestingLibraryElementError: Unable to find an accessible element with the role "heading"
                            and name /TÜBİTAK 1501/
AssertionError: başlık seviyesi atlandı: h1 -> h3: expected 2 to be less than or equal to 1
```

> **Üçüncü RED, aranmayan ikinci bir kusuru ortaya çıkardı.** Bağımsız sayfa hâlinde
> `DecisionDetail` `h1` başlıktan doğrudan `h3` kartlara atlıyordu — `h2` hiç yoktu. Bu, çift
> `h1`'den ayrı, önceden beri var olan bir ana hat boşluğudur ve aynı düzeltmeyle kapandı.

Dördüncü test (bağımsız sayfa `h1`'ini korur) **RED aşamasında da geçti**: düzeltme
"her `h1`'i indir" değildir.

## Uygulama

`DecisionDetailProps` artık açıkça tipli bir `headingLevel?: 1 | 2` taşır (varsayılan `1`).
Başlık etiketi ve bölüm kartlarının seviyesi bundan türetilir:

| Yerleşim | Başlık | Bölüm kartları |
|---|---|---|
| Bağımsız sayfa (`/degerlendirmeler/:id`) | `h1` | `h2` |
| Tezgâha gömülü (`/degerlendirmeler`) | `h2` | `h3` |

`DecisionsRoute` yalnızca gömülü kullanımda `headingLevel={2}` geçirir. Sayfanın kendi `h1`'i
**kaldırılmadı**, hiçbir semantik zayıflatılmadı ve kusur testte gizlenmedi.

## GREEN

```
$ pnpm vitest run … -t "heading hierarchy"  → Tests 4 passed | 31 skipped
$ pnpm lint            → ✖ 1 problem (0 errors, 1 warning)
$ pnpm typecheck       → çıktı yok
$ pnpm test            → Test Files 15 passed · Tests 339 passed
$ pnpm test:coverage   → 91.53 / 82.93 / 87.95 / 93.03
$ pnpm build           → 8 dosya (1 HTML + 1 CSS + 6 JS), map yok, mock yok
$ pnpm storybook:build → completed, 0 adet .map
$ pnpm e2e             → 34 passed
```

Backend dokunulmadı: mimari muhafız 143 test yeşil, `ruff` temiz, `ruff format --check` 76
dosya, `mypy` 71 kaynak dosyası, `git diff --check` temiz. (Tam backend paketi bir önceki
pakette 334 passed / 68 skipped ile yeşildi ve bu pakette hiçbir backend dosyası değişmedi.)

---

# Başarılı kayıt yönlendirmesi (P0'ın ayna görüntüsü)

Bağımsız inceleme `a4226751…cb30` anlık görüntüsünü reddetti. Haklıydı ve bulduğu kusur benim
önceki düzeltmemin doğrudan sonucuydu.

## Sorun

Sessiz-yanlış-başarı hatasını kapatırken kurduğum dedektör, `/giris` dışındaki **her** isteğin
giriş sayfasına inmesini "oturum doldu" saydı. Oysa `pages.py:109`, **başarılı** bir
`POST /kayit`'i `303 → /giris?kayit=tamam` ile yanıtlar.

Sonuç: **hesap gerçekten oluşuyor, arayüz oluşmadığını söylüyordu.** İlk hata bir yazmayı
olmadığı hâlde başarılı gösteriyordu; bu hata olmuş bir yazmayı başarısız gösteriyordu. İkisinin
de kökü aynı: niyeti yalnızca **varış noktasından** çıkarmaya çalışmak. Varış noktası tek başına
hiçbir zaman yeterli bilgi taşımıyordu.

Testler bunu yakalayamadı çünkü `mocks/handlers.ts` bütün form uçlarına düz `200` döndürüyordu;
yani üzerinde akıl yürütülmesi gereken yönlendirme sözleşmesi hiç kurulmamıştı.

## RED

Önce mock'lar gerçek sözleşmeye çevrildi (`pages.py`'nin döndürdüğü hedefler birebir), sonra:

```
$ pnpm vitest run src/test/write-truth.test.tsx

  × POST /kayit -> /giris?kayit=tamam stays a success
  × registration succeeding on the login page is never an expired session
  × the registration route lands the user on the login page without an alert
  × treats the public auth endpoints as not session-required
  × does not treat an unrelated path as protected

  Tests  5 failed | 30 passed (35)
```

```
AssertionError: promise rejected "SessionExpiredError: Oturum sona erdiği i…" instead of resolving
AssertionError: expected true to be false
```

Aynı koşuda **süresi dolmuş korumalı yazmalar yeşil kaldı** (profil ve onay hâlâ
`SessionExpiredError` fırlatıyor, `onSuccess`/invalidation/kayıt kartı hiç oluşmuyor) — yani
düzeltme "kontrolü kaldır" değildir.

## Uygulama

Dedektör açık, tipli ve saf bir yükleme indirgendi:

```ts
const SESSION_REQUIRED_FORM_WRITES = [/^\/profil$/u, /^\/degerlendirmeler\/[^/]+\/onay$/u];
isSessionExpiredRedirect(path, finalUrl)  // yalnız bu iki yol + varış /giris ise true
```

`/kayit`, `/giris`, `/cikis` **oturum gerektiren yazma değildir**; giriş sayfasına inmeleri
başarıdır. HTML okunmaz, gövde incelenmez; yalnız istek yolu ve tarayıcının bildirdiği son URL
kullanılır.

`pages.py`'nin bugün döndürdüğü **beş** başarı hedefinin tamamı tablo güdümlü bir regresyon
sözleşmesiyle kilitlendi:

| Uç | Başarı hedefi |
|---|---|
| `POST /kayit` | `/giris?kayit=tamam` |
| `POST /giris` | `/profil` |
| `POST /cikis` | `/` |
| `POST /profil` | `/profil?kayit=tamam` |
| `POST /degerlendirmeler/{id}/onay` | `/degerlendirmeler/{id}?onay=tamam` |

Genel `401` işleyişi ve uç-noktaya özgü kimlik mesajları değiştirilmedi.

> **Bu sırada düzeltilen bir test yanlışı.** Önceki pakette yazdığım
> *"the JSON evaluation endpoint is held to the same rule"* testi, backend'de **var olmayan**
> bir sözleşmeyi doğruluyordu: `routers/api.py::_require_user` anonim çağrıya `401` verir,
> asla yönlendirme yapmaz. Test, tahminî bir yönlendirme yerine gerçek `401` davranışını
> doğrulayacak biçimde düzeltildi. Dedektörü genişletmek yanlış olurdu.

## GREEN

```
$ pnpm vitest run src/test/write-truth.test.tsx → Tests 35 passed (35)
$ pnpm lint            → ✖ 1 problem (0 errors, 1 warning)
$ pnpm typecheck       → çıktı yok
$ pnpm test            → Test Files 15 passed · Tests 351 passed
$ pnpm test:coverage   → 91.59 / 82.93 / 88.03 / 93.07
$ pnpm build           → 8 dosya = 1 HTML + 1 CSS + 6 JS; 0 map, 0 mock
$ pnpm storybook:build → completed, 0 adet .map
$ pnpm e2e             → 34 passed
```

Backend: mimari muhafız yeşil, `pytest` **334 passed / 68 skipped**, `ruff` temiz,
`ruff format --check` 76 dosya, `mypy` 71 kaynak dosyası, `git diff --check` temiz.

## Sayı kayması (P3)

Raporun düzeltme tablosundaki **328** değeri, o dönemin ölçümüydü ve tarihsel kayıt olarak
kalır; ancak güncel durum sanılabildiği için artık açıkça etiketlendi. Paketin **şu anki**
toplamı her yerde **351**'dir. Her dalganın kendi GREEN bloğu, o dalgada ölçülen sayıyı
taşımaya devam eder — geçmişi geriye dönük yeniden yazmak, raporun tuttuğu kaydın değerini
ortadan kaldırırdı.
