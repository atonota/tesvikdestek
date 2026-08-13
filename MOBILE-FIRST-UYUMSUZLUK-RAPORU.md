# Mobile-First Uyumsuzluk Raporu — DestekTeşvik

Ölçüm ortamı: 320 × 568 CSS piksel (iPhone 5 / 5C sınıfı), koyu tema, canlı uygulama.
Ölçümler tarayıcıda gerçek DOM üzerinden alındı; tahmin olanlar açıkça "tahmin" diye işaretlendi.

---

## 0. Tek cümlelik teşhis

Uygulama masaüstü için tasarlanıp telefona **sığdırıldı**. Tipografi ve dokunma hedefleri düzeltildi, alt gezinme eklendi; fakat bileşen mimarisi hâlâ "geniş ekranda yan yana duran şeyleri alt alta koy" mantığında. Sonuç: **kalıcı arayüz kroma ekranın %45'ini yiyor** ve tek bir bölüm **94 ekran** boyunda.

| Ölçüt | Ölçülen | Olması gereken |
|---|---|---|
| Kalıcı krom (üst + çip + alt bar) | **255 px / 568 px = %45** | ≤ %22 (≈125 px) |
| İçeriğin başladığı y | **170 px** | ≤ 96 px |
| Öneri sırası paneli uzunluğu | **93,7 ekran** | ≤ 6 ekran (sayfalama/sanallaştırma ile) |
| Başvuru panosu | **41,1 ekran** | ≤ 6 ekran |
| Senaryo sonucu | **34,0 ekran** | ≤ 8 ekran |
| Tek karttaki en uzun blok | **7.342 px = 13 ekran** | ≤ 2 ekran |
| Açılışta DOM düğümü | **5.361** | ≤ 1.200 |
| 44 px altı dokunma hedefi | **40 hedefin 15'i** | 0 |
| KPI kutusu en/boy | **128 × 327 px** | 128 × ~110 px |

---

## 1. Atomlar — mikro bileşen eleştirisi

