# PDKS — Personel Devam Kontrol Sistemi

Personelin işe giriş, çıkış ve molalarını QR kod okutarak kaydettiği; yöneticilerin vardiya planlayıp çalışma sürelerini takip ettiği web uygulaması. Çok firmalı (SaaS) yapıya hazır tasarlandı.

## Teknolojiler

| Katman | Teknoloji |
|---|---|
| API | ASP.NET Core (.NET 10), Entity Framework Core, JWT |
| Veritabanı | PostgreSQL 17 |
| Web | React 19, TypeScript, Vite, Tailwind CSS, TanStack Query, React Router, Motion, i18next |

## Proje yapısı

```
backend/
  src/Pdks.Domain/          Varlıklar (Company, User, Shift, AttendanceEvent…) ve enum'lar
  src/Pdks.Infrastructure/  DbContext, tablo ayarları, firma filtresi, demo verisi
  src/Pdks.Api/             Controller'lar, JWT, uygulama başlangıcı
frontend/                   React web uygulaması
docker-compose.yml          Geliştirme için PostgreSQL
```

## Bilgisayarında çalıştırma

Gerekenler: Git, .NET 10 SDK, Node.js 22+, Docker Desktop.

**1. Veritabanını başlat** (proje kök klasöründe)

```bash
docker compose up -d
```

**2. API'yi başlat**

```bash
cd backend/src/Pdks.Api
dotnet run
```

İlk çalıştırmada tablolar oluşturulur ve demo verisi eklenir. API dokümanı: http://localhost:5080/scalar

**3. Web uygulamasını başlat** (yeni bir terminalde)

```bash
cd frontend
npm install
npm run dev
```

Tarayıcıda http://localhost:5173 adresini aç.

## Telefondan denemek

Kamera yalnızca güvenli bağlantıda (https) çalışır. Web uygulamasını şu komutla başlat:

```bash
cd frontend
npm run dev:phone
```

Çıktıdaki `Network: https://192.168.x.x:5173` adresini aynı Wi-Fi'deki telefonda aç. Tarayıcı sertifika uyarısı verir;
geliştirme ortamı için "Gelişmiş → Yine de devam et" ile geçebilirsin. Kiosk ekranını bilgisayarda (`kiosk@pdks.local`),
personel ekranını telefonda (`personel@pdks.local`) açıp QR okutmayı dene.

## Ücretsiz olarak başkalarına denetmek (yayına almadan)

Uygulama senin bilgisayarında çalışır; Cloudflare'in ücretsiz tüneli ona herkesin açabileceği geçici bir `https://…trycloudflare.com`
adresi verir. Hesap açmak gerekmez, ücret yoktur. Bilgisayar kapanınca ya da tünel penceresi kapanınca adres çalışmaz;
her açılışta adres değişir.

1. Bir kez kur (Windows): `winget install --id Cloudflare.cloudflared`
2. Backend'i her zamanki gibi başlat (`dotnet run`).
3. Web arayüzünü paylaşım modunda başlat: `cd frontend` → `npm run dev:paylas` (giriş ekranındaki demo hesap düğmeleri gizlenir).
4. Yeni bir pencerede: `cloudflared tunnel --url http://localhost:5173`
5. Çıktıdaki `https://….trycloudflare.com` adresini paylaş. Telefon kamerası https gerektirdiği için QR okutma da çalışır.

Gerçek denemede "Firmanı kaydet" ile kendi firmanı aç; demo firmadaki hesapların şifresi (`Pdks123!`) herkesçe bilinir.

## Demo hesaplar

Tüm hesapların şifresi `Pdks123!`. Giriş ekranındaki düğmelerle de seçilebilir.

| Rol | E-posta | Açılan sayfa |
|---|---|---|
| Yönetici | admin@pdks.local | /admin |
| Müdür | mudur@pdks.local | /mudur |
| İnsan kaynakları | ik@pdks.local | /ik |
| Personel | personel@pdks.local | /personel |
| Kiosk | kiosk@pdks.local | /kiosk |

## Veritabanı değişiklikleri (migration)

Bir entity değiştiğinde migration'ı elle üretmek gerekmez: commit mesajına `[migration:DegisiklikAdi]` eklenip
`main` dışındaki bir dala gönderildiğinde GitHub Actions migration'ı üretir ve aynı dala commit'ler.
API, geliştirme ortamında açılırken bekleyen migration'ları otomatik uygular.

## Testler

```bash
cd backend && dotnet test          # birim testleri + API entegrasyon testleri (Docker gerekir)
cd frontend && npm run e2e         # uçtan uca testler (API ve web çalışırken)
```

- **Entegrasyon testleri** (`backend/tests/Pdks.IntegrationTests`) her çalıştırmada Docker'da boş bir PostgreSQL açar, API'yi gerçek veritabanıyla başlatır: oturum, hesap kilidi, KVKK onayı, QR okutma, duyuru akışları.
- **Uçtan uca testler** (`frontend/e2e`) Playwright ile gerçek tarayıcıda giriş, oturumun sürmesi, duyuru ve telefon görünümünü dener.
- GitHub'da her PR'da üçü de otomatik çalışır.

## Canlı ortam ayarları

Gizli bilgiler depoda tutulmaz; sunucuda **ortam değişkeni** olarak verilir (iki alt çizgi `__` bölüm ayırıcıdır):

