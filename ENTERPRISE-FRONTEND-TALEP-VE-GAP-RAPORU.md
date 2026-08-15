# DestekTeşvik — Enterprise Frontend Talep ve Gap Raporu (kanonik kopya)

**Tarih:** 2026-08-15
**Belge sınıfı:** Kanonik talep + gap raporu. Salt okunur bir tespit belgesidir.
**Yazar rolü:** Codex Desktop MASTER'ın verdiği son kullanıcı raporunun tek Claude writer tarafından kanonikleştirilmiş hâli.
**capability_delta:** `0` — bu belge hiçbir ürün, runtime, frontend veya backend yeteneği eklemez, kaldırmaz veya değiştirmez. Yalnızca ne olduğunu ve ne olmadığını yazar.
**Değiştirilen ürün dosyası:** yok. **Yapılan git işlemi:** yok.

> **Bu raporun en önemli cümlesi, en başta.**
> **Frontend bitmedi.** Daha önce verilmiş olan "enterprise seviyede tamamlandı" kararı
> **geri çekilmiştir**. Bugün elimizde olan şey; erişilebilirlik disiplini ve tasarım
> token temeli sağlam, dürüstlük muhafızları gerçekten çalışan, ancak **ürün, kullanıcı
> deneyimi, kullanıcı yolculuğu, fonksiyon kapsamı ve görsel tasarım bakımından MVP'nin
> dahi altında kalan bir prototiptir.** Bu rapor bunu gizlemez, yumuşatmaz ve teknik
> başarıyı ürün başarısı gibi sunmaz.

---

## 0. Bu belge nedir, nasıl okunmalı

Bu belge dört soruyu tek yerde cevaplar:

1. **Kullanıcı ne istedi?** (Bölüm 2 — talepler, hiçbiri sadeleştirilmeden)
2. **Bugün repoda gerçekten ne var?** (Bölüm 8 — ölçülmüş repo kanıtı)
3. **İkisi arasındaki fark nedir?** (Bölüm 10 — birleşik gap matrisi)
4. **Ne yapılacak, hangi sırayla, hangi kanıtla?** (Bölüm 11-16)

Belge teknik olmayan bir sahip için yazılmıştır. Her teknik karar, gerçek bir SaaS
kullanıcısının yaşadığı somut bir yolculukla açıklanır. Metaforlar açıklama içindir;
hiçbir metafor bir sözleşmenin, bir değişmezin veya bir test kanıtının yerine geçmez.

**Sayı okuma kuralı:** Bu belgedeki her sayı bir ölçümdür ve nereden ölçüldüğü yazılıdır.
Ölçülmemiş hiçbir sayı yoktur. Bir sayının yanında "UNVERIFIED" yazıyorsa, o sayı bir
iddia değil, **kapatılmamış bir kapıdır**.

---

## 1. Geri çekilen karar ve yerine konan karar

### 1.1 Geri çekilen karar

Önceki paket raporu (`docs/reports/2026-08-14-enterprise-frontend-implementation.md`)
sekiz fazı "8/8 tamamlandı" olarak kapattı ve ürünü "kurumsal ölçekte gösteren bir karar
ve kanıt tezgâhı" diye niteledi. O raporun **teknik ölçümleri doğrudur ve bu belgede
korunur.** Yanlış olan, o ölçümlerden çıkarılan **ürün sonucudur**.

Geri çekilen cümle şudur: *"Enterprise frontend tamamlandı."*

### 1.2 Neden geri çekildi

Bir frontend'in "tamamlandı" sayılabilmesi için üç ayrı kapının birlikte yeşil olması
gerekir:

| Kapı | Soru | Bugünkü durum |
|---|---|---|
| Mühendislik kapısı | Kod derleniyor, test geçiyor, erişilebilirlik taraması temiz mi? | **Büyük ölçüde yeşil** |
| Ürün kapısı | Bir müşteri bu ürünle baştan sona gerçek bir iş yapabiliyor mu? | **Kırmızı** |
| Ticari kapı | Bu ürün bugün satılabilir mi, gösterildiğinde satın alınır mı? | **Kırmızı** |

Önceki karar yalnız birinci kapıya bakarak verildi. **Mühendislik kapısının yeşil olması
ürün hazırlığı değildir** ve bu belge boyunca hiçbir yerde öyle sunulmaz.

### 1.3 Yerine konan karar — bugünkü sınıf

**Sınıf: MVP altı prototip (erişilebilirlik ve token temeli olan).**

Bu sınıfın anlamı üç maddede:

1. **Sağlam olan:** Tasarım token sistemi, erişilebilirlik disiplini, tip güvenliği,
   sözleşme doğrulama, dürüstlük muhafızları (ürünün kendi yalanını koda karşı test etmesi).
   Bunlar atılmaz; üstüne inşa edilir.
2. **Eksik olan:** Ürün yolculuğu, görsel tasarım kimliği, dönüşüm (conversion) yüzeyi,
   ekran kapsamı, veri yoğun çalışma yüzeyleri, AI-first davranış — yani **ürünün kendisi**.
3. **Yanlış olan:** Bitmiş sayılması.

### 1.4 Sahibin diliyle: somut bir yolculuk

Bir CRM ürününü düşünün. Formun her alanı klavye ile gezilebiliyor, ekran okuyucu her
etiketi doğru okuyor, renk kontrastı mükemmel, form gönderiliyor, sunucu reddederse
hata kutusu doğru yerde beliriyor, kullanıcı düzeltip tekrar gönderiyor ve kayıt oluşuyor.

Bu, **iyi yapılmış bir form**dur.

Ama o CRM'de müşteri listesi yok, satış hunisi yok, teklif ekranı yok, rapor yok,
bildirim yok ve şirket logosu koyacak yer yok. Kimse o ürünü satın almaz.

**DestekTeşvik frontend'i bugün tam olarak burada.** Formlar iyi. Ürün yok.

---

## 2. Kullanıcının doğrudan talepleri (hiçbiri sadeleştirilmeden)

Aşağıdaki maddeler kullanıcının kendi ifadeleridir; teknik yorum bir sonraki bölümdedir.
Hiçbiri "sonra bakarız" diye kısaltılmamıştır.

### 2.1 Süreç ve yöntem talepleri

1. **Kodu incele.** Varsayımla değil, repodaki gerçekle konuş.
2. **AI-first dönüşüm.** Ürün yapay zekâ eklentisi olan bir yazılım değil, temelinden
   yapay zekâ ile çalışan bir yazılım olsun.
3. **Eksik analizi.** Ne yok, neden yok, ne zaman olacak — açıkça yazılsın.
4. **MetaFramer yasak.** Aday, geçiş hedefi veya opsiyon olarak dahi önerilmesin.
5. **Next.js yasak.** Aynı şekilde aday, geçiş hedefi veya opsiyon olarak önerilmesin.
6. **Proje-özel stack.** Genel geçer bir "modern frontend" listesi değil, bu projenin
   gerçeğine göre seçilmiş bir yığın.
7. **Yeni girişim ve büyük vizyon.** Bu bir alıştırma değil; kurulan bir şirketin ürünü.
8. **Tekrar onay isteme.** Verilen kapsam kararları her adımda yeniden sorulmasın.
9. **Test-first.** Her iş önce kırmızı (RED) testle başlasın, sonra yeşile (GREEN) geçsin.
10. **50+ ajan.** Geliştirme, çok sayıda uzmanlaşmış Claude ajanıyla yürütülsün.

### 2.2 Kapsam ve pazar talepleri

11. **Türkiye destek ekosisteminin tamamı.** Tek bir kurumun programı değil, ekosistem.
12. **Kurum evreni geniş:** SGK, TÜBİTAK, KOSGEB, bakanlıklar, kalkınma ajansları,
    ticaret/sanayi odaları, meslek örgütleri, bankalar ve garanti kurumları dahil.
13. **AB / Avrupa / uluslararası.** Ülke paketleri (country packs) mimaride öngörülsün.
14. **Nakit dışı destekler de birinci sınıf:** ofis tahsisi, kuluçka, laboratuvar erişimi,
    cloud kredisi, pilot uygulama imkânı, eğitim, mentorluk, ayni hizmet.
