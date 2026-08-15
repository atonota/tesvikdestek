# DestekTeşvik

Türkiye'deki destek ve teşvik programları için **deterministik ön değerlendirme**.
Bir KOBİ yetkilisi şirket profilini girer; sistem, resmî kaynaklardan derlenmiş ve
sürümlenmiş kurallarla her program için bir sonuç üretir ve **o sonucun hangi kural
sürümüne, hangi kaynak yakalamasına dayandığını** gösterir.

> **Bu bir teknik MVP'dir. Satışa hazır bir ürün değildir.**
> Motorun doğru çalışması ile ürünün doğru cevap vermesi farklı şeylerdir. Satılabilirlik için
> gereken şey kod değil, **10-15 uzman-doğrulanmış program verisidir**. Bugün depoda 3 program
> vardır ve hiçbiri alan uzmanı tarafından doğrulanmamıştır.

---

## Depoda ne var

| Yol | Ne |
|---|---|
| `platform/` | Çalışan sunucu uygulaması (Python 3.13, FastAPI, PostgreSQL, Jinja2) |
| `docs/reports/` | Gap analizi, unknown-unknowns kaydı, uzlaşı raporu, RED→GREEN kanıtı |
| `docs/architecture/` | ADR-0001: modüler monolit kararı |
| `docs/runbooks/` | Hetzner dual-host kabul runbook'u |
| `.github/workflows/ci.yml` | Lint, tip, test, RLS, linux/amd64 build + container smoke |
| `index.html` ve 16 route klasörü | **Eski statik prototip — bu pakette hiç değiştirilmedi** |

Eski prototipin değişmediği, `platform/tests/architecture/test_legacy_prototype_unchanged.py`
içinde SHA-256 seviyesinde test edilir.

---

## Sonuç türleri — dört değerli, boolean değil

| Sonuç | Anlamı |
|---|---|
| `candidate_eligible` — **Aday uygunluk** | Koşullar, elimizdeki veriyle sağlanıyor görünüyor. |
| `conditional` — **Koşullu** | Bir şey bilinmiyor; örneğin çağrı penceresi yayınlanmamış. |
| `insufficient_data` — **Yetersiz veri** | Profilde eksik olgu var; hangisi olduğu adıyla listelenir. |
| `ineligible` — **Uygun değil** | Bir koşul açıkça sağlanmıyor. |

**"Resmen onaylandı" diye bir sonuç yoktur.** Kullanıcının verdiği onay, arayüzde tam olarak
**"Kullanıcı onayı"** diye etiketlenir ve hiçbir kuruma iletilmez.

---

## Sistemin yapmadıkları (kasıtlı)

- Resmî kuruma **başvuru göndermez** — hazırlık, kontrol listesi ve insan onayı üretir.
- **Hak edilmiş tutar hesaplamaz.** Yayınlanmış tavan ile alacağınız para farklı şeylerdir.
- **De-minimis kümülasyonu hesaplamaz** — bağlı şirket topluluğu modeli olmadan yanlış olurdu.
- **Otomatik kaynak taraması yapmaz** — kaynaklar elle derlenir, tarih ve içerik özetiyle.
- **Bilinmeyen tarihi tahmin etmez.** Bilinmiyorsa `NULL` kalır ve sonuç koşullu olur.
- **Yapay zekâ karar veremez.** Kapalıyken motor tam çalışır; açıkken bile uygunluğu, tutarı,
  aşamayı veya onayı değiştiremez.

> **Yapay zekâ katmanının bu paketteki gerçek durumu:** AI açıklama portu ve çıktı muhafızı
> yazılmış ve test edilmiştir (`application/ai.py`, `adapters/ai/`), ancak bu teknik
> MVP'de **hiçbir kullanıcı arayüzü veya API ucu bu portu çağırmaz**. Yani bugün üründe
> görünen bir AI özelliği **yoktur**; yalnızca ileride açılacak kapının kilidi ve alarmı
> hazırdır. Varsayılan sağlayıcı `disabled`'dır ve gerçek bir AI çağrısı bu pakette
> **hiç yapılmamıştır** (dış maliyet ve secret yetkisi verilmemiştir).

