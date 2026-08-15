# DestekTeşvik — Çok Ajanlı Geliştirme Politikası ve Yol Haritası

**Tarih:** 2026-08-15
**Belge sınıfı:** Yönetişim politikası + program yol haritası. Yürürlüktedir.
**capability_delta:** `0` — bu belge kod değiştirmez; kimin ne yapacağını ve hangi kanıtla yapacağını kaydeder.

---

## 1. Çalışma modeli — kim ne yapar

### 1.1 Roller ve tek yönlü yetki zinciri

```
Kullanıcı (sahip)
      │  istek verir
      ▼
Codex GUI
      │
      ▼
Codex Desktop MASTER  ──►  kapsam · karar · Git · final doğrulama · sade Türkçe rapor
      │  runpane --agent claude
      ▼
Pane (görünür execution)
      │
      ▼
Claude worker / writer / reviewer ajanları  ──►  tüm yazma, tüm inceleme, tüm test
```

### 1.2 Bağlayıcı kurallar

| # | Kural |
|---|---|
| 1 | **Kullanıcı isteği Codex GUI'dan verir.** |
| 2 | **Codex Desktop MASTER** kapsamı belirler, kararı verir, Git işlemlerini yapar, final doğrulamayı yürütür ve sahibe sade Türkçe rapor verir. |
| 3 | **Pane** işin görünür yürütme yüzeyidir. Sahip ne olduğunu izleyebilir. |
| 4 | **Tüm worker, writer ve reviewer ajanları Claude'dur.** İstisnasız. |
| 5 | **Codex ürün veya belge yazarı değildir.** Uygulama, yönetişim metni, test, doküman veya üretilmiş artefakt yazmaz; Claude yerine review-worker rolü de üstlenmez. |
| 6 | **Claude dışı worker fallback yoktur.** Claude oturumu açılamıyorsa iş **başlamaz**; başka bir sağlayıcıya düşülmez. |
| 7 | **Git mutasyonu yalnız MASTER'a aittir** ve yalnız GREEN kapılardan sonra yapılır. |
| 8 | Ürün, marka, geri alınamaz etki, dış maliyet ve güvenlik risk iştahı kararları **sahibindir**. |

### 1.3 Sahibin diliyle

Bir inşaat düşünün. Sahip ne istediğini söyler. **MASTER** şantiye şefidir: neyin
yapılacağına, ne zaman döküleceğine ve işin kabul edilip edilmeyeceğine o karar verir;
betonu kendisi dökmez. **Claude ajanları** ustalardır: duvarı örer, tesisatı çeker,
kontrolü yapar. **Pane** şantiyenin canlı kamerasıdır. Şef usta işi yapmaz, usta şef
kararı vermez — karıştığında ikisi de bozulur.

---

## 2. Guardian admission — eşzamanlılığın gerçeği

### 2.1 Üç durum

| Durum | Anlamı | Davranış |
|---|---|---|
| **NORMAL** | Sistem kaynakları rahat | Yeni worker açılabilir |
| **GUARDED** | Kaynak baskısı var | Yalnız öncelikli worker açılır; sayı düşürülür |
| **BLOCKED** | Kaynak tükenmiş veya kural ihlali | **Hiçbir yeni worker açılmaz**, iş fail-closed durur |

### 2.2 "50+ ajan" ifadesinin doğru okunması

Kullanıcının "50+ ajan" talebi **bir rol havuzu ve toplam program kapasitesidir.**

> **Bu, 50 sürecin aynı anda açılacağı anlamına gelmez ve bu belge böyle bir iddiada
> bulunmaz.**

Canlı eşzamanlılık **her koşulda** iki değere tabidir:

| Değer | Anlamı |
|---|---|
| `allowNewWorker` | Şu anda yeni bir worker açılabilir mi? (boolean) |
| `recommendedNewWorkers` | Şu anda kaç tane açılması önerilir? (sayı) |

Bu iki değer NORMAL durumda bile bir tavan koyar. GUARDED'da tavan düşer, BLOCKED'da
sıfırlanır. **Rol havuzunun 56 olması, 56 sürecin açılabileceğini göstermez.**

### 2.3 Sahibin diliyle

Bir çağrı merkezinde 56 kişilik eğitimli bir ekibiniz olabilir. Ama santralınız aynı anda
12 hattı taşıyorsa, 56 kişiyi aynı anda hatta koyamazsınız. Ekip büyüklüğü **kapasite**,
santral **eşzamanlılıktır**. İkisini karıştıran sistem, yoğun saatte tamamen düşer.

---

## 3. Change package disiplini

| # | Kural | Neden |
|---|---|---|
| 1 | **Tek change package, tek writer** | İki writer aynı dosyaya dokunduğunda hatanın kaynağı bulunamaz |
| 2 | **Read-only analistler paralel çalışabilir** | Okuma çakışma üretmez; analiz hızlanır |
| 3 | **Writer kendi paketini review edemez** | Kendi kör noktasını kimse göremez |
| 4 | **Bağımsız review, değişmez (immutable) snapshot üzerinde yapılır** | Snapshot değişirse review geçersizdir ve yeniden yapılır |
| 5 | **Allowed-files seti paket başlamadan yazılır** | Kapsam kayması en sık görülen paket hatasıdır |
| 6 | **Non-goals paket başlamadan yazılır** | Ne yapılmayacağı, ne yapılacağı kadar bağlayıcıdır |
| 7 | **RED→GREEN sırası korunur** | Önce yeşil yazılan test, hiçbir şeyi kanıtlamaz |
| 8 | **Rollback yolu paket başlamadan bilinir** | Bilinmiyorsa paket başlamaz |
| 9 | **Git mutasyonu yalnız MASTER, yalnız GREEN sonrası** | Yarım iş dala girmez |
| 10 | **Her paket raporu brüt ekleme, brüt silme, net, dosya sayısı, sınıf, kanıt ve kapı sonucunu birlikte taşır** | Tek bir sayı yanıltır; altısı birlikte yanıltmaz |

---

## 4. Claude rol ve ajan kataloğu — 56 giriş

Her giriş bir loncaya (guild) aittir ve **tek cümlelik somut bir sorumluluk** taşır.

### 4.1 Ürün loncası (5)

| ID | Rol | Sorumluluk |
|---|---|---|
| PRD-01 | Ürün Sahibi Vekili | Her milestone'un kabul kriterini sahibin diliyle tek cümleye indirger ve o cümle karşılanmadan GREEN vermez. |
| PRD-02 | Kullanıcı Yolculuğu Mimarı | Ekran listesi yerine baştan sona yolculuk yazar ve her milestone'u bir yolculuk halkasına bağlar. |
| PRD-03 | Kapsam Bekçisi | Paketin allowed-files ve non-goals setini yazar ve kapsam dışına çıkan her değişikliği reddeder. |
| PRD-04 | Satılabilirlik Analisti | Her fazın sonunda "bu hâliyle satılır mı" sorusunu somut eksik listesiyle cevaplar. |
| PRD-05 | Yetenek Kütüğü Editörü | `capabilities.ts` kütüğünü gerçekle senkron tutar ve hiçbir engelli yeteneğin sessizce yeşile terfi etmesine izin vermez. |

### 4.2 Araştırma ve alan loncası (6)

| ID | Rol | Sorumluluk |
|---|---|---|
| RES-01 | Teşvik Mevzuat Araştırmacısı | Program kurallarını resmî kaynaktan çıkarır ve her kuralı bir kaynak yakalamasına bağlar. |
| RES-02 | Kurum Evreni Haritacısı | SGK, TÜBİTAK, KOSGEB, bakanlıklar, kalkınma ajansları ve odaların program evrenini yapılandırılmış biçimde haritalar. |
| RES-03 | Nakit Dışı Destek Uzmanı | Ofis, kuluçka, laboratuvar, cloud kredisi, pilot ve mentorluk gibi nakit üretmeyen destekleri ayrı bir tip olarak modeller. |
| RES-04 | AB ve Uluslararası Program Araştırmacısı | Avrupa ve uluslararası program yapılarını country pack sınırlarını bozmadan çıkarır. |
| RES-05 | Kaynak Tazelik Analisti | Her kaynağın yakalama tarihi, içerik hash'i ve yürürlük tarihi alanlarını doğrular; bilinmeyen tarihi asla uydurmaz. |
| RES-06 | Rakip ve Pazar Analisti | Rakip ürünlerin gerçekten çalışan yüzeylerini ölçer ve bizim eksiğimizi ürün diliyle raporlar. |

