# Yapılacaklar

Geliştirme sırasında fark edilen, acil olmayan eksikler ve fikirler. Canlıya çıkmadan önce bir "cila turu"nda ele alınacak.
Yeni bir şey çıktığında buraya eklenir; yapılınca işaretlenip hangi PR'da yapıldığı yazılır.

## Güvenlik

- [ ] Girişte deneme sınırı (rate limiting): aynı IP / e-posta için kısa sürede çok sayıda hatalı deneme engellenmeli.
- [ ] Yenileme token'ı (refresh token): Personel oturumu 8 saatte düşüyor. "Beni hatırla" ve sessiz yenileme eklenmeli.
- [ ] Üretim ortamı gizli bilgileri: JWT anahtarı, veritabanı şifresi ortam değişkenlerinden okunmalı; geliştirme anahtarı kullanılmamalı.
- [ ] Cihaz eşleme: Personel hesabı tek telefona bağlanmalı, yeni cihaz yönetici onayıyla eklenmeli.
- [ ] Konum doğrulama: QR okutma anında işyeri çevresinde olup olmadığının kontrolü (KVKK açık rızasıyla).

## Giriş-çıkış (QR)

- [ ] Kiosk QR bağlantısındaki adres, kioskun açıldığı adresten alınıyor. Canlıda sabit bir genel adres (ör. `APP_PUBLIC_URL`) ayarı olmalı.
- [ ] İzinli günde giriş okutulursa uyarı gösterilmeli ("Bugün yıllık izindesin, yine de giriş yapılsın mı?").
- [ ] Kiosk ekranının internet kesintisinde ne yapacağı: personel tarafında çevrimdışı okutma kuyruğu.

## Pano ve raporlar

- [ ] Canlı pano 30 sn'de bir yenileniyor; anlık güncelleme için SignalR (okutma olduğu an panoya düşsün).
- [ ] 00:00'da başlayan vardiyada bir önceki gün 23:55'te okutulan giriş önceki güne yazılıyor; vardiyaya yakınlığa göre eşleştirme yapılmalı.
- [ ] Raporlarda pasif personelin geçmiş kayıtları: şu an yalnızca okutma kaydı olan pasif kişiler listeleniyor.

## Puantaj

- [ ] Excel çıktısı şimdilik yalnızca Türkçe; arayüz dili İngilizceyse başlıklar da İngilizce olmalı.
- [ ] Bordro programlarına (Logo, Mikro, Netsis) aktarım biçimleri.
- [ ] Ay kapatma: onaylanan ayın kayıtlarının kilitlenmesi (sonradan düzeltme yapılamasın ya da yeniden onay gereksin).
- [ ] Fazla mesai için günlük üst sınır ve yıllık 270 saat uyarısı.

## Talepler ve düzeltmeler

- [ ] Talep onaylanınca / reddedilince personele bildirim (Adım 8: bildirimler).
- [ ] Düzeltme penceresinde tarih / saat tarayıcının saat dilimiyle gösteriliyor; şube saat dilimiyle aynı varsayılıyor. Farklı saat diliminden bakan yönetici için şube saatine çevrilmeli.
- [ ] İzin bakiyesi (kalan yıllık izin günü) ve izin talebinde bakiye kontrolü.
- [ ] Onaylanan izin yayınlanmış bir haftaya düşerse plana yazılıyor; müdüre "plan değişti" bilgisi gösterilebilir.

## Vardiya planı

- [ ] Hafta başlangıç günü yayınlanmış haftalar varken değiştirilirse eski yayın kayıtları yeni haftalarla eşleşmez. Değişiklik sırasında uyarı ya da dönüştürme gerekli.
- [ ] Şablona varsayılan mola süresi eklenmesi (ör. "Gece" vardiyası 30 dk).
- [ ] Planlama tablosunda çoklu seçim (Shift + tıklama) ve klavye ile planlama.
- [ ] Aylık görünüm / birden fazla haftayı birlikte görme.
- [ ] Yayından sonra yapılan değişikliklerin personele bildirilmesi (Adım 8: bildirimler).
- [ ] Resmi tatiller: tatil günleri planda otomatik işaretlenmeli.

## Profil ve bildirimler

- [ ] Telefon numarası biçim doğrulaması (ör. +90 5xx xxx xx xx).
- [ ] Profil fotoğrafı yükleme.
- [ ] KVKK aydınlatma metni sayfası ve ilk girişte onay.
- [ ] Anlık (push) bildirimler: telefona kurulum (PWA) adımında. Şu an uygulama içi; liste 60 sn'de bir yenileniyor.
- [ ] Bildirim tercihleri (hangi bildirimleri almak istediğini seçme) ve eski bildirimlerin otomatik temizlenmesi.

## Yönetim

- [ ] Denetim kaydı (AuditLog) görüntüleme ekranı.
- [ ] Personel listesinde sayfalama (çok sayıda personelde).
- [ ] Çoklu şube ekranları (altyapı hazır).

## Kalite

- [ ] API entegrasyon testleri (gerçek PostgreSQL ile, Testcontainers).
- [ ] Uçtan uca testler (Playwright): giriş, personel ekleme, vardiya planlama, QR okutma akışları.
- [ ] Erişilebilirlik turu: ekran okuyucu ile planlama tablosu, renk kontrastı kontrolleri.
- [ ] Sunucu hata mesajlarının (title) da çok dilli olması; şu an arayüz "code" alanını çeviriyor, başlık Türkçe yedek.

## Tamamlananlar

- [x] Kiosk oturumu 8 saatte düşüyordu → 30 gün (PR #7)
- [x] Web uygulamasının ilk açılış dosyası büyüktü → sayfalar ihtiyaç anında yükleniyor (PR #7)
- [x] Vardiya planında boş gün bırakılabiliyordu → yayınlamadan önce her gün dolu olmalı (PR #7)
- [x] İkinci okutmada kameranın açılamaması (PR #4)
