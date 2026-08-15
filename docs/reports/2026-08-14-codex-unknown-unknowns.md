# Codex MASTER — Unknown-Unknowns Kaydı (20 madde)

**Tarih:** 2026-08-14
**Kapsam:** `destektesvik-mvp-fastapi-v1` change package'ının kapsam sınırlarını belirleyen,
Claude gap analizinin **göremediği veya yeterince daraltmadığı** 20 belirsizlik.
**Statü:** Her madde Codex MASTER kararıyla kapatıldı; "remaining validation" alanı hâlâ
açık olan ve bu pakette **çözülmeyen** kısmı adıyla söyler.

Her madde dört alan taşır:

- **Observed** — repoda, kaynakta veya konuşmada fiilen gözlenen şey.
- **Inference** — gözlemden çıkan, ama henüz kanıtlanmamış çıkarım.
- **Decision** — bu MVP'de yürürlükte olan bağlayıcı karar.
- **Remaining validation** — kararı doğrulamak/çürütmek için gereken, bu pakette yapılmayan iş.

Bir uyarı, tüm belgeye uygulanır: **teknik MVP ≠ satışa hazır ürün.** Aşağıdaki kararların
tamamı GREEN olsa bile, madde 20 kapanmadan ürün satılabilir sayılmaz.

---

## 1 — ICP ve fiyat noktası doğrulanmadı

- **Observed:** 8 vizyon dökümünde ve prototipte tek bir doğrulanmış ödeyen müşteri, tek bir
  fiyat testi veya tek bir satış görüşmesi kanıtı yok. Gap analizi bunu "açık varsayım" olarak
  işaretliyor (bkz. *Riskler / Açık varsayımlar*), ama kapsam kararına dönüştürmüyor.
- **Inference:** Kapsam, doğrulanmamış bir ICP'ye göre genişletilirse yanlış ürün doğru
  mühendislikle inşa edilmiş olur. Bu, geri alınması en pahalı hata sınıfıdır.
- **Decision:** MVP **geri alınabilir bir varsayımla** başlar: *tek KOBİ yetkilisi, tek
  organizasyon = tek tenant*. Billing, abonelik, danışman marketplace ve çok kullanıcılı rol
  hiyerarşisi bu pakette **yoktur**. Hiçbir belgede, ekranda veya commit mesajında "satışa
  hazır" iddiası kurulmaz.
- **Remaining validation:** Gerçek KOBİ yetkilileriyle fiyat ve değer görüşmesi; ilk fatura
  elle kesilerek gelir modelinin doğrulanması. Ürün/ticari karar → **owner**.

---

## 2 — Ontoloji: `program` ≠ `call` ≠ `opportunity` ≠ `application`

- **Observed:** Prototipteki `PROGRAMLAR` dizisi tek bir düz kayıtta programı, çağrıyı, uygunluk
  koşullarını ve başvuru adımlarını birlikte tutuyor (`index.html:1334`). Gap analizi 50 kaydın
  yapısını sayıyor ama bu dört kavramın **aynı kayda ezildiğini** ayrı bir risk olarak
  adlandırmıyor.
- **Inference:** Dört kavram tek varlığa ezilirse, "program hâlâ var ama çağrı kapandı" gibi
  gerçek dünyada sürekli olan bir durum modellenemez; sistem kapanmış çağrıyı açık program gibi
  gösterir.
- **Decision:** MVP şu varlıkları **ayrı** tutar: `ProgramVersion` (programın sürümlenmiş
  tanımı), `SourceSnapshot` (o tanımın dayandığı kaynak yakalaması), `RuleSetVersion` (uygulanan
  kural kümesi), `CompanyProfile` (başvurabilecek taraf), `Decision` (deterministik değerlendirme
  sonucu), `Approval` (kullanıcının kendi onayı), `AuditEvent` (değiştirilemez iz). `Call`
  penceresi `ProgramVersion` üstünde **nullable** alanlar olarak taşınır; bilinmiyorsa
  uydurulmaz, karar `conditional` olur.
- **Remaining validation:** `Opportunity` (profil × çağrı eşleşmesinin yaşayan nesnesi) ve
  `Application` (başvurunun yaşam döngüsü) ayrı varlıklar olarak MVP'de **yoktur**; P1'de
  eklenecektir. Bunlar eklenene kadar ürün "başvuru takibi" iddiasında bulunamaz.

---

## 3 — Şirket ≠ "single undertaking" / bağlı şirketler topluluğu

