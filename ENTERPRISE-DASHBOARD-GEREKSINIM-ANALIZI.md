# Enterprise Dashboard (Kokpit) İçerik Kanvası — Gereksinim Analizi

Bu belge, DestekTeşvik ürününün `/panel` rotasındaki Kokpit (dashboard) sayfasının **içerik
gövdesini** (content canvas) tanımlar. Sahibi teknik olmayan biridir; her bölüm önce "bu ne işe
yarar" sorusuna, sonra "bugün ne var / ne eksik" sorusuna, en son "hangi teknik sözleşmeyle
inşa edilir" sorusuna cevap verir.

---

## 1. Kısa Sahip Özeti

Kokpit, kullanıcının uygulamayı açtığında gördüğü ilk ve en önemli sayfadır — bir CRM'in "Bugün"
ekranı gibi düşünülebilir. Bugün bu sayfa üç küçük kart (sonuç özeti, sıradaki eylem, katalog/
kaynak sayacı) ve bir analiz bölümünden ibarettir; teklif edilen "Bugünün özeti" şeridi (kanıt
bekleyen karar, geciken belge, en yakın son başvuru, hazırlık yüzdesi) **henüz kodda yoktur** ve
bu şeridin iki kalemi (başvuru hazırlığı, kullanıcı güvenlik duruşu) bugünkü veriyle **ölçülemez**
durumda olduğu ürünün kendi kapasite kaydında (bkz. §23, kanıt) itiraf edilmiştir. Bu belge; hangi
bölümlerin, hangi sırayla, hangi veriyle, hangi izin ve durumla gösterileceğini; hangilerinin
bugün inşa edilebilir (gerçek veya dürüst mock/demo) ve hangilerinin backend beklediği için
"engellendi" etiketiyle bekletileceğini satır satır tarif eder. Amaç: kokpiti gerçekte
satılabilecek, kurumsal müşteriye "bu ürün ne yapıyor" sorusuna dürüstçe cevap veren bir yüzeye
dönüştürmek — kabuk (header/menü) hiç değişmeden.

---

## 2. Kapsam / Kapsam Dışı / Kaynak Otoritesi

### Kesin kapsam dışı (dokunulmaz, kullanıcı tarafından tasarlanıp verildi)
AppShell/masterpage, CognitiveSpotlightHeader/header/spotlight, NavigationSheet/sidebar/
hamburger, hesap-profil menüsü, global navigasyon. Bu belge bunları **tasarlamaz, tekrar
tanımlamaz, önermez.**

### Kapsam
Yalnızca `/panel` (`DashboardRoute`, `src/routes/app.tsx:643`) rotasının `<Shell>` içine
render ettiği içerik gövdesi: kartlar, analiz bölümü, gelecekte eklenecek karar kuyruğu, fırsat/
deadline akışı, kanıt-eksikliği görünümü, finansal etki bölümü ve bunların veri/etkileşim
sözleşmeleri.

### Kaynak otoritesi (öncelik sırası)
1. `qq33MASTER-PROMPT.md` BÖLÜM 5 (P5 · CockpitPage) — tek somut ürün-içerik gereksinimi
   (doğrulandı: satır 323–343).
2. `ENTERPRISE-FRONTEND-TALEP-VE-GAP-RAPORU.md` — mevcut/eksik envanteri, ölçülmüş sayılar.
3. `FRONTEND-TECHSTACK.md` — bağlayıcı teknik sözleşmeler (Tailwind v4, shadcn, Phosphor,
   ECharts, TanStack Query/Table, test/Storybook/skeleton kuralları).
4. `MULTI-AGENT-GELISTIRME-POLITIKASI-VE-YOL-HARITASI.md` — milestone ID'leri (`V2-P1-6x`),
   faz kapıları, Definition of Done.
5. Mevcut kod (`src/routes/app.tsx`, `src/components/analytics/*`, `src/routes/QueryBoundary.tsx`,
   `src/api/*`) — bu belgedeki her "bugün var" iddiası dosya:satır kanıtına dayanır.

Çelişki olduğunda 1 → 2 → 3 → 4 sırası bağlayıcıdır; kod, "bugün ne var" sorusunun tek
otoritesidir.

---

## 3. Ürün Hedefi ve Enterprise Tanımı

Kokpit'in ürün hedefi: kullanıcının "bugün ne yapmalıyım, param nerede risk altında, hangi
karar beni bekliyor" sorularına **tek ekranda, kaynağı görünür, iddia etmeyen** bir cevap
vermek. "Enterprise" burada üç somut anlama gelir:

1. **İzlenebilirlik** — her sayı bir kaynağa, tarihe ve kural sürümüne bağlanır (bkz. §10).
2. **Çok kullanıcılı/çok kiracılı disiplin** — aynı ekran farklı rol ve kiracı için farklı
   davranır, izinsiz veri hiçbir zaman sızmaz (bkz. §17).
3. **Denetlenebilirlik** — kokpitte görünen her eylem (onay, değerlendirme çalıştırma) bir audit
   kaydı bırakır (bkz. §17).

Kokpit bir "süsleme" değildir; ürünün satılabilirlik iddiasının somutlaştığı yerdir. Bu yüzden bu
belgedeki her gereksinim mock veriyi resmi veri gibi göstermeyi yasaklar (§22).

---

## 4. Roller, Personalar, JTBD (Jobs To Be Done)

Bugün kodda **tek biçimli** bir kokpit vardır; rol bazlı farklılaşma yoktur (doğrulandı:
`DashboardRoute` içinde rol/izin dallanması yok, yalnızca demo-rol URL parametresi görünüm
verisini değiştiriyor, gerçek RBAC değil — `src/routes/app.tsx:220-257`). Aşağıdaki personalar
hedef durumu tarif eder, bugünkü durumu değil.

