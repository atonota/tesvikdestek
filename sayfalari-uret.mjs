import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const kokDizin = dirname(fileURLToPath(import.meta.url));
const kaynakDosya = join(kokDizin, "index.html");
const sitedeKok = "/destektesvik";

const SAYFALAR = [
  { sekme: "sonuc", yol: "senaryo-sonucu", baslik: "Senaryo sonucu", ozet: "Uygulanan senaryonun toplam faydası, başvuru ve yaklaşık tahsilat tarihçesi ve sorumlu roller." },
  { sekme: "kokpit", yol: "yonetici-kokpiti", baslik: "Yönetici kokpiti", ozet: "Bugün elde ne var, neye başvurulabilir ve sıradaki tek eylem nedir." },
  { sekme: "siralama", yol: "oneri-sirasi", baslik: "Öneri sırası", ozet: "Destek ve teşvik programlarının geri ödemesiz net faydaya göre ağırlıklı sıralaması." },
  { sekme: "analitik", yol: "gorsel-analitik", baslik: "Görsel analitik", ozet: "Uygunluk, para gerçeği, çağrı takvimi ve nakit grafikleri." },
  { sekme: "senaryo", yol: "senaryolar", baslik: "Senaryolar", ozet: "Hazır durum setleri; biri uygulanır ve sonuç sayfası açılır." },
  { sekme: "sihirbaz", yol: "uygunluk-sihirbazi", baslik: "Uygunluk sihirbazı", ozet: "Koşullu, çok adımlı uygunluk formu ve hesap varsayımları." },
  { sekme: "nace", yol: "faaliyet-ve-nace", baslik: "Faaliyet ve NACE", ozet: "Birincil ve ikincil faaliyet kodları ile program kapsamı örtüşmesi." },
  { sekme: "yigin", yol: "finansman-yigini", baslik: "Finansman yığını", ozet: "Gider kalemi atamaları ve çift finansman denetimi." },
  { sekme: "uyum", yol: "birlikte-kullanim", baslik: "Birlikte kullanım", ozet: "Programlar arası mevzuat ilişkisi ve birbirini dışlayan destekler." },
  { sekme: "takvim", yol: "takvim", baslik: "Takvim", ozet: "Tarihli eylem sırası ve kaçırılamaz çağrı kapanışları." },
  { sekme: "pano", yol: "basvuru-panosu", baslik: "Başvuru panosu", ozet: "Başvuru aşamaları, kabul tutarları ve alternatif yollar." },
  { sekme: "kanit", yol: "kanit-listesi", baslik: "Kanıt listesi", ozet: "Belge ve kanıt tamamlanma durumu." },
  { sekme: "gunluk", yol: "karar-gunlugu", baslik: "Karar günlüğü", ozet: "Bu tarayıcıda tutulan yerel karar ve olay kaydı." },
  { sekme: "kaynak", yol: "kaynaklar", baslik: "Kaynaklar", ozet: "Resmî bağlantılar, güncellik ve sürüm bilgisi." },
  { sekme: "sozluk", yol: "sozluk", baslik: "Sözlük", ozet: "Destek ve teşvik terimlerinin açıklamaları." },
  { sekme: "ai", yol: "yapay-zeka-ve-mcp", baslik: "Yapay zekâ ve MCP", ozet: "Bağlam paketi, öneri inceleme kuyruğu ve MCP köprü sözleşmesi." }
];

const URUN_ADI = "DestekTeşvik — Başvuru İşletim Sistemi";
const SAYFA_ISARETI = '<meta name="dt-sekme" content="">';

function kacis(metin) {
  return String(metin).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function sayfaBasliklari(sayfa) {
  const tamAdres = "https://karacaismail.github.io" + sitedeKok + "/" + sayfa.yol + "/";
  return [
    '<meta name="dt-sekme" content="' + kacis(sayfa.sekme) + '">',
    '<link rel="canonical" href="' + kacis(tamAdres) + '">',
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="' + kacis(URUN_ADI) + '">',
    '<meta property="og:url" content="' + kacis(tamAdres) + '">',
    '<meta property="og:title" content="' + kacis(sayfa.baslik + " — DestekTeşvik") + '">',
    '<meta property="og:description" content="' + kacis(sayfa.ozet) + '">',
    '<meta name="twitter:card" content="summary">',
    '<meta name="twitter:title" content="' + kacis(sayfa.baslik + " — DestekTeşvik") + '">',
    '<meta name="twitter:description" content="' + kacis(sayfa.ozet) + '">'
  ].join("\n");
}

function sayfaUret(kaynak, sayfa) {
  if (kaynak.indexOf(SAYFA_ISARETI) < 0) {
    throw new Error("index.html içinde sayfa işareti bulunamadı: " + SAYFA_ISARETI);
  }
  return kaynak
    .replace(SAYFA_ISARETI, sayfaBasliklari(sayfa))
    .replace("<title>" + URUN_ADI + "</title>", "<title>" + kacis(sayfa.baslik) + " — DestekTeşvik</title>");
}

function calistir() {
  const kaynak = readFileSync(kaynakDosya, "utf8");
  if (kaynak.indexOf("<title>" + URUN_ADI + "</title>") < 0) {
    throw new Error("index.html içinde beklenen başlık bulunamadı.");
  }
  const uretilen = [];
  SAYFALAR.forEach(sayfa => {
    const dizin = join(kokDizin, sayfa.yol);
    if (existsSync(dizin)) rmSync(dizin, { recursive: true, force: true });
    mkdirSync(dizin, { recursive: true });
    const icerik = sayfaUret(kaynak, sayfa);
    writeFileSync(join(dizin, "index.html"), icerik, "utf8");
    uretilen.push(sayfa.yol + "/index.html");
  });
  process.stdout.write("Üretilen sayfa sayısı: " + uretilen.length + "\n");
  uretilen.forEach(x => process.stdout.write("  " + x + "\n"));
}

calistir();
