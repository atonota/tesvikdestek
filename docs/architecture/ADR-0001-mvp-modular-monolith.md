# ADR-0001 — MVP: Modüler Monolit, FastAPI Delivery Adapter, PostgreSQL Tek Gerçeklik Kaynağı

- **Statü:** Kabul edildi
- **Tarih:** 2026-08-14
- **Karar mercii:** Codex Desktop MASTER
- **Yazan (worker):** Claude — `destektesvik-mvp-fastapi-v1`
- **Base SHA:** `2ad7561e6fa33eb384c8ce62402f9ac18dd2152d`
- **İlgili:** [gap analizi](../reports/2026-08-14-claude-gap-analysis.md) ·
  [unknown-unknowns](../reports/2026-08-14-codex-unknown-unknowns.md) ·
  [konsensüs raporu](../reports/2026-08-14-consensus-mvp-development-report.md)

---

## Context

Depoda bugün çalışan tek şey, sunucusuz ve tek kullanıcılı bir statik prototip: `index.html`
(1.59 MB, ECharts gömülü), 16 route klasöründe aynı dosyanın tam kopyası, tüm durum tek bir
`localStorage` anahtarında. Kimlik yok, kiracı yok, kalıcılık yok, test yok, CI yok, gerçek AI
çağrısı yok.

Ürün, para hakkında konuşuyor. Bu üç sonuç doğuruyor:

1. **Yanlış tarihli mevzuat bilgisi doğrudan parasal zarardır.** Kaynak tazeliği bir konfor
   özelliği değil, ürünün hukuki temelidir.
2. **Bir karar, hangi kuralla ve hangi kaynakla verildiğini kanıtlayamıyorsa savunulamaz.**
   Denetlenebilirlik sonradan eklenebilecek bir katman değildir.
3. **Çok kiracılı finansal veride tek katmanlı izolasyon yetmez.**

Buna karşılık, vizyon dökümanları "sürekli çalışan, öğrenen, çok ajanlı sermaye işletim
sistemi" tarif ediyor. Bu vizyonun bugünkü repo karşılığı sıfırdır. Karar problemi şudur:
**vizyonun hangi parçası ilk pakete girer, hangisi kasıtlı olarak reddedilir.**

Sabit, tartışmaya kapalı kısıtlar: MetaFramer yasak; Next.js yasak (alternatif olarak dahi
anılmaz); Django yasak. React serbest ama bu MVP'de kullanılmayacak.

---

## Decision

### D1 — Modüler monolit, dört katman

Tek süreç, tek veritabanı, tek deployable. İçeride dört katman:

```
domain/       saf Python. Framework yok, ORM yok, I/O yok.
application/  use-case servisleri + port (Protocol) tanımları.
adapters/     SQLAlchemy repository'leri, AI provider'ları, saat/hash yardımcıları.
delivery/     FastAPI router'ları, Jinja2 şablonları, auth/CSRF middleware'i.
```

Bağımlılık yönü **tek yönlüdür**: `delivery → application → domain`, `adapters → application`.
`domain` hiçbir şeye bağımlı değildir.

### D2 — FastAPI **delivery adapter**'dır, çekirdek değildir

FastAPI yalnız HTTP sınırıdır: Pydantic şeması ↔ domain nesnesi çevirisi, dependency injection,
OpenAPI üretimi. **İş kuralı router'da yaşamaz.** Bu, bir AST architecture testiyle zorlanır:
`domain` paketindeki hiçbir modül `fastapi`, `starlette`, `sqlalchemy`, `pydantic` veya
`psycopg` import edemez.

### D3 — PostgreSQL tek gerçeklik kaynağı

Varlıklar, kural sürümleri, kaynak snapshot'ları, kararlar ve audit tek yerde. Dinamik yapı
JSONB ile taşınır, kontrolsüz tablo üretimiyle değil.

### D4 — Kurallar koddan veriye taşınır ve sürümlenir

Kural, `RuleSetVersion` içinde **veri** olarak durur ve safe bir allowlist DSL ile
değerlendirilir: `all` / `any` / `not` + `eq` / `in` / `gte` / `lte` / `prefix`.
**`eval`, `exec` veya dinamik Python yoktur.** Her predicate bir `source_snapshot_id` /
citation taşır; kaynağı olmayan predicate yüklenemez.

### D5 — Dört değerli sonuç ve fail-closed davranış

`candidate_eligible` | `ineligible` | `conditional` | `insufficient_data`. "Resmen onaylandı"
sonucu **yoktur**. Bilinmeyen çağrı penceresi `conditional` üretir, tahmini OPEN üretmez.
Kaynağı olmayan program için karar **üretilmez** (fail-closed).

### D6 — Determinizm: kanonik JSON + SHA-256 + `Decimal`

Girdi ve karar, kanonik JSON'a serialize edilip SHA-256 ile hash'lenir (`input_hash`,
`decision_hash`). `datetime` UTC'ye ve currency `Decimal`'e normalize edilir. **Para için float
yasaktır.** Determinizm ISA'ya, CPU vendor'ına veya derleme bayrağına dayanmaz.

