using Microsoft.EntityFrameworkCore;
using Pdks.Domain.Attendance;
using Pdks.Domain.Entities;
using Pdks.Domain.Enums;
using Pdks.Domain.Security;
using Pdks.Infrastructure.Attendance;
using Pdks.Infrastructure.Auth;
using Pdks.Infrastructure.Persistence;
using Pdks.Infrastructure.Reports;
using Pdks.Infrastructure.Scheduling;
using Pdks.Infrastructure.Services;

namespace Pdks.Infrastructure.Alerts;

/// <summary>
/// Anlık uyarılar: vardiyası başlayıp gelmeyen ve molasını aşan personel için müdüre bildirim.
/// Arka plan görevi bunu dakikada bir çalıştırır; her firma, şube şube taranır.
///
/// - Gelmedi: yalnızca yayınlanmış plandaki çalışma günleri (personelin bilmediği vardiya için uyarı olmaz).
/// - Alıcı: kişinin şubesindeki müdürler; şubede müdür yoksa yöneticiler ve İK. Kişinin kendisi alıcı olmaz.
/// - Kişi + gün + tür başına tek uyarı (AttendanceAlert benzersiz anahtarı).
/// </summary>
public class AttendanceAlertScanner(
    PdksDbContext db,
    TenantOverride tenant,
    AttendanceReports reports,
    ShiftPublication publication,
    Notifier notifier,
    TimeProvider time)
{
    /// <returns>Gönderilen uyarı sayısı.</returns>
    public async Task<int> RunAsync(CancellationToken ct = default)
    {
        var companies = await db.Companies.AsNoTracking().Where(c => c.IsActive).Select(c => c.Id).ToListAsync(ct);
        var sent = 0;
        foreach (var companyId in companies)
        {
            tenant.CompanyId = companyId;
            try
            {
                sent += await ScanCompanyAsync(ct);
            }
            catch (DbUpdateException)
            {
                // Aynı anda çalışan başka bir sunucu aynı uyarıyı yazdı; bir sonraki turda kalanlar gönderilir.
            }
            finally
            {
                db.ChangeTracker.Clear();
                tenant.CompanyId = null;
            }
        }
        return sent;
    }

    private async Task<int> ScanCompanyAsync(CancellationToken ct)
    {
        var rules = await db.WorkRules.AsNoTracking().FirstOrDefaultAsync(ct) ?? new WorkRule();
        if (rules.NotArrivedAlertMinutes <= 0 && !rules.BreakOverrunAlert) return 0;

        var now = time.GetUtcNow();
        var branches = await db.Branches.AsNoTracking().Where(b => b.IsActive).ToListAsync(ct);
        var staff = await db.Users.AsNoTracking()
            .Where(u => u.IsActive && u.BranchId != null && RolePermissions.Workforce.Contains(u.Role))
            .ToListAsync(ct);
        var sent = 0;

        foreach (var branch in branches)
        {
            var people = staff.Where(u => u.BranchId == branch.Id).ToList();
            if (people.Count == 0) continue;

            var tz = AttendanceService.FindTimeZone(branch.TimeZone);
            var today = AttendanceCalculator.LocalDate(now, tz);
            var ctx = await reports.BuildAsync(people, today, today, ct);
            var published = (await publication.PublishedDaysAsync([(branch.Id, today)], ct)).Count > 0;

            var ids = people.Select(p => p.Id).ToList();
            var already = (await db.AttendanceAlerts.AsNoTracking()
                    .Where(a => a.Date == today && ids.Contains(a.UserId))
                    .Select(a => new { a.UserId, a.Kind })
                    .ToListAsync(ct))
                .Select(a => (a.UserId, a.Kind))
                .ToHashSet();

            foreach (var p in ctx.People)
            {
                var day = p.Days[0];
                var due = new List<(AlertKind Kind, NotificationType Type, object Data)>();

                if (published && !already.Contains((p.User.Id, AlertKind.NotArrived)) &&
                    AttendanceAlerts.NotArrivedDue(day, now, tz, rules.LateToleranceMinutes, rules.NotArrivedAlertMinutes))
                {
                    var (start, _) = DailyReport.ShiftBounds(today, day.Plan!, tz);
                    due.Add((AlertKind.NotArrived, NotificationType.EmployeeNotArrived, new
                    {
                        userId = p.User.Id, name = p.User.FullName, date = today, start = day.Plan!.Start.ToString("HH:mm"),
                        minutes = (int)(now - start).TotalMinutes
                    }));
                }

                if (!already.Contains((p.User.Id, AlertKind.BreakOverrun)) &&
                    AttendanceAlerts.BreakOverrunDue(p.State, day, rules.BreakOverrunAlert))
                {
                    due.Add((AlertKind.BreakOverrun, NotificationType.BreakOverrun, new
                    {
                        userId = p.User.Id, name = p.User.FullName, date = today,
                        minutes = (int)day.BreakOverrun.TotalMinutes, allowance = (int)day.BreakAllowance.TotalMinutes
                    }));
                }

                if (due.Count == 0) continue;
                var recipients = await RecipientsAsync(branch.Id, p.User.Id, ct);

                foreach (var (kind, type, data) in due)
                {
                    db.AttendanceAlerts.Add(new AttendanceAlert { UserId = p.User.Id, Date = today, Kind = kind });
                    notifier.Notify(recipients, type, data);
                    sent++;
                }
            }

            if (db.ChangeTracker.HasChanges()) await db.SaveChangesAsync(ct);
        }
        return sent;
    }

    /// <summary>Şubenin müdürleri; şubede (kişinin kendisi dışında) müdür yoksa yöneticiler ve İK.</summary>
    private async Task<List<Guid>> RecipientsAsync(Guid branchId, Guid exceptUserId, CancellationToken ct)
    {
        var managers = await db.Users.AsNoTracking()
            .Where(u => u.IsActive && u.Id != exceptUserId && u.Role == UserRole.Manager && u.BranchId == branchId)
            .Select(u => u.Id)
            .ToListAsync(ct);
        if (managers.Count > 0) return managers;

        return await db.Users.AsNoTracking()
            .Where(u => u.IsActive && u.Id != exceptUserId && (u.Role == UserRole.Admin || u.Role == UserRole.HumanResources))
            .Select(u => u.Id)
            .ToListAsync(ct);
    }
}