### 4.3 UX ve tasarım loncası (8)

| ID | Rol | Sorumluluk |
|---|---|---|
| UXD-01 | 320px Mobile-First Düzen Tasarımcısı | Her ekranın kaynak düzenini gerçek 320 pikselde kurar ve büyük ekranı ancak bu kapandıktan sonra ele alır. |
| UXD-02 | Görsel Kimlik ve Renk Sistemi | Parliament blue + lemon paletini dark ve light temada kontrast kanıtıyla birlikte token'lara çevirir. |
| UXD-03 | Tipografi ve Okunabilirlik | Roboto 400+ ölçeğini kurar ve 1rem altı hiçbir görünür metnin kalmadığını testle zorlar. |
| UXD-04 | Tasarım Token Yöneticisi | Renk, boşluk, yarıçap ve gölge token'larının tek kaynağını yönetir; ≤12px yarıçap sınırını token seviyesinde uygular. |
| UXD-05 | Etkileşim ve Motion Tasarımcısı | Anlam taşıyan geçişleri tanımlar ve `prefers-reduced-motion` altında hepsinin susmasını sağlar. |
| UXD-06 | Dönüşüm (Conversion) Tasarımcısı | Kamuya açık yüzeyin hero, sosyal kanıt, fiyat ve çağrı-eylem hunisini tasarlar. |
| UXD-07 | İçerik ve Mikro-metin Yazarı | Tüm arayüz metinlerini sade Türkçe yazar ve hiçbir yerde hak/tutar/onay iddiası kurmaz. |
| UXD-08 | Tema Tasarımcısı | Karanlık ve aydınlık temayı birbirinin türevi değil, iki birinci sınıf tema olarak kurar. |

### 4.4 Frontend mimari loncası (6)

| ID | Rol | Sorumluluk |
|---|---|---|
| FEA-01 | Uygulama Kabuğu Mimarı | Layered header, sol panel, sağ panel ve içerik alanının tek bir kabuk sözleşmesinde birleşmesini sağlar. |
| FEA-02 | Rota ve Navigasyon Mimarı | Rota kütüğünü gerçek rota ağacıyla senkron tutar ve her yeni rotanın erişilebilirlik taramasına girmesini zorlar. |
| FEA-03 | Durum Yönetimi Mimarı | Sunucu durumunu TanStack Query'de, UI tercihini Zustand'da tutar ve ikisinin karışmasını engeller. |
| FEA-04 | API Sözleşme ve İstemci Üretim Mimarı | OpenAPI spec'inden istemci üretir ve spec kaydığında build'in kırılmasını sağlar. |
| FEA-05 | Paket ve Kod Bölme Mimarı | Her rotanın lazy kalmasını ve grafik kütüphanesinin ana pakete asla girmemesini ölçerek korur. |
| FEA-06 | Tip Sistemi Sorumlusu | TypeScript strict kapısını korur ve `any` sızmasını derleme seviyesinde reddeder. |

### 4.5 Bileşen uzmanları loncası (8)

| ID | Rol | Sorumluluk |
|---|---|---|
| CMP-01 | Primitive Bileşen Uzmanı | Buton, giriş, etiket, rozet gibi temel bileşenleri master-component disipliniyle tek kaynaktan üretir. |
| CMP-02 | Form Bileşen Uzmanı | React Hook Form + Zod zincirini kurar ve her hatanın `role="alert"` ile duyurulmasını sağlar. |
| CMP-03 | Navigasyon Bileşen Uzmanı | Header, sol panel, sağ panel ve breadcrumb bileşenlerini 320'den 1440'a kadar tutarlı davranışla kurar. |
| CMP-04 | Overlay Uzmanı | Dialog, popover, sheet ve dropdown'ın tüm platformlarda aynı açılma, odak ve kapanma davranışını göstermesini sağlar. |
| CMP-05 | Durum Deseni Uzmanı | Yükleniyor, boş, sonuç yok, hata ve kısmi veri durumlarının her bileşende var olmasını zorlar. |
| CMP-06 | Kart ve Yerleşim Uzmanı | Card UI + Flat 2.0 yüzey sistemini ızgara ve boşluk ölçeğiyle birlikte kurar. |
| CMP-07 | Storybook Katalog Sorumlusu | Her master bileşenin kataloğa girmesini ve katalogda görsel regresyon çerçevesi taşımasını sağlar. |
| CMP-08 | Veri Görselleştirme Primitif Uzmanı | Hafif grafik primitiflerini kütüphanesiz ve ekran okuyucuya okunur biçimde üretir. |

### 4.6 Veri, tablo, medya ve AI loncası (9)

| ID | Rol | Sorumluluk |
|---|---|---|
| DAT-01 | Master DataGrid Mimarı | Tek bir grid sözleşmesi kurar ve hiçbir tüketicinin kendi tablosunu elle yazmasına izin vermez. |
| DAT-02 | Görünüm Modu Uzmanı | Table, list, card, kanban, calendar, timeline, group, pivot, dashboard, form ve json modlarını aynı master üzerinde uygular. |
| DAT-03 | Filtre, Sıralama ve Arama Uzmanı | Kolon filtresi, değer araması ve çoklu sıralamayı tip-duyarlı biçimde kurar. |
| DAT-04 | Sunucu Taraflı Grid Sözleşme Uzmanı | Sayfalama, filtre, sıralama ve toplu işlemin sunucu sözleşmesini tanımlar ve istemci tarafı varsayımını kaldırır. |
| DAT-05 | Kayıtlı Görünüm ve URL Durumu Uzmanı | Görünüm durumunu URL'e ve kayıtlı görünümlere taşır; şema sürümü uyuşmayan görünümü yanlış okumak yerine emekliye ayırır. |
| MED-01 | Medya Kütüphanesi Uzmanı | Klasör, üstveri, önizleme, sürüm ve arama yüzeylerini gerçek varlıklar üzerinde çalışır hâle getirir. |
| MED-02 | Yükleme Taşıma Katmanı Uzmanı | Dirençli, parçalı dosya yüklemeyi yerel depolama portu üzerinden kurar ve taşıma katmanı yokken yükleyiciyi kapalı tutar. |
| AIX-01 | AI Sağlayıcı Bağlantı Uzmanı | Gemini, OpenClaw, Claude ve ChatGPT/OpenAI bağlantılarını broker üzerinden kurar ve hiçbir gizli değeri tarayıcıya bırakmaz. |
| AIX-02 | Ajan Orkestrasyon Yüzeyi Uzmanı | Master ve uzman ajanların çalışma alanını, düşük risk otomatik / yüksek risk insan onaylı ayrımıyla birlikte kurar. |

### 4.7 Kalite, güvenlik, erişilebilirlik, performans ve i18n loncası (9)

| ID | Rol | Sorumluluk |
|---|---|---|
| QLT-01 | RED Test Yazarı | Her milestone'un kabul testini uygulamadan **önce** yazar ve davranışsal olarak kırmızı olduğunu kanıtlar. |
| QLT-02 | Bağımsız Reviewer | Yazmadığı bir paketi değişmez snapshot üzerinde inceler ve GREEN/CONDITIONAL/RED kararını gerekçesiyle verir. |
| QLT-03 | Dürüstlük Muhafızı | Yasaklı ifade, tarayıcı deposu sızıntısı ve uydurma uç taramalarını koda karşı zorlar. |
| QLT-04 | E2E Tarayıcı Test Uzmanı | Gerçek tarayıcıda yolculuk testleri yazar ve her mocklu spec'i açıkça `[mocked backend]` olarak etiketler. |
| QLT-05 | Erişilebilirlik Uzmanı | axe critical/serious = 0 kapısını korur ve klavye ile tam kullanımı her yüzeyde doğrular. |
| QLT-06 | Performans Uzmanı | Bundle bütçesini ve LCP/INP/CLS ölçümlerini alır; bütçe aşılınca bütçeyi değil kodu küçültür. |
| QLT-07 | Güvenlik Uzmanı | CSP, CSRF, ortam değişkeni doğrulama ve bağımlılık taramasını kurar; gizli değerin tarayıcıya inmesini yasaklar. |
| QLT-08 | i18n ve Yerelleştirme Uzmanı | Metinleri kaynaktan ayırır; UTC taşıma, `Intl` görüntüleme ve para-string disiplinini uygular. |
| QLT-09 | Görsel Regresyon Uzmanı | Bespoke tasarımın sessizce bozulmasını ekran görüntüsü karşılaştırmasıyla yakalar. |

