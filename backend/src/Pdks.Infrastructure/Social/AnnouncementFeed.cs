using Microsoft.EntityFrameworkCore;
using Pdks.Domain.Attendance;
using Pdks.Domain.Entities;
using Pdks.Domain.Enums;
using Pdks.Domain.Social;
using Pdks.Infrastructure.Attendance;
using Pdks.Infrastructure.Persistence;

namespace Pdks.Infrastructure.Social;

/// <summary>Duyuruyu kimlerin göreceği: tüm firma (admin) ya da tek şube.</summary>
public record FeedScope(Guid? BranchId, bool AllBranches);

public record CelebrationItem(Celebration Celebration, int CongratulationCount, bool CongratulatedByViewer);

public record FeedResult(DateOnly Today, List<Announcement> Announcements, List<CelebrationItem> Celebrations);

/// <summary>
/// Duyuru panosu: yayındaki duyurular + bugünkü ve yaklaşan doğum günleri / iş yıl dönümleri.
/// Kutlamalar ayrıca saklanmaz; personelin doğum ve işe giriş tarihinden her istekte hesaplanır.
/// </summary>
public class AnnouncementFeed(PdksDbContext db, AttendanceService attendance, TimeProvider time)
{
    public const int DaysAhead = 7;

    public async Task<DateOnly> TodayAsync(Guid? branchId, CancellationToken ct = default) =>
        AttendanceCalculator.LocalDate(time.GetUtcNow(), await attendance.TimeZoneForAsync(branchId, ct));

    public IQueryable<Announcement> Visible(FeedScope scope) =>
        scope.AllBranches ? db.Announcements : db.Announcements.Where(a => a.BranchId == null || a.BranchId == scope.BranchId);

    public IQueryable<User> People(FeedScope scope)
    {
        var q = db.Users.Where(u => u.IsActive && u.Role != UserRole.Kiosk);
        return scope.AllBranches ? q : q.Where(u => u.BranchId == scope.BranchId);
    }

    public async Task<FeedResult> BuildAsync(FeedScope scope, Guid? viewerId, bool kioskOnly = false, CancellationToken ct = default)
    {
        var today = await TodayAsync(scope.BranchId, ct);

        var announcementQuery = Visible(scope).AsNoTracking().Include(a => a.CreatedBy)
            .Where(a => a.ExpiresOn == null || a.ExpiresOn >= today);
        if (kioskOnly) announcementQuery = announcementQuery.Where(a => a.ShowOnKiosk);
        var announcements = await announcementQuery
            .OrderByDescending(a => a.IsPinned).ThenByDescending(a => a.CreatedAt)
            .Take(20)
            .ToListAsync(ct);

        var people = await People(scope).AsNoTracking()
            .Where(u => u.BirthDate != null || u.HireDate != null)
            .Select(u => new CelebrationPerson(u.Id, u.FirstName + " " + u.LastName, u.BirthDate, u.HireDate, u.ShareBirthday))
            .ToListAsync(ct);
        var upcoming = Celebrations.Upcoming(people, today, kioskOnly ? 0 : DaysAhead);

        var todayIds = upcoming.Where(c => c.DaysUntil == 0).Select(c => c.UserId).ToList();
        var congrats = await db.Congratulations.AsNoTracking()
                .Where(c => c.Date == today && todayIds.Contains(c.ToUserId))
                .Select(c => new { c.ToUserId, c.Kind, c.FromUserId })
                .ToListAsync(ct);

        var items = upcoming.Select(c =>
        {
            var mine = congrats.Where(x => x.ToUserId == c.UserId && x.Kind == c.Kind).ToList();
            return new CelebrationItem(c, mine.Count, viewerId is { } v && mine.Any(x => x.FromUserId == v));
        }).ToList();

        return new FeedResult(today, announcements, items);
    }
}
