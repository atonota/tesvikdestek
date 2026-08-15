# DestekTeşvik — Çok Ajanlı Geliştirme Politikası ve Yol Haritası

**Tarih:** 2026-08-15
**Belge sınıfı:** Yönetişim politikası + program yol haritası. Yürürlüktedir.
**Revizyon:** **v2** — kapsam ve sıra maddi olarak değiştiği için yeni bir revizyondur.
v1'in `M01`–`M68` kimlikleri ve `F1`–`F10` fazları **aşılmış (superseded) tarih** olarak
dondurulmuştur; yeniden numaralandırılmamış, silinmemiş ve yürürlükte değildir.
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

## 4. Claude rol ve ajan kataloğu — 66 giriş

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

### 4.9 Backend ve platform loncası (10)

Bu lonca **P3–P6 fazları içindir** ve v2 ile eklenmiştir; program artık backend'i de
kapsadığı için rol havuzu 56'dan 66'ya çıkmıştır.

| ID | Rol | Sorumluluk |
|---|---|---|
| BKE-01 | Backend Çatı Mimarı | FastAPI çatısını, hata modelini ve katman sınırlarını kurar; hiçbir modülün diğerinin içine sızmasına izin vermez. |
| BKE-02 | Modüler Monolit Sınır Bekçisi | Modül sınırlarını mimari testle zorlar ve mikroservise kaymayı reddeder. |
| BKE-03 | Veri Modeli ve Migration Sorumlusu | Şemayı ve migration zincirini yönetir; geri alma yolu denenmeden ileri migration kabul etmez. |
| BKE-04 | API Sözleşme ve OpenAPI Sorumlusu | Pydantic → OpenAPI → üretilmiş istemci zincirini korur ve spec kaydığında build'i kırdırır. |
| BKE-05 | Kimlik, Oturum ve Yetki Motoru Uzmanı | Oturum, CSRF ve rol/izin motorunu sunucuda zorlar; frontend'in yalnız görünürlük yönettiğini denetler. |
| BKE-06 | Kural Motoru ve Uygunluk Uzmanı | Uygunluk kararını deterministik kural motorunda tutar ve kararın istemciye kaymasını engeller. |
| BKE-07 | Arka Plan İşçisi ve Zamanlayıcı Uzmanı | Kuyruğu, yeniden denemeyi ve zamanlanmış işleri kurar; sessiz kaybolan iş bırakmaz. |
| BKE-08 | AI Broker ve Gizli Değer Kasası Uzmanı | Sağlayıcı kimlik bilgilerini sunucudaki kasada tutar ve hiçbir gizli değerin tarayıcıya inmesine izin vermez. |
| BKE-09 | Veri Yönetişimi ve KVKK Uzmanı | Saklama sürelerini ve silme akışlarını uygular; sıfat ve süre kararını owner'a bırakır. |
| BKE-10 | Ölçek ve Yük Testi Uzmanı | Gerçek veri hacmi altında yanıt süresini ve hata oranını ölçer; ölçmediği hiçbir sayıyı yazmaz. |

**Toplam: 66 rol/ajan katalog girişi.**

> **"50+ ajan" ifadesinin okunması değişmedi.** 66 bir **rol havuzu ve toplam program
> kapasitesidir**; 66 sürecin aynı anda açılacağı anlamına **gelmez**. Canlı eşzamanlılık
> her koşulda kaynak, admission (`allowNewWorker` / `recommendedNewWorkers`), bağımlılık ve
> tek-writer kurallarına tabidir (bkz. Bölüm 2).

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

## 7. Yol haritası v2 — 147 kilometre taşı

### 7.1 Revizyon kaydı — v1 dondurulmuştur

Bu bölüm **v2 yol haritasıdır** ve yeni bir revizyondur. Kapsam ve sıra maddi olarak
değiştiği için, eski planın değişmeden kaldığı **iddia edilmez**.

| | v1 (aşılmış) | v2 (yürürlükte) |
|---|---|---|
| Kimlik uzayı | `M01`–`M68` | `V2-P0-01` … `V2-P6-12` |
| Kilometre taşı | 68 | **147** |
| Toplam efor | 136 worker-day | **294 worker-day** |
| Faz dili | F1–F10 (sahibe dönük) + A–V (yürütme grubu) | **P0–P6 makro faz** + P1 içinde A–O grupları |
| Kapsam | Yalnız frontend | Frontend **ve** backend çatısı, ortak ön gereksinimler, modüller, modül sonrası iş |
| İlk teslim | 10 faza yayılmış, kademeli | **Tek parça, eksiksiz, olgun, enterprise frontend (P1)** |

**`M01`–`M68` kimlikleri aşılmış (superseded) v1 tarihi olarak dondurulmuştur.** Silinmez,
yeniden numaralandırılmaz ve yürürlükte değildir. Yeni sıra eski numaralarla anlatılsaydı
yanıltıcı olurdu; bu yüzden temiz bir `V2-` ad uzayı kullanılır. Aynı gerekçeyle
**F1–F10** fazlandırması da yürürlükten kalkmıştır.

### 7.2 Kurallar

**Milestone kuralı.** Her satır tek bir kilometre taşıdır. Hiçbiri mikro-görev değildir;
her biri tek başına anlamlı bir ürün sonucu verir ve **ortalama 2 gün** sürer.

**Kimlik kuralı.** `V2-<faz>-<sıra>` biçimi kalıcıdır. Bir milestone eklenirken mevcut
kimlikler yeniden numaralandırılmaz; yeni milestone kendi fazının sonuna eklenir.

**Sıra kuralı.** Makro fazlar sırayla yürütülür: **P0 → P1 → (H1 gösterim) → P2 → P3 → P4
→ P5 → P6.** Faz içinde bağlayıcı olan **bağımlılık sütunudur**.

### 7.3 Makro faz özeti

| Sıra | Faz | Ad | Milestone | Worker-day |
|---|---|---|---|---|
| 1 | **P0** | Yönetişim ve kanıt altyapısı | 5 | 10 |
| 2 | **P1** | **Enterprise, olgun, waterfall frontend — ilk teslim** | 76 | 152 |
| — | **H1** | Sahip ürünü müşteriye gösterir — **kapı değildir** | **0** | **0** |
| 3 | **P2** | Bileşen değiştirme / silme / ekleme talep alımı | 1 | 2 |
| 4 | **P3** | Backend çatısı | 8 | 16 |
| 5 | **P4** | Modül öncesi ortak ön gereksinimler | 12 | 24 |
| 6 | **P5** | Modüler monolit modülleri | 33 | 66 |
| 7 | **P6** | Modül sonrası iş ve enterprise sertleştirme | 12 | 24 |
| | | **Toplam** | **147** | **294** |

**Aritmetik doğrulaması:** 5 + 76 + 1 + 8 + 12 + 33 + 12 = **147**; 147 × 2 = **294
worker-day**. H1 bir milestone değildir, efora girmez ve hiçbir kapı üretmez.

### 7.4 Milestone tabloları

### P0 — Yönetişim ve kanıt altyapısı (5 milestone)

| ID | Tek görev / sonuç | Ana roller | Bağımlılık | Anlamlı RED | GREEN kabul kriteri | Süre |
|---|---|---|---|---|---|---|
| V2-P0-01 | Program başlangıç çizgisi ölçülür ve v1→v2 devir kaydı yazılır: rota, bileşen, story, test, bundle, a11y sayıları tek raporda | PRD-03, OPS-03, QLT-06 | — | Ölçüm raporu dosyası yok; kontrol testi kırmızı | Rapor mevcut; her sayının komut çıktısı ekli; M01–M68 aşılmış v1 tarihi olarak dondurulmuş | 2 gün |
| V2-P0-02 | Tek komutla koşan tam kabul kapısı sözleşmesi kurulur | QLT-01, OPS-01 | V2-P0-01 | Kapı komutu yok; kapı testi kırmızı | Tek komut lint+typecheck+test+coverage+build+storybook+e2e koşar ve exit 0 verir | 2 gün |
| V2-P0-03 | Tasarım sözleşmesi otomatik zorlanır: 320px, min 1rem, Roboto 400+, ≤12px yarıçap (arama alanı istisnası) | UXD-03, UXD-04, QLT-01 | V2-P0-02 | Kural ihlal eden kasıtlı stub testten geçiyor (kırmızı) | İhlal eden her token ve her metin boyutu testi düşürür; arama alanı istisnası adıyla tanımlı | 2 gün |
| V2-P0-04 | Dürüstlük muhafızları genişletilir: yasaklı ifade, tarayıcı deposu sızıntısı, uydurma uç, işaretlenmemiş mock adaptör | QLT-03, PRD-05 | V2-P0-02 | Yasaklı ifade ve işaretsiz mock taşıyan kasıtlı stub yakalanmıyor (kırmızı) | Dört muhafız da kasıtlı ihlali yakalar ve kendi kendini işaretlemez | 2 gün |
| V2-P0-05 | Bileşen soyağacı kütüğü, no-duplicate muhafızı ve Storybook katalog kapsam kapısı kurulur | CMP-01, CMP-07, QLT-01 | V2-P0-03, V2-P0-04 | Kütük ata–türev ilişkisi tutmuyor; aynı rolü kuran ikinci uygulama testten geçiyor; katalog girişi olmayan bileşen kapıdan geçiyor (kırmızı) | Her bileşenin atası ve türevleri kütükte yazılı; ikinci uygulama muhafızda düşer; yedi boyutu taşımayan katalog girişi kapıyı kırar | 2 gün |

### P1 — Enterprise, olgun, waterfall frontend: ilk teslim (76 milestone)

> **P1 tek bir teslimdir.** İçinde ara teslim, "MVP sürümü", iskelet aşaması veya
> "sonra olgunlaştırılacak" bir bileşen **yoktur**. Aşağıdaki A–O grupları işin yürütülmesi
> ve kanıtlanması içindir, teslim kademelendirmesi için değil.
>
> **Her P1 milestone'unun kabul kriterine ek olarak üç kapı otomatik dahildir:**
> (1) eklediği/değiştirdiği her bileşen Bölüm 6.6'daki **yedi katalog boyutunu** Storybook'ta
> taşır; (2) anlamlı olduğu her yerde **sekiz durum** (yükleniyor, boş, sonuç yok, hata,
> kısmi, başarı, yetki, çevrimdışı) vardır; (3) backend'e bağlı her eylem **tipli port**
> arkasındadır ve mock adaptörü açıkça işaretlidir.

#### P1-A. Tasarım temeli ve durum sistemi (6)

