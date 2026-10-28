# Yapılacaklar

Geliştirme sırasında fark edilen, acil olmayan eksikler ve fikirler. Canlıya çıkmadan önce bir "cila turu"nda ele alınacak.
Yeni bir şey çıktığında buraya eklenir; yapılınca işaretlenip hangi PR'da yapıldığı yazılır.

## Güvenlik

- [ ] Hesap kilidi mesajı hesabın var olduğunu belli ediyor (kilitli hesaplar için); gerekirse genel bir mesaja çevrilebilir.
- [ ] Açık oturumlar listesi: kişinin hangi cihazlarda oturumu açık, uzaktan kapatabilme.
- [ ] Şifremi unuttum (e-posta ile sıfırlama bağlantısı).
- [ ] Cihaz eşleme: Personel hesabı tek telefona bağlanmalı, yeni cihaz yönetici onayıyla eklenmeli.
- [ ] Konum doğrulama: QR okutma anında işyeri çevresinde olup olmadığının kontrolü (KVKK açık rızasıyla).

## Giriş-çıkış (QR)

- [ ] İzinli günde giriş okutulursa uyarı gösterilmeli ("Bugün yıllık izindesin, yine de giriş yapılsın mı?").
- [ ] Kiosk ekranının internet kesintisinde ne yapacağı: personel tarafında çevrimdışı okutma kuyruğu.

## Pano ve raporlar

- [ ] Canlı pano 30 sn'de bir yenileniyor; anlık güncelleme için SignalR (okutma olduğu an panoya düşsün).
- [ ] 00:00'da başlayan vardiyada bir önceki gün 23:55'te okutulan giriş önceki güne yazılıyor; vardiyaya yakınlığa göre eşleştirme yapılmalı.
- [ ] Raporlarda pasif personelin geçmiş kayıtları: şu an yalnızca okutma kaydı olan pasif kişiler listeleniyor.

## Puantaj

- [ ] Dini bayram tarihleri 2027 sonrası için takvime elle girilmeli (Diyanet takvimi yayınlanınca tabloya eklenebilir).
- [ ] Yıllık izin hakkının yıllara göre kullanım dökümü (hangi yılın izninden düşüldüğü) ve zamanaşımı.
- [ ] Excel çıktısı şimdilik yalnızca Türkçe; arayüz dili İngilizceyse başlıklar da İngilizce olmalı.
- [ ] Bordro programlarına (Logo, Mikro, Netsis) aktarım biçimleri.
- [ ] Ay kapatma: onaylanan ayın kayıtlarının kilitlenmesi (sonradan düzeltme yapılamasın ya da yeniden onay gereksin).
- [ ] Fazla mesai için günlük üst sınır ve yıllık 270 saat uyarısı.

## Talepler ve düzeltmeler

- [ ] Talep onaylanınca / reddedilince personele bildirim (Adım 8: bildirimler).
- [ ] Onaylanan izin yayınlanmış bir haftaya düşerse plana yazılıyor; müdüre "plan değişti" bilgisi gösterilebilir.

## Vardiya planı

- [ ] Farklı günler arasında vardiya takası (şu an yalnızca aynı gün).
- [ ] Boş vardiya ilanı (müdür ilan eder, personel talip olur).
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

## Duyurular ve kutlamalar

- [ ] Duyuruyu kimlerin okuduğu (okundu bilgisi) ve "okudum" onayı
- [ ] Duyuruya görsel / dosya ekleme
- [ ] Doğum günü sabahı kişiye ve ekibe otomatik bildirim (zamanlanmış iş gerekir; şu an pano ve kioskta görünüyor)
- [ ] Yöneticinin duyuruyu belirli bir şubeye hedeflemesi (şu an yönetici: tüm firma, müdür: kendi şubesi)
- [ ] Kutlamaya kısa mesaj yazabilme

## Yönetim

- [ ] Denetim kaydı (AuditLog) görüntüleme ekranı.
- [ ] Personel listesinde sayfalama (çok sayıda personelde).
- [ ] Çoklu şube ekranları (altyapı hazır).

## Kalite

- [ ] Uçtan uca testleri genişlet: personel ekleme, vardiya planlama ve yayınlama, kamerasız QR okutma (bağlantıyla).
- [ ] Erişilebilirlik turu: ekran okuyucu ile planlama tablosu, renk kontrastı kontrolleri.
- [ ] Sunucu hata mesajlarının (title) da çok dilli olması; şu an arayüz "code" alanını çeviriyor, başlık Türkçe yedek.

## Tamamlananlar

- [x] Firma kendi kendine kayıt (firma + ilk şube + yönetici; hazır kurallar ve vardiya şablonları)
- [x] Firma ayarları: firma adı, şubeler (saat dilimi, açma/kapama), giriş kioskları (oluşturma, şifre yenileme, kapatma)

- [x] Canlı pano (SignalR): okutmalar panoya anında düşer, bildirim zili anında güncellenir
- [x] Anlık uyarılar: vardiyasına gelmeyen ve molasını aşan personel için müdüre bildirim (Çalışma kuralları'ndan ayarlanır)

- [x] Benim ayım: personelin kendi aylık puantajı ve özetleri

- [x] Vardiya takası (aynı gün; arkadaş kabulü + müdür onayı, çakışma ve plan değişikliği kontrolü)

- [x] Resmi tatil takvimi (otomatik), yıllık izin bakiyesi (yasal hak, kıdem ve yaş), bakiye düzeltme, ekip izin takvimi, puantajda resmi tatil ve tatil mesaisi

- [x] İK rolü ve tek yerden yönetilen yetki tablosu (docs/YETKILER.md); denetim kaydı ekranı

- [x] Giriş deneme sınırı ve hesap kilidi; yenileme token'ı ve "beni hatırla"; üretim gizli ayarları; `App__PublicUrl`; düzeltme ekranında şube saat dilimi; KVKK aydınlatma metni ve onayı; API entegrasyon testleri; Playwright uçtan uca testleri

- [x] Duyurular (sabitleme, bitiş tarihi, kioskta gösterme, yeni duyuruda bildirim), doğum günü ve iş yıl dönümü kutlamaları, "Kutla" düğmesi

- [x] Kiosk oturumu 8 saatte düşüyordu → 30 gün (PR #7)
- [x] Web uygulamasının ilk açılış dosyası büyüktü → sayfalar ihtiyaç anında yükleniyor (PR #7)
- [x] Vardiya planında boş gün bırakılabiliyordu → yayınlamadan önce her gün dolu olmalı (PR #7)
- [x] İkinci okutmada kameranın açılamaması (PR #4)
