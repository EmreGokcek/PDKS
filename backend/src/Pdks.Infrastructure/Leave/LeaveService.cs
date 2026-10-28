using Microsoft.EntityFrameworkCore;
using Pdks.Domain.Entities;
using Pdks.Domain.Enums;
using Pdks.Domain.Leave;
using Pdks.Infrastructure.Persistence;

namespace Pdks.Infrastructure.Leave;

public record LeaveBalance(
    Guid UserId,
    string Name,
    DateOnly? HireDate,
    /// <summary>Hizmet süresi (tam yıl).</summary>
    int ServiceYears,
    int Earned,
    int Adjustments,
    /// <summary>Plana işlenmiş (onaylanmış) yıllık izin günleri.</summary>
    int Used,
    /// <summary>Bekleyen yıllık izin taleplerindeki günler.</summary>
    int Pending,
    /// <summary>Kalan = hak edilen + düzeltmeler − kullanılan.</summary>
    int Remaining,
    /// <summary>Yeni talep için kullanılabilir = kalan − bekleyen.</summary>
    int Available,
    DateOnly? NextEarnedOn,
    int? NextDays);

/// <summary>Yıllık izin bakiyesi: yasal hak (kıdem ve yaşa göre) + elle düzeltmeler − kullanılanlar.</summary>
public class LeaveService(PdksDbContext db, HolidayService holidays)
{
    public async Task<List<LeaveBalance>> BalancesAsync(IQueryable<User> users, DateOnly today, CancellationToken ct = default)
    {
        var people = await users.AsNoTracking()
            .Select(u => new { u.Id, Name = u.FirstName + " " + u.LastName, u.HireDate, u.BirthDate })
            .OrderBy(u => u.Name)
            .ToListAsync(ct);
        var ids = people.Select(p => p.Id).ToList();

        var adjustments = await db.LeaveAdjustments.Where(a => ids.Contains(a.UserId))
            .GroupBy(a => a.UserId).Select(g => new { g.Key, Days = g.Sum(a => a.Days) })
            .ToDictionaryAsync(x => x.Key, x => x.Days, ct);

        var leaveDays = await db.Shifts.Where(s => ids.Contains(s.UserId) && s.Kind == ShiftKind.AnnualLeave)
            .Select(s => new { s.UserId, s.Date }).ToListAsync(ct);
        var pendingRequests = await db.StaffRequests
            .Where(r => ids.Contains(r.UserId) && r.Status == RequestStatus.Pending && r.Type == RequestType.Leave && r.LeaveKind == ShiftKind.AnnualLeave)
            .Select(r => new { r.UserId, Start = r.StartDate!.Value, End = r.EndDate!.Value })
            .ToListAsync(ct);

        // Tatile denk gelen izin günü kullanılmış sayılmaz.
        var allDates = leaveDays.Select(d => d.Date).Concat(pendingRequests.SelectMany(r => new[] { r.Start, r.End })).ToList();
        HashSet<DateOnly> full = allDates.Count == 0 ? [] : await holidays.FullDaysAsync(allDates.Min(), allDates.Max(), ct);

        var pending = new Dictionary<Guid, int>();
        foreach (var r in pendingRequests)
            pending[r.UserId] = pending.GetValueOrDefault(r.UserId) + await CountDaysAsync(r.UserId, r.Start, r.End, full, ct);

        return people.Select(p =>
        {
            var accrual = p.HireDate is { } hire ? AnnualLeave.Accrual(hire, p.BirthDate, today) : null;
            var earned = accrual?.TotalEarned ?? 0;
            var adj = adjustments.GetValueOrDefault(p.Id);
            var used = leaveDays.Count(d => d.UserId == p.Id && !full.Contains(d.Date));
            var pend = pending.GetValueOrDefault(p.Id);
            var remaining = earned + adj - used;
            return new LeaveBalance(p.Id, p.Name, p.HireDate, accrual?.Years.Count ?? 0, earned, adj, used, pend,
                remaining, remaining - pend, accrual?.NextEarnedOn, accrual?.NextDays);
        }).ToList();
    }

    /// <summary>Bir izin aralığında düşülecek gün: tatiller ve (plandaki ya da pazar) hafta tatilleri hariç.</summary>
    public async Task<int> CountDaysAsync(Guid userId, DateOnly start, DateOnly end, IReadOnlySet<DateOnly>? fullDayHolidays = null, CancellationToken ct = default)
    {
        var full = fullDayHolidays ?? await holidays.FullDaysAsync(start, end, ct);
        var plan = await db.Shifts.Where(s => s.UserId == userId && s.Date >= start && s.Date <= end)
            .Select(s => new { s.Date, s.Kind }).ToListAsync(ct);
        return AnnualLeave.CountDays(start, end, full,
            plan.Where(s => s.Kind == ShiftKind.WeeklyOff).Select(s => s.Date).ToHashSet(),
            plan.Select(s => s.Date).ToHashSet());
    }
}