| ID | Tek görev / sonuç | Ana roller | Bağımlılık | Anlamlı RED | GREEN kabul kriteri | Süre |
|---|---|---|---|---|---|---|
| V2-P1-01 | 320px kaynak ızgara ve boşluk ölçeği kurulur | UXD-01, CMP-06 | V2-P0-05 | 320px'te yatay taşma testi kırmızı | 320'de hiçbir yüzeyde yatay kaydırma yok; ölçek token'lardan gelir | 2 gün |
| V2-P1-02 | Parliament blue + lemon paleti dark/light iki birinci sınıf temaya çevrilir | UXD-02, UXD-08 | V2-P0-05 | Kontrast testi kırmızı; palet token'ı yok | Her token WCAG 2.2 AA kontrastını iki temada da geçer; dark light'ın türevi değildir | 2 gün |
| V2-P1-03 | Roboto 400+ tipografi ölçeği ve 1rem tabanı uygulanır | UXD-03 | V2-P0-05 | 1rem altı metin bulan tarama kırmızı | Kaynak ağacında 1rem altı görünür metin sıfır; ağırlık 400 altına düşmez | 2 gün |
| V2-P1-04 | Card UI + Flat 2.0 yüzey sistemi kurulur (≤12px yarıçap) | UXD-04, CMP-06 | V2-P1-02 | Yarıçap sınırı ihlali testi kırmızı | Arama alanı dışında hiçbir yüzeyde 12px üstü yarıçap yok | 2 gün |
| V2-P1-05 | Motion sistemi ve `prefers-reduced-motion` uyumu kurulur | UXD-05 | V2-P1-04 | Reduced-motion altında animasyon devam ediyor (kırmızı) | Reduced-motion açıkken hiçbir hareket kalmaz; her geçiş anlam taşır | 2 gün |
| V2-P1-06 | Sekiz durum deseni sistemi kurulur: yükleniyor, boş, sonuç yok, hata, kısmi, başarı, yetki, çevrimdışı | CMP-05, UXD-07 | V2-P1-04 | Sekiz durumun tamamını arayan test kırmızı; bazı desenler hiç yok | Sekiz desen de tek kaynaktan gelir, katalogda ve ekran okuyucuya duyurulur | 2 gün |

#### P1-B. Bileşen soyağacı ve master katman (7)

| ID | Tek görev / sonuç | Ana roller | Bağımlılık | Anlamlı RED | GREEN kabul kriteri | Süre |
|---|---|---|---|---|---|---|
| V2-P1-07 | Master primitif katmanı türeme kuralıyla kurulur (buton, giriş, seçim, etiket, rozet, anahtar) | CMP-01 | V2-P1-06 | Türevler kendi DOM ve klavye mantığını kuruyor (kırmızı) | Her türev atasını sarmalar; a11y atadan gelir; no-duplicate muhafızı geçer | 2 gün |
| V2-P1-08 | Master form katmanı kurulur: RHF + Zod, hata duyurusu, çok adımlı sihirbaz kabuğu | CMP-02 | V2-P1-07 | Hata `role="alert"` ile duyurulmuyor; çok adımlı kabuk yok (kırmızı) | Her hata duyurulur; sihirbaz adımları klavye ile gezilir ve durumu korunur | 2 gün |
| V2-P1-09 | Master overlay katmanı kurulur: dialog, popover, sheet, dropdown — platformlar arası tutarlı | CMP-04 | V2-P1-07 | Farklı overlay'ler farklı açılma/kapanma davranışı gösteriyor (kırmızı) | Tüm overlay'ler aynı açılma yönü, odak, Escape ve dış tıklama davranışını gösterir | 2 gün |
| V2-P1-10 | Master navigasyon katmanı kurulur: dört katmanlı advanced layered header, breadcrumb, sekme | CMP-03, FEA-01 | V2-P1-09 | Dört katmanı arayan test kırmızı | Header marka/bağlam/eylem/navigasyon katmanlarını taşır, 320'de daralır, klavye ile gezilir | 2 gün |
| V2-P1-11 | Master yerleşim katmanı ve sol/sağ panel kurulur | CMP-06, CMP-03 | V2-P1-10 | Panel yok; odak tuzağı testi kırmızı | Sol panel 320'de gizli 1024'te kalıcı; sağ panel 1280'de açılır, içeriği ezmez, kapatılabilir | 2 gün |
| V2-P1-12 | Master veri görselleştirme primitifleri kurulur (kütüphanesiz, ekran okuyucuya okunur) | CMP-08 | V2-P1-11 | Grafik primitifi yok; ana pakete kütüphane girme testi yok (kırmızı) | Primitifler metin alternatifi taşır; ana pakette grafik kütüphanesi yok | 2 gün |
| V2-P1-13 | Master medya/dosya bileşenleri kurulur: dosya kartı, önizleme, yükleyici kabuğu | MED-01, CMP-06 | V2-P1-11 | Yükleyici kabuğu taşıma katmanı olmadan sessizce dosya kabul ediyor (kırmızı) | Taşıma katmanı yokken yükleyici gerekçesiyle kapalı; önizleme sekiz durumu taşır | 2 gün |

#### P1-C. Storybook zorunlu katalog (3)

| ID | Tek görev / sonuç | Ana roller | Bağımlılık | Anlamlı RED | GREEN kabul kriteri | Süre |
|---|---|---|---|---|---|---|
| V2-P1-14 | Katalog mimarisi kurulur: her kayıtlı bileşen için kendi girişi ve soyağacı bilgisi | CMP-07 | V2-P0-05, V2-P1-13 | Bugün 10 `Meta` var ve 75 bileşenin 0'ının kendi girişi var (kırmızı) | Kayıtlı her bileşenin kendi katalog girişi ve girişte atası/türevleri yazılı | 2 gün |
| V2-P1-15 | Katalog boyutları zorlanır: varyant, sekiz durum, 320px, dark/light, etkileşim | CMP-07, UXD-08 | V2-P1-14 | Boyut eksik olan giriş kapıdan geçiyor (kırmızı) | Beş boyutu eksik bir giriş kapıyı kırar; mevcut 89 story korunur ve girişlere dağıtılır | 2 gün |
| V2-P1-16 | Story üzerinde erişilebilirlik ve görsel regresyon kapısı CI'ya bağlanır | QLT-05, QLT-09 | V2-P1-15 | Story başına axe ve görsel eşik kapısı yok (kırmızı) | Her katalog girişi axe critical/serious = 0 ve görsel eşik taşır; eşik aşımı build'i düşürür | 2 gün |

#### P1-D. Uygulama kabuğu ve bilgi mimarisi (6)

| ID | Tek görev / sonuç | Ana roller | Bağımlılık | Anlamlı RED | GREEN kabul kriteri | Süre |
|---|---|---|---|---|---|---|
| V2-P1-17 | Kabuk sözleşmesi birleştirilir ve cihaz merdiveni uygulanır (320→1440+) | FEA-01 | V2-P1-16 | Header, paneller ve içerik ayrı sözleşmelerde (kırmızı) | Tek kabuk sözleşmesi; on genişlikte de yolculuk testleri geçer | 2 gün |
| V2-P1-18 | Bilgi mimarisi ve hedef rota haritası kanonikleşir | FEA-02, PRD-02 | V2-P1-17 | Rota kütüğü ile hedef harita uyuşmuyor (kırmızı) | Kütük ve gerçek rota ağacı iki yönde de eşleşir; her rota a11y taramasına girer | 2 gün |
| V2-P1-19 | Global arama yüzeyi kurulur | CMP-03, DAT-03 | V2-P1-18 | Arama yok; test kırmızı | Klavye ile açılır, sonuç gruplanır, sekiz durumu taşır | 2 gün |
| V2-P1-20 | Komut paleti kurulur | CMP-04, FEA-02 | V2-P1-19 | Palet yok; kısayol testi kırmızı | Kısayolla açılır, rota ve eylem çalıştırır, ekran okuyucuya duyurulur | 2 gün |
| V2-P1-21 | Kiracı / organizasyon menüsü kurulur | CMP-03, FEA-03 | V2-P1-18 | Menü yok; test kırmızı | Aktif organizasyon görünür; değiştirme akışı çalışır veya gerekçeli kapalıdır | 2 gün |
| V2-P1-22 | Bildirim merkezi ve içgörü akışı kabuğu kurulur | CMP-03, AIX-02 | V2-P1-18 | Bildirim merkezi yok (kırmızı) | Okunmamış sayacı, gruplama ve derin bağlantı çalışır; veri yoksa dürüst boş durum | 2 gün |

#### P1-E. Sözleşme, port ve URL durumu (3)

| ID | Tek görev / sonuç | Ana roller | Bağımlılık | Anlamlı RED | GREEN kabul kriteri | Süre |
|---|---|---|---|---|---|---|
| V2-P1-23 | Tipli frontend port/adaptör sözleşmesi kurulur ve OpenAPI istemci üretim zinciri hazırlanır | FEA-04, FEA-06 | V2-P1-17 | Tek port var (`ProviderConnectionPort`); diğer yüzeyler doğrudan çağrı varsayıyor (kırmızı) | Backend'e bağlı her eylem tipli port arkasında; port çıktısı `.strict()` Zod ile doğrulanır | 2 gün |
| V2-P1-24 | Dürüst mock/demo adaptörü ve "canlı değil" işaretleme muhafızı kurulur | QLT-03, PRD-05 | V2-P1-23 | İşaretlenmemiş bir mock adaptör testten geçiyor (kırmızı) | Her mock adaptör açıkça işaretli; işaretsiz adaptör muhafızda düşer; yetenek kütüğü engelli ilan eder | 2 gün |
| V2-P1-25 | URL durumu uygulama geneline yayılır ve Zod ile doğrulanır | FEA-03, DAT-05 | V2-P1-23 | URL durumu yalnız grid kapsamında; şema doğrulaması yok (kırmızı) | Her filtrelenebilir yüzey paylaşılabilir adres üretir; şema uyuşmazlığı yanlış okunmaz | 2 gün |

#### P1-F. Kamuya açık yüzey (4)

| ID | Tek görev / sonuç | Ana roller | Bağımlılık | Anlamlı RED | GREEN kabul kriteri | Süre |
|---|---|---|---|---|---|---|
| V2-P1-26 | Hero landing, değer anlatımı ve dönüşüm hunisi kurulur | UXD-06, PRD-04 | V2-P1-22 | Hero, sosyal kanıt ve çağrı-eylem hunisi yok (kırmızı) | Ziyaretçi ürünü anlar ve kaydolma akışına girer; hiçbir hak/tutar iddiası kurulmaz | 2 gün |
| V2-P1-27 | Fiyatlandırma, referans ve danışmanlık hattı tanıtım yüzeyleri kurulur | UXD-06, PRD-04 | V2-P1-26 | Fiyat ve danışmanlık hattı hiçbir yerde görünmüyor (kırmızı) | Fiyat ve danışmanlık teklifi görünür; rakam kaynağı owner kararına bağlı olarak işaretlenir | 2 gün |
| V2-P1-28 | İçerik merkezi kurulur: kaynak/blog, SSS, hakkımızda, iletişim, yasal metinler | UXD-07, PRD-02 | V2-P1-26 | Bu yüzeylerin hiçbiri yok (kırmızı) | Her yüzey içerik-öncelikli, 320'de okunur ve sekiz durumu taşır | 2 gün |
| V2-P1-29 | SEO ve paylaşım üstverisi kurulur; kamuya açık yüzeyin performans ve a11y kapıları ölçülür | FEA-02, QLT-06 | V2-P1-28 | Meta/OG üstverisi yok; kamuya açık yüzey ayrı ölçülmemiş (kırmızı) | Her kamuya açık rota doğru meta/OG taşır; ölçüm raporlanır | 2 gün |

