<!-- dondurulmus-snapshot -->

# V2 Başlangıç Çizgisi — Ölçüm Raporu (kanonik baseline)

**Milestone:** `V2-P0-01`
**Base commit:** `7cde09d79e127f62f959b4abc27bf9e7b09591ca`
**Ölçüm tarihi:** 2026-08-15
**Ölçüm makinesi:** macOS (Darwin 25.1.0), arm64, Node v24.6.0, pnpm 11.21.0 (corepack)
**Zorlayan test:** `platform/frontend/src/test/baseline-report.test.ts`

**v2 ilerleme:** 0/147 tamamlandı, 0/147 aktif.

---

## Bu belge nedir, ne değildir

Bu, v2 programının **tek kanonik başlangıç çizgisidir**. Altı ölçüm ailesinin her biri
burada bir sayı, o sayının **ne saydığını** sade Türkçe söyleyen bir tanım, sayıyı üreten
**tam komut** ve o komutun **gerçek çıktısı** ile birlikte durur. Amaç tek bir cümleyi
mümkün kılmaktır: *"ilerleme şu noktadan başladı"* — ve bu cümlenin ikinci bir kişi
tarafından yeniden üretilebilmesi.

**Bu belge bir gösterge paneli değildir.** Depo değiştikçe **yeniden üretilmez**. Yarın bir
rota eklendiğinde buradaki 29 sayısı yanlış olmaz; sadece *başka bir commit'in* sayısı olur.
Tarihsel bir ölçüm kendini güncelliyorsa artık ölçüm değildir. Yeni bir başlangıç çizgisi
gerekirse, bu dosya değiştirilmez; kendi commit'ini adıyla taşıyan **yeni** bir rapor yazılır.

**Ölçüm yüzeyi.** Komutların tamamı **depo kökünden** çalıştırılır ve altı ölçümün beşi
`git show HEAD:` / `git grep HEAD` / `git ls-tree -r <base hash>` üzerinden **commit
ağacını** okur — çalışma dizinini de, index'i de değil. Bu ayrım önemlidir: index'i okuyan
bir komut (`git ls-files` gibi) bir dosya stage'lendiği anda sayıyı değiştirir, commit
ağacını okuyan komut değiştirmez. Bu paketin eklediği iki dosya sayımlara bu yüzden
karışmaz. Ölçüm anında `HEAD` = `7cde09d79e127f62f959b4abc27bf9e7b09591ca`'dır.

**Tek istisna bundle ölçümüdür** ve bu, ağaç ölçümü değildir: `dist/` ignored olduğu için
hiçbir commit'te yoktur, dolayısıyla git ile okunamaz. Ölçülen şey, base commit kaynağından
`pnpm build` ile üretilmiş bir çıktı snapshot'ıdır; ayrıntısı kendi bölümündedir.

---

## Ölçümler

<!-- olcum:rota -->
### 1. Rota tanımı

**Sayı:** 29
**Ne sayılıyor:** `ROUTE_REGISTRY` dizisinde bildirilen rota kaydı sayısı. Bu, uygulamanın
cevap verdiği **adres tanımı** sayısıdır; ayrı ekran uygulaması sayısı değildir. İçinde 4
parametreli rota (`/programlar/:code` gibi) ve 2 bölüm yönlendirmesi (`/organizasyon`,
`/ayarlar`) da vardır; bunlar ziyaret edilebilir statik adres değildir.

```console
$ git show HEAD:platform/frontend/src/app/router.tsx | awk '/^export const ROUTE_REGISTRY/,/^\];/' | grep -c '{ path:'
29
```

<!-- olcum:bilesen -->
### 2. Kayıtlı master bileşen

**Sayı:** 75
**Ne sayılıyor:** `COMPONENT_LEVELS` kütüğünde altı kademeye kayıtlı bileşen adı sayısı
(14 primitif + 16 bileşik + 10 durum deseni + 5 kabuk + 18 alan + 12 şablon). Beş alt sistem
(`data-grid`, `adaptive`, `forms`, `media`, `provider-connections`) ve dört ürün bileşeni bu
sayının **dışındadır**; kendi kütüklerini taşırlar. Sayı, deponun kendi testiyle zaten
kilitlidir (`route-registry.test.ts` → `ALL_COMPONENT_NAMES.length` = 75).