### 4.8 Operasyon ve sürüm loncası (5)

| ID | Rol | Sorumluluk |
|---|---|---|
| OPS-01 | CI Boru Hattı Sorumlusu | GitHub Actions iş akışını kurar ve CI'nın gerçekten koştuğunu kanıtlamadan hiçbir CI iddiası yazdırmaz. |
| OPS-02 | Dağıtım ve Hetzner Sorumlusu | `linux/amd64` çıktısını hazırlar ve dual-host smoke kapatılmadan dual-vendor iddiası kurulmasını engeller. |
| OPS-03 | Sürüm Kanıt Derleyicisi | Her sürüm için RED çıktısı, GREEN çıktısı, ölçüm ve UNVERIFIED listesini tek kanıt paketinde toplar. |
| OPS-04 | Rollback ve Risk Kaydı Sorumlusu | Her paketin rollback yolunu paket başlamadan yazar ve risk kaydını günceller. |
| OPS-05 | Belge ve Rapor Editörü | Her raporun `once/simdi/fark/kullaniciYolculugu/kalanEngel/capability_delta` alanlarını eksiksiz ve sahibin anlayacağı dilde tutar. |

**Toplam: 56 rol/ajan katalog girişi.**

---

## 5. Raporlama sözleşmesi

Her durum raporu, teknik olmayan sahibin anlayacağı biçimde ve **tam olarak** şu altı
alanla verilir:

| Alan | Ne yazılır |
|---|---|
| `once` | Bu paketten önce kullanıcı ne yaşıyordu — somut bir yolculuk cümlesi |
| `simdi` | Bu paketten sonra ne yaşıyor — somut bir yolculuk cümlesi |
| `fark` | Aradaki fark, ürün diliyle |
| `kullaniciYolculugu` | Gerçek bir kullanıcının baştan sona adım adım yolculuğu |
| `kalanEngel` | Hâlâ yapılamayan ve bunu kimin çözeceği |
| `capability_delta` | Eklenen/çıkan yetenek; hiçbiri yoksa `0` |

Ek olarak her paket raporu şunları birlikte taşır: brüt eklenen satır, brüt silinen satır,
net, dosya sayısı, paket sınıfı, kanıt kimliği ve kapı sonucu.

**Yasak:** Governance kapılarının yeşile dönmesi ürün hazırlığı olarak sunulamaz.

---

## 6. Test-first ve milestone çalışma ritmi

### 6.1 Her şey test-first

Hiçbir milestone uygulamayla başlamaz. Sıra değişmez:

```
Gerçeklik ölçümü → Kapsam → RED kabul testi → Uygulama → GREEN → Regresyon →
Bağımsız review → Handoff
```

### 6.2 İki günlük uzun paket ritmi

Her milestone **ortalama iki takvim günü** süren tek bir uzun pakettir.

**Gün 1 — gerçeklik, kapsam, anlamlı RED, risk**

1. Repo gerçeği ölçülür (dosya, satır, test sayısı, mevcut davranış).
2. Allowed-files seti ve non-goals yazılır.
3. Kabul kriteri sahibin diliyle tek cümleye indirgenir.
4. **Anlamlı RED** yazılır: hedef modül kasıtlı olarak yanlış bir stub ile eklenir ve test
   **davranışsal** olarak kırılır. Modül çözümleme hatası RED sayılmaz.
5. Risk ve rollback yolu kaydedilir.

**Gün 2 — tek writer uygulama, GREEN, regresyon, bağımsız review, handoff**

1. Tek writer uygular.
2. Tam kapı koşulur: lint, typecheck, test, coverage, build, storybook, e2e.
3. Regresyon kontrol edilir (önceki testler hâlâ yeşil mi).
4. Paketi yazmayan bağımsız bir Claude reviewer, değişmez snapshot üzerinde inceler.
5. Handoff raporu altı alanla yazılır ve MASTER'a verilir.

> **Dürüstlük notu.** Bu ritim, ajanların "48 saat uyumadan çalışması" değildir; öyle bir
> iddia kurulmaz. Tarif edilen şey **iş akışının iki takvim günü boyunca kesintisiz
> ilerlemesidir**: oturumlar, admission durumu ve kaynak tavanı elverdiğince, birbirine
> devrederek çalışır.

---

## 7. Yol haritası — 68 kilometre taşı

**Kural:** Her görev bir kilometre taşıdır. Hiçbiri mikro-görev değildir; her biri tek
başına anlamlı bir ürün sonucu verir. Her satırın süresi **ortalama 2 gün**dür.

**Kimlik kuralı:** `M01`–`M68` kimlikleri **kalıcıdır**. Bir milestone eklenirken mevcut
kimlikler yeniden numaralandırılmaz; yeni anlamlı milestone'lar **sona eklenir**. Bu yüzden
M65–M68, konu olarak daha erken gruplara ait olsalar bile numara olarak sondadır ve
sıralarını **bağımlılık sütunu** belirler, numara bitişikliği değil.

### 7.1 F1–F10 (sahibe dönük faz) ↔ A–V (yürütme grubu) eşlemesi

Bu iki numaralandırma farklı şeylerdir ve karıştırılmamalıdır:

- **F1–F10** sahibe dönük **fazdır**: sahip ürünü bu adımlarla görür, kabul dili budur.
  Kaynağı `ENTERPRISE-FRONTEND-TALEP-VE-GAP-RAPORU.md` Bölüm 11'dir.
- **A–V** **yürütme grubudur**: aşağıdaki milestone tablolarının başlıklarıdır. Paket,
  writer, bağımlılık ve review dili budur.

| Faz | Yürütme grubu | Milestone aralığı | Adet |
|---|---|---|---|
| **F1** — Yönetişim ve temel | A | M01–M04 | 4 |
| **F2** — 320px native kabuk ve görsel kimlik | B | M05–M13 | 9 |
| **F3** — Bilgi mimarisi ve navigasyon | C | M14–M18 | 5 |
| **F4** — Kimlik ve organizasyon | D | M19–M22 | 4 |
| **F5** — Fırsat ve uygunluk | E, F | M23–M28 | 6 |
| **F6** — Enterprise grid ve görünümler | I | M35–M40 | 6 |
| **F7** — Başvuru operasyonu | G, H, J, S | M29–M34, M41–M43, M65 | 10 |
| **F8** — AI-first katman | K, L | M44–M50 | 7 |
| **F9** — Ticarileşme | M, N, O, T | M51–M56, M66 | 7 |
| **F10** — Sertleştirme ve satılabilirlik | P, Q, R, U, V | M57–M64, M67, M68 | 10 |
| | | **Toplam** | **68** |

Aralıklar kesişmez ve M01–M68'in tamamını tek tek kapsar. **F sıralaması milestone
numarası sıralaması değildir:** F6 (M35–M40), F7'nin ilk milestone'u olan M29'dan sonraki
numaraları taşır. Bağlayıcı olan bağımlılık sütunudur.

### A. Yönetişim ve başlangıç çizgisi

| ID | Tek görev / sonuç | Ana roller | Bağımlılık | RED kanıtı | GREEN kabul kriteri | Süre |
|---|---|---|---|---|---|---|
| M01 | Program başlangıç çizgisi ölçülür: rota, bileşen, test, bundle, a11y sayıları tek raporda | PRD-03, OPS-03, QLT-06 | — | Ölçüm raporu dosyası yok; kontrol testi kırmızı | Rapor mevcut ve her sayının komut çıktısı ekli | 2 gün |
| M02 | Tek komutla koşan tam kabul kapısı sözleşmesi kurulur | QLT-01, OPS-01 | M01 | Kapı komutu yok; kapı testi kırmızı | Tek komut lint+typecheck+test+coverage+build+storybook+e2e koşar ve exit 0 verir | 2 gün |
| M03 | Tasarım sözleşmesi otomatik zorlanır: 320px, min 1rem, Roboto 400+, ≤12px yarıçap | UXD-03, UXD-04, QLT-01 | M02 | Kural ihlali eden kasıtlı stub testi geçiyor (kırmızı) | İhlal eden her token ve her metin boyutu testi düşürür | 2 gün |
| M04 | Dürüstlük muhafızları genişletilir: yasaklı ifade, depo sızıntısı, uydurma uç | QLT-03, PRD-05 | M02 | Yasaklı ifade taşıyan kasıtlı stub yakalanmıyor | Üç muhafız da kasıtlı ihlali yakalar ve kendi kendini işaretlemez | 2 gün |

