# DestekTeşvik — Bağımsız Gap Analizi (read-only)

> **Provenance.** Bu belge, `destektesvik-claude-gap-2026-08-14` worktree'sinde read-only
> olarak yürütülen bağımsız gap analizi oturumunun **tam ve değiştirilmemiş** son raporudur.
> Kaynak: `~/.claude/projects/-Users-karaca-DEV-destektesvik-worktrees-destektesvik-claude-gap-2026-08-14/d7846ee1-adfc-4f7c-864f-1e8850dba9b8.jsonl`
> (satır 109, son uzun assistant text'i). İçerik burada yalnız Markdown dosyasına aktarıldı;
> hiçbir bulgu, sayı, tablo satırı veya `capability_delta: NONE` ifadesi düzenlenmedi.
>
> **O oturumun `capability_delta` değeri NONE'dır ve NONE olarak korunur.** Bu belgeyi içeren
> change package'ın kendi `capability_delta` değeri ayrıdır ve
> [konsensüs raporunda](./2026-08-14-consensus-mvp-development-report.md) verilir.
>
> **Sonradan revize edilen tek teknik detay:** aşağıdaki Hetzner bölümünün 2. kabul kriteri
> ISA baseline'ı `x86-64-v2` olarak daraltır. Codex MASTER bu daraltmayı reddetti; yürürlükteki
> karar **genel `linux/amd64` baseline**'dır. Gerekçe ve karşı kanıt:
> [unknown-unknowns #16](./2026-08-14-codex-unknown-unknowns.md#16--donanım-amd-epyc-vs-intel).
> Tarihsel kayıt olarak orijinal metin burada değiştirilmeden bırakıldı.

## Kısa durum

Doğrulama: `worktrees/destektesvik-app-v1` HEAD = `2ad7561e6fa33eb384c8ce62402f9ac18dd2152d` — beklenen base SHA ile birebir aynı. `main` yalnız `Initial commit` (`68e33c4`) ve tek dosya (`AGENTS.md`) içeriyor; ürünün tamamı `destektesvik-app-v1` dalında, 16 commit'te yaşıyor. Repo AGENTS.md'si ürün kuralı içermiyor; yalnız Pane araç bağlamı.

Bugünkü ürün, **tek bir tarayıcı dosyasına gömülmüş, sunucusuz, tek kullanıcılı bir karar destek prototipi**. Domain düşüncesi (para katmanları, sıfır nedenleri, çift finansman, AI'ın yetki sınırı) beklenenden çok daha olgun; **çalışan sistem** ise vizyonun çok altında. Vizyon "sürekli çalışan, çok kiracılı, kaynak izleyen, öğrenen sermaye işletim sistemi" tarif ediyor; repoda bunların hiçbirinin çalışan hâli yok — hiçbiri "yarım" da değil, **sıfır**.

- `once`: Yok (ürün öncesi konuşma + statik prototip).
- `simdi`: Tek kullanıcı, tarayıcı belleğinde, 50 program kaydı üzerinde deterministik uygunluk hesabı yapan, AI'a bağlam paketi üreten ve dönen öneriyi şemayla süzen statik sayfa.
- `fark`: Domain sözlüğü ve AI güvenlik ilkesi kanıtlanmış; sunucu, kalıcılık, kimlik, kiracı, kaynak tazeliği, gerçek AI çağrısı, test ve CI/CD **hiç yok**.
- `kullaniciYolculugu`: Bir kullanıcı profilini girip senaryo çalıştırabilir, sıralama ve takvim görebilir, bağlam paketini kopyalayıp ChatGPT/Claude'a elle yapıştırabilir, dönen JSON'u elle geri yapıştırabilir. İkinci bir kullanıcı, ikinci bir cihaz, ikinci bir şirket veya ertesi haftaki mevzuat değişikliği yolculuğun içinde yok.
- `kalanEngel`: Persistence, kimlik/kiracı, kural sürümleme, kaynak snapshot, gerçek model çağrısı, test/CI — altısı da P0.
- `capability_delta: NONE` (bu oturumda hiçbir dosya, git durumu veya uzak kaynak değiştirilmedi).

---

## Repo kanıtları

**Fiziksel yüzey**
- Toplam 22 dosya (`.git` hariç). Tek uygulama dosyası: `index.html` — 6.945 satır / **1.59 MB**, 2 inline `<script>`, 1 inline `<style>`, 0 harici `src=`.
- En uzun satır **1.029.817 karakter** (`index.html:1961` civarı bloklarla birlikte) → ECharts kütüphanesi minified olarak dosyanın içine gömülmüş (`grep -c echarts` = 19).
- `sayfalari-uret.mjs:51-73` — 16 alt sayfa, `index.html`'in **tam kopyası**; yalnız `<title>` ve meta etiketleri değişiyor. Yani depoda aynı 1.6 MB, 17 kez duruyor (~27 MB). Bu bir route yapısı değil, SEO amaçlı çoğaltma.
- Dağıtım varsayımı koda gömülü: `sayfalari-uret.mjs:7` `sitedeKok = "/destektesvik"`, `:36` `https://karacaismail.github.io` → GitHub Pages.

**Veri ve kurallar**
- `index.html:1334` `PROGRAMLAR` — **50 program kaydı** (tubitak1501 … meslekOrgutleri). Her kayıt: koşullar, belgeler, uygun/hariç gider, adımlar, kanal, `kombinasyon`, `fallback`, `skor`.
- Deterministik uygunluk: `kural: p => {...}` kapanışı **32 programda var**, kalan 18'inde yok. Kurallar JS closure; sürümsüz, veri değil kod, test edilemiyor.
- `index.html:1088` `NACE_KAYITLARI` — yalnız **8 kayıt**. `naceProfilSenkron()` (`:3695`) NACE'yi `["61","62","63","72"]` ön ekiyle hard-code eşliyor. Türkiye NACE evreni ~600+ kod; bu bir demo örneklemi.
- Para gerçeği modeli güçlü ve dürüst: `FAYDA_SINIFLARI` (`:3235`) nakit/nakit-olmayan ayrımı, `SIFIR_NEDENLERI` (`:3262`) + `sifirNedeni()` "neden 0 TL" gerekçelendirmesi, `NAKIT_URETMEYEN_KATEGORILER` (`:3201`), `dislayiciCiftler()` (`:3737`) çift finansman denetimi.
- **Skor ve ağırlıklar uydurma**: `AGIRLIK` (`:3626`) = 0.34 / 0.22 / 0.14 / 0.12 / 0.09 / 0.09; her programda elle yazılmış `skor: { netFayda: 5, gerceklesme: 3, ... }` 1-5 aralığı; `uyumKatsayisi(seviye) = 0.8 + seviye*0.05`. Hiçbirinin kaynağı, kalibrasyonu veya doğrulaması yok. Konuşmalardaki %30/%20/%15 öğrenme eşikleri de aynı sınıfta. Bunlar ürün gerçeği değil, yer tutucu.

**Kaynak ve tazelik**
- `KAYNAKLAR` (`:3035`) 7 kurum grubunda ~45 resmî bağlantı — gerçek ve isabetli.
- Ama tazelik tek bir global sabit: `index.html:876` `const DOGRULAMA_TARIHI = "2026-08-12";` ve her program `dogrulama: DOGRULAMA_TARIHI` diyor. **Kaynak başına yürürlük tarihi yok, snapshot yok, içerik hash'i yok, sürüm yok, değişiklik tespiti yok.** Vizyonun "gece 2'de Resmî Gazete'yi okuyup farkı çıkaran" katmanının repo karşılığı: sıfır.
- `ACIK_DOGRULAMA` (`:3097`) — bilinmeyenleri açıkça listeliyor; bu dürüstlük korunmalı.

**AI ve MCP**
- `baglamPaketi()` (`:5063`), `mcpPaketi()` (`:5164`), `cizAi()` (`:5195`): paket üretir, panoya kopyalatır, indirtir.
- `ONERI_SEMASI` (`:1300 civarı`) + `oneriIceAl()` (`:5283`) + `oneriNormalle()` (`:3382`): zarf kimliği, sürüm, 4 izinli tür, allowlist hedef kimliği, azami 50 kayıt; sayısal tutar, uygunluk durumu ve pano durumu **açıkça reddediliyor**.
- `oneriEtkisi()` (`:5277`): onaylanan öneri en fazla bir kanıt maddesini işaretler, bir görünüm seçer veya günlüğe not düşer. Bu, vizyondaki "güvenli hibrit model"in çalışan tek parçası ve iyi yapılmış.
- Sınır repo tarafından da itiraf edilmiş (`:5205`): "Bu statik sayfa MCP sunucusu değildir… anahtar alanı yoktur, hiçbir veri otomatik gönderilmez." **Gerçek model çağrısı 0. Gerçek MCP sunucusu 0.** Tek ağ isteği: kullanıcının elle girdiği HTTPS köprü adresine tek bir doğrulama denemesi (`grep -c 'fetch('` = 0, `XMLHttpRequest` = 1).

**Kalıcılık, kimlik, denetim**
- Tüm durum tek bir `localStorage` anahtarında (`:3557`, `:3577`) + URL'e gömülü bit-stream paylaşım jetonu (`:5766` `URL_CIFT_AYIRAC`, `:6283` `history.replaceState`).
- `grep -ci 'login|password|session|jwt|tenant'` = **0**. Kimlik yok, oturum yok, rol yok, kiracı yok, satır seviyesi izolasyon yok.
- "Karar günlüğü" `gunlugeYaz()` (`:3672 civarı`) → tarayıcıda, `AZAMI_GUNLUK` ile kırpılıyor, kullanıcı `localStorage.removeItem` ile silebiliyor (`:6365`). **Değiştirilemez audit değil.**

**Mühendislik altyapısı**
- `package.json` yok, bağımlılık yok, lockfile yok.
- Test yok (hiçbir `test(` / `describe(` / `assert` yok).
- `.github` **hiçbir dalda yok** → CI/CD yok, lint yok, build gate yok.
- Dockerfile, compose, migration, IaC yok. Sunucu bileşeni hiç yok.

---

## Gap matrisi

Sınıflar: **mevcut** / **kısmi** / **yok** / **yanlış varsayım**.

### P0 — MVP blocker (bunlar olmadan satılabilir hiçbir şey yok)

| # | Alan | Durum | Kanıt | Ürün etkisi |
|---|---|---|---|---|
| P0-1 | Sunucu tarafı persistence | **yok** | tek `localStorage` anahtarı `:3557` | Tarayıcı temizlenince müşterinin tüm dosyası yok olur. Para konuşulan bir üründe kabul edilemez. |
| P0-2 | Kimlik, oturum, kiracı izolasyonu | **yok** | `login/session/tenant` grep = 0 | Çok kiracılı SaaS gelir modeli hiç kurulamaz. |
| P0-3 | Kural sürümleme + karar izi | **kısmi/yanlış** | 32 adet `kural: p =>` JS closure | Bir karar "hangi kural sürümüyle, hangi kaynak sürümüyle" verildi sorusu cevaplanamaz. Hukuki savunulabilirlik sıfır. |
| P0-4 | Kaynak snapshot, hash, yürürlük tarihi | **yok** | tek `DOGRULAMA_TARIHI = "2026-08-12"` `:876` | Mevzuat dünkü hâliyle konuşulur; kullanıcı yanlış tarihte başvurur. En büyük gerçek ürün riski. |
| P0-5 | Değiştirilemez audit | **yanlış varsayım** | `gunluk` kırpılıyor + silinebiliyor `:6365` | "Karar günlüğü" adı denetim vaadi veriyor, davranış vermiyor. |
| P0-6 | Gerçek AI çağrısı ve grounding | **yok** | `fetch(` = 0, `:5205` | AI-first vaadi bugün elle kopyala-yapıştır. |
| P0-7 | Test + CI/CD | **yok** | `.github` yok, test yok | Her değişiklik regresyon riski; RED→GREEN disiplini uygulanamaz. |
| P0-8 | Uygunluk kapsamı (NACE) | **kısmi** | 8 NACE kaydı, hard-code `61/62/63/72` `:3695` | Demo dışındaki her şirkette yanlış/boş sonuç. |
| P0-9 | Skor ağırlıkları | **yanlış varsayım** | `AGIRLIK :3626`, elle `skor` | Sıralama, kalibre edilmemiş sayılarla "öneri" gibi sunuluyor. MVP'de ya kaldırılmalı ya "açıklanabilir, kaynaklı" hâle getirilmeli. |

### P1 — MVP'den hemen sonra (satışı büyütür, MVP'yi bloke etmez)

| # | Alan | Durum | Ürün etkisi |
|---|---|---|---|
| P1-1 | Dijital ikiz (şirket profili varlık olarak) | kısmi (`durum.profil` düz nesne) | Vizyonun merkezi varlığı sürümsüz, doğrulanmamış, kaynağı yok. |
| P1-2 | Fırsat zekası (aktif keşif) | yok | "Sen sormadan bulan sistem" yok; sistem tamamen pasif. |
| P1-3 | Kaynak toplama (ingestion) + değişiklik diff'i | yok | Aktif davranışın ön koşulu. |
| P1-4 | Başvuru operasyonları (gerçek yaşam döngüsü) | kısmi (pano durumları statik) | Fırsattan paraya giden yolun ikinci yarısı eksik. |
| P1-5 | Belge/kanıt doğrulama, OCR | yok (yalnız checkbox) | Kanıt "işaretlendi" ≠ "doğrulandı". |
| P1-6 | Bildirim, görev, deadline worker | yok (takvim statik veri) | Proaktiflik yok. |
| P1-7 | Rol tabanlı onay eşikleri (insan ve ajan) | yok | Hibrit güvenli model yalnız tek kullanıcıda çalışıyor. |
| P1-8 | Danışmanlık/servis sınırı (ikinci gelir hattı) | yok | Vizyondaki merdiven modelinin yazılım karşılığı yok. |
| P1-9 | Frontend mimarisi | yanlış varsayım | 17 × 1.6 MB kopya sürdürülebilir değil; gerçek route/bileşen yapısı gerekiyor. |

### P2 — Sonraya (şimdi yapılırsa zarar verir)

| # | Alan | Durum | Neden sonraya |
|---|---|---|---|
| P2-1 | Multi-agent + master orkestra şefi | yok | Tek ajan bile çalışmıyorken çok ajanlı orkestrasyon, hata ayıklanamaz karmaşıklık üretir. |
| P2-2 | Katmanlı hafıza + öğrenme terfi eşikleri | yok | Kanıt üretecek trafik yok; eşikler (%30/%20/%15…) tamamen uydurma. Veri gelmeden sayısallaştırma yanlış. |
| P2-3 | Bilgi grafiği (fiziksel graph DB) | yok | İlişkiler PostgreSQL'de modellenebilir; Neo4j/AGE erken. |
| P2-4 | Vektör arama / RAG | yok | Doküman hacmi yokken pgvector bile erken; deterministik motor önce. |
| P2-5 | Plugin/skill marketi, SDK | yok | Tek ürün bile yayında değilken ekosistem katmanı saf maliyet. |
| P2-6 | Ülke paketleri (MENA/AB) | yok | Türkiye paketi bitmeden ikinci ülke, çekirdeği erken dondurur. |
| P2-7 | Öngörü ("yakında tekrar açılabilir") | yok | Geçmiş çağrı verisi toplanmadan tahmin = halüsinasyon. |
| P2-8 | Resmî kuruma otomatik başvuru gönderimi | yok | Hukuki ve teknik olarak en riskli yüzey; MVP'de kesinlikle olmamalı. |
| P2-9 | Taksonomi/node-type meta motoru | yok | Vizyonda haklı bir fikir; ama önce 3-4 somut domain yazılmadan meta model soyut kalır. |

---

## En küçük satılabilir ve test edilebilir MVP

**Tek kullanıcı yolculuğu:**

> Bir KOBİ yetkilisi hesap açar → şirket profilini girer → sistem **sürümlü, veri olarak tanımlanmış** kurallarla uygunluk kararı üretir → her karar hangi kural sürümüne ve hangi **kaynak snapshot'ına** dayandığını gösterir → AI bu kararı sade dille açıklar ve eksik belgeleri çıkarır (karar veremez) → kullanıcı kararı onaylar → onay değiştirilemez karar kaydına yazılır → çıktı: program başına gerekçeli uygunluk + belge kontrol listesi + takvim.

**Açıkça dahil:**
1. E-posta + parola ile kimlik, tek organizasyon = tek kiracı, PostgreSQL RLS ile satır izolasyonu.
2. Şirket profili (dijital ikizin v0'ı): NACE, personel, ciro, kuruluş tarihi, bölge, KOBİ beyanı.
3. **10-15 program** (50 değil) için kural motoru — kurallar veri (JSON/DSL), sürümlü, kod değil.
4. Kaynak kaydı: URL + çekilme tarihi + içerik hash + yürürlük tarihi. Manuel tetiklenen çekim yeterli; otomatik crawler değil.
5. Karar kaydı: girdi hash'i + kural sürümü + kaynak sürümü + sonuç + gerekçe, append-only.
6. Tek AI yeteneği: **kararın açıklanması ve eksik belgelerin çıkarılması**. Çıktı şeması katı, sayısal tutar üretemez, uygunluk değiştiremez — bugünkü `ONERI_SEMASI` disiplini sunucuya taşınır.
7. Para gerçeği modeli (`FAYDA_SINIFLARI`, `SIFIR_NEDENLERI`, çift finansman denetimi) — prototipten korunacak en değerli varlık.
8. RED önce yazılmış kabul testleri + GitHub Actions'ta çalışan CI.

**Açıkça dahil değil (ve nedeni):**
- Multi-agent, master ajan, hafıza terfisi → doğrulanacak trafik yok.
- Otomatik kaynak izleme, öngörü, bildirim worker'ı → önce snapshot modelinin doğru olduğu kanıtlanmalı.
- Belge yükleme/OCR → kanıt doğrulama ayrı bir ürün problemidir, MVP'yi ikiye böler.
- Resmî başvuru gönderimi → hukuki sorumluluk; MVP taslak üretir, göndermez.
- Ülke paketleri, plugin/market, graph, vektör, ödeme/faturalama → gelir modeli önce elle faturayla doğrulanabilir.
- 50 programın tamamı → 15 program doğru ve savunulabilirse ürün satılır; 50 program yarım doğru olursa ürün yalan söyler.

---

## Stack / mimari kararı ve reddedilen erken karmaşıklıklar

**Sabit sınırlara uygun öneri** (MetaFramer yasak, Next.js yasak ve alternatif olarak dahi önerilmez, Django yasak):

| Katman | Karar | Gerekçe |
|---|---|---|
| Domain çekirdeği | Saf Python paketi, framework bağımsız | `eligibility`, `sources`, `decisions` paketleri hiçbir web/ORM importu içermez. Delivery değişse çekirdek yeniden yazılmaz. |
| Delivery adapter | **FastAPI** | Yalnız HTTP sınırı: Pydantic şeması ↔ domain nesnesi çevirisi, DI, OpenAPI üretimi. İş kuralı router'da yaşamaz. |
| Veri | **PostgreSQL tek gerçeklik kaynağı**, JSONB + native FTS | Varlıklar, kurallar, snapshot'lar, kararlar, audit tek yerde. Dinamik yapı JSONB + tip sistemiyle, kontrolsüz tablo üretimiyle değil. |
| Kiracı izolasyonu | PostgreSQL RLS + uygulama katmanında zorunlu `tenant_id` | Tek mekanizmaya güvenilmez; RLS son savunma hattı. |
| Arayüz | Sunucu tarafı render (Jinja2) + hedefli progressive enhancement | React **serbest ama zorunlu değil**; MVP'nin tek yolculuğu SPA gerektirmiyor. React'i ancak gerçekten etkileşimli bir yüzey (sihirbaz, senaryo karşılaştırma) ölçülebilir şekilde talep ederse, izole bir bileşen olarak ekleyin. Karar "React'siz başla, gerekirse ada olarak ekle". |
| Arka plan işler | PostgreSQL tabanlı iş kuyruğu (`SELECT … FOR UPDATE SKIP LOCKED`) + tek worker süreci | Redis/Celery/Temporal MVP'de gereksiz operasyon yükü. İş hacmi ölçülünce değiştirilebilir. |
| Kaynak snapshot | Ham içerik object storage veya dosya sistemi + PostgreSQL'de meta (url, hash, fetched_at, effective_from) | Freshness'ın tek doğru tanımı budur. |
| AI sağlayıcı | Tek arayüzlü **provider adapter** (`explain(context) -> StructuredOutput`), Claude ilk sağlayıcı | Sağlayıcı değişimi domain'i etkilemez; çıktı katı şemayla doğrulanır, doğrulanmayan çıktı atılır. Framework düzeyinde agent SDK'sına bağlanmayın. |
| Dağıtım | Tek `linux/amd64` container + Postgres; GitHub Actions ile build/push | Modüler monolith, tek süreç, tek veritabanı. |

**Reddedilen erken karmaşıklıklar ve reddetme gerekçesi:**
- **Graph veritabanı (Neo4j/AGE)** — bugünkü ilişki sayısı (50 program × kombinasyon matrisi) bir foreign key tablosudur. Graph query ihtiyacı ölçülmeden eklenmemeli.
- **Vektör DB / pgvector** — RAG'in çözeceği bir problem henüz yok; deterministik motor ve snapshot doğru değilse vektör arama yanlışı hızlı yayar.
- **Multi-agent + master orkestra şefi** — tek deterministik akış + tek açıklama çağrısı çalışmadan çok ajanlı yapı yalnız hata yüzeyi büyütür.
- **Plugin/skill SDK ve market** — ekstansiyon noktası, ikinci gerçek tüketici çıkmadan tasarlanamaz. Şimdi tasarlanırsa yanlış tasarlanır.
- **Event sourcing / CQRS** — audit ihtiyacı append-only karar tablosuyla karşılanır.
- **Mikroservis, Kubernetes, message bus** — tek ürün, tek ekip, tek veri tabanı. Modüler monolith yeterli.
- **Temporal / harici workflow motoru** — MVP'de saatlerce süren iş akışı yok.
- **Meta-model / taksonomi motorunu önce yazmak** — vizyonun "önce platform çekirdeği" sırası entelektüel olarak doğru, ama pratikte 3 somut domain yazılmadan çıkarılan meta model, gerçek ihtiyaçla eşleşmez. Taksonomiyi **ikinci** domain'den sonra çıkarın.

---

## Hetzner (AMD EPYC / Intel) ve GitHub Actions uyumu — ölçülebilir kabul kriterleri

Not: EPYC ve Intel Xeon burada **aynı ISA'yı (x86-64) ve aynı ABI'yi (System V AMD64, glibc)** paylaşır. "AMD vs Intel" bir taşınabilirlik problemi değildir; problem **ISA baseline seviyesi** ve **native derlenmiş bağımlılıklardır**. GitHub Actions `ubuntu-latest` runner'ları da x86-64'tür, yani üretimle aynı ABI.

Kabul kriterleri (hepsi otomatik ölçülebilir):

1. **Tek image digest kuralı**: CI'da üretilen `linux/amd64` image, hem EPYC hem Intel hostunda **aynı digest ile** çalışır; ayrı build yok. Ölçüm: her iki hostta `docker inspect --format '{{.Image}}'` çıktıları eşit.
2. **ISA baseline**: hedef `x86-64-v2`. Hiçbir bağımlılık `-march=native` ile derlenmez, AVX-512 zorunluluğu olmaz. Ölçüm: CI'da image içindeki `.so` dosyalarına karşı bir ISA tarayıcı adımı (ör. `objdump -d` üzerinden AVX-512 opcode taraması) GREEN döner.
3. **Determinizm testi**: aynı girdi seti, iki hostta çalıştırıldığında kural motoru çıktısının **kanonik JSON hash'i birebir aynı**. Float kullanılmaz (para = tamsayı kuruş / `Decimal`). Ölçüm: `decision_hash` eşitliği.
4. **CI eşitliği**: GitHub Actions'ta geçen test paketi, üretim imajı içinde de aynı sonucu verir. Ölçüm: `docker run <image> pytest` GREEN.
5. **Soğuk başlangıç ve kaynak tavanı**: container 4 vCPU / 8 GB profilinde ayağa kalkar; migration dahil başlangıç süresi ölçülür ve sürüm başına regresyon eşiği tanımlanır. (Sayı burada uydurulmaz; ilk ölçüm baseline olur.)
6. **Taşınabilirlik**: hiçbir host-spesifik yol, systemd birimi veya el ile kurulmuş paket gerekmez; `docker compose up` + `.env` yeterli. Ölçüm: temiz bir sunucuda tek komutla ayağa kalkma testi.
7. **Rollback**: önceki image tag'ine dönüş + migration geri alma yolu her sürümde belgelenir ve bir kez gerçekten denenir.

---

## RED acceptance test listesi (uygulama öncesi yazılacak, önce kırmızı)

**Kural motoru / determinizm**
1. Aynı profil + aynı kural sürümü + aynı kaynak sürümü → aynı `decision_hash`. (İki farklı makinede de.)
2. Kural sürümü değiştiğinde eski karar kaydı **değişmez**; yeni karar yeni satır olur.
3. Bir programın kuralı, kaynağı olmayan bir koşula dayanamaz → kaynaksız kural tanımı yükleme hatası verir.
4. Para hesapları `Decimal`/tamsayı; float sızarsa test kırılır.
5. "Tavan" asla "gerçekçi tutar" olarak raporlanamaz; tavanı toplam faydaya ekleyen her yol testle yasaklanır.
6. Çift finansman: aynı gider kalemi iki programa atandığında ihlal raporlanır (prototipteki `dislayiciCiftler()` davranışı sunucuda korunur).
7. Kapalı çağrı penceresindeki program gerçekçi toplama 0 TL girer ve gerekçesi `cagriKapali` olur.

**Kaynak ve tazelik**
8. Kaynak snapshot'ı olmayan programa karar üretilemez.
9. Snapshot içerik hash'i değiştiğinde, o kaynağa bağlı kararlar **bayraklanır** (otomatik değişmez).
10. Yürürlük tarihi gelecekte olan kaynak, bugünkü karara uygulanmaz.

**Kiracı ve yetki**
11. A kiracısının token'ı ile B kiracısının kaydına erişim 404/403 döner — RLS kapalı bırakılsa bile uygulama katmanı engeller (iki katmanlı test).
12. Kimliksiz istek hiçbir domain endpoint'ine erişemez.

**AI sınırı**
13. AI çıktısı uygunluk durumunu, tutarı veya başvuru aşamasını **değiştiremez**; deneyen çıktı reddedilir ve reddin nedeni loglanır.
14. Şema dışı AI çıktısı sessizce kısmen uygulanmaz; tamamı reddedilir.
15. AI sağlayıcısı erişilemezken deterministik uygunluk sonucu **tam olarak** üretilmeye devam eder (AI opsiyonel katmandır).
16. Prompt injection testi: kaynak metnine gömülü "önceki talimatları yok say" içeriği, çıktı şemasını veya yetki sınırını değiştiremez.
17. Her AI açıklaması en az bir kaynak snapshot kimliğine bağlıdır; bağsız açıklama üretilemez.

**Audit**
18. Karar kaydı append-only: UPDATE/DELETE veritabanı seviyesinde reddedilir.
19. Onay olayı, onaylayan kullanıcı kimliği ve zaman damgasıyla birlikte kalıcıdır.

**Dağıtım**
20. Temiz sunucuda tek komutla ayağa kalkma + migration + smoke test GREEN (madde 6 ile aynı).

**Uygulama sırası** (her adım kendi RED testleriyle başlar):
1. Domain çekirdeği + kural motoru (veri olarak kurallar) — test 1-7.
2. PostgreSQL şeması + kaynak snapshot modeli — test 8-10.
3. Kimlik + kiracı + RLS — test 11-12.
4. Karar kaydı + audit — test 18-19.
5. FastAPI delivery adapter + OpenAPI.
6. Sunucu tarafı arayüz (tek yolculuk).
7. AI açıklama adapteri — test 13-17.
8. CI/CD + container + Hetzner kabul kriterleri — test 20.

---

## Riskler ve açık varsayımlar (ayrıştırılmış)

**Veri ve hukuk (en yüksek)**
- Teşvik mevzuatı sık değişir; yanlış tarihli bilgi doğrudan **parasal zarar** doğurur. Kaynak snapshot'ı bir "nice to have" değil, ürünün hukuki temelidir.
- "Üst limit / hesaplanan senaryo / başvurulabilir / resmen kabul edildi / tahsil edildi" ayrımı **asla** birleştirilmemeli. Prototip bunu doğru yapıyor; sunucuda korunmalı.
- Ürün "hukuki veya mali danışmanlık" değildir; sorumluluk sınırı arayüzde ve sözleşmede açık olmalı.

**Güven ve ürün dürüstlüğü**
- Uydurulmuş ağırlık ve skorlarla üretilen "sıralama", kullanıcıya kalibre edilmiş bir tavsiye gibi görünür. Bu, ürünün itibarını en hızlı yok edecek şeydir. MVP'de ya kaldırın ya da her skoru açıkça "editoryal, kalibre edilmemiş" olarak etiketleyin.
- `ACIK_DOGRULAMA` listesindeki dürüstlük (bilinmeyeni bilinmeyen olarak yazmak) ürünün en güçlü farkı; ölçeklerken kaybedilmemeli.

**Güvenlik ve tenant isolation**
- Çok kiracılı finansal veri: RLS + uygulama katmanı + testle üç kez doğrulanmalı.
- Şirket ciro/personel/NACE verisi KVKK ve ticari sır kapsamında; AI'a giden bağlamda PII maskeleme zorunlu. Prototipteki "notlar varsayılan olarak pakete girmez" kararı doğru ilkedir.
- Kaynak metinleri dış içeriktir → prompt injection / content poisoning yüzeyi. Kaynak metni asla talimat olarak yorumlanmamalı.

**Model halüsinasyonu**
- Risk, "AI yanlış cevap verir" değil; **"AI'ın yanlış cevabı bir sayıya veya duruma dönüşür"**. Bugünkü mimari bunu doğru engelliyor; sunucuya geçerken bu sınır gevşetilirse ürünün tüm güvenlik modeli çöker.
- AI erişilemezken ürün çalışmaya devam etmeli (deterministik çekirdek bağımsız).

**Resmî başvuru ve çift finansman**
- Otomatik resmî gönderim = geri alınamaz, hukuki sonuçlu aksiyon. MVP'de kesinlikle yok; ileride yalnız açık, kayıtlı insan onayıyla.
- Çift finansman (aynı giderin iki programa yazılması) yalnız kullanıcı hatası değil, **kurum yaptırımı** doğurur. Bu kontrol P0 kalitesinde olmalı, prototipteki hâli iyi bir başlangıç.

**Açık varsayımlar (Codex'in doğrulaması gereken)**
- Ödeyen müşteri profili ve fiyat noktası doğrulanmadı; MVP kapsamı bu doğrulanmadan genişletilmemeli.
- 50 programın kaç tanesinin gerçekten doğrulanabilir kural setine sahip olduğu bilinmiyor (32'sinde kod kuralı var, kalanı yok).
- Danışmanlık hattının yazılım içinde mi dışında mı duracağı ürün kararı olarak açık; MVP'ye girmez.
- Konuşmalardaki tüm sayısal eşikler (%30/%20/%15/%10, 0-40/40-70/70-85/85+, ağırlık tablosu) **ürün gerçeği değildir** ve hiçbir uygulama kararına girdi olmamalıdır.

---

## Codex uzlaşı raporuna aktarılacak 10 net karar

1. **Prototip yeniden yazılmaz, damıtılır.** `index.html` içindeki 50 program kaydı, para sınıfları, sıfır nedenleri, çift finansman ve kombinasyon matrisi kanonik veri şemalarına çıkarılır; UI kodu atılır. Statik sürüm değişmeden referans olarak korunur.
2. **MVP kapsamı 15 programa daraltılır.** 50 program yarım doğru olmaktansa 15 program tam savunulabilir olsun.
3. **Kurallar koddan veriye taşınır ve sürümlenir.** Her karar `(kural_sürümü, kaynak_sürümü, girdi_hash)` üçlüsüne bağlanır ve append-only kaydedilir.
4. **Kaynak snapshot'ı P0'dır.** URL + hash + çekilme tarihi + yürürlük tarihi olmadan hiçbir programa karar üretilmez. Tek global `DOGRULAMA_TARIHI` kaldırılır.
5. **FastAPI delivery adapter'dır, çekirdek değildir.** Domain paketleri hiçbir web/ORM importu içermez; bu bir mimari test ile zorlanır.
6. **PostgreSQL tek gerçeklik kaynağıdır.** JSONB + native FTS ile başlanır; graph, vektör, ayrı arama motoru, message bus ve harici workflow motoru MVP'de reddedilir.
7. **React MVP'de kullanılmaz** (yasak olduğu için değil, gerekmediği için). Sunucu tarafı render ile başlanır; React ancak ölçülebilir bir etkileşim ihtiyacında izole bileşen olarak eklenir. Next.js ve Django zaten kırmızı listede.
8. **AI'ın yetki sınırı anayasal kuraldır.** AI açıklar, eksik çıkarır, taslak üretir; uygunluk, tutar, aşama ve kabul kararını asla değiştiremez. Prototipteki `ONERI_SEMASI` disiplini sunucuya taşınır ve testle korunur. AI kapalıyken deterministik motor tam çalışır.
9. **Multi-agent, katmanlı hafıza, öğrenme terfi eşikleri, ülke paketleri, plugin marketi ve öngörü katmanı P2'dir** ve MVP'de kod olarak yer almaz. Konuşmalarda üretilen tüm sayısal eşikler ve ağırlıklar geçersiz sayılır; kalibrasyon ancak gerçek kullanım verisiyle yapılır.
10. **RED önce, CI ilk pakette.** Yukarıdaki 20 kabul testi implementasyondan önce kırmızı olarak yazılır; GitHub Actions + tek `linux/amd64` container + Hetzner kabul kriterleri (tek image digest, x86-64-v2 baseline, determinizm hash eşitliği) ilk change package'ın parçasıdır.

---

Bu analiz read-only yapıldı: hiçbir dosya yazılmadı/değiştirilmedi, hiçbir git mutasyonu (commit, branch, push, PR) yapılmadı, hiçbir dağıtım tetiklenmedi. `capability_delta: NONE`.

CLAUDE_GAP_ANALYSIS_COMPLETE