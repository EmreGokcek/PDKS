namespace Pdks.Domain.Enums;

public enum UserRole
{
    /// <summary>Firma sahibi / genel yönetici: her şey, tüm şubeler.</summary>
    Admin = 1,
    /// <summary>Şube müdürü: kendi şubesinin planı, onayları, panosu.</summary>
    Manager = 2,
    Employee = 3,
    /// <summary>Girişteki tablet hesabı: yalnızca QR ekranı.</summary>
    Kiosk = 4,
    /// <summary>İnsan kaynakları / muhasebe: personel, izin, puantaj ve kayıt düzeltme; tüm şubeler. Vardiya planlamaz.</summary>
    HumanResources = 5
}