### B. 320px native kabuk ve görsel kimlik

| ID | Tek görev / sonuç | Ana roller | Bağımlılık | RED kanıtı | GREEN kabul kriteri | Süre |
|---|---|---|---|---|---|---|
| M05 | 320px kaynak ızgara ve boşluk ölçeği kurulur | UXD-01, CMP-06 | M03 | 320px'te yatay taşma testi kırmızı | 320'de hiçbir ekranda yatay kaydırma yok; ölçek token'lardan gelir | 2 gün |
| M06 | Parliament blue + lemon paleti dark/light token'lara çevrilir | UXD-02, UXD-08 | M03 | Kontrast testi kırmızı; palet token'ı yok | Her token WCAG 2.2 AA kontrastını iki temada da geçer | 2 gün |
| M07 | Roboto 400+ tipografi ölçeği ve 1rem tabanı uygulanır | UXD-03 | M03 | 1rem altı metin bulan tarama kırmızı | Kaynak ağacında 1rem altı görünür metin sıfır | 2 gün |
| M08 | Card UI + Flat 2.0 yüzey sistemi kurulur (≤12px yarıçap) | UXD-04, CMP-06 | M06 | Yarıçap sınırı ihlali testi kırmızı | Arama alanı dışında hiçbir yüzeyde 12px üstü yarıçap yok | 2 gün |
| M09 | Advanced layered header kurulur (marka, bağlam, eylem, navigasyon) | FEA-01, CMP-03 | M08 | Dört katmanı arayan test kırmızı | Header dört katmanı taşır, 320'de daralır, klavye ile gezilir | 2 gün |
| M10 | Sol panel (navigasyon + bağlam) kurulur | CMP-03, UXD-01 | M09 | Panel yok; odak tuzağı testi kırmızı | 320'de gizli, 1024'te kalıcı; odak yönetimi doğru | 2 gün |
| M11 | Sağ panel (içgörü, yardım, aksiyon) kurulur | CMP-03, FEA-01 | M10 | Sağ panel yok; test kırmızı | 1280'de açılır, içerik alanını ezmez, kapatılabilir | 2 gün |
| M12 | Motion sistemi ve `prefers-reduced-motion` uyumu kurulur | UXD-05 | M08 | Reduced-motion altında animasyon devam ediyor (kırmızı) | Reduced-motion açıkken hiçbir hareket kalmaz | 2 gün |
| M13 | Platformlar arası tutarlı dropdown/overlay davranışı kurulur | CMP-04 | M09 | Farklı dropdown'lar farklı davranıyor (kırmızı) | Tüm overlay'ler aynı açılma, odak, Escape ve dış tıklama davranışını gösterir | 2 gün |

### C. Bilgi mimarisi ve navigasyon

| ID | Tek görev / sonuç | Ana roller | Bağımlılık | RED kanıtı | GREEN kabul kriteri | Süre |
|---|---|---|---|---|---|---|
| M14 | Bilgi mimarisi ve hedef rota haritası kanonikleşir | FEA-02, PRD-02 | M11 | Rota kütüğü ile hedef harita uyuşmuyor (kırmızı) | Kütük ve gerçek rota ağacı iki yönde de eşleşir | 2 gün |
| M15 | Global arama yüzeyi kurulur | CMP-03, DAT-03 | M14 | Arama yok; test kırmızı | Klavye ile açılır, sonuç gruplanır, boş/sonuç yok durumları var | 2 gün |
| M16 | Komut paleti kurulur | CMP-04, FEA-02 | M15 | Palet yok; kısayol testi kırmızı | Kısayolla açılır, rota ve eylem çalıştırır, ekran okuyucuya duyurulur | 2 gün |
| M17 | Bildirim merkezi kabuğu kurulur | CMP-03, AIX-02 | M14 | Bildirim merkezi yok (kırmızı) | Okunmamış sayacı, gruplama ve derin bağlantı çalışır; veri yoksa dürüst boş durum | 2 gün |
| M18 | Kiracı / organizasyon menüsü kurulur | CMP-03, FEA-03 | M14 | Menü yok; test kırmızı | Aktif organizasyon görünür, değiştirme akışı çalışır veya gerekçeli kapalıdır | 2 gün |

### D. Kimlik ve organizasyon

| ID | Tek görev / sonuç | Ana roller | Bağımlılık | RED kanıtı | GREEN kabul kriteri | Süre |
|---|---|---|---|---|---|---|
| M19 | Parola sıfırlama yolculuğu tamamlanır | CMP-02, QLT-07 | M18 | Yetenek engelli; akış testi kırmızı | Kullanıcı parolasını sıfırlayıp giriş yapar; kütükte yeşile geçer | 2 gün |
| M20 | E-posta doğrulama yolculuğu tamamlanır | CMP-02, QLT-07 | M19 | Doğrulama akışı yok (kırmızı) | Doğrulanmamış hesap sınırlıdır ve sınır ekranda yazılıdır | 2 gün |
| M21 | İki adımlı doğrulama ve aktif oturum listesi eklenir | QLT-07, CMP-02 | M20 | 2FA ve oturum listesi yok (kırmızı) | Kullanıcı 2FA açar ve kendi oturumlarını görüp sonlandırır | 2 gün |
| M22 | Organizasyon profili tam okuma-yazma döngüsüne kavuşur | CMP-02, FEA-04 | M18 | Profil yazılıyor ama okunamıyor (kırmızı) | Kaydedilen değer geri okunur; kısmi-veri uyarısı kalkar | 2 gün |

### E. Fırsat zekâsı

| ID | Tek görev / sonuç | Ana roller | Bağımlılık | RED kanıtı | GREEN kabul kriteri | Süre |
|---|---|---|---|---|---|---|
| M23 | Fırsat keşif yüzeyi genişletilmiş program setiyle kurulur | RES-01, RES-02, DAT-01 | M22 | Üç program dışına çıkan test kırmızı | Genişletilmiş set filtrelenir, sıralanır ve her kayıt kaynağını gösterir | 2 gün |
| M24 | Proaktif fırsat akışı kurulur (kullanıcı sormadan gelen) | AIX-02, RES-01 | M23 | Proaktif akış yok (kırmızı) | Yeni/değişen fırsat kullanıcıya gerekçesiyle düşer ve derin bağlantı verir | 2 gün |
| M25 | Kaynak tazeliği ve değişiklik farkı yüzeyi kurulur | RES-05, CMP-05 | M23 | Snapshot farkı gösterilemiyor (kırmızı) | İki yakalama arasındaki fark görünür; bilinmeyen tarih uydurulmaz | 2 gün |

### F. Uygunluk ve karar

| ID | Tek görev / sonuç | Ana roller | Bağımlılık | RED kanıtı | GREEN kabul kriteri | Süre |
|---|---|---|---|---|---|---|
| M26 | Uygunluk sihirbazı kalıcı hâle gelir | CMP-02, FEA-03 | M22 | Sihirbaz yeniden açılınca cevaplar kayboluyor (kırmızı) | Cevaplar sunucudan geri okunur; yarım kalan sihirbaz devam eder | 2 gün |
| M27 | Karar tezgâhı derinleştirilir: kural izi, kanıt, karşılaştırma | DAT-01, CMP-06 | M26 | Derin kural izi ve çoklu karşılaştırma testi kırmızı | Her koşulun hangi olguda takıldığı ve hangi kaynağa dayandığı satır satır görünür | 2 gün |
| M28 | Karar politikası ve risk/güven göstergesi eklenir | PRD-01, RES-06 | M27 | Risk göstergesi yok (kırmızı) | Gösterge kalibre edilmemişse açıkça "editoryal" etiketlenir; hiçbir tavsiye iddiası kurulmaz | 2 gün |

### G. Başvuru operasyonu