#### P1-G. Kimlik, organizasyon ve ekip (5)

| ID | Tek görev / sonuç | Ana roller | Bağımlılık | Anlamlı RED | GREEN kabul kriteri | Süre |
|---|---|---|---|---|---|---|
| V2-P1-30 | Kayıt, giriş, çıkış ve oturum yolculuğu enterprise seviyede tamamlanır | CMP-02, QLT-07 | V2-P1-25 | Yolculuk sekiz durumu taşımıyor; hata yüzeyleri eksik (kırmızı) | Yolculuk baştan sona 320'de yürür; her hata durumu adıyla görünür | 2 gün |
| V2-P1-31 | Parola sıfırlama ve e-posta doğrulama yüzeyleri kurulur | CMP-02, QLT-07 | V2-P1-30 | Yetenek engelli; akış yüzeyi hiç yok (kırmızı) | Yüzeyler tam ve olgun; backend ucu gelene kadar port dürüst mock durumunda ve kütükte engelli | 2 gün |
| V2-P1-32 | İki adımlı doğrulama, aktif oturum listesi ve güvenlik ayarları yüzeyi kurulur | QLT-07, CMP-02 | V2-P1-31 | Güvenlik ayarlarında yalnız çıkış var (kırmızı) | 2FA ve oturum listesi yüzeyleri tam; her kapalı kontrolün gerekçesi ekranda yazılı | 2 gün |
| V2-P1-33 | Organizasyon profili tam okuma-yazma döngüsüne ve bağlı şirket yapısına kavuşur | CMP-02, FEA-04 | V2-P1-30 | Profil yazılıyor ama geri okunamıyor (kırmızı) | Kaydedilen değer geri okunur; kısmi-veri durumu adıyla görünür | 2 gün |
| V2-P1-34 | Ekip, davet, rol matrisi ve yetki durumları yüzeyi kurulur | CMP-02, QLT-07 | V2-P1-31 | Çok kullanıcı ve rol yüzeyi yok (kırmızı) | Rol matrisi görünür; yetki dışı her eylem "yetki" durumuyla açıklanır, sessizce gizlenmez | 2 gün |

#### P1-H. Fırsat, uygunluk ve karar (5)

| ID | Tek görev / sonuç | Ana roller | Bağımlılık | Anlamlı RED | GREEN kabul kriteri | Süre |
|---|---|---|---|---|---|---|
| V2-P1-35 | Fırsat keşif yüzeyi kurulur: kurum evreni ve nakit dışı destekler dahil | RES-01, RES-02, RES-03, DAT-01 | V2-P1-33 | Yüzey üç programa ve yalnız nakit desteğe bağlı (kırmızı) | Kurum evreni ve nakit dışı destek tipleri filtrelenir; her kayıt kaynağını gösterir | 2 gün |
| V2-P1-36 | Proaktif fırsat ve içgörü akışı yüzeyi kurulur | AIX-02, RES-01 | V2-P1-35 | Kullanıcı sormadan gelen akış yok (kırmızı) | Yeni/değişen fırsat gerekçesiyle düşer ve derin bağlantı verir; veri yoksa dürüst boş durum | 2 gün |
| V2-P1-37 | Kaynak kütüğü, tazelik ve değişiklik farkı (diff) yüzeyi kurulur | RES-05, CMP-05 | V2-P1-35 | Snapshot farkı gösterilemiyor (kırmızı) | İki yakalama arasındaki fark görünür; bilinmeyen tarih uydurulmaz, em-dash görünür | 2 gün |
| V2-P1-38 | Uygunluk sihirbazı çok adımlı, dallanan ve kalıcı hâle gelir | CMP-02, FEA-03 | V2-P1-34 | Sihirbaz yeniden açılınca cevaplar kayboluyor (kırmızı) | Cevaplar port üzerinden geri okunur; yarım kalan sihirbaz devam eder | 2 gün |
| V2-P1-39 | Karar tezgâhı derinleştirilir: kural izi, kanıt, karşılaştırma, risk/güven göstergesi | DAT-01, CMP-06, PRD-01 | V2-P1-38 | Derin kural izi, çoklu karşılaştırma ve risk göstergesi yok (kırmızı) | Her koşulun hangi olguda takıldığı satır satır görünür; kalibre edilmemiş gösterge "editoryal" etiketlenir | 2 gün |

#### P1-I. Master DataGrid ve on bir görünüm modu (6)

| ID | Tek görev / sonuç | Ana roller | Bağımlılık | Anlamlı RED | GREEN kabul kriteri | Süre |
|---|---|---|---|---|---|---|
| V2-P1-40 | Grid çekirdeği yeniden sözleşmelenir: kolon yönetimi, filtre, çoklu sıralama, seçim, toplu işlem, satır içi düzenleme | DAT-01, DAT-03 | V2-P1-39 | Tüketiciler kendi tablosunu yazabiliyor; satır içi düzenleme ve toplu işlem yok (kırmızı) | Tek sözleşme; elle yazılmış tablo mimari testinde düşer; altı yetenek de klavye ile çalışır | 2 gün |
| V2-P1-41 | Görünüm modları I: list, group, json | DAT-02 | V2-P1-40 | Üç mod da yok (kırmızı) | Üç mod aynı master üzerinde çalışır, klavye ve ekran okuyucu uyumlu | 2 gün |
| V2-P1-42 | Görünüm modları II: kanban, calendar, timeline | DAT-02, CMP-06 | V2-P1-41 | Üç mod da yok (kırmızı) | Üç mod aynı master üzerinde çalışır; sürükle-bırak klavye ile de yapılır | 2 gün |
| V2-P1-43 | Görünüm modları III: pivot, dashboard, form | DAT-02, CMP-08 | V2-P1-42 | Üç mod da yok (kırmızı) | Üç mod aynı master üzerinde çalışır; pivot boyutları kullanıcı tanımlı | 2 gün |
| V2-P1-44 | Sunucu taraflı grid sözleşmesi port olarak tanımlanır; kayıtlı görünüm paylaşımı kurulur | DAT-04, DAT-05, FEA-04 | V2-P1-43 | Grid "client-side by construction"; kayıtlı görünüm yalnız bu tarayıcıda (kırmızı) | Sayfalama/filtre/sıralama/toplu işlem port sözleşmesinden gelir; kayıtlı görünüm paylaşım yüzeyi tam, arka uç gelene kadar kütükte engelli | 2 gün |
| V2-P1-45 | Grid ileri yetenekleri tamamlanır: komut kısayolları, gömülü grafik, sözleşmeye bağlı dışa aktarma | DAT-05, CMP-08 | V2-P1-44 | Komut kısayolu bağlı değil; gömülü grafik yok; yalnız CSV var (kırmızı) | Kısayollar klavye ile çalışır ve duyurulur; gömülü grafik lazy chunk'ta kalır; mevcut URL durumu / kayıtlı görünüm / CSV testleri değişmeden yeşil kalır | 2 gün |

#### P1-J. Başvuru operasyonu, görev ve takvim (4)

| ID | Tek görev / sonuç | Ana roller | Bağımlılık | Anlamlı RED | GREEN kabul kriteri | Süre |
|---|---|---|---|---|---|---|
| V2-P1-46 | Başvuru hattı liste, detay ve durum akışı yüzeyi kurulur | PRD-02, DAT-01 | V2-P1-45 | `Application` yüzeyi yok (kırmızı) | Başvuru oluşturulur, listelenir, detayı ve durumu görünür; sekiz durum tam | 2 gün |
| V2-P1-47 | Başvuru kanban görünümü ve belge kontrol listesi kurulur | DAT-02, CMP-02 | V2-P1-46 | Kanban ve kontrol listesi yok (kırmızı) | Başvurular durum sütunlarında klavyeyle de taşınır; kontrol listesi port üzerinden kalıcıdır | 2 gün |
| V2-P1-48 | Görev panosu kurulur | PRD-02, DAT-02 | V2-P1-47 | `Task` yüzeyi yok (kırmızı) | Görev atanır, tamamlanır, filtrelenir ve başvuruya bağlanır | 2 gün |
| V2-P1-49 | Takvim yüzeyi kurulur | DAT-02, RES-05 | V2-P1-48 | Takvim yüzeyi yok; uydurma tarih riski açık (kırmızı) | Yalnız gerçek tarihli olaylar görünür; bilinmeyen pencere uydurma tarih üretmez | 2 gün |

#### P1-K. Medya ve dosya kütüphanesi (4)

| ID | Tek görev / sonuç | Ana roller | Bağımlılık | Anlamlı RED | GREEN kabul kriteri | Süre |
|---|---|---|---|---|---|---|
| V2-P1-50 | Kütüphane kabuğu kurulur: klasör ağacı, ızgara/liste, arama, filtre, toplu işlem | MED-01, DAT-03 | V2-P1-13 | Varlık listesi ve klasör ağacı gerçekten boş (kırmızı) | Kabuk tam ve olgun; veri yokken dürüst boş durum, ölçülmemiş değer em-dash | 2 gün |
| V2-P1-51 | Yükleme yöneticisi ve dirençli yükleme portu kurulur | MED-02, FEA-04 | V2-P1-50 | Yükleyici taşıma katmanı olmadığı için kapalı; port sözleşmesi yok (kırmızı) | Parçalı/sürdürülebilir yükleme portu tipli; yerel depolama varsayılan, S3 opsiyonel; taşıma yokken yükleyici gerekçesiyle kapalı | 2 gün |
| V2-P1-52 | Üstveri, önizleme, sürüm geçmişi ve varlık bağları yüzeyi kurulur | MED-01 | V2-P1-51 | Üstveri editörü, sürüm listesi ve varlık bağı yok (kırmızı) | Üstveri düzenlenir, sürümler listelenir, dosya bir başvuruya bağlanır | 2 gün |
| V2-P1-53 | Medya yönetişimi, izin durumları ve denetim yüzeyi kurulur | MED-01, QLT-07 | V2-P1-52 | Toplu işlem izin kontrolüne tabi değil (kırmızı) | Her toplu işlem izin kontrolüne tabidir; yetkisiz eylem "yetki" durumuyla açıklanır | 2 gün |

#### P1-L. AI sağlayıcıları ve AI-first yüzeyler (6)

