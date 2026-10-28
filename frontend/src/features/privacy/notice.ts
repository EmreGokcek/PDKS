/**
 * KVKK (6698 sayılı Kanun) md. 10 kapsamında çalışan aydınlatma metni.
 * Metin değişince NOTICE_VERSION artırılmalı ve sunucudaki "Privacy:NoticeVersion" ayarı da aynı değere çekilmeli;
 * böylece herkes bir sonraki girişte güncel metni yeniden okur.
 *
 * Not: Bu metin bir şablondur. Canlı kullanımdan önce firmanın hukuk danışmanınca gözden geçirilmeli
 * (özellikle sunucunun bulunduğu ülke / yurt dışı aktarım ve saklama süreleri).
 */
export const NOTICE_VERSION = '2026-10'

export interface NoticeSection {
  title: string
  body: string[]
}

export function noticeSections(lang: string, company: string | null): NoticeSection[] {
  return lang.startsWith('en') ? en(company ?? 'your employer') : tr(company ?? 'işvereniniz')
}

const tr = (c: string): NoticeSection[] => [
  {
    title: 'Veri sorumlusu',
    body: [
      `Kişisel verileriniz, veri sorumlusu sıfatıyla ${c} tarafından, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") ve ilgili mevzuata uygun olarak işlenmektedir. PDKS uygulaması bu işleme için kullanılan bir araçtır.`,
    ],
  },
  {
    title: 'Hangi verileriniz işleniyor',
    body: [
      'Kimlik ve özlük: ad, soyad, sicil numarası, pozisyon, şube, işe giriş tarihi, doğum tarihi.',
      'İletişim: e-posta adresi, telefon numarası, adres; acil durumda aranacak kişinin adı, telefonu ve yakınlığı.',
      'Çalışma kayıtları: giriş, çıkış ve mola saatleri; okutmanın yapıldığı kiosk; vardiya planları; izin ve düzeltme talepleri; çalışma, mola ve fazla mesai süreleri.',
      'İşlem güvenliği: oturum kayıtları, başarısız giriş denemeleri, kayıtlar üzerinde yapılan değişikliklerin kim tarafından ve ne zaman yapıldığı.',
      'Özel nitelikli veri: kan grubu yalnızca açık rızanız alınarak ve yalnızca girmeyi seçerseniz işlenir. Rızanızı istediğiniz zaman kan grubunu silerek geri alabilirsiniz.',
    ],
  },
  {
    title: 'Hangi amaçlarla',
    body: [
      'İş sözleşmesinin kurulması ve ifası; çalışma sürelerinin, fazla çalışmanın ve izinlerin İş Kanunu ve ilgili yönetmeliklere uygun olarak kayıt altına alınması ve hesaplanması.',
      'Vardiya ve iş planlaması, puantaj ve ücret hesabına esas bilgilerin hazırlanması.',
      'Acil durumlarda size ve yakınınıza ulaşılabilmesi; iş sağlığı ve güvenliği.',
      'Bilgi güvenliğinin sağlanması, hatalı ya da yetkisiz işlemlerin tespiti.',
      'Doğum gününüzün gün ve ayı (yaşınız değil) ile işe giriş yıl dönümünüz, ekip içi duyurularda kutlama amacıyla gösterilir. Doğum günü paylaşımını profilinizden dilediğiniz zaman kapatabilirsiniz.',
    ],
  },
  {
    title: 'Hukuki sebepler',
    body: [
      'KVKK md. 5/2-c: bir sözleşmenin kurulması veya ifasıyla doğrudan ilgili olması.',
      'KVKK md. 5/2-ç: veri sorumlusunun hukuki yükümlülüğünü yerine getirmesi (ör. çalışma sürelerinin kaydı).',
      'KVKK md. 5/2-f: temel hak ve özgürlüklerinize zarar vermemek kaydıyla veri sorumlusunun meşru menfaati (ör. bilgi güvenliği, ekip içi kutlamalar).',
      'KVKK md. 6: kan grubu gibi özel nitelikli veriler için açık rızanız.',
    ],
  },
  {
    title: 'Nasıl toplanıyor',
    body: [
      'Verileriniz; uygulamaya sizin ve yöneticinizin girdiği bilgilerden, girişteki kioskta QR kod okutmanızdan ve uygulamanın kullanımı sırasında oluşan kayıtlardan, kısmen otomatik yollarla toplanır.',
    ],
  },
  {
    title: 'Kimlere aktarılabilir',
    body: [
      'Yasal yükümlülükler kapsamında yetkili kamu kurum ve kuruluşlarına (ör. SGK, denetim makamları, mahkemeler).',
      'Bordro ve muhasebe hizmeti alınan iş ortaklarına, yalnızca ücret hesabı için gerekli olduğu ölçüde.',
      'Uygulamanın çalıştığı sunucu ve barındırma hizmeti sağlayıcılarına, verilerin saklanması amacıyla ve gerekli güvenlik önlemleri alınarak.',
    ],
  },
  {
    title: 'Ne kadar süre saklanıyor',
    body: [
      'Verileriniz iş ilişkisi süresince ve sona ermesinden sonra ilgili mevzuatta öngörülen süreler (çalışma kayıtları için genel olarak 10 yıl) boyunca saklanır; süre dolunca silinir, yok edilir ya da anonim hale getirilir.',
    ],
  },
  {
    title: 'Haklarınız',
    body: [
      'KVKK md. 11 uyarınca; verilerinizin işlenip işlenmediğini öğrenme, işlenmişse bilgi talep etme, işlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme, aktarıldığı üçüncü kişileri bilme, eksik ya da yanlış işlenmişse düzeltilmesini, şartları oluştuğunda silinmesini veya yok edilmesini isteme, bu işlemlerin aktarılan kişilere bildirilmesini isteme, münhasıran otomatik sistemlerle analiz sonucu aleyhinize bir sonuç çıkmasına itiraz etme ve kanuna aykırı işleme nedeniyle zarara uğramanız hâlinde zararın giderilmesini talep etme haklarına sahipsiniz.',
      `Bu haklarınızla ilgili başvurularınızı ${c} insan kaynakları birimine yazılı olarak iletebilirsiniz. Başvurunuz en geç 30 gün içinde sonuçlandırılır.`,
    ],
  },
]

