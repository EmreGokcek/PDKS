using Microsoft.EntityFrameworkCore;
using Pdks.Domain.Attendance;
using Pdks.Domain.Entities;
using Pdks.Infrastructure.Persistence;

namespace Pdks.Infrastructure.Scheduling;

/// <summary>Personele hangi vardiyaların görüneceğine karar verir: yalnızca yayınlanmış haftalar.</summary>
public class ShiftPublication(PdksDbContext db)
{
    public async Task<DayOfWeek> WeekStartsOnAsync(CancellationToken ct = default) =>
        (await db.WorkRules.AsNoTracking().FirstOrDefaultAsync(ct))?.WeekStartsOn ?? DayOfWeek.Monday;

    /// <summary>Verilen (şube, tarih) çiftlerinden yayınlanmış haftaya düşenler.</summary>
    public async Task<HashSet<(Guid BranchId, DateOnly Date)>> PublishedDaysAsync(
        IReadOnlyCollection<(Guid BranchId, DateOnly Date)> days, CancellationToken ct = default)
    {
        if (days.Count == 0) return [];
        var weekStartsOn = await WeekStartsOnAsync(ct);
        var starts = days.Select(d => AttendanceCalculator.WeekStartOf(d.Date, weekStartsOn)).Distinct().ToList();
        var branches = days.Select(d => d.BranchId).Distinct().ToList();
        var published = (await db.ShiftWeeks.AsNoTracking()
                .Where(w => starts.Contains(w.WeekStart) && branches.Contains(w.BranchId))
                .Select(w => new { w.BranchId, w.WeekStart })
                .ToListAsync(ct))
            .Select(w => (w.BranchId, w.WeekStart))
            .ToHashSet();
        return days.Where(d => published.Contains((d.BranchId, AttendanceCalculator.WeekStartOf(d.Date, weekStartsOn)))).ToHashSet();
    }

    /// <summary>Verilen vardiyalardan yayınlanmış haftalara düşenleri döner.</summary>
    public async Task<List<Shift>> VisibleAsync(IReadOnlyCollection<Shift> shifts, CancellationToken ct = default)
    {
        if (shifts.Count == 0) return [];

        var weekStartsOn = await WeekStartsOnAsync(ct);
        var starts = shifts.Select(s => AttendanceCalculator.WeekStartOf(s.Date, weekStartsOn)).Distinct().ToList();
        var branches = shifts.Select(s => s.BranchId).Distinct().ToList();

        var published = (await db.ShiftWeeks.AsNoTracking()
                .Where(w => starts.Contains(w.WeekStart) && branches.Contains(w.BranchId))
                .Select(w => new { w.BranchId, w.WeekStart })
                .ToListAsync(ct))
            .Select(w => (w.BranchId, w.WeekStart))
            .ToHashSet();

        return shifts
            .Where(s => published.Contains((s.BranchId, AttendanceCalculator.WeekStartOf(s.Date, weekStartsOn))))
            .ToList();
    }
}