| ID | Tek görev / sonuç | Ana roller | Bağımlılık | Anlamlı RED | GREEN kabul kriteri | Süre |
|---|---|---|---|---|---|---|
| V2-P1-54 | Sağlayıcı bağlantı merkezi broker portu üzerinden kurulur (Gemini, OpenClaw, Claude, ChatGPT — hesap ve API) | AIX-01, QLT-07 | V2-P1-32 | Sihirbaza port verilmiyor; her izin `false` (kırmızı) | Bağlantı yüzeyi tam; hiçbir gizli değer tarayıcıya inmez; broker yokken yüzey gerekçesiyle kapalı | 2 gün |
| V2-P1-55 | Sağlayıcı sağlık, yönlendirme, denetim izi ve karşılaştırma matrisi erişilebilir hâlde kurulur | AIX-01, QLT-05 | V2-P1-54 | `ProviderComparison` mount edilmiyor; `scrollable-region-focusable` serious ihlali (kırmızı) | Matris mount edilir; axe critical/serious = 0; yönlendirme kararının sunucuya ait olduğu ekranda yazılı | 2 gün |
| V2-P1-56 | AI çalışma alanı ve çok kanallı giriş kurulur: form, sohbet, belge yükleme, ses | AIX-02, CMP-02 | V2-P1-55 | Dört kanaldan hiçbiri yok (kırmızı) | Aynı iş dört kanaldan da başlatılır; her çıktı kaynağına bağlı, hiçbiri hak/tutar iddiası kurmaz | 2 gün |
| V2-P1-57 | Master + uzman ajan orkestrasyon yüzeyi kurulur | AIX-02, PRD-01 | V2-P1-56 | Ajan çalışma alanı yok; risk ayrımı yüzeyde yok (kırmızı) | Düşük risk otomatik, yüksek risk insan onaylı ayrımı yüzeyde görünür ve zorlanır | 2 gün |
| V2-P1-58 | ECA kural yüzeyi, katmanlı hafıza ve sürümlü beceri yüzeyi kurulur | AIX-02, QLT-03 | V2-P1-57 | Otomasyon kuralı tanımlanamıyor; hafıza katmanları ve beceri sürümü görünmüyor (kırmızı) | Kullanıcı kural tanımlar ve denemesini görür; katmanlar ayrı görünür; öğrenme ve unutma açık kurallarla yönetilir | 2 gün |
| V2-P1-59 | Belge zekâsı yüzeyi kurulur: alan çıkarımı portu, her alanın kaynağı ve güven değeri, insan doğrulaması | MED-01, AIX-02, PRD-05 | V2-P1-52, V2-P1-55 | Doğrulanmamış bir alanı doğrulanmış gösteren kasıtlı stub testten geçiyor (kırmızı) | Her çıkarılmış alan kaynağını ve güven değerini taşır; doğrulanmamış alan hiçbir yüzeyde doğrulanmış görünmez; ölçülmemiş güven `0` değil em-dash; OCR backend'i P5'tedir ve yüzey o gelene kadar kütükte engellidir | 2 gün |

#### P1-M. Dijital ikiz, senaryo ve analitik (4)

| ID | Tek görev / sonuç | Ana roller | Bağımlılık | Anlamlı RED | GREEN kabul kriteri | Süre |
|---|---|---|---|---|---|---|
| V2-P1-60 | Dijital ikiz yüzeyi kurulur | PRD-02, RES-02 | V2-P1-39 | Şirketin yaşayan modeli yok (kırmızı) | İkiz sürümlüdür, her alanın kaynağı görünür, eksik olgu adıyla söylenir | 2 gün |
| V2-P1-61 | Senaryo ve simülasyon tezgâhı kurulur | RES-01, DAT-02 | V2-P1-60 | Senaryo karşılaştırması yok (kırmızı) | İki senaryo yan yana konur; hiçbir çıktı "alacağınız para" olarak sunulmaz | 2 gün |
| V2-P1-62 | Analitik ve finansal etki panosu kurulur | CMP-08, DAT-02, PRD-04 | V2-P1-45, V2-P1-61 | Finansal etki gösterilemiyor; ölçülmemiş değeri `0` gösteren kasıtlı stub testten geçiyor (kırmızı) | Her değer hangi karara, kurala ve kaynağa dayandığını gösterir; ölçülmemiş değer em-dash; grafik lazy chunk'ta kalır | 2 gün |
| V2-P1-63 | Yönetici kokpiti ve raporlama yüzeyi kurulur | PRD-04, DAT-02 | V2-P1-62 | Kokpit tek bir yolculuğa bağlı değil (kırmızı) | Kokpit içgörüden aksiyona derin bağlantı verir; her sayının kaynağı görünür | 2 gün |

#### P1-N. Ticarileşme, i18n, entegrasyon ve yönetişim yüzeyleri (6)

| ID | Tek görev / sonuç | Ana roller | Bağımlılık | Anlamlı RED | GREEN kabul kriteri | Süre |
|---|---|---|---|---|---|---|
| V2-P1-64 | CRM ve danışmanlık hattı yüzeyi kurulur | PRD-04, PRD-02 | V2-P1-46 | Danışmanlık hattı hiçbir yerde görünmüyor (kırmızı) | Müşteri danışman talep eder; danışman başvuruyu görür ve yürütür | 2 gün |
| V2-P1-65 | Faturalama, abonelik ve kullanım yüzeyi kurulur | PRD-04, QLT-07 | V2-P1-64 | Para tahsil yüzeyi yok (kırmızı) | Abonelik seçilir, fatura ve kullanım görünür; para string taşınır ve `Intl` ile gösterilir | 2 gün |
| V2-P1-66 | i18n altyapısı kurulur; Türkçe ve İngilizce tam | QLT-08, UXD-07 | V2-P1-65 | Metinler kaynağa gömülü (kırmızı) | Dil değişince tüm arayüz çevrilir; tarih UTC taşınır, `Intl` ile biçimlenir | 2 gün |
| V2-P1-67 | Country pack çerçevesi kurulur (Türkiye-first, international-ready) | RES-04, QLT-08 | V2-P1-66 | İkinci ülke eklenemiyor (kırmızı) | İkinci ülke paketi çekirdeği değiştirmeden eklenir | 2 gün |
| V2-P1-68 | Entegrasyon, webhook, API anahtarı ve hesap ayarları yüzeyleri kurulur | FEA-04, QLT-07 | V2-P1-64 | Bu yüzeylerin hiçbiri yok (kırmızı) | Yüzeyler tam; hiçbir gizli değer tarayıcı deposuna yazılmaz | 2 gün |
| V2-P1-69 | Denetim izi ve onay kuyruğu yüzeyi kurulur | PRD-05, DAT-01 | V2-P1-34, V2-P1-45 | Denetim izi ve onay listesi yüzeyi yok (kırmızı) | Kim, ne zaman, neyi onayladı listelenir; kayıt yüzeyde değiştirilemez | 2 gün |

#### P1-O. Enterprise kalite kapıları ve P1 teslimi (7)

| ID | Tek görev / sonuç | Ana roller | Bağımlılık | Anlamlı RED | GREEN kabul kriteri | Süre |
|---|---|---|---|---|---|---|
| V2-P1-70 | Erişilebilirlik tam turu yapılır: otomatik axe + manuel ekran okuyucu | QLT-05 | V2-P1-69 | Manuel ekran okuyucu turu hiç yapılmamış (UNVERIFIED) | Otomatik axe temiz; manuel tur raporlanır ve bulguları kapatılır | 2 gün |
| V2-P1-71 | Çapraz tarayıcı ve gerçek cihaz doğrulaması: WebKit, Firefox, gerçek iOS Safari | QLT-04, QLT-09 | V2-P1-70 | Yalnız Chromium ve Chromium tabanlı emülasyon test edilmiş (UNVERIFIED) | Üç tarayıcıda ve gerçek bir iPhone sınıfı cihazda yolculuk testleri geçer | 2 gün |
| V2-P1-72 | Performans bütçeleri ölçülür ve CI kapısına bağlanır | QLT-06, FEA-05 | V2-P1-69 | LCP/INP/CLS hiç ölçülmemiş (kırmızı) | Üç metrik ölçülür, bütçe tanımlanır, aşım build'i düşürür; bütçe yükseltilmez, kod küçültülür | 2 gün |
| V2-P1-73 | Güvenlik sertleştirme: CSP, CSRF, ortam değişkeni doğrulama, bağımlılık taraması | QLT-07, OPS-01 | V2-P1-68 | CSP ve env doğrulama yok (kırmızı) | Dört kapı da CI'da koşar; eksik env production'da değil build'de patlar | 2 gün |
| V2-P1-74 | Uçtan uca yolculuk e2e paketi tamamlanır (mock adaptör açık ve etiketli) | QLT-04 | V2-P1-71 | Yolculukların çoğunun e2e karşılığı yok (kırmızı) | Envanterdeki her yolculuk tarayıcıda yürür; her spec `[mocked backend]` etiketli | 2 gün |
| V2-P1-75 | Frontend CI gerçekten koşar ve görsel regresyon temel çizgisi alınır | OPS-01, QLT-09 | V2-P1-73, V2-P1-72 | `frontend-ci.yml` GitHub'da hiç koşmamış (UNVERIFIED) | CI koşar, tüm kapılar yeşil, koşu bağlantısı ve görsel temel çizgi kanıt paketinde | 2 gün |
| V2-P1-76 | P1 teslim kanıt paketi derlenir: yolculuk envanteri, ekran envanteri, Storybook kapsam raporu, cihaz merdiveni kanıtı | OPS-03, PRD-04, QLT-02 | V2-P1-74, V2-P1-75 | Tek bir teslim kanıt paketi yok (kırmızı) | Envanterlerin tamamı GREEN; Storybook kapsamı 75/75; on genişlikte kanıt ekli; **backend UNVERIFIED olarak adıyla listelenir** ve ürün production'a hazır ilan edilmez | 2 gün |

### H1 — Sahip ürünü müşteriye gösterir (milestone değildir, efora girmez)

| Alan | Değer |
|---|---|
| Ne olur | P1 teslimi sahibe verilir; sahip ürünü müşteriye gösterir |
| Milestone sayısı | **0** — bu bir devir/bilgilendirme noktasıdır |
| Onay kapısı mı | **Hayır** |
| Dur/geç (stop-go) kapısı mı | **Hayır** |
| Geliştirmeyi bloke eder mi | **Hayır.** `V2-P3-01` ve sonrası bu gösterimden bağımsız ilerler |
| Müşteri ne diyecek | **Bilinmiyor ve uydurulmaz.** Bu belge hiçbir müşteri geri bildirimi varsaymaz |
| Somut talep gelirse | Sahip talebi verir; her somut değiştirme/silme/ekleme P2'de kendi milestone'u olur |

### P2 — Bileşen değiştirme / silme / ekleme talep alımı (1 milestone + talep başına milestone)