const en = (c: string): NoticeSection[] => [
  {
    title: 'Data controller',
    body: [
      `Your personal data is processed by ${c} as the data controller, in accordance with the Turkish Personal Data Protection Law No. 6698 ("KVKK") and related legislation. The PDKS application is a tool used for this processing.`,
    ],
  },
  {
    title: 'What data is processed',
    body: [
      'Identity and employment: first and last name, employee number, position, branch, hire date, date of birth.',
      'Contact: email address, phone number, address; name, phone and relationship of your emergency contact.',
      'Work records: check-in, check-out and break times; the kiosk used; shift plans; leave and correction requests; worked, break and overtime durations.',
      'Security: session records, failed sign-in attempts, who changed which record and when.',
      'Special category data: blood type is processed only with your explicit consent and only if you choose to enter it. You can withdraw consent at any time by deleting it.',
    ],
  },
  {
    title: 'Purposes',
    body: [
      'Establishing and performing the employment contract; recording and calculating working time, overtime and leave in line with labour law.',
      'Shift and work planning, preparing timesheet and payroll inputs.',
      'Reaching you and your contact in emergencies; occupational health and safety.',
      'Ensuring information security and detecting erroneous or unauthorised actions.',
      'The day and month of your birthday (never your age) and your work anniversary are shown in team announcements for celebrations. You can turn birthday sharing off in your profile at any time.',
    ],
  },
  {
    title: 'Legal grounds',
    body: [
      'KVKK art. 5/2-c: necessary for the establishment or performance of a contract.',
      'KVKK art. 5/2-ç: compliance with a legal obligation of the controller (e.g. working time records).',
      'KVKK art. 5/2-f: legitimate interest of the controller, provided your fundamental rights are not harmed (e.g. information security, team celebrations).',
      'KVKK art. 6: your explicit consent for special category data such as blood type.',
    ],
  },
  {
    title: 'How it is collected',
    body: [
      'Partly by automated means: from information you and your manager enter, from QR scans at the entrance kiosk, and from records created while using the application.',
    ],
  },
  {
    title: 'Who it may be shared with',
    body: [
      'Authorised public institutions under legal obligations (e.g. social security, inspectors, courts).',
      'Payroll and accounting service providers, only as needed for salary calculation.',
      'Server and hosting providers for storage, with appropriate security measures.',
    ],
  },
  {
    title: 'Retention',
    body: [
      'Your data is kept during the employment relationship and afterwards for the periods required by law (generally 10 years for working records), then deleted, destroyed or anonymised.',
    ],
  },
  {
    title: 'Your rights',
    body: [
      'Under KVKK art. 11 you may learn whether your data is processed, request information, learn the purpose and whether it is used accordingly, know the third parties it is transferred to, request correction of incomplete or inaccurate data, request deletion or destruction when conditions are met and notification of these to recipients, object to adverse results arising solely from automated analysis, and claim compensation for damages caused by unlawful processing.',
      `You can submit requests in writing to the human resources department of ${c}. Requests are answered within 30 days at the latest.`,
    ],
  },
]
