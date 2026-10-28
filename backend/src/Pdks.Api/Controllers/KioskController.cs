using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pdks.Api.Auth;
using Pdks.Api.Common;
using Pdks.Api.Contracts;
using Pdks.Infrastructure.Attendance;
using Pdks.Infrastructure.Auth;
using Pdks.Infrastructure.Persistence;
using Pdks.Infrastructure.Social;
using Pdks.Domain.Enums;

namespace Pdks.Api.Controllers;

/// <summary>Girişteki tabletin kullandığı uç nokta. Ekran bunu birkaç saniyede bir çağırır.</summary>
[ApiController]
[Route("api/kiosk")]
[Authorize(Roles = Roles.Kiosk)]
public class KioskController(
    PdksDbContext db,
    ICurrentUser currentUser,
    KioskQrTokens qrTokens,
    AnnouncementFeed feed,
    TimeProvider time) : ControllerBase
{
    [HttpGet("state")]
    public async Task<ActionResult<KioskStateDto>> State(CancellationToken ct)
    {
        var kiosk = await db.Kiosks.Include(k => k.Branch)
            .FirstOrDefaultAsync(k => k.DeviceUserId == currentUser.UserId, ct);
        if (kiosk is null)
            return this.ApiError(404, "kiosk_not_found", "Bu hesaba bağlı bir kiosk yok.");
        if (!kiosk.IsActive)
            return this.ApiError(400, "kiosk_inactive", "Bu kiosk kullanım dışı.");

        var now = time.GetUtcNow();
        if (kiosk.LastSeenAt is null || now - kiosk.LastSeenAt > TimeSpan.FromMinutes(1))
        {
            kiosk.LastSeenAt = now;
            await db.SaveChangesAsync(ct);
        }

        var (token, expiresAt) = qrTokens.Create(kiosk.Id, kiosk.Secret);

        // Ekranda "Hoş geldin" akışı için son 10 dakikadaki okutmalar. Soyadın yalnızca baş harfi gösterilir.
        var since = now.AddMinutes(-10);
        var recent = await db.AttendanceEvents.AsNoTracking()
            .Where(e => e.KioskId == kiosk.Id && e.OccurredAt >= since)
            .OrderByDescending(e => e.OccurredAt)
            .Take(6)
            .Select(e => new { e.User!.FirstName, e.User.LastName, e.Type, e.OccurredAt })
            .ToListAsync(ct);

        return new KioskStateDto(
            kiosk.Name,
            kiosk.Branch?.Name,
            token,
            expiresAt,
            KioskQrTokens.WindowSeconds,
            now,
            recent.Select(r => new KioskScanDto($"{r.FirstName} {r.LastName[..1]}.", r.Type, r.OccurredAt)).ToList());
    }

    /// <summary>
    /// Kiosk ekranında dönen satırlar: girişte gösterilmesi seçilen duyurular ve bugünkü kutlamalar.
    /// Ekran herkese açık olduğundan soyadının yalnızca baş harfi gösterilir.
    /// </summary>
    [HttpGet("feed")]
    public async Task<ActionResult<List<KioskFeedItemDto>>> Feed(CancellationToken ct)
    {
        var branchId = await db.Kiosks.Where(k => k.DeviceUserId == currentUser.UserId && k.IsActive)
            .Select(k => (Guid?)k.BranchId).FirstOrDefaultAsync(ct);
        if (branchId is null)
            return this.ApiError(404, "kiosk_not_found", "Bu hesaba bağlı bir kiosk yok.");

        var result = await feed.BuildAsync(new FeedScope(branchId, false), null, kioskOnly: true, ct: ct);
        var items = new List<KioskFeedItemDto>();
        foreach (var c in result.Celebrations.Where(c => c.Celebration.DaysUntil == 0))
        {
            var parts = c.Celebration.Name.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            var shortName = parts.Length > 1 ? $"{string.Join(' ', parts[..^1])} {parts[^1][..1]}." : c.Celebration.Name;
            items.Add(new KioskFeedItemDto(
                c.Celebration.Kind == CelebrationKind.Birthday ? "birthday" : "anniversary", shortName, null, c.Celebration.Years));
        }
        items.AddRange(result.Announcements.Select(a => new KioskFeedItemDto("announcement", a.Title, a.Body, null)));
        return items;
    }
}
