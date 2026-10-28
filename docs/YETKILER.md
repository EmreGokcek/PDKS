# Roller ve yetkiler

Dört rol vardır. Her firma (SaaS kiracısı) yalnızca kendi verisini görür; bu ayrım veritabanı katmanında, her sorguya otomatik eklenen firma filtresiyle yapılır. Firma içindeki rol ve şube kuralları tek bir yerde tanımlıdır: `backend/src/Pdks.Infrastructure/Auth/AccessScope.cs` (arayüzdeki karşılığı `frontend/src/auth/permissions.ts`). Asıl kontrol her zaman sunucudadır; arayüz yalnızca izin verilmeyen düğmeleri gizler.

| | Yönetici (Admin) | Müdür (Manager) | Personel (Employee) | Kiosk |
| --- | --- | --- | --- | --- |
| **Kapsam** | Tüm firma, tüm şubeler | Kendi şubesi | Yalnızca kendisi | Bağlı olduğu giriş noktası |
| Kendi giriş-çıkışı (QR), Bugünüm, vardiyalarım, taleplerim, profilim | ✓ | ✓ | ✓ | – |
| Canlı pano, ekip süreleri, puantaj ve Excel | Tüm şubeler | Şubesindeki personel ve müdürler | – | – |
| Vardiya planı ve şablonlar, yayınlama | Tüm şubeler | Kendi şubesi | – | – |
| Personel listesi ve profil (acil durum kişisi dahil) | Herkes | Şubesindeki personel ve müdürler (salt okunur) | Yalnızca kendisi | – |
| Personel ekleme, düzenleme, pasife alma, şifre sıfırlama | ✓ | – | – | – |
| Giriş-çıkış kaydı düzeltme | Kendisi dışında herkes | Yalnızca şubesindeki personel | – (talep gönderir) | – |
| Talep (düzeltme / izin) onaylama | Kendisi dışında herkesinki | Şubesindeki personelinki | – | – |
| Müdürün kendi talebi kime gider | – | Yöneticilere | – | – |
| Çalışma kuralları | Değiştirir | Görür | Görür | – |
| Duyuru yazma | Tüm firmaya | Kendi şubesine | – | – |
| Duyuru düzenleme / silme | Hepsi | Şubesine yazılanlar | – | – |
| Denetim kaydı | ✓ | – | – | – |
| QR kodu gösterme, son okutmalar, kiosk duyuruları | – | – | – | ✓ |

## Kurallar

- **Kimse kendi kaydını düzeltemez, kendi talebini onaylayamaz.** Personel ve müdür düzeltme/izin için talep gönderir.
- **Müdür, başka bir müdürün kayıtlarını düzeltemez ve talebini onaylayamaz**; bunları yönetici yapar. Müdür şubesindeki müdürleri panoda ve raporlarda görür.
- **Müdür yöneticileri listelerde görmez.**
- Kiosk hesabı yalnızca kiosk ekranının uç noktalarını kullanabilir; personel listesi, raporlar gibi hiçbir veriye erişemez.
- Geçici şifreyle giriş yapan kişi, şifresini değiştirmeden başka hiçbir işlem yapamaz.
- Yetkisiz bir kayıt istendiğinde, varlığını belli etmemek için genellikle "bulunamadı" (404) döner.

Bu tablo `backend/tests/Pdks.IntegrationTests/PermissionTests.cs` içindeki testlerle korunur.