| ID | Tek görev / sonuç | Ana roller | Bağımlılık | RED kanıtı | GREEN kabul kriteri | Süre |
|---|---|---|---|---|---|---|
| M29 | Başvuru hattı liste ve detay yüzeyi kurulur | PRD-02, DAT-01 | M28 | `Application` yüzeyi yok (kırmızı) | Başvuru oluşturulur, listelenir, detayı açılır ve durumu görünür | 2 gün |
| M30 | Başvuru kanban görünümü ve durum akışı kurulur | DAT-02, CMP-06 | M29 | Kanban modu yok (kırmızı) | Başvurular durum sütunlarında taşınır; taşıma klavye ile de yapılır | 2 gün |
| M31 | Belge kontrol listesi kalıcı hâle gelir | CMP-02, MED-01 | M29 | İşaretlemeler yalnız tarayıcıda tutuluyor (kırmızı) | İşaretler sunucuda saklanır ve başka cihazdan görünür | 2 gün |

### H. Görev, takvim ve bildirim

| ID | Tek görev / sonuç | Ana roller | Bağımlılık | RED kanıtı | GREEN kabul kriteri | Süre |
|---|---|---|---|---|---|---|
| M32 | Görev panosu kurulur | PRD-02, DAT-02 | M30 | `Task` yüzeyi yok (kırmızı) | Görev atanır, tamamlanır, filtrelenir ve başvuruya bağlanır | 2 gün |
| M33 | Takvim yüzeyi kurulur | DAT-02, RES-05 | M32 | Takvim modu yok (kırmızı) | Yalnız gerçek tarihli olaylar görünür; bilinmeyen pencere uydurma tarih üretmez | 2 gün |
| M34 | Bildirim ve içgörü akışı derin bağlantıyla tamamlanır | AIX-02, CMP-05 | M17, M33 | Bildirimden aksiyona bağlantı yok (kırmızı) | Her bildirim tek tıkla ilgili rapora ve oradan aksiyona götürür | 2 gün |

### I. Enterprise grid ve görünüm modları

| ID | Tek görev / sonuç | Ana roller | Bağımlılık | RED kanıtı | GREEN kabul kriteri | Süre |
|---|---|---|---|---|---|---|
| M35 | Master DataGrid çekirdeği yeniden sözleşmelenir | DAT-01 | M27 | Tüketiciler kendi tablosunu yazabiliyor (kırmızı) | Tek sözleşme; elle yazılmış tablo mimari testinde düşer | 2 gün |
| M36 | Görünüm modları I: list, group, json | DAT-02 | M35 | Üç mod da yok (kırmızı) | Üç mod aynı master üzerinde çalışır, klavye ve ekran okuyucu uyumlu | 2 gün |
| M37 | Görünüm modları II: kanban, calendar, timeline | DAT-02, CMP-06 | M36 | Üç mod da yok (kırmızı) | Üç mod aynı master üzerinde çalışır; sürükle-bırak klavye ile de yapılır | 2 gün |
| M38 | Görünüm modları III: pivot, dashboard, form | DAT-02, CMP-08 | M37 | Üç mod da yok (kırmızı) | Üç mod aynı master üzerinde çalışır; pivot boyutları kullanıcı tanımlı | 2 gün |
| M39 | Sunucu taraflı grid sözleşmesi tanımlanır ve uygulanır | DAT-04, FEA-04 | M38 | İstemci tarafı varsayımını kıran test kırmızı | Sayfalama, filtre, sıralama ve toplu işlem sunucudan gelir | 2 gün |
| M40 | Grid ileri yetenekleri **enterprise olgunluğa** çıkarılır: kayıtlı görünümün sunucuda kalıcılığı ve paylaşımı, komut kısayolları, gömülü grafik, CSV dışı ve sözleşmeye bağlı dışa aktarma | DAT-05, CMP-08, DAT-04 | M39 | **Mevcut üç davranış korunuyor** (URL durumu, kayıtlı görünüm, CSV dışa aktarma bugün var ve testli — bkz. ENTERPRISE 8.7.1). Kırmızı olan olgunluk adımlarıdır: (a) kayıtlı görünüm ikinci bir cihazda/kullanıcıda görünmüyor, (b) hiçbir komut kısayolu bağlı değil, (c) grid içinde gömülü grafik yok, (d) CSV dışında dışa aktarma ve sunucu sözleşmesine bağlı dışa aktarma yok. Dördü için de kabul testi önce yazılır ve davranışsal olarak kırılır | Kayıtlı görünüm sunucuda saklanır, başka cihazdan açılır ve ekiple paylaşılır; komut kısayolları klavye ile çalışır ve ekran okuyucuya duyurulur; gömülü grafik lazy chunk'tadır ve ana pakete girmez; dışa aktarma sunucu sözleşmesine bağlıdır. **Regresyon şartı:** mevcut URL durumu, kayıtlı görünüm ve CSV dışa aktarma testleri değişmeden yeşil kalır ve `capabilities.ts`'teki `cross-device-views` / `full-dataset-export` engelleri ancak arkasındaki uç gerçekten geldiğinde yeşile alınır | 2 gün |

### J. Medya ve dosya

| ID | Tek görev / sonuç | Ana roller | Bağımlılık | RED kanıtı | GREEN kabul kriteri | Süre |
|---|---|---|---|---|---|---|
| M41 | Dosya taşıma katmanı ve yerel depolama portu kurulur | MED-02, FEA-04 | M31 | Yükleyici taşıma katmanı olmadığı için kapalı (kırmızı) | Dosya yerel depolamaya yüklenir, yarıda kesilirse devam eder; S3 opsiyonel kalır | 2 gün |
| M42 | Klasör, üstveri, önizleme ve sürüm geçmişi kurulur | MED-01 | M41 | Klasör ağacı ve üstveri editörü kapalı (kırmızı) | Klasör oluşturulur, üstveri kalıcı yazılır, sürümler listelenir | 2 gün |
| M43 | Medya yönetişimi, arama, toplu işlem ve varlık bağları kurulur | MED-01, DAT-03 | M42 | Toplu işlem ve varlık bağı yok (kırmızı) | Dosya bir başvuruya bağlanır; toplu işlem izin kontrolüne tabidir | 2 gün |

### K. AI sağlayıcıları ve ajanlar

| ID | Tek görev / sonuç | Ana roller | Bağımlılık | RED kanıtı | GREEN kabul kriteri | Süre |
|---|---|---|---|---|---|---|
| M44 | Sağlayıcı bağlantı yüzeyi broker üzerinden çalışır hâle gelir | AIX-01, QLT-07 | M21 | Bağlantı kurulamıyor; her izin `false` (kırmızı) | Gemini, OpenClaw, Claude ve ChatGPT bağlanır; hiçbir gizli değer tarayıcıya inmez | 2 gün |
| M45 | Sağlayıcı karşılaştırma matrisi erişilebilir hâlde mount edilir | AIX-01, QLT-05 | M44 | `scrollable-region-focusable` serious ihlali (kırmızı) | Matris mount edilir; axe critical/serious = 0 | 2 gün |
| M46 | Master + uzman ajan çalışma alanı kurulur | AIX-02, PRD-01 | M44 | Ajan çalışma alanı yok (kırmızı) | Düşük risk otomatik, yüksek risk insan onaylı; her çıktı kaynağa bağlı | 2 gün |

### L. İçgörü, dijital ikiz, simülasyon, ECA, hafıza, beceri

| ID | Tek görev / sonuç | Ana roller | Bağımlılık | RED kanıtı | GREEN kabul kriteri | Süre |
|---|---|---|---|---|---|---|
| M47 | Dijital ikiz yüzeyi kurulur | PRD-02, RES-02 | M46 | Şirketin yaşayan modeli yok (kırmızı) | İkiz sürümlüdür, her alanın kaynağı görünür, eksik olgu adıyla söylenir | 2 gün |
| M48 | Senaryo ve simülasyon tezgâhı kurulur | RES-01, DAT-02 | M47 | Senaryo karşılaştırması yok (kırmızı) | İki senaryo yan yana konur; hiçbir çıktı "alacağınız para" olarak sunulmaz | 2 gün |
| M49 | ECA (olay-koşul-aksiyon) kural yüzeyi kurulur | AIX-02, PRD-01 | M48 | Otomasyon kuralı tanımlanamıyor (kırmızı) | Kullanıcı kural tanımlar, denemesi görünür, her tetikleme denetime yazılır | 2 gün |
| M50 | Katmanlı hafıza ve sürümlü beceri yüzeyi kurulur | AIX-02, QLT-03 | M49 | Hafıza katmanları ve beceri sürümü görünmüyor (kırmızı) | Katmanlar ayrı görünür; öğrenme ve unutma açık kurallarla yönetilir | 2 gün |