```console
$ git show HEAD:platform/frontend/src/components/registry.ts | awk '/^export const COMPONENT_LEVELS/,/^\} as const/' | grep -oE '"[A-Za-z]+"' | wc -l | tr -d ' '
75
```

<!-- olcum:story -->
### 3. Storybook story exportu

**Sayı:** 126
**Ne sayılıyor:** `*.stories.tsx` dosyalarındaki, tip açıklaması taşıyan adlandırılmış story
exportu sayısı (`: Story`, `: StoryObj<…>`, `: AssistantStory`). Bu **story sayısıdır**,
katalog girişi (`Meta`) sayısı değildir — bugün 10 story dosyası ve 10 katalog girişi vardır,
yani katalog kademe düzeyindedir, bileşen düzeyinde değildir. Aynı kaynak ağacında tip
açıklaması olmayan story exportu yoktur (aynı komut `: [A-Za-z]` koşulu olmadan da 126 verir).

```console
$ git grep -h -E '^export const [A-Za-z0-9_]+: [A-Za-z]' HEAD -- 'platform/frontend/src/**/*.stories.tsx' | wc -l | tr -d ' '
126
```

<!-- olcum:test-dosyasi -->
### 4. Test dosyası

**Sayı:** 52
**Ne sayılıyor:** **Dosya** sayısıdır, test case sayısı değildir — 43 vitest dosyası
(`src/**/*.test.ts`, `src/**/*.test.tsx`) ve 9 Playwright spec dosyası (`e2e/*.spec.ts`).
Bir dosya onlarca `it(...)` taşıyabilir; kaç test case koştuğu bu sayıdan okunamaz ve bu
raporda iddia edilmemektedir.

```console
$ V=$(git ls-tree -r --name-only 7cde09d79e127f62f959b4abc27bf9e7b09591ca -- platform/frontend/src | grep -cE '\.test\.tsx?$'); P=$(git ls-tree -r --name-only 7cde09d79e127f62f959b4abc27bf9e7b09591ca -- platform/frontend/e2e | grep -cE '\.spec\.ts$'); echo "$V vitest + $P playwright = $((V + P)) test dosyasi"
43 vitest + 9 playwright = 52 test dosyasi
```

> **Neden `ls-tree`, `ls-files` değil.** `git ls-files` **index'i** okur, yani bir dosya
> stage'lendiği anda sayıya girer; bu paketin eklediği test dosyası stage'lenseydi sayı
> sessizce 53 olurdu. `git ls-tree -r <hash>` donmuş commit ağacını okur ve çalışma
> dizininden, index'ten ve stage durumundan bağımsızdır.

<!-- olcum:bundle -->
### 5. İlk yüklenen JS (gzip, bayt)

**Sayı:** 202512
**Ne sayılıyor:** `index.html`'in **doğrudan** referans verdiği JS dosyalarının tek tek
gzip'lenmiş boyutlarının toplamı, bayt cinsinden — yani tarayıcının ilk açılışta indirmek
zorunda olduğu JS. Dört dosya: `index`, `rolldown-runtime`, `react`, `components`. Rotaya
göre tembel yüklenen chunk'lar (`app`, `auth`, `public`, `providers`, `media`,
`QueryBoundary`), CSS ve font dosyaları bu sayıya **dahil değildir**.

Her iki komut da **depo kökünden** çalıştırılır; alt kabuk kullanıldığı için çalışma dizini
komuttan sonra değişmez.

```console
$ (cd platform/frontend && pnpm build)
$ (cd platform/frontend/dist && for f in $(grep -oE 'assets/[^"]+\.js' index.html); do gzip -c "$f"; done | wc -c | tr -d ' ')
202512
```

