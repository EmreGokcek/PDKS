# Roller ve yetkiler

Yetkiler tek yerde tanımlıdır: `backend/src/Pdks.Domain/Security/Permissions.cs`.
API her uç noktayı bu yetkilerle korur; giriş yanıtı kullanıcının yetkilerini listeler ve arayüz menüyü, sayfaları ve düğmeleri buna göre gösterir.
Bir yetkiyi değiştirmek için yalnızca o dosyadaki tabloyu güncellemek yeterlidir (birim testleri `PermissionsTests`, uç nokta testleri `RoleTests`).

## Roller

| Rol | Kim | Kapsam |
| --- | --- | --- |
| **Yönetici** | Firma sahibi / genel müdür | Tüm firma, tüm şubeler |
| **İnsan kaynakları** | İK, muhasebe, bordro | Tüm firma, tüm şubeler |
| **Müdür** | Şube / mağaza müdürü | Yalnızca kendi şubesi |
| **Personel** | Çalışan | Yalnızca kendisi |
| **Kiosk** | Girişteki tablet | Yalnızca QR ekranı |

## Yetki tablosu

| Yetki | Ne demek | Yönetici | İK | Müdür | Personel |
| --- | --- | :-: | :-: | :-: | :-: |
| `attendance.self` | Kendi giriş-çıkışı (QR), Bugünüm, vardiyalarım, taleplerim | – | ✓ | ✓ | ✓ |
| `dashboard.view` | Canlı pano (bugün kim nerede) | ✓ | ✓ | ✓ (şube) | – |
| `shifts.plan` | Vardiya planı, şablonlar, yayınlama | ✓ | – | ✓ (şube) | – |
| `reports.view` | Ekip süreleri raporu | ✓ | ✓ | ✓ (şube) | – |
| `timesheet.view` | Aylık puantaj, Excel / PDF | ✓ | ✓ | ✓ (şube) | – |
| `requests.review` | İzin ve düzeltme taleplerini onaylama | ✓ | ✓ | ✓ (şube) | – |
| `attendance.correct` | Giriş-çıkış kaydını elle ekleme / değiştirme / silme | ✓ | ✓ | ✓ (şube) | – |
| `staff.view` | Personel listesi ve profilleri (acil durum kişisi vb.) | ✓ | ✓ | ✓ (şube) | – |
| `staff.manage` | Personel ekleme, düzenleme, pasife alma, şifre sıfırlama | ✓ | ✓ ¹ | – | – |
| `rules.view` | Çalışma kurallarını görme | ✓ | ✓ | ✓ | – ² |
| `rules.manage` | Çalışma kurallarını değiştirme | ✓ | – | – | – |
| `announcements.post` | Duyuru yazma | ✓ (firma) | ✓ (firma) | ✓ (şube) | – |
| `audit.view` | Denetim kaydı | ✓ | ✓ | – | – |
| `leave.manage` | İzin bakiyesi düzeltme, resmi tatil takvimi | ✓ | ✓ | – | – |
| `company.manage` | Firma ayarları, şubeler, kiosklar | ✓ | – | – | – |

¹ İK yönetici hesabı açamaz; yönetici hesaplarını düzenleyemez, pasife alamaz, şifresini sıfırlayamaz.
² Personel kuralları ayrı bir sayfada görmez; vardiya ve süre hesaplarında kullanılan değerler kendi ekranlarında görünür.

Herkes (kiosk hariç): kendi profili, bildirimler, duyuruları okuma ve kutlama.

## Diğer kurallar

- Kimse kendi talebini onaylayamaz, kendi giriş-çıkış kaydını düzeltemez (talep gönderir).
- Kimse kendi rolünü değiştiremez, kendi hesabını pasife alamaz.
- Müdür başka şubenin verisini hiçbir uç noktada göremez (veri sorgu düzeyinde süzülür); yöneticileri listelerde görmez.
- Kişi bazlı kurallar tek yerde: `AccessScope` (sunucu) ve `auth/permissions.ts` (arayüz).
- Kayıt düzeltme ve talep onayı: müdür yalnızca kendi şubesindeki **personelin**; İK personel ve müdürlerin;
  yönetici herkesin (kendisi hariç). Müdürün talebi diğer müdürlere bildirilmez, İK'ya ve yöneticilere gider.
- Firmalar birbirinin verisini göremez (veritabanı düzeyinde firma filtresi).
- Canlı pano bağlantısı yetkiyle aynı kapsamı izler: müdür yalnızca kendi şubesindeki değişiklikleri, yönetici ve İK tüm firmayı duyar.
  Bağlantı veri taşımaz, yalnızca "değişti" der; veri yine yetki kontrolü yapan uç noktadan çekilir.
- Anlık uyarılar (gelmedi, mola aşımı) şube müdürüne gider; şubede müdür yoksa yöneticilere ve İK'ya. Kişinin kendisine gitmez.
- Yeni firma kaydı herkese açıktır (ayarla kapatılabilir); kaydı yapan kişi o firmanın yöneticisi olur ve yalnızca kendi firmasını görür.
- Kiosk hesapları personel listesinde görünmez; Firma ayarlarından yönetilir. Kiosk şifresi yalnızca oluşturma / yenileme anında bir kez gösterilir.
