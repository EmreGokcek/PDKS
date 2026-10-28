using Pdks.Domain.Entities;
using Pdks.Domain.Enums;
using Pdks.Infrastructure.Persistence;

namespace Pdks.Infrastructure.Auth;

/// <summary>
/// Kim kimin verisine erişebilir — tek yerde. Firma ayrımı zaten DbContext filtresiyle yapılır;
/// burada firma içindeki rol ve şube kuralları uygulanır. Ayrıntılı tablo: docs/YETKILER.md
/// </summary>
public class AccessScope(PdksDbContext db, ICurrentUser currentUser)
{
    public bool IsAdmin => currentUser.Role == UserRole.Admin;
    public bool IsManager => currentUser.Role == UserRole.Manager;

    /// <summary>
    /// Görebildiği çalışanlar (pano, raporlar, puantaj, vardiya planı, ekip listesi):
    /// yönetici firmadaki herkesi, müdür kendi şubesindeki personel ve müdürleri, personel yalnızca kendini.
    /// Kiosk hesapları hiçbir listede yer almaz.
    /// </summary>
    public IQueryable<User> VisibleStaff()
    {
        var q = db.Users.Where(u => u.Role != UserRole.Kiosk);
        if (IsAdmin) return q;
        if (IsManager) return q.Where(u => u.BranchId == currentUser.BranchId && u.Role != UserRole.Admin);
        return q.Where(u => u.Id == currentUser.UserId);
    }

    /// <summary>
    /// Denetleyebildiği çalışanlar (kayıt düzeltme, talep onayı): yönetici kendisi dışında herkesi,
    /// müdür yalnızca kendi şubesindeki personeli. Müdürün ve diğer müdürlerin kayıtlarını yönetici düzeltir.
    /// </summary>
    public IQueryable<User> SupervisedStaff()
    {
        var q = db.Users.Where(u => u.Role != UserRole.Kiosk && u.Id != currentUser.UserId);
        if (IsAdmin) return q;
        if (IsManager) return q.Where(u => u.BranchId == currentUser.BranchId && u.Role == UserRole.Employee);
        return q.Where(_ => false);
    }

    /// <summary>Bir rolün talebini kim onaylayabilir: personelinkini şube müdürü ve yönetici, müdürünkini yalnızca yönetici.</summary>
    public static bool CanReview(UserRole reviewer, Guid? reviewerBranch, UserRole requester, Guid? requesterBranch) =>
        reviewer == UserRole.Admin ||
        (reviewer == UserRole.Manager && requester == UserRole.Employee && reviewerBranch == requesterBranch);
}