### M. Ekip, yetki ve denetim

| ID | Tek görev / sonuç | Ana roller | Bağımlılık | RED kanıtı | GREEN kabul kriteri | Süre |
|---|---|---|---|---|---|---|
| M51 | Ekip, davet ve rol matrisi kurulur | CMP-02, QLT-07 | M21 | Çok kullanıcı modeli yok (kırmızı) | İkinci kullanıcı davet edilir, rolü atanır ve yetkisi dışına çıkamaz | 2 gün |
| M52 | Denetim izi ve onay kuyruğu yüzeyi kurulur | PRD-05, DAT-01 | M51 | Denetim izi ve onay listesi ucu yok (kırmızı) | Kim, ne zaman, neyi onayladı listelenir; kayıt değiştirilemez | 2 gün |

### N. Danışmanlık ve ticarileşme

| ID | Tek görev / sonuç | Ana roller | Bağımlılık | RED kanıtı | GREEN kabul kriteri | Süre |
|---|---|---|---|---|---|---|
| M53 | Danışmanlık hattı ve CRM yüzeyi kurulur | PRD-04, PRD-02 | M52 | Danışmanlık hattı hiçbir yerde görünmüyor (kırmızı) | Müşteri danışman talep eder; danışman başvuruyu görür ve yürütür | 2 gün |
| M54 | Faturalama, abonelik ve kullanım yüzeyi kurulur | PRD-04, QLT-07 | M53 | Para tahsil edilemiyor (kırmızı) | Abonelik seçilir, fatura görünür, kullanım ölçülür | 2 gün |

### O. Çok dillilik ve ülke paketleri

| ID | Tek görev / sonuç | Ana roller | Bağımlılık | RED kanıtı | GREEN kabul kriteri | Süre |
|---|---|---|---|---|---|---|
| M55 | i18n altyapısı kurulur; Türkçe ve İngilizce tam | QLT-08, UXD-07 | M54 | Metinler kaynağa gömülü (kırmızı) | Dil değişince tüm arayüz çevrilir; tarih ve para `Intl` ile biçimlenir | 2 gün |
| M56 | Country pack çerçevesi kurulur (Türkiye-first, international-ready) | RES-04, QLT-08 | M55 | İkinci ülke eklenemiyor (kırmızı) | İkinci ülke paketi çekirdeği değiştirmeden eklenir | 2 gün |

### P. Performans, güvenlik, erişilebilirlik, çapraz tarayıcı

| ID | Tek görev / sonuç | Ana roller | Bağımlılık | RED kanıtı | GREEN kabul kriteri | Süre |
|---|---|---|---|---|---|---|
| M57 | Performans bütçeleri ölçülür ve CI kapısına bağlanır | QLT-06, FEA-05 | M40 | LCP/INP/CLS hiç ölçülmemiş (kırmızı) | Üç metrik ölçülür, bütçe tanımlanır, aşım build'i düşürür | 2 gün |
| M58 | Güvenlik sertleştirme: CSP, CSRF, env doğrulama, bağımlılık taraması | QLT-07, OPS-01 | M44 | CSP ve env doğrulama yok (kırmızı) | Dört kapı da CI'da koşar; eksik env build'de patlar | 2 gün |
| M59 | Erişilebilirlik tam turu, manuel ekran okuyucu dahil | QLT-05 | M45 | Manuel tur hiç yapılmamış (UNVERIFIED) | Otomatik axe temiz + manuel ekran okuyucu turu raporlanır | 2 gün |
| M60 | Çapraz tarayıcı doğrulaması: WebKit, Firefox, gerçek mobil cihaz | QLT-04, QLT-09 | M59 | Yalnız Chromium test edilmiş (UNVERIFIED) | Üç tarayıcıda da yolculuk testleri geçer | 2 gün |

### Q. CI ve dağıtım

| ID | Tek görev / sonuç | Ana roller | Bağımlılık | RED kanıtı | GREEN kabul kriteri | Süre |
|---|---|---|---|---|---|---|
| M61 | Frontend CI gerçekten koşar ve kanıtı alınır | OPS-01 | M58 | `frontend-ci.yml` GitHub'da hiç çalışmamış (UNVERIFIED) | CI koşar, tüm kapılar yeşil, koşu bağlantısı kanıt paketinde | 2 gün |
| M62 | Hetzner dağıtımı ve dual-host smoke yapılır | OPS-02, OPS-03 | M61 | Dual-host smoke yapılmamış (UNVERIFIED) | Aynı çıktı AMD ve Intel hostta smoke edilir; sonuç raporlanır | 2 gün |

### R. Satılabilirlik ve sürüm

| ID | Tek görev / sonuç | Ana roller | Bağımlılık | RED kanıtı | GREEN kabul kriteri | Süre |
|---|---|---|---|---|---|---|
| M63 | Satılabilir kamuya açık yüzey kurulur: hero, fiyat, sosyal kanıt, SEO | UXD-06, PRD-04 | M55 | Dönüşüm hunisi ve SEO üstverisi yok (kırmızı) | Ziyaretçi ürünü anlar, fiyatı görür ve kaydolur; paylaşım üstverisi doğru | 2 gün |
| M64 | **Ön kanıt paketi** derlenir (satılabilirlik kararı **verilmez**) | OPS-03, PRD-04 | M62, M63 | Tek bir kanıt paketi yok (kırmızı) | RED/GREEN çıktıları, ölçümler ve kalan UNVERIFIED listesi tek pakette toplanır. **Bu paket bir karar değildir:** gerçek backend E2E (M67), belge zekâsı (M65) ve analitik (M66) açıkken satılabilirlik kararı verilemez. Nihai karar **M68**'dedir | 2 gün |

### S. Belge zekâsı

| ID | Tek görev / sonuç | Ana roller | Bağımlılık | RED kanıtı | GREEN kabul kriteri | Süre |
|---|---|---|---|---|---|---|
| M65 | Belge zekâsı yüzeyi kurulur: OCR, alan çıkarımı, her alanın kaynağı ve güven (confidence) değeri, insan doğrulaması | MED-01, AIX-02, PRD-05, QLT-03 | M43 | Yüklenen bir belgeden hiçbir alan çıkarılamıyor; çıkarılmış alan, kaynağı ve güven değeri için tip/port sözleşmesi yok; "işaretlendi" ile "doğrulandı" arasında ayrım yok (kırmızı). Kabul testi, doğrulanmamış bir alanı doğrulanmış gösteren kasıtlı bir stub'ı yakalayacak biçimde önce yazılır | Her çıkarılmış alan **kaynağını (belge + konum) ve güven değerini** taşır; **doğrulanmamış bir alan hiçbir yüzeyde doğrulanmış gibi görünmez** ve bu bir muhafız testiyle koda karşı zorlanır; insan doğrulaması ayrı ve açık bir eylemdir; güven değeri ölçülmemişse `0` değil em-dash gösterilir. **Kapsam sınırı:** OCR/çıkarım **backend implementasyonu bu frontend programının dışındadır**; bu milestone tipli portu, UI sözleşmesini ve entegrasyon kabul testini üretir. Backend ucu gelene kadar yüzey **gerekçesiyle kapalıdır** ve yetenek kütüğünde engellidir | 2 gün |

### T. Analitik ve finansal etki

| ID | Tek görev / sonuç | Ana roller | Bağımlılık | RED kanıtı | GREEN kabul kriteri | Süre |
|---|---|---|---|---|---|---|
| M66 | Analitik ve finansal etki panosu kurulur: dönem/seçim, kaynağa bağlı finansal etki, dürüst boş değer | CMP-08, DAT-02, PRD-04, QLT-08 | M54, M40 | Finansal etki hiçbir yerde gösterilemiyor; dönem seçimi yok; ölçülmemiş bir değeri `0` olarak gösteren kasıtlı stub testten geçiyor (kırmızı) | Kullanıcı dönem ve kapsam seçer; **her finansal etki değeri hangi karara, hangi kurala ve hangi kaynağa dayandığını gösterir**; **ölçülmemiş değer `0` değil em-dash olarak görünür** ve bunu bir muhafız testi zorlar; hiçbir çıktı "alacağınız tutar" veya hak iddiası olarak sunulmaz; grafik lazy chunk'ta kalır ve ana pakete girmez | 2 gün |