> **Bu faz "bileşen olgunlaştırma" değildir ve öyle adlandırılamaz.** P1'de teslim edilen
> bileşenler zaten enterprise ve olgundur. P2 yalnız üç işi tanır: **değiştirme, silme,
> ekleme** — ve yalnız sahip somut bir talimat verdiğinde.

| ID | Tek görev / sonuç | Ana roller | Bağımlılık | Anlamlı RED | GREEN kabul kriteri | Süre |
|---|---|---|---|---|---|---|
| V2-P2-01 | Bileşen değiştirme / silme / ekleme talep alım mekanizması kurulur: talep şablonu, soyağacı etki analizi, yeniden kullanılabilir RED şablonu, regresyon sözleşmesi | PRD-03, CMP-01, QLT-01 | V2-P1-76 | Somut bir bileşen değişikliği talebi geldiğinde onu milestone'a çevirecek şablon, etki analizi ve RED iskeleti yok (kırmızı) | Bir örnek talep uçtan uca mekanizmadan geçirilir: etkilenen ata/türev listesi üretilir, RED yazılır, regresyon sözleşmesi çıkar. **Somut talepler için milestone önceden yazılmaz** | 2 gün |

**Talep başına milestone kuralı.** Sahip somut bir değiştirme/silme/ekleme talebi
verdiğinde, o talep `V2-P2-C01`, `V2-P2-C02` … kimliğiyle **yeni bir satır** olarak açılır.
Her satır: tek görev, ortalama 2 gün, anlamlı RED, GREEN kabul kriteri, soyağacı etki
listesi ve rollback yolu taşır. Bağımlılığı `V2-P2-01` ve **sahibin verdiği talep**tir
(harici, owner kaynaklı).

**Bugün bu kimliklerden hiçbiri açık değildir ve sayıları sıfırdır.** Bu belge müşteri
geri bildirimini tahmin etmez; olmayan bir talebi milestone'a çevirmez.

### P3 — Backend çatısı (8 milestone)

| ID | Tek görev / sonuç | Ana roller | Bağımlılık | Anlamlı RED | GREEN kabul kriteri | Süre |
|---|---|---|---|---|---|---|
| V2-P3-01 | FastAPI çatısı ve modüler monolit iskeleti kurulur: katman sınırları, modül sınırları, bağımlılık yönü | BKE-01, BKE-02 | V2-P1-76 | Modül sınırını ihlal eden kasıtlı import testten geçiyor (kırmızı) | Katman ve modül sınırları mimari testiyle zorlanır; ihlal build'i düşürür | 2 gün |
| V2-P3-02 | Yapılandırma, ortam değişkeni doğrulama ve gizli değer yönetimi kurulur | BKE-01, QLT-07 | V2-P3-01 | Eksik env production'da patlıyor, başlangıçta değil (kırmızı) | Eksik veya geçersiz env uygulama açılışında adıyla patlar; hiçbir gizli değer log'a düşmez | 2 gün |
| V2-P3-03 | Veri tabanı, migration ve şema yönetişimi kurulur | BKE-03 | V2-P3-02 | Migration olmadan şema değişikliği geçiyor (kırmızı) | Her şema değişikliği migration'a bağlı; ileri ve geri alma denenmiş | 2 gün |
| V2-P3-04 | Kimlik doğrulama, oturum, CSRF ve güvenlik temeli kurulur | BKE-05, QLT-07 | V2-P3-03 | Oturum ve CSRF sözleşmesi yok (kırmızı) | Kayıt/giriş/çıkış uçları çalışır; httpOnly cookie disiplini ve CSRF kapısı testli | 2 gün |
| V2-P3-05 | OpenAPI sözleşme kapısı kurulur ve frontend portlarına bağlanır | BKE-04, FEA-04 | V2-P3-04 | Spec değişip istemci güncellenmediğinde build geçiyor (kırmızı) | Pydantic → OpenAPI → üretilmiş istemci zinciri CI'da doğrulanır; spec kayması build'i kırar | 2 gün |
| V2-P3-06 | Hata modeli, günlükleme, izlenebilirlik ve denetim temeli kurulur | BKE-01, OPS-03 | V2-P3-04 | Hata gövdeleri tutarsız; denetim kaydı yok (kırmızı) | Tek hata sözleşmesi; her yazma işlemi denetime düşer; log'da PII yok | 2 gün |
| V2-P3-07 | Backend test altyapısı ve CI kapısı kurulur | BKE-01, OPS-01 | V2-P3-05, V2-P3-06 | Backend tarafında tek komutlu kapı yok (kırmızı) | Tek komut lint+typecheck+test+migration kontrolü koşar; CI'da gerçekten koşar ve kanıtı alınır | 2 gün |
| V2-P3-08 | Dağıtım iskeleti kurulur: Docker imajı, `linux/amd64`, Hetzner hedefi | OPS-02, BKE-01 | V2-P3-07 | Çalıştırılabilir bir imaj ve dağıtım yolu yok (kırmızı) | İmaj `linux/amd64` için üretilir ve ayağa kalkar; `x86-64-v2` daraltması yapılmaz | 2 gün |

### P4 — Modül öncesi ortak ön gereksinimler (12 milestone)

> **Kural:** Bu on iki kalem, modüllerden **önce** planlanması ve geliştirilmesi zorunlu
> ortak katmanlardır. Hiçbir P5 modülü, bağlı olduğu P4 kalemi GREEN olmadan başlamaz.

| ID | Tek görev / sonuç | Ana roller | Bağımlılık | Anlamlı RED | GREEN kabul kriteri | Süre |
|---|---|---|---|---|---|---|
| V2-P4-01 | Çok kiracılılık (tenant) ve veri izolasyonu kurulur | BKE-02, BKE-03 | V2-P3-08 | Kiracı sınırını aşan sorgu testten geçiyor (kırmızı) | Her sorgu kiracıya bağlı; sızıntı denemesi testte düşer | 2 gün |
| V2-P4-02 | Rol, izin ve yetki motoru (RBAC) kurulur | BKE-05 | V2-P4-01 | Rol modeli domainde tanımlı değil (kırmızı) | Rol ve izin sunucuda zorlanır; frontend yalnız görünürlük yönetir | 2 gün |
| V2-P4-03 | Taksonomi / tip / düğüm / durum meta modeli kurulur | BKE-03, BKE-02 | V2-P4-01 | Tip ve durum modeli her modülde yeniden yazılıyor (kırmızı) | Tek meta model; modüller onu tüketir, kendi kopyasını kurmaz | 2 gün |
| V2-P4-04 | Kaynak kütüğü, snapshot, içerik hash'i ve tazelik altyapısı kurulur | RES-05, BKE-03 | V2-P4-03 | Kaynak başına yakalama tarihi ve hash tutulmuyor (kırmızı) | Her kaynak kendi yakalama tarihini, hash'ini ve yürürlük tarihini taşır; bilinmeyen uydurulmaz | 2 gün |
| V2-P4-05 | Dosya depolama portu ve yerel adaptör kurulur (S3 opsiyonel) | BKE-01, MED-02 | V2-P4-01 | Depolama adaptörü ve `media_assets` tablosu yok (kırmızı) | Yerel adaptör varsayılan; S3 yapılandırılmasa da ürün tam çalışır | 2 gün |
| V2-P4-06 | İş kuyruğu, zamanlanmış görev ve arka plan işçisi altyapısı kurulur | BKE-07 | V2-P4-01 | Arka plan işi çalıştıracak altyapı yok (kırmızı) | Kuyruk, yeniden deneme ve ölü mektup davranışı testli | 2 gün |
| V2-P4-07 | Bildirim altyapısı kurulur: kanal, şablon, teslim kaydı | BKE-07 | V2-P4-06 | Bildirim tablosu, kanalı ve işçisi yok (kırmızı) | Bildirim üretilir, kanala düşer, teslim durumu kaydedilir | 2 gün |
| V2-P4-08 | Denetim izi ve onay altyapısı kurulur | BKE-01, PRD-05 | V2-P4-02 | `ApprovalOut` şeması hiçbir route'ta kullanılmıyor; denetim HTTP ucu yok (kırmızı) | Onay ve denetim uçları çalışır; kayıt değiştirilemez | 2 gün |
| V2-P4-09 | AI sağlayıcı broker'ı ve gizli değer kasası kurulur | BKE-08, QLT-07 | V2-P4-02 | Sağlayıcı kimlik bilgisi tutacak sunucu tarafı broker yok (kırmızı) | Kimlik bilgileri kasada; OAuth takası sunucuda; sağlık yoklaması ve yönlendirme sunucu kararı | 2 gün |
| V2-P4-10 | Arama ve indeksleme altyapısı kurulur | BKE-03 | V2-P4-03 | Global arama için sunucu tarafı indeks yok (kırmızı) | İndeks kurulur ve tazelenir; arama kiracı sınırına saygı duyar | 2 gün |
| V2-P4-11 | i18n ve country pack çekirdeği kurulur | QLT-08, BKE-02 | V2-P4-03 | Sunucu hata kodu yerine metin dönüyor (kırmızı) | Sunucu kod döner, metni istemci seçer; ülke paketi sınırı çekirdeği kırmaz | 2 gün |
| V2-P4-12 | Olay veriyolu ve ECA motoru temeli kurulur | BKE-07, AIX-02 | V2-P4-06, V2-P4-08 | Olay-koşul-aksiyon zinciri için altyapı yok (kırmızı) | Olay yayınlanır, kural değerlendirilir, aksiyon denetime yazılır | 2 gün |

### P5 — Modüler monolit modülleri (33 milestone)

> **Kural:** Her satır tek bir modüldür ve tek başına anlamlı bir ürün sonucu verir.
> "Tüm modülleri yap" gibi toplayıcı bir satır **yoktur**. Büyük alanlar iki milestone'a
> bölünmüştür. Mimari **modüler monolittir**; mikroservis değildir.
>
> **Her P5 modülünün kabul kriterine ek olarak dört kapı otomatik dahildir:**
> (1) modül sınırı mimari testiyle zorlanır ve komşu modülün içine import yapılamaz;
> (2) OpenAPI sözleşmesi üretilir ve frontend portu bu sözleşmeye bağlanır;
> (3) yetenek kütüğündeki ilgili yetenek ancak uç gerçekten çalışınca yeşile alınır;
> (4) her yazma işlemi denetim izine düşer.

