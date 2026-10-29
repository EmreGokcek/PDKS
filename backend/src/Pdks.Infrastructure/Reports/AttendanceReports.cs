using Microsoft.EntityFrameworkCore;
using Pdks.Domain.Attendance;
using Pdks.Domain.Entities;
using Pdks.Domain.Enums;
using Pdks.Domain.Scheduling;
using Pdks.Infrastructure.Attendance;
using Pdks.Infrastructure.Persistence;

namespace Pdks.Infrastructure.Reports;

public record PersonDays(
    User User,
    IReadOnlyList<DayRecord> Days,
    AttendanceState State,
    DateTimeOffset? SessionStartedAt,
    DateTimeOffset? BreakStartedAt);

public record ReportContext(DateTimeOffset Now, TimeZoneInfo Tz, WorkRule Rules, IReadOnlyList<PersonDays> People);

/// <summary>
/// Müdür panosu ve ekip raporları için kişi kişi, gün gün devam kayıtlarını üretir.
/// Müdür planın tamamını görür (yayınlanmamış haftalar dahil).
/// </summary>
public class AttendanceReports(PdksDbContext db, TimeProvider time)
{
    public async Task<ReportContext> BuildAsync(IReadOnlyList<User> users, DateOnly from, DateOnly to, CancellationToken ct = default)
    {
        var now = time.GetUtcNow();
        var rules = await db.WorkRules.AsNoTracking().FirstOrDefaultAsync(ct) ?? new WorkRule();
        var branchId = users.Select(u => u.BranchId).FirstOrDefault(b => b != null);
        var tzId = branchId is null ? null : await db.Branches.Where(b => b.Id == branchId).Select(b => b.TimeZone).FirstOrDefaultAsync(ct);
        var tz = AttendanceService.FindTimeZone(tzId ?? AttendanceService.DefaultTimeZone);

        var userIds = users.Select(u => u.Id).ToList();
        // Bir gün öncesinden başla (gece vardiyası ve açık oturum), bir gün sonrasına kadar oku (gece vardiyası çıkışı).
        var fromUtc = LocalMidnightUtc(from.AddDays(-1), tz);
        var toUtc = LocalMidnightUtc(to.AddDays(2), tz);

        var events = await db.AttendanceEvents.AsNoTracking()
            .Where(e => userIds.Contains(e.UserId) && e.OccurredAt >= fromUtc && e.OccurredAt < toUtc && e.OccurredAt <= now)
            .Select(e => new { e.UserId, e.Type, e.OccurredAt })
            .ToListAsync(ct);

        // Bir gün sonrası da okunur: son günün gecesinde erken okutulan giriş ertesi günün vardiyasına yazılır.
        var planTo = to.AddDays(1);
        var shifts = await db.Shifts.AsNoTracking()
            .Include(s => s.ShiftTemplate)
            .Where(s => userIds.Contains(s.UserId) && s.Date >= from && s.Date <= planTo)
            .ToListAsync(ct);

        var calcRules = new CalculatorRules(rules.WeeklyWorkMinutes, rules.DailyBreakMinutes, rules.WeekStartsOn);
        var people = users.Select(u =>
        {
            var points = events.Where(e => e.UserId == u.Id).Select(e => new EventPoint(e.Type, e.OccurredAt)).ToList();
            var plans = shifts.Where(s => s.UserId == u.Id).ToDictionary(
                s => s.Date,
                s => new DayPlan(s.Kind, s.StartTime, s.EndTime, s.BreakMinutes, s.ShiftTemplate?.Name, s.ShiftTemplate?.Color));

            var days = DailyReport.Build(points, plans, from, to, now, tz, rules.LateToleranceMinutes, rules.DailyBreakMinutes);
            var live = AttendanceCalculator.Summarize(points, now, tz, calcRules);
            return new PersonDays(u, days, live.State, live.SessionStartedAt, live.BreakStartedAt);
        }).ToList();

        return new ReportContext(now, tz, rules, people);
    }

    /// <summary>Planlanan net çalışma (izinler hariç, molalar düşülmüş).</summary>
    public static TimeSpan PlannedNet(IEnumerable<DayRecord> days, int defaultBreak) =>
        days.Where(d => d.Plan is { Kind: ShiftKind.Work })
            .Aggregate(TimeSpan.Zero, (a, d) => a + ShiftMath.NetDuration(d.Plan!.Start, d.Plan.End,
                TimeSpan.FromMinutes(d.Plan.BreakMinutes ?? defaultBreak)));

    /// <summary>Hafta hafta, haftalık hedefi aşan çalışma toplamı.</summary>
    public static TimeSpan Overtime(IEnumerable<DayRecord> days, WorkRule rules)
    {
        var weekly = TimeSpan.FromMinutes(rules.WeeklyWorkMinutes);
        return days
            .GroupBy(d => AttendanceCalculator.WeekStartOf(d.Date, rules.WeekStartsOn))
            .Select(g => g.Aggregate(TimeSpan.Zero, (a, d) => a + d.Worked))
            .Aggregate(TimeSpan.Zero, (a, w) => a + (w > weekly ? w - weekly : TimeSpan.Zero));
    }

    public static DateOnly Today(DateTimeOffset now, TimeZoneInfo tz) => AttendanceCalculator.LocalDate(now, tz);

    private static DateTimeOffset LocalMidnightUtc(DateOnly date, TimeZoneInfo tz) =>
        new(TimeZoneInfo.ConvertTimeToUtc(date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified), tz), TimeSpan.Zero);
}
