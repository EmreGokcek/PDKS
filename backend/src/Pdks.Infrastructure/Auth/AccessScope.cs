using Pdks.Domain.Entities;
using Pdks.Domain.Enums;
using Pdks.Infrastructure.Persistence;

namespace Pdks.Infrastructure.Auth;

/// <summary>
/// Kim kimin verisine erişebilir — tek yerde. Firma ayrımı zaten DbContext filtresiyle yapılır;
/// burada firma içindeki rol ve şube kuralları uygulanır. Hangi sayfaya girilebileceğini yetkiler
/// (Pdks.Domain/Security/Permissions.cs) belirler; bu sınıf o sayfada hangi kişilerin görüneceğini belirler.
/// Ayrıntılı tablo: docs/YETKILER.md
/// </summary>
public class AccessScope(PdksDbContext db, ICurrentUser currentUser)
{
    private UserRole? Role => currentUser.Role;

    /// <summary>
    /// Görebildiği çalışanlar (pano, raporlar, puantaj, vardiya planı, personel listesi):
    /// yönetici ve İK firmadaki herkesi, müdür kendi şubesindeki personel, İK ve müdürleri (yöneticiler hariç),
    /// personel yalnızca kendini. Kiosk hesapları hiçbir listede yer almaz.
    /// </summary>
    public IQueryable<User> VisibleStaff()
    {
        var q = db.Users.Where(u => u.Role != UserRole.Kiosk);
        return Role switch
        {
            UserRole.Admin or UserRole.HumanResources => q,
            UserRole.Manager => q.Where(u => u.BranchId == currentUser.BranchId && u.Role != UserRole.Admin),
            _ => q.Where(u => u.Id == currentUser.UserId)
        };
    }

    /// <summary>
    /// Denetleyebildiği çalışanlar (kayıt düzeltme, talep onayı), kendisi hariç:
    /// yönetici herkesi; İK personel ve müdürleri; müdür yalnızca kendi şubesindeki personeli.
    /// Müdürlerin kayıtlarını yönetici ya da İK, İK ve yöneticilerinkini yönetici düzeltir.
    /// </summary>
    public IQueryable<User> SupervisedStaff()
    {
        var q = db.Users.Where(u => u.Role != UserRole.Kiosk && u.Id != currentUser.UserId);
        return Role switch
        {
            UserRole.Admin => q,
            UserRole.HumanResources => q.Where(u => u.Role == UserRole.Employee || u.Role == UserRole.Manager),
            UserRole.Manager => q.Where(u => u.BranchId == currentUser.BranchId && u.Role == UserRole.Employee),
            _ => q.Where(_ => false)
        };
    }

    /// <summary>Bir kişinin talebini kim onaylayabilir (SupervisedStaff ile aynı kural).</summary>
    public static bool CanReview(UserRole reviewer, Guid? reviewerBranch, UserRole requester, Guid? requesterBranch) =>
        reviewer switch
        {
            UserRole.Admin => true,
            UserRole.HumanResources => requester is UserRole.Employee or UserRole.Manager,
            UserRole.Manager => requester == UserRole.Employee && reviewerBranch == requesterBranch,
            _ => false
        };
}