- **Observed:** Prototip şirketi tek, izole bir profil olarak modelliyor. AB de-minimis rejimi
  ise ([EUR-Lex 2023/2831](https://eur-lex.europa.eu/eli/reg/2023/02831/oj)) tavanı **tek
  işletme** (single undertaking) düzeyinde, yani kontrol ilişkisiyle bağlı şirketler
  topluluğunun tamamında toplar.
- **Inference:** Bağlı şirketleri görmeyen bir kümülasyon hesabı, tavanın altında görünen bir
  şirketi gerçekte tavanı aşmış hâlde başvuruya yönlendirebilir. Bu, kullanıcı hatası değil,
  **kurum yaptırımı** doğuran bir hatadır.
- **Decision:** Bu MVP **de-minimis uygunluğu hesaplamaz** ve kümülasyon tavanı iddiasında
  bulunmaz. Bağlı şirket / tek işletme modeli ayrı bir policy pack olarak sonraya bırakılır.
  Ekranda hiçbir yerde "de-minimis limitiniz uygun" benzeri bir ifade üretilmez.
- **Remaining validation:** Tek işletme grafiği (kontrol ilişkileri), grup düzeyi kümülasyon ve
  bunun Türkiye mevzuatındaki karşılığı. Hukuki görüş gerektirir → **owner**.

---

## 4 — Eligibility boolean değildir

- **Observed:** Prototipin `kural: p => {...}` closure'ları boolean döndürüyor (32 programda).
  Boolean bir sonuç, "veri eksik" ile "uygun değil"i ayırt edemez.
- **Inference:** Eksik veriyi `false` sayan bir motor, kullanıcıya gerçekte hak sahibi olduğu
  bir programı "uygun değil" diye gösterir — sessiz ve tespit edilmesi en zor hata sınıfı.
- **Decision:** Karar sonucu **dört değerli** bir enum'dur:
  `candidate_eligible` | `ineligible` | `conditional` | `insufficient_data`.
  "Resmen onaylandı" diye bir sonuç **yoktur** ve üretilemez. `Approval` yalnız *kullanıcının
  kendi iç onayıdır* ve arayüzde tam olarak **"Kullanıcı onayı"** diye etiketlenir.
- **Remaining validation:** Yok — bu pakette test 2 ile zorlanır (eksik olgu → `insufficient_data`
  / `conditional`, boolean overclaim yok).

---

## 5 — Para durumları tek bir sayı değildir

- **Observed:** Prototip para gerçeğini beklenenden iyi modelliyor (`FAYDA_SINIFLARI`,
  `SIFIR_NEDENLERI`), ama yine de bir "toplam fayda" sayısı üretip sıralamada kullanıyor.
- **Inference:** Yayınlanmış tavan ile hak edilmiş tutarı aynı alanda taşıyan her sistem, er ya
  da geç tavanı kullanıcıya "alacağın para" olarak gösterir.
- **Decision:** Beş durum **ayrı** kavramdır ve asla toplanmaz:
  `published ceiling` → `calculated scenario` → `realistic planning` → `awarded` → `paid`.
  Bu MVP **yalnız kaynakta yayınlanmış referans/tavanı bilgi olarak gösterebilir**; hak edilmiş
  tutar, senaryo tutarı veya beklenen nakit **hesaplamaz**. Tavan alanı veri modelinde
  `published reference/ceiling` etiketiyle taşınır.
- **Remaining validation:** Senaryo motoru ve gerçekçi planlama katmanı P1'dedir; bu pakette
  test 5 yalnız "tavan asla awarded/paid/calculated olarak raporlanamaz" invariant'ını korur.

---

## 6 — Destek tipleri toplanabilir değildir

- **Observed:** Destek biçimleri grant, vergi/prim istisnası, kredi, garanti, equity ve ayni
  hizmet olabilir. Prototipin `NAKIT_URETMEYEN_KATEGORILER` ayrımı doğru yönde ama tam değil.
- **Inference:** 100.000 TL hibe ile 100.000 TL kredi garantisi aynı ölçekte toplanırsa çıkan
  sayı hiçbir şey ifade etmez; kullanıcıya yanlış bir finansman resmi gösterir.
- **Decision:** Destek tipi veri modelinde birinci sınıf bir alandır ve **farklı tipler
  toplanmaz**. Bu MVP'nin 3 seed programının üçü de **grant profilindedir**; dolayısıyla
  MVP tip karışımı problemini *çözmez*, sadece *karışmasına izin vermez*.
- **Remaining validation:** Vergi/prim istisnası ve kredi/garanti profilleri için ayrı hesap
  semantiği P1.

---

## 7 — Kurallar kaynağa ve sürüme bağlıdır; yenileme geçmişi değiştirmez

- **Observed:** Prototipte tek global `DOGRULAMA_TARIHI = "2026-08-12"` var (`index.html:876`).
  Kaynak güncellenince eski kararın ne olacağı tanımsız.
- **Inference:** Kaynak yenilendiğinde eski kararlar sessizce "yeni gerçeğe" göre yeniden
  yorumlanırsa, kullanıcının dün gördüğü gerekçe ile bugün gördüğü gerekçe farklı olur ve
  hiçbir karar savunulabilir olmaz.
- **Decision:** Her karar `(rule_set_version, source_snapshot_id, input_hash)` üçlüsüne bağlanır.
  Kaynak veya kural değiştiğinde **eski karar kaydı hiç değişmez**; yeni bir karar satırı
  oluşur ve eski karar `review_required` olarak *bayraklanır* (mutasyon değil, yeni olay).
- **Remaining validation:** Yok — test 1 ve test 9 bu davranışı zorlar.

---

## 8 — AI, kaynak metnindeki talimatı talimat sanabilir

- **Observed:** Prototipte gerçek model çağrısı yok (`fetch(` = 0), yani prompt injection yüzeyi
  henüz hiç açılmamış. Gap analizi riski doğru adlandırıyor ama sunucu tarafı için somut bir
  kontrat vermiyor.
- **Inference:** Resmî kaynak metinleri (PDF, sayfa gövdesi) **dış içeriktir**. Sunucuya taşınan
  ilk gerçek çağrıda bu metin prompt'a girecek ve "önceki talimatları yok say" tipi içerik
  yetki sınırını test edecektir.
- **Decision:** (a) Kaynak metni prompt'ta **delimited untrusted data** olarak işaretlenir,
  asla talimat olarak yorumlanmaz. (b) Çıktı **strict Pydantic** şemasıdır, `extra="forbid"`.
  (c) `citations` yalnız **allowlist'teki snapshot id'leri** olabilir. (d) Sağlayıcı
  **varsayılan olarak kapalıdır**. (e) Dış AI maliyeti ve secret'ı yetkilendirilmediği için
  **gerçek network çağrısı GREEN şartı değildir**; testler fake provider ile çalışır.
  (f) Provider-agnostik, OpenAI-uyumlu HTTP adapter *gerçek bir konfigürasyon noktası* olarak
  bulunur; anahtar/model/vendor hard-code edilmez.
- **Remaining validation:** Gerçek sağlayıcıyla canlı doğrulama; maliyet ve secret yönetimi
  → **owner** yetkisi.

---

## 9 — KVKK ve ticari sır yüzeyi

- **Observed:** Ciro, personel sayısı, NACE ve şirket notları hem KVKK hem ticari sır kapsamında.
  KVKK'nın veri güvenliği yükümlülükleri:
  [kvkk.gov.tr/Icerik/2040](https://www.kvkk.gov.tr/Icerik/2040/Veri-Guvenligine-Iliskin-Yukumlulukler).
- **Inference:** Bir SaaS'ta bu verinin en olası sızma yolları üçtür: cross-tenant okuma,
  log'a düşen PII, ve AI sağlayıcısına giden bağlam.
- **Decision:** Minimum veri; `tenant_id` uygulama guard'ları **+** PostgreSQL RLS; Argon2 parola;
  httpOnly, SameSite=Lax, `secure` konfigüre edilebilir cookie; tüm state-changing form'larda
  CSRF; **log'da parola/session token/PII yok**; şirketin private notları AI bağlamına
  **otomatik girmez**.
- **Remaining validation:** Veri sorumlusu / işleyen (processor) sıfatı, aydınlatma metni,
  saklama (retention) süreleri ve KVKK VERBİS yükümlülüğü — hukuki karar, **açık engel**,
  → **owner**.

---

## 10 — Resmî başvuru gerçek bir kimlik/imza duvarının arkasındadır

- **Observed:** AB tarafında EU Login + PIC + eSubmission zorunlu
  ([how-to-participate](https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/how-to-participate/how-to-participate/2)).
  TÜBİTAK tarafında PRODIS; Ticaret Bakanlığı tarafında DYS yetkilendirme ve e-imza
  ([dys.ticaret.gov.tr kılavuzlar](https://dys.ticaret.gov.tr/haberler/kilavuzlar-ve-dikkat-edilecek-hususlar));
  KOSGEB tarafında e-Hizmetler.
- **Inference:** Bu duvarlar teknik entegrasyon problemi değil, **yetki ve hukuki sorumluluk**
  problemidir. Otomatik gönderim geri alınamaz ve imza sahibi adına hukuki sonuç doğurur.
- **Decision:** MVP **resmî kuruma hiçbir otomatik gönderim yapmaz**. Yalnız hazırlık, kontrol
  listesi, taslak ve insan onayı üretir. Kod tabanında hiçbir kuruma giden submit yolu yoktur.
- **Remaining validation:** Yok (kapsam dışı bırakılarak kapatıldı). İleride yalnız açık,
  kayıtlı insan onayıyla → **owner**.

---

## 11 — Türk resmî kaynaklarında stabil public API varsayılamaz

- **Observed:** TÜBİTAK 1501/1507 ve KOSGEB sayfaları HTML/PDF olarak yayınlanıyor; belgelenmiş,
  sürümlenmiş bir public REST API'leri yok. Buna karşılık AB tarafında gerçek bir public REST
  API var:
  [F&T portal APIs](https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/support/apis).
  Türkiye tarafında tek nokta portal: [yatirimadestek.gov.tr](https://www.yatirimadestek.gov.tr/).
- **Inference:** Otomatik crawler kurmak, kaynak yapısı her değiştiğinde sessizce yanlış veri
  üretme riskini kabul etmek demektir. Yanlış veri, bu üründe doğrudan parasal zarardır.
- **Decision:** MVP **otomatik crawler yapmaz**. Kaynaklar **curated source snapshot** olarak
  elle yakalanır; kod tarafında manuel yenileme için bir arayüz/komut **seam**'i bırakılır.
- **Remaining validation:** Kaynak başına yapısal stabilite ölçümü; AB API'sinin gerçek
  entegrasyonu P1.

---

## 12 — Freshness'ın tanımı URL değildir

- **Observed:** Prototip tazeliği tek bir global tarih sabitiyle temsil ediyor. Bir URL, tek
  başına içeriğin bugün ne dediğinin kanıtı değildir.
- **Inference:** "Kaynak: şu link" demek, denetimde hiçbir şey kanıtlamaz. Kanıt, *ne zaman*,
  *hangi içeriğin*, *hangi hash'le* görüldüğüdür.
- **Decision:** Her snapshot şu alanları taşır: `url`, `captured_at`, `content_hash`,
  `effective_from` (nullable), `effective_to` (nullable), `reviewed_at`, `review_status` ve
  karara giren `citation`. **Bilinmeyen tarih uydurulmaz, NULL kalır.** Çağrı penceresi
  bilinmiyorsa sonuç tahmini OPEN/CLOSED değil, **`conditional`** olur.
- **Remaining validation:** Yok — test 4 bu davranışı zorlar.

---

## 13 — Multi-tenant sızıntısı P0'dır ve tek katman yetmez

- **Observed:** Prototipte kiracı kavramı hiç yok (`grep tenant` = 0). Sıfırdan kurulacak.
- **Inference:** Uygulama katmanı guard'ı tek başına, unutulmuş bir `WHERE` yüzünden sessizce
  delinir. RLS tek başına, superuser/BYPASSRLS ile çalışan bir uygulama rolü yüzünden hiç
  devreye girmez.
- **Decision:** İki katman birlikte: `tenant_id` uygulama guard'ları **+** PostgreSQL RLS,
  **FORCE ROW LEVEL SECURITY** ile. Uygulama DB rolü **superuser veya BYPASSRLS olmayacak**;
  migration/admin rolü **ayrıdır**. Cross-tenant reddi hem API hem doğrudan DB seviyesinde
  entegrasyon testiyle kanıtlanır.
- **Remaining validation (güncellendi):** İki şey açık kaldı.
  1. DB yarısı **UNVERIFIED**'dır: RLS, en az yetki ve append-only testleri yazıldı ama bu
     makinede PostgreSQL olmadığı için **çalıştırılmadı**. CI'da atlanmaları da
     başarısızlıkları da build'i düşürür; ama CI da henüz hiç çalışmadı.
  2. Kapsam düzeltmesi: kiracı kapsamı, uygulama rolünün kendi ayarladığı transaction-local
     bir GUC'tur. Bu yüzden RLS, unutulmuş bir `WHERE`'e karşı gerçek bir ikinci katmandır ama
     **SQL injection**, süreç ele geçirilmesi veya çalınmış DB kimlik bilgilerine karşı bir
     sınır değildir. "İki katman yeter" cümlesi bu üç senaryoyu kapsamaz.

---

## 14 — SSR'de JWT-in-localStorage yanlış cevaptır

- **Observed:** Vizyon konuşmalarında token tabanlı auth varsayımı geçiyor; prototipte auth hiç
  yok.
- **Inference:** Server-rendered bir uygulamada JWT'yi localStorage'da tutmak, XSS'i doğrudan
  hesap devralmaya çeviren bir tasarım hatasıdır ve sunucu tarafı revocation'ı imkânsızlaştırır.
- **Decision:** Parola **Argon2**; oturum **signed/opaque server session cookie**
  (httpOnly, SameSite=Lax, `secure` konfigüre edilebilir); logout ve revocation gerçek;
  tüm state-changing form'larda CSRF. **localStorage JWT yok.**
- **Remaining validation:** E-posta doğrulama, rate limit ve parola sıfırlama bu pakette
  **yoktur** ve **production gate** olarak raporlanır.

---

## 15 — Audit "append-only" ise uygulama katmanında değil, DB'de zorlanmalıdır

- **Observed:** Prototipin "karar günlüğü" kırpılıyor ve kullanıcı tarafından silinebiliyor
  (`index.html:6365`). İsim denetim vaadi veriyor, davranış vermiyor.
- **Inference:** Uygulama katmanında zorlanan append-only, bir sonraki `UPDATE` yazan geliştirici
  tarafından sessizce delinir. Denetim değeri sıfırlanır.
- **Decision:** `Decision` ve `AuditEvent` üzerinde `UPDATE`/`DELETE` **veritabanı trigger/policy
  seviyesinde reddedilir**. Onay bir **yeni event/satırdır**, kararın mutasyonu değildir.
- **Remaining validation:** Yok — test 9 bunu DB seviyesinde zorlar.

---

## 16 — Donanım: AMD EPYC vs Intel

- **Observed:** Hetzner'in mevcut cloud hatları hem AMD hem Intel içeriyor
  ([hetzner.com/cloud](https://www.hetzner.com/cloud/regular-performance/)). Gap analizi
  bunu doğru biçimde "marka farkı değil, ISA baseline problemi" diye çerçeveliyor, **ancak**
  hedefi `x86-64-v2`'ye daraltıyor.
- **Inference:** `x86-64-v2` daraltması, kanıtlanmamış bir kısıtı kabul kriterine yükseltir.
  Her iki vendor da `x86_64` / `linux/amd64` ABI'sini paylaşır; bu MVP'de native derlenmiş,
  ISA-hassas bir bağımlılık yoktur. Daraltma kanıt üretmez, sadece yanlış bir güvence verir.
- **Decision:** Hedef **genel `linux/amd64` baseline**'dır; `x86-64-v2` diye daraltılmaz.
  `-march=native`, AVX-512 zorunluluğu veya herhangi bir vendor-spesifik derleme bayrağı
  **kullanılmaz**. Determinizm, ISA'ya değil, kanonik JSON + SHA-256 + `Decimal` para
  disiplinine dayanır.
- **Remaining validation:** **Aynı image digest**'in iki gerçek Hetzner hostunda (biri AMD, biri
  Intel) smoke edilmesi ve `decision_hash` eşitliğinin karşılaştırılması. Host verilmediği için
  bu pakette **UNVERIFIED ENVIRONMENT GATE** olarak kalır; runbook hazırdır
  ([dual-host kabul runbook'u](../runbooks/hetzner-dual-host-acceptance.md)).

---

## 17 — GitHub-hosted runner, dual-vendor kanıtı değildir

- **Observed:** GitHub-hosted x64 runner'ların CPU vendor'ı garanti veya seçilebilir değildir
  ([runner seçimi](https://docs.github.com/en/actions/how-tos/write-workflows/choose-where-workflows-run/choose-the-runner-for-a-job)).
- **Inference:** CI'da yeşil olan bir build, "hem AMD hem Intel'de çalışır" iddiasını
  kanıtlamaz; yalnız "bir x86_64 hostta çalışır" der.
- **Decision:** CI **`linux/amd64` build + container smoke** yapar ve iddiası bundan ibarettir.
  AMD + Intel runtime doğrulaması **sonraki environment gate**'tir ve CI'nın GREEN'i buna
  yorulmaz.
- **Remaining validation:** Madde 16'nın dual-host smoke'u ile aynı gate.

---

## 18 — Geliştirme makinesi arm64, üretim amd64

- **Observed:** Yerel makine Apple Silicon (arm64, Darwin 25.1.0). Üretim hedefi linux/amd64.
- **Inference:** Cross-mimari fark, testleri sadece container içinde çalıştıran bir kurulumda
  geliştirici döngüsünü kırar; sadece hostta çalıştıran bir kurulumda ise üretim imajını
  doğrulanmamış bırakır.
- **Decision:** Her ikisi de desteklenir: `docker buildx` ile **linux/amd64 cross-build** çalışır,
  **ve** test paketi host Python'unda (3.13) doğrudan çalışır. Test suite'i container'a bağımlı
  değildir.
- **Remaining validation:** Bu oturumda Docker daemon **kapalıydı**; buildx ve compose smoke
  yerel olarak **çalıştırılamadı**. Komutlar ve script'ler hazır, sonuç
  **UNVERIFIED ENVIRONMENT GATE**.

---

## 19 — Production-readiness ≠ MVP

- **Observed:** Backup/restore, TLS termination, secret manager, rate limit, e-posta doğrulama,
  observability, SLO ve felaket kurtarma — hiçbiri repoda yok ve bu pakette de olmayacak.
- **Inference:** Bunların yokluğu MVP'yi geçersiz kılmaz; **var gibi sunulması** ürünü yalancı
  yapar.
- **Decision:** Hepsi açıkça **production-readiness gate** olarak listelenir. MVP hiçbirini
  ima etmez, hiçbir belgede "production'a hazır" denmez.
- **Remaining validation:** Her biri ayrı change package.

---

## 20 — Data-pack truth gate

- **Observed:** Prototipte 50 program kaydı var; 32'sinde kod kuralı var, 18'inde yok. Hiçbirinin
  uzman doğrulaması yok.
- **Inference:** Teknik motorun doğru çalışması ile ürünün doğru cevap vermesi farklı şeylerdir.
  Motor mükemmel olabilir, veri yanlışsa ürün yalan söyler.
- **Decision:** Teknik MVP **3 resmî kaynaklı örnek programla** çalışır (TÜBİTAK 1501, TÜBİTAK
  1507, KOSGEB Girişimci Destek Programı). Prototipteki skorlar, ağırlıklar ve eşikler
  **migrate edilmez**. **10-15 uzman-doğrulanmış program olmadan "satışa hazır" denmez.**
- **Remaining validation:** Uzman doğrulaması ve 10-15 programlık data-pack. Bu, tüm gate'lerin
  en belirleyicisidir ve **owner** kararıdır.

---

## Resmî kaynaklar (bu pakette kullanılan)

| Kaynak | URL |
|---|---|
| TÜBİTAK 1501 | https://tubitak.gov.tr/tr/destekler/sanayi/ulusal-destek-programlari/1501-tubitak-sanayi-ar-ge-projeleri-destekleme-programi |
| TÜBİTAK 1507 | https://tubitak.gov.tr/tr/destekler/sanayi/ulusal-destek-programlari/1507-tubitak-kobi-ar-ge-baslangic-destek-programi |
| KOSGEB Girişimci Destek Programı | https://kosgeb.gov.tr/site/tr/genel/destekdetay/1231/girisimci-destek-programi |
| Türkiye tek nokta portal | https://www.yatirimadestek.gov.tr/ |
| EU F&T public REST API | https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/support/apis |
| EU submission/login/PIC sınırı | https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/how-to-participate/how-to-participate/2 |
| DYS yetkilendirme / e-imza sınırı | https://dys.ticaret.gov.tr/haberler/kilavuzlar-ve-dikkat-edilecek-hususlar |
| KVKK veri güvenliği yükümlülükleri | https://www.kvkk.gov.tr/Icerik/2040/Veri-Guvenligine-Iliskin-Yukumlulukler |
| AB de-minimis (MVP hesaplamaz) | https://eur-lex.europa.eu/eli/reg/2023/02831/oj |
| Hetzner cloud (AMD/Intel) | https://www.hetzner.com/cloud/regular-performance/ |
| Docker multi-platform | https://docs.docker.com/build/building/multi-platform/ |
| GitHub x64 runner | https://docs.github.com/en/actions/how-tos/write-workflows/choose-where-workflows-run/choose-the-runner-for-a-job |
| FastAPI container rehberi | https://fastapi.tiangolo.com/deployment/docker/ |
| FastAPI full-stack referansı (yalnız kanıt) | https://fastapi.tiangolo.com/project-generation/ |