| ID | Tek görev / sonuç | Ana roller | Bağımlılık | Anlamlı RED | GREEN kabul kriteri | Süre |
|---|---|---|---|---|---|---|
| V2-P5-01 | Identity / Access modülü | BKE-05 | V2-P4-02 | Identity / Access için modül sınırı, veri modeli ve HTTP sözleşmesi yok; frontend portu mock adaptörde ve yetenek kütüğünde engelli (kırmızı) | Modül kendi sınırı içinde çalışır, OpenAPI sözleşmesini üretir, frontend portu gerçek adaptöre bağlanır, ilgili yetenek kütükte yeşile alınır ve her yazma denetime düşer | 2 gün |
| V2-P5-02 | Organization modülü | BKE-03 | V2-P4-01 | Organization için modül sınırı, veri modeli ve HTTP sözleşmesi yok; frontend portu mock adaptörde ve yetenek kütüğünde engelli (kırmızı) | Modül kendi sınırı içinde çalışır, OpenAPI sözleşmesini üretir, frontend portu gerçek adaptöre bağlanır, ilgili yetenek kütükte yeşile alınır ve her yazma denetime düşer | 2 gün |
| V2-P5-03 | Investor / Investment modülü | BKE-03 | V2-P5-02 | Investor / Investment için modül sınırı, veri modeli ve HTTP sözleşmesi yok; frontend portu mock adaptörde ve yetenek kütüğünde engelli (kırmızı) | Modül kendi sınırı içinde çalışır, OpenAPI sözleşmesini üretir, frontend portu gerçek adaptöre bağlanır, ilgili yetenek kütükte yeşile alınır ve her yazma denetime düşer | 2 gün |
| V2-P5-04 | Opportunity Intelligence modülü I: program kataloğu ve kurum evreni | RES-02, BKE-03 | V2-P4-04 | Opportunity Intelligence için modül sınırı, veri modeli ve HTTP sözleşmesi yok; frontend portu mock adaptörde ve yetenek kütüğünde engelli (kırmızı) | Modül kendi sınırı içinde çalışır, OpenAPI sözleşmesini üretir, frontend portu gerçek adaptöre bağlanır, ilgili yetenek kütükte yeşile alınır ve her yazma denetime düşer | 2 gün |
| V2-P5-05 | Opportunity Intelligence modülü II: eşleştirme ve proaktif keşif | RES-01, BKE-07 | V2-P5-04 | Opportunity Intelligence için modül sınırı, veri modeli ve HTTP sözleşmesi yok; frontend portu mock adaptörde ve yetenek kütüğünde engelli (kırmızı) | Modül kendi sınırı içinde çalışır, OpenAPI sözleşmesini üretir, frontend portu gerçek adaptöre bağlanır, ilgili yetenek kütükte yeşile alınır ve her yazma denetime düşer | 2 gün |
| V2-P5-06 | Eligibility / Rule Engine modülü I: kural motoru çekirdeği | BKE-06 | V2-P5-04 | Eligibility / Rule Engine için modül sınırı, veri modeli ve HTTP sözleşmesi yok; frontend portu mock adaptörde ve yetenek kütüğünde engelli (kırmızı) | Modül kendi sınırı içinde çalışır, OpenAPI sözleşmesini üretir, frontend portu gerçek adaptöre bağlanır, ilgili yetenek kütükte yeşile alınır ve her yazma denetime düşer | 2 gün |
| V2-P5-07 | Eligibility / Rule Engine modülü II: program kural paketleri ve sürümleme | BKE-06, RES-01 | V2-P5-06 | Eligibility / Rule Engine için modül sınırı, veri modeli ve HTTP sözleşmesi yok; frontend portu mock adaptörde ve yetenek kütüğünde engelli (kırmızı) | Modül kendi sınırı içinde çalışır, OpenAPI sözleşmesini üretir, frontend portu gerçek adaptöre bağlanır, ilgili yetenek kütükte yeşile alınır ve her yazma denetime düşer | 2 gün |
| V2-P5-08 | Source / Reliability modülü | RES-05, BKE-03 | V2-P4-04 | Source / Reliability için modül sınırı, veri modeli ve HTTP sözleşmesi yok; frontend portu mock adaptörde ve yetenek kütüğünde engelli (kırmızı) | Modül kendi sınırı içinde çalışır, OpenAPI sözleşmesini üretir, frontend portu gerçek adaptöre bağlanır, ilgili yetenek kütükte yeşile alınır ve her yazma denetime düşer | 2 gün |
| V2-P5-09 | Knowledge Graph modülü | BKE-03 | V2-P5-08 | Knowledge Graph için modül sınırı, veri modeli ve HTTP sözleşmesi yok; frontend portu mock adaptörde ve yetenek kütüğünde engelli (kırmızı) | Modül kendi sınırı içinde çalışır, OpenAPI sözleşmesini üretir, frontend portu gerçek adaptöre bağlanır, ilgili yetenek kütükte yeşile alınır ve her yazma denetime düşer | 2 gün |
| V2-P5-10 | Document Intelligence modülü I: OCR ve alan çıkarım hattı | BKE-07, MED-01 | V2-P4-05 | Document Intelligence için modül sınırı, veri modeli ve HTTP sözleşmesi yok; frontend portu mock adaptörde ve yetenek kütüğünde engelli (kırmızı) | Modül kendi sınırı içinde çalışır, OpenAPI sözleşmesini üretir, frontend portu gerçek adaptöre bağlanır, ilgili yetenek kütükte yeşile alınır ve her yazma denetime düşer | 2 gün |
| V2-P5-11 | Document Intelligence modülü II: alan doğrulama ve güven yönetişimi | PRD-05, BKE-06 | V2-P5-10 | Document Intelligence için modül sınırı, veri modeli ve HTTP sözleşmesi yok; frontend portu mock adaptörde ve yetenek kütüğünde engelli (kırmızı) | Modül kendi sınırı içinde çalışır, OpenAPI sözleşmesini üretir, frontend portu gerçek adaptöre bağlanır, ilgili yetenek kütükte yeşile alınır ve her yazma denetime düşer | 2 gün |
| V2-P5-12 | AI / Agent Orchestration modülü I: ajan çalışma zamanı | BKE-08, AIX-02 | V2-P4-09 | AI / Agent Orchestration için modül sınırı, veri modeli ve HTTP sözleşmesi yok; frontend portu mock adaptörde ve yetenek kütüğünde engelli (kırmızı) | Modül kendi sınırı içinde çalışır, OpenAPI sözleşmesini üretir, frontend portu gerçek adaptöre bağlanır, ilgili yetenek kütükte yeşile alınır ve her yazma denetime düşer | 2 gün |
| V2-P5-13 | AI / Agent Orchestration modülü II: master + uzman orkestrasyonu ve onay sınırları | AIX-02, PRD-01 | V2-P5-12 | AI / Agent Orchestration için modül sınırı, veri modeli ve HTTP sözleşmesi yok; frontend portu mock adaptörde ve yetenek kütüğünde engelli (kırmızı) | Modül kendi sınırı içinde çalışır, OpenAPI sözleşmesini üretir, frontend portu gerçek adaptöre bağlanır, ilgili yetenek kütükte yeşile alınır ve her yazma denetime düşer | 2 gün |
| V2-P5-14 | Skill / Capability modülü | AIX-02 | V2-P5-13 | Skill / Capability için modül sınırı, veri modeli ve HTTP sözleşmesi yok; frontend portu mock adaptörde ve yetenek kütüğünde engelli (kırmızı) | Modül kendi sınırı içinde çalışır, OpenAPI sözleşmesini üretir, frontend portu gerçek adaptöre bağlanır, ilgili yetenek kütükte yeşile alınır ve her yazma denetime düşer | 2 gün |
| V2-P5-15 | Memory Governance modülü | AIX-02, QLT-03 | V2-P5-14 | Memory Governance için modül sınırı, veri modeli ve HTTP sözleşmesi yok; frontend portu mock adaptörde ve yetenek kütüğünde engelli (kırmızı) | Modül kendi sınırı içinde çalışır, OpenAPI sözleşmesini üretir, frontend portu gerçek adaptöre bağlanır, ilgili yetenek kütükte yeşile alınır ve her yazma denetime düşer | 2 gün |
| V2-P5-16 | Knowledge Generation modülü | RES-01, AIX-02 | V2-P5-15 | Knowledge Generation için modül sınırı, veri modeli ve HTTP sözleşmesi yok; frontend portu mock adaptörde ve yetenek kütüğünde engelli (kırmızı) | Modül kendi sınırı içinde çalışır, OpenAPI sözleşmesini üretir, frontend portu gerçek adaptöre bağlanır, ilgili yetenek kütükte yeşile alınır ve her yazma denetime düşer | 2 gün |
| V2-P5-17 | Digital Twin modülü | BKE-03, RES-02 | V2-P5-02, V2-P5-09 | Digital Twin için modül sınırı, veri modeli ve HTTP sözleşmesi yok; frontend portu mock adaptörde ve yetenek kütüğünde engelli (kırmızı) | Modül kendi sınırı içinde çalışır, OpenAPI sözleşmesini üretir, frontend portu gerçek adaptöre bağlanır, ilgili yetenek kütükte yeşile alınır ve her yazma denetime düşer | 2 gün |
| V2-P5-18 | Simulation / Scenario modülü | BKE-06 | V2-P5-17 | Simulation / Scenario için modül sınırı, veri modeli ve HTTP sözleşmesi yok; frontend portu mock adaptörde ve yetenek kütüğünde engelli (kırmızı) | Modül kendi sınırı içinde çalışır, OpenAPI sözleşmesini üretir, frontend portu gerçek adaptöre bağlanır, ilgili yetenek kütükte yeşile alınır ve her yazma denetime düşer | 2 gün |
| V2-P5-19 | Policy / Decision modülü | BKE-06, PRD-01 | V2-P5-07 | Policy / Decision için modül sınırı, veri modeli ve HTTP sözleşmesi yok; frontend portu mock adaptörde ve yetenek kütüğünde engelli (kırmızı) | Modül kendi sınırı içinde çalışır, OpenAPI sözleşmesini üretir, frontend portu gerçek adaptöre bağlanır, ilgili yetenek kütükte yeşile alınır ve her yazma denetime düşer | 2 gün |
| V2-P5-20 | Risk / Trust modülü | BKE-06, RES-06 | V2-P5-19 | Risk / Trust için modül sınırı, veri modeli ve HTTP sözleşmesi yok; frontend portu mock adaptörde ve yetenek kütüğünde engelli (kırmızı) | Modül kendi sınırı içinde çalışır, OpenAPI sözleşmesini üretir, frontend portu gerçek adaptöre bağlanır, ilgili yetenek kütükte yeşile alınır ve her yazma denetime düşer | 2 gün |
| V2-P5-21 | Notifications / Insights modülü | BKE-07 | V2-P4-07 | Notifications / Insights için modül sınırı, veri modeli ve HTTP sözleşmesi yok; frontend portu mock adaptörde ve yetenek kütüğünde engelli (kırmızı) | Modül kendi sınırı içinde çalışır, OpenAPI sözleşmesini üretir, frontend portu gerçek adaptöre bağlanır, ilgili yetenek kütükte yeşile alınır ve her yazma denetime düşer | 2 gün |
| V2-P5-22 | Application / Project / Execution modülü I: başvuru hattı | BKE-03, PRD-02 | V2-P5-07 | Application / Project / Execution için modül sınırı, veri modeli ve HTTP sözleşmesi yok; frontend portu mock adaptörde ve yetenek kütüğünde engelli (kırmızı) | Modül kendi sınırı içinde çalışır, OpenAPI sözleşmesini üretir, frontend portu gerçek adaptöre bağlanır, ilgili yetenek kütükte yeşile alınır ve her yazma denetime düşer | 2 gün |
| V2-P5-23 | Application / Project / Execution modülü II: proje yürütme ve çıktı raporlama | BKE-03, PRD-02 | V2-P5-22 | Application / Project / Execution için modül sınırı, veri modeli ve HTTP sözleşmesi yok; frontend portu mock adaptörde ve yetenek kütüğünde engelli (kırmızı) | Modül kendi sınırı içinde çalışır, OpenAPI sözleşmesini üretir, frontend portu gerçek adaptöre bağlanır, ilgili yetenek kütükte yeşile alınır ve her yazma denetime düşer | 2 gün |
| V2-P5-24 | Task / Case modülü | BKE-03 | V2-P5-22 | Task / Case için modül sınırı, veri modeli ve HTTP sözleşmesi yok; frontend portu mock adaptörde ve yetenek kütüğünde engelli (kırmızı) | Modül kendi sınırı içinde çalışır, OpenAPI sözleşmesini üretir, frontend portu gerçek adaptöre bağlanır, ilgili yetenek kütükte yeşile alınır ve her yazma denetime düşer | 2 gün |
| V2-P5-25 | Workflow / Automation modülü | BKE-07 | V2-P4-12, V2-P5-24 | Workflow / Automation için modül sınırı, veri modeli ve HTTP sözleşmesi yok; frontend portu mock adaptörde ve yetenek kütüğünde engelli (kırmızı) | Modül kendi sınırı içinde çalışır, OpenAPI sözleşmesini üretir, frontend portu gerçek adaptöre bağlanır, ilgili yetenek kütükte yeşile alınır ve her yazma denetime düşer | 2 gün |
| V2-P5-26 | CRM modülü | BKE-03, PRD-04 | V2-P5-22 | CRM için modül sınırı, veri modeli ve HTTP sözleşmesi yok; frontend portu mock adaptörde ve yetenek kütüğünde engelli (kırmızı) | Modül kendi sınırı içinde çalışır, OpenAPI sözleşmesini üretir, frontend portu gerçek adaptöre bağlanır, ilgili yetenek kütükte yeşile alınır ve her yazma denetime düşer | 2 gün |
| V2-P5-27 | Integrations modülü | BKE-04 | V2-P5-25 | Integrations için modül sınırı, veri modeli ve HTTP sözleşmesi yok; frontend portu mock adaptörde ve yetenek kütüğünde engelli (kırmızı) | Modül kendi sınırı içinde çalışır, OpenAPI sözleşmesini üretir, frontend portu gerçek adaptöre bağlanır, ilgili yetenek kütükte yeşile alınır ve her yazma denetime düşer | 2 gün |
| V2-P5-28 | Analytics modülü I: ölçüm modeli ve olay toplama | BKE-03 | V2-P5-23 | Analytics için modül sınırı, veri modeli ve HTTP sözleşmesi yok; frontend portu mock adaptörde ve yetenek kütüğünde engelli (kırmızı) | Modül kendi sınırı içinde çalışır, OpenAPI sözleşmesini üretir, frontend portu gerçek adaptöre bağlanır, ilgili yetenek kütükte yeşile alınır ve her yazma denetime düşer | 2 gün |
| V2-P5-29 | Analytics modülü II: finansal etki raporlaması | BKE-03, PRD-04 | V2-P5-28 | Analytics için modül sınırı, veri modeli ve HTTP sözleşmesi yok; frontend portu mock adaptörde ve yetenek kütüğünde engelli (kırmızı) | Modül kendi sınırı içinde çalışır, OpenAPI sözleşmesini üretir, frontend portu gerçek adaptöre bağlanır, ilgili yetenek kütükte yeşile alınır ve her yazma denetime düşer | 2 gün |
| V2-P5-30 | Billing modülü | BKE-03, QLT-07 | V2-P5-26 | Billing için modül sınırı, veri modeli ve HTTP sözleşmesi yok; frontend portu mock adaptörde ve yetenek kütüğünde engelli (kırmızı) | Modül kendi sınırı içinde çalışır, OpenAPI sözleşmesini üretir, frontend portu gerçek adaptöre bağlanır, ilgili yetenek kütükte yeşile alınır ve her yazma denetime düşer | 2 gün |
| V2-P5-31 | Audit / Governance modülü | PRD-05, BKE-01 | V2-P4-08 | Audit / Governance için modül sınırı, veri modeli ve HTTP sözleşmesi yok; frontend portu mock adaptörde ve yetenek kütüğünde engelli (kırmızı) | Modül kendi sınırı içinde çalışır, OpenAPI sözleşmesini üretir, frontend portu gerçek adaptöre bağlanır, ilgili yetenek kütükte yeşile alınır ve her yazma denetime düşer | 2 gün |
| V2-P5-32 | Taxonomy / Type / Node / State modülü | BKE-02 | V2-P4-03, V2-P5-19 | Taxonomy / Type / Node / State için modül sınırı, veri modeli ve HTTP sözleşmesi yok; frontend portu mock adaptörde ve yetenek kütüğünde engelli (kırmızı) | Modül kendi sınırı içinde çalışır, OpenAPI sözleşmesini üretir, frontend portu gerçek adaptöre bağlanır, ilgili yetenek kütükte yeşile alınır ve her yazma denetime düşer | 2 gün |
| V2-P5-33 | Platform Evolution modülü | BKE-01, PRD-05 | V2-P5-32 | Platform Evolution için modül sınırı, veri modeli ve HTTP sözleşmesi yok; frontend portu mock adaptörde ve yetenek kütüğünde engelli (kırmızı) | Modül kendi sınırı içinde çalışır, OpenAPI sözleşmesini üretir, frontend portu gerçek adaptöre bağlanır, ilgili yetenek kütükte yeşile alınır ve her yazma denetime düşer | 2 gün |

