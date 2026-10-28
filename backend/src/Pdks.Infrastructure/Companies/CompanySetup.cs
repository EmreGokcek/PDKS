using System.Security.Cryptography;
using Pdks.Domain.Entities;

namespace Pdks.Infrastructure.Companies;

/// <summary>Yeni firma ve kiosk kurulumunda kullanılan hazır değerler.</summary>
public static class CompanySetup
{
    /// <summary>Yeni firmada vardiya planı boş başlamasın diye dört yaygın vardiya şablonu.</summary>
    public static IEnumerable<ShiftTemplate> DefaultShiftTemplates(Guid companyId, Guid branchId)
    {
        ShiftTemplate T(string name, int sh, int sm, int eh, int em, string color) => new()
        {
            CompanyId = companyId,
            BranchId = branchId,
            Name = name,
            StartTime = new TimeOnly(sh, sm),
            EndTime = new TimeOnly(eh, em),
            Color = color
        };

        return
        [
            T("Sabah", 8, 0, 16, 0, "#2f80ed"),
            T("Tam gün", 9, 0, 18, 0, "#1f9a76"),
            T("Akşam", 16, 0, 0, 0, "#9b51e0"),
            T("Gece", 0, 0, 8, 0, "#e07a2f")
        ];
    }

    /// <summary>Kiosk hesabının giriş adresi. Gerçek bir posta kutusu değildir; yalnızca giriş için kullanılır.</summary>
    public static string NewKioskEmail() =>
        $"kiosk.{Convert.ToHexString(RandomNumberGenerator.GetBytes(4)).ToLowerInvariant()}@kiosk.pdks";

    /// <summary>QR imzalama anahtarı.</summary>
    public static string NewKioskSecret() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
}