15. **SaaS + herkese açık danışmanlık.** İki gelir hattı bir arada.
16. **Public website + authenticated SaaS.** Kamuya açık, arama motorunda bulunan bir
    yüzey; ve girişten sonra çalışılan bir yüzey.
17. **Yazılım bulur, danışmanlık uygular.** Yazılım fırsatı ve uygunluğu bulur; insan
    danışman başvuruyu yürütür. İkisi aynı üründe birbirine bağlanır.
18. **Türkiye-first, international-ready.** Önce Türkiye tam olsun; ama mimari ikinci
    ülkeyi eklerken çekirdeği kırmasın.

### 2.3 Mimari talepleri

19. **Backend bu frontend paketinde geliştirilmeyecek**, ama frontend backend-compatible
    olacak.
20. **Modular monolith.** Mikroservis değil.
21. **Sustainable.** Uzun ömürlü, bakımı ekonomik.
22. **Hetzner AMD EPYC / Intel x86_64.** Donanım hedefi bu.
23. **GitHub CI/CD.**
24. **FastAPI tercih edilir** (backend tarafında).
25. **React 19.**
26. **Kullanıcının "React Router 19" ifadesi.** Bu ifadenin repoda doğru uygulanan
    karşılığı **React 19 + React Router 7.18.2**'dir (bkz. Bölüm 5.2).
27. **TanStack Query / TanStack Table.**
28. **React Hook Form.**
29. **TypeScript.**
30. **SCSS**, gerekiyorsa.

### 2.4 Frontend kalite talepleri

31. **Waterfall / master-component yaklaşımı.** Önce ana bileşen, sonra türevleri.
32. **Tüm bileşenler enterprise, mature, advanced ve complete olsun.**
33. **MVP değil enterprise.**
34. **Gerçek kullanıcı yolculukları.** Ekran değil, yolculuk.
35. **Live browser doğrulaması.** Gerçek tarayıcıda görülsün.
36. **502 ve tüm kırık sayfa/bileşenler düzeltilsin.**
37. **Satılabilir SaaS.** Gösterildiğinde satın alınabilir olsun.

### 2.5 Tasarım talepleri

38. **Dark ve light tema.**
39. **Mobile-first.** Ve bu, "responsive yapıldı" demek değil.
40. **Gerçek native 320px önce.** Kaynak düzen 320 pikselde kurulur.
41. **Sonra büyüyen breakpointler.**
42. **Desktop adaptive ama ikincil.** Masaüstü gereklidir; ama mobil kapanmadan başlanmaz.
43. **Roboto 400 ve üzeri ağırlıklar.**
44. **Minimum görünür metin 1rem ve üzeri.**
45. **Adaptive AI.** Arayüz kullanıcıya ve bağlama göre uyarlanabilsin.
46. **Conversion odaklı, hareketli (motion), veri yoğun ve içerik öncelikli.**
47. **Card UI + Flat 2.0** görsel dili.
48. **Arama alanı hariç tüm köşe yuvarlaklıkları ≤ yaklaşık 12px** veya rem cinsinden
    pixel-perfect karşılığı.
49. **Parliament blue + lemon** renk kimliği.
50. **Advanced layered header.** Katmanlı, gelişmiş üst başlık.
51. **Mükemmel sol ve sağ paneller.**
52. **Platformlar arasında tutarlı dropdown davranışı.**

### 2.6 Tablo ve veri talepleri

53. **Verilen B2B HTML davranış referansı** temel alınsın.
54. **Master DataGrid.** Tek bir ana tablo bileşeni.
55. **Görünüm modları:** table, list, card, kanban, calendar, timeline, group, pivot,
    dashboard, form, json.
56. **Yetenekler:** kolon yönetimi, filtreleme, değer araması, çoklu sıralama, seçim,
    toplu işlem, satır içi düzenleme, sayfalama, dışa aktarma, kayıtlı görünümler,
    URL durumu, klavye kısayolları, gömülü grafikler ve **sunucu taraflı sözleşmeler**.

### 2.7 Medya ve sağlayıcı talepleri

57. **Advanced Media / File Library.** Klasörler, yükleme yöneticisi, üstveri, önizleme,
    sürümler, yönetişim, arama/filtre/toplu işlem, varlık bağları.
58. **Depolama:** yerel depolama varsayılan; **S3 kesinlikle opsiyonel**.
59. **AI sağlayıcıları:** Gemini, OpenClaw, Claude, ChatGPT/OpenAI — hem hesap hem API.
60. **Sağlayıcı yönetimi:** kimlik bilgileri, OAuth, sağlık yoklaması, yönlendirme
    (routing), denetim izi.

---

## 3. AI-first ne demek — ürünün anayasası

Kullanıcının "AI-first" talebi, bu üründe **bir sohbet kutusu eklemek değildir.** Aşağıdaki
on iki madde ürünün AI anayasasıdır ve her biri bir davranış sözleşmesidir.

### 3.1 Kapsam

1. **Yapay zekâ eklenti değil, ürünün kendisidir.** Kullanıcı "AI özelliğini açmaz";
   ürünün her yüzeyi zaten yapay zekâ ile çalışır.
2. **Proaktif olur.** Kullanıcı sormadan fırsat bulur, mevzuat değişikliğini yakalar,
   yaklaşan bir kapanışı önceden söyler ve tahmin üretir.
3. **İçgörüden aksiyona derin bağlantı.** Bir bildirim veya içgörü tek tıkla ilgili
   rapora, oradan da yapılacak işe götürür. Kullanıcı "nereden bakacağım" diye aramaz.
4. **Çok kanallı giriş:** form, sohbet, belge yükleme ve ses. Aynı iş dört yoldan da
   yapılabilir.
5. **Master ajan + uzman ajanlar.** Bir yönetici ajan işi böler, uzman ajanlar yapar.

### 3.2 Yetki ve güvenlik

6. **Düşük risk otomatik, yüksek risk insan onaylı.** Bir etiket düzeltmek otomatiktir;
   bir başvuru kararı asla değildir.
7. **Deterministik kural + AI açıklaması + insan onayı.** Üçlü model. Uygunluk kararını
   **kural motoru** verir; AI onu **açıklar** ve **teklif** üretir; **insan** onaylar.
8. **Overclaim yasağı.** Ürün hiçbir yerde "hak kazandınız", "şu kadar para alacaksınız"
   veya "resmî başvurunuz kabul edildi" demez. Bunlar koda karşı test edilen yasaklı
   ifadelerdir.

### 3.3 Kanıt ve hafıza

9. **Kaynak disiplini.** Her AI çıktısı bir kaynak yakalamasına (snapshot) bağlıdır ve
   şunları taşır: kaynak kimliği, tazelik (freshness) bilgisi, atıf (citation), uygulanan
   kural sürümü ve denetim (audit) kaydı.
10. **ECA — Event / Condition / Action.** "Şu olay olduğunda, şu koşul sağlanıyorsa, şunu
    yap" biçiminde tanımlı, denetlenebilir otomasyon.
11. **Katmanlı hafıza (layered memory).** Oturum hafızası, kullanıcı hafızası, organizasyon
    hafızası ve alan hafızası ayrı katmanlardır; biri diğerine sızmaz.
12. **Sürümlenmiş yetenek ve beceri (skill/capability) + yönetişimli öğrenme.** Ajanların
    öğrendiği her şey sürümlüdür; öğrenme ve **unutma** açık kurallarla yönetilir.

### 3.4 Sahibin diliyle

Bir HRMS düşünün. Klasik ürün: İK uzmanı her ay sisteme girer, teşvik listesini elle
tarar, uygun personeli elle işaretler.

AI-first ürün: sistem SGK teşvik mevzuatındaki değişikliği gece yakalar; sabah İK
uzmanına "şu 7 personeliniz için yeni bir teşvik açıldı, tahmini etki şu, kaynağı bu
tarihli şu genelge" der; uzman tek tıkla gerekçeyi görür, tek tıkla hazırlık listesine
düşer. **Kararı yine insan verir; ama iş, kimse sormadan başlamıştır.**

