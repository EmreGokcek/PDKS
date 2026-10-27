# PDKS — Personel Devam Kontrol Sistemi

Personelin işe giriş, çıkış ve molalarını QR kod okutarak kaydettiği; yöneticilerin vardiya planlayıp çalışma sürelerini takip ettiği web uygulaması. Çok firmalı (SaaS) yapıya hazır tasarlandı.

## Teknolojiler

| Katman | Teknoloji |
|---|---|
| API | ASP.NET Core (.NET 10), Entity Framework Core, JWT |
| Veritabanı | PostgreSQL 17 |
| Web | React 19, TypeScript, Vite, Tailwind CSS, TanStack Query, React Router |

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

## Demo hesaplar

Tüm hesapların şifresi `Pdks123!`. Giriş ekranındaki düğmelerle de seçilebilir.

| Rol | E-posta | Açılan sayfa |
|---|---|---|
| Yönetici | admin@pdks.local | /admin |
| Müdür | mudur@pdks.local | /mudur |
| Personel | personel@pdks.local | /personel |
| Kiosk | kiosk@pdks.local | /kiosk |

## Mimari notlar

- **Çok firmalı yapı:** Her tablo `CompanyId` taşır. `PdksDbContext` içindeki global filtre sayesinde bir kullanıcı yalnızca kendi firmasının verisini görebilir.
- **Şube hazırlığı:** Kayıtlar `BranchId` taşır; şimdilik tek şube kullanılıyor.
- **Süreler olaylardan hesaplanır:** Her QR okutması bir `AttendanceEvent` kaydıdır. Çalışma, mola ve fazla mesai bu kayıtlardan hesaplanır; kayıtlar silinmez, düzeltmeler `AuditLog`'a yazılır.
- **Çalışma kuralları:** Haftalık normal süre, günlük mola hakkı (tek seferde) ve geç kalma toleransı firma bazında ayarlanır. Molalar çalışma süresinden düşülür; haftalık normal süreyi aşan kısım fazla mesaidir.

## Yol haritası

- [x] Adım 1 — Proje iskeleti, veri modeli, giriş ve roller
- [ ] Adım 2 — Admin: personel yönetimi, çalışma kuralları
- [ ] Adım 3 — Kiosk dinamik QR, personelin QR okutması
- [ ] Adım 4 — Personel ekranı: anlık durum, kalan mola, toplam süreler
- [ ] Adım 5 — Müdür: vardiya planlama, canlı pano