### U. Gerçek backend E2E

| ID | Tek görev / sonuç | Ana roller | Bağımlılık | RED kanıtı | GREEN kabul kriteri | Süre |
|---|---|---|---|---|---|---|
| M67 | **Gerçek FastAPI backend karşısında** tarayıcı yolculuğu uçtan uca koşar (P0-15'in sahibi) | QLT-04, OPS-01, FEA-04 | M61, M22 | Bugün **her** e2e spec'i `[mocked backend]` etiketlidir ve mock request routing açıktır; gerçek backend karşısında koşan tek bir tarayıcı testi yoktur — durum **UNVERIFIED**'dır | **Mock request routing kapalıyken**, gerçek FastAPI backend ve gerçek veritabanı karşısında şu yolculuk tarayıcıda baştan sona yürür: **kayıt → giriş → profil → değerlendirme → onay**. Koşu çıktısı ve ekran görüntüleri kanıt paketine girer. **Kapsam sınırı:** bu paket **backend geliştirmez**; yalnızca mevcut backend entegrasyonunu test eder. Eksik bir backend ucu çıkarsa uydurulmaz, adıyla UNVERIFIED olarak raporlanır. **M67 GREEN olmadan production dağıtımı ve satılabilirlik kararı verilemez** | 2 gün |

### V. Final kapanış

| ID | Tek görev / sonuç | Ana roller | Bağımlılık | RED kanıtı | GREEN kabul kriteri | Süre |
|---|---|---|---|---|---|---|
| M68 | Final kanıt paketi derlenir ve **satılabilirlik kararı** verilir | OPS-03, PRD-04, QLT-02 | M64, M65, M66, M67 | M64 yalnız bir **ön** kanıt paketidir; belge zekâsı, analitik ve gerçek backend E2E kapıları açıkken hiçbir final karar dayanağı yoktur (kırmızı) | M64'ün ön paketi, M65/M66/M67'nin GREEN çıktılarıyla birleştirilir; kalan UNVERIFIED kapılar adıyla listelenir; **karar MASTER'ındır** ve **M67 GREEN değilse karar "satılamaz" olmak zorundadır**. Governance kapılarının yeşil olması bu kararın yerine geçmez | 2 gün |

---

## 8. Toplam efor

| Ölçü | Değer |
|---|---|
| Kilometre taşı sayısı | **68** (M01–M68, kesintisiz ve benzersiz) |
| Kilometre taşı başına ortalama efor | **2 worker-day** |
| **Program toplam eforu** | **68 × 2 = 136 worker-day** |

**Sayının değişme kaydı:** Program 64 milestone / 128 worker-day olarak açılmıştı.
Bağımsız review, dört ürün sonucunun hiçbir milestone'a bağlanmadığını tespit etti:
belge zekâsı (M65), analitik ve finansal etki (M66), gerçek backend E2E (M67) ve final
kapanış kararı (M68). Dördü **sona eklendi**; mevcut M01–M64 kimliklerinin hiçbiri
değiştirilmedi. Yeni toplam **68 milestone / 136 worker-day**'dir.

**Takvim süresi ≠ toplam efor.** Bağımsız kollar paralel dalgalar hâlinde yürütülebilir ve
takvim süresini kısaltır. Ancak paralellik **iki kuralı asla bozamaz**:

1. **Bağımlılık kuralı.** Bir milestone, bağımlı olduğu milestone GREEN olmadan başlamaz.
2. **Tek writer kuralı.** Aynı change package'ta ikinci bir writer olamaz. Paralellik
   farklı paketler arasındadır, aynı paket içinde değildir.

Ayrıca canlı paralellik daima `allowNewWorker` ve `recommendedNewWorkers` ile sınırlıdır
(bkz. Bölüm 2).

---

## 9. Responsive büyüme merdiveni

```
320 → 360 → 375 → 390 → 412/430 → 480 → 768 → 1024 → 1280 → 1440+
```

| Kural | Açıklama |
|---|---|
| **320 kaynak düzendir** | Her ekran burada tasarlanır ve burada kabul edilir |
| **Büyük ekranlar progressive enhancement'tır** | Yeni düzen değil, mevcut düzenin genişlemesi |
| **1024** | Sol panel kalıcılaşır |
| **1280** | Sağ panel açılır |
| **1440+** | Üç panelli tezgâh |
| **Masaüstü gereklidir ama ikincildir** | **Mobil kapanmadan masaüstüne geçilmez** |

**Neden bu sıra:** 320'de çalışan bir düzen yukarı doğru büyür. Masaüstünde tasarlanıp
aşağı sıkıştırılan bir düzen ise 320'de yeniden yazılır — yani iş iki kez yapılır.

---

## 10. Faz kapıları

Bir faz, aşağıdakilerin **tamamı** sağlanmadan kapanmaz:

| # | Kapı |
|---|---|
| 1 | Fazın her milestone'u GREEN |
| 2 | Fazın tüm regresyon testleri yeşil |
| 3 | axe critical/serious = 0 |
| 4 | 320px'te yatay taşma yok |
| 5 | **Minimum görünür metin ≥ 1rem.** Fazın eklediği veya değiştirdiği hiçbir yüzeyde 1rem'in altında **görünür** metin yoktur. Doğrudan ölçülür ve raporlanır; yalnız regresyon testine dolaylı bırakılmaz |
| 6 | **Köşe yuvarlaklığı ≤ ~12px.** Arama alanı tek bilinçli istisnadır; onun dışında hiçbir bileşende 12px'i (veya rem cinsinden pixel-perfect karşılığını) aşan yarıçap yoktur. Doğrudan ölçülür ve raporlanır |
| 7 | Bundle bütçesi aşılmamış |
| 8 | Bağımsız reviewer GREEN vermiş |
| 9 | Faz raporu altı alanla yazılmış |
| 10 | Kalan UNVERIFIED kapılar adıyla listelenmiş |
| 11 | Rollback yolu denenebilir durumda |
| 12 | MASTER kabul etmiş |

**Kapı 5 ve 6 neden ayrı maddedir.** İkisi de tasarım sözleşmesinin ölçülebilir
çekirdeğidir ve M03'teki otomatik testle korunur. Ancak bir faz kapısında **testin
yeşil olması yeterli sayılmaz**: fazın eklediği yüzeylerde iki değer de doğrudan ölçülüp
faz raporuna yazılır. Bir regresyon testi yalnız bildiği yüzeyi korur; yeni eklenen bir
yüzey teste hiç girmemişse, test yeşil kalır ve ihlal görünmez.

---

## 11. Rollback politikası

| Seviye | Rollback |
|---|---|
| Milestone | O paketin dosyalarının geri alınması |
| Faz | Fazın tüm paketlerinin sırayla geri alınması |
| Program | Belge setinin ve eklenen frontend paketlerinin geri alınması |

**Kurallar:** Rollback yolu paket başlamadan bilinir. Rollback kararı ve yürütmesi yalnız
MASTER'ındır. Hiçbir Claude worker geri alma amaçlı destructive komut çalıştırmaz.

---

## 12. Risk kaydı

| # | Risk | Etki | Azaltma |
|---|---|---|---|
| R1 | Eşzamanlı ajan sayısının kontrolsüz büyümesi | Makine kaynakları tükenir, iş durur | Guardian admission; `allowNewWorker` / `recommendedNewWorkers` |
| R2 | Writer'ın kendi paketini review etmesi | Kör nokta ürüne girer | Reviewer daima ayrı Claude oturumu |
| R3 | Snapshot değişikliğinin review'ı geçersizleştirmesi | Yanlış kanıtla GREEN verilir | Snapshot hash'i değişirse review otomatik geçersiz |
| R4 | Mock testinin production kanıtı sayılması | Ürün çalışmadığı hâlde bitmiş sanılır | Her spec `[mocked backend]` etiketli; gerçek backend kapısı ayrı raporlanır |
| R5 | Mobil kapanmadan masaüstüne geçilmesi | 320px yeniden yazılır | Faz kapısı 4 |
| R6 | Kapsam kayması | Paket büyür, hata izlenemez | Allowed-files ve non-goals paket başlamadan yazılır |
| R7 | Bağımlılık ihlaliyle paralel başlatma | Yarım temel üzerine inşa | Bağımlılık sütunu bağlayıcıdır |
| R8 | Router v8'e plansız geçiş | Rota katmanı kırılır | Ayrı, kanıtlı migration milestone'u |
| R9 | Bespoke tasarımın topluca yeniden yazılması | Aylarca kayıp | Toplu yeniden yazma yasak |
| R10 | Codex'in yazar rolüne kayması | Yönetişim ihlali | Codex writer değildir; ihlalde iş fail-closed durur |
| R11 | Program verisinin uzman doğrulaması olmadan büyütülmesi | Ürün yalan söyler | Data-pack **owner** kararıdır |
| R12 | Sahte tamamlanma iddiası | Güven kaybı | Bölüm 14'teki politika |

---

## 13. Definition of Done

Bir milestone ancak **on iki maddenin tamamı** sağlandığında bitmiş sayılır:

1. RED kabul testi uygulamadan önce yazıldı ve **davranışsal** olarak kırmızıydı.
2. Tek writer uyguladı.
3. Tam kapı koştu: lint, typecheck, test, coverage, build, storybook, e2e — hepsi exit 0.
4. Regresyon yok: önceki testler hâlâ yeşil.
5. axe critical/serious = 0.
6. 320px'te yatay taşma yok.
7. **Görünür metin ≥ 1rem.** Bu milestone'un eklediği veya değiştirdiği hiçbir yüzeyde
   1rem altı görünür metin yok; ölçüm rapora yazıldı.
8. **Köşe yuvarlaklığı ≤ ~12px** (veya rem cinsinden pixel-perfect karşılığı), **arama
   alanı hariç**; ölçüm rapora yazıldı.
9. Bundle bütçesi aşılmadı.
10. Paketi yazmayan bağımsız bir Claude reviewer değişmez snapshot üzerinde GREEN verdi.
11. Rapor altı alanla (`once/simdi/fark/kullaniciYolculugu/kalanEngel/capability_delta`)
    ve ölçümlerle yazıldı.
12. Rollback yolu kayıtlı ve uygulanabilir.

---

## 14. Sahte tamamlanma yasağı

| # | Yasak |
|---|---|
| 1 | Governance kapılarının yeşil olması **ürün hazırlığı olarak sunulamaz** |
| 2 | Mock testi **production kanıtı sayılamaz** |
| 3 | Test sayısı **ürün tamamlanması olarak sunulamaz** |
| 4 | Ölçülmemiş hiçbir sayı rapora yazılamaz |
| 5 | UNVERIFIED bir kapı **sessizce atlanamaz**; adıyla listelenir |
| 6 | Bir yetenek, arkasında sunucu ucu yokken **yeşile terfi ettirilemez** |
| 7 | "50 eşzamanlı süreç her koşulda açılır" **iddia edilemez** |
| 8 | "Ajanlar 48 saat uyumadan çalıştı" gibi sağlıksız bir iddia **kurulamaz** |
| 9 | CI'nın yeşil olması **dual-vendor kanıtı sayılamaz** |
| 10 | Bir faz, kapılarından biri kırmızıyken **kapatılamaz** |

---

## 15. İlk on kilometre taşı — başlangıç sırası

> **Bu bir faz sınırı değildir.** Aşağıdaki on satır bir **başlangıç sırasıdır** ve iki
> fazı birden kapsar: **F1 yalnız M01–M04'tür** (satır 1-4) ve M04 GREEN olunca kapanır;
> **F2 M05 ile başlar** (satır 5-10, F2'nin ilk altı milestone'u). "İlk on milestone F1'dir"
> okuması yanlıştır ve hiçbir belgede kurulmaz.

| Sıra | ID | Sonuç | Neden bu sırada |
|---|---|---|---|
| 1 | M01 | Başlangıç çizgisi ölçümü | Ölçmeden hiçbir ilerleme iddiası kurulamaz |
| 2 | M02 | Tek komutlu tam kabul kapısı | Kapı kurulmadan yazılan kod, kapı açıldığında yüzlerce hata gösterir |
| 3 | M03 | Tasarım sözleşmesi testi | 320px, 1rem, Roboto ve 12px kuralları tasarım başlamadan zorlanmalı |
| 4 | M04 | Dürüstlük muhafızlarının genişletilmesi | Ürünün kendi hakkında yalan söylemesi en pahalı hatadır |
| 5 | M05 | 320px kaynak ızgara | Tüm görsel iş bu ızgaranın üstüne oturur |
| 6 | M06 | Parliament blue + lemon paleti | Kimlik olmadan hiçbir ekran "ürün gibi" görünmez |
| 7 | M07 | Tipografi ölçeği | Okunabilirlik, görsel kimliğin ikinci yarısıdır |
| 8 | M08 | Card UI + Flat 2.0 yüzeyleri | Kabuk bileşenlerinin oturacağı yüzey sistemi |
| 9 | M09 | Advanced layered header | Kabuğun en görünür ve en çok bağımlılığı olan parçası |
| 10 | M10 | Sol panel | Header ile birlikte navigasyonun ikinci yarısı |

---

## 16. Owner özeti — sade Türkçe

**once:** Kimin ne yapacağı, kaç ajanın aynı anda çalışabileceği, bir işin ne zaman
"bitti" sayılacağı ve hangi sırayla ilerleneceği hiçbir yerde yazılı değildi. Sonuç:
teknik olarak düzgün ama ürün olarak eksik bir frontend "tamamlandı" diye raporlandı.

**simdi:** Tek bir yönetişim ve yol haritası belgesi var. 56 Claude rolü tanımlı, her
birinin tek cümlelik sorumluluğu yazılı. 68 kilometre taşı sıralı, her birinin bağımlılığı,
RED kanıtı, GREEN kabul kriteri ve süresi belli. Sahibe dönük F1–F10 fazlarının hangi
yürütme grubuna ve hangi milestone aralığına karşılık geldiği tek bir tabloda eşlendi
(Bölüm 7.1). Bir işin bitmiş sayılması için geçmesi gereken on iki madde yazılı — metin
boyutu ve köşe yuvarlaklığı artık ayrı ve ölçülen kapılardır. Ve sahte tamamlanmanın on
farklı biçimi açıkça yasaklandı.

**fark:** Artık "bitti mi" sorusunun cevabı bir görüş değil, bir kontrol listesi. Ve
"kaç ajan çalışıyor" sorusunun cevabı bir slogan değil, admission kontrolüne bağlı gerçek
bir sayı.

**kullaniciYolculugu:** Sahip Codex GUI'dan "başvuru hattını yap" der. MASTER bunu M29
kilometre taşına bağlar, kapsamı ve non-goals'ı yazar. Bir Claude RED yazarı önce testi
yazar ve kırmızı olduğunu kanıtlar. Tek bir Claude writer uygular. Tam kapı koşar. Paketi
yazmayan başka bir Claude reviewer değişmez snapshot üzerinde inceler. MASTER kabul eder,
Git işlemini yapar ve sahibe altı alanlı sade Türkçe raporu verir: önce ne vardı, şimdi
ne var, farkı ne, kullanıcı ne yaşıyor, hâlâ ne yapılamıyor ve hangi yetenek eklendi.

**kalanEngel:** 68 kilometre taşının tamamı henüz açık. Program eforunun toplamı 136
worker-day'dir ve paralel dalgalar takvimi kısaltabilir ama bu sayıyı düşürmez. Satılabilirlik
kararı artık M64'e değil **M68'e** bağlıdır ve M68, gerçek backend E2E (M67), belge zekâsı
(M65) ve analitik (M66) kapatılmadan verilemez. Ayrıca üç şey mühendislikle kapanmaz ve
**owner** kararıdır: uzman doğrulanmış program verisi, ICP/fiyat doğrulaması ve KVKK'daki
veri sorumlusu/işleyen sıfatı ile saklama süreleri. Hetzner dual-host smoke ise host
sağlanana kadar UNVERIFIED kalır.

**capability_delta:** `0`. Bu belge tek satır ürün kodu değiştirmedi. Yaptığı şey, bir
sonraki 68 paketin doğru sırayla, doğru kanıtla ve doğru rolle yapılmasını mümkün kılmak.
