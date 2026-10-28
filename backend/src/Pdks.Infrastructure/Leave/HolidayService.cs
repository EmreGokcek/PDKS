using Microsoft.EntityFrameworkCore;
using Pdks.Domain.Entities;
using Pdks.Domain.Leave;
using Pdks.Infrastructure.Persistence;

namespace Pdks.Infrastructure.Leave;

/// <summary>Firmanın tatil takvimi. Bir yıl ilk kez istendiğinde Türkiye resmi tatilleriyle doldurulur.</summary>
public class HolidayService(PdksDbContext db)
{
    /// <summary>Verilen yılların takvimi yoksa resmi tatillerle doldurur (değişiklik hemen kaydedilir).</summary>
    public async Task EnsureYearsAsync(IEnumerable<int> years, CancellationToken ct = default)
    {
        var wanted = years.Distinct().ToList();
        var done = await db.HolidayYears.Where(y => wanted.Contains(y.Year)).Select(y => y.Year).ToListAsync(ct);
        var missing = wanted.Except(done).ToList();
        if (missing.Count == 0) return;

        foreach (var year in missing)
        {
            db.HolidayYears.Add(new HolidayYear { Year = year });
            var from = new DateOnly(year, 1, 1);
            var to = new DateOnly(year, 12, 31);
            var existing = await db.PublicHolidays.Where(h => h.Date >= from && h.Date <= to).Select(h => h.Date).ToListAsync(ct);
            foreach (var h in TurkishHolidays.For(year).Where(h => !existing.Contains(h.Date)))
                db.PublicHolidays.Add(new PublicHoliday { Date = h.Date, Name = h.Name, IsHalfDay = h.IsHalfDay });
        }
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // Aynı anda iki istek aynı yılı doldurmaya çalıştıysa biri benzersiz indekse takılır; takvim zaten dolu.
            foreach (var entry in db.ChangeTracker.Entries().Where(e => e.Entity is HolidayYear or PublicHoliday).ToList())
                entry.State = EntityState.Detached;
        }
    }

    public async Task<List<PublicHoliday>> RangeAsync(DateOnly from, DateOnly to, CancellationToken ct = default)
    {
        await EnsureYearsAsync(Enumerable.Range(from.Year, to.Year - from.Year + 1), ct);
        return await db.PublicHolidays.AsNoTracking().Where(h => h.Date >= from && h.Date <= to).OrderBy(h => h.Date).ToListAsync(ct);
    }

    /// <summary>Tam gün tatiller (izin günü hesabında düşülür).</summary>
    public async Task<HashSet<DateOnly>> FullDaysAsync(DateOnly from, DateOnly to, CancellationToken ct = default) =>
        (await RangeAsync(from, to, ct)).Where(h => !h.IsHalfDay).Select(h => h.Date).ToHashSet();
}