### 1.1 `.btn` (düğme)
- **Kusur:** `min-height:48px` verildi ama gerçek yükseklik **43 px** ölçüldü; `.btn.sm` 42 px'e ayarlı ve üst çubuktaki tüm düğmeler `sm`. Yani kural yazıldı, sınıf onu eziyor.
- **Kusur:** Düğmeler blok davranıyor, üst üste diziliyor. "Senaryoyu değiştir / Program sırasını aç / Yürütmeye geç" 320 px'te **3 satır, 150 px** yer kaplıyor.
- **Kusur:** İkon yok; her düğme yalnız metin. Dar ekranda metin uzunluğu yerleşimi belirliyor.
- **Nasıl olmalı:** Taban yükseklik 48 px, `sm` varyantı mobilde **devre dışı** (yalnız ≥900 px'te küçülsün). Birincil eylem tam genişlik, ikincil eylemler yan yana 2'li ızgara. İkon + metin; dar ekranda yalnız ikon + `aria-label`.

### 1.2 `.badge` / `rozet()`
- **Kusur:** Satır içi akışta, sarmalanınca satır yüksekliğini bozuyor. Program kartında 3–4 rozet yan yana gelince kart 2 satır büyüyor.
- **Kusur:** Renk + metin taşıyor ama ikon taşımıyor; renk körlüğünde yalnız metne kalıyor (bu doğru), fakat dar ekranda metin uzun ("Hazırlan, kuruluştan sonra başvur" 34 karakter).
- **Nasıl olmalı:** Mobilde kısa etiket + ikon, uzun hâli `title`/`aria-label`. Rozetler tek satırda yatay kaydırılabilir şeride girmeli.

### 1.3 `.tile` (KPI kutusu)
- **Kusur (en ağırı):** 2'li ızgarada kutu **128 × 327 px**. Genişliğin 2,5 katı yükseklik. Sebep: `.k` başlık + `.v` değer + `.n` açıklama alt alta ve `.n` 1,1 rem'de 5–7 satır sarıyor.
- **Kusur:** `::before` ile 3 px renk şeridi var ama durum bilgisi yalnız renkle veriliyor.
- **Nasıl olmalı:** Mobilde kutu = **etiket + değer** (yaklaşık 110 px yükseklik). Açıklama kutunun içinde değil, ızgaranın altında tek bir açılır blokta ya da kutuya dokununca açılan sayfada. Bilgi silinmemeli, **ertelenmeli**.

### 1.4 `.sh-secenekler button` (sihirbaz seçeneği)
- **İyi:** 60 px yükseklik, 16 px köşe, işaretli durum belirgin. Mobil için doğru atom.
- **Kusur:** Seçilince anında ilerliyor fakat **geri bildirim yok** — dokunma ile ekran değişimi arasında hiçbir geçiş yok, kullanıcı ne olduğunu anlamıyor.
- **Nasıl olmalı:** 120–150 ms'lik kayma geçişi, `prefers-reduced-motion` ile kapanabilir.

### 1.5 `.ara-dugme` (arama)
- **Kusur:** Mobilde 44 px yuvarlak ikon düğmesine indirildi ama içindeki `⌕` bir **metin karakteri**; farklı platformlarda farklı görünüyor, hizası kayıyor.
- **Nasıl olmalı:** Gerçek SVG ikon.

### 1.6 `.ikon` (kenar çubuğu ikonları)
- **Kusur:** `◧ ◍ ◎ ◈ ◐ ≡ ▤ ⇄ ▦ ◷ ☑ ◇ ◉ ◌ ◊` — hepsi Unicode geometrik şekil. Anlamsal değil, tanınabilir değil, yazı tipine bağlı. "◈" ile "◐" arasında hiçbir kullanıcı ayrım kuramaz.
- **Nasıl olmalı:** Phosphor ikon seti, anlamına uygun eşleme (takvim → `calendar-blank`, kanıt → `checks`, pano → `kanban`).

### 1.7 `input` / `select`
- **Kusur:** `min-height:48px` var, iyi. Ancak `type="number"` alanları mobilde ok tuşları gösteriyor ve dar ekranda yazı alanını daraltıyor.
- **Kusur:** Para alanlarında binlik ayracı yok; `8000000` yazan bir alan telefonda okunamıyor.
- **Nasıl olmalı:** `inputmode="numeric"`, ok tuşları gizli, alan dışına çıkınca binlik ayraçlı gösterim.

### 1.8 `.say` (sayaç rozeti)
- **Kusur:** Kenar çubuğunda 25/45 gibi sayılar var; bölüm çipine de taşındı ama çipte hizası bozuk.

---

## 2. Bloklar

### 2.1 `.card`
- **Kusur:** Tek sorumluluğu yok. Bazen 5 satırlık bir not, bazen **7.342 px'lik** dev bir tablo konteyneri. Ölçülen: Senaryo sonucu sayfasındaki en uzun kart 13 ekran.
- **Kusur:** Mobilde kenar boşluğu 14 px'e indi ama iç dolgu hâlâ kartı daraltıyor; 320 px'te kullanılabilir genişlik ~264 px.
- **Nasıl olmalı:** Kart en fazla 2 ekran. Daha uzun içerik ya kendi sayfasına ya da katlanır bloğa. Mobilde kartlar kenardan kenara (edge-to-edge), sadece dikey ayraçla.

### 2.2 `.tablewrap` + `table`
- **Kusur:** Şu an mobilde satırlar karta dönüşüyor (yeni eklendi) — bu doğru yön. Ancak **6 sütunlu** "Senaryo zaman çizelgesi" karta dönünce satır başına 6 etiket + 6 değer = 12 satır oluyor; 9 program × 12 satır = 108 satır tek blokta.
- **Kusur:** `caption` görsel olarak var ama mobilde kart yığınının başlığı gibi durmuyor.
- **Nasıl olmalı:** Mobilde tablo → **liste kartı**: her program için 1 kart, üstte program adı, altında 2 sütunlu kompakt ızgarada yalnız **3 kritik alan** (başvuru, tahsilat, tutar); kalan alanlar "Ayrıntı" ile açılır.

### 2.3 `.grid.three` / `.grid.four`
- **Kusur:** Mobilde 2 sütuna alındı, doğru. Ancak kutu içeriği kısaltılmadığı için 2 sütun yalnız yüksekliği ikiye katladı, ekran tasarrufu sağlamadı.

### 2.4 `.bolum-bas` (bölüm başlığı)
- **Kusur:** Başlık + uzun açıklama + 3 düğme. 320 px'te **~310 px**, yani içerik görünmeden yarım ekran gidiyor.
- **Nasıl olmalı:** Mobilde yalnız başlık; açıklama katlanır; eylemler alta sabit çubuğa veya taşma menüsüne.

### 2.5 `.note` (uyarı blokları)
- **Kusur:** Senaryo sonucu sayfasında **7 adet** `note` art arda. Hepsi aynı görsel ağırlıkta, hiyerarşi yok.
- **Nasıl olmalı:** En fazla 1 birincil uyarı görünür; kalanlar "Neden?" başlığı altında katlanır.

### 2.6 `.prog` (program kartı)
- **Kusur:** Kart başına ~29 DOM düğümü × 46 program = **1.335 düğüm** tek panelde. Kart içinde başlık, kurum, 3 rozet, açıklama, 2 sayı kutusu, gerekçe listesi, engel notu, puan çubuğu var.
- **Nasıl olmalı:** Mobilde özet kart (ad + kurum + durum rozeti + tutar), gerisi dokununca açılan alt sayfada.

---

## 3. Bölümler (sections)

| Bölüm | Uzunluk | Ana kusur |
|---|---|---|
| Öneri sırası | **93,7 ekran** | 46 kartın tamamı tek listede, sayfalama yok, filtre yukarıda kalıyor |
| Başvuru panosu | **41,1 ekran** | Her satırda 3 form alanı; 46 satır = 138 form alanı tek sayfada |
| Senaryo sonucu | **34,0 ekran** | 5 kart, biri 13 ekran |
| Faaliyet ve NACE | 538 düğüm | 8 kod × 4 rol düğmesi ızgarası dar ekranda sıkışık |
| Uygunluk sihirbazı | ~3 ekran | **Tek doğru mobil bölüm** — tek soru, büyük hedef, ilerleme |

**Sonuç:** Sihirbaz dışında hiçbir bölüm mobil için tasarlanmamış. Sihirbazın deseni (tek odak + ilerleme + tek eylem) diğerlerine taşınmalı.

---

## 4. Yerleşim

### 4.1 Krom bütçesi — en ciddi yerleşim kusuru
```
Üst çubuk        112 px   (2 satıra taşıyor: Menü+başlık+arama+Paylaş / Araçlar)
Bölüm çipleri     58 px
Alt gezinme       85 px
─────────────────────────
Toplam           255 px = ekranın %45'i
```
İçerik yalnız **313 px**'lik bir pencerede akıyor.

- **Kusur:** Üst çubuk 4 sütunlu ızgaraya alındı ama `Araçlar` sığmayıp ikinci satıra düşüyor.
- **Kusur:** Başlık "Senaryo sonucu" → "Sena..." diye kesiliyor (ölçüldü).
- **Kusur:** Alt bar 5 etiket taşıyor, "Dayanağı göster" sığmıyor.
- **Nasıl olmalı:** Üst çubuk tek satır 56 px: `[≡] Başlık [⌕] [⇪]`. Bölüm çipleri 44 px. Alt bar 56 px + güvenli alan, etiketler tek kelime (`Tanımla · Sonuç · Planla · Yürüt · Dayanak`). Toplam ≈ 156 px = %27. Aşağı kaydırırken üst çubuk gizlenmeli, yukarı kaydırınca dönmeli.

### 4.2 Gezinme mimarisi
- **İyi:** Alt bar + bölüm çipleri eklendi, başparmak erişimi doğru.
- **Kusur:** Üç ayrı gezinme aynı anda var: hamburger çekmece (16 bölüm), alt bar (5 adım), çip şeridi (adımın bölümleri). Çekmece artık gereksiz ve kafa karıştırıcı.
- **Nasıl olmalı:** Mobilde çekmece kaldırılmalı; "tüm bölümler" gerekiyorsa alt bardaki adıma **uzun basma** veya arama ile.

### 4.3 Kaydırma ve konum
- **Kusur:** Sekme değişince sayfa başa dönüyor ama çip şeridi konumu korunmuyor.
- **Kusur:** 94 ekranlık listede kaydırma konumu hatırlanmıyor; ayrıntıya girip dönünce en başa düşüyorsun.

### 4.4 Güvenli alan ve tarayıcı kromu
- `env(safe-area-inset-*)` eklendi. **Ancak** iPhone 5'te çentik yok; asıl sorun Safari'nin **alt araç çubuğu** — `100dvh` desteklenmiyor (bkz. §6), `100vh` alt barı ekran dışına itiyor.

---

## 5. Sayfalar ve proje

### 5.1 Sayfa mimarisi
- **İyi:** 16 bölümün her biri gerçek URL'e sahip, paylaşılabilir, önizlemesi doğru.
- **Kusur:** Her bölüm **aynı 1,5 MB dosyayı** yüklüyor. Bir bağlantıya doğrudan girildiğinde tüm uygulama iniyor.
- **Kusur:** Açılışta `cizHepsi()` 16 panelin **tamamını** çiziyor: 5.110 düğüm, kullanıcı 1 tanesini görüyor.

### 5.2 Proje düzeyi
- **Kusur:** Tek dosya kısıtı mobil performansın önündeki asıl engel. ECharts tek başına ~1 MB ve **Görsel analitik dışında hiçbir sayfada gerekmiyor**, yine de her sayfada indiriliyor ve ayrıştırılıyor.
- **Kusur:** Ürün "mobil için" deniyor ama varsayılan açılış yoğunluğu masaüstü tablosu.
- **Kusur:** Hiçbir yerde çevrimdışı desteği yok; saha kullanımında (kurum ziyareti, mali müşavir görüşmesi) bağlantı kopabilir.

---

## 6. iPhone 5 uyumluluk riskleri (kod taraması)

Kullanılan ve bu cihazda **kırılacak** olanlar:

| Özellik | Nerede | iPhone 5 Safari | Sonuç |
|---|---|---|---|
| `color-mix()` | üst çubuk, alt bar arka planı | ✗ | Arka plan **şeffaf** kalır, içerik altından görünür |
| `backdrop-filter` | üst çubuk, alt bar | kısmi | Bulanıklık yok, okunabilirlik düşer |
| `100dvh` | kabuk yüksekliği | ✗ | `100vh` yedeği var, alt bar Safari çubuğunun altında kalabilir |
| `<dialog>` + `showModal()` | program ayrıntısı, paylaşım, komut paleti | ✗ | **Üç modal da açılmaz** — kod `showModal` yoksa `open` özniteliğine düşüyor, ama konumlandırma bozulur |
| `env(safe-area-inset-*)` | alt bar, üst çubuk | ✗ | 0 kabul edilir, sorun değil |
| `scrollIntoView({block})` | çip şeridi | kısmi | Nesne argümanı yok sayılır |
| `focus({preventScroll})` | sekme geçişi | ✗ | Sayfa istenmeyen yere kayar |
| Gömülü ECharts | her sayfa | ağır | 1 GB RAM'de sekme öldürülme riski (**tahmin**) |

Bu bölümün sayısal doğrulaması ayrı performans denetimiyle sürüyor.

---

## 7. Mobil için "mükemmel" ne demek — hedef tanımı

1. **Krom ≤ %27.** Üst 56 px, çip 44 px, alt 56 px. Aşağı kaydırırken üst gizlenir.
2. **Hiçbir bölüm 8 ekranı geçmez.** Uzun listeler sayfalanır (20'şer) veya sanallaştırılır.
3. **Tek ekranda tek karar.** Sihirbaz deseni tüm bölümlere yayılır: özet kart → dokun → ayrıntı sayfası.
4. **Tablo yok.** Mobilde her satır bir kart; en fazla 3 alan görünür, gerisi açılır.
5. **Her dokunma hedefi ≥ 48 px**, aralarında ≥ 8 px boşluk.
6. **Açılışta ≤ 1.200 DOM düğümü.** Yalnız aktif panel çizilir; diğerleri istenince.
7. **Ağır bağımlılık tembel.** ECharts yalnız Görsel analitik açılınca yüklenir.
8. **Anlamsal ikonlar.** Phosphor seti, Unicode şekiller kaldırılır.
9. **Başparmak bölgesi.** Birincil eylem her zaman alt üçte birde.
10. **Geri bildirim.** Her dokunmada 120–150 ms geçiş; `prefers-reduced-motion` saygılı.
11. **Durum korunur.** Kaydırma konumu, çip konumu, liste sayfası geri dönüşte hatırlanır.
12. **iPhone 5 taban çizgisi.** `color-mix`, `dvh`, `dialog` için yedek yol; hiçbiri tek dayanak olmaz.

---

## 8. Öncelik sırası

| # | İş | Kazanç | Maliyet |
|---|---|---|---|
| 1 | Krom bütçesi: tek satır üst çubuk, kısa alt bar etiketleri, kaydırınca gizlenen başlık | %45 → %27 krom | Düşük |
| 2 | Tembel çizim: yalnız aktif panel | 5.361 → ~900 düğüm | Düşük |
| 3 | Uzun listelerde sayfalama (Öneri sırası, Başvuru panosu) | 94 ekran → 6 ekran | Orta |
| 4 | KPI kutusu kompaktlaştırma, açıklamanın ertelenmesi | Kutu 327 → ~110 px | Düşük |
| 5 | Program/pano satırı → özet kart + ayrıntı sayfası | Panel düğümü ⅓'e | Orta |
| 6 | Phosphor ikon seti | Tanınabilirlik | Düşük |
| 7 | `dialog`, `color-mix`, `dvh`, `preventScroll` yedekleri | iPhone 5'te çalışır hâle gelir | Düşük |
| 8 | ECharts'ı tembel yükleme | Açılış yükü ~%70 azalır | **Tek dosya kısıtını bozar** |

8. madde tek dosya kararını bozar; ürün sahibinin kararıdır, kendiliğinden yapılmayacak.
