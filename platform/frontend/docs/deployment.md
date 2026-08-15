# Yayınlama sözleşmesi — uygulanmadı, yalnızca belgelendi

> Bu belge bir **karar talebidir**, uygulanmış bir yapılandırma değildir. Bu paket hiçbir
> altyapı değişikliği yapmaz ve hiçbir Python dosyasına dokunmaz.

## Neden ters proxy gerekiyor

Backend'de **CORS middleware yoktur** (`platform/src` içinde `add_middleware` çağrısı sıfır).
Dolayısıyla farklı bir origin'den (`http://localhost:5173`) API çağrısı yapılamaz. Bu bir
eksiklik değil, bilinçli bir daraltmadır: uygulama aynı origin altında çalıştığı sürece CORS'a
ihtiyaç yoktur ve saldırı yüzeyi küçük kalır.

Ayrıca FastAPI yalnızca `/static` dizinini mount eder (`app.py`), `StaticFiles(html=False)` ile.
Yani **SPA'nın `index.html`'ini FastAPI servis edemez**.

Sonuç: SPA'yı aynı origin altında yayınlamak bir **ops kararıdır**.

## Geliştirme — zaten çözülmüş

`vite.config.ts` içindeki `server.proxy`, aşağıdaki yolları backend'e iletir:

```
/api  /saglik  /hazir  /kayit  /giris  /cikis  /profil
/degerlendir  /degerlendirmeler  /kaynaklar  /openapi.json  /static
```

```bash
# 1. Backend
cd platform && uv run --frozen uvicorn --factory \
  destektesvik.delivery.app:build_default_app --host 127.0.0.1 --port 8000

# 2. Frontend
cd platform/frontend && pnpm dev     # http://localhost:5173/uygulama/
```

Farklı bir backend adresi için: `DESTEKTESVIK_BACKEND_ORIGIN=http://127.0.0.1:9000 pnpm dev`.

## Üretim — önerilen sözleşme (UYGULANMADI)

Build çıktısı `/uygulama/` tabanıyla üretilir (`vite.config.ts` → `base`). Router'ın
`basename`'i `import.meta.env.BASE_URL`'den türetilir, yani mount noktası tek yerde tanımlıdır.

Ters proxy'nin karşılaması gereken üç kural:

| Yol | Hedef | Not |
|---|---|---|
| `/uygulama/*` | statik `dist/` | SPA fallback: bulunamayan yol `index.html`'e döner |
| `/api/*`, `/saglik`, `/hazir`, `/openapi.json` | FastAPI | aynı origin olmalı, yoksa çerez gitmez |
| `/kayit`, `/giris`, `/cikis`, `/profil`, `/degerlendir`, `/degerlendirmeler*`, `/kaynaklar`, `/static/*` | FastAPI | SSR sayfaları ve form uçları çalışmaya devam eder |

Örnek Caddy yapılandırması (referans; bu depoda **uygulanmamıştır**):

```caddyfile
ornek.com.tr {
    handle_path /uygulama/* {
        root * /srv/destektesvik/uygulama
        try_files {path} /index.html
        file_server
    }
    handle {
        reverse_proxy 127.0.0.1:8000
    }
}
```

### Güvenlik başlıkları (ters proxy katmanı)

```
Content-Security-Policy: default-src 'self'; connect-src 'self'; img-src 'self' data:;
                         style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'
Referrer-Policy: strict-origin-when-cross-origin
X-Content-Type-Options: nosniff
```

`connect-src 'self'` bu uygulamanın zaten uyduğu bir kısıttır: kaynak taraması harici origin'e
giden hiçbir istek bulmaz ve bu bir testle korunur.

### TLS ve oturum çerezi

TLS ters proxy'de sonlanır. TLS varsa backend'de `DESTEKTESVIK_SESSION_COOKIE_SECURE=true`
**zorunludur** — zaten `development` dışında bu değer olmadan uygulama açılmaz (fail-closed
yapılandırma doğrulaması).

## Doğrulanmamış kapılar

| Kapı | Durum |
|---|---|
| Gerçek ters proxy önünde çalıştırma | **UNVERIFIED** — bu oturumun yetkisinde değil |
| Gerçek FastAPI + PostgreSQL karşısında uçtan uca akış | **UNVERIFIED** — tarayıcı testleri Playwright yönlendirmesi kullanır |
| Lighthouse performans bütçeleri | **UNVERIFIED** — ölçülmedi |