---

## Hızlı başlangıç (geliştirme)

Gereken: Python 3.13 ve [uv](https://docs.astral.sh/uv/). PostgreSQL ve Docker **zorunlu değil** —
test paketinin uygulama katmanı SQLite üzerinde host Python'unda çalışır.

```bash
cd platform
uv sync --frozen
uv run --frozen pytest            # 260 test geçer + PostgreSQL'e bağlı 29 test atlanır
uv run --frozen ruff check .
uv run --frozen mypy
```

### PostgreSQL ile tam doğrulama

RLS, append-only trigger'lar ve migration'lar yalnız gerçek PostgreSQL'de doğrulanır — SQLite
üzerinde taklit edilmez, çünkü yeşil bir SQLite koşusu tam da en kritik özellik hakkında sahte
güven verirdi.

```bash
export DESTEKTESVIK_TEST_DATABASE_URL='postgresql+psycopg://owner:...@localhost:5432/destektesvik'
export DESTEKTESVIK_TEST_APP_DATABASE_URL='postgresql+psycopg://app:...@localhost:5432/destektesvik'
uv run --frozen pytest tests/integration
```

Uygulama rolü **superuser veya BYPASSRLS olmamalıdır**; aksi hâlde RLS testleri hiçbir şey
kanıtlamadan geçer.

### Compose ile çalıştırma

```bash
cd platform
cp .env.example .env          # her değeri değiştirin
docker compose --profile migrate up migrate   # şema + seed
docker compose up -d web
open http://127.0.0.1:8000/
```

PostgreSQL kasıtlı olarak host'a **publish edilmez**. İki ayrı DB rolü kullanılır: şemayı
`destektesvik_owner` yönetir, uygulama `destektesvik_app` ile bağlanır.

---

## Mimari, tek bakışta

```
delivery/     FastAPI router'ları, Jinja2 şablonları, oturum ve CSRF
   ↓
application/  use-case servisleri, portlar (Protocol), AI çıktı muhafızı
   ↓
domain/       saf Python: kural DSL'i, değerlendirme motoru, para, kaynaklar

adapters/     SQLAlchemy repository'leri, AI sağlayıcıları, katalog yükleyici
```

`domain` paketi FastAPI, Starlette, SQLAlchemy, Pydantic veya herhangi bir framework'ü
**import edemez**; bu bir AST testiyle zorlanır. Ayrıntı ve reddedilen alternatifler:
[ADR-0001](docs/architecture/ADR-0001-mvp-modular-monolith.md).

---

## Güvenlik ve denetlenebilirlik

- **Kiracı izolasyonu iki katmanlı:** kiracıya ait repository sorgularının hepsinde uygulama
  seviyesinde açık `tenant_id` filtresi **ve** PostgreSQL `FORCE ROW LEVEL SECURITY`. İkisi de
  ayrı ayrı test edilir.
- **Kimlik doğrulamadan önceki üç an istisnadır ve tam olarak tarif edilir:** kayıt, giriş ve
  oturum çözümleme sırasında henüz bir kiracı yoktur. Bu anlarda politika **tek bir satır**
  açar: `users` için yalnız `app.lookup_email` ile *birebir eşleşen* e-posta, `user_sessions`
  için yalnız `app.lookup_session_fingerprint` ile *birebir eşleşen* jeton parmak izi. Her iki
  politikanın `WITH CHECK`'i kiracıya bağlı kalır — okuma penceresi asla yazma yetkisi vermez.
  `tenants`, `company_profiles`, `decisions`, `approvals` ve `audit_events` tablolarında
  hiçbir kimlik-öncesi istisna yoktur. Bu ayarlar `set_config(..., true)` ile **işlem
  yereldir**; havuzdaki bağlantı bir isteğin kimliğini bir sonrakine taşıyamaz.
- **Append-only, veritabanı seviyesinde:** `decisions`, `approvals` ve `audit_events`
  üzerinde `UPDATE`/`DELETE` bir trigger tarafından reddedilir. Düzeltme yeni bir satırdır.
- **Oturum:** Argon2 parola, opak sunucu oturumu, httpOnly çerez, sunucu tarafında iptal.
  `localStorage`'da JWT **yoktur**. Bilinmeyen e-posta da gerçek bir Argon2 doğrulaması
  çalıştırır (sabit bir kukla hash'e karşı), böylece yanıt süresi "bu hesap var mı?" sorusunu
  cevaplamaz. Bu, hashing maliyetini eşitler; uçtan uca sabit-zaman garantisi değildir.
- **CSRF:** durum değiştiren tüm form'larda double-submit token; JSON API'nin yazma ucunda
  (`POST /api/degerlendir`) imzalı `X-CSRF-Token` başlığı zorunludur ve `GET /api/csrf` ile
  alınır. Yalnız `SameSite`'a güvenilmez.
- **Üretimde fail-closed yapılandırma:** `development` dışında varsayılan imzalama secret'ı,
  güvensiz oturum çerezi veya `change-me` veritabanı URL'i ile uygulama **açılmaz**. Guard
  yalnızca reddeder; secret üretmez, TLS kurmaz.
- **Log ve audit:** parola, oturum jetonu veya ticari sır değeri (ciro, personel) yazılmaz;
  audit yalnız olgu *adlarını* taşır.

### Tehdit modeli — RLS'in ne olduğu ve ne olmadığı

Bunu açıkça yazmak gerekir, çünkü "PostgreSQL RLS var" cümlesi kolayca hak edilmemiş bir
güvence gibi okunur.

**İlk katman uygulamadır.** Kiracıya ait her repository sorgusu parametreli SQLAlchemy ile
yazılır ve açık bir `tenant_id` yüklemi taşır. Asıl doğruluk buradadır.

**RLS ikinci katmandır ve kendi hatamıza karşıdır.** Unutulmuş veya yanlış yazılmış bir
`tenant_id` yüklemi, sessiz bir veri sızıntısı yerine boş sonuç kümesine dönüşür. Koruduğu şey
budur: *bizim* hatamız.

**Koruma sınırı buraya kadardır.** Kiracı kapsamı, uygulama rolünün kendi ayarladığı bir
transaction-local GUC'tur (`app.current_tenant`). Uygulama rolü bu GUC'u kendisi
ayarlayabildiği için, o rol adına **rasgele SQL çalıştırabilen** biri kapsamı da kendisi
değiştirebilir. Dolayısıyla RLS şunlara karşı bir sınır **değildir**:

- **SQL injection** — parametreli sorgular ve girdi doğrulaması ilk ve gerçek savunmadır;
- **uygulama sürecinin ele geçirilmesi** (RCE, kötü niyetli bağımlılık, zararlı kod);
- **çalınmış veritabanı kimlik bilgileri** — uygulama rolüyle doğrudan bağlanan biri.

Bu üçü **üretimde açık bir güvenlik sınırıdır** ve bu paket onları kapatmaz. Kapanmamış kapılar
listesindeki rate limit, secret yönetimi ve observability tam da bu yüzden orada duruyor.

Ayrıca: PostgreSQL testleri (RLS, en az yetki, append-only trigger'lar) bu makinede
**çalıştırılmamıştır** — PostgreSQL yok. Yazılmış, gerekçeli biçimde atlanmış ve CI'da
atlanmaları da başarısızlıkları da build'i düşürecek şekilde bağlanmıştır.

### Veritabanı yetkileri — en az yetki

Uygulama rolü `NOSUPERUSER` ve `NOBYPASSRLS`'tir, **ve** tablo bazında yalnız gerçekten
kullandığı fiilleri alır: katalog tablolarında (`source_snapshots`, `program_versions`,
`rule_set_versions`, `schema_flags`) yalnız `SELECT`; append-only tablolarda `SELECT, INSERT`;
hiçbir tabloda `DELETE` yok; `alembic_version` üzerinde hiçbir yetki yok. Blanket
`GRANT ... ON ALL TABLES` ve `ALTER DEFAULT PRIVILEGES` **kaldırılmıştır**: gelecekte eklenen
bir tablo, bir migration açıkça yetki vermedikçe uygulamaya kapalı gelir.

### Üretim öncesi kapanmamış kapılar

E-posta doğrulama, rate limit, parola sıfırlama, backup/restore, TLS sonlandırma, secret
yönetimi, observability, SLO ve felaket kurtarma **bu pakette yoktur** ve var gibi sunulmaz.

---

## Kaynak dürüstlüğü

`platform/src/destektesvik/data/source_snapshots/` altındaki dosyalar **elle hazırlanmış özet
çıkarımlardır**, canlı sayfa yakalaması değildir. `content_hash`, yükleyici tarafından bu
dosyaların baytlarından hesaplanır: yani sistemin üzerinde akıl yürüttüğü metnin kanıtıdır,
resmî sayfanın o gün ne yazdığının değil. Hepsi `pending_review`'dur.

Resmî kaynaklar:
[TÜBİTAK 1501](https://tubitak.gov.tr/tr/destekler/sanayi/ulusal-destek-programlari/1501-tubitak-sanayi-ar-ge-projeleri-destekleme-programi) ·
[TÜBİTAK 1507](https://tubitak.gov.tr/tr/destekler/sanayi/ulusal-destek-programlari/1507-tubitak-kobi-ar-ge-baslangic-destek-programi) ·
[KOSGEB Girişimci](https://kosgeb.gov.tr/site/tr/genel/destekdetay/1231/girisimci-destek-programi) ·
[yatirimadestek.gov.tr](https://www.yatirimadestek.gov.tr/)

---

## CI ve dağıtım

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) lint, tip kontrolü, birim,
mimari ve PostgreSQL entegrasyon testlerini (RLS ve trigger'lar dâhil) çalıştırır, ardından
`linux/amd64` imajı **build eder ve smoke test yapar**.

Container smoke iki ayrı DB rolü kullanır: şemayı `destektesvik_owner` migrate eder, web
konteyneri `destektesvik_app` (NOSUPERUSER, NOBYPASSRLS) ile bağlanır ve script çalışma
anındaki rolün superuser/BYPASSRLS **olmadığını** doğrular. Tek rol kullanmak, RLS hiç
çalışmasa bile smoke'un yeşil olması demekti.

CI **hiçbir imaj push etmez ve hiçbir yere deploy etmez**; hiçbir secret okumaz.

Hedef, genel `linux/amd64` baseline'dır. `-march=native`, AVX-512 zorunluluğu veya
vendor-spesifik bayrak yoktur; ISA `x86-64-v2`'ye daraltılmaz. Aynı imaj digest'inin bir AMD ve
bir Intel Hetzner hostunda aynı `decision_hash`'i üretmesi ayrı bir kabul adımıdır ve şu an
**UNVERIFIED ENVIRONMENT GATE**'tir:
[dual-host runbook](docs/runbooks/hetzner-dual-host-acceptance.md).

---

## Belgeler

- [Gap analizi](docs/reports/2026-08-14-claude-gap-analysis.md) — prototipin bağımsız incelemesi
- [Unknown-unknowns](docs/reports/2026-08-14-codex-unknown-unknowns.md) — kapsamı belirleyen 20 karar
- [Uzlaşı raporu](docs/reports/2026-08-14-consensus-mvp-development-report.md) — önce/şimdi/fark, yol haritası
- [ADR-0001](docs/architecture/ADR-0001-mvp-modular-monolith.md) — mimari karar ve reddedilenler
- [Uygulama kanıtı](docs/reports/2026-08-14-implementation-evidence.md) — gerçek RED→GREEN çıktıları

---

## Sorumluluk sınırı

Bu uygulama hukuki veya mali danışmanlık hizmeti vermez. Ürettiği sonuçlar **bağlayıcı
değildir** ve resmî kurum kararı yerine geçmez. Güncel ve bağlayıcı bilgi için ilgili kurumun
resmî kaynağı esas alınmalıdır.