| Değişken | Açıklama |
| --- | --- |
| `ASPNETCORE_ENVIRONMENT` | `Production` |
| `ConnectionStrings__Default` | PostgreSQL bağlantısı (şifre dahil) |
| `Jwt__SigningKey` | En az 32 karakterlik rastgele anahtar. Geliştirme anahtarıyla üretimde uygulama açılmaz. Üretmek için: `openssl rand -base64 48` |
| `App__PublicUrl` | Uygulamanın genel adresi, ör. `https://pdks.firma.com`. Kiosk QR bağlantısı bununla üretilir. |
| `Cors__Origins__0` | Web arayüzü API'den farklı adresteyse o adres |
| `Database__MigrateOnStartup` | `true` ise açılışta veritabanı güncellenir |
| `ReverseProxy__TrustForwardedHeaders` | Uygulama bir ters vekil (Nginx, barındırma platformu) arkasındaysa `true` |
| `Seed__Enabled` | Üretimde `false` (demo hesaplar oluşturulmasın). Canlı demo için `true` + `Seed__DefaultPassword` |
| `Email__Host`, `Email__Port`, `Email__UserName`, `Email__Password`, `Email__From` | "Şifremi unuttum" e-postaları için SMTP (Brevo, Mailgun, Amazon SES, Gmail…). Boşsa e-posta gönderilmez, yalnızca sunucu günlüğüne yazılır. Bağlantı `App__PublicUrl` ile üretilir; üretimde o da gerekli |
| `Registration__Enabled` | Giriş ekranında "Firmanı kaydet" (yeni firmalar kendi kendine kaydolur). Varsayılan `true`; kapatmak için `false` |
| `Alerts__Enabled` | Anlık uyarılar (gelmeyen personel, mola aşımı). Varsayılan `true` |

Canlı pano WebSocket kullanır (`/api/hubs/live`); ters vekil arkasındaysa WebSocket yönlendirmesinin açık olduğundan emin olun (açık değilse pano 30 saniyede bir yenilenerek çalışmaya devam eder).

Oturum ve giriş güvenliği ayarları (`Session`, `RateLimits`; kayıt için IP başına saatte 5 deneme) ve KVKK aydınlatma metni sürümü (`Privacy__NoticeVersion`) `appsettings.json` içinde varsayılanlarıyla durur.

> **KVKK aydınlatma metni** (`frontend/src/features/privacy/notice.ts`) bir şablondur; canlı kullanımdan önce hukuk danışmanına gözden geçirtilmelidir. Metin değişince sürüm numarası hem orada hem `Privacy__NoticeVersion` ayarında artırılır; herkes bir sonraki girişte yeniden onaylar.

## Roller ve yetkiler

Yönetici, İnsan kaynakları, Müdür, Personel ve Kiosk rolleri; kim neyi görür ve değiştirir: [docs/YETKILER.md](docs/YETKILER.md).

## Mimari notlar

- Roller ve yetkiler: [docs/YETKILER.md](docs/YETKILER.md)

- **Çok firmalı yapı:** Her tablo `CompanyId` taşır. `PdksDbContext` içindeki global filtre sayesinde bir kullanıcı yalnızca kendi firmasının verisini görebilir.
- **Şube hazırlığı:** Kayıtlar `BranchId` taşır; şimdilik tek şube kullanılıyor.
- **Dinamik QR:** Kiosk QR'ı 30 saniyede bir değişir ve kioskun gizli anahtarıyla HMAC imzalıdır (`KioskQrTokens`). Bir önceki pencere de kabul edildiğinden bir kod en fazla ~60 sn geçerlidir.
- **Süre hesabı:** `AttendanceCalculator` veritabanından bağımsız, saf bir sınıftır ve `backend/tests` altında testleri vardır.
- **Süreler olaylardan hesaplanır:** Her QR okutması bir `AttendanceEvent` kaydıdır. Çalışma, mola ve fazla mesai bu kayıtlardan hesaplanır; kayıtlar silinmez, düzeltmeler `AuditLog`'a yazılır.
- **Çalışma kuralları:** Haftalık normal süre, günlük mola hakkı (tek seferde) ve geç kalma toleransı firma bazında ayarlanır. Molalar çalışma süresinden düşülür; haftalık normal süreyi aşan kısım fazla mesaidir.

## Yol haritası

Acil olmayan eksikler ve fikirler: [docs/YAPILACAKLAR.md](docs/YAPILACAKLAR.md)


- [x] Adım 1 — Proje iskeleti, veri modeli, giriş ve roller
- [x] Adım 2 — Admin: personel yönetimi, çalışma kuralları, tema ve dil seçenekleri
- [x] Adım 3 — Kiosk dinamik QR, QR ile giriş-çıkış-mola, "Bugünüm" ekranı (anlık durum, kalan mola, haftalık süre, fazla mesai)
- [x] Adım 4 — Vardiya planlama (şablonlar, fırça ile atama, haftayı kopyalama), Vardiyalarım
- [x] Adım 5 — Müdür canlı panosu, geç kalma / erken çıkma / devamsızlık tespiti, ekip süreleri raporu
- [x] Adım 6 — Kayıt düzeltme (gerekçeli, denetim kayıtlı), düzeltme ve izin talepleri, onay akışı
- [x] Adım 7 — Profilim (iletişim, kişisel, acil durum, iş bilgileri; KVKK açık rızası), uygulama içi bildirimler
- [x] Adım 8 — Aylık puantaj cetveli, Excel (Puantaj + Detay) ve A4 yatay PDF / baskı
- [x] Ek — Duyurular, doğum günü ve iş yıl dönümü kutlamaları
- [x] Canlıya çıkış öncesi: giriş deneme sınırı ve hesap kilidi, "beni hatırla" ve sessiz oturum yenileme, gizli ayarlar, KVKK aydınlatma onayı, entegrasyon ve uçtan uca testler
- [ ] Adım 9 — PWA (telefona uygulama gibi kurulum), anlık bildirimler, konum doğrulaması
- [ ] Adım 10 — Sunucuya yükleme
