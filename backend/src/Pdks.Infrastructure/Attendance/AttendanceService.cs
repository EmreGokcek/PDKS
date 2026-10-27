using Microsoft.EntityFrameworkCore;
using Pdks.Domain.Attendance;
using Pdks.Domain.Entities;
using Pdks.Domain.Enums;
using Pdks.Infrastructure.Persistence;
using Pdks.Infrastructure.Scheduling;

namespace Pdks.Infrastructure.Attendance;

public record AttendanceSnapshot(AttendanceSummary Summary, IReadOnlyList<AttendanceEvent> TodayEvents, DateTimeOffset Now);

/// <summary>Personelin olaylarını veritabanından okuyup hesaplayıcıya veren ve yeni okutmaları kaydeden servis.</summary>
public class AttendanceService(PdksDbContext db, TimeProvider time, ShiftPublication publication)
{
    public const string DefaultTimeZone = "Europe/Istanbul";

    public async Task<AttendanceSnapshot> GetSnapshotAsync(User user, CancellationToken ct = default)
    {
        var now = time.GetUtcNow();
        var rules = await db.WorkRules.AsNoTracking().FirstOrDefaultAsync(ct) ?? new WorkRule();
        var tz = await TimeZoneForAsync(user.BranchId, ct);

        var today = AttendanceCalculator.LocalDate(now, tz);
        var weekStart = AttendanceCalculator.WeekStartOf(today, rules.WeekStartsOn);
        // Bir gün öncesinden başla: haftanın ilk gününe sarkan gece vardiyası ve açık oturum için.
        var fromUtc = LocalMidnightUtc(weekStart.AddDays(-1), tz);

        // O günün vardiyasında özel mola süresi varsa günlük mola hakkı odur.
        var todayShifts = await db.Shifts.AsNoTracking()
            .Where(s => s.UserId == user.Id && s.Date == today && s.Kind == ShiftKind.Work)
            .ToListAsync(ct);
        var todayBreak = (await publication.VisibleAsync(todayShifts, ct)).FirstOrDefault()?.BreakMinutes;
        var dailyBreakMinutes = todayBreak ?? rules.DailyBreakMinutes;

        var events = await db.AttendanceEvents.AsNoTracking()
            .Where(e => e.UserId == user.Id && e.OccurredAt >= fromUtc)
            .OrderBy(e => e.OccurredAt)
            .ToListAsync(ct);

        var summary = AttendanceCalculator.Summarize(
            events.Select(e => new EventPoint(e.Type, e.OccurredAt)),
            now, tz,
            new CalculatorRules(rules.WeeklyWorkMinutes, dailyBreakMinutes, rules.WeekStartsOn));

        var todayEvents = events.Where(e => AttendanceCalculator.LocalDate(e.OccurredAt, tz) == today).ToList();
        return new AttendanceSnapshot(summary, todayEvents, now);
    }

    /// <summary>
    /// Okutmayı kaydeder. Geçersiz işlemde hata kodu döner.
    /// Molada çıkış yapılırsa önce mola bitişi aynı anda kaydedilir.
    /// </summary>
    public async Task<(string? Error, AttendanceEvent? Recorded)> RecordAsync(
        User user, AttendanceEventType action, Kiosk kiosk, CancellationToken ct = default)
    {
        var snapshot = await GetSnapshotAsync(user, ct);
        if (AttendanceRules.Validate(action, snapshot.Summary) is { } error) return (error, null);

        var now = time.GetUtcNow();

        AttendanceEvent NewEvent(AttendanceEventType type) => new()
        {
            CompanyId = user.CompanyId,
            BranchId = kiosk.BranchId,
            UserId = user.Id,
            Type = type,
            OccurredAt = now,
            Source = AttendanceSource.QrScan,
            KioskId = kiosk.Id
        };

        if (action == AttendanceEventType.CheckOut && snapshot.Summary.State == AttendanceState.OnBreak)
            db.AttendanceEvents.Add(NewEvent(AttendanceEventType.BreakEnd));

        var recorded = NewEvent(action);
        db.AttendanceEvents.Add(recorded);
        await db.SaveChangesAsync(ct);
        return (null, recorded);
    }

    public async Task<TimeZoneInfo> TimeZoneForAsync(Guid? branchId, CancellationToken ct = default)
    {
        var id = branchId is null
            ? null
            : await db.Branches.Where(b => b.Id == branchId).Select(b => b.TimeZone).FirstOrDefaultAsync(ct);
        return FindTimeZone(id ?? DefaultTimeZone);
    }

    public static TimeZoneInfo FindTimeZone(string id)
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
        catch (TimeZoneNotFoundException) { return TimeZoneInfo.FindSystemTimeZoneById(DefaultTimeZone); }
    }

    private static DateTimeOffset LocalMidnightUtc(DateOnly date, TimeZoneInfo tz) =>
        new(TimeZoneInfo.ConvertTimeToUtc(date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified), tz), TimeSpan.Zero);
}