### P6 — Modül sonrası iş ve enterprise sertleştirme (12 milestone)

| ID | Tek görev / sonuç | Ana roller | Bağımlılık | Anlamlı RED | GREEN kabul kriteri | Süre |
|---|---|---|---|---|---|---|
| V2-P6-01 | Gerçek FastAPI backend karşısında uçtan uca tarayıcı yolculuğu koşar (mock routing kapalı) | QLT-04, OPS-01, FEA-04 | V2-P5-33 | Bugün her e2e spec'i `[mocked backend]` etiketli; gerçek backend karşısında koşan tek bir tarayıcı testi yok (UNVERIFIED) | Mock routing kapalıyken kayıt → giriş → profil → değerlendirme → başvuru → onay yolculuğu gerçek backend ve gerçek veritabanı karşısında yürür. **Bu GREEN olmadan production dağıtımı ve satılabilirlik kararı verilemez** | 2 gün |
| V2-P6-02 | Frontend portları gerçek adaptörlere geçirilir ve yetenek kütüğü dürüstçe terfi ettirilir | PRD-05, FEA-04 | V2-P6-01 | Yetenekler hâlâ engelli; arkasında uç olmayan bir yeteneği yeşile alan kasıtlı stub testten geçiyor (kırmızı) | Her port gerçek adaptöre geçer; bir yetenek ancak arkasındaki uç gerçekten geldiğinde yeşile alınır | 2 gün |
| V2-P6-03 | Modüller arası entegrasyon ve sözleşme regresyon paketi koşulur | QLT-02, BKE-04 | V2-P6-02 | Modüller ayrı ayrı yeşil ama birlikte koşan bir sözleşme paketi yok (kırmızı) | Tüm modül sınırları ve sözleşmeleri tek pakette doğrulanır | 2 gün |
| V2-P6-04 | Performans ve ölçek testi yapılır: yük, veri hacmi, sunucu taraflı grid | QLT-06, BKE-10 | V2-P6-03 | Gerçek veri hacmi altında hiçbir ölçüm yok (kırmızı) | Hedef hacimde yanıt süresi ve hata oranı ölçülür; sunucu taraflı grid sözleşmesi yük altında doğrulanır | 2 gün |
| V2-P6-05 | Güvenlik denetimi ve sızma testi hazırlığı tamamlanır | QLT-07, BKE-05 | V2-P6-03 | Bağımsız bir güvenlik denetimi hiç yapılmamış (UNVERIFIED) | Denetim bulguları adıyla listelenir ve kapatılır; kalan risk owner'a yazılı sunulur | 2 gün |
| V2-P6-06 | KVKK ve veri yönetişimi kurulur: saklama süreleri, silme akışları, veri işleyen sıfatı | BKE-09 | V2-P6-05 | Saklama süresi ve silme akışı tanımlı değil (kırmızı) | Her veri sınıfının saklama süresi ve silme akışı çalışır. **Sıfat ve süre kararı owner'ındır** | 2 gün |
| V2-P6-07 | Gözlemlenebilirlik kurulur: telemetri, hata izleme, uyarı | OPS-03, QLT-06 | V2-P6-04 | Production'da ne olduğunu gösteren hiçbir hat yok (kırmızı) | Frontend trace'i backend trace'iyle ilişkilendirilir; uyarı eşikleri tanımlı | 2 gün |
| V2-P6-08 | Yedekleme, felaket kurtarma ve geri yükleme tatbikatı yapılır | OPS-02, BKE-03 | V2-P6-04 | Geri yükleme hiç denenmemiş (UNVERIFIED) | Yedekten geri yükleme gerçekten denenir ve süresi ölçülür | 2 gün |
| V2-P6-09 | Hetzner dağıtımı ve dual-host smoke yapılır | OPS-02, OPS-03 | V2-P6-07, V2-P6-08 | Dual-host smoke yapılmamış (UNVERIFIED) | Aynı çıktı AMD ve Intel hostta smoke edilir; **host sağlanana kadar UNVERIFIED kalır ve dual-vendor iddiası kurulmaz** | 2 gün |
| V2-P6-10 | Sürüm, feature flag ve geri alma hattı kurulur | OPS-01, OPS-04 | V2-P6-09 | Deploy ile yayın kararı ayrılmamış; geri alma hattı denenmemiş (kırmızı) | Yayın bayrakla açılıp kapanır; geri alma tatbikatı yapılır | 2 gün |
| V2-P6-11 | İkinci ülke paketi doğrulanır (international-ready kanıtı) | RES-04, QLT-08 | V2-P6-03 | İkinci ülke hiç eklenmemiş; çekirdeğin kırılmadığı kanıtlanmamış (kırmızı) | İkinci ülke paketi çekirdek değiştirilmeden eklenir ve yolculuk testleri geçer | 2 gün |
| V2-P6-12 | Final kanıt paketi derlenir ve satılabilirlik kararı verilir | OPS-03, PRD-04, QLT-02 | V2-P6-06, V2-P6-10, V2-P6-11 | Gerçek backend E2E, güvenlik denetimi, ölçek testi ve KVKK kapıları açıkken hiçbir final karar dayanağı yok (kırmızı) | Tüm GREEN çıktıları tek pakette; kalan UNVERIFIED kapılar adıyla listeli; **karar MASTER'ındır** ve `V2-P6-01` GREEN değilse karar "satılamaz" olmak zorundadır | 2 gün |