### D7 — İki katmanlı kiracı izolasyonu

Uygulama katmanında zorunlu `tenant_id` guard'ı **ve** PostgreSQL RLS (`FORCE ROW LEVEL
SECURITY`). Uygulama DB rolü superuser veya `BYPASSRLS` **değildir**; migration/admin rolü
ayrıdır. İki katman da ayrı ayrı testle kanıtlanır.

**Kapsam (dürüstlük notu).** RLS'in koruduğu şey, *bizim* unutulmuş veya yanlış yazılmış
`tenant_id` yüklemimizdir. Kiracı kapsamı uygulama rolünün kendi ayarladığı transaction-local
bir GUC olduğundan, o rol adına rasgele SQL çalıştırabilen biri kapsamı da değiştirebilir.
Dolayısıyla RLS; **SQL injection**, uygulama sürecinin ele geçirilmesi ve çalınmış DB kimlik
bilgileri karşısında bir sınır değildir — bunlar üretimde açık güvenlik sınırlarıdır ve ilk
savunma parametreli sorgular ile uygulama guard'larıdır. Ayrıca uygulama rolü tablo bazında
en az yetkiye indirilmiştir (katalogda yalnız `SELECT`, hiçbir yerde `DELETE` yok,
`alembic_version` üzerinde yetki yok), böylece o rolü ele geçiren biri bile kararın dayandığı
kanıtı yeniden yazamaz.

### D8 — Append-only, veritabanı seviyesinde

`Decision` ve `AuditEvent` üzerinde `UPDATE`/`DELETE` **DB trigger'ı** ile reddedilir. Onay,
kararın mutasyonu değil, yeni bir satırdır. Uygulama katmanına güvenilmez.

### D9 — SSR (Jinja2), React yok

Sunucu tarafında render edilen Türkçe HTML, semantic markup, az miktarda vanilla JS, **harici
CDN varlığı yok**. React yasak olduğu için değil, **bu MVP'nin tek yolculuğu SPA
gerektirmediği** için kullanılmıyor. Ölçülebilir bir etkileşim ihtiyacı çıkarsa izole bir ada
olarak eklenebilir.

### D10 — AI: yetkisiz, kapalı-varsayılan, port arkasında

AI bir **application port**'udur (Protocol). Varsayılan sağlayıcı `disabled`. Çıktı strict
Pydantic (`extra="forbid"`): `summary`, `missing_documents`, `citations` (yalnız allowlist'teki
snapshot id'leri). Uygunluk, tutar, aşama veya onay alanını değiştirmeye çalışan çıktı
**tamamen** reddedilir ve reddin kendisi audit'e yazılır. Kaynak metni prompt'ta delimited
untrusted data'dır. Testler fake provider ile çalışır; gerçek network çağrısı GREEN şartı
değildir.

**Bu paketteki teslim durumu (dürüstlük notu).** Port, muhafız ve sağlayıcı adaptörleri
yazılmış ve test edilmiştir, ancak **hiçbir kullanıcı arayüzü veya API ucu `ExplanationService`'i
çağırmaz**: bu teknik MVP'de AI açıklamasının bir teslim yüzeyi yoktur. Dolayısıyla "AI
açıklaması var" denemez; denebilecek olan, "AI açıldığında karara dokunamayacağı kanıtlanmış
ve testlenmiştir"dir. Gerçek AI çağrısı ertelenmiştir ve varsayılan olarak kapalıdır; dış
maliyet ve secret kullanımı bu pakette yetkilendirilmemiştir. Teslim yüzeyi eklenmesi ayrı
bir change package'tır ve o pakette rate limit, maliyet tavanı ve kullanıcıya gösterim
kuralları birlikte kararlaştırılmalıdır.

### D11 — Genel `linux/amd64` baseline

Tek image, multi-stage `python:3.13-slim`, non-root runtime, exec-form CMD, healthcheck.
`-march=native`, AVX-512 veya vendor-spesifik derleme bayrağı **yoktur**. ISA `x86-64-v2`'ye
**daraltılmaz** (unknown-unknowns #16).

---

## Boundaries

| Sınır | Kural | Nasıl zorlanıyor |
|---|---|---|
| `domain` → framework | Yasak | AST architecture testi |
| `domain` → I/O | Yasak (saat/hash bile port üzerinden) | Kod incelemesi + AST testi |
| `delivery` → repository | Yalnız `application` üzerinden | Katman testi |
| AI → karar | **Mutlak yasak** | Şema + mutasyon reddi testi |
| Karar → mutasyon | **Mutlak yasak** | DB trigger + integration testi |
| Tenant → tenant | **Mutlak yasak** | App guard + RLS, iki ayrı test |
| Eski prototip | Değiştirilemez | Hash guard testi |

---

## Alternatives rejected

| Alternatif | Neden reddedildi |
|---|---|
| **Next.js** | Sabit yasak. Alternatif olarak dahi değerlendirilmedi. |
| **Django** | Sabit yasak. Ayrıca ORM ve admin'i domain'i kendine çekerdi. |
| **MetaFramer** | Sabit yasak. |
| **React SPA** | Tek yolculuk SPA gerektirmiyor; iki dil, iki build, iki test paketi maliyeti karşılıksız. |
| **Mikroservis / Kubernetes** | Tek ürün, tek ekip, tek veritabanı. Operasyon yükü saf maliyet. |
| **Redis / Celery / Kafka / Temporal** | MVP'de saatlerce süren iş akışı veya kuyruk basıncı yok. Gerekirse PostgreSQL `FOR UPDATE SKIP LOCKED` yeter. |
| **Graph DB (Neo4j/AGE)** | 3 programın ilişki grafiği bir foreign key tablosudur. |
| **pgvector / vektör DB / Elasticsearch** | Deterministik motor ve snapshot doğru değilken vektör arama yanlışı hızlandırır. |
| **Event sourcing / CQRS** | Denetim ihtiyacı append-only karar + audit tablosuyla karşılanıyor. |
| **Kuralları Python closure olarak tutmak** (prototipin yaptığı) | Sürümlenemez, test edilemez, kaynağa bağlanamaz, kullanıcıya gösterilemez. |
| **`eval` tabanlı kural DSL'i** | Kaynak metni ve kural verisi dış girdidir; RCE yüzeyi. |
| **Boolean uygunluk** | Eksik veriyi "uygun değil"e çevirir — sessiz ve en tehlikeli hata sınıfı. |
| **Uygulama katmanında append-only** | Bir sonraki `UPDATE` yazan geliştirici tarafından sessizce delinir. |
| **JWT-in-localStorage** | SSR'de XSS'i hesap devralmaya çevirir, revocation'ı imkânsızlaştırır. |
| **Tek katmanlı tenant izolasyonu** | Unutulmuş bir `WHERE` veya `BYPASSRLS` rolü tek başına yeterli değil. |
| **Otomatik crawler** | Kaynak yapısı değişince sessizce yanlış veri üretir; bu üründe parasal zarar. |
| **Prototip skorlarını migrate etmek** | Kalibre edilmemiş ağırlıklar, kullanıcıya kalibre edilmiş tavsiye gibi görünür. |

---

## Consequences

**Olumlu**

- Domain, delivery değişse bile yeniden yazılmaz; FastAPI bir gün çıkarılsa çekirdek durur.
- Her karar `(rule_set_version, source_snapshot_id, input_hash)` ile savunulabilir.
- **Unutulmuş veya yanlış yazılmış bir `tenant_id` yüklemi** kiracı sızıntısına dönüşmez ve
  karar mutasyonu DB seviyesinde reddedilir. Bu, rasgele SQL çalıştırabilen bir saldırgana
  karşı bir bağışıklık iddiası **değildir** (bkz. D7 kapsam notu).
- AI tamamen kapalıyken ürün eksiksiz çalışır; AI bir bağımlılık değil, bir katkıdır.
- Test paketi container'a bağımlı değil; arm64 geliştirme makinesinde doğrudan çalışır.

**Olumsuz / kabul edilen maliyet**

- Kural DSL'i kasıtlı olarak **dar**dır. Prototipin ifade edebildiği bazı kurallar bugün
  ifade edilemez; genişletme bilinçli ve testli olacaktır.
- SSR arayüz, prototipin grafiklerinden ve etkileşiminden **fakirdir**. Bu, doğruluk lehine
  bilinçli bir takas.
- 3 program, prototipin 50'sinden azdır. **15 program yarım doğru olmaktansa 3 program tam
  savunulabilir olsun.**
- İki DB rolü (app + migration) operasyonel kurulumu biraz karmaşıklaştırır.
- Append-only trigger'lar, veri düzeltmesini kasıtlı olarak zorlaştırır — bu bir özelliktir.

**Ölçülmeyen / açık kalan**

- Dual-host (AMD + Intel) aynı digest smoke'u: **UNVERIFIED ENVIRONMENT GATE**.
- Yerel Docker buildx/compose smoke: bu oturumda daemon kapalı, **UNVERIFIED**.
- Gerçek AI sağlayıcı davranışı: yetki gate.

---

## Rollback seam

Tüm yeni yüzey `platform/` + `docs/` + `.github/` + `README.md` içindedir. Eski prototip
dosyalarına dokunulmamıştır ve bu hash guard testiyle kanıtlanır.

**Rollback = bu change package'ın dosyalarının kaldırılması.** Sonuç, değişmemiş statik
prototipin tek başına kalmasıdır. Veri tarafında rollback yolu: Alembic `downgrade` ile
migration'ların geri alınması; şema tamamen yenidir, eski veri yoktur, dolayısıyla veri kaybı
riski yoktur. Rollback kararı ve yürütmesi **Codex MASTER**'ındır.