Bugünkü üründe bu davranışın **hiçbir parçası çalışmıyor.**

---

## 4. Domain haritası — ürünün 27 alanı

Ürün, aşağıdaki alanların toplamıdır. Bugün bunların çoğu **kod olarak yoktur**; harita
gelecekteki işin sınırlarını çizer.

| # | Domain | Ne yapar | Bugünkü durum |
|---|---|---|---|
| 1 | Identity / Access | Kimlik, oturum, yetki | Kısmi (kayıt/giriş/çıkış var; rol yok) |
| 2 | Organization | Şirket, birim, bağlı şirketler | Kısmi (profil yazılır, okunamaz) |
| 3 | Investor / Investment | Yatırımcı ve yatırım kaydı | Yok |
| 4 | Opportunity Intelligence | Fırsatı aktif bulma | Yok (pasif liste var) |
| 5 | Eligibility / Rule Engine | Uygunluk kuralı motoru | Backend'de var, 3 programla |
| 6 | Knowledge Graph | Kavramlar arası ilişki ağı | Yok |
| 7 | Document Intelligence | Belge okuma, çıkarım, doğrulama | Yok |
| 8 | AI / Agent Orchestration | Ajan yönetimi | Yok |
| 9 | Digital Twin | Şirketin yaşayan dijital ikizi | Yok |
| 10 | Simulation / Scenario | Senaryo ve "ya olsaydı" analizi | Yok |
| 11 | Policy / Decision | Politika ve karar kaydı | Kısmi (karar kaydı var) |
| 12 | Risk / Trust | Risk ve güven skorlaması | Yok |
| 13 | Source / Reliability | Kaynak kütüğü ve güvenilirlik | Kısmi (kütük var, diff yok) |
| 14 | Notifications / Insights | Bildirim ve içgörü | Yok |
| 15 | Application / Project / Execution | Başvuru ve proje yürütme | Yok |
| 16 | CRM | Müşteri ilişkileri | Yok |
| 17 | Workflow / Automation | İş akışı ve otomasyon | Yok |
| 18 | Task / Case | Görev ve vaka yönetimi | Yok |
| 19 | Integrations | Dış sistem entegrasyonları | Yok |
| 20 | Analytics | Analitik ve raporlama | Yok |
| 21 | Billing | Faturalama ve abonelik | Yok |
| 22 | Audit / Governance | Denetim ve yönetişim | Kısmi (backend'de var, ucu yok) |
| 23 | Taxonomy / Type / Node / State | Tip, düğüm ve durum meta modeli | Yok |
| 24 | Skill / Capability | Ajan becerisi ve yeteneği | Yok |
| 25 | Knowledge Generation | Bilgi üretimi | Yok |
| 26 | Memory Governance | Hafıza yönetişimi | Yok |
| 27 | Platform Evolution | Platformun kendini geliştirmesi | Yok |

### 4.1 Sermaye merkezli tez

Bu 27 alan dağınık bir liste değildir. Hepsi tek bir teze hizmet eder:

> **Sermayeye erişim → sermayenin korunması → sermayenin optimizasyonu → sermayenin
> kullanımı → finansal etkinin ölçülmesi.**

Bir müşteri ürünü şunun için satın alır: parasına ulaşmak, kaybetmemek, en verimli
biçimde kullanmak ve sonucunu görmek. Her domain bu zincirin bir halkasıdır. Zincire
katkısı olmayan bir özellik, ne kadar iyi yapılmış olursa olsun, üründe yer almaz.

---

## 5. Mimari kararlar ve kullanıcı ifadelerinin repo karşılığı

### 5.1 Backend sınırı

**Karar:** Backend bu frontend paketinde geliştirilmez. Ancak frontend
**backend-compatible** olmak zorundadır: FastAPI'nin ürettiği OpenAPI sözleşmesine uyar,
uydurma uç kullanmaz, SSR HTML ayrıştırmaz.

**Neden:** Backend ve frontend'i aynı pakette değiştirmek, bir hata çıktığında hangisinin
kırdığını belirsizleştirir. Tek writer / tek paket kuralının teknik karşılığı budur.

### 5.2 "React Router 19" ifadesinin doğru yorumu

Kullanıcı "React Router 19" dedi. Böyle bir sürüm yoktur. İfadenin repoda **doğru
uygulanan** karşılığı:

| Kullanıcı ifadesi | Gerçek karşılık | Repodaki kanıt |
|---|---|---|
| React Router 19 | **React 19.2.8** + **React Router 7.18.2** | `platform/frontend/package.json:35-38` |

Bu bir düzeltme değil, bir **yorumdur** ve yürürlüktedir. React 19 sürüm numarası
React'e aittir; router ayrı bir paket olarak 7.x hattındadır.

### 5.3 Yürürlükteki mimari kararlar

| Alan | Karar | Gerekçe |
|---|---|---|
| Mimari biçim | Modular monolith | Tek ürün, tek ekip, tek veri tabanı. Mikroservis operasyon yükü üretir, değer üretmez. |
| Sürdürülebilirlik | Bakım maliyeti düşük, bağımlılık az | Her bağımlılık bir gelecek borcudur. |
| Donanım | Hetzner AMD EPYC / Intel x86_64 | İkisi aynı ISA (`x86_64`) ve aynı ABI'yi paylaşır; genel `linux/amd64` baseline hedeflenir. `x86-64-v2` daraltması reddedilmiştir. |
| CI/CD | GitHub Actions | Repo zaten GitHub'da; ayrı bir CI altyapısı gereksiz. |
| Backend çatısı | FastAPI (tercih) | Pydantic → OpenAPI → üretilmiş istemci zinciri sözleşme kapısı kurmayı mümkün kılar. |
| Render | React 19 | Repoda kurulu ve çalışıyor. |
| Routing | React Router 7.18.2 | Repoda kurulu; v8'e geçiş otomatik değil, ayrı ve kanıtlı bir milestone'dur. |
| Sunucu durumu | TanStack Query 5 | Repoda kurulu. |
| Tablo | TanStack Table 8 | Repoda kurulu; master DataGrid'in motoru. |
| Form | React Hook Form 7 | Repoda kurulu. |
| Dil | TypeScript strict | Repoda kurulu (`tsc -b --noEmit` build kapısında). |
| Stil | Mevcut CSS token + cascade layer sistemi | Bespoke, pixel-perfect. SCSS ancak ölçülmüş bir ihtiyaç varsa ve Tailwind ile **aynı pakette karıştırılmadan**. |

### 5.4 Kesin yasaklar

| Yasak | Kapsamı |
|---|---|
| **Next.js** | Aday değil, geçiş hedefi değil, opsiyon değil. Hiçbir belgede önerilmez. |
| **MetaFramer** | Aynı kapsam. |
| **Uydurma backend ucu** | Var olmayan bir uca istek atan hiçbir ekran yazılmaz. |
| **Mock veriyi ürün kanıtı saymak** | Mocklu test geçti demek, ürün çalışıyor demek değildir. |
| **"50 eşzamanlı süreç her koşulda açılır" iddiası** | Kurulmaz. Eşzamanlılık daima admission kontrolüne tabidir. |

---

## 6. Frontend kalite sözleşmesi

### 6.1 Waterfall / master-component yaklaşımı

Her bileşen ailesi **önce tek bir olgun ana bileşen** olarak yazılır; türevleri o ana
bileşenin yapılandırmasıdır, kopyası değil.

**Somut örnek:** `DataGrid` tek master bileşendir. Kanban görünümü, takvim görünümü ve
pivot görünümü ayrı tablo bileşenleri değil, aynı master'ın görünüm modlarıdır. Böylece
klavye erişimi bir yerde çözülür, on bir yerde unutulmaz.

### 6.2 Olgunluk sözleşmesi

Bir bileşen ancak şu beşi birden sağlıyorsa "complete" sayılır:

1. **Enterprise:** Gerçek iş yükünü (binlerce satır, uzun metin, eksik veri) kaldırır.
2. **Mature:** Yükleniyor, boş, sonuç yok, hata ve kısmi veri durumlarının hepsi vardır.
3. **Advanced:** İleri yetenekleri (klavye, toplu işlem, URL durumu) taşır.
4. **Complete:** Storybook kataloğunda, testli, dokümanlı.
5. **Erişilebilir:** axe critical/serious = 0 ve klavye ile tam kullanılabilir.

### 6.3 Yolculuk sözleşmesi

Kabul kriteri **ekran** değil **yolculuk**tur. "Fırsat listesi ekranı yapıldı" bir sonuç
değildir. "Bir KOBİ yetkilisi kayıt olur, profilini girer, uygun fırsatı bulur, gerekçeyi
görür, hazırlık listesini çıkarır ve danışmanla paylaşır" bir sonuçtur.

### 6.4 Live browser sözleşmesi

Her milestone gerçek tarayıcıda görülür. Ekran görüntüsü ve axe taraması kanıta eklenir.
Yalnız birim testine dayanan hiçbir "tamamlandı" kabul edilmez.

### 6.5 502 ve kırık yüzey sözleşmesi

502 hataları, boş açılan rotalar ve devre dışı görünen ama gerekçesi yazılmamış her
kontrol **kusurdur** ve ilgili milestone'un kabul kriterine yazılır.

---

## 7. Tasarım sözleşmesi

### 7.1 Ölçüler — pazarlık edilmez

| Kural | Değer | Neden |
|---|---|---|
| Kaynak genişlik | **320px** (gerçek native) | En dar gerçek cihaz. 320'de çalışan her düzen yukarı doğru büyür; tersi doğru değildir. |
| Minimum görünür metin | **1rem** ve üzeri | 1rem altı metin, gerçek kullanıcıda okunmaz ve erişilebilirlik ihlalidir. |
| Yazı tipi | **Roboto**, ağırlık **400+** | 300 ve altı ağırlıklar küçük ekranda kaybolur. Repoda `@fontsource-variable/roboto` kurulu. |
| Köşe yuvarlaklığı | **≤ ~12px** (arama alanı hariç) | Flat 2.0 dilinin sınırı. Arama alanı bilinçli istisnadır. |
| Tema | dark + light | İkisi de birinci sınıf; biri diğerinin türevi değil. |

### 7.2 Büyüme merdiveni

```
320 → 360 → 375 → 390 → 412/430 → 480 → 768 → 1024 → 1280 → 1440+
```

**320 kaynak düzendir.** Büyük ekranlar progressive enhancement'tır. Masaüstü gereklidir
ama **mobil kapanmadan** masaüstüne geçilmez.

### 7.3 Görsel dil

- **Card UI + Flat 2.0:** Kart tabanlı yerleşim, gölge yerine yüzey ve kenar ayrımı.
- **Renk kimliği:** **parliament blue** (ana) + **lemon** (vurgu). Kurumsal ciddiyet +
  dikkat çeken tek aksan.
- **Advanced layered header:** Marka katmanı, bağlam katmanı (kiracı/organizasyon), eylem
  katmanı (arama, bildirim, profil) ve navigasyon katmanı — dört katman.
- **Mükemmel sol/sağ paneller:** Sol panel navigasyon ve bağlam, sağ panel (right rail)
  içgörü, yardım ve aksiyon. İkisi de 320'de gizlenir, 1024'ten sonra kalıcılaşır.
- **Dropdown tutarlılığı:** Tüm platformlarda aynı açılma yönü, aynı klavye davranışı,
  aynı kapanma kuralı.
- **Motion:** Anlam taşıyan hareket. `prefers-reduced-motion` her zaman saygı görür.
- **Adaptive AI:** Arayüz kullanıcının rolüne, geçmişine ve bağlamına göre uyarlanır —
  ama hiçbir uyarlama kullanıcının göremediği bir şeyi gizlemez.

### 7.4 İçerik ve dönüşüm

Ürün hem **content-first** (açıklayan, öğreten) hem **conversion-oriented** (kaydolmaya
ve kullanmaya yönlendiren) hem **data-dense** (yoğun veriyi okunur gösteren) olmalıdır.
Bu üçü çelişmez: kamuya açık yüzey içerik ve dönüşüm ağırlıklı, giriş sonrası yüzey veri
ağırlıklıdır.

---

## 8. Repo kanıtı — bugün gerçekte ne var

Bu bölümdeki her satır repodan ölçülmüştür ve dosya yolu verilmiştir.

### 8.1 Yığın (stack)

`platform/frontend/package.json` içinden:

| Paket | Sürüm |
|---|---|
| react / react-dom | 19.2.8 |
| react-router | 7.18.2 |
| @tanstack/react-query | 5.101.4 |
| @tanstack/react-table | 8.21.3 |
| react-hook-form | 7.85.0 |
| zod | 4.4.3 |
| zustand | 5.0.15 |
| @radix-ui/react-* (dialog, popover, select, tabs, tooltip) | 1.x / 2.x |
| typescript | 5.9.3 |
| vite | 8.2.1 |
| vitest | 4.1.10 |
| @playwright/test | 1.62.1 |
| storybook | 10.5.8 |
| @fontsource-variable/roboto | 5.3.0 |

**Kritik gözlem:** Bu bir MVP yığını değil, düzgün bir kurumsal yığındır. **Eksik olan
yığın değil, üründür.**

### 8.2 Rota envanteri — 29 kayıt, ama daha az yüzey

`platform/frontend/src/app/router.tsx` içindeki `ROUTE_REGISTRY` **29 yol kaydı** taşır.
Ama:

- **2 tanesi yönlendirmedir** (`/organizasyon` → `/organizasyon/profil`,
  `/ayarlar` → `/ayarlar/gorunum`) ve kendi ekranı yoktur.
- **1 tanesi takma addır:** `/uygunluk` ve `/degerlendirmeler` **aynı** `DecisionsRoute`
  bileşenini render eder.
- **4 tanesi parametrelidir** (`:code`, `:id`) ve doğrudan ziyaret edilebilir tek adresi
  yoktur.

Yani "29 rota" ifadesi bir ürün genişliği ölçüsü **değildir**. Gerçek ayrı yüzey sayısı
bundan belirgin biçimde azdır.

### 8.3 Program verisi — yalnız 3 program

Backend seed'i **üç** programla çalışır: TÜBİTAK 1501, TÜBİTAK 1507, KOSGEB Girişimci
Destek Programı. Vizyon "Türkiye destek ekosisteminin tamamı" diyor; ürün üç program
görüyor.

**Sahibin diliyle:** Bir e-ticaret ürünü kurdunuz, katalogda üç ürün var. Yazılım
mükemmel çalışıyor. Kimse alışveriş yapmaz.

### 8.4 Yetenek kütüğü — 18 yeşil / 10 kısmi / 15 engelli

`platform/frontend/src/domain/capabilities.ts` ürünün kendi dürüstlük kütüğüdür ve
sayıları teste bağlıdır.

**Engelli 15 yetenek ve gerekçeleri:**

| # | Yetenek | Neden engelli |
|---|---|---|
| 1 | Parola sıfırlama | E-posta gönderimi ve sıfırlama jetonu backend'de yok |
| 2 | E-posta doğrulama | Doğrulama akışı ve jeton modeli yok |
| 3 | Aktif oturumlarım | `user_sessions` tablosu var, okuma ucu yok |
| 4 | Kullanıcı yönetimi | Kayıt tek kiracı + tek kullanıcı üretir |
| 5 | Rol ve yetki | Rol modeli domainde tanımlı değil |
| 6 | Kaydedilen fırsatlar | Kayıt yeri yok |
| 7 | Sunucu taraflı sayfalama ve filtre | Liste ucu tüm kayıtları filtresiz döner |
| 8 | Kaynak değişiklik geçmişi | Snapshot farkı ucu yok |
| 9 | Onay listesi | `ApprovalOut` şeması yazılmış, hiçbir route kullanmıyor |
| 10 | Denetim izi | `AuditRepository.list_for_tenant` var, HTTP ucu yok |
| 11 | Başvuru hattı | `Application` varlığı domainde hiç yok |
| 12 | Görevler | `Task` varlığı yok |
| 13 | Belge yükleme ve saklama | Yükleme ucu, `media_assets` tablosu ve depolama adaptörü yok |
| 14 | Takvim | Üç programın da çağrı penceresi boş; takvim uydurma tarih üretirdi |
| 15 | Bildirimler | Bildirim tablosu, kanalı ve işçisi yok |

**Bu liste ürünün en dürüst ve en acı verici parçasıdır.** Dürüstlüğü korunacak; içeriği
kapatılacak.

### 8.5 Medya rotası — açık ama boş

`platform/frontend/src/routes/media.tsx` ölçülmüş gerçek:

- Varlık listesi **gerçekten boştur** (`assets={[]}`).
- Klasör ağacı **gerçekten boştur** (`folders={[]}`).
- Depolama sayıları **gerçekten `null`'dır** — sıfır değil, ölçülmemiş.
- `MediaUploadPanel`'e **taşıma katmanı (transport) verilmez**; bu yüzden dosya seçici
  devre dışıdır ve gerekçesi ekrana yazılır.
- Depolama hedefi `local`'dır; S3 yoktur ve opsiyoneldir.

**Bu bir hata değil, bilinçli bir dürüstlük kararıdır.** Ama ürün açısından sonuç şudur:
**dosya kütüphanesi bugün hiçbir dosya kabul etmiyor.**

### 8.6 Sağlayıcı rotası — açık ama devre dışı

`platform/frontend/src/routes/providers.tsx` ölçülmüş gerçek:

- `NO_BACKEND_CAPABILITIES` verilir: her sunucu yeteneği yok, her izin `false`.
- Sihirbaza **`port` verilmez**; yani hiçbir istek dışarı çıkamaz, hiçbir gizli alan
  erişilebilir değildir.
- Bağlantı listesi **gerçekten boştur**.
- `ProviderComparison` bileşeni **kasıtlı olarak mount edilmemiştir**: `.dt-provider-compare`
  kaydırma kabı `overflow-x: auto` ve içinde odaklanabilir hiçbir öğe yok; axe bunu her iki
  görünüm genişliğinde de *serious* seviyede `scrollable-region-focusable` olarak raporluyor.
  Yani fare kullanıcısının kaydırabildiği, klavye kullanıcısının kaydıramadığı bir tablo.
  Düzeltme bileşene aittir ve bir milestone olarak kaydedilmiştir.

Kullanıcının talebi "Gemini, OpenClaw, Claude, ChatGPT bağlansın" idi. Bugün ürün
**hiçbirini bağlayamıyor**; yalnızca her birinin yayımlanmış yöntemlerini, resmî
belgelerini ve veri yönlendirme bildirimini **anlatıyor**.

### 8.7 DataGrid — 11 görünüm isteniyor, 2 tanesi var

`platform/frontend/src/components/data-grid/types.ts:46`:

```ts
export type GridViewMode = "table" | "card";
```

| İstenen görünüm | Var mı |
|---|---|
| table | ✅ |
| card | ✅ |
| list | ❌ |
| kanban | ❌ |
| calendar | ❌ |
| timeline | ❌ |
| group | Kısmi (gruplama var, ayrı görünüm modu yok) |
| pivot | ❌ |
| dashboard | ❌ |
| form | ❌ |
| json | ❌ |

Ayrıca `types.ts:10-11`'de açıkça yazılıdır: **"Everything here is client-side by
construction"** — backend'de sayfalama, filtreleme, sıralama ve toplu işlem ucu olmadığı
için grid yalnız yüklenmiş satırlar üzerinde çalışır. Kullanıcının istediği
**server-side contracts yoktur.**

#### 8.7.1 Beş "ileri yetenek" — üçü bugün çalışıyor, ikisi yok

Önceki bir taslak bu beş yeteneğin tamamını yok saymıştı. **Bu doğru değildir ve
düzeltilmiştir.** `types.ts`'te bir alan bulunmaması, davranışın runtime'da bulunmadığı
anlamına gelmez: bu üç yetenek ayrı modüllerde yaşar, `DataGrid.tsx` içinde bağlanmıştır,
`GridToolbar.tsx` içinde kullanıcıya açılmıştır ve `data-grid.test.tsx` içinde testlidir.

| Yetenek | Bugünkü gerçek | Kanıt | Kalan enterprise açığı |
|---|---|---|---|
| **URL durumu** | ✅ **Var ve çalışıyor** | `url-state.ts` (`encodeGridState`/`decodeGridState`); `DataGrid.tsx:84` `shareUrl`; `GridToolbar.tsx:506` adres kullanıcıya gösteriliyor; `data-grid.test.tsx:333` "URL state" test bloğu | Yalnız grid kapsamında; uygulama geneli rota durumu ve Zod ile şema doğrulaması yok |
| **Kayıtlı görünümler** | ✅ **Var ve çalışıyor** | `saved-views.ts` (`listSavedViews`/`saveView`/`deleteView`); `DataGrid.tsx:129-139`; `GridToolbar.tsx:481-496`; `data-grid.test.tsx:352` "saved views" test bloğu | **Yalnız bu tarayıcıda.** Sunucu tarafında kalıcılık ve kurumsal paylaşım/devretme yok — `capabilities.ts` bunu `cross-device-views` olarak zaten engelli ilan eder |
| **Dışa aktarma** | ✅ **Var ve çalışıyor** (CSV) | `csv.ts` (`toCsv`/`downloadCsv`, formül nötrleştirme dahil); `DataGrid.tsx:126-128`; `GridToolbar.tsx:463`; `data-grid.test.tsx:367` ve `:393` test blokları | **Yalnız CSV ve yalnız yüklenmiş satırlar.** XLSX/PDF yok; sözleşmeye bağlı (contract-backed) sunucu taraflı dışa aktarma yok — `capabilities.ts` bunu `full-dataset-export` olarak engelli ilan eder |
| **Klavye kısayolları** | ❌ **Yok** | `DataGrid.tsx` ve `GridToolbar.tsx` içinde komut kısayolu bağlaması yok | Komut kısayolları hiç yok. (Not: temel klavye **erişilebilirliği** vardır ve `a11y` yeteneği olarak kayıtlıdır; kastedilen, ondan farklı olarak komut kısayollarıdır.) |
| **Gömülü grafik** | ❌ **Yok** | Grid ağacında hiçbir grafik/`chart` referansı yok; `package.json`'da grafik kütüphanesi bağımlılığı yok | Grid içi gömülü grafik hiç yok |

**Doğru okuma:** M40'ın kırmızısı "beş yetenek de yok" değildir. Kırmızı olan, **olgunluk
adımlarıdır**: sunucu tarafında kalıcılık ve kurumsal paylaşım, komut kısayolları, gömülü
grafik ve CSV dışı / sözleşmeye bağlı dışa aktarma. Mevcut üç davranış **korunur**; M40 bir
yeniden yazma değil, bir genişletmedir.

**Sahibin diliyle:** Bir CRM'de filtrelediğiniz listenin adresini kopyalayıp meslektaşınıza
gönderebiliyorsunuz, görünümü adlandırıp kaydedebiliyorsunuz ve CSV indirebiliyorsunuz —
bunların üçü de bugün çalışıyor. Ama kaydettiğiniz görünüm sizin bilgisayarınızda kalıyor;
yarın telefondan girdiğinizde yok ve ekibinizle paylaşamıyorsunuz. Eksik olan yeteneğin
kendisi değil, **kurumsal ölçekte davranışıdır.**

### 8.8 Kamuya açık yüzeyin görsel ve dönüşüm zayıflığı

Kamuya açık yüzey (`/`, `/nasil-calisir`, `/programlar`) bilgi verir ama:

- Marka kimliği (parliament blue + lemon) uygulanmamıştır.
- Kahraman (hero) bölümü, sosyal kanıt, fiyatlandırma, referans ve çağrı-eylem hunisi
  yoktur.
- Danışmanlık hattı hiçbir yerde görünmez.
- SEO ve paylaşım üstverisi (meta/OG) yoktur.

**Sonuç:** Bu yüzey bir müşteri getirmez.

### 8.9 Kabuk (shell) boşlukları

| Bileşen | Durum |
|---|---|
| Advanced layered header | ❌ Katmanlı yapı yok |
| Global arama | ❌ Yok |
| Bildirim merkezi | ❌ Yok (yetenek de engelli) |
| Kiracı / organizasyon menüsü | ❌ Yok |
| Sağ panel (right rail) | ❌ Yok |
| Motion sistemi | ❌ Yok |
| Komut paleti | ❌ Yok |

### 8.10 Kimlik (auth) boşlukları

Parola sıfırlama yok, e-posta doğrulama yok, iki adımlı doğrulama yok, oturum listesi yok,
rol yok, davet yok, ekip yok. Güvenlik ayarları sayfasında **yalnız çıkış** vardır.

### 8.11 Bugünkü dar yolculuk ve eksik satılabilir yolculuk

**Bugün gerçekten yapılabilen (dar) yolculuk:**

> Kayıt → Giriş → Profil doldur (kaydedilir ama geri okunamaz) → Değerlendir (3 program) →
> Karar listesi → Karar detayı (kural izi + kanıt) → Kullanıcı onayı (yazılır, listelenemez)

**Satılabilir olması için eksik olan yolculuk:**

> Kamuya açık sayfada ürünü anla → Ücretsiz dene → Şirketini bağla → **Sistem sana fırsatı
> kendisi getirsin** → Gerekçeyi ve tazeliği gör → Belgeleri yükle ve kontrol ettir →
> Başvuruyu bir hat üzerinde yürüt → Görev ve takvim ile takip et → Danışmanla paylaş →
> Sonucu ve finansal etkiyi raporla → Aboneliğini öde

İkinci yolculuğun **on bir halkasından sekizi bugün yoktur.**

---

## 9. Claude'un bağımsız bulguları ve testlerin neyi kanıtlamadığı

### 9.1 Bağımsız gap analizinin taşınan bulguları

`docs/reports/2026-08-14-claude-gap-analysis.md` read-only bir oturumda üretilmiştir
(`capability_delta: NONE`). Frontend açısından hâlâ yürürlükte olan bulguları:

1. **Skor ve ağırlıklar kalibre edilmemiştir.** Kalibre edilmemiş bir sıralama, kullanıcıya
   kalibre edilmiş bir tavsiye gibi görünür. Bu, ürünün itibarını en hızlı yok edecek şeydir.
2. **Kaynak tazeliği tek bir global tarihle temsil edilemez.** Her kaynak kendi yakalama
   tarihini, içerik hash'ini ve yürürlük tarihini taşımalıdır.
3. **Dürüstlük ürünün en güçlü farkıdır.** Bilinmeyeni bilinmeyen olarak yazmak
   ölçeklenirken kaybedilmemelidir.
4. **17 × 1.6 MB kopya frontend sürdürülebilir değildi** — bu kusur `platform/frontend/`
   ile kapatılmıştır ve tekrar açılmamalıdır.

### 9.2 Testlerin kanıtladığı ve kanıtlamadığı

Frontend paketi yüksek sayıda test raporlar: **son kaydedilen tam suite 941
birim/bileşen/muhafız testi** ve **son kaydedilen koşuda 57 tarayıcı (e2e) testi**.

> **Bu iki sayı bu belge paketinde yeniden koşulmamıştır.** Burada canlı bir doğrulama
> iddiası kurulmaz; aktarılan şey en son kaydedilen koşum sonucudur. Ayrıca bu sayılar
> **koşum sonucudur, dosyadaki test bildirimi sayısı değildir**: bu paketin ölçümünde e2e
> ağacı 7 spec dosyasında **52 statik `test(` bildirimi** taşır ve bunlar iki Playwright
> projesinde (chromium, mobile) koşar. Bildirim sayısı ile geçen test sayısı farklı
> ölçülerdir ve birbirinin yerine yazılamaz.

**Bu sayılar neyi kanıtlar:**

- Bileşenler kendi sözleşmelerine uyar.
- Yasaklı ifadeler ("onaylandı", "hak kazandınız", "alacağınız tutar", "garanti") kaynak
  ağacında sıfır kez geçer.
- Mimari sınır korunur: `domain/` React/router/Query import etmez, bileşenler doğrudan
  `fetch` çağırmaz, istemcide kural motoru çalışmaz.
- Tarayıcı depolamasına kimlik veya şirket olgusu yazılmaz.
- Erişilebilirlik taramasında critical/serious ihlal yoktur.

**Bu sayılar neyi KANITLAMAZ — ve bu bölüm bu raporun en önemli uyarısıdır:**

1. **Tarayıcı testleri mocklu backend'e karşı çalışır.** Her e2e spec başlığı
   `[mocked backend]` taşır. Gerçek FastAPI + PostgreSQL karşısında uçtan uca akış
   **UNVERIFIED**'dır.
2. **Test sayısı ürün tamamlanması değildir.** 941 test (son kayıt), var olan yüzeylerin doğru
   çalıştığını söyler; **olmayan yüzeyler hakkında hiçbir şey söylemez.** Başvuru hattı
   yoktur, dolayısıyla başvuru hattının testi de yoktur — ve test sayısı bundan hiç
   etkilenmez.
3. **Mock testi production kanıtı değildir.** Bu, bu belgenin bağlayıcı kuralıdır.
4. **CI hiç çalışmamıştır.** `frontend-ci.yml` GitHub'da hiç koşmadı.
5. **Performans bütçeleri ölçülmemiştir.** Yalnız paket boyutu ölçüldü; LCP/INP/CLS
   ölçülmedi.
6. **Yalnız Chromium ve Chromium tabanlı mobil emülasyon** çalıştırıldı. WebKit ve Firefox
   UNVERIFIED.
7. **Manuel ekran okuyucu turu yapılmadı.** Otomatik axe temizdir; bu farklı bir şeydir.

**Sahibin diliyle:** Bir HRMS'in bordro modülü için 900 test yazdınız ve hepsi geçiyor.
Ama testler sahte bir maaş servisine bağlı. Gerçek SGK servisine bağlandığında hiç
denenmedi. Ve ürünün izin modülü hiç yazılmadı. **900 yeşil test, ürünün hazır olduğunu
söylemez; yazılmış olan kısmın kendi içinde tutarlı olduğunu söyler.**

---

## 10. Birleşik gap matrisi

### 10.1 P0 — Bunlar olmadan satılabilir hiçbir şey yok

| # | Boşluk | Bugünkü durum | Ürün etkisi |
|---|---|---|---|
| P0-1 | 320px native mobile-first kabuk | Yok (responsive var, native mobile-first yok) | Kullanıcıların çoğunluğu telefondan gelir ve ürünü kullanamaz |
| P0-2 | Marka ve görsel kimlik (parliament blue + lemon, Flat 2.0) | Yok | Ürün gösterildiğinde ciddiye alınmaz |
| P0-3 | Advanced layered header + global arama + sağ panel | Yok | Kullanıcı ürünün içinde kaybolur |
| P0-4 | Satılabilir kamuya açık yüzey (hero, fiyat, dönüşüm hunisi, SEO) | Yok | Hiç müşteri gelmez |
| P0-5 | Master DataGrid'in eksik 9 görünüm modu | 2/11 var | Veri yoğun iş yapılamaz |
| P0-6 | Sunucu taraflı grid sözleşmesi | Yok | Veri büyüdüğünde ürün çöker |
| P0-7 | Başvuru hattı (Application) | Varlık düzeyinde yok | Ürünün ikinci yarısı hiç yok |
| P0-8 | Belge yükleme ve saklama | Taşıma katmanı yok | Dosya kütüphanesi hiçbir dosya kabul etmiyor |
| P0-9 | Bildirim ve içgörü | Yok | Proaktiflik iddiası boş kalıyor |
| P0-10 | Rol / yetki / ekip | Yok | Tek kullanıcıdan öteye geçilemez |
| P0-11 | Parola sıfırlama, e-posta doğrulama | Yok | Gerçek kullanıcı hesabını kurtaramaz |
| P0-12 | AI sağlayıcı bağlantısı (Gemini/OpenClaw/Claude/ChatGPT) | Yalnız anlatım, bağlantı yok | AI-first vaadi çalışmıyor |
| P0-13 | AI-first davranış (proaktif fırsat, açıklama, deep link) | Yok | Ürünün temel farkı yok |
| P0-14 | Program verisinin genişletilmesi (3 → uzman doğrulanmış set) | 3 program | Ürün cevap veremiyor |
| P0-15 | Gerçek backend karşısında uçtan uca doğrulama | UNVERIFIED — sahibi **M67** | Ürünün çalıştığı kanıtlanmadı. **M67 GREEN olmadan production veya satılabilirlik kararı verilemez** |

### 10.2 P1 — MVP'den hemen sonra

| # | Boşluk | Ürün etkisi |
|---|---|---|
| P1-1 | Görev ve takvim | Başvuru takibi yapılamaz |
| P1-2 | Denetim izi ve onay listesi ekranları | Kurumsal müşteri denetim isteyecek |
| P1-3 | Dijital ikiz (şirketin yaşayan modeli) | Vizyonun merkezi varlığı |
| P1-4 | Senaryo ve simülasyon | "Ya şunu yapsam" sorusu cevapsız |
| P1-5 | CRM ve danışmanlık hattı | İkinci gelir hattı yok |
| P1-6 | Faturalama ve abonelik | Para tahsil edilemiyor |
| P1-7 | i18n ve country packs | Uluslararası hazırlık |
| P1-8 | Belge zekâsı (OCR, alan çıkarımı, kaynak/güven, insan doğrulaması) — sahibi **M65** | Kanıt "işaretlendi" ≠ "doğrulandı"; doğrulanmamış bir alan doğrulanmış gibi gösterilemez |
| P1-9 | Kaynak değişiklik farkı (diff) | Mevzuat değişikliği yakalanamıyor |
| P1-10 | Analytics ve finansal etki raporlaması — sahibi **M66** | Finansal etki gösterilemiyor; ölçülmemiş değer `0` olarak yazılamaz, em-dash olarak görünür |

### 10.3 P2 — Sonraya (şimdi yapılırsa zarar verir)

| # | Boşluk | Neden sonraya |
|---|---|---|
| P2-1 | Bilgi grafiği (fiziksel graph DB) | İlişkiler önce ilişkisel modelde yeterli |
| P2-2 | Vektör arama / RAG | Doküman hacmi yokken erken |
| P2-3 | Katmanlı hafıza terfi eşikleri | Kalibre edecek gerçek veri yok |
| P2-4 | Plugin / skill marketi ve SDK | İkinci gerçek tüketici çıkmadan yanlış tasarlanır |
| P2-5 | Öngörü ve tahmin katmanı | Geçmiş çağrı verisi olmadan tahmin = halüsinasyon |
| P2-6 | Resmî kuruma otomatik başvuru gönderimi | Geri alınamaz, hukuki sonuçlu |
| P2-7 | Taksonomi / meta motor | Önce 3-4 somut domain yazılmalı |
| P2-8 | Platform evolution (kendini geliştirme) | En son katman |

### 10.4 Eksik ekranlar

Kamuya açık: hero landing, fiyatlandırma, referanslar, danışmanlık, blog/kaynak merkezi,
iletişim, hakkımızda, yasal metinler, SSS.

Uygulama içi: global arama sonuçları, bildirim merkezi, komut paleti, ekip yönetimi,
davet, rol matrisi, denetim izi, onay kuyruğu, başvuru hattı (liste + kanban + detay),
görev panosu, takvim, belge çalışma alanı, belge önizleme, sürüm geçmişi, AI sohbet
çalışma alanı, içgörü akışı, dijital ikiz, senaryo tezgâhı, analitik panosu, faturalama,
abonelik, kullanım, hesap ayarları, entegrasyonlar, webhook, API anahtarları, i18n
ayarları, ülke paketi seçimi.

### 10.5 Eksik bileşenler

Layered header, global search, command palette, notification center, tenant switcher,
right rail, kanban board, calendar, timeline, pivot table, dashboard widget grid,
json viewer, list view, inline row editor, bulk action bar, saved views menu, export
menu, column manager, filter builder, chart primitives, file uploader with transport,
file preview, folder tree with drag-drop, version history, comment thread, mention,
activity feed, AI chat panel, AI suggestion card, voice input, stepper wizard shell,
empty-state illustration set, motion primitives, toast system, onboarding tour.

---

## 11. Uygulanacak 10 faz

**İki ayrı numaralandırma vardır ve birbirine karıştırılmamalıdır:**

- **F1–F10 — sahibe dönük (owner-facing) faz.** Sahibin ürünü hangi büyük adımlarla
  göreceğini anlatır. Raporlama ve kabul dili bu numarayı kullanır.
- **A–V — yürütme grubu (execution group).** `MULTI-AGENT-GELISTIRME-POLITIKASI-VE-YOL-HARITASI.md`
  Bölüm 7'deki milestone tablolarının başlıklarıdır. Paket, writer ve bağımlılık dili bu
  harfi kullanır.

Bir F fazı bir veya birden çok yürütme grubunu kapsar. Kesin eşleme aşağıdadır ve
`MULTI-AGENT...` Bölüm 7.1'deki tabloyla birebir aynıdır.

| Faz | Ad | Yürütme grubu | Milestone aralığı | Kapsam | Çıktı |
|---|---|---|---|---|---|
| **F1** | Yönetişim ve temel | A | **M01–M04** (4) | Belgeler, roller, kapılar, RED altyapısı, tasarım token'larının 320px doğrulaması | Ölçülebilir başlangıç çizgisi |
| **F2** | 320px native kabuk ve görsel kimlik | B | **M05–M13** (9) | Mobile-first kabuk, layered header, sol/sağ panel, parliament blue + lemon, Flat 2.0, motion, dark/light | Ürün ilk kez "ürün gibi" görünür |
| **F3** | Bilgi mimarisi ve navigasyon | C | **M14–M18** (5) | Rota haritası, global arama, komut paleti, bildirim merkezi, kiracı menüsü | Kullanıcı kaybolmaz |
| **F4** | Kimlik ve organizasyon | D | **M19–M22** (4) | Parola sıfırlama, e-posta doğrulama, 2FA, oturumlar, organizasyon profili | Gerçek hesap yönetimi |
| **F5** | Fırsat ve uygunluk | E, F | **M23–M28** (6) | Fırsat zekâsı, genişletilmiş program seti, kural motoru yüzeyi, kaynak tazeliği ve diff, karar tezgâhı | Ürünün çekirdek değeri |
| **F6** | Enterprise grid ve görünümler | I | **M35–M40** (6) | Master DataGrid'in 11 görünüm modu, sunucu taraflı sözleşmeler ve M40'ın olgunluk adımları (bkz. 8.7.1) | Veri yoğun çalışma |
| **F7** | Başvuru operasyonu | G, H, J, S | **M29–M34, M41–M43, M65** (10) | Başvuru hattı, görev, takvim, bildirim, belge kütüphanesi, taşıma katmanı ve **belge zekâsı (OCR)** | Ürünün ikinci yarısı |
| **F8** | AI-first katman | K, L | **M44–M50** (7) | Sağlayıcı bağlantıları, master + uzman ajanlar, içgörü akışı, ECA, katmanlı hafıza, beceri sürümleme, dijital ikiz, simülasyon | Ürünün temel farkı |
| **F9** | Ticarileşme | M, N, O, T | **M51–M56, M66** (7) | Ekip/rol/denetim, CRM, danışmanlık hattı, faturalama, abonelik, i18n, country packs ve **analitik/finansal etki** | Para tahsil edilebilir |
| **F10** | Sertleştirme ve satılabilirlik | P, Q, R, U, V | **M57–M64, M67, M68** (10) | Performans, güvenlik, erişilebilirlik, çapraz tarayıcı, CI, Hetzner dağıtımı, satılabilir kamuya açık yüzey, **gerçek backend E2E** ve **final kapanış kararı** | Satılabilir SaaS |

**Toplam: 68 milestone.** Aralıklar kesişmez ve M01–M68'in tamamını kapsar.

> **Sıra uyarısı.** F fazları numara sırasına göre yürütülür, ancak **milestone
> numaraları F sırasına göre kesintisiz değildir**: F6 (M35–M40), F7'nin ilk
> milestone'undan (M29) sonra gelen bir numara aralığı taşır. Bağlayıcı olan
> **bağımlılık sütunudur**, numara bitişikliği değil.

---

## 12. Riskler

| # | Risk | Etki | Azaltma |
|---|---|---|---|
| R1 | Mock testleri gerçek kanıt sanmak | Ürün çalışmadığı hâlde bitmiş sanılır | Her paket gerçek backend kapısını ayrı raporlar |
| R2 | Kalibre edilmemiş skorların tavsiye gibi görünmesi | İtibar kaybı, yanlış başvuru | Skorlar ya kaldırılır ya "editoryal, kalibre edilmemiş" etiketlenir |
| R3 | Mevzuat tazeliğinin kaybolması | Doğrudan parasal zarar | Kaynak başına snapshot + hash + yürürlük tarihi zorunlu |
| R4 | Masaüstüne mobil kapanmadan geçmek | 320px yeniden yazılır, iş iki kez yapılır | Faz kapısı: mobil GREEN olmadan masaüstü başlamaz |
| R5 | Görsel tasarımın sonraya bırakılması | Ürün satılamaz hâlde kalır | Görsel kimlik F2'dedir, F10'da değil |
| R6 | AI'ın yetki sınırının gevşemesi | Ürünün tüm güven modeli çöker | Yasaklı ifade muhafızı ve şema reddi testle korunur |
| R7 | Tek writer kuralının delinmesi | Çakışan değişiklikler, izlenemez hata | Paket başına tek writer, ayrı reviewer |
| R8 | Eşzamanlı ajan sayısının kontrolsüz büyümesi | Sistem kaynakları tükenir | `allowNewWorker` / `recommendedNewWorkers` admission kontrolü |
| R9 | Router v8'e plansız geçiş | Tüm rota katmanı kırılır | v8 ayrı, kanıtlı bir milestone; otomatik upgrade yok |
| R10 | Bespoke tasarımın topluca yeniden yazılması | Aylarca kayıp, regresyon | Toplu yeniden yazma yasak; kademeli iyileştirme |
| R11 | KVKK ve ticari sır yüzeyi | Hukuki risk | AI bağlamına PII otomatik girmez; log'da PII yok |
| R12 | Program verisinin uzman doğrulaması olmadan büyütülmesi | Ürün yalan söyler | Data-pack ayrı bir owner kararıdır |

---

## 13. Doğrulama alanları — her rapor bunları taşır

Her milestone raporu ve her faz raporu aşağıdaki altı alanı **eksiksiz** taşır:

| Alan | Anlamı |
|---|---|
| `once` | Bu paketten önce kullanıcı ne yaşıyordu |
| `simdi` | Bu paketten sonra ne yaşıyor |
| `fark` | Aradaki fark, somut olarak |
| `kullaniciYolculugu` | Gerçek bir kullanıcının baştan sona yolculuğu |
| `kalanEngel` | Hâlâ yapılamayan ve kimin çözeceği |
| `capability_delta` | Eklenen/çıkan yetenek; hiçbiri eklenmediyse `0` |

Ek olarak her rapor şunları taşır: brüt eklenen satır, brüt silinen satır, net, dosya
sayısı, paket sınıfı, kanıt ve kapı sonucu.

---

## 14. Rollback

Bu belge yalnızca dört dosyaya dokunur:

1. `.gitignore` (eklenen satırlar)
2. `ENTERPRISE-FRONTEND-TALEP-VE-GAP-RAPORU.md` (bu dosya)
3. `FRONTEND-TECHSTACK.md`
4. `MULTI-AGENT-GELISTIRME-POLITIKASI-VE-YOL-HARITASI.md`

**Rollback yolu:** üç Markdown dosyasının silinmesi ve `.gitignore`'a eklenen satırların
geri alınması. Sonuç, deponun bu paket hiç var olmamış hâlidir. Hiçbir ürün kodu, test,
rapor veya yapılandırma etkilenmez.

Rollback kararı ve yürütmesi **Codex Desktop MASTER**'ındır.

---

## 15. MASTER kararı

1. **"Enterprise frontend tamamlandı" kararı geri çekilmiştir.**
2. **Bugünkü sınıf: MVP altı prototip.** Erişilebilirlik ve token temeli korunur; ürün
   katmanı sıfırdan kurulur.
3. **Bu belge salt okunurdur ve `capability_delta` değeri `0`'dır.**
4. **Sıradaki iş F1'dir.** F1, `MULTI-AGENT-GELISTIRME-POLITIKASI-VE-YOL-HARITASI.md`
   içindeki **A yürütme grubudur ve tam olarak dört milestone'dan oluşur: M01, M02, M03,
   M04.** F1 bu dördü GREEN olunca kapanır; **F2 M05 ile başlar.** F1'in "ilk on
   milestone" olduğu **iddia edilmez** — o on satırlık liste (`MULTI-AGENT...` Bölüm 15)
   bir başlangıç *sırasıdır* ve F1 ile F2'nin başını birlikte kapsar, bir faz sınırı
   değildir.
5. **Hiçbir pakette Next.js veya MetaFramer önerilmez.**
6. **Hiçbir pakette mock testi production kanıtı sayılmaz.**
7. **Backend bu frontend programında geliştirilmez**; ancak her frontend paketi
   backend-compatible olduğunu OpenAPI sözleşmesine karşı kanıtlar.
8. **Git işlemleri yalnız MASTER'a aittir** ve yalnız GREEN kapılardan sonra yapılır.

---

## 16. Owner özeti — sade Türkçe

**once:** Elimizde teknik olarak düzgün, erişilebilir, testli ama ürün olarak ince bir
frontend vardı ve bu "enterprise tamamlandı" diye raporlanmıştı.

**simdi:** Aynı frontend duruyor; **hiçbir kodu değişmedi.** Değişen şey, ne olduğunun
doğru yazılmış olması: ürün, UX, yolculuk, fonksiyon ve görsel tasarım bakımından MVP
altı bir prototip.

**fark:** Artık kimse bu ürünün bittiğini sanmıyor. Ne eksik olduğu 15 P0, 10 P1 ve 8 P2
başlığında, dosya yolu ve satır numarasıyla yazılı. Ne yapılacağı 10 faza bölünmüş.

**kullaniciYolculugu:** Bugün bir KOBİ yetkilisi kayıt olup giriş yapabiliyor, profilini
girebiliyor, üç program için uygunluk değerlendirmesi çalıştırabiliyor, her kararın hangi
kurala ve hangi resmî kaynağa dayandığını görebiliyor ve kendi onayını kaydedebiliyor.
Bunun dışında hiçbir şey yapamıyor: dosya yükleyemiyor, başvuru takip edemiyor, bildirim
alamıyor, ekip ekleyemiyor, yapay zekâ bağlayamıyor ve ürünü telefonda rahat kullanamıyor.

**kalanEngel:** 15 P0 başlığının tamamı. En kritik üçü: (1) 320px native kabuk ve görsel
kimlik, (2) başvuru hattı ve belge taşıma katmanı, (3) AI sağlayıcı bağlantısı ve
AI-first davranış. Ayrıca program verisinin uzman doğrulamasıyla genişletilmesi bir
**owner kararıdır** ve hiçbir mühendislik paketiyle kapanmaz.

**capability_delta:** `0`. Bu belge hiçbir yetenek eklemedi. Yaptığı tek şey, neyin
olmadığını kayda geçirmek — ve bu, bir sonraki paketin doğru işi yapabilmesinin ön
şartıdır.