> **Bu ölçüm git ağacını değil, build çıktısını okur — tek istisna budur.**
> `platform/frontend/dist/`, `.gitignore` kapsamındadır ve hiçbir commit'te yoktur; bu yüzden
> `git show`/`git ls-tree` ile okunamaz. Ölçülen dist, base commit
> `7cde09d79e127f62f959b4abc27bf9e7b09591ca` üzerinde, bu worktree'de `pnpm build` ile
> üretilmiş **ignored bir snapshot**'tır. Yani sayı, base commit kaynağından üretilmiş
> çıktının ölçümüdür; ağacın kendisinin ölçümü değildir. Yeniden üretmek için önce yukarıdaki
> `pnpm build` satırı çalıştırılmalıdır — dist yokken ikinci satır sayı üretmez.

> **Bütçe aşımı — açık kaydedilir, bu pakette düzeltilmez.**
> `FRONTEND-TECHSTACK.md` §13 bütçeyi **≤ 180 kB gzip** olarak koyar. Birimi **kB** yazdığı
> için kanonik karşılaştırma **ondalıktır** (1 kB = 1000 bayt).
>
> | Okuma | Ölçülen | Bütçe | Aşım |
> |---|---|---|---|
> | **Ondalık — kanonik, §13'ün yazdığı birim** | 202512 bayt = **202,512 kB** | 180 kB | **22,512 kB** |
> | İkili — alternatif okuma | 202512 bayt = **197,8 KiB** | 180 KiB | **17,8 KiB** |
>
> İki satır **aynı ölçümün iki birimidir**; ikisi de doğrudur, karıştırılmaları yanlıştır.
> 202512 baytı ikili birimle bölüp (197,8) ondalık birimle etiketlemek (kB) ne birinci ne
> ikinci okumadır. Bu raporun ilk taslağı bunu yaptı ve buradan, yukarıdaki iki satırın da
> vermediği bir aşım rakamı çıkardı: ondalık değeri ondalık bütçeden değil, ikili değeri
> ondalık bütçeden çıkardı. Yürürlükteki aşım **22,512 kB**'dir; ikili okumanınki ise
> tablonun ikinci satırındadır. Bu iki dizenin geri gelmesi
> `platform/frontend/src/test/baseline-report.test.ts` tarafından engellenir.
>
> Aynı bölümün kuralı nettir: *"Bütçe aşıldığında bütçe yükseltilmez; kod küçültülür."* Bu
> rapor bir ölçüm belgesidir; bütçeyi yükseltmez, kodu da küçültmez. Aşım, kapatılması
> gereken açık bir kalem olarak buraya yazılmıştır.

<!-- olcum:a11y -->
### 6. Erişilebilirlik tarama kapsamı

**Sayı:** 46
**Ne sayılıyor:** `e2e/accessibility.spec.ts`'in tanımladığı **rota × viewport** axe tarama
kombinasyonu sayısı: 23 statik rota × 2 viewport (320x568 ve 1440x900). Bu bir **kapsam**
ölçüsüdür — kaç yüzeyin taranmak üzere tanımlandığını söyler. **Bulgu sayısı değildir** ve
"critical/serious = 0" iddiası bu raporda ölçülmemiştir; onu üreten komut `pnpm e2e`'dir ve
Chromium indirmesi gerektirdiği için bu pakette çalıştırılmamıştır. Yani bu satır
"erişilebilirlik temiz" demez; "46 tarama tanımlıdır" der.

```console
$ R=$(git show HEAD:platform/frontend/e2e/accessibility.spec.ts | grep -v '^import' | grep -o '"\./[^"]*"' | wc -l | tr -d ' '); W=$(git show HEAD:platform/frontend/e2e/accessibility.spec.ts | grep -cE 'width: [0-9]+'); echo "$R rota x $W viewport = $((R * W)) axe taramasi"
23 rota x 2 viewport = 46 axe taramasi
```

---

## Çelişen eski sayılar — adıyla söylenir

Bu rapor yazılmadan önce depoda **birbiriyle uyuşmayan üç sayı kümesi** vardı. Hiçbiri kasıtlı
yanlış değildir; farklı anlarda yazılmış ve hiçbiri sayısını üreten komutu yanına
koymamıştır. Eski belgeler bu pakette **değiştirilmemiştir** — tarihçe yeniden yazılmaz.
Yürürlükteki başlangıç çizgisi bu belgedir.