| Persona | JTBD (kokpitte) | Öncelik |
|---|---|---|
| KOBİ sahibi / tek kullanıcı | "Bugün hangi teşvike başvurmalıyım, hangi belge eksik?" | MUST (bugün de tek kullanıcı senaryosu çalışıyor) |
| Danışman / çoklu-firma yöneticisi | "Hangi müşterim risk altında, hangi karar onayımı bekliyor?" | SHOULD (rol modeli backend'de yok, §17 REQ-DASH-016 bağımlı) |
| Yönetici / finans sorumlusu | "Toplam finansal etki ne, hangi program grubu en çok değer üretti?" | SHOULD (§9 finansal etki backend'e bağımlı) |
| Denetçi (audit) | "Bu karar nasıl alındı, kim onayladı, hangi kaynağa dayandı?" | MUST uzun vadede, bugün MAY (audit ucu yok) |

---

## 5. Dashboard User Journey Haritası

Zorunlu döngü: **insight → anlama → kanıt → aksiyon → drill-down → geri dönüş.**

```
[Kokpit'e giriş]
   │
   ▼
1. INSIGHT   — "Bugünün özeti" şeridi + Sonuç dağılımı kartı: en üstte, tek bakışta durum
   │              (bugün: özet şeridi yok, yalnız sonuç dağılımı var)
   ▼
2. ANLAMA    — Kart içi açıklama metni: "3 kararda eksik olgu var" gibi ölçülmüş cümle
   │              (bugün: OutcomeDistribution + "Sıradaki eylem" kartında var)
   ▼
3. KANIT     — Kaynak/tazelik göstergesi: hangi veri, ne zaman okundu, ne kadar güncel
   │              (bugün: SourceFreshnessMeter var; provenance yalnız kaynak seviyesinde,
   │               KPI seviyesinde yok — §10 boşluğu)
   ▼
4. AKSIYON   — Birincil CTA (sihirbaz) + kart-içi ikincil eylemler (değerlendirmeyi çalıştır)
   │              (bugün: tek birincil CTA disiplini kodda bilinçli korunuyor — app.tsx yorum
   │               satırı: "iki cevap aynı anda 'sırada ne var' sorusuna yanıt olamaz")
   ▼
5. DRILL-DOWN — Karttan detaya/karar listesine/hazırlık ekranına link
   │              (bugün: sınırlı — yalnız "Hazırlık ekranına git" ve profil linki var;
   │               karar detayına, kaynağa, denetim kaydına tıklanabilir geçiş yok)
   ▼
6. GERİ DÖNÜŞ — Detaydan kokpite dönüşte scroll/focus konumu korunur
                  (bugün: kanıtlanmadı, story/test yok)
```

Bu döngü her yeni bölüm (karar kuyruğu, fırsat akışı, finansal etki) için aynen tekrarlanmalı;
"insight var ama drill-down yok" durumu kabul edilmez (MUST).

---

## 6. Sayfa Bilgi Mimarisi ve Section Sırası

Bugünkü sıra (kod kanıtı, `app.tsx:754-860`) korunur ve genişletilir; yeni bölümler mevcut
disiplin bozulmadan eklenir:

| # | Section | Durum | Öncelik |
|---|---|---|---|
| 0 | Sayfa başlığı `<h1>Kokpit</h1>` | Var | — |
| 1 | **Bugünün özeti şeridi** (4 satır, provenance'lı) | Yok — P5 zorunluluğu, inşa edilecek | MUST |
| 2 | Sonuç dağılımı kartı (`OutcomeDistribution`) | Var | — (korunur) |
| 3 | Sıradaki eylem kartı | Var | — (korunur, drill-down genişletilir) |
| 4 | **Karar/onay kuyruğu** | Yok | MUST |
| 5 | **Fırsat ve son-tarih akışı** | Yok | SHOULD |
| 6 | Katalog ve kaynak kartı (`DefinitionList` + `SourceFreshnessMeter`) | Var | — (korunur) |
| 7 | **Kanıt-eksikliği (evidence gap) özeti** | Yok | SHOULD |
| 8 | Yoğun analiz bölümü (`PortfolioAnalytics`, 3 sekme) | Var, lazy | — (korunur, genişletilir) |
| 9 | **Finansal etki bölümü** | Yok | SHOULD (backend'e bağımlı, §24) |
| 10 | Context rail (`AdaptiveAssistant`) | Var, kapsam: yalnız içerik-tarafı davranışı bu belgede (§11) | — |

Sıra kuralı: özet şeridi her zaman en üstte; aksiyon gerektiren bölümler (karar kuyruğu) analiz
bölümünden önce gelir — "ne yapmalıyım" sorusu "ne olmuş" sorusundan önce cevaplanır.

---

## 7. Section Bazlı Ayrıntılı Gereksinimler

### 7.1 Bugünün Özeti Şeridi (REQ-DASH-001)
4 satır: kanıt bekleyen karar sayısı, geciken belge sayısı, en yakın son başvuru tarihine kalan
gün, başvuru hazırlık yüzdesi (P5 zorunluluğu, satır 334-336). **MUST**: her satır gerçek
sorgudan gelir; yer tutucu/mock sabit metin yasak. Ancak `domain/capabilities.ts:300` şunu itiraf
ediyor: "7 boyuttan 2'si ölçülemiyor (başvuru hazırlığı, kullanıcı güvenlik duruşu)". Bu nedenle:
başvuru hazırlığı kalemi bugün gerçek veriyle doldurulamaz → **em-dash + "ölçülemiyor" etiketiyle**
gösterilir, asla örnek `%58` yazılmaz (MUST). Geciken belge ve kanıt bekleyen karar, mevcut
`Decision.missing_facts`/`review_status` alanlarından türetilebilir (MUST). En yakın son başvuru,
`Program.call_window_state` boşsa gösterilmez, uydurulmaz (P5 ile aynı kural, gap-rapor 680).

### 7.2 Sonuç Dağılımı (mevcut, korunur)
`OutcomeDistribution` (`src/components/domain.tsx:97`) 4 sabit sonuç kategorisinin sayımını
gösterir. **MUST**: mevcut boş-durum davranışı korunur. **SHOULD**: her kategoriye tıklanınca
filtrelenmiş karar listesine drill-down (bugün yok).

### 7.3 Sıradaki Eylem (mevcut, genişletilir)
Bugün: eksik-olgu sayısı + "Hazırlık ekranına git" linki. **SHOULD**: bu kart, §7.4 karar
kuyruğunun özet/giriş noktası haline gelmeli — tek kararlık özet yerine öncelik sıralı ilk 3
kararı listelemeli.

### 7.4 Karar / Onay Kuyruğu (REQ-DASH-005)
**MUST**: kanıt bekleyen kararların, en yakın son tarihe veya en yüksek finansal etkiye göre
sıralı bir listesi; her satır karar detayına drill-down verir. Backend tarafı: `ApprovalOut`
şeması yazılmış ama hiçbir route kullanmıyor (gap-rapor 675) → bu bölüm **backend gelene kadar
"engellendi" (blocked) etiketiyle** gösterilir, sahte onay akışı simüle edilmez (§22).

### 7.5 Fırsat ve Son Tarih Akışı (REQ-DASH-004, REQ-DASH-007)
**SHOULD**: yaklaşan başvuru pencereleri, mevzuat değişiklikleri, proaktif fırsatlar. Bugün: üç
seed programın da çağrı penceresi boş; bir takvim bu veriyle uydurma tarih üretirdi (gap-rapor
680) → veri yoksa bölüm tamamen gizlenir veya "izlenecek kaynak yok" boş-durumu gösterir, asla
placeholder tarih üretmez (MUST).

### 7.6 Katalog ve Kaynak (mevcut, korunur)
`DefinitionList` + `SourceFreshnessMeter`/`PartialDataNotice`. **MUST**: mevcut "okunamadı ≠ 0"
disiplini (`app.tsx` yorum: "`?? 0`... confident, wrong, measured-looking claim") her yeni
sayaç için de uygulanır.

### 7.7 Kanıt Eksikliği Özeti (REQ-DASH-008)
**SHOULD**: `Decision.missing_facts[]` bugün yalnız sayı olarak "Sıradaki eylem" kartında
görünüyor; ayrı bir bölüm, hangi belgenin hangi kararı blokladığını listeler. "İşaretlendi" ile
"doğrulandı" farkı UI'da açıkça ayrılır (gap-rapor 970) — bir belge yüklendi diye doğrulanmış
gösterilmez.

### 7.8 Yoğun Analiz Bölümü (mevcut, genişletilir)
`PortfolioAnalytics` (`src/components/analytics/PortfolioAnalytics.tsx:290`) — Portföy/Sonuç/
Kanıt sekmeleri. **MUST**: mevcut lazy-boundary ve 4-durum modeli (`components/analytics/
model.ts`) korunur. **SHOULD**: kullanıcı tanımlı "dashboard" görünüm modu (DataGrid'in 11
görünüm modundan biri, bugün 2/11 var — gap-rapor 726-738).

### 7.9 Finansal Etki Bölümü (REQ-DASH-009)
**SHOULD**, backend bağımlı (`V2-P5-28/29`). Bugün hiçbir para alanı yok;
`OutcomeDistribution`'ın kod içi doküman yorumu açıkça reddediyor: "yalnız sayım, para değil —
ürünün dürüstçe toplayabileceği tek şey kaç kararın hangi kovaya düştüğü." Bu bölüm inşa
edilirse: ölçülmemiş finansal değer **asla `0` değil, em-dash** (gap-rapor 972, MUST).

---

## 8. Dashboard'a Özel Component Envanteri ve Hiyerarşisi

Shell/kabuk bileşenleri (AppShell, WorkspaceShell, PublicShell, AuthShell, PrintShell —
`registry.ts:69`) bu envanterin dışındadır. Techstack'in 5 kademeli modeline göre (primitif →
composite → master → master-main → derived):

| Kademe | Mevcut (korunur) | Yeni (bu belge kapsamında) |
|---|---|---|
| Composite | `Card`, `DefinitionList` (`composites.tsx:200,397`) | — |
| Domain (master-benzeri) | `OutcomeDistribution`, `SourceFreshnessMeter` (`domain.tsx`) | `TodaySummaryStrip`, `DecisionQueue`, `OpportunityFeed`, `EvidenceGapPanel`, `FinancialImpactPanel` |
| Master | `PortfolioAnalytics`, `EChart` (`analytics/`) | `DashboardWidgetGrid` (kullanıcı tanımlı düzen, ileri faz) |
| Pattern | `PartialDataNotice`, `ErrorState`, `OfflineBanner` (`patterns.tsx`) | — (yeniden kullanılır, yeni pattern icat edilmez) |
| Page | `DashboardRoute` (`routes/app.tsx:643`) | — (genişletilir, yeni sayfa açılmaz) |

**MUST**: yeni her bileşen `registry.ts`'e eklenir, ata-türev ilişkisi kaydedilir (no-duplicate
kuralı — techstack 96-107); `PartialDataNotice`/`ErrorState`/`OfflineBanner` yeniden kullanılır,
paralel bir "boş durum" bileşeni icat edilmez.

---

## 9. Widget Sözleşmesi — Amaç / Veri / Provenance / Aksiyon / Drilldown / İzin / Tazelik / 8 Durum

| Widget | Amaç | Veri kaynağı | Provenance | Birincil aksiyon | Drill-down | İzin | Tazelik | 8 durum kapsandı mı? |
|---|---|---|---|---|---|---|---|---|
| TodaySummaryStrip | Günün 4 metriği | `decisions`, `programs`, capability registry | sourceId+capturedAt her satırda | Karar kuyruğuna git | Her satır ilgili bölüme | Tenant-scoped, rol farkı yok bugün | 60sn `refetchInterval` (health ile aynı desen) | Hayır — inşa edilecek |
| OutcomeDistribution | Sonuç dağılımı | `useDecisionsQuery` | Yok (yalnız sayım) | — | Yok (SHOULD eklenir) | Tenant-scoped | Query-default | Kısmi (4/8: pending/error/empty/populated) |
| DecisionQueue | Onay bekleyen kararlar | `ApprovalOut` (backend'de uç yok) | Karar id + kural sürümü | Onayla/reddet | Karar detayı | Rol: onaylayıcı (backend'de tanımsız) | — | Hayır — inşa edilecek, backend'e kadar blocked |
| OpportunityFeed | Fırsat/son tarih | Yok (backend'de yok) | — | İlgili programa git | Program detayı | Tenant-scoped | — | Hayır |
| SourceFreshnessMeter | Kaynak tazeliği | `useSnapshotsQuery` | capture_at + hash (snapshot bazında) | — | Yok | Tenant-scoped | Her okumada | Kısmi |
| PortfolioAnalytics | Portföy/sonuç/kanıt dağılımı | `programs`,`decisions`,`snapshots` | Yok (agregat, kaynak yok) | Sekme değiştir | Yok (SHOULD) | Tenant-scoped | Query-default | 4/8 (pending/error/empty/populated) |
| EvidenceGapPanel | Eksik kanıt listesi | `Decision.missing_facts` | Karar id | Belgeyi yükle | Hazırlık ekranı | Tenant-scoped | — | Hayır — inşa edilecek |
| FinancialImpactPanel | Toplam/parça finansal etki | Yok (backend `V2-P5-28/29`) | Zorunlu (para her zaman kaynaklı) | — | Karar/program detayı | Rol: finans (tanımsız) | — | Hayır — backend'e kadar blocked |

Zorunlu 8 durum her yeni widget için: `loading, empty, no-result, error, partial, success,
permission, offline` — ayrıca **stale** ayrı bir rozet/durum olarak (query "başarılı ama eski"
göstergesi, TanStack Query `isStale` ile) MUST.

---

## 10. KPI ve Veri Semantiği

**MUST** — her KPI/metrik değeri şu 4 alanı taşır (bugün hiçbir widget'ta yok, yeni tip
gerektirir):

```ts
interface MetricProvenance {
  sourceId: string;        // hangi kayıt/sorgu
  capturedAt: string;      // ISO tarih, ne zaman okundu
  ruleVersion?: string;    // hangi kural motoru sürümü karar verdi
  calibrationStatus: "measured" | "editorial-uncalibrated" | "unmeasured";
}
```

Kurallar:
- Skor/sıralama gösteren her widget, kalibre değilse `calibrationStatus: "editorial-uncalibrated"`
  ile açıkça etiketlenir (gap-rapor 1090) — kalibre edilmemiş bir sıralama kalibre edilmiş bir
  tavsiye gibi görünemez.
- `calibrationStatus: "unmeasured"` olan her değer em-dash render edilir, `0` değil (gap-rapor
  350, 972 — bağlayıcı, istisnasız).
- Para değerleri her zaman string transport + `Intl.NumberFormat` gösterim; `number` tipi
  yasak (techstack 249).
- Tarihler UTC transport + `Intl.DateTimeFormat`/`date-fns` (techstack 248).

---

## 11. Adaptive AI Dashboard Davranışları (global spotlight hariç)

Kapsam: yalnızca kokpit içeriğine bağlı `AdaptiveAssistant` context rail davranışı — global
arama/spotlight bu belgenin dışındadır.

- **MUST**: mevcut `suggestFromLoadedData` deseni korunur — assistant yalnız yüklü veriden öneri
  üretir, ekstra istek atmaz (kod kanıtı: `app.tsx`, `AdaptiveAssistant.tsx:55`).
- **MUST**: `dataStatus` (eksik olgu, bilinmeyen alan, kısmi veri) ölçülmüş kalır; sabit/varsayılan
  değer yasak.
- **SHOULD**: bir öneri bir kokpit kartına bağlandığında o kart görsel olarak vurgulanır (çapraz
  referans) — bugün yok, spekülatif değil ama önceliksiz (MAY→SHOULD sınırında, düşük öncelik).
- **MAY**: kişiselleştirilmiş widget sıralaması/gizleme — backlog'da açık değil, bu belge
  kapsamında MUST/SHOULD değildir.

---

## 12. Filtre / Saved View / Personalization / Export / Refresh

| Kabiliyet | Bugün | Öncelik |
|---|---|---|
| URL durumu (paylaşılabilir link) | Grid seviyesinde çalışıyor (`url-state.ts`), kokpit seviyesinde yok | SHOULD |
| Kayıtlı görünüm | Yalnız tarayıcı-lokal, grid'de çalışıyor; kokpitte yok | MAY (ileri faz) |
| Dışa aktarma | Yalnız CSV, yalnız yüklü satır (grid'de); kokpitte yok | MAY |
| Yenileme (refresh) | `useReadinessQuery` 60sn `refetchInterval`; diğer sorgular manuel invalidation (`useRunEvaluation` başarıda `decisions` invalidate eder) | MUST — her yeni widget aynı TanStack Query invalidation desenini izler |
| Kişiselleştirme (widget sırası/gizleme) | Yok | MAY |

Kural: hiçbir filtre/görünüm kaydı sunucu tarafı kalıcılık olmadan "kurumsal paylaşım" olarak
sunulmaz (gap-rapor 745-770 ile aynı disiplin).

---

## 13. ECharts / TanStack Table-Query Sözleşmesi

- **MUST**: ECharts (`echarts/core` + yalnız kullanılan chart/component/renderer) ana bundle'a
  asla girmez; `React.lazy` + `build-contract.test.ts` mevcut zorlaması yeni her grafik için de
  geçerlidir (kod kanıtı: `EChart.tsx:44-54`, `app.tsx` yorum satırı 600-608).
- **MUST**: grafik `aria-hidden`; erişilebilir gerçek kaynak her zaman bir `<table>` (mevcut
  `PortfolioAnalytics` deseni — özet cümle → tablo → grafik sırası korunur).
- **MUST**: TanStack Query tüm sunucu durumunu taşır; Zustand yalnız UI tercihi (yoğunluk, tema)
  — ikisi asla karışmaz (techstack 151, 214).
- **SHOULD**: server-side pagination/filter/sort sözleşmesi — bugün grid "client-side by
  construction" (`data-grid/types.ts:10-11`); büyük veri setinde kokpit widget'ları aynı riski
  taşımamalı, backend hazır olunca sözleşme eklenir.
- Query key merkezi (`api/queries.ts` `queryKeys`) yeni her kokpit sorgusu için de kullanılır,
  paralel bir key şeması icat edilmez (MUST).

---

## 14. Skeleton-Shimmer-First

**MUST**, istisnasız (techstack §19, satır 601-654):
- Her yeni master bileşen, kendi bileşeninden **önce**, test-first kendi şekil-uyumlu skeleton'ını
  alır (`skeleton-contract.test.tsx` RED önce).
- Skeleton gerçek düzeni taklit eder — tablo satır/sütunu, grafik ekseni+değişken uzunlukta çubuk,
  form etiket-alan çifti; tek düz dikdörtgen yetersiz.
- Skeleton şekilleri `aria-hidden`; kapsayıcı `role="status"` + `aria-busy` + tek cümlelik "ne
  yükleniyor" açıklaması taşır.
- Shimmer `prefers-reduced-motion` ve ürünün kendi `data-reduced-motion` durumunda durur.
- Mevcut boşluk: `DataGrid.tsx`, `templates.tsx`, `QueryBoundary.tsx`, `routes/app.tsx` hâlâ
  generic `SkeletonBlock` kullanıyor — yeni kokpit widget'ları bu genel bloğu miras almaz, kendi
  `SkeletonCard`/`SkeletonChart`/`SkeletonList` şeklini kullanır (`ui/skeleton.tsx`'te mevcut
  şekiller: `SkeletonText/Card/Table/Chart/Form/Media/List/Control/TabStrip`).

---

## 15. Responsive 320/390/768/1024/1440 — Gerçek Davranış

**MUST**: 320px kaynak (native) düzendir, büyütme kademeli iyileştirmedir — mock/ölçekleme değil
(techstack 549, gap-rapor 943). Her yeni kokpit widget'ı için:
- 320px'te yatay taşma yok (mevcut viewport testleri shell seviyesinde var; kokpit içeriği için
  ayrıca kanıtlanmalı — bugün story/test kanıtı yok, bu somut bir boşluktur).
- Kart yığılması: 320-767px tek sütun, 768-1023px 2 sütun (mevcut `dt-stack` deseninin
  genişletilmesiyle), 1024px+ analiz bölümü çok sütunlu olabilir.
- Tablo/grafik içeren widget'lar (analiz, karar kuyruğu) dar ekranda yatay kaydırma yerine
  kart/liste düzenine döner, taşma ile "çöz"ülmez.

---

## 16. Light-Dark, Tipografi, Radius, Motion, Accessibility

Global token'lar (`src/design/tailwind.css`, `@theme inline`) burada **tekrar icat edilmez** —
yalnız kokpite özel uygulama kuralları:

- **MUST**: minimum görünür metin 1rem, Roboto ≥400 ağırlık (global token, techstack 67-68) —
  yeni kokpit metinleri bu alt sınırın altına düşmez.
- **MUST**: köşe yarıçapı ≤12px, arama alanı tek istisna (kokpitte arama alanı yok, istisna
  uygulanmaz).
- **MUST**: dark/light ayrı story, biri diğerinden türetilmez (§20).
- **MUST**: axe critical/serious = 0; mevcut `ProviderComparison` kaçırması
  (`scrollable-region-focusable`, serious) benzeri bir hata yeni scroll edilebilir widget'larda
  (geniş tablo, kanban) tekrarlanmaz.
- **SHOULD**: manuel ekran okuyucu turu — bugün yalnız otomatik axe temiz, bu ayrı ve daha zayıf
  bir iddiadır (gap-rapor 923); yeni kokpit widget'ları için en az bir manuel tur önerilir.

---

## 17. RBAC, Tenant, Audit, Privacy, Security

- **MUST** (backend hazır olduğunda; bugün blocked): her widget rol/tenant bazlı gösterilir/
  gizlenir. Bugün rol modeli backend domain'inde tanımsız (gap-rapor 671, `hasPermission` yalnız
  `provider-connections/capabilities.ts:279` scope'unda, kokpitte hiç yok).
- **MUST**: tenant izolasyonu backend'de Postgres row-level security ile sağlanır
  (`session.py`, `TENANT_SCOPED_TABLES`); frontend hiçbir tenant ID'sini kendi mantığında
  taşımaz, backend'in scope'una güvenir (kod kanıtı doğrulandı).
- **MUST**: her onay/değerlendirme-çalıştırma eylemi audit kaydı bırakır — bugün audit repo var,
  HTTP ucu yok (gap-rapor 676) → bu eylemler backend'e kadar "kaydedilecek ama listelenemeyecek"
  olarak açıkça etiketlenir.
- **MUST**: kimlik/şirket verisi tarayıcı depolamasına yazılmaz (mevcut mimari test kanıtı,
  gap-rapor 903-906) — yeni widget'lar da bu sınırı korur.
- **MUST**: PII otomatik AI bağlamına girmez, loglara yazılmaz (gap-rapor 1099) — özellikle
  `AdaptiveAssistant`'a beslenen widget verisi için geçerli.

---

## 18. i18n

- **MUST**: tüm kokpit metni Türkçe kaynak metin olarak kalır (mevcut disiplin); i18n altyapısı
  bu belge kapsamında yeniden tasarlanmaz — mevcut tek-dil yaklaşımı korunur.
- **MUST**: sayı/tarih/para biçimlendirmesi `Intl.*` API'leri üzerinden yapılır (mevcut
  `lib/intl.ts` deseni), sabit string formatlama eklenmez.
- **SHOULD**: gelecekte çoklu dil açılırsa, provenance/kalibrasyon etiketleri (§10) de çeviri
  anahtarına bağlanır — bugün hardcoded Türkçe olsa da anahtar yapısı öngörülür.

---

## 19. Performance / Observability

- **MUST**: ECharts + zrender ana bundle dışında kalır (mevcut ölçüm: 526,495B ham / 175,842B
  gzip, tamamı lazy — techstack 430); yeni grafik eklerken bu sınır aşılmaz.
- **MUST**: first-load JS gzip ≤180kB bütçesi aşılmaz; aşılırsa kod küçültülür, bütçe
  yükseltilmez (techstack 438-439).
- **UNVERIFIED (açıkça böyle kalır)**: LCP/INP/CLS bugün hiç ölçülmemiş (gap-rapor 919) — yeni
  kokpit widget'ları eklenmeden önce bu ölçüm borcu büyür; rapor bunu gizlemez, her fazda
  "ölçülmedi" olarak tekrar yazılır.
- **SHOULD**: `size-limit` CI gate'i eklenene kadar (techstack §7 satır 258, "eklenecek"
  listesinde), her yeni widget PR'ı manuel bundle-analiz ile kontrol edilir.

---

## 20. Storybook — Title / Story-State-Interaction-A11y-Responsive Matrisi

Mevcut durum kanıtı: `find src -iname "*.stories.tsx"` → 12 dosya (`adaptive.stories.tsx`,
`cognitive-shell.stories.tsx`, `composites.stories.tsx`, `data-grid.stories.tsx`,
`domain.stories.tsx`, `media.stories.tsx`, `patterns.stories.tsx`, `primitives.stories.tsx`,
`provider-connections.stories.tsx`, `shells.stories.tsx`, `templates.stories.tsx`,
`ui.stories.tsx`) — **kokpit/panel/dashboard için sıfır story dosyası** (`*panel*stories*`,
`*dashboard*stories*`, `*cockpit*stories*` grep boş döndü).

**MUST**, her yeni/değişen kokpit bileşeni için 7 boyutlu katalog girişi (techstack 545-557,
bağlayıcı gate — girmezse milestone GREEN olamaz):

| Title (önerilen) | Variant | 8 durumdan anlamlı olanlar | 320/390/768/1024/1440 | Dark/Light (ayrı story) | Interaction (play fn) | A11y (axe) |
|---|---|---|---|---|---|---|
| `Domain/TodaySummaryStrip` | tek | loading, partial (2/4 ölçülemiyor), success, offline | ✓ | ✓ ayrı | odak sırası | critical/serious=0 |
| `Domain/DecisionQueue` | boş/dolu/öncelikli | loading, empty, error, permission, blocked-backend | ✓ | ✓ ayrı | satır seç → detay | critical/serious=0 |
| `Domain/OpportunityFeed` | boş/dolu | empty (veri yoksa gizli), loading, error | ✓ | ✓ ayrı | — | critical/serious=0 |
| `Analytics/PortfolioAnalytics` | 3 sekme | pending, error, empty, populated (mevcut 4) + permission, offline eklenir | ✓ | ✓ ayrı | sekme geçişi, klavye | critical/serious=0 |
| `Pages/Cockpit` | tam sayfa | tüm bölümlerin bileşik durumu | ✓ | ✓ ayrı | Escape/focus (P5 kabul kriteri) | critical/serious=0 |

`.storybook/preview.ts` mevcut viewport seti (W320/W390/W768/W1024/W1440) ve `data-theme`
decorator'ı yeniden kullanılır, yeni bir viewport/tema mekanizması icat edilmez.

---

## 21. Test-First RED-GREEN Acceptance Matrix

| Gereksinim | RED (önce yazılan davranışsal test) | GREEN kriteri |
|---|---|---|
| REQ-DASH-001 (özet şeridi) | "başvuru hazırlığı ölçülemezken `%58` render edilirse test kırmızı" | 4 satır gerçek veriden, ölçülemeyen kalem em-dash |
| REQ-DASH-005 (karar kuyruğu) | "backend ucu yokken bileşen sahte onay listesi göstermemeli" | Liste ya gerçek veriyle ya da `blocked` rozetiyle render olur |
| REQ-DASH-007 (deadline) | "boş çağrı penceresiyle bileşen tarih uydurmamalı" | Boş veri → gizli veya "izlenecek kaynak yok", asla sahte tarih |
| REQ-DASH-009 (finansal etki) | "ölçülmemiş finansal değer `0` render edilirse test kırmızı" | Em-dash + `calibrationStatus:"unmeasured"` |
| Skeleton (§14) | Skeleton bileşenden önce yazılır, geçici stub RED'i tetikler | Gerçek bileşen skeleton'ı geçersiz kılar, layout eşleşir |
| 320px taşma (§15) | Playwright: kokpit bölümü 320px'te yatay scrollbar oluşursa kırmızı | 5 genişlikte taşma yok |
| A11y (§16) | axe critical/serious > 0 ise kırmızı | 0 kritik/ciddi ihlal |

Kural: yalnız davranışsal RED geçerlidir; import/derleme hatası RED sayılmaz (techstack 498-502).
Doğrulama bütçesi: bir tam yerel QA (writer) + bir CI QA — ek doğrulama script'i icat edilmez.

---

## 22. Backend / Demo / Capability — Dürüstlük Kuralı

**MUST**, istisnasız, her bölüm için:
1. Backend ucu yoksa, widget ya gösterilmez ya da açık "engellendi" (blocked) rozeti + nedeni
   ile gösterilir (capability registry deseni, techstack 183).
2. Demo/mock veri her zaman görünür bir rozetle işaretlenir — mevcut desen: `Badge tone="warning"`
   + `srDescription`: "veriler örnektir, sunucuya kayıt yazılmaz" (kod kanıtı, product-scope
   analizi). Yeni her widget aynı deseni kullanır.
3. Mock adaptörle çalışan bir port, hiçbir raporda "bu fonksiyon çalışıyor" olarak yazılmaz
   (gap-rapor 421-423, bağlayıcı).
4. Yazma eylemleri (onay, değerlendirme çalıştırma) backend hazır değilse **disabled**, nedeni
   ekranda yazılı — sessiz kuyruğa alma yasak (`OfflineBanner` deseninde zaten uygulanan kural:
   "Kayıt işlemleri kuyruğa alınmaz").

---

## 23. Mevcut-vs-Hedef Gap Tablosu — Requirement ID'leri

| ID | Gereksinim | Bugün | Öncelik | Kanıt |
|---|---|---|---|---|
| REQ-DASH-001 | Bugünün özeti şeridi (4 satır, provenance'lı) | Yok | MUST | P5 satır 334-336; `domain/capabilities.ts:300` (2/4 kalem ölçülemiyor) |
| REQ-DASH-002 | Skor/sıralama "editoryal, kalibre edilmemiş" etiketi | Skor widget'ı hiç yok | MUST (varsa) | gap-rapor 877-878, 1090 |
| REQ-DASH-003 | Ölçülmemiş değer em-dash, asla `0` değil | Kısmen (katalog/kaynak sayaçlarında var, KPI'da yok) | MUST | gap-rapor 350, 972; kod: `app.tsx` "confident, wrong, measured-looking claim" yorumu |
| REQ-DASH-004 | Proaktif fırsat/deadline akışı | Yok | SHOULD | gap-rapor 303-306, 343 |
| REQ-DASH-005 | Karar/onay kuyruğu ekranı | Şema var, route yok | MUST (blocked ile) | gap-rapor 675-676, 964 |
| REQ-DASH-006 | Başvuru hattı (application pipeline) widget'ı | Domain varlığı yok | MUST uzun vadede | gap-rapor 677, 949 |
| REQ-DASH-007 | Deadline/takvim widget'ı | Yok (kasıtlı) | SHOULD | gap-rapor 680 |
| REQ-DASH-008 | Kanıt-eksikliği paneli | Yalnız ham sayı var | SHOULD | gap-rapor 970 |
| REQ-DASH-009 | Finansal etki bölümü | Yok, kod açıkça reddediyor | SHOULD | gap-rapor 972, 1091 |
| REQ-DASH-010 | Kullanıcı tanımlı dashboard widget grid | Kısmi (3 sabit sekme) | SHOULD | gap-rapor 197, 736, 758 |
| REQ-DASH-011 | DataGrid "dashboard" görünüm modu | Yok (2/11 mod var) | SHOULD | gap-rapor 726-738 |
| REQ-DASH-012 | Server-side grid sözleşmesi | Yok, client-side | SHOULD | gap-rapor 740-743 |
| REQ-DASH-013 | Saved view çapraz-cihaz paylaşım | Yalnız tarayıcı-lokal | MAY | gap-rapor 745-770 |
| REQ-DASH-014 | Export XLSX/PDF, tam veri seti | Yalnız CSV, yüklü satır | MAY | gap-rapor 745-770 |
| REQ-DASH-015 | Klavye komut kısayolları (grid) | Yok | MAY | gap-rapor 745-770 |
| REQ-DASH-016 | Rol/tenant bazlı widget görünürlüğü | Yok, rol modeli tanımsız | MUST (backend'e bağımlı) | gap-rapor 354-355, 671, 952 |
| REQ-DASH-017 | Audit trail ekranı | Repo var, uç/ekran yok | MUST (backend'e bağımlı) | gap-rapor 676, 964, 993 |
| REQ-DASH-018 | Kokpit-özel Storybook story kapsamı | Sıfır dosya | MUST | doğrulandı: grep boş |
| REQ-DASH-019 | 320px taşma testi (kokpit içeriği) | Kanıtsız | MUST | doğrulandı: story/test yok |
| REQ-DASH-020 | Offline durumu kokpit içinde | Var ama shell seviyesinde (`OfflineBanner`, `shells.tsx:107,230`) | MUST (yeniden kullan, yeni bileşen icat etme) | doğrulandı: `patterns.tsx:163`, `shells.tsx` |
| REQ-DASH-021 | Skeleton-shimmer her yeni kokpit widget'ında | `AnalyticsSkeleton` GREEN, geri kalanı generic `SkeletonBlock` | MUST | techstack 616-630 |

---

## 24. Dependency ve Non-Goals

### Bağımlılıklar (backend/P4-P5 fazı, bu belgenin dışında ama onu bloke eden)
- Tenant isolation (`V2-P4-01`), RBAC (`V2-P4-02`) — REQ-DASH-016.
- Analytics/finansal-etki backend modülleri (`V2-P5-28/29`) — REQ-DASH-009.
- Belge zekası backend (`V2-P5-10/11`) — REQ-DASH-008'in tam hali.
- Onay/audit HTTP uçları — REQ-DASH-005, REQ-DASH-017.
- `V2-P6-01` (gerçek backend E2E) GREEN olmadan hiçbir kokpit kabiliyeti "satılabilir" ilan
  edilemez (roadmap, bağlayıcı).

### Non-Goals (bu belge kapsamında kesin olarak yapılmaz)
- Kabuk/masterpage/header/sidebar tasarımı veya değişikliği — kullanıcı zaten verdi.
- Tahmin/forecasting widget'ı — geçmiş çağrı verisi yokken "hallucination riski" nedeniyle şimdi
  yapılırsa zararlı sayılıyor (G2-5).
- Resmî kuruma otomatik başvuru gönderimi — geri alınamaz/hukuki risk, action-queue kapsamına
  girmez.
- Post-delivery "olgunlaştırma", onay checkpoint'i, uydurma müşteri geri bildirimi.
- Customer showcase (H1) bir gate değildir — bu belgenin GREEN'e gitmesi müşteri onayına bağlı
  değildir.
- Yeni bir i18n/tema/viewport altyapısı icat etmek — mevcut global token'lar ve Storybook
  yapılandırması aynen kullanılır.

---

## 25. Definition of Done

Bir kokpit bölümü/widget'ı aşağıdakilerin **hepsi** sağlanmadan tamamlanmış sayılmaz:

1. Davranışsal RED test önce yazıldı ve kırmızıydı (import hatası değil).
2. Tek writer tarafından uygulandı; typed port + açıkça işaretli mock adapter (backend yoksa).
3. Tam gate GREEN: lint, typecheck, test, coverage, build, storybook build, e2e (regresyon yok).
4. axe critical/serious = 0.
5. 320px'te yatay taşma yok, ölçüldü.
6. Görünür metin ≥1rem, köşe yarıçapı ≤12px — ölçüldü, varsayılmadı.
7. Bundle bütçesi (≤180kB gzip first-load) aşılmadı; ECharts ana bundle'a girmedi.
8. 7 boyutlu Storybook katalog girişi eklendi (variant/state/320px/dark-light/interaction/a11y/
   lineage).
9. Bağımsız bir gözden geçiren (yazan kişi değil), değişmez bir kod anlık görüntüsü üzerinde
   GREEN verdi.
10. Altı alanlı rapor yazıldı (`once/simdi/fark/kullaniciYolculugu/kalanEngel/capability_delta`)
    + brüt ekleme/silme/net/dosya sayısı/sınıf/kanıt/gate sonucu.
11. Geri alma (rollback) yolu kayıtlı ve çalıştırılabilir.
12. Backend yoksa capability registry'de açıkça `blocked` işaretlendi; hiçbir raporda "bu
    fonksiyon çalışıyor" yazılmadı.

---

## Kaynak Doğrulama — Kullanılan Kanonik Dosyalar ve Kod Kanıtları

**Kanonik dokümanlar (bu turda tekrar okunup doğrulandı):**
- `/Users/karaca/Downloads/qq33MASTER-PROMPT.md` — BÖLÜM 5 (satır 323-343), BÖLÜM 6 (satır
  347-390) doğrudan bu turda okundu.
- `ENTERPRISE-FRONTEND-TALEP-VE-GAP-RAPORU.md` (1201 satır, tam okundu, önceki turda).
- `FRONTEND-TECHSTACK.md` (653 satır, tam okundu, önceki turda).
- `MULTI-AGENT-GELISTIRME-POLITIKASI-VE-YOL-HARITASI.md` (869 satır, tam okundu, önceki turda).

**Girdi analizleri (sentezlendi):**
- `/tmp/destektesvik-dashboard-product-scope.md` — MUST/SHOULD/MAY, kod kanıtlı ilk bağımsız
  analiz.
- `/tmp/destektesvik-dashboard-enterprise-scope.md` — requirement-ID'li ikinci bağımsız analiz.

**Bu turda doğrudan doğrulanan kod kanıtları:**
- `platform/frontend/src/routes/app.tsx:643-862` — `DashboardRoute` tam gövdesi okundu; "Bugünün
  özeti" şeridinin **kodda bulunmadığı** ve tek-CTA disiplininin (`app.tsx` içi yorum satırları)
  bilinçli bir tasarım kararı olduğu doğrulandı.
- `platform/frontend/src/components/patterns.tsx:149-199` — `OfflineBanner` bileşeni var ve
  offline/offline-with-cached-data durumlarını kapsıyor; `shells.tsx:107,230`'da **shell**
  seviyesinde kullanılıyor (kokpit içeriğine özgü değil, ama yeniden kullanılabilir).
- `platform/frontend/src/domain/capabilities.ts:300` — "7 boyuttan 2'si ölçülemiyor (başvuru
  hazırlığı, kullanıcı güvenlik duruşu)" — P5'in "Bugünün özeti" şeridinin bugünkü veriyle tam
  doldurulamayacağının doğrudan kanıtı.
- `platform/frontend/src/components/registry.ts:23-114` — bileşen kademe listesi (primitifler,
  bileşikler, durum desenleri, kabuklar, alan bileşenleri, sayfa şablonları) doğrulandı.
- `find platform/frontend/src -iname "*.stories.tsx"` — 12 dosya listelendi; kokpit/panel/
  dashboard'a özel story dosyası **sıfır** (doğrulandı, bu turda tekrar çalıştırıldı).
- `grep -rn "navigator.onLine\|isPaused" platform/frontend/src` — yalnız `patterns.tsx:168`
  eşleşti; kokpit içeriğinde ayrı bir offline algılama yok (doğrulandı).
- `grep -n "role" platform/frontend/src/routes/app.tsx` — yalnız demo-rol URL parametresi
  bulundu, gerçek RBAC dallanması yok (doğrulandı).
