using Pdks.Domain.Enums;

namespace Pdks.Domain.Security;

/// <summary>
/// Yetki adları. API'de politika adı, arayüzde menü ve düğmeleri göstermek için kullanılır
/// (kullanıcının yetkileri giriş yanıtında listelenir). Tablonun açıklaması: docs/YETKILER.md
/// </summary>
public static class Perm
{
    /// <summary>Kendi giriş-çıkışı, vardiyaları, talepleri (QR okutma, Bugünüm).</summary>
    public const string AttendanceSelf = "attendance.self";
    public const string DashboardView = "dashboard.view";
    /// <summary>Vardiya planı, şablonlar, yayınlama.</summary>
    public const string ShiftsPlan = "shifts.plan";
    public const string ReportsView = "reports.view";
    public const string TimesheetView = "timesheet.view";
    /// <summary>İzin ve düzeltme taleplerini onaylama / reddetme.</summary>
    public const string RequestsReview = "requests.review";
    /// <summary>Giriş-çıkış kayıtlarını elle ekleme, değiştirme, silme.</summary>
    public const string AttendanceCorrect = "attendance.correct";
    /// <summary>Personel listesi ve profil ayrıntıları (acil durum kişisi vb.).</summary>
    public const string StaffView = "staff.view";
    /// <summary>Personel ekleme, düzenleme, pasife alma, şifre sıfırlama.</summary>
    public const string StaffManage = "staff.manage";
    public const string RulesView = "rules.view";
    public const string RulesManage = "rules.manage";
    public const string AnnouncementsPost = "announcements.post";
    public const string AuditView = "audit.view";
    /// <summary>İzin bakiyesi düzeltme, resmi tatil takvimi.</summary>
    public const string LeaveManage = "leave.manage";
    /// <summary>Firma ayarları, şubeler, kiosklar.</summary>
    public const string CompanyManage = "company.manage";
    public const string Kiosk = "kiosk";

    public static readonly string[] All =
    [
        AttendanceSelf, DashboardView, ShiftsPlan, ReportsView, TimesheetView, RequestsReview, AttendanceCorrect,
        StaffView, StaffManage, RulesView, RulesManage, AnnouncementsPost, AuditView, LeaveManage, CompanyManage, Kiosk
    ];
}

/// <summary>Hangi rol hangi yetkiye sahip; ve verinin kapsamı (tek şube / tüm firma).</summary>
public static class RolePermissions
{
    private static readonly Dictionary<UserRole, HashSet<string>> Map = new()
    {
        [UserRole.Admin] =
        [
            Perm.DashboardView, Perm.ShiftsPlan, Perm.ReportsView, Perm.TimesheetView, Perm.RequestsReview,
            Perm.AttendanceCorrect, Perm.StaffView, Perm.StaffManage, Perm.RulesView, Perm.RulesManage,
            Perm.AnnouncementsPost, Perm.AuditView, Perm.LeaveManage, Perm.CompanyManage
        ],
        [UserRole.Manager] =
        [
            Perm.AttendanceSelf, Perm.DashboardView, Perm.ShiftsPlan, Perm.ReportsView, Perm.TimesheetView,
            Perm.RequestsReview, Perm.AttendanceCorrect, Perm.StaffView, Perm.RulesView, Perm.AnnouncementsPost
        ],
        [UserRole.HumanResources] =
        [
            Perm.AttendanceSelf, Perm.DashboardView, Perm.ReportsView, Perm.TimesheetView, Perm.RequestsReview,
            Perm.AttendanceCorrect, Perm.StaffView, Perm.StaffManage, Perm.RulesView, Perm.AnnouncementsPost,
            Perm.AuditView, Perm.LeaveManage
        ],
        [UserRole.Employee] = [Perm.AttendanceSelf],
        [UserRole.Kiosk] = [Perm.Kiosk],
    };

    public static bool Has(UserRole role, string permission) => Map.TryGetValue(role, out var set) && set.Contains(permission);

    public static IReadOnlyCollection<string> For(UserRole role) =>
        Map.TryGetValue(role, out var set) ? set.Order().ToArray() : [];

    public static IEnumerable<UserRole> RolesWith(string permission) => Map.Where(kv => kv.Value.Contains(permission)).Select(kv => kv.Key);

    /// <summary>Tüm firmanın verisini görür mü? Müdür yalnızca kendi şubesini görür.</summary>
    public static bool IsCompanyWide(UserRole role) => role is UserRole.Admin or UserRole.HumanResources;

    /// <summary>Bu rol hangi rollerde personel ekleyip düzenleyebilir? (İK yönetici hesabı açamaz / değiştiremez.)</summary>
    public static IReadOnlyCollection<UserRole> AssignableRoles(UserRole role) => role switch
    {
        UserRole.Admin => [UserRole.Admin, UserRole.Manager, UserRole.HumanResources, UserRole.Employee],
        UserRole.HumanResources => [UserRole.Manager, UserRole.HumanResources, UserRole.Employee],
        _ => []
    };

    /// <summary>Vardiya planına, panoya ve raporlara giren roller (sahada çalışanlar).</summary>
    public static readonly UserRole[] Workforce = [UserRole.Manager, UserRole.HumanResources, UserRole.Employee];
}