| Ölçü | `2026-08-14-enterprise-frontend-implementation.md` | `FRONTEND-TECHSTACK.md` | **Bu baseline (kanonik)** |
|---|---|---|---|
| Rota | **26** | — | **29** |
| Kayıtlı bileşen | 75 | 75 | **75** |
| Story exportu | **54** | **89** | **126** |
| Story dosyası | 6 | 10 | 10 |
| Test dosyası | 17 | — | **52** |
| İlk yük JS (gzip) | ~155 kB | ~155 kB (aynı ölçümü aktarır) | **202,512 kB** (= 197,8 KiB) |

**Neden farklılar:** 2026-08-14 raporu kendi change package'ının bittiği andaki ağacı ölçtü ve
o günden sonra rota, story ve test eklendi. `FRONTEND-TECHSTACK.md` §4.2 daha sonraki bir anı
ölçtü ama sayma kuralını yazmadı, bu yüzden 89 ile 126 arasındaki farkın hangi kuraldan
geldiği belgeden okunamıyor. Bundle farkının sebebi ayrıdır ve zamanla ilgili değildir:
bundler chunk stratejisi değişmiş, tek bir `index` chunk'ı yerine `react` ve `components`
ayrı eager chunk'lara bölünmüştür — yani 155 kB ile 202,512 kB **aynı şeyin iki ölçümü
değildir**, farklı çıktı biçimlerinin ölçümüdür.

**Bundan sonrası için kural:** bir sayı, onu üreten komutla birlikte yazılmadıysa başlangıç
çizgisi değildir. `baseline-report.test.ts` bunu bu belgeye karşı zorlar: her ölçümün komutu
ve çıktısı olmak zorundadır ve **bildirilen sayı kendi çıktısında geçmek zorundadır**.

---

## v1 tarihçesi — aşılmış ve dondurulmuş

`M01`–`M68` kimlik uzayı **aşılmış (superseded)** v1 tarihçesidir ve **dondurulmuştur**.
Silinmez, yeniden numaralandırılmaz, yürürlükte değildir ve **v2 ilerlemesi olarak
sunulmaz**. `F1`–`F10` fazlandırması da aynı şekilde yürürlükten kalkmıştır.

v1'de yapılan iş gerçektir ve yukarıdaki sayılar zaten o işin sonucudur — ama v2'nin
denominatörü ayrıdır ve **147**'dir. v2 tarafında bu ölçüm anında kapanmış milestone yoktur:

> **v2 ilerleme:** 0/147 tamamlandı, 0/147 aktif.

Bu rapor hiçbir v2 milestone'unu GREEN ilan etmez. `V2-P0-01`'in kendi kapanışı da bu belgeyi
yazan pakete değil, MASTER'ın kabulüne bağlıdır.

---

## Sahibin diliyle

Bir CRM'de "geçen ay 54 ekranımız vardı, bugün kaç?" diye sorduğunuzu düşünün. Bugüne kadar
üç belge üç ayrı cevap veriyordu ve üçü de kendi cevabını nasıl saydığını söylemiyordu. Yanlış
cevap veren bir ekip değil, **cevabı doğrulanamayan** bir depo vardı — ilerleme iddiası da bu
zeminin üstüne kuruluyordu.

Bundan sonra tek bir dosya cevap veriyor, cevabın yanında o cevabı üreten komut duruyor, ve
komutla sayı birbirinden koparsa test kırılıyor. Yani rapor artık kendi doğruluğunu koda karşı
kanıtlıyor. Ürün olarak çalışan yeni bir şey yok; **ölçülebilir hale gelen** bir şey var.

**capability_delta:** NONE — bu paket hiçbir kullanıcı yeteneği eklemez, hiçbir ekranı
değiştirmez. Yalnızca ilerleme iddiasının tabanını doğrulanabilir kılar.

**Çalışan ürün iddiası:** değişmedi. **Çalışmayan:** değişmedi. Açık kalan iki kalem bu
raporda adıyla yazılıdır — bundle bütçe aşımı (22,512 kB) ve ölçülmemiş axe bulgu sayısı.
