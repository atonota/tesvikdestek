# DestekTeşvik MVP — Uzlaşı Geliştirme Raporu (Claude + Codex MASTER)

**Tarih:** 2026-08-14
**Base SHA:** `2ad7561e6fa33eb384c8ce62402f9ac18dd2152d`
**Change package:** `destektesvik-mvp-fastapi-v1`
**Girdiler:** [Claude gap analizi](./2026-08-14-claude-gap-analysis.md) ·
[Codex unknown-unknowns](./2026-08-14-codex-unknown-unknowns.md) ·
[ADR-0001](../architecture/ADR-0001-mvp-modular-monolith.md)

> **En önemli cümle, en başta:** bu paketin sonunda ortaya çıkan şey bir **teknik MVP**'dir.
> **Teknik MVP satışa hazır ürün değildir.** Governance gate'lerin GREEN olması ürün
> hazırlığı değildir ve hiçbir yerde öyle sunulmaz. Satışa hazırlık için gereken şey kod
> değil, **10-15 uzman-doğrulanmış program verisi**dir (unknown-unknowns #20).

---

## 1. Owner özeti — beş alan

### `once` (paketten önce)

Depoda tek bir tarayıcı dosyası vardı: `index.html`, 1.59 MB, 6.945 satır, ECharts kütüphanesi
minified olarak içine gömülü. `sayfalari-uret.mjs` bu dosyanın **tam kopyasını** 16 alt sayfaya
çoğaltıyordu; yani aynı 1.6 MB depoda 17 kez duruyordu. Sunucu yoktu, veritabanı yoktu, kullanıcı
hesabı yoktu, test yoktu, CI yoktu. Tüm durum tarayıcının `localStorage`'ında tek bir anahtarda
yaşıyordu. "Karar günlüğü" adı verilen şey kırpılıyor ve kullanıcı tarafından silinebiliyordu.
Gerçek AI çağrısı sıfırdı; kullanıcı bağlam paketini elle kopyalayıp ChatGPT'ye yapıştırıyordu.

### `simdi` (paketten sonra)

Depoda, eski prototipin **yanında** ve ona hiç dokunmadan, çalışan bir sunucu uygulaması var:
`platform/`. Python 3.13, FastAPI delivery adapter, PostgreSQL tek gerçeklik kaynağı, Jinja2 ile
sunucu tarafında render edilen Türkçe arayüz. Kullanıcı kaydolabiliyor, giriş yapabiliyor, şirket
profilini doldurabiliyor, üç resmî kaynaklı program için deterministik değerlendirme
çalıştırabiliyor, her sonucun hangi kural sürümüne ve hangi kaynak yakalamasına dayandığını
görebiliyor, kararı kendi adına onaylayabiliyor. Onay, veritabanı seviyesinde
**değiştirilemez** bir kayda yazılıyor. İkinci bir kiracının verisine erişim hem uygulama
katmanında hem PostgreSQL RLS ile engellenmiş durumda.

### `fark`

Ürün, "tek kullanıcının tarayıcısında yaşayan bir hesap makinesi" olmaktan çıkıp **çok kiracılı,
sürümlü, denetlenebilir bir sunucu uygulamasına** dönüştü. En büyük üç fark:

1. **Kararın gerekçesi artık kalıcı ve sürümlü.** Eskiden "şu tarihte doğrulandı" diyen tek bir
   global sabit vardı. Şimdi her karar, hangi kural kümesi sürümüyle ve hangi kaynak
   yakalamasıyla (URL + yakalama tarihi + içerik hash'i) üretildiğini taşıyor.
2. **Eksik veri artık "uygun değil" demek değil.** Dört değerli sonuç (`candidate_eligible`,
   `ineligible`, `conditional`, `insufficient_data`) sayesinde sistem bilmediğini bildiğini
   söylemiyor.
3. **AI artık yetkisiz.** Kapalıyken deterministik motor tam çalışıyor; açıkken bile uygunluğu,
   tutarı veya aşamayı değiştiremiyor — deneyen çıktı **tamamen** reddediliyor ve reddin kendisi
   audit'e yazılıyor.

### `kullaniciYolculugu` (somut, çalışan)

Bir KOBİ yetkilisi — diyelim Ankara'da 2 yıllık, 8 kişilik bir yazılım şirketinin sahibi —
siteye giriyor:

1. **Kayıt.** E-posta + parola ile hesap açıyor. Bu işlem aynı anda hem bir *organizasyon
   (tenant)* hem bir *kullanıcı* yaratıyor. Parola Argon2 ile saklanıyor.
2. **Giriş.** Sunucu ona httpOnly bir oturum çerezi veriyor. Tarayıcının JavaScript'i bu çereze
   erişemiyor.
3. **Profil.** Şirket profilini dolduruyor: NACE kodu `62.01`, kuruluş yılı, personel sayısı 8,
   ciro, bölge, KOBİ beyanı, sermaye şirketi mi.
4. **Değerlendirme.** "Değerlendir" diyor. Sunucu üç program için deterministik motoru
   çalıştırıyor — AI'a hiç gitmeden.
5. **Sonuçları görüyor.** KOSGEB Girişimci: **aday uygunluk** (0-3 yaş içinde, NACE 62 listede).
   TÜBİTAK 1507: **koşullu** — çünkü çağrı penceresi kaynakta yayınlanmamış; sistem "açık"
   diye tahmin etmiyor. TÜBİTAK 1501: **yetersiz veri** — bir olgu eksik ve sistem hangi olgunun
   eksik olduğunu adıyla söylüyor.
6. **Gerekçeyi açıyor.** Her sonucun altında: hangi koşul sağlandı, hangisi sağlanmadı
   (predicate trace), resmî kaynak linki, kaynağın yakalanma tarihi ve içerik hash'inin kısa
   hâli, kural sürümü, eksik veri/belge listesi ve bağlayıcı olmadığına dair uyarı.
7. **Onay.** "Bu değerlendirmeyi kendi kaydım için onaylıyorum" diyor. Ekranda bu tam olarak
   **"Kullanıcı onayı"** diye etiketli — hiçbir yerde "onaylandı" veya "resmen kabul edildi"
   yazmıyor.
8. **Kayıt.** Onay, karar kaydının **üstüne yazmıyor**; yeni bir olay olarak ekleniyor. Kim,
   ne zaman, hangi kararı onayladı — hepsi audit'te.
9. **İzolasyon.** Aynı anda başka bir şirketin yetkilisi kendi hesabına giriyor ve bu kullanıcının
   hiçbir verisini göremiyor. Bu, testle *iki katmanda* kanıtlanmış durumda.

**Ne yapamıyor:** Resmî kuruma başvuru gönderemiyor. Alacağı parayı hesaplayamıyor. Üç program
dışına çıkamıyor. Belge yükleyemiyor. Yeni bir çağrı açıldığında haber alamıyor.

### `kalanEngel`

| Engel | Sınıf | Kim çözer |
|---|---|---|
| 10-15 uzman-doğrulanmış program verisi | **Satış blocker** | Owner + alan uzmanı |
| ICP ve fiyat doğrulaması | **Satış blocker** | Owner |
| KVKK: veri sorumlusu/işleyen sıfatı, aydınlatma, retention | **Hukuki blocker** | Owner + hukuk |
| E-posta doğrulama, rate limit, parola sıfırlama | Production gate | Sonraki paket |
| Backup/restore, TLS, secret manager, observability, SLO, DR | Production gate | Sonraki paket |
| Dual-host (AMD + Intel) aynı digest smoke | **Environment gate — UNVERIFIED** | Owner (host sağlar) |
| Yerel Docker buildx/compose smoke | **Environment gate — UNVERIFIED** | Docker daemon kapalıydı |
| Gerçek AI sağlayıcı çağrısı | Yetki gate | Owner (maliyet + secret) |
| Başvuru yaşam döngüsü, belge/OCR, bildirim | P1 kapsam | Sonraki paketler |

### `capability_delta`

**Bu change package'ın `capability_delta` değeri: NEW_SERVER_APPLICATION.**

Depo, sunucu tarafı çalışan bir uygulamaya, kalıcı veritabanına, kimlik/kiracı izolasyonuna,
değiştirilemez karar kaydına, test paketine ve CI'ya **ilk kez** sahip oldu.

> **Not:** [Gap analizi raporunun](./2026-08-14-claude-gap-analysis.md) kendi
> `capability_delta` değeri **NONE**'dır ve öyle korunmuştur — o oturum read-only'di. Bu iki
> değer birbirinin yerine geçmez.

---

## 2. MVP kapsamı — dahil ve hariç

### Açıkça dahil

1. Kayıt/giriş; tek organizasyon = tek tenant; Argon2 parola; httpOnly oturum çerezi; CSRF.
2. Şirket profili (dijital ikizin v0'ı): NACE, kuruluş yılı, personel, ciro, bölge, KOBİ beyanı,
   sermaye şirketi beyanı.
3. **Veri olarak** tanımlanmış, sürümlü kural kümesi. Safe allowlist DSL — `eval`/`exec` yok.
4. Kaynak snapshot modeli: `url`, `captured_at`, `content_hash`, `effective_from`/`to` (nullable),
   `reviewed_at`, `review_status`, `citation`.
5. Deterministik değerlendirme: dört değerli sonuç + predicate trace + eksik olgu listesi.
6. Kanonik JSON + SHA-256 `input_hash` / `decision_hash`; para `Decimal` (float yasak).
7. Değiştirilemez karar + onay + audit; `UPDATE`/`DELETE` **DB seviyesinde** reddedilir.
8. Uygulama guard'ları + PostgreSQL RLS (FORCE) ile kiracı izolasyonu.
9. AI port: varsayılan kapalı, strict şema, citation allowlist, prompt injection savunması,
   fake test provider, opsiyonel OpenAI-uyumlu HTTP adapter.
10. Türkçe SSR arayüz: semantic HTML, klavye erişilebilir, 320px ve masaüstü, harici CDN yok.
11. RED→GREEN test paketi + GitHub Actions CI + linux/amd64 Docker build + container smoke.

### Açıkça hariç (ve nedeni)

| Hariç | Neden |
|---|---|
| Next.js, Django, MetaFramer | Sabit yasak (ADR-0001). |
| React | Yasak değil; **bu MVP'nin tek yolculuğu SPA gerektirmiyor**. Ölçülebilir bir etkileşim ihtiyacı çıkarsa izole ada olarak eklenir. |
| Graph DB, pgvector/vektör DB, Elasticsearch | Çözecek ölçülmüş bir problem yok; PostgreSQL yeterli. |
| Redis, Celery, Kafka, Temporal, Kubernetes, microservice | Tek ürün, tek veritabanı, tek süreç. Modüler monolit yeterli. |
| Plugin SDK / market, MCP server, multi-agent | İkinci gerçek tüketici çıkmadan yanlış tasarlanır. |
| De-minimis kümülasyon hesabı | Tek işletme (bağlı grup) modeli olmadan yanlış sonuç verir (#3). |
| Hak edilmiş/senaryo tutarı hesabı | Yayınlanmış tavan ≠ alacağın para (#5). |
| Resmî kuruma otomatik gönderim | Geri alınamaz, hukuki sonuçlu (#10). |
| Otomatik crawler | Kaynak yapısı değişince sessizce yanlış veri üretir (#11). |
| 50 programın tamamı, prototip skorları/ağırlıkları | Kalibre edilmemiş sayı, tavsiye gibi görünür — itibarı en hızlı yok eden şey. |
| Billing, marketplace, çok rollü hiyerarşi | ICP doğrulanmadı (#1). |

---

## 3. Kabul kriterleri (acceptance)

Paket ancak aşağıdakilerin tamamı sağlandığında GREEN sayılır:

| # | Kriter | Nasıl ölçülür |
|---|---|---|
| A1 | Aynı girdi/kural/kaynak → aynı `decision_hash`; sürüm değişince yeni hash, eski karar değişmez | Unit test |
| A2 | Eksik olgu → `insufficient_data`/`conditional`; boolean overclaim yok | Unit test |
| A3 | Kaynak snapshot/citation yoksa değerlendirme **fail-closed** | Unit test |
| A4 | Bilinmeyen çağrı penceresi → tahmini OPEN değil, `conditional` | Unit test |
| A5 | Para `Decimal`; tavan asla awarded/paid/calculated olarak raporlanmaz | Unit test |
| A6 | Aynı gider iki programa yazılırsa çift finansman çakışması raporlanır | Unit test |
| A7 | Tenant A, B'yi ne API'den ne doğrudan DB rolüyle okuyabilir/yazabilir | API yarısı: integration test (GREEN). DB yarısı (RLS, en az yetki): **UNVERIFIED** — yazıldı, yerelde PostgreSQL olmadığı için çalıştırılmadı, CI'da atlama da başarısızlık da build'i düşürür |
| A8 | Kimliksiz domain route reddedilir; CSRF'siz POST reddedilir | Integration test |
| A9 | Karar/audit `UPDATE`/`DELETE` DB'de reddedilir; onay append-only, actor+zaman ile | Integration test |
| A10 | Geçersiz/fazladan/mutasyon deneyen AI çıktısı **tamamen** reddedilir; sağlayıcı yokken deterministik sonuç tam üretilir; injection ve citation allowlist korunur | Unit test |
| A11 | Domain paketi FastAPI/Starlette/SQLAlchemy import etmez | AST architecture test |
| A12 | OpenAPI smoke + tam tarayıcı yolculuğu (kayıt→giriş→profil→değerlendir→onayla) | Integration test |
| A13 | Health/readiness; boş DB'de migration; seed idempotent | Integration test |
| A14 | Eski prototip dosyalarının hash'leri değişmemiş | Guard test |
| A15 | linux/amd64 Docker build + container health smoke | CI (yerelde UNVERIFIED) |

Gerçek RED çıktısı ve GREEN komutları:
[implementation-evidence](./2026-08-14-implementation-evidence.md).

---

## 4. Faz yol haritası

| Faz | İçerik | Statü |
|---|---|---|
| **F1** | Deterministik çekirdek + kaynak snapshot + kimlik/kiracı/RLS + audit + FastAPI + SSR + AI port + CI/container | **bu paket** |
| F2 | Data-pack: 10-15 uzman-doğrulanmış program; kaynak yenileme arayüzü | Sonraki |
| F3 | Production gate'leri: e-posta doğrulama, rate limit, parola sıfırlama, backup/restore, TLS, secret manager, observability | Sonraki |
| F4 | Başvuru yaşam döngüsü (`Opportunity`, `Application`), belge kontrol listesi, takvim | P1 |
| F5 | Gerçek AI sağlayıcı çağrısı (owner yetkisiyle), kaynaklı açıklama üretimi | P1, yetki gate |
| F6 | Aktif keşif: kaynak yenileme + değişiklik diff'i + bildirim | P1 |
| F7 | Senaryo/planlama katmanı, destek tipi başına hesap semantiği | P1 |
| F8 | Ülke paketleri, taksonomi motoru, öğrenme katmanı | P2 — bu pakette kod olarak **yok** |

---

## 5. Rollback

Bu paketin tamamı `platform/`, `docs/`, `.github/`, `README.md` ve `.gitignore`'a eklenen
satırlardan ibarettir. Eski prototip (`index.html`, `destekteşvik.html`, `sayfalari-uret.mjs`,
16 route klasörü, `AGENTS.md`, `MOBILE-FIRST-UYUMSUZLUK-RAPORU.md`) **hiç değiştirilmedi** ve
bu, test 14 ile hash seviyesinde kanıtlanıyor.

**Rollback yolu:** bu change package'ın dosyalarının kaldırılması. Sonuç, değişmemiş statik
prototipin tek başına kalmasıdır. Rollback kararı ve yürütmesi **Codex MASTER**'ındır; bu
oturumda hiçbir destructive komut çalıştırılmadı.

---

## 6. Dürüstlük notları

- Governance gate'lerin GREEN olması **ürün hazırlığı değildir**.
- CI'nın GREEN olması **dual-vendor kanıtı değildir** (#17).
- Bu pakette **hiçbir commit, push, PR, merge, deploy, release veya version bump yapılmadı**.
- Prototipteki `ACIK_DOGRULAMA` dürüstlüğü — bilinmeyeni bilinmeyen olarak yazmak — bu paketin
  `insufficient_data` ve `conditional` sonuçlarında korunmuştur.