---

## 8. Toplam efor

| Ölçü | Değer |
|---|---|
| Kilometre taşı sayısı | **147** (`V2-P0-01` … `V2-P6-12`, benzersiz) |
| Kilometre taşı başına ortalama efor | **2 worker-day** |
| **Program toplam eforu** | **147 × 2 = 294 worker-day** |
| Faz dağılımı | P0 5 · P1 76 · P2 1 · P3 8 · P4 12 · P5 33 · P6 12 |
| Sayılmayan | **H1** (müşteriye gösterim) — milestone değildir, efora girmez |

**Sayının değişme kaydı — dürüstlük gereği.** Program **v1'de 68 milestone / 136
worker-day** olarak açılmıştı ve **yalnız frontend'i** kapsıyordu. v2'de üç şey değişti:
(1) ilk teslim, on faza yayılmış kademeli bir frontend yerine **tek parça, eksiksiz,
enterprise ve olgun bir frontend** oldu ve bileşen soyağacı ile eksiksiz Storybook
kataloğu ilk teslimin içine girdi; (2) **backend çatısı, modül öncesi ortak ön
gereksinimler, modüler monolit modülleri ve modül sonrası iş** programa dahil edildi;
(3) müşteriye gösterim bir kapı olmaktan çıkarıldı ve sonraki bileşen işi
"olgunlaştırma" değil **değiştirme/silme/ekleme** olarak yeniden tanımlandı.
**v1 kimlikleri değiştirilmedi; dondurularak aşılmış tarih ilan edildi.**

**Takvim süresi ≠ toplam efor.** Bağımsız kollar paralel dalgalar hâlinde yürütülebilir ve
takvim süresini kısaltır. Ancak paralellik **iki kuralı asla bozamaz**:

1. **Bağımlılık kuralı.** Bir milestone, bağımlı olduğu milestone GREEN olmadan başlamaz.
2. **Tek writer kuralı.** Aynı change package'ta ikinci bir writer olamaz. Paralellik
   farklı paketler arasındadır, aynı paket içinde değildir.

Ayrıca canlı paralellik daima `allowNewWorker` ve `recommendedNewWorkers` ile sınırlıdır
(bkz. Bölüm 2).

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
çekirdeğidir ve `V2-P0-03`'teki otomatik testle korunur. Ancak bir faz kapısında **testin
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
| R13 | İlk teslimin MVP/iskelet gibi sunulması | Sahip eksik bir ürünü tam sanar veya tam bir ürünü eksik sanar | P1 tek parça teslimdir; ara teslim ve "sonra olgunlaştırma" yasaktır (Bölüm 7.4 P1 girişi) |
| R14 | Müşteriye gösterimin kapıya dönüşmesi | Geliştirme durur, karar sahibi belirsizleşir | H1 milestone değildir, kapı üretmez, efora girmez |
| R15 | Bileşen işinin "olgunlaştırma" diye adlandırılması | P1'in eksik teslim edildiği izlenimi doğar | P2 yalnız değiştirme/silme/ekleme tanır; ad değişikliği yasaktır |
| R16 | Müşteri geri bildiriminin uydurulması | Yapılmamış talep milestone'a döner, kaynak boşa gider | `V2-P2-C##` yalnız sahip somut talep verdiğinde açılır |
| R17 | Modüllere ortak ön gereksinimler kurulmadan başlanması | Her modül kendi kiracılık/yetki/kuyruk çözümünü yazar | P5 satırları bağlı oldukları P4 kalemi GREEN olmadan başlamaz |
| R18 | Mock adaptörün çalışan fonksiyon sanılması | Ürünün çalıştığı yanlış raporlanır | İşaretsiz mock muhafızda düşer; yetenek kütüğü engelli tutar (`V2-P0-04`, `V2-P1-24`) |

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
| 11 | İlk frontend teslimi **MVP, prototip, iskelet veya "çalışan frontend" diye sunulamaz** |
| 12 | Müşteriye gösterim **onay veya dur/geç kapısı olarak sunulamaz** |
| 13 | P1'den sonraki bileşen işi **"olgunlaştırma" diye adlandırılamaz** |
| 14 | Verilmemiş bir müşteri geri bildirimi **varsayılamaz veya milestone'a çevrilemez** |
| 15 | Mock adaptörle çalışan bir yüzey **"bu fonksiyon çalışıyor" diye raporlanamaz** |
| 16 | Aşılmış v1 kimlikleri (`M01`–`M68`, `F1`–`F10`) **yürürlükteymiş gibi anılamaz** |

---

## 15. İlk on kilometre taşı — başlangıç sırası

> **Bu bir faz sınırı değildir.** Aşağıdaki on satır bir **başlangıç sırasıdır** ve iki
> makro fazı birden kapsar: **P0 tam olarak beş milestone'dur** (`V2-P0-01`–`V2-P0-05`) ve
> `V2-P0-05` GREEN olunca kapanır; **P1 `V2-P1-01` ile başlar.** "İlk on milestone P0'dır"
> okuması yanlıştır ve hiçbir belgede kurulmaz.

| Sıra | ID | Sonuç | Neden bu sırada |
|---|---|---|---|
| 1 | `V2-P0-01` | Başlangıç çizgisi ölçümü ve v1 devri | Ölçmeden hiçbir ilerleme iddiası kurulamaz |
| 2 | `V2-P0-02` | Tek komutlu tam kabul kapısı | Kapı kurulmadan yazılan kod, kapı açıldığında yüzlerce hata gösterir |
| 3 | `V2-P0-03` | Tasarım sözleşmesi testi | 320px, 1rem, Roboto 400+ ve 12px kuralları tasarım başlamadan zorlanmalı |
| 4 | `V2-P0-04` | Dürüstlük muhafızlarının genişletilmesi | Ürünün kendi hakkında yalan söylemesi en pahalı hatadır |
| 5 | `V2-P0-05` | Soyağacı, no-duplicate ve Storybook kapsam kapısı | Bileşen yazılmadan önce kurulmazsa, 75 bileşen sonradan tek tek kataloglanır |
| 6 | `V2-P1-01` | 320px kaynak ızgara | Tüm görsel iş bu ızgaranın üstüne oturur |
| 7 | `V2-P1-02` | Parliament blue + lemon paleti | Kimlik olmadan hiçbir ekran "ürün gibi" görünmez |
| 8 | `V2-P1-03` | Tipografi ölçeği | Okunabilirlik, görsel kimliğin ikinci yarısıdır |
| 9 | `V2-P1-04` | Card UI + Flat 2.0 yüzeyleri | Kabuk bileşenlerinin oturacağı yüzey sistemi |
| 10 | `V2-P1-06` | Sekiz durum deseni sistemi | Her bileşenin taşıyacağı durumlar, bileşenler yazılmadan tek kaynakta kurulmalı |

---

## 16. Owner özeti — sade Türkçe

**once:** Kimin ne yapacağı yazılıydı ama plan yalnız frontend'i kapsıyordu: 68 kilometre
taşı, 136 worker-day, on faz. Backend hiç planlanmamıştı. Bileşenlerin birbirinden nasıl
türeyeceği, Storybook'un ne kadar zorunlu olduğu ve ürün müşteriye gösterildikten sonra ne
olacağı hiçbir yerde yazılı değildi.

**simdi:** Yol haritası **v2** olarak yeniden yayımlandı ve v1 dondurularak aşılmış tarih
ilan edildi — eski numaralar değiştirilmedi, silinmedi, "hiç değişmedi" gibi de
gösterilmedi. Yeni plan **147 kilometre taşı / 294 worker-day**: P0 yönetişim (5) → **P1
eksiksiz, olgun, enterprise frontend tesliminin tamamı (76)** → sahip ürünü müşteriye
gösterir (kapı değil, 0 milestone) → P2 değiştirme/silme/ekleme talep alımı (1) → P3
backend çatısı (8) → P4 modül öncesi ortak ön gereksinimler (12) → P5 modüler monolit
modülleri (33) → P6 modül sonrası iş (12). Rol havuzu backend loncasıyla 66'ya çıktı.

**fark:** Üç şey artık tartışılmaz. **Bir:** ilk teslim MVP değil; bileşen hiyerarşisi ve
Storybook kataloğu ilk teslimin içinde, sonrasında değil. **İki:** müşteriye gösterim
onay kapısı değil; geliştirme durmaz ve kimse müşterinin ne diyeceğini tahmin etmez.
**Üç:** frontend bittiğinde proje bitmiyor — backend çatısı, ortak gereksinimler,
modüller ve modül sonrası iş sırayla ve bağlayıcı biçimde yazılı.

**kullaniciYolculugu:** Sahip Codex GUI'dan "başvuru hattını yap" der. MASTER bunu
`V2-P1-46` kilometre taşına bağlar, kapsamı ve non-goals'ı yazar. Bir Claude RED yazarı
önce testi yazar ve kırmızı olduğunu kanıtlar. Tek bir Claude writer uygular. Tam kapı
koşar. Paketi yazmayan başka bir Claude reviewer değişmez snapshot üzerinde inceler. MASTER
kabul eder, Git işlemini yapar ve sahibe altı alanlı sade Türkçe raporu verir. Backend
gelene kadar o yüzeyin sunucuya bağlı eylemi **tipli port arkasında ve dürüst mock
durumunda** görünür — hiçbir yerde "çalışıyor" denmez.

**kalanEngel:** 147 kilometre taşının tamamı henüz açık. Toplam efor 294 worker-day'dir ve
paralel dalgalar takvimi kısaltabilir ama bu sayıyı düşürmez. Satılabilirlik kararı
**`V2-P6-12`**'dedir ve gerçek backend E2E (`V2-P6-01`) GREEN olmadan verilemez. Üç şey
mühendislikle kapanmaz ve **owner** kararıdır: uzman doğrulanmış program verisi, ICP/fiyat
doğrulaması, KVKK'daki veri sorumlusu/işleyen sıfatı ve saklama süreleri. Hetzner dual-host
smoke host sağlanana kadar UNVERIFIED kalır. P2'de bugün **sıfır** somut talep vardır ve
uydurulmayacaktır.

**capability_delta:** `0`. Bu belge tek satır ürün kodu değiştirmedi. Yaptığı şey, bir
sonraki 147 paketin doğru sırayla, doğru kanıtla ve doğru rolle yapılmasını mümkün kılmak.
